// Actual SQLite Durable Object and WebSocket clients; local clock controls exist only in the bundled test copy.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createRequire } = require('node:module');
const { createHash } = require('node:crypto');
if (!process.env.TEST_TOOLS_ROOT) throw Error('Set TEST_TOOLS_ROOT to the existing external Miniflare 5/esbuild directory.');
const tools = createRequire(path.resolve(process.env.TEST_TOOLS_ROOT, 'package.json'));
const { Miniflare } = tools('miniflare');
const esbuild = tools('esbuild');
const layoutHash = require('../../../worker/world-physics.json').layoutHash;
assert.equal(layoutHash,
  createHash('sha256').update(fs.readFileSync('public/village/world-layout.json')).digest('hex'), 'Regenerate matching Worker physics before town runtime checks.');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cosy-town-runtime-'));
let source = fs.readFileSync('worker/index.js', 'utf8').replaceAll('Date.now()', 'townTestNow()');
source += `
let townTestOffset = 0;
const townTestNow = () => Date.now() + townTestOffset;
export class TownFixtureWorld extends VillageWorld {
  async fetch(request) {
    const route = new URL(request.url).pathname;
    if (route === '/__test/time') {
      const options = await request.json(); townTestOffset += options.ms;
      if (options.renew !== false) for (const socket of this.sockets()) {
        const visitor = socket.deserializeAttachment(); visitor.lastSeen = townTestNow(); socket.serializeAttachment(visitor);
      }
      this.publishWorld(townTestNow()); return Response.json(this.simulation.snapshot(townTestNow()));
    }
    if (route === '/__test/horse-start') {
      const options = await request.json(), horse = this.simulation.actor(options.id, 'horse');
      Object.assign(horse.state, { x: 85, y: 0, z: 34 + (options.offset || 0), heading: -Math.PI / 2, speed: 0 });
      horse.movement.position = { x: horse.state.x, y: 0, z: horse.state.z };
      this.publishWorld(townTestNow()); return Response.json({ ok: true });
    }
    if (route === '/__test/state') return Response.json(this.simulation.snapshot(townTestNow()));
    if (route === '/__test/debug') {
      const horse = this.simulation.actor('horse-juniper', 'horse');
      return Response.json({ visitors: this.visitors().map(({ id, x, z, horse, activity, forageInventory }) => ({ id, x, z, horse, activity, forageInventory })), inputs: [...this.simulation.riding.inputs],
        clear: this.simulation.riding.clear(horse, horse.state.x, horse.state.z, horse.state.heading, 1) });
    }
    return super.fetch(request);
  }
}
`;
const bundle = esbuild.buildSync({ stdin: { contents: source, resolveDir: path.resolve('worker'), sourcefile: 'index.js' },
  bundle: true, write: false, format: 'esm', platform: 'neutral', external: ['cloudflare:workers'] }).outputFiles[0].text;
const mf = new Miniflare({ host: '127.0.0.1', port: 0, telemetry: { enabled: false }, resourcePersistencePath: temporary,
  workers: [{ config: { name: 'cosy-town-fixture', compatibilityDate: '2026-09-28',
    manifest: { mainModule: 'world.mjs', modules: { 'world.mjs': { type: 'esm', contents: bundle } } },
    env: { VILLAGE: { type: 'durable-object', worker: 'cosy-town-fixture', exportName: 'TownFixtureWorld' } },
    exports: { TownFixtureWorld: { type: 'durable-object', storage: 'sqlite' } } } }] });
const sockets = [], checks = [];
const check = (ok, label) => { assert(ok, label); checks.push(label); };
let stub, requestNumber = 0;
const control = async (route, body) => (await stub.fetch(`http://fixture.invalid/__test/${route}`,
  body ? { method: 'POST', body: JSON.stringify(body) } : {})).json();
const tick = (ms = 120, renew = true) => control('time', { ms, renew });
const state = () => control('state');
async function connect(resumeToken) {
  const response = await mf.dispatchFetch('http://localhost/', { headers: { Upgrade: 'websocket', Origin: 'http://127.0.0.1:3051' } });
  assert.equal(response.status, 101);
  const socket = response.webSocket, messages = [];
  socket.addEventListener('message', event => messages.push(JSON.parse(event.data)));
  socket.accept(); sockets.push(socket);
  const until = async predicate => {
    const deadline = Date.now() + 5000;
    while (!predicate()) { if (Date.now() > deadline) throw Error('Timed out waiting for real town WebSocket messages'); await new Promise(resolve => setTimeout(resolve, 5)); }
  };
  await until(() => messages.some(message => message.type === 'welcome'));
  if (resumeToken) {
    socket.send(JSON.stringify({ type: 'inventory_resume', token: resumeToken, inventory: { apples: 9999, mushrooms: 9999 } }));
    await until(() => messages.some(message => message.type === 'forageInventory'));
  }
  return { socket, messages, until, welcome: messages.find(message => message.type === 'welcome') };
}
async function interact(client, action, id, pose, extra = {}, kind = 'town') {
  await tick(); const requestId = `town-${++requestNumber}`;
  client.socket.send(JSON.stringify({ type: 'interaction', requestId, request: { kind, action, id, ...extra }, pose: { heading: 0, active: true, ...pose } }));
  await client.until(() => client.messages.some(message => message.type === 'interaction_result' && message.requestId === requestId));
  return client.messages.find(message => message.type === 'interaction_result' && message.requestId === requestId).result;
}
const at = (x, z) => ({ x, z });
async function awaitGift(food, collector) {
  for (let i = 0; i < 300; i++) {
    const animal = (await state()).town.animals.find(animal => animal.species === 'hedgehog');
    if (animal.mode === 'gift' && (!food || animal.carry === food)) return animal;
    if (animal.mode === 'gift' && collector) {
      // Public apple regrowth may produce another mushroom first; collect real gifts until an apple is ready.
      await interact(collector, 'animalGift', animal.id, at(animal.x + 1, animal.z));
    }
    await tick(250);
  }
  throw Error(`The actual hedgehog did not bring home its ${food || 'foraged'} gift`);
}
(async () => {
  await mf.ready; stub = (await mf.getDurableObjectNamespace('VILLAGE')).getByName('one-shared-village');
  const a = await connect(); let b = await connect();
  let world = await state();
  check(world.town.beds.length === 15 && world.town.animals.length === 7, 'Two actual WebSocket clients receive fifteen farm rows and seven shared animals');
  check((await interact(a, 'hay', 'horse-juniper', at(82, 40))).ok, 'The actual Worker accepts hay at the relocated stable');
  const mealAt = (await state()).town.hayFeeds[0].startedAt;
  check(!(await interact(b, 'hay', 'horse-juniper', at(82, 40))).ok, 'Actual competing clients cannot feed the same horse twice');
  check(!(await interact(b, 'mount', 'horse-juniper', at(82, 40), {}, 'horse')).ok, 'Actual riders cannot mount a feeding horse');
  const c = await connect();
  check(c.welcome.world.town.hayFeeds[0].startedAt === mealAt, 'A late join sees the original hay meal clock');
  check((await interact(a, 'owlFood', 'owl-feeding-perch', at(-48, -27))).ok, 'The actual perch grants a food pouch');
  check((await interact(a, 'owlFeed', 'owl-feeding-perch', at(-48, -27))).ok, 'The actual owl meal consumes the accepted pouch');
  await interact(b, 'owlFood', 'owl-feeding-perch', at(-48, -27));
  check(!(await interact(b, 'owlFeed', 'owl-feeding-perch', at(-48, -27))).ok, 'Concurrent real clients cannot restart the owl meal');
  check(b.messages.filter(message => message.type === 'crumbs').at(-1).hasCrumbs, 'A rejected owl feed does not consume the second visitor pouch');
  const rowId = 'farm-1-row-4', row = JSON.parse(fs.readFileSync('public/village/world-layout.json')).objects.find(item => item.id === rowId);
  const rowPose = at(row.position[0] + 7.6, row.position[2] + 1.8);
  check((await interact(a, 'gardenPlant', rowId, rowPose, { crop: 'carrot' })).ok, 'Real clients plant at a long farm row end');
  check(!(await interact(b, 'gardenPlant', rowId, rowPose, { crop: 'mint' })).ok, 'Actual concurrent planting refuses the second crop');
  check((await interact(a, 'gardenWater', rowId, rowPose)).ok, 'The actual Worker sets a growth deadline');
  const wateredAt = (await state()).town.beds.find(bed => bed.id === rowId).wateredAt;
  check(!(await interact(b, 'gardenWater', rowId, rowPose)).ok && (await state()).town.beds.find(bed => bed.id === rowId).wateredAt === wateredAt,
    'Actual competing water keeps the first accepted clock');
  await tick(180000);
  check((await interact(a, 'gardenHarvest', rowId, rowPose)).ok, 'The actual Worker harvests a grown row');
  check(!(await interact(b, 'gardenHarvest', rowId, rowPose)).ok && (await state()).town.harvest.carrot === 1,
    'Actual simultaneous harvest grants exactly one recorded crop');
  check(a.messages.filter(message => message.type === 'forageInventory').at(-1).inventory.carrots === 1,
    'An accepted farm harvest grants only the harvesting visitor one private carrot');
  for (const species of ['cow', 'sheep', 'lamb', 'hedgehog']) {
    if (species === 'hedgehog') await awaitGift('apple');
    const animal = (await state()).town.animals.find(animal => animal.species === species), pose = at(animal.x + 1, animal.z);
    check((await interact(a, 'animalPet', animal.id, pose)).ok, `An actual client pets the ${species}`);
    const held = (await state()).town.animals.find(value => value.id === animal.id);
    check(!(await interact(b, 'animalPet', animal.id, pose)).ok, `A competing client cannot take the ${species}`);
    const current = (await state()).town.animals.find(value => value.id === animal.id);
    check(current.x === held.x && current.z === held.z, `The shared ${species} holds still during petting`);
  }
  await tick(6500);
  check((await state()).town.animals.every(animal => animal.owner === null), 'All actual animal claims expire without reserving the pasture');
  const appleGift = await awaitGift('apple'), giftPose = at(appleGift.x + 1, appleGift.z);
  check((await interact(a, 'animalGift', appleGift.id, giftPose)).ok, 'A real visitor receives the carried orchard apple at the hedgehog home');
  check(a.messages.filter(message => message.type === 'forageInventory').at(-1).inventory.apples === 1,
    'Only the receiving client gets the accepted private inventory update');
  check(!(await interact(b, 'animalGift', appleGift.id, giftPose)).ok && !b.messages.some(message => message.type === 'forageInventory'),
    'Actual competing gift claims cannot duplicate the apple or receive a private grant');
  const mushroomGift = await awaitGift('mushroom');
  check((await interact(b, 'animalGift', mushroomGift.id, at(mushroomGift.x + 1, mushroomGift.z))).ok,
    'The actual shared hedgehog forages the authored mushroom patch next');
  const nextApple = await awaitGift('apple', b);
  check((await interact(b, 'animalGift', nextApple.id, at(nextApple.x + 1, nextApple.z))).ok,
    'A second natural orchard trip gives another visitor one real apple');
  const girl = (await state()).town.animals.find(animal => animal.id === 'cow-highland-1');
  const cowPose = at(girl.x + 1, girl.z);
  check((await interact(a, 'animalApple', girl.id, cowPose)).ok, 'Actual apple feeding accepts the Highland girl and consumes a received apple');
  const cowMeal = (await state()).town.animals.find(animal => animal.id === girl.id);
  check(cowMeal.mode === 'apple' && cowMeal.owner === a.welcome.selfId
    && a.messages.filter(message => message.type === 'forageInventory').at(-1).inventory.apples === 0,
    'The accepted cow meal publishes one shared owner and clock while inventory stays private');
  check(cowMeal.heading === Math.atan2(cowPose.x - cowMeal.x, cowPose.z - cowMeal.z),
    'The actual accepted apple meal holds the cow facing its real feeder');
  check(!(await interact(b, 'animalApple', girl.id, cowPose)).ok
    && b.messages.filter(message => message.type === 'forageInventory').at(-1).inventory.apples === 1,
    'A real rejected competing cow feed preserves the second visitor apple');
  await mf.unsafeEvictDurableObject('cosy-town-fixture', 'TownFixtureWorld', { name: 'one-shared-village', webSockets: 'hibernate' });
  const resumedMeal = (await state()).town.animals.find(animal => animal.id === girl.id);
  const attachments = (await control('debug')).visitors;
  check(resumedMeal.mode === 'apple' && resumedMeal.startedAt === cowMeal.startedAt
    && attachments.find(visitor => visitor.id === b.welcome.selfId).forageInventory.apples === 1,
    'Actual SQLite hibernation preserves the meal clock and private socket inventory');
  const giftObserver = await connect();
  check(giftObserver.welcome.world.town.animals.find(animal => animal.id === girl.id).startedAt === cowMeal.startedAt
    && giftObserver.welcome.forageInventory.apples === 0,
    'A late real observer sees the accepted cow meal and starts with its own empty basket');
  await interact(a, undefined, undefined, cowPose, {}, 'leave');
  check((await state()).town.animals.find(animal => animal.id === girl.id).owner === null
    && !(await interact(b, 'animalApple', girl.id, cowPose)).ok,
    'An actual departing feeder releases ownership without restarting the occupied meal');
  await tick(8000);
  check((await interact(b, 'animalApple', girl.id, cowPose)).ok
    && b.messages.filter(message => message.type === 'forageInventory').at(-1).inventory.apples === 0,
    'The second visitor can feed only after the first shared meal finishes');
  const secondMeal = (await state()).town.animals.find(animal => animal.id === girl.id);
  const lastBasketMessage = b.messages.filter(message => message.type === 'forageInventory').at(-1);
  const browserBasketToken = lastBasketMessage.token, expectedBasket = lastBasketMessage.inventory;
  b.socket.close(1000, 'Forage basket disconnect'); await new Promise(resolve => setTimeout(resolve, 20));
  b = await connect(browserBasketToken);
  const restoredBasket = b.messages.filter(message => message.type === 'forageInventory').at(-1).inventory;
  check(restoredBasket.apples === 0 && restoredBasket.mushrooms === expectedBasket.mushrooms,
    'A genuine reconnect restores accepted local inventory and ignores forged client resource counts');
  const departedMeal = (await state()).town.animals.find(animal => animal.id === girl.id);
  check(departedMeal.mode === 'apple' && departedMeal.owner === null && departedMeal.startedAt === secondMeal.startedAt,
    'A real apple feeder disconnect releases ownership while spectators retain the accepted meal clock');
  giftObserver.socket.close(1000, 'End forage observer');
  await tick(8000);
  await control('horse-start', { id: 'horse-juniper' }); await control('horse-start', { id: 'horse-willow', offset: 3.5 });
  check((await interact(a, 'mount', 'horse-juniper', at(86.5, 34), {}, 'horse')).ok, 'A real visitor mounts the course horse');
  check((await interact(b, 'mount', 'horse-willow', at(86.5, 37.5), {}, 'horse')).ok, 'A second real visitor mounts a distinct shared horse');
  const start = await interact(a, 'raceStart', 'horse-racetrack', at(85, 34));
  check(start.ok, `The actual Worker accepts a clear course countdown: ${start.reason || ''}`);
  check(!(await interact(b, 'raceStart', 'horse-racetrack', at(85, 37.5))).ok, 'An actual second mounted rider cannot steal the race');
  check(!(await interact(b, 'raceCancel', 'horse-racetrack', at(85, 37.5))).ok, 'Spectators cannot cancel another rider race');
  const d = await connect();
  check(d.welcome.world.town.race.owner === a.welcome.selfId && d.welcome.world.town.race.phase === 'countdown', 'A late real join sees the race owner and original countdown');
  await interact(b, 'dismount', 'horse-willow', at(85, 37.5), {}, 'horse');
  await control('horse-start', { id: 'horse-willow', offset: 30 });
  await tick(3500);
  world = await state();
  check(world.town.rival.speed > 0 && world.town.race.phase === 'racing', 'The actual Worker moves the shared NPC when the countdown finishes');
  const initialHorse = world.actors.find(actor => actor.id === 'horse-juniper');
  // Drive accepted inputs through the real horse physics, rather than moving its pose between checkpoints.
  for (let index = 0; index < 700 && world.town.race.phase === 'racing'; index++) {
    const horse = world.actors.find(actor => actor.id === 'horse-juniper');
    let angle = Math.atan2((horse.z - 20) / 14, (horse.x - 85) / 24);
    const target = [85 + 24 * Math.cos(angle + .22), 20 + 14 * Math.sin(angle + .22)];
    const heading = Math.atan2(target[0] - horse.x, target[1] - horse.z);
    const difference = Math.atan2(Math.sin(heading - horse.heading), Math.cos(heading - horse.heading));
    a.socket.send(JSON.stringify({ type: 'horseInput', forward: .82, turn: Math.max(-1, Math.min(1, difference * 2)), sprint: true, brake: false }));
    await new Promise(resolve => setTimeout(resolve, 2)); world = await tick(100);
  }
  if (world.town.race.phase !== 'finished') console.log('Local driving diagnostic:', await control('debug'));
  check(world.town.race.phase === 'finished' && world.town.race.nextCheckpoint === 9,
    'Real accepted riding inputs finish all eight ordered gates');
  check(Math.hypot(initialHorse.x - world.actors.find(actor => actor.id === 'horse-juniper').x,
    initialHorse.z - world.actors.find(actor => actor.id === 'horse-juniper').z) > .1, 'The course is travelled by authoritative horse physics');
  check(world.town.race.playerFinishAt > world.town.race.goAt && ['visitor', 'rival', 'tie'].includes(world.town.race.result), 'The actual finish publishes the accepted times and result');
  await mf.unsafeEvictDurableObject('cosy-town-fixture', 'TownFixtureWorld', { name: 'one-shared-village', webSockets: 'hibernate' });
  const rejoined = await connect();
  check(rejoined.welcome.world.town.race.playerFinishAt === world.town.race.playerFinishAt && rejoined.welcome.world.town.harvest.carrot === 1,
    'Actual SQLite hibernation and reconnect restore race result and crops');
  await interact(a, 'dismount', 'horse-juniper', at(85, 34), {}, 'horse');
  check((await interact(a, undefined, 'focus', at(108, 0), {}, 'activity')).ok
    && (await interact(b, undefined, 'focus', at(108, 0), {}, 'activity')).ok,
    'Two actual clients can still use their independent private focus rooms simultaneously');
  const privateAnimal = (await state()).town.animals[0];
  check(!(await interact(a, 'animalPet', privateAnimal.id, at(privateAnimal.x, privateAnimal.z))).ok,
    'Private focus cannot claim an outdoor animal');
  check((await state()).town.race.playerFinishAt === world.town.race.playerFinishAt, 'Simultaneous private focus keeps the accepted outdoor race result');
  await interact(a, undefined, undefined, at(85, 34), {}, 'leave');
  await interact(b, undefined, undefined, at(85, 37.5), {}, 'leave');
  await control('horse-start', { id: 'horse-juniper' }); await interact(a, 'mount', 'horse-juniper', at(86.5, 34), {}, 'horse');
  await interact(a, 'raceStart', 'horse-racetrack', at(85, 34));
  a.socket.close(1000, 'Synthetic local disconnect'); await new Promise(resolve => setTimeout(resolve, 20));
  check((await state()).town.race.phase === 'cancelled' && (await state()).actors.find(actor => actor.id === 'horse-juniper').owner === null,
    'Actual socket departure cancels the race and releases its horse');
  const e = await connect(), petAnimal = e.welcome.world.town.animals.find(animal => animal.species === 'cow');
  await interact(e, 'animalPet', petAnimal.id, at(petAnimal.x + 1, petAnimal.z));
  e.socket.close(1000, 'Synthetic pet disconnect'); await new Promise(resolve => setTimeout(resolve, 20));
  const f = await connect();
  check(f.welcome.world.town.animals.find(animal => animal.id === petAnimal.id).owner === null,
    'A real petting disconnect releases the shared animal for reconnecting visitors');
  await control('horse-start', { id: 'horse-juniper' });
  await interact(f, 'mount', 'horse-juniper', at(86.5, 34), {}, 'horse');
  await interact(f, 'raceStart', 'horse-racetrack', at(85, 34));
  await tick(16000, false);
  check((await state()).town.race.phase === 'cancelled' && (await state()).actors.find(actor => actor.id === 'horse-juniper').owner === null,
    'Missed real visitor renewals cancel the race and cannot reserve the horse forever');
  console.log(`${checks.length} actual town SQLite/WebSocket checks passed.\n${checks.join('\n')}`);
  if (process.env.TOWN_EVIDENCE) fs.writeFileSync(process.env.TOWN_EVIDENCE, JSON.stringify({ layoutHash, checks,
    limits: 'Local actual workerd/SQLite/WebSocket clients with accelerated server clocks; rendered browser and production are separate checks.' }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  for (const socket of sockets) try { socket.close(); } catch {}
  await mf.dispose(); fs.rmSync(temporary, { recursive: true, force: true });
});

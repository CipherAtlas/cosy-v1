const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto, createHash } = require('node:crypto');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const { VillageSimulation } = require('../../../worker/simulation.ts');
const { HorseRiding } = require('../../../worker/horseRiding.ts');
const { VillageMovement } = require('../../../features/village/movement.ts');
const environment = require('../../../features/village/environment.ts');
const garden = require('../../../features/village/garden.ts');
const { towerLookout, LOOKOUT_CAPACITY } = require('../../../features/village/towerLookout.ts');
const { ACTIVITY_STAGES } = require('../../../features/village/sharedActors.ts');
const physics = require('../../../worker/world-physics.json');
assert.equal(physics.layoutHash, createHash('sha256').update(fs.readFileSync('public/village/world-layout.json')).digest('hex'), 'Worker physics must match the current saved layout');
let now = 100000, requestNumber = 0;
let clockTimerId = 0;
const clockTimers = new Map();
const sockets = [], records = new Map(), checks = [];
const check = (condition, label) => { assert(condition, label); checks.push(label); };
const makeSocket = id => {
  const socket = { visitor: { id, name: id, slot: sockets.length + 1, x: .3, z: 20, heading: 0, lastMove: 0, lastChat: 0, lastSeen: now, active: true, crumbPouch: false }, messages: [],
    send(raw) { this.messages.push(JSON.parse(raw)); },
    close() { const index = sockets.indexOf(this); if (index >= 0) sockets.splice(index, 1); },
    serializeAttachment(value) { this.visitor = JSON.parse(JSON.stringify(value)); }, deserializeAttachment() { return JSON.parse(JSON.stringify(this.visitor)); } };
  sockets.push(socket); return socket;
};
const a = makeSocket('a'), b = makeSocket('b'), c = makeSocket('c');
const ctx = { getWebSockets: () => sockets, acceptWebSocket: socket => sockets.push(socket),
  storage: { transactionSync: callback => callback(), kv: { get: key => records.get(key), put: (key, value) => records.set(key, JSON.parse(JSON.stringify(value))) }, getAlarm: async () => null, setAlarm: async () => {} } };
const mod = { exports: {} };
const source = fs.readFileSync('worker/index.js', 'utf8').replace(/^import .*;\n/gm, '')
  .replace('export class VillageWorld', 'class VillageWorld').replace('export default {', 'const workerDefault = {');
vm.runInNewContext(`${fs.readFileSync('worker/worldClock.js', 'utf8').replace('export class SharedWorldClock', 'class SharedWorldClock')}\n${source}\nmodule.exports = VillageWorld;`, { module: mod, crypto: webcrypto,
  setTimeout: (callback, delay) => { assert.equal(delay, 100); const id = ++clockTimerId; clockTimers.set(id, callback); return id; },
  clearTimeout: id => clockTimers.delete(id),
  Date: class extends Date { static now() { return now; } }, DurableObject: class { constructor(ctx) { this.ctx = ctx; } },
  VillageSimulation, towerLookout, LOOKOUT_CAPACITY, ACTIVITY_STAGES, GARDEN_TARGETS: garden.GARDEN_TARGETS, ...garden,
  WebSocketPair: class { constructor() { this.client = {}; this.server = makeSocket('joining'); sockets.pop(); } },
  URL, TextEncoder, Uint8Array, Response: class { constructor(body, options) { Object.assign(this, options); } } });
const World = mod.exports; let world = new World(ctx);
const send = (socket, message) => world.webSocketMessage(socket, JSON.stringify(message));
const move = async (socket, x, z, extra = {}) => { now += 120; await send(socket, { type: 'move', x, z, heading: 0, ...extra }); };
const interact = async (socket, request) => {
  now += 120; const requestId = `request-${++requestNumber}`;
  await send(socket, { type: 'interaction', requestId, request });
  return socket.messages.findLast(message => message.type === 'interaction_result' && message.requestId === requestId)?.result;
};
const tick = async (socket = a, extra = {}) => { now += 120; await send(socket, { type: 'heartbeat', active: true, ...extra }); };
const puppy = () => world.simulation.actors.find(actor => actor.state.kind === 'puppy');
(async () => {
  world.publishWorld(now);
  const dog = puppy();
  await move(a, dog.state.x + 1.5, dog.state.z); await move(b, a.visitor.x, a.visitor.z);
  check((await interact(a, { kind: 'puppy', id: dog.state.id, action: 'hold' })).ok, 'First visitor claims a dog');
  check(!(await interact(b, { kind: 'puppy', id: dog.state.id, action: 'walk' })).ok, 'Another visitor cannot take a held dog');
  const held = [dog.state.x, dog.state.z];
  for (let index = 0; index < 30; index++) await tick(a, { holdingPuppy: dog.state.id });
  check(JSON.stringify(held) === JSON.stringify([dog.state.x, dog.state.z]), 'Held dogs remain stationary across world ticks');
  check((await interact(a, { kind: 'puppy', id: dog.state.id, action: 'dance' })).ok, 'Owner can request a trick during a hold');
  check(!(await interact(b, { kind: 'puppy', id: dog.state.id, action: 'roll' })).ok, 'Another visitor cannot interrupt a trick');
  check(dog.state.startedAt === now - 120, 'Tricks use the Worker start time');
  world = new World(ctx);
  check(puppy().state.action === 'dance' && puppy().state.owner === 'a', 'Hibernation restores the accepted action and owner');
  check((await interact(a, { kind: 'puppy', id: dog.state.id, action: 'release' })).ok, 'Owner releases a dog');
  now += 5500; world.publishWorld(now);
  check((await interact(b, { kind: 'puppy', id: dog.state.id, action: 'walk' })).ok, 'Released dog can join another visitor');
  const before = { ...puppy().state };
  for (let index = 0; index < 12; index++) { await move(b, b.visitor.x, b.visitor.z - .18); await tick(b); }
  check(Math.hypot(puppy().state.x - before.x, puppy().state.z - before.z) > .15, 'Shared followers move with their owner');
  check(!(await interact(a, { kind: 'puppy', id: dog.state.id, action: 'home' })).ok, 'Visitors cannot dismiss another person\'s dog');
  await world.webSocketClose(b);
  check(puppy().state.owner === null && !puppy().state.following, 'Disconnect releases dogs and walking ownership');
  const d = makeSocket('d');
  await move(a, puppy().state.x + 1.5, puppy().state.z);
  check((await interact(a, { kind: 'puppy', id: dog.state.id, action: 'pet' })).ok, 'Petting claims the shared dog');
  await move(a, a.visitor.x + 2, a.visitor.z); await tick(a);
  check(!['pet', 'petApproach'].includes(puppy().state.mode), 'Walking away cancels petting');
  check(!(await interact(c, { kind: 'puppy', id: 'invented-dog', action: 'sit' })).ok, 'Unknown actors cannot be created by a request');
  const resident = world.simulation.actor('pip', 'resident');
  resident.state.owner = null; resident.state.mode = 'roam'; resident.cooldown = now + 15000;
  await move(a, resident.state.x + 1.5, resident.state.z); await move(c, a.visitor.x, a.visitor.z);
  check((await interact(a, { kind: 'resident', id: 'pip', action: 'talk' })).ok, 'Resident conversations claim the real resident');
  check(!(await interact(c, { kind: 'resident', id: 'pip', action: 'walk' })).ok, 'Other visitors cannot invite a talking resident');
  check((await interact(a, { kind: 'resident', id: 'pip', action: 'walk' })).ok, 'Conversation owner can invite the resident');
  const bench = world.simulation.benches[0];
  for (const socket of [a, c, d]) await move(socket, bench.x, bench.z + 1.5);
  check((await interact(a, { kind: 'bench', id: bench.id, index: 0 })).ok, 'First bench seat accepts its first visitor');
  check(!(await interact(c, { kind: 'bench', id: bench.id, index: 0 })).ok, 'Seat races are rejected before two visitors sit');
  check((await interact(c, { kind: 'bench', id: bench.id, index: 1 })).ok, 'The second bench seat remains available');
  check(!(await interact(d, { kind: 'bench', id: bench.id })).ok, 'A full bench refuses a third visitor');
  await world.webSocketClose(c);
  check((await interact(d, { kind: 'bench', id: bench.id, index: 1 })).ok, 'Disconnect frees the occupied bench seat');
  check((await interact(a, { kind: 'activity', id: 'focus' })).ok && (await interact(d, { kind: 'activity', id: 'focus' })).ok, 'Focus cottages remain private and simultaneously available');
  check(a.visitor.bench === null && d.visitor.bench === null, 'Private focus entry releases outdoor seats');
  await interact(a, { kind: 'leave' }); await interact(d, { kind: 'leave' });
  await interact(a, { kind: 'activity', id: 'mood' }); await interact(d, { kind: 'activity', id: 'mood' });
  check(a.visitor.bench.index !== d.visitor.bench.index, 'Tea activity visitors claim different seats on the real bench');
  const e = makeSocket('e');
  check(!(await interact(e, { kind: 'activity', id: 'mood' })).ok, 'Outdoor activities cannot bypass a full bench');
  await interact(a, { kind: 'leave' }); await move(a, -37, 4);
  world.simulation.birds = { phase: 'ground', since: now, mealAt: null, queued: false, served: false, throwAt: null, origin: [0, 0, 0], flightCount: 0 };
  await send(a, { type: 'garden', action: { kind: 'feedBirds' } });
  check(!world.simulation.birds.served, 'Visitors without crumbs cannot start a shared meal');
  await send(a, { type: 'garden', action: { kind: 'birdCrumbs' } });
  check(a.visitor.crumbPouch, 'Crumbs are granted only after an accepted request near Wren');
  await send(a, { type: 'garden', action: { kind: 'feedBirds' } });
  check(world.simulation.birds.served, 'Accepted feeding starts one shared flock meal');
  const meal = world.simulation.birds.mealAt;
  d.visitor.crumbPouch = true; await interact(d, { kind: 'leave' }); await move(d, -37, 4);
  await send(d, { type: 'garden', action: { kind: 'feedBirds' } });
  check(world.simulation.birds.mealAt === meal, 'A second visitor cannot restart an occupied flock meal');
  const joining = await world.fetch({ url: 'http://local/', headers: { get: () => 'websocket' } });
  const welcome = sockets.at(-1).messages.find(message => message.type === 'welcome');
  check(joining.status === 101 && welcome.protocol === 2 && welcome.world.birds.mealAt === meal, 'Joining visitors receive the current actors, owners and meal');
  a.visitor.crumbPouch = false; await move(a, 0, 20); await send(a, { type: 'garden', action: { kind: 'crumbs' } });
  check(!a.visitor.crumbPouch, 'Remote crumb requests do not grant a pouch');
  const grownBed = world.garden.beds.findIndex(bed => bed.stage === 'grown');
  const target = garden.GARDEN_TARGETS.find(target => target.id === `bed-${grownBed}`);
  await move(a, target.x + 2, target.z); await move(d, target.x + 2, target.z);
  await send(a, { type: 'garden', action: { kind: 'harvest', bed: grownBed } });
  const inventory = JSON.stringify(world.garden);
  await send(d, { type: 'garden', action: { kind: 'harvest', bed: grownBed } });
  check(JSON.stringify(world.garden) === inventory, 'Contested harvests cannot duplicate crops');
  const pond = garden.GARDEN_TARGETS.find(target => target.id === 'feed');
  a.visitor.crumbPouch = true; d.visitor.crumbPouch = true;
  await move(a, pond.x, pond.z); await move(d, pond.x, pond.z);
  await send(a, { type: 'garden', action: { kind: 'feed' } });
  const pondAt = world.simulation.pondFeedAt;
  check(pondAt === now, 'Accepted duck feeding has one world start time');
  now += 120; await send(d, { type: 'garden', action: { kind: 'feed' } });
  check(world.simulation.pondFeedAt === pondAt, 'Concurrent duck feeding cannot restart the meal');
  world = new World(ctx);
  check(world.simulation.pondFeedAt === pondAt && world.simulation.snapshot(now).epoch > 0, 'Reconstructed worlds retain duck timing and the animation clock');
  await interact(a, { kind: 'leave' }); await interact(d, { kind: 'leave' });
  const firstGarden = await interact(a, { kind: 'activity', id: 'garden' });
  const secondGarden = await interact(d, { kind: 'activity', id: 'garden' });
  check(firstGarden.ok && secondGarden.ok && Math.hypot(firstGarden.position[0] - secondGarden.position[0], firstGarden.position[2] - secondGarden.position[2]) >= 1.4,
    'Garden visitors receive different collision-clear activity positions');
  check((await interact(a, { kind: 'activity', id: 'gratitude' })).ok, 'An outdoor writing spot accepts its first visitor');
  check(!(await interact(d, { kind: 'activity', id: 'gratitude' })).ok, 'The same outdoor writing spot cannot be occupied twice');
  await interact(a, { kind: 'activity', id: 'mood' });
  const luma = world.simulation.actor('luma', 'resident');
  const lumaTea = [luma.state.x, luma.state.z];
  check(luma.state.owner === a.visitor.id && luma.state.mode === 'activity', 'Tea holds the same shared Luma for the accepted visitor');
  world.inventories.get(a.visitor.inventoryToken).inventory.mintTea = 1;
  await move(a, 15, -10); await send(a, { type: 'garden', action: { kind: 'drink' } });
  check(luma.state.gesture?.kind === 'tea' && luma.state.gesture.at === now,
    'Accepted tea actions give the owned companion one shared gesture clock');
  const teaGesture = luma.state.gesture.at;
  world.simulation.gardenMoment(d.visitor, { kind: 'drink' }, now + 1);
  check(luma.state.gesture.at === teaGesture, 'Another visitor cannot restart an owned companion gesture');
  world.inventories.get(a.visitor.inventoryToken).inventory.mint = 1;
  await move(a, 13.9, -10); await send(a, { type: 'garden', action: { kind: 'gift', crop: 'mint' } });
  check(world.simulation.gift?.crop === 'mint', 'Accepted gifts enter the shared animation snapshot');
  await interact(a, { kind: 'leave' });
  check(Math.hypot(luma.state.x - lumaTea[0], luma.state.z - lumaTea[1]) < .2, 'Luma returns from her visible tea position without jumping to her old patrol pose');
  await interact(d, { kind: 'leave' });
  const pip = world.simulation.actor('pip', 'resident');
  pip.followOwner = a.visitor.id; pip.state.owner = a.visitor.id; pip.state.mode = 'follow'; pip.state.following = true;
  await interact(a, { kind: 'activity', id: 'mood' });
  const benchTea = world.simulation.benches.find(bench => bench.id === 'bench-4');
  const offset = a.visitor.bench.index === 0 ? -.68 : .68;
  check(Math.hypot(pip.state.x - benchTea.x - Math.cos(benchTea.facing) * offset, pip.state.z - benchTea.z + Math.sin(benchTea.facing) * offset) >= 1.3,
    'Shared resident companions do not occupy the visitor\'s bench seat');
  await interact(a, { kind: 'activity', id: 'focus' });
  check(pip.state.x > 100, 'A visitor\'s resident companion can attend their private focus cottage');
  const pipBeforeFocus = { ...pip.movement.position };
  const restoredFocus = new VillageSimulation(world.simulation.save());
  restoredFocus.releaseVisitor(a.visitor.id, now);
  const restoredPip = restoredFocus.actor('pip', 'resident');
  check(Math.hypot(restoredPip.state.x - pipBeforeFocus.x, restoredPip.state.z - pipBeforeFocus.z) < .01,
    'Hibernation inside private focus preserves the companion\'s outdoor return position');
  await world.webSocketClose(a);
  check(pip.state.owner === null && Math.hypot(pip.state.x - pipBeforeFocus.x, pip.state.z - pipBeforeFocus.z) < .01,
    'Disconnecting inside private focus returns the shared companion outdoors');
  const f = makeSocket('f');
  const swing = world.simulation.authored.swings[0];
  await move(f, swing.x, swing.z + 2); await move(d, swing.x, swing.z + 2);
  check((await interact(f, { kind: 'swing', id: swing.id, index: 0 })).ok, 'Swing seats require an accepted claim');
  check(!(await interact(d, { kind: 'swing', id: swing.id, index: 0 })).ok, 'Swing seat races cannot displace the rider');
  await move(f, swing.x, swing.z, { swing: { id: swing.id, index: 0, angle: 100, velocity: 100 } });
  check(f.visitor.swing.angle <= 78 * Math.PI / 180 && f.visitor.swing.velocity === 4, 'Shared swing motion remains bounded');
  await move(d, swing.x, swing.z, { swing: { id: swing.id, index: 1, angle: 0, velocity: 0 } });
  check(!d.visitor.swing, 'Movement alone cannot occupy an unclaimed swing seat');
  await world.webSocketClose(f);
  check((await interact(d, { kind: 'swing', id: swing.id, index: 0 })).ok, 'A disconnected rider frees the swing seat');
  await interact(d, { kind: 'leave' });
  const h = makeSocket('h');
  check((await interact(h, { kind: 'activity', id: 'gratitude' })).ok, 'An activity can reserve its position while its reply is in transit');
  await tick(h);
  check(h.visitor.activity === 'gratitude', 'An unconfirmed activity has time to apply its accepted reply');
  now += 4500; await tick(h);
  check(!h.visitor.activity, 'A lost activity reply cannot leave a permanently reserved spot');
  await interact(h, { kind: 'activity', id: 'focus' }); await tick(h, { activity: 'focus' });
  check(h.visitor.activity === 'focus' && h.visitor.reservationUntil === 0, 'Applied activities confirm their reservation through heartbeats');
  await tick(h);
  check(!h.visitor.activity, 'Leaving a confirmed activity also releases its reservation through the pose heartbeat');
  now += 120; const currentDog = puppy();
  await send(h, { type: 'interaction', requestId: 'current-pose', request: { kind: 'puppy', id: currentDog.state.id, action: 'hold' },
    pose: { x: currentDog.state.x + 1.5, z: currentDog.state.z, heading: 3.8, active: true } });
  check(h.messages.findLast(message => message.requestId === 'current-pose').result.ok, 'Interaction requests use the current pose before the next movement interval');
  check(Math.abs(h.visitor.heading) <= Math.PI, 'Wrapped headings remain correct across complete rotations');
  await world.webSocketClose(h);
  const g = makeSocket('g');
  await move(g, puppy().state.x + 1.5, puppy().state.z); await interact(g, { kind: 'puppy', id: dog.state.id, action: 'walk' });
  now += 11000; world.publishWorld(now);
  check(puppy().state.owner === null, 'A missing heartbeat releases stale actor ownership');
  now += 5000; world.publishWorld(now);
  check(!world.visitors().some(visitor => visitor.id === g.visitor.id), 'Lost connections expire their presence and seat reservations');
  const formation = new VillageSimulation(), companion = formation.actor('pip', 'resident');
  const walker = { id: 'walker', x: 10, z: 20, heading: Math.PI, active: true, lastSeen: now };
  formation.actors.forEach(actor => { actor.cooldown = now + 1000000; });
  companion.followOwner = walker.id; companion.state.owner = walker.id; companion.state.following = true; companion.state.mode = 'follow';
  companion.movement.settle(10.5, 22); Object.assign(companion.state, companion.movement.position);
  let safe = true;
  for (let index = 0; index < 80; index++) { now += 120; walker.lastSeen = now; formation.step(now, [walker]); safe &&= companion.movement.clear(companion.state.x, companion.state.z); }
  check(safe && Math.hypot(companion.state.x - 11.05, companion.state.z - 20) < .12, 'Shared residents regain the beside-the-player hand-holding formation on clear ground');
  walker.heading = 0;
  let separation = Infinity;
  for (let index = 0; index < 80; index++) { now += 120; walker.lastSeen = now; formation.step(now, [walker]); separation = Math.min(separation, Math.hypot(companion.state.x - walker.x, companion.state.z - walker.z)); }
  check(separation > .8 && Math.hypot(companion.state.x - 8.95, companion.state.z - 20) < .12, 'Shared companions reverse sides around the visitor instead of crossing through their body');
  const capacity = new VillageSimulation();
  capacity.actors.forEach((actor, index) => { actor.followOwner = `visitor-${index}`; });
  for (let visitor = 0; visitor < 64; visitor++) capacity.trails.set(`visitor-${visitor}`,
    Array.from({ length: 180 }, (_, step) => [Math.sin(step + visitor) * 150, Math.cos(step + visitor) * 150]));
  check(Buffer.byteLength(JSON.stringify(capacity.save())) < 128 * 1024,
    'A 64-visitor world persists only needed follower trails within the shared-state storage limit');
  const rider = makeSocket('rider'), contender = makeSocket('contender');
  const horse = world.simulation.actors.find(actor => actor.state.kind === 'horse');
  check(!!horse, 'Authored horse placements create shared horse actors');
  const careMeal = world.simulation.town.state.hayFeeds.find(meal => meal.horseId === horse.state.id && meal.until > now);
  if (careMeal) { now = careMeal.until + 1; await tick(rider); }
  const mount = socket => interact(socket, { kind: 'horse', id: horse.state.id, action: 'mount' });
  const horsePose = () => ({ ...horse.state });
  await move(rider, horse.state.x + 2, horse.state.z); await move(contender, horse.state.x - 2, horse.state.z);
  check((await mount(rider)).ok, 'The first nearby visitor atomically mounts the authored horse');
  check(!(await mount(contender)).ok && horse.state.owner === rider.visitor.id, 'Competing mounts cannot replace the accepted rider');
  check(!(await interact(contender, { kind: 'horse', id: horse.state.id, action: 'dismount' })).ok, 'Other visitors cannot dismount the rider');
  const mountPose = horsePose();
  await move(rider, -80, -80);
  check(horse.state.x === mountPose.x && rider.visitor.x === mountPose.x, 'Mounted move packets cannot teleport either horse or rider');
  await send(contender, { type: 'horseInput', forward: 1, turn: 1, sprint: true, brake: false });
  await tick(rider, { horse: horse.state.id });
  check(horse.state.speed === 0, 'Non-owners cannot steer the mounted horse');
  await send(rider, { type: 'horseInput', forward: 1, turn: 0, sprint: true, brake: false });
  for (let index = 0; index < 12; index++) {
    now += 100; await send(rider, { type: 'horseInput', forward: 1, turn: 0, sprint: true, brake: false });
  }
  check(Math.hypot(horse.state.x - mountPose.x, horse.state.z - mountPose.z) > 1 && horse.state.speed <= 9,
    'Worker time and bounded acceleration control accepted riding movement');
  check(rider.visitor.x === horse.state.x && rider.visitor.z === horse.state.z && rider.visitor.y > horse.state.y,
    'Accepted horse movement attaches the shared rider to its saddle');
  const movingPose = horsePose();
  now += 600; await tick(rider, { horse: horse.state.id });
  check(horse.state.x === movingPose.x && horse.state.z === movingPose.z && horse.state.speed === 0,
    'Missing riding inputs stop motion without requiring a dismount');
  const dismounted = await interact(rider, { kind: 'horse', id: horse.state.id, action: 'dismount' });
  check(dismounted.ok && dismounted.position && horse.state.owner === null && horse.movement.clear(dismounted.position[0], dismounted.position[2]),
    'Dismount lands on collision-clear nearby ground and frees the horse');
  check((await mount(rider)).ok, 'A safely dismounted visitor can mount again');
  const beforeForced = horsePose();
  now += 10; await send(rider, { type: 'heartbeat', horse: horse.state.id, active: false });
  check(horse.state.owner === rider.visitor.id, 'Inactive heartbeat inside publication interval reproduces the pending forced-exit race');
  await send(rider, { type: 'horseInput', forward: 0, turn: 0, sprint: false, brake: true });
  check(horse.state.owner === null && !rider.visitor.horse, 'Losing active presence releases the horse immediately');
  const forcedLanding = [rider.visitor.x, rider.visitor.y, rider.visitor.z];
  const forcedMove = contender.messages.findLast(message => message.type === 'move' && message.id === rider.visitor.id);
  check(forcedLanding.every(Number.isFinite) && Math.hypot(forcedLanding[0] - beforeForced.x, forcedLanding[2] - beforeForced.z) > 1
    && JSON.stringify([forcedMove.x, forcedMove.y, forcedMove.z]) === JSON.stringify(forcedLanding),
    'A rejected input preserves and broadcasts the forced dismount ground position');
  await tick(rider, { active: false });
  check(JSON.stringify([rider.visitor.x, rider.visitor.y, rider.visitor.z]) === JSON.stringify(forcedLanding),
    'A later heartbeat cannot overwrite the forced landing with the old saddle position');
  await tick(rider); check((await mount(rider)).ok, 'Returning active visitors can rejoin the horse');
  await interact(rider, { kind: 'activity', id: 'focus' });
  check(horse.state.owner === null && rider.visitor.activity === 'focus', 'Entering private focus releases the outdoor horse');
  await interact(rider, { kind: 'leave' }); await move(rider, horse.state.x + 2, horse.state.z); await mount(rider);
  const savedRide = new VillageSimulation(world.simulation.save());
  check(savedRide.actor(horse.state.id, 'horse').state.owner === rider.visitor.id, 'Worker reconstruction preserves the accepted rider in snapshots');
  await world.webSocketClose(rider);
  check(horse.state.owner === null && horse.state.mode === 'idle', 'Disconnect frees the horse at its actual final position');
  await move(contender, horse.state.x + 2, horse.state.z); check((await mount(contender)).ok, 'Another visitor can mount after rider disconnect');
  await tick(contender); await tick(contender);
  check(horse.state.owner === contender.visitor.id && contender.visitor.reservationUntil > now,
    'Heartbeats before a mount reply preserve the full confirmation grace period');
  now += 4600; await tick(contender);
  check(horse.state.owner === null, 'A mount reply that never reaches its client cannot reserve the horse forever');
  const ridingPhysics = new HorseRiding();
  const obstacleHorse = { state: { ...horse.state, x: 42, z: 19, heading: 0, speed: 0 },
    movement: new VillageMovement([{ x: 42, z: 23, w: 6, d: 1, top: 5 }], () => {}) };
  for (let index = 0; index < 70; index++) {
    now += 100; ridingPhysics.input(obstacleHorse, { forward: 1, turn: 0, sprint: true, brake: false }, now);
    ridingPhysics.step(obstacleHorse, 1, .1, now, () => false);
  }
  check(obstacleHorse.state.z < 21.6 && ridingPhysics.clear(obstacleHorse, obstacleHorse.state.x, obstacleHorse.state.z, 0, 1),
    'Galloping substeps stop the full horse footprint before a solid obstacle');
  check(!ridingPhysics.clear(obstacleHorse, environment.riverX(20), 20, 0, 1), 'Horse footprint cannot ride through unbridged river water');
  check(!ridingPhysics.input(obstacleHorse, { forward: 100, turn: 0, sprint: true, brake: false }, now)
    && !ridingPhysics.input(obstacleHorse, { forward: 1, turn: NaN, sprint: true, brake: false }, now),
    'Out-of-range and non-finite riding inputs are rejected');
  const expanded = { ...world.simulation.authored, walkable: [...world.simulation.authored.walkable,
    { id: 'test-expansion', x: 190, z: 20, radiusX: 15, radiusZ: 15, yaw: 0 }] };
  environment.setAuthoredWorld(expanded);
  check(ridingPhysics.clear(obstacleHorse, 190, 20, 0, 1) && !ridingPhysics.clear(obstacleHorse, 322, 20, 0, 1),
    'Horse movement supports authored expansion beyond the old map while respecting ground bounds');
  environment.setAuthoredWorld({ ...expanded, terrain: { version: 1, cellSize: 2,
    samples: [[94, 10, 0], [95, 10, 0], [96, 10, 0], [94, 11, 5], [95, 11, 5], [96, 11, 5]] } });
  check(!ridingPhysics.clear(obstacleHorse, 190, 21, 0, 1), 'Horses refuse steep edited terrain under their footprint');
  environment.setAuthoredWorld(world.simulation.authored);
    const privateToken = a.visitor.inventoryToken;
  const personalRecord = world.inventories.get(privateToken);
  personalRecord.inventory.apples = 2; personalRecord.inventory.mushrooms = 1; personalRecord.inventory.mint = 1;
  world.restoreInventory(a.visitor); world.saveInventory(a.visitor);
  const privateSnapshot = JSON.stringify(personalRecord.inventory);
  const otherBasket = makeSocket('another-basket');
  await send(otherBasket, { type: 'inventory_resume', token: '00000000-0000-0000-0000-000000000000', inventory: { apples: 9999, mint: 9999 } });
  check(otherBasket.visitor.forageInventory.apples === 0 && otherBasket.visitor.forageInventory.mint === 0,
    'Invented resume tokens and client counters cannot create personal resources');
  check(!otherBasket.messages.some(message => message.type === 'forageInventory' && message.token === privateToken),
    'Personal inventory tokens and updates are not broadcast to other visitors');
  world = new World(ctx);
  const resumedBasket = makeSocket('resumed-basket');
  await send(resumedBasket, { type: 'inventory_resume', token: privateToken, inventory: { apples: 9999 } });
  check(JSON.stringify(resumedBasket.visitor.forageInventory) === privateSnapshot,
    'Worker reconstruction and a fresh socket restore only the accepted private basket');
  const sameBrowser = makeSocket('same-browser-tab');
  await send(sameBrowser, { type: 'inventory_resume', token: privateToken });
  const accepted = resumedBasket.deserializeAttachment(); accepted.forageInventory.apples--;
  resumedBasket.serializeAttachment(accepted); world.saveInventory(accepted);
  check(sameBrowser.visitor.forageInventory.apples === 1 && resumedBasket.visitor.forageInventory.apples === 1,
    'Two tabs for the same local user receive the same accepted resource deduction');
  check(otherBasket.visitor.forageInventory.apples === 0,
    'Updating one local basket never changes a different visitor basket');
  const tower = towerLookout(world.simulation.authored);
  const watchers = Array.from({ length: LOOKOUT_CAPACITY + 1 }, (_, i) => makeSocket(`watcher-${i}`));
  check(!(await interact(watchers[0], { kind: 'lookout' })).ok, 'Remote visitors cannot enter the tower from across the village');
  for (const socket of watchers) await move(socket, tower.entrance[0], tower.entrance[2]);
  for (const [index, socket] of watchers.slice(0, LOOKOUT_CAPACITY).entries()) {
    const result = await interact(socket, { kind: 'lookout' });
    check(result.ok && result.lookoutIndex === index && JSON.stringify(result.position) === JSON.stringify(tower.position(index)), `Gallery visitor ${index + 1} receives a distinct authoritative elevated spot`);
    await tick(socket, { lookout: index });
  }
  check(!(await interact(watchers.at(-1), { kind: 'lookout' })).ok, 'A full tower refuses overlapping occupancy');
  const center = world.simulation.authored.structures.tower;
  await move(watchers[0], center.x + .7, center.z - .4, { y: tower.position(0)[1], lookout: 0 });
  check(watchers[0].visitor.x === center.x + .7 && watchers[0].visitor.z === center.z - .4, 'Claimed visitors can walk freely across the gallery');
  check(watchers[1].messages.findLast(v => v.type === 'move' && v.id === watchers[0].visitor.id)?.x === center.x + .7,
    'Other visitors receive the accepted walking pose');
  await world.fetch({ url: 'http://local/', headers: { get: () => 'websocket' } });
  const galleryWelcome = sockets.at(-1).messages.find(message => message.type === 'welcome');
  check(watchers.slice(0, LOOKOUT_CAPACITY).every(socket => {
    const visitor = galleryWelcome.visitors.find(v => v.id === socket.visitor.id);
    return visitor?.lookout === socket.visitor.lookout && visitor.x === socket.visitor.x
      && visitor.y === socket.visitor.y && visitor.z === socket.visitor.z;
  }), 'Late joiners receive all gallery claims and current walking positions');
  await move(watchers[0], center.x + 20, center.z, { y: 0, lookout: 0 });
  const bounded = tower.constrain(center.x + 20, center.z);
  check(watchers[0].visitor.y === bounded[1] && watchers[0].visitor.x === bounded[0], 'Worker keeps gallery walking inside the railing at the authoritative height');
  check(watchers[0].messages.findLast(v => v.type === 'move' && v.id === watchers[0].visitor.id)?.x === bounded[0],
    'The requesting client receives its corrected railing pose');
  world = new World(ctx);
  check(watchers[1].visitor.lookout === 1, 'Gallery claims survive Worker reconstruction');
  check(watchers[0].visitor.x === bounded[0], 'Gallery walking positions survive Worker reconstruction');
  await tick(watchers[1], { lookout: 1 });
  check(watchers[1].visitor.lookout === 1, 'Heartbeat renews a gallery claim');
  check((await interact(watchers[0], { kind: 'leave' })).ok && watchers[0].visitor.lookout === null && watchers[0].visitor.y === tower.entrance[1], 'Coming down releases the spot and returns to the real door');
  check((await interact(watchers.at(-1), { kind: 'lookout' })).lookoutIndex === 0, 'A released gallery spot is reusable');
  await world.webSocketClose(watchers[1]);
  const newcomer = makeSocket('new-watcher'); await move(newcomer, tower.entrance[0], tower.entrance[2]);
  check((await interact(newcomer, { kind: 'lookout' })).lookoutIndex === 1, 'Disconnect frees an elevated gallery spot');
  now += 5000; await tick(newcomer);
  check(newcomer.visitor.lookout === null && newcomer.visitor.y === tower.entrance[1], 'Unacknowledged tower entry expires and returns to ground');
  const transformed = towerLookout({ ...world.simulation.authored, structures: { tower: { x: 30, y: 2, z: 40, yaw: Math.PI / 2 } } });
  check(Math.abs(transformed.entrance[0] - 33.5) < .001 && transformed.position(0)[1] === 13.4, 'Gallery and doorway follow editor position, height and rotation');
  check(JSON.stringify(transformed.constrain(30, 40)) === JSON.stringify([30, 13.4, 40]), 'Free gallery walking follows the editor tower center and height');
  const clockVisitor = makeSocket('clock-visitor');
  const clockRecords = new Map(); let checkpoints = 0;
  const clockWorld = new World({ ...ctx, getWebSockets: () => [clockVisitor], storage: { ...ctx.storage,
    kv: { get: key => clockRecords.get(key), put: (key, value) => {
      clockRecords.set(key, JSON.parse(JSON.stringify(value))); if (key === 'sharedActors') checkpoints++;
    } } } });
  clockWorld.publishWorld(now);
  const beforeActors = clockVisitor.messages.filter(message => message.type === 'actors').length;
  const firstTimer = clockWorld.clock.timer;
  clockWorld.clock.refresh(); clockWorld.clock.refresh();
  check(clockWorld.clock.timer === firstTimer, 'Multiple visitors/events share one scheduled simulation tick');
  for (let step = 1; step <= 100; step++) {
    now += 100;
    const timer = clockWorld.clock.timer, callback = clockTimers.get(timer);
    clockTimers.delete(timer); callback();
    if (step % 50 === 0) await clockWorld.webSocketMessage(clockVisitor, JSON.stringify({ type: 'heartbeat', active: true, watching: true }));
  }
  check(clockVisitor.messages.filter(message => message.type === 'actors').length - beforeActors === 100,
    'The Worker broadcasts smooth shared motion between five-second visitor renewals');
  check(checkpoints === 3, 'Ten seconds of motion use two recovery checkpoints instead of one hundred writes');
  const clockTrack = clockWorld.simulation.authored.items.find(item => item.asset === 'horse-racetrack');
  clockWorld.simulation.town.state.race = { trackId: clockTrack.id, owner: clockVisitor.visitor.id,
    horseId: clockWorld.simulation.actors.find(actor => actor.state.kind === 'horse').state.id,
    phase: 'finished', startedAt: now - 4000, goAt: now - 1000, nextCheckpoint: 9,
    playerFinishAt: now, npcFinishAt: null, result: 'visitor', until: now + 30000 };
  clockWorld.advanceWorld(now);
  clockWorld.publishWorld(now, undefined, false);
  check(checkpoints === 4 && clockRecords.get('sharedActors').town.race.result === 'visitor',
    'A race transition advanced before publication still saves immediately rather than waiting for a checkpoint');
  clockWorld.simulation.town.state.race = null;
  clockWorld.publishWorld(now, undefined, false);
  const beforeActionSave = checkpoints;
  const clockBench = clockWorld.simulation.benches[0];
  Object.assign(clockVisitor.visitor, { x: clockBench.x, z: clockBench.z + 1.5 });
  await clockWorld.webSocketMessage(clockVisitor, JSON.stringify({ type: 'interaction', requestId: 'clock-seat', request: { kind: 'bench', id: clockBench.id, index: 0 } }));
  check(checkpoints === beforeActionSave + 1 && clockVisitor.visitor.bench?.index === 0, 'Accepted actions save immediately between movement checkpoints');
  await clockWorld.webSocketMessage(clockVisitor, JSON.stringify({ type: 'heartbeat', active: false, watching: false, bench: clockVisitor.visitor.bench }));
  check(clockWorld.clock.timer === null, 'An entirely hidden world stops its timer and can hibernate');
  await clockWorld.webSocketMessage(clockVisitor, JSON.stringify({ type: 'heartbeat', active: false, watching: true, bench: clockVisitor.visitor.bench }));
  check(clockWorld.clock.timer !== null, 'Visible menus keep shared actors moving even while player input is inactive');
  now += 100;
  await clockWorld.webSocketMessage(clockVisitor, JSON.stringify({ type: 'interaction', requestId: 'clock-focus', request: { kind: 'activity', id: 'focus' } }));
  check(clockWorld.clock.timer === null && clockVisitor.visitor.activity === 'focus', 'Private focus does not run the public movement clock');
  now += 100;
  await clockWorld.webSocketMessage(clockVisitor, JSON.stringify({ type: 'interaction', requestId: 'clock-leave', request: { kind: 'leave' } }));
  check(clockWorld.clock.timer !== null, 'Leaving private focus resumes the public clock');
  now += 15001;
  const staleTimer = clockWorld.clock.timer;
  clockTimers.get(staleTimer)();
  check(clockVisitor.visitor.left && clockWorld.clock.timer === null, 'Missing renewals expire visitors and stop the last active timer');
  console.log(`${checks.length} shared-world Worker checks passed.`);
  if (process.env.OUTPUT_FILE) fs.writeFileSync(process.env.OUTPUT_FILE, JSON.stringify({ checks }, null, 2) + '\n');
})().catch(error => { console.error(error); process.exitCode = 1; });

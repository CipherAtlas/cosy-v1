const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto, createHash } = require('node:crypto');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const { VillageSimulation } = require('../../../worker/simulation.ts');
const garden = require('../../../features/village/garden.ts');
const { ACTIVITY_STAGES } = require('../../../features/village/sharedActors.ts');
const physics = require('../../../worker/world-physics.json');
assert.equal(physics.layoutHash, createHash('sha256').update(fs.readFileSync('public/village/world-layout.json')).digest('hex'), 'Worker physics must match the current saved layout');
let now = 100000, requestNumber = 0;
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
  storage: { kv: { get: key => records.get(key), put: (key, value) => records.set(key, JSON.parse(JSON.stringify(value))) }, getAlarm: async () => null, setAlarm: async () => {} } };
const mod = { exports: {} };
const source = fs.readFileSync('worker/index.js', 'utf8').replace(/^import .*;\n/gm, '')
  .replace('export class VillageWorld', 'class VillageWorld').replace('export default {', 'const workerDefault = {');
vm.runInNewContext(`${source}\nmodule.exports = VillageWorld;`, { module: mod, crypto: webcrypto,
  Date: class extends Date { static now() { return now; } }, DurableObject: class { constructor(ctx) { this.ctx = ctx; } },
  VillageSimulation, ACTIVITY_STAGES, GARDEN_TARGETS: garden.GARDEN_TARGETS, ...garden,
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
  world.garden.mintTea = 1;
  await move(a, 15, -10); await send(a, { type: 'garden', action: { kind: 'drink' } });
  check(luma.state.gesture?.kind === 'tea' && luma.state.gesture.at === now,
    'Accepted tea actions give the owned companion one shared gesture clock');
  const teaGesture = luma.state.gesture.at;
  world.simulation.gardenMoment(d.visitor, { kind: 'drink' }, now + 1);
  check(luma.state.gesture.at === teaGesture, 'Another visitor cannot restart an owned companion gesture');
  world.garden.mint = 1;
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
  console.log(`${checks.length} shared-world Worker checks passed.`);
  if (process.env.OUTPUT_FILE) fs.writeFileSync(process.env.OUTPUT_FILE, JSON.stringify({ checks }, null, 2) + '\n');
})().catch(error => { console.error(error); process.exitCode = 1; });

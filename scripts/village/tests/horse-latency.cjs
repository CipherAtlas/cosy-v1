const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const { HorseRiding: WorkerRiding } = require('../../../worker/horseRiding.ts');
const { HorseRiding: ClientRiding } = require('../../../features/village/horseRiding.ts');
const { VillageMovement } = require('../../../features/village/movement.ts');
const { setAuthoredWorld } = require('../../../features/village/environment.ts');
const { stepHorse } = require('../../../features/village/horseMotion.ts');
setAuthoredWorld({ terrain: { base: 'flat', samples: [] }, openWorld: true, paths: [], items: [], bridges: [], walkable: [] });
const horse = { state: { id: 'test-horse', kind: 'horse', owner: 'rider', mode: 'ride', x: 12, y: 0, z: 20, heading: 0, speed: 0 }, movement: new VillageMovement([], () => {}) };
const worker = new WorkerRiding();
const forward = { forward: 1, turn: 0, sprint: false, brake: false, sequence: 1 };
assert(worker.input(horse, forward, 1000));
assert(worker.input(horse, { ...forward, turn: 1, sequence: 2 }, 1016), 'A steering change one frame after forward must be accepted');
assert(worker.input(horse, { ...forward, turn: -1, sequence: 3 }, 1032), 'Rapid reverse steering must replace the held turn');
assert(!worker.input(horse, { ...forward, sequence: 2 }, 1048), 'Old sequenced packets cannot replace newer steering');
assert(!worker.input(horse, { ...forward, turn: NaN, sequence: 4 }, 1050));
assert(!worker.input(horse, { ...forward, sequence: 1.5 }, 1050));
worker.step(horse, 1, .016, 1048, () => false);
assert(horse.state.heading < 0, 'The next Worker step uses the most recent steering');

const sent = [], client = new ClientRiding();
client.connect(input => sent.push(input));
const accepted = { ...horse.state, x: 12, z: 20, heading: 0, speed: 0, ride: { velocity: 0, input: null, at: 1000, sequence: 0, blocked: false } };
client.sync([accepted], 'rider', 1000, 0);
client.update(new Set(['w', 'a']), true, 0);
const pose = client.sample(.016, 1, horse.movement, () => false, 16);
assert(pose.heading > .02, 'The accepted rider sees steering in the next frame, before any reply');
assert.equal(accepted.heading, 0, 'Visual prediction must never mutate the accepted shared actor');
assert.equal(sent.length, 1);
const initialHeading = pose.heading;
client.update(new Set(['w', 'd']), true, .016);
const reversed = client.sample(.016, 1, horse.movement, () => false, 32);
assert(reversed.heading < initialHeading, 'Rapid changes affect the next local frame too');
const reconciled = { ...accepted, heading: -.1, ride: { velocity: 0, input: sent.at(-1), at: 1016, sequence: sent.at(-1).sequence, blocked: false } };
client.sync([reconciled], 'rider', 1048, 80);
assert(client.sample(.016, 1, horse.movement, () => false, 96).heading < initialHeading, 'Snapshots reconcile to accepted steering');
client.sync([{ ...reconciled, ride: { ...reconciled.ride, blocked: true } }], 'rider', 1080, 112);
assert.equal(client.sample(.016, 1, horse.movement, () => false, 128).heading, -.1, 'Race countdown cannot predict motion');
client.sync([reconciled], 'rider', 1120, 144);
const stale = client.sample(.016, 1, horse.movement, () => false, 800);
assert.equal(stale.heading, reconciled.heading, 'Delivery stalls stop prediction at the accepted pose');
client.sync([{ ...accepted, owner: 'other' }], 'rider', 1120, 816);
assert.equal(client.sample(.016, 1, horse.movement, () => false, 832), null, 'Losing ownership clears predicted motion');
client.clear();
const touch = new ClientRiding(); touch.connect(() => {});
touch.sync([accepted], 'rider', 1000, 0);
touch.update(new Set(), true, 0, { forward: .5, turn: -.6, sprint: false, brake: false });
const touchHeading = touch.sample(.016, 1, horse.movement, () => false, 16).heading;
assert(touchHeading < -.01, 'Analog touch steering responds before a reply');
touch.update(new Set(), true, .016, { forward: .5, turn: -.6, sprint: false, brake: true });
assert(Math.abs(touch.sample(.016, 1, horse.movement, () => false, 32).heading - touchHeading) < 1e-10,
  'Brake keeps the visual heading fixed');

const collision = new ClientRiding(); collision.connect(() => {});
collision.setColliders([{ x: 12, z: 22, w: 4, d: .2 }, { x: 150, z: 150, w: 1, d: 1 }]);
collision.sync([{ ...accepted, ride: { ...accepted.ride, velocity: 9, input: { ...forward, sprint: true } } }], 'rider', 1000, 0);
const solid = collision.sample(.016, 1, horse.movement, () => false, 350);
assert(solid.z < 21.1, 'The nearby collision probe stops the full footprint at a solid');
const occupants = new ClientRiding(); occupants.connect(() => {});
occupants.sync([{ ...accepted, ride: { ...accepted.ride, velocity: 9, input: { ...forward, sprint: true } } }], 'rider', 1000, 0);
assert.equal(occupants.sample(.016, 1, horse.movement, () => true, 350).z, accepted.z, 'Occupied shared ground cannot advance visually');
const bounded = new ClientRiding(); bounded.connect(() => {});
bounded.sync([{ ...accepted, ride: { ...accepted.ride, velocity: 9, input: { ...forward, sprint: true } } }], 'rider', 1000, 0);
const limit = bounded.sample(.016, 1, horse.movement, () => false, 350).z;
assert(limit <= accepted.z + 9 * .35 + 1e-8, 'Visual motion stays within the 350ms projection horizon');
assert.equal(bounded.sample(.016, 1, horse.movement, () => false, 390).z, limit, 'A stalled stream cannot advance beyond the horizon');
const legacy = new ClientRiding(); legacy.connect(() => {});
const { ride: _ride, ...oldActor } = accepted;
legacy.sync([oldActor], 'rider', 1000, 0);
assert.equal(legacy.sample(.016, 1, horse.movement, () => false, 16), null, 'Older Workers retain accepted-path rendering');
assert.equal(worker.snapshot(horse, 2000, false).input, null, 'Expired accepted input is not replayed from snapshots');
worker.stop(horse);
assert.equal(worker.snapshot(horse, 2000, false).sequence, 0, 'Releasing a ride clears its acknowledgement and velocity');

// A fresh snapshot must not ease away the distance travelled since the last rendered frame.
const steady = new ClientRiding(); steady.connect(() => {});
const cruise = { ...accepted, ride: { ...accepted.ride, velocity: 9, input: { ...forward, sprint: true } } };
steady.sync([cruise], 'rider', 1000, 0);
steady.sample(.016, 1, horse.movement, () => false, 16);
steady.sync([{ ...cruise, z: cruise.z + 9 * .032 }], 'rider', 1032, 32);
assert(Math.abs(steady.sample(.016, 1, horse.movement, () => false, 32).z - (cruise.z + 9 * .032)) < .01,
  'A steady accepted trajectory must not hitch when a snapshot arrives');
steady.sync([{ ...cruise, z: cruise.z + 9 * .132 }], 'rider', 1132, 132);
assert(Math.abs(steady.sample(.06, 1, horse.movement, () => false, 132).z - (cruise.z + 9 * .132)) < .01,
  'Reconciliation preserves real elapsed travel after a slow render frame');

const fence = new VillageMovement([{ x: 13, z: 20, w: .1, d: 30 }], () => {});
const sliding = { x: 11.9, y: 0, z: 20, heading: Math.PI / 4, speed: 0 };
let slideVelocity = 4.5;
for (let i = 0; i < 60; i++) slideVelocity = stepHorse(sliding, slideVelocity, forward, 1, 1 / 60, fence, () => false);
assert(sliding.z > 22, 'Holding forward against a fence retains useful sliding speed');

const turning = { ...accepted, heading: 0 };
stepHorse(turning, 9, { ...forward, sprint: true, turn: 1 }, 1, .5, horse.movement, () => false);
assert(turning.heading >= .7, 'Cantering must allow a useful turn without a ten-metre turning radius');

const dense = new VillageMovement([{ x: 13, z: 20, w: .1, d: 30 },
  ...Array.from({ length: 3300 }, (_, i) => ({ x: 100 + i, z: 100, w: 1, d: 1 }))], () => {});
const localProbe = dense.nearby(12, 20, 4);
assert.equal(localProbe.colliders.length, 1, 'Horse steps exclude distant scenery while retaining nearby long barriers');
for (const x of [11, 12, 12.5, 13, 13.5, 14]) assert.equal(localProbe.clear(x, 20), dense.clear(x, 20));
const blockedHorse = { state: { ...accepted, ride: undefined }, movement: dense };
const blockedWorker = new WorkerRiding(); blockedWorker.input(blockedHorse, { ...forward, turn: 1 }, 1000);
const fullScan = dense.clear.bind(dense);
let fullScans = 0;
dense.clear = (...args) => { fullScans++; return fullScan(...args); };
blockedWorker.step(blockedHorse, 1, .1, 1100, () => false);
assert.equal(fullScans, 0, 'The authoritative ride uses the bounded probe rather than repeatedly scanning the whole village');
let distantReads = 0;
const distant = { x: 200, z: 200, w: 1, d: 1, get top() { distantReads++; return 8; } };
const walkingProbe = new VillageMovement([distant], () => {});
walkingProbe.clear(12, 20);
assert.equal(distantReads, 0, 'Advancing the other shared actors must not scan distant solids on each collision probe');
const lookup = require('../../../features/village/collisionLookup.ts');
const query = lookup.nearbyColliders;
const solids = [...require('../../../worker/world-physics.json').colliders,
  { x: 12, z: 20, w: 8, d: .2, yaw: Math.PI / 4, bottom: 0, top: 3 },
  { x: -8, z: -8, w: .2, d: 20, yaw: Math.PI / 2, bottom: 2, top: 4 }];
const indexed = new VillageMovement(solids, () => {});
let compared = 0;
for (const collider of solids) for (const offset of [-1, 0, 1]) {
  const x = collider.x + offset * (collider.w / 2 + .31), z = collider.z + offset * (collider.d / 2 + .31);
  const result = indexed.clear(x, z, collider.bottom ?? 0);
  lookup.nearbyColliders = () => solids;
  const brute = indexed.clear(x, z, collider.bottom ?? 0);
  lookup.nearbyColliders = query;
  assert.equal(result, brute, 'Indexed collision keeps the exact full-scan result at layout and rotated-solid boundaries');
  compared++;
}
console.log(`${compared} indexed/full-scan collision comparisons pass.`);
console.log('Horse rapid-input, next-frame keyboard/touch response, reconciliation, countdown, collision, stall and ownership checks pass.');

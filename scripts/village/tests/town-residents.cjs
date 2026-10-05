const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const { VillageSimulation } = require('../../../worker/simulation.ts');
const { VILLAGERS, TOWN_RESIDENT_IDS } = require('../../../features/village/villagers.ts');
const { TownInteractions } = require('../../../features/village/townInteractions.ts');
const { TOWN_RIVAL_LAP_MS } = require('../../../features/village/townShared.ts');
let now = Date.now();
const checks = [];
const check = (value, label) => { assert(value, label); checks.push(label); };
const sim = new VillageSimulation();
sim.step(now, []);
check(TOWN_RESIDENT_IDS.every(id => sim.snapshot(now).actors.some(actor => actor.id === id && actor.kind === 'resident')), 'Three farmers and Rowan have one shared identity each');
check(TOWN_RESIDENT_IDS.every(id => VILLAGERS.find(profile => profile.id === id).chat.length >= 2), 'Each new resident has distinct bilingual conversation lines');
check(sim.town.state.rival === null, 'Rowan is off his horse before an invitation');
check(!sim.townInteraction({ id: 'remote', x: 85, z: 34, heading: 0, active: true }, { kind: 'town', action: 'raceStart', id: 'horse-racetrack' }, now, []).ok,
  'The former direct race command cannot bypass Rowan’s dialogue');
const rowan = sim.actor('rowan', 'resident');
const a = { id: 'a', x: rowan.state.x - 1, z: rowan.state.z, heading: 0, active: true, lastSeen: now };
const b = { ...a, id: 'b', x: a.x - 1 };
const visitors = [a, b];
const invite = visitor => sim.townInteraction(visitor, { kind: 'town', action: 'raceInvite', id: 'rowan' }, now, visitors);
check(!invite(a).ok && !a.horse && !sim.town.state.race, 'A race invitation requires an accepted conversation first');
check(sim.interact(a, { kind: 'resident', id: 'rowan', action: 'talk' }, now).ok, 'Rowan accepts a nearby conversation');
check(!sim.interact(b, { kind: 'resident', id: 'rowan', action: 'talk' }, now).ok, 'Another visitor cannot take Rowan’s conversation');
check(!invite(b).ok && !b.horse, 'Another visitor cannot use somebody else’s race invitation');
const horses = sim.actors.filter(actor => actor.state.kind === 'horse');
for (const horse of horses) { horse.state.owner = 'other'; horse.state.mode = 'ride'; }
check(!invite(a).ok && !a.horse && !sim.town.state.race, 'Busy horses refuse the invitation without a partial mount or race');
for (const horse of horses) { horse.state.owner = null; horse.state.mode = 'idle'; }
check(invite(a).ok, 'An accepted dialogue invitation starts the race');
check(!!a.horse && sim.mountedHorse(a.id)?.state.id === a.horse, 'The visitor is automatically mounted on one actual free horse');
check(rowan.state.mode === 'ride' && sim.town.state.race.owner === a.id, 'Rowan mounts only after the accepted invitation');
sim.step(now += 120, visitors);
check(sim.town.state.rival?.mode === 'idle', 'Both racers wait through the shared countdown');
const restored = new VillageSimulation(sim.save());
check(restored.mountedHorse(a.id)?.state.id === a.horse && restored.actor('rowan', 'resident').state.mode === 'ride', 'Worker restoration preserves both accepted racers');
const goAt = sim.town.state.race.goAt;
sim.step(now = goAt + 120, visitors);
check(sim.town.state.rival?.mode === 'ride', 'The accepted clock starts Rowan’s lap');
sim.step(now = goAt + TOWN_RIVAL_LAP_MS + 120, visitors);
sim.step(now += 120, visitors);
check(sim.town.state.rival === null && rowan.state.mode !== 'ride', 'Rowan dismounts and returns to care when his lap ends');
sim.releaseVisitor(a.id, now);
check(sim.town.state.race.phase === 'cancelled', 'A departing racer releases the race rather than transferring it');
for (const id of ['rusk', 'poppy', 'cress']) {
  const farmer = sim.actor(id, 'resident');
  const visitor = { id: `guest-${id}`, x: farmer.state.x - 1, z: farmer.state.z, heading: 0, active: true, lastSeen: now };
  check(sim.interact(visitor, { kind: 'resident', id, action: 'talk' }, now).ok, `${id} accepts the same shared conversation action as original villagers`);
  check(!sim.interact(visitor, { kind: 'resident', id, action: 'walk' }, now).ok, `${id} stays responsible for their own farm`);
  const pose = [farmer.state.x, farmer.state.z];
  sim.step(now += 120, [visitor]);
  check(Math.hypot(pose[0] - farmer.state.x, pose[1] - farmer.state.z) < .001, `${id} holds position during accepted conversation`);
}
const care = new VillageSimulation();
const caredFor = new Set(), gestures = new Set();
for (let i = 0; i < 1200; i++) {
  care.step(now += 120, []);
  const gesture = care.actor('rowan', 'resident').state.gesture;
  if (gesture) { caredFor.add(gesture.horseId); gestures.add(gesture.kind); }
}
check(gestures.has('horseFeed') && gestures.has('horsePet'), 'Idle Rowan alternates shared feeding and petting clocks');
check(caredFor.size === 2, 'Rowan visits both stable horses');
check(care.town.state.race === null && care.town.state.rival === null, 'Idle horse care cannot start a race or spawn a mounted rival');
const context = new TownInteractions(care.authored).context(care.town.state, 'guest', 85, 34, null, null, false, now, { apples: 0, mushrooms: 0 });
check(!context || !context.actions.some(action => action.request.action === 'raceStart'), 'The animal/task panel cannot offer the old race invitation');
console.log(`${checks.length} town resident and invitation checks passed.`);

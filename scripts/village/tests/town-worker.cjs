const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const { TownSimulation } = require('../../../worker/town.ts');
const { trackPoint, TOWN_GROW_MS, TOWN_TRACK_START_ANGLE, TOWN_APPLE_REGROW_MS } = require('../../../features/village/townShared.ts');
const items = [];
const item = (id, asset, x, z, rotation = 0, scale = [1, 1, 1]) => {
  const value = { id, asset, position: [x, 0, z], rotation: [0, rotation, 0], scale, visible: true };
  items.push(value); return value;
};
const track = item('track', 'horse-racetrack', 85, 20);
item('stable', 'horse-stable', 85, 42, 180);
item('owls', 'owl-feeding-perch', -48, -30);
for (let index = 0; index < 5; index++) item(`farm-1-row-${index + 1}`, 'farm-row', 30, -78 + index * 2.7);
item('rotated-row', 'farm-row', 60, -78, 90, [2, 1, 1]);
for (const [asset, id, x, z] of [['cow-highland', 'cow', -46, 56], ['sheep', 'sheep', -47, 63],
  ['lamb', 'lamb', -45, 65], ['hedgehog', 'hedgehog', 29, -4]]) item(id, asset, x, z);
const world = { items };
const sim = new TownSimulation(world);
const checks = [];
const check = (value, label) => { assert(value, label); checks.push(label); };
let now = Date.now();
const a = { id: 'a', x: 82, z: 39, active: true, lastSeen: now, crumbPouch: false };
const b = { ...a, id: 'b' };
const horse = { id: 'horse', kind: 'horse', x: 82, y: 0, z: 39, heading: 0, speed: 0, owner: null, mode: 'idle' };
const action = (visitor, action, id, extra = {}) => sim.action(visitor, { kind: 'town', action, id, ...extra }, now, [horse]);
const tick = (advance = 120) => { now += advance; a.lastSeen = b.lastSeen = now; sim.step(now, [a, b], [horse]); };
check(sim.state.beds.slice(0, 5).filter(bed => bed.growAt !== null).length === 2, 'A fresh farm begins with two mature rows, a sprout and two empty rows');
check(action(a, 'hay', horse.id).ok, 'A nearby stable horse accepts one hay meal');
check(!action(b, 'hay', horse.id).ok, 'Contested hay cannot restart the shared meal');
check(horse.mode === 'hold' && horse.owner === a.id, 'Hay holds the real horse rather than granting a ride');
sim.releaseVisitor(a.id, now); tick();
check(horse.owner === null && sim.feedingHorse(horse.id, now), 'A departing feeder releases ownership while the accepted meal clock stays busy');
check(!action(b, 'hay', horse.id).ok, 'Disconnect cannot be used to duplicate the unfinished hay meal');
tick(12000); check(action(b, 'hay', horse.id).ok, 'The stable horse becomes available after its meal');
a.x = -48; a.z = -27; b.x = -48; b.z = -27;
check(!action(a, 'owlFeed', 'owls').ok && sim.state.owlFeedAt === null, 'Owls refuse visitors without food');
check(action(a, 'owlFood', 'owls').ok && a.crumbPouch, 'The perch grants treats only to a nearby visitor');
check(action(a, 'owlFeed', 'owls').ok && !a.crumbPouch, 'An accepted owl meal consumes its server-owned pouch');
action(b, 'owlFood', 'owls'); const owlAt = sim.state.owlFeedAt;
check(!action(b, 'owlFeed', 'owls').ok && b.crumbPouch && sim.state.owlFeedAt === owlAt, 'Rejected competing owl feeds keep the visitor food and original clock');
a.x = 38; a.z = -78 + 3 * 2.7 + 1.6;
check(!action(a, 'gardenPlant', 'farm-1-row-4', { crop: 'mint' }).ok
  && sim.state.beds.find(bed => bed.id === 'farm-1-row-4').crop === null && !a.forageInventory,
  'The carrot farm refuses mint without changing the row or granting inventory');
check(action(a, 'gardenPlant', 'farm-1-row-4', { crop: 'carrot' }).ok, 'Farming accepts the end of a full 16 metre row');
check(!action(b, 'gardenPlant', 'farm-1-row-4', { crop: 'mint' }).ok, 'Remote visitors cannot plant a town row');
b.x = a.x; b.z = a.z;
check(!action(b, 'gardenPlant', 'farm-1-row-4', { crop: 'mint' }).ok, 'Two visitors cannot plant the same occupied row');
check(action(a, 'gardenWater', 'farm-1-row-4').ok, 'Water records a shared three-minute growth deadline');
const bed = sim.state.beds.find(bed => bed.id === 'farm-1-row-4');
check(bed.growAt === now + TOWN_GROW_MS && !action(b, 'gardenWater', bed.id).ok, 'Competing water does not restart growth');
tick(TOWN_GROW_MS); check(action(a, 'gardenHarvest', bed.id).ok && a.forageInventory.carrots === 1, 'A mature row grants one accepted private crop');
check(!action(b, 'gardenHarvest', bed.id).ok && sim.state.harvest.carrot === 1, 'Concurrent harvest cannot duplicate a crop');
a.x = 61.5; a.z = -94;
check(action(a, 'gardenHarvest', 'rotated-row').ok, 'Scaled and rotated row ends use their actual authored rectangle');
a.x = 500; a.z = 500;
check(!action(a, 'gardenPlant', 'rotated-row', { crop: 'mint' }).ok, 'A remote farm action cannot cross the map');
for (const animal of sim.state.animals) {
  a.x = animal.x + 1.2; a.z = animal.z; b.x = a.x; b.z = a.z;
  check(action(a, 'animalPet', animal.id).ok, `The shared ${animal.species} accepts nearby petting`);
  const pose = [animal.x, animal.z]; tick();
  check(JSON.stringify(pose) === JSON.stringify([animal.x, animal.z]) && !action(b, 'animalPet', animal.id).ok,
    `The ${animal.species} holds still and refuses competing petting`);
  a.x += 8; tick(); check(animal.owner === null && animal.mode === 'graze', `Leaving releases the ${animal.species}`);
}
tick(12000); horse.owner = a.id; horse.mode = 'ride'; a.horse = horse.id;
[a.x, a.z] = trackPoint(track, TOWN_TRACK_START_ANGLE); horse.x = a.x; horse.z = a.z;
check(action(a, 'raceStart', 'track').ok, 'Mounted visitors at the ribbon start one shared countdown');
check(!action(b, 'raceStart', 'track').ok, 'Another visitor cannot replace the current race');
tick(); check(sim.countdownHorse(horse.id, now), 'The accepted countdown blocks the racing horse input');
tick(3000); check(sim.state.race.phase === 'racing' && sim.state.rival.speed > 0, 'The Worker starts and moves the NPC rival on the same clock');
const gate = sim.state.race.nextCheckpoint;
[horse.x, horse.z] = trackPoint(track, TOWN_TRACK_START_ANGLE + 4 * Math.PI / 8); tick();
check(sim.state.race.nextCheckpoint === gate, 'Skipping or reversing checkpoints cannot complete a lap');
for (let checkpoint = 1; checkpoint <= 8; checkpoint++) {
  [horse.x, horse.z] = trackPoint(track, TOWN_TRACK_START_ANGLE + checkpoint * Math.PI / 4); tick(1000);
}
check(sim.state.race.phase === 'finished' && sim.state.race.result === 'visitor', 'Eight ordered checkpoints publish one visitor finish and result');
const { townActivityHUD } = require('../../../features/village/townProgress.ts');
const farmContext = { kind: 'farm', title: 'Mint row', growth: { crop: 'mint', readyAt: now + TOWN_GROW_MS, duration: TOWN_GROW_MS }, actions: [] };
check(townActivityHUD(sim.snapshot(), a.id, farmContext, now)?.kind === 'farm'
  && townActivityHUD(sim.snapshot(), a.id, { kind: 'race', title: 'Track', actions: [] }, now)?.phase === 'finished',
  'A completed race yields to nearby farm progress while its result remains available at the track');
const restored = new TownSimulation(world, sim.snapshot()); restored.step(now, [a, b], [horse]);
check(restored.state.race.playerFinishAt === sim.state.race.playerFinishAt && restored.state.harvest.carrot === sim.state.harvest.carrot,
  'Hibernation keeps completed race clocks and communal crops');
action(a, 'raceStart', 'track'); sim.releaseVisitor(a.id, now);
check(sim.state.race.phase === 'cancelled', 'Leaving cancels the race without transferring it to a spectator');
check(townActivityHUD(sim.snapshot(), a.id, farmContext, now)?.kind === 'farm'
  && townActivityHUD(sim.snapshot(), a.id, null, now) === null,
  'A cancelled race cannot obscure another activity or leave a result floating around the village');
const { TownInteractions } = require('../../../features/village/townInteractions.ts');
const cropRows = [item('farm-2-row-4', 'farm-row', 180, 120), item('farm-3-row-4', 'farm-row', 210, 120)];
const cropSim = new TownSimulation(world), cropControls = new TownInteractions(world);
for (const [row, crop] of [[items.find(item => item.id === 'farm-1-row-4'), 'carrot'], [cropRows[0], 'radish'], [cropRows[1], 'mint']]) {
  const visitor = { id: `crop-${crop}`, x: row.position[0], z: row.position[2] + .8, active: true };
  const context = cropControls.context(cropSim.snapshot(), visitor.id, visitor.x, visitor.z, null, null, false, now, { apples: 0, mushrooms: 0 });
  check(context?.actions.length === 1 && context.actions[0].request.crop === crop && context.actions[0].key === 'E', `${crop} farm offers only its crop with the E shortcut`);
  check(context.title === `${crop.charAt(0).toUpperCase() + crop.slice(1)} Farm - Row 4`, `${crop} farm uses its crop and stable row number in the heading`);
  const wrong = crop === 'mint' ? 'radish' : 'mint';
  check(!cropSim.action(visitor, { kind: 'town', action: 'gardenPlant', id: row.id, crop: wrong }, now, []).ok, `${crop} farm rejects a forged ${wrong} planting request`);
  const planted = cropSim.action(visitor, { kind: 'town', action: 'gardenPlant', id: row.id, crop }, now, []).ok;
  const watered = cropSim.action(visitor, { kind: 'town', action: 'gardenWater', id: row.id }, now, []).ok;
  const growing = cropControls.context(cropSim.snapshot(), visitor.id, visitor.x, visitor.z, null, null, false, now, { apples: 0, mushrooms: 0 });
  check(growing.detail === '' && growing.actions.length === 1 && growing.actions[0].label === 'Harvest'
    && growing.actions[0].key === 'E' && growing.actions[0].disabled, `${crop} growth has a disabled E Harvest button and no bottom countdown`);
  check(planted && watered && cropSim.action(visitor, { kind: 'town', action: 'gardenHarvest', id: row.id }, now + TOWN_GROW_MS, []).ok
    && visitor.forageInventory[crop === 'carrot' ? 'carrots' : crop === 'radish' ? 'radishes' : 'mint'] === 1, `${crop} farm grants exactly its own mature crop`);
}
const ordered = new TownSimulation({ ...world, items: [...items].reverse() });
check(ordered.state.beds.find(bed => bed.id === 'farm-1-row-1').crop === 'carrot', 'Reordering editor objects does not change a named farm crop');
const nearbyControls = new TownInteractions(world);
check(nearbyControls.context(sim.snapshot(), a.id, 83.5, 38.7, null, horse.id, false, now, { apples: 0, mushrooms: 0 })?.kind === 'stable',
  'An unmounted visitor beside a stable horse can feed hay where the south ribbon context overlaps the stable');
const activeRace = { ...sim.snapshot(), race: { ...sim.state.race, phase: 'racing', owner: a.id } };
check(nearbyControls.context(activeRace, a.id, 83.5, 38.7, null, horse.id, false, now, { apples: 0, mushrooms: 0 })?.kind === 'race',
  'The visitor’s active race still keeps its leave control available across the stable context');
const { VillageSimulation } = require('../../../worker/simulation.ts');
const { HorseRiding } = require('../../../worker/horseRiding.ts');
const { VillageMovement } = require('../../../features/village/movement.ts');
const environment = require('../../../features/village/environment.ts');
const full = new VillageSimulation(), ridden = full.actor('horse-juniper', 'horse');
const { outdoorMapDestinations, mapArrival } = require('../../../features/village/mapDestinations.ts');
const mapDestinations = outdoorMapDestinations(full.authored);
check(mapDestinations.filter(place => place.kind === 'swing').length === 2 && mapDestinations.filter(place => place.kind === 'farm').length === 3
  && ['field', 'circuit', 'owls'].every(kind => mapDestinations.some(place => place.kind === kind)), 'The editable world exposes both swings, three farms, field, circuit and owl grove as map destinations');
const traveller = { id: 'map-traveller', x: .3, z: 20, heading: 0, active: true, activity: 'focus' };
check(!full.mapTravel(traveller, 'forged-destination', now, [traveller]).ok && traveller.activity === 'focus', 'Unknown map destinations cannot release an activity or move the visitor');
traveller.active = false;
check(full.mapTravel(traveller, mapDestinations[0].id, now, [traveller]).ok, 'Opening a map pauses movement without preventing an accepted teleport');
for (const destination of mapDestinations) {
  const result = full.mapTravel(traveller, destination.id, now, [traveller]);
  check(result.ok && result.position && !traveller.activity && Math.hypot(traveller.x - destination.x, traveller.z - destination.z) <= 4.001,
    `Worker approves a clear arrival near ${destination.name}`);
  const other = { id: 'other-map-traveller', x: 0, z: 0, heading: 0, active: true };
  const second = full.mapTravel(other, destination.id, now, [traveller, other]);
  check(second.ok && Math.hypot(other.x - traveller.x, other.z - traveller.z) >= .8, `Simultaneous map arrivals do not overlap at ${destination.name}`);
}
check(mapArrival(mapDestinations[0], () => false) === null, 'An entirely blocked destination refuses travel');
const edge = [80, 37.293], heading = 0;
const rider = { id: 'kerb-rider', x: edge[0], z: edge[1], heading, active: true, lastSeen: 10000, horse: ridden.state.id };
ridden.movement.settle(...edge); Object.assign(ridden.state, { ...ridden.movement.position, owner: rider.id, mode: 'ride', heading });
check(environment.floorHeight(...edge) === 0 && environment.floorHeight(edge[0] + Math.sin(heading) * .001, edge[1] + Math.cos(heading) * .001) === .05,
  'The actual stable-to-track approach contains the reproduced 5 cm limestone edge');
full.step(10000, [rider]);
for (let i = 1; i <= 40; i++) { const at = 10000 + i * 25; rider.lastSeen = at; full.horseInput(rider, { forward: 1, turn: 0, brake: false, sprint: false }, at); full.step(at, [rider]); }
check(Math.hypot(ridden.state.x - edge[0], ridden.state.z - edge[1]) > 1, 'Worker horse inputs cross the actual paving edge from rest');
const slopeTerrain = { version: 1, cellSize: 2, base: 'flat', samples: [[65, 60, 0], [66, 60, 1.5], [65, 61, 0], [66, 61, 1.5]] };
const slope = { state: { id: 'slope-probe', x: 130.8, z: 120.8, y: .6, heading: Math.PI / 2, speed: 0 }, movement: new VillageMovement([], () => {}) };
const slopeRiding = new HorseRiding(); slopeRiding.input(slope, { forward: 1, turn: 0, brake: false, sprint: true }, 20000);
slopeRiding.step(slope, 1, .75, 20000, () => false); // Approach the slope at a real accumulated speed.
slope.state.x = 130.8;
environment.setAuthoredWorld({ ...full.authored, terrain: slopeTerrain });
slopeRiding.step(slope, 1, 1 / 60, 20000, () => false);
check(slope.state.x === 130.8 && slope.state.speed === 0, 'The small paving allowance does not permit a steep sculpted slope');
environment.setAuthoredWorld({ ...full.authored, terrain: { ...slopeTerrain, samples: slopeTerrain.samples.map(([x, z, y]) => [x, z, y * 4]) } });
const cliff = { state: { id: 'cliff-probe', x: 130.2, z: 120.8, y: .6, heading: Math.PI / 2, speed: 0 }, movement: new VillageMovement([], () => {}) };
const cliffRiding = new HorseRiding(); cliffRiding.input(cliff, { forward: 1, turn: 0, brake: false, sprint: true }, 30000);
cliffRiding.step(cliff, 1, .2, 30000, () => false);
check(cliff.state.x === 130.2 && cliff.state.speed === 0, 'Horse terrain probes still refuse the steep cliff footprint');
environment.setAuthoredWorld(full.authored);
const forageItem = (id, asset, x, z) => ({ id, asset, visible: true, position: [x, 0, z], rotation: [0, 0, 0], scale: [1, 1, 1] });
const forageWorld = { ...full.authored, terrain: { version: 1, base: 'flat', cellSize: 2, samples: [] }, items: [
  forageItem('gift-hedge', 'hedgehog', 130, 120), forageItem('orchard', 'apple-tree', 132, 120),
  forageItem('mushrooms', 'mushroom-patch', 128, 120), forageItem('flower-cow', 'cow-highland-girl', 134, 126),
  forageItem('boy-cow', 'cow-highland', 137, 126),
] };
environment.setAuthoredWorld(forageWorld);
let foraging = new TownSimulation(forageWorld), forageNow = 40000;
const giftA = { id: 'gift-a', x: 130, z: 120, active: true, lastSeen: forageNow }, giftB = { ...giftA, id: 'gift-b' };
const forageTick = () => { forageNow += 120; giftA.lastSeen = giftB.lastSeen = forageNow; foraging.step(forageNow, [giftA, giftB], []); };
const forageAction = (visitor, action, id) => foraging.action(visitor, { kind: 'town', action, id }, forageNow, []);
const awaitForage = predicate => { for (let i = 0; i < 1000 && !predicate(); i++) forageTick(); assert(predicate(), 'Foraging reaches its real authored destination'); };
forageTick(); const hedge = () => foraging.state.animals.find(animal => animal.id === 'gift-hedge');
check(hedge().mode === 'forage' && !hedge().carry && !forageAction(giftA, 'animalGift', hedge().id).ok,
  'Foraging starts toward a real orchard and cannot grant a gift while walking');
awaitForage(() => hedge().mode === 'forage' && hedge().until > forageNow);
check(!hedge().carry && Math.hypot(hedge().x - 132, hedge().z - 121.8) < .2 && hedge().until === forageNow + 1400,
  'The shared pickup clock starts only at the authored apple collection point');
const pickupUntil = hedge().until;
foraging = new TownSimulation(forageWorld, foraging.snapshot());
check(hedge().until === pickupUntil && !hedge().carry, 'Restoring an active pickup preserves its original deadline without granting food early');
awaitForage(() => hedge().mode === 'return');
check(hedge().carry === 'apple', 'The hedgehog gains one carried apple after the accepted pickup clock');
foraging = new TownSimulation(forageWorld, foraging.snapshot());
check(hedge().mode === 'return' && hedge().carry === 'apple', 'Restoring the shared world preserves a returning hedgehog and its one carried item');
awaitForage(() => hedge().mode === 'gift');
check(Math.hypot(hedge().x - 130, hedge().z - 120) < .2, 'The hedgehog brings its gift back to its actual home');
const offered = foraging.snapshot();
check(offered.animals.find(animal => animal.id === hedge().id).carry === 'apple', 'Late snapshots see the same offered apple');
giftA.x = 300;
check(!forageAction(giftA, 'animalGift', hedge().id).ok && hedge().carry === 'apple', 'Remote visitors cannot collect a shared hedgehog gift');
giftA.x = 130; giftA.activity = 'focus';
check(!forageAction(giftA, 'animalGift', hedge().id).ok && hedge().carry === 'apple', 'Private focus cannot collect an outdoor gift');
giftA.activity = null; giftA.forageInventory = { apples: 9, mushrooms: 0 };
check(!forageAction(giftA, 'animalGift', hedge().id).ok && hedge().carry === 'apple' && giftA.forageInventory.apples === 9,
  'A full server basket cannot consume the offered gift');
giftA.forageInventory.apples = 0;
check(forageAction(giftA, 'animalPet', hedge().id).ok && !forageAction(giftB, 'animalGift', hedge().id).ok,
  'Petting an offered-gift hedgehog holds it exclusively without duplicating its carry');
foraging.releaseVisitor(giftA.id, forageNow);
check(hedge().mode === 'gift' && hedge().carry === 'apple', 'Leaving gift petting preserves the shared carried apple');
check(forageAction(giftA, 'animalGift', hedge().id).ok && giftA.forageInventory.apples === 1 && !hedge().carry,
  'One accepted gift atomically consumes shared carry and grants server visitor inventory');
check(!forageAction(giftB, 'animalGift', hedge().id).ok && !giftB.forageInventory,
  'A competing gift request cannot duplicate or locally grant inventory');
const girl = foraging.state.animals.find(animal => animal.id === 'flower-cow');
check(girl?.species === 'cow', 'The flower Highland girl is a real shared cow alongside the boy');
giftA.x = girl.x + 1; giftA.z = girl.z; giftB.x = giftA.x; giftB.z = giftA.z;
giftB.forageInventory = { apples: 1, mushrooms: 0 };
check(forageAction(giftA, 'animalApple', girl.id).ok && giftA.forageInventory.apples === 0 && girl.mode === 'apple',
  'Accepted apple feeding consumes exactly one inventory apple and starts the distinct cow meal');
check(girl.heading === Math.atan2(giftA.x - girl.x, giftA.z - girl.z), 'The accepted cow apple meal faces and holds toward its actual feeder');
const appleAt = girl.startedAt, appleUntil = girl.until;
check(!forageAction(giftB, 'animalApple', girl.id).ok && giftB.forageInventory.apples === 1 && girl.startedAt === appleAt,
  'Contested cow feeding cannot consume rejected food or restart the meal clock');
foraging.releaseVisitor(giftA.id, forageNow);
check(girl.owner === null && girl.mode === 'apple' && girl.until === appleUntil && !forageAction(giftB, 'animalApple', girl.id).ok,
  'Leaving releases cow ownership but keeps its accepted meal busy until completion');
awaitForage(() => hedge().mode === 'gift' && hedge().carry === 'mushroom');
giftA.x = hedge().x + 1; giftA.z = hedge().z;
check(forageAction(giftA, 'animalGift', hedge().id).ok && giftA.forageInventory.mushrooms === 1 && giftA.forageInventory.apples === 0,
  'The next foraging trip visits the real mushroom patch and grants its separate gift');
giftA.x = girl.x + 1; giftA.z = girl.z;
check(!forageAction(giftA, 'animalApple', girl.id).ok && giftA.forageInventory.mushrooms === 1,
  'An empty apple basket cannot grant an apple meal');
check(forageAction(giftA, 'animalMushroom', girl.id).ok && giftA.forageInventory.mushrooms === 0,
  'Accepted mushroom feeding consumes one private mushroom');
check(!forageAction(giftB, 'animalMushroom', girl.id).ok,
  'Contested mushroom feeding cannot grant a second meal');
forageNow += TOWN_APPLE_REGROW_MS;
giftA.x = 132; giftA.z = 121.8; giftB.x = giftA.x; giftB.z = giftA.z;
check(forageAction(giftA, 'applePick', 'orchard').ok && giftA.forageInventory.apples === 1,
  'Visitors can pick one available apple themselves');
check(!forageAction(giftB, 'applePick', 'orchard').ok && giftB.forageInventory.apples === 1,
  'Competing apple picking does not duplicate the shared apple');
const orchardClock = foraging.state.applePickedAt.orchard;
const orchardRestored = new TownSimulation(forageWorld, foraging.snapshot());
check(orchardRestored.state.applePickedAt.orchard === orchardClock,
  'Apple regrowth survives Worker restoration');
forageNow += TOWN_APPLE_REGROW_MS;
check(forageAction(giftB, 'applePick', 'orchard').ok && giftB.forageInventory.apples === 2,
  'An apple tree becomes available after its public regrowth clock');
const rotatedSource = { ...forageItem('rotated-orchard', 'apple-tree', 132, 120), rotation: [0, 90, 0], scale: [1, 1, 1.5] };
const rotatedWorld = { ...forageWorld, items: [forageWorld.items[0], rotatedSource] };
environment.setAuthoredWorld(rotatedWorld);
const rotatedForage = new TownSimulation(rotatedWorld);
for (let i = 0; i < 200 && !rotatedForage.state.animals[0].until; i++) rotatedForage.step(60000 + i * 120, [], []);
check(Math.hypot(rotatedForage.state.animals[0].x - 134.7, rotatedForage.state.animals[0].z - 120) < .2,
  'Foraging uses the editor-rotated and scaled orchard collection contact');
const blockedForage = new TownSimulation(rotatedWorld, undefined, [{ x: 134.7, z: 120, w: 1, d: 1, bottom: 0, top: 2 }]);
for (let i = 0; i < 150; i++) blockedForage.step(70000 + i * 120, [], []);
check(!blockedForage.state.animals[0].carry && blockedForage.state.animals[0].mode === 'graze',
  'A physically blocked collection contact cannot teleport a hedgehog or create food');
const alternateWorld = { ...rotatedWorld, items: [...rotatedWorld.items, forageItem('reachable-patch', 'mushroom-patch', 128, 120)] };
environment.setAuthoredWorld(alternateWorld);
const alternateForage = new TownSimulation(alternateWorld, undefined, [{ x: 134.7, z: 120, w: 1, d: 1, bottom: 0, top: 2 }]);
for (let i = 0; i < 250 && alternateForage.state.animals[0].mode !== 'gift'; i++) alternateForage.step(80000 + i * 120, [], []);
check(alternateForage.state.animals[0].mode === 'gift' && alternateForage.state.animals[0].carry === 'mushroom',
  'An unreachable preferred orchard still lets the hedgehog visit a reachable mushroom patch');
environment.setAuthoredWorld(full.authored);
console.log(`${checks.length} shared town checks passed.\n${checks.join('\n')}`);

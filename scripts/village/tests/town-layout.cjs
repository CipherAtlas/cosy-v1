// Checks the authored town with the real water, terrain and movement rules.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);

const root = path.resolve(__dirname, '../../..');
const { projectWorldLayout, RESIDENT_IDS, insidePlantingClearance } = require('../../../features/village/worldLayout.ts');
const { RESIDENT_ROUTES } = require('../../../features/village/sharedActors.ts');
const { layoutWorldPoint } = require('../../../features/village/layoutTransforms.ts');
const { trackPoint, townPoint } = require('../../../features/village/townShared.ts');
const { conformRiverBank } = require('../../../features/village/riverGeometry.ts');
const T = require('three');
const { MEADOW_FLOWER_COUNT, townPlantingClearance } = require('../../../features/village/meadowVegetation.ts');
const { VillageMovement, MOVEMENT } = require('../../../features/village/movement.ts');
const { VillageNavigation } = require('../../../features/village/navigation.ts');
const { HorseRiding } = require('../../../worker/horseRiding.ts');
const { TownSimulation } = require('../../../worker/town.ts');
const environment = require('../../../features/village/environment.ts');
const bytes = fs.readFileSync(path.join(root, 'public/village/world-layout.json'));
const layout = JSON.parse(bytes), authored = projectWorldLayout(layout);
environment.setAuthoredWorld(authored);
const items = layout.objects.filter(item => item.visible), checks = [];
const check = (condition, label) => { assert(condition, label); checks.push(label); };
const withPhysics = process.argv.includes('--physics');
let colliders = [];
if (withPhysics) {
  const physics = require('../../../worker/world-physics.json');
  check(physics.layoutHash === createHash('sha256').update(bytes).digest('hex'), 'Rendered physics belongs to the current town layout');
  colliders = physics.colliders;
}
const movement = new VillageMovement(colliders, () => {}), riding = new HorseRiding();
const horse = { state: { id: 'layout-probe' }, movement };
const dry = (x, z) => !environment.inRiver(x, z) && environment.pondDistance(x, z) > 1.1;

check(layout.sceneVersion === 1 && layout.openWorld, 'Town retains the open authored scene');
check(new Set(layout.objects.map(item => item.id)).size === layout.objects.length, 'Placed objects have unique shared identities');
const meadowIds = new Set(items.filter(item => item.asset === 'grass-meadow').map(item => item.id));
const meadowZones = authored.grass.filter(zone => meadowIds.has(zone.id));
const flowerZones = items.filter(item => item.asset === 'flower-meadow');
check(meadowZones.length === 49 && flowerZones.length === meadowZones.length, 'Every town meadow zone has grass and wildflowers');
check(authored.grass.reduce((count, zone) => count + zone.count, 23000) <= 200000,
  'Complete town grass coverage stays within the 200,000 candidate instance budget');
check(flowerZones.length * MEADOW_FLOWER_COUNT <= 6000, 'New meadow flowers remain a bounded instanced population');
let widestGrassGap = 0;
for (let x = -90; x <= 130; x++) for (let z = -100; z <= 95; z++) {
  const nearest = Math.min(...meadowZones.map(zone => {
    const dx = x - zone.x, dz = z - zone.z, c = Math.cos(zone.yaw), s = Math.sin(zone.yaw);
    return Math.hypot((dx * c - dz * s) / zone.radiusX, (dx * s + dz * c) / zone.radiusZ);
  }));
  widestGrassGap = Math.max(widestGrassGap, nearest);
}
check(widestGrassGap < .9, 'Overlapping meadow footprints cover every metre of the inhabited town before path and water masking');
const track = items.find(item => item.asset === 'horse-racetrack'), stable = items.find(item => item.asset === 'horse-stable');
assert(track && stable, 'The town contains a racecourse and feeding stable');
check(authored.horses.length === 2 && authored.horses.every(item => Math.hypot(item.x - stable.position[0], item.z - stable.position[2]) < 8),
  'Both existing riding horses start in the stable yard');
check(items.filter(item => item.asset === 'meadow-swings').length === 2,
  'Two independently claimable swing sets sit beside the western pasture');
for (const swing of items.filter(item => item.asset === 'meadow-swings')) {
  check(swing.position[0] < -40 && swing.position[2] < 40, `${swing.id} sits in the pasture verge`);
  check(authored.paths.every(lane => lane.spine.every(([x, z]) => Math.hypot(x - swing.position[0], z - swing.position[2]) > 3.3 + lane.width * .67)),
    `${swing.id} keeps its full motion envelope off limestone paving`);
}
for (const lane of authored.paths) {
  const separate = lane.spine.every(([x, z]) => Array.from({ length: 8 }, (_, i) => {
    const angle = i * Math.PI / 4, margin = lane.width * .67;
    const dx = x + Math.cos(angle) * margin - track.position[0], dz = z + Math.sin(angle) * margin - track.position[2];
    return (dx / 26.6) ** 2 + (dz / 16.6) ** 2 > 1 || (dx / 21.4) ** 2 + (dz / 11.4) ** 2 < 1;
  }).every(Boolean));
  check(separate, `The entire limestone width avoids the race tread: ${lane.id}`);
}
const bank = new T.BufferGeometry();
bank.setAttribute('position', new T.Float32BufferAttribute([-11 + Math.sin(3 * .052) * 3, .007, 3, -25, .007, 20, -11, .007, 125], 3));
conformRiverBank(bank, new T.Matrix4(), authored);
check(bank.attributes.position.getY(0) < -.32, 'An enlarged pond bank overlapping the original river stays below its water');
check(Math.abs(bank.attributes.position.getY(1) - .007) < .00001 && Math.abs(bank.attributes.position.getY(2) - .007) < .00001,
  'Dry meadow and the finite river endpoints keep their original bank height');
conformRiverBank(bank, new T.Matrix4().makeTranslation(20, 0, 0), authored);
check(Math.abs(bank.attributes.position.getY(0) - .007) < .00001, 'Moving the shore away restores its original dry surface without accumulated carving');
conformRiverBank(bank, new T.Matrix4(), { ...authored, items: authored.items.filter(item => item.asset !== 'river') });
check(Math.abs(bank.attributes.position.getY(0) - .007) < .00001, 'Removing the river restores the original shoreline in the local editor');
bank.dispose();

const rows = items.filter(item => item.asset === 'farm-row');
check(rows.length >= 15, 'Three substantial farms contain at least fifteen crop rows');
for (const item of rows) {
  const points = [-8, -4, 0, 4, 8].flatMap(x => [-.6, 0, .6].map(z => townPoint(item, x, z)));
  check(points.every(([x, z]) => dry(x, z)), `Full crop footprint stays out of water: ${item.id}`);
}
for (const farm of [1, 2, 3]) {
  const field = rows.filter(item => item.id.startsWith(`farm-${farm}-row-`)).sort((a, b) => a.position[2] - b.position[2]);
  check(field.length >= 5, `Farm ${farm} has five independently addressable crop rows`);
  check(field.slice(1).every((item, index) => item.position[2] - field[index].position[2] >= 2.55),
    `Farm ${farm} leaves walking space between crop rows`);
}
for (const item of items.filter(item => ['cow-highland', 'cow-highland-girl', 'sheep', 'lamb', 'hedgehog'].includes(item.asset))) {
  check(dry(item.position[0], item.position[2]), `Grazing animal starts on dry land: ${item.id}`);
  check(Math.abs(item.position[1] - environment.floorHeight(item.position[0], item.position[2])) < .02,
    `Grazing animal starts on the actual terrain: ${item.id}`);
}

const { BRIDGE } = environment;
for (const item of items.filter(item => item.asset === 'bridge' && item.id !== 'bridge')) {
  const localPoint = offset => layoutWorldPoint(item, [BRIDGE.x + offset, 0, BRIDGE.z], [BRIDGE.x, 0, BRIDGE.z]);
  const center = localPoint(0);
  check(environment.inRiver(center[0], center[2]), `Placed bridge spans actual brook water: ${item.id}`);
  for (const offset of [-6.3, -5.8, -3, 0, 3, 5.8, 6.3]) {
    const [x, , z] = localPoint(offset);
    check(movement.clear(x, z), `Bridge approach and deck are clear: ${item.id} at ${offset} m`);
    check(riding.clear(horse, x, z, Math.PI / 2 + item.rotation[1] * Math.PI / 180, 1),
      `A horse footprint fits the bridge: ${item.id} at ${offset} m`);
  }
  for (const direction of [-1, 1]) {
    const start = localPoint(-direction * 6.3), end = localPoint(direction * 6.3);
    const dx = end[0] - start[0], dz = end[2] - start[2], distance = Math.hypot(dx, dz);
    movement.settle(start[0], start[2]);
    for (let frame = 0; frame < 360; frame++) movement.update(1 / 60, {
      x: dx / distance, z: dz / distance, run: false, sprint: false, blocked: false,
    });
    const progress = (movement.position.x - start[0]) * dx / distance + (movement.position.z - start[2]) * dz / distance;
    check(progress > distance - .15, `Real movement crosses the ${item.id} arch in direction ${direction}`);
  }
}

for (let sample = 0; sample < 80; sample++) {
  const angle = sample / 80 * Math.PI * 2, [x, z] = trackPoint(track, angle);
  const next = trackPoint(track, angle + .01), heading = Math.atan2(next[0] - x, next[1] - z);
  check(riding.clear(horse, x, z, heading, 1), `Entire horse footprint fits race ribbon sample ${sample}`);
}
check(Array.from({ length: 80 }, (_, sample) => trackPoint(track, sample / 80 * Math.PI * 2))
  .every(([x, z]) => townPlantingClearance(x, z, items)), 'Meadow planting keeps the complete race tread exposed');
check([[0, 0], [-10, 0], [10, 0], [0, -5], [0, 5]].map(([x, z]) => townPoint(track, x, z))
  .every(([x, z]) => !townPlantingClearance(x, z, items) && !insidePlantingClearance(x, z, authored.clearings)),
  'The racecourse green infield remains available for meadow planting');
check(rows.every(item => [-8, 0, 8].flatMap(x => [-.6, 0, .6].map(z => townPoint(item, x, z)))
  .every(([x, z]) => townPlantingClearance(x, z, items))), 'Meadow planting leaves every crop row footprint exposed');
check(rows.filter(item => item.id.endsWith('-1')).map(item => townPoint(item, 0, 1.35))
  .every(([x, z]) => !townPlantingClearance(x, z, items) && !insidePlantingClearance(x, z, authored.clearings)),
  'The green walking aisles between crop rows remain available for meadow planting');
for (const lane of authored.paths) {
  check(lane.spine.every(([x, z]) => movement.clear(x, z)), `Walking lane stays traversable: ${lane.id}`);
}
check(environment.floorHeight(-42, 58) >= 1.45 && movement.clear(-42, 58), 'The gentle pasture summit supports walking');

const navigation = new VillageNavigation(colliders, authored);
const hedgehogHome = items.find(item => item.id === 'hedgehog-1');
check(items.some(item => item.id === 'cow-highland-1' && item.asset === 'cow-highland-girl'),
  'Honey keeps her shared identity as the flower-adorned Highland cow');
for (const asset of ['apple-tree', 'mushroom-patch'])
  check(items.some(item => item.asset === asset && Math.hypot(item.position[0] - hedgehogHome.position[0], item.position[2] - hedgehogHome.position[2]) < 8),
    `The garden hedgehog has a nearby ${asset} foraging source`);
check(movement.clear(hedgehogHome.position[0], hedgehogHome.position[2]), 'The hedgehog garden home remains clear');
const forage = new TownSimulation(authored, undefined, colliders);
const hedgehog = forage.state.animals.find(animal => animal.id === hedgehogHome.id);
const visitor = { id: 'layout-forage-probe', x: hedgehogHome.position[0], z: hedgehogHome.position[2], active: true };
let forageNow = Date.now();
for (const food of ['apple', 'mushroom']) {
  let clear = true, near = true, samples = 0;
  while (hedgehog.mode !== 'gift' && samples++ < 1200) {
    forageNow += 100; visitor.lastSeen = forageNow; forage.step(forageNow, [visitor], []);
    clear &&= movement.clear(hedgehog.x, hedgehog.z);
    near &&= Math.hypot(hedgehog.x - visitor.x, hedgehog.z - visitor.z) < 8;
  }
  check(hedgehog.mode === 'gift' && hedgehog.carry === food, `The actual shared hedgehog completes its ${food} foraging trip`);
  check(clear && near, `Every sampled ${food} foraging position stays clear and beside the garden`);
  check(Math.hypot(hedgehog.x - visitor.x, hedgehog.z - visitor.z) < .2, `The ${food} gift returns to the hedgehog's garden home`);
  assert(forage.action(visitor, { kind: 'town', action: 'animalGift', id: hedgehog.id }, forageNow, []).ok,
    'The geometry probe can accept the returned gift before the next trip');
}
for (const [index, id] of RESIDENT_IDS.entries()) {
  const points = authored.routes[id]?.points ?? RESIDENT_ROUTES[index];
  for (const [waypoint, point] of points.entries())
    check(movement.clear(...point), `${id} roaming waypoint ${waypoint + 1} stays on clear ground`);
  for (let waypoint = 0; waypoint < points.length; waypoint++) {
    const from = points[waypoint], destination = points[(waypoint + 1) % points.length];
    const path = navigation.path(from, destination), end = path.at(-1);
    movement.settle(...from);
    const traversable = path.every(point => {
      const clear = movement.canWalkTo(...point); movement.settle(...point); return clear;
    });
    check(end && Math.hypot(end[0] - destination[0], end[1] - destination[1]) < .05 && traversable,
      `${id} roaming leg ${waypoint + 1} reaches its destination through clear walking segments`);
  }
  movement.settle(...points[0]);
  let completed = true;
  for (let waypoint = 1; waypoint <= points.length && completed; waypoint++) {
    const destination = points[waypoint % points.length];
    const path = navigation.path([movement.position.x, movement.position.z], destination);
    for (const point of path) {
      const frames = Math.ceil(Math.hypot(point[0] - movement.position.x, point[1] - movement.position.z) / MOVEMENT.walk * 60) + 120;
      for (let frame = 0; frame < frames; frame++) {
        const dx = point[0] - movement.position.x, dz = point[1] - movement.position.z, distance = Math.hypot(dx, dz);
        if (distance < .05) break;
        movement.update(1 / 60, { x: dx / distance, z: dz / distance, run: false, sprint: false, blocked: false });
      }
      if (Math.hypot(point[0] - movement.position.x, point[1] - movement.position.z) >= .1) { completed = false; break; }
    }
    if (!path.length || Math.hypot(destination[0] - movement.position.x, destination[1] - movement.position.z) >= .1)
      completed = false;
  }
  check(completed, `Real movement completes ${id}'s entire roaming circuit, including the closing leg`);
}

if (process.env.PROTECTED_LAYOUT_HASHES) {
  const hashes = JSON.parse(fs.readFileSync(process.env.PROTECTED_LAYOUT_HASHES));
  for (const [file, hash] of Object.entries(hashes)) {
    check(createHash('sha256').update(fs.readFileSync(path.resolve(root, file))).digest('hex') === hash,
      `Protected saved design retains its bytes: ${file}`);
  }
}
const result = { pass: true, scope: withPhysics ? 'Actual saved renderer colliders plus water/terrain movement' : 'Water/terrain movement; rendered colliders require --physics',
  checks, objects: layout.objects.length, homes: items.filter(item => item.asset.startsWith('cottage-')).length,
  trees: items.filter(item => item.asset.startsWith('tree-')).length, rows: rows.length, paths: authored.paths.length,
  terrainPoints: layout.terrain.samples.length };
if (process.env.OUTPUT_FILE) fs.writeFileSync(process.env.OUTPUT_FILE, JSON.stringify(result, null, 2) + '\n');
console.log(`${checks.length} focused town layout checks passed (${result.scope}).`);

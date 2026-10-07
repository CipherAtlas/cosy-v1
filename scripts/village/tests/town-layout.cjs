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
const { projectWorldLayout, RESIDENT_IDS, insidePlantingClearance, distanceToPath } = require('../../../features/village/worldLayout.ts');
const { RESIDENT_ROUTES } = require('../../../features/village/sharedActors.ts');
const { layoutWorldPoint } = require('../../../features/village/layoutTransforms.ts');
const { trackPoint, townPoint } = require('../../../features/village/townShared.ts');
const { conformRiverBank, joinRiverToPonds, makeRiverChannelHeight, refineRiverTerrain, riverGeometry } = require('../../../features/village/riverGeometry.ts');
const { riverBanks, buildRiverbankStones } = require('../../../features/village/riverbankStones.ts');
const T = require('three');
const { blendPavingJunctions } = require('../../../features/village/plantingClearance.ts');
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
const townMeadows = meadowZones.filter(zone => zone.id.startsWith('town-groundcover-'));
check(townMeadows.length === 49 && flowerZones.filter(zone => zone.id.startsWith('town-wildflower-meadow-')).length === townMeadows.length, 'Every original town meadow retains grass and wildflowers');
check(authored.grass.reduce((count, zone) => count + zone.count, 23000) <= 256000,
  'Dense hill and town grass stay within the 256,000 candidate allocation budget; actual visible instances are checked in renderer QA');
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
const streamFixture = projectWorldLayout({ version: 1, base: layout.base, sceneVersion: 1,
  objects: [{ id: "channel-probe", asset: "custom-river", visible: true, position: [100, 5, 100], rotation: [0, 0, 0], scale: [1, 1, 1], path: { points: [[0, 0], [0, 10]], width: 2.6 } }] });
const slopedHeight = x => 5 + (x - 100) * .3;
const channel = makeRiverChannelHeight(streamFixture, slopedHeight);
check(Math.abs(channel(100, 104) - 4.37) < 1e-8 && Math.abs(channel(101, 104) - 4.37) < 1e-8,
  'Custom stream bed stays 0.7 m below its flat cross-stream water surface');
check(channel(102, 104) > 4.37 && channel(102, 104) < slopedHeight(102) && channel(103, 104) === slopedHeight(103),
  'Channel banks blend back into unchanged terrain within one metre of the water edge');
const crossStream = riverGeometry([[100, 100], [100, 110]], 2.6, slopedHeight);
for (let i = 0; i < crossStream.attributes.position.count; i += 2)
  assert.equal(crossStream.attributes.position.getY(i), crossStream.attributes.position.getY(i + 1));
check(true, 'Every custom-stream water cross-section is level even on sloping terrain');
crossStream.dispose();
const streamBank = new T.BufferGeometry(); streamBank.setAttribute('position', new T.Float32BufferAttribute([100, 5, 104, 110, 5, 104], 3));
conformRiverBank(streamBank, new T.Matrix4(), streamFixture, slopedHeight);
check(Math.abs(streamBank.attributes.position.getY(0) - 4.37) < 1e-5 && streamBank.attributes.position.getY(1) === 5,
  'Pond banks overlapping a custom stream are lowered locally without changing distant banks');
conformRiverBank(streamBank, new T.Matrix4(), { ...streamFixture, rivers: [] }, slopedHeight);
check(streamBank.attributes.position.getY(0) === 5, 'Removing an edited stream restores the original bank geometry');
streamBank.dispose();

// Reproduce the reported radish-bank intrusion using the actual winding brook and coarse terrain grid.
const terrainSource = new T.PlaneGeometry(16, 20, 8, 10); terrainSource.rotateX(-Math.PI / 2); terrainSource.translate(60, 0, -55);
const bankTerrain = refineRiverTerrain(terrainSource, authored, new T.Matrix4());
const terrainPositions = bankTerrain.attributes.position, actualChannel = makeRiverChannelHeight(authored, () => 0);
for (let i = 0; i < terrainPositions.count; i++) terrainPositions.setY(i, actualChannel(terrainPositions.getX(i), terrainPositions.getZ(i), 0));
bankTerrain.computeVertexNormals();
const bankGround = new T.Mesh(bankTerrain, new T.MeshBasicMaterial()); bankGround.name = 'Valley ground';
const brook = authored.rivers.find(river => river.id === 'town-brook');
const brookMesh = new T.Mesh(riverGeometry(brook.points, brook.width), new T.MeshBasicMaterial());
const bankScene = new T.Group(); bankScene.add(bankGround, brookMesh); bankScene.updateMatrixWorld(true);
const ray = new T.Raycaster(), streamPositions = brookMesh.geometry.attributes.position;
let wetSamples = 0;
for (let i = 0; i < streamPositions.count; i += 2) {
  if (streamPositions.getZ(i) < -62 || streamPositions.getZ(i) > -47) continue;
  for (const across of [.03, .15, .5, .85, .97]) {
    const point = new T.Vector3().fromBufferAttribute(streamPositions, i).lerp(new T.Vector3().fromBufferAttribute(streamPositions, i + 1), across);
    ray.set(new T.Vector3(point.x, 3, point.z), new T.Vector3(0, -1, 0));
    const ground = ray.intersectObject(bankGround)[0];
    assert(ground && ground.point.y < point.y - .02, 'Radish-bank soil stays below the water across the full curved ribbon'); wetSamples++;
  }
}
check(wetSamples > 100, 'Refined radish-bank ground cannot form green triangles through the river');
const rockColliders = [], stones = buildRiverbankStones(bankScene, new T.MeshBasicMaterial(), () => 0, rockColliders);
const bankMovement = new VillageMovement(rockColliders, () => {});
check(rockColliders.length > 30, 'Generated riverbank stones register solid movement footprints');
for (const collider of rockColliders.filter(c => c.x > 54 && c.x < 66 && c.z > -62 && c.z < -47))
  assert(!bankMovement.clear(collider.x, collider.z, collider.bottom + .01), 'A walking spirit cannot pass through a visible bank stone');
check(rockColliders.every(c => c.top > .07 && c.top > c.bottom), 'Rock collision uses the actual visible stone height');
stones.traverse(mesh => { if (mesh instanceof T.InstancedMesh) mesh.dispose(); });
terrainSource.dispose(); bankTerrain.dispose(); brookMesh.geometry.dispose();

const junction = new T.Group();
const coreGeometry = new T.PlaneGeometry(4, 4); coreGeometry.rotateX(-Math.PI / 2); coreGeometry.userData.plantingSurface = 'paving';
const shoulderGeometry = new T.BufferGeometry();
shoulderGeometry.setAttribute('position', new T.Float32BufferAttribute([0,.06,0, 1,.06,0, 0,.06,1], 3));
shoulderGeometry.setAttribute('color', new T.Float32BufferAttribute([0,1,1, 0,1,1, 0,1,1], 3)); shoulderGeometry.userData.plantingSurface = 'paving';
const coreMesh = new T.Mesh(coreGeometry), shoulderMesh = new T.Mesh(shoulderGeometry); junction.add(coreMesh, shoulderMesh);
blendPavingJunctions(junction);
check([0,1,2].every(i => shoulderGeometry.attributes.color.getX(i) === 1), 'Overlapping path shoulders cannot paint a grass wedge over another paved lane');
coreMesh.position.x = 20; blendPavingJunctions(junction);
check([0,1,2].every(i => shoulderGeometry.attributes.color.getX(i) === 0), 'Moving the other lane restores the original outer shoulder in the editor');
coreGeometry.dispose(); shoulderGeometry.dispose();



const hillZones = authored.grass.filter(zone => zone.id.startsWith('picnic-hill-grass'));
check(hillZones.length === 24 && hillZones.every(zone => zone.heightScale <= .8), 'The hill has 24 editable zones of low grass');
let coveredHillSamples = 0;
for (let x = -162; x <= -54; x += 2) for (let z = -76; z <= 32; z += 2) {
  if (Math.hypot(x + 108, z + 22) > 55 || environment.landscapeHeight(x, z) < .7) continue;
  assert(hillZones.some(zone => Math.hypot((x - zone.x) / zone.radiusX, (z - zone.z) / zone.radiusZ) < 1), `Raised hill has grass coverage at ${x},${z}`);
  coveredHillSamples++;
}
check(coveredHillSamples > 1500, 'Overlapping low-grass zones cover the raised summit and every hill slope');
let streamWaterClearance = null;
const bentStream = riverGeometry([[0,0],[5,2],[6,9]],2.6);
const streamUV=bentStream.attributes.uv;
for(let i=2;i<streamUV.count;i+=2) assert(streamUV.getY(i)>streamUV.getY(i-2));
check(streamUV.getY(streamUV.count-1)>12,'Bent river UV distance increases downstream in metres');
const pondJoinFixture = { ...authored, items: [{ id: 'join-pond', asset: 'pond', visible: true, position: [20, 3, 10], rotation: [0, 37, 0], scale: [1.6, 1.2, .8] }] };
const pondTransform = new T.Matrix4().compose(new T.Vector3(20, 3, 10), new T.Quaternion().setFromEuler(new T.Euler(0, 37 * Math.PI / 180, 0)), new T.Vector3(1.6, 1.2, .8));
const joinedStream = joinRiverToPonds(riverGeometry([[0,-30],[0,30]],2.6,()=>-.37), pondTransform, pondJoinFixture);
const joinedPositions = joinedStream.attributes.position, joinWeights = joinedStream.attributes.waterJoin;
const insidePond = (x,z) => Array.from({length:96},(_,i)=> {
  const a=i*Math.PI/48,b=(i+1)*Math.PI/48;
  return (Math.cos(b)-Math.cos(a))*(z/12-Math.sin(a))-(Math.sin(b)-Math.sin(a))*(x/9-Math.cos(a))>1e-8;
}).every(Boolean);
let rimVertices=0;
for(let i=0;i<joinedPositions.count;i++) {
  assert(!insidePond(joinedPositions.getX(i),joinedPositions.getZ(i)),'No stream vertex lies inside the transformed pond polygon');
  if(joinWeights.getX(i)>.9999) { rimVertices++; assert(Math.abs(joinedPositions.getY(i)+.3)<1e-6,'Stream rim matches pond height'); }
}
check(rimVertices>3,'A rotated, scaled pond cuts the overlapping stream at its actual rim and blends water state');
for(let i=0;i<joinedStream.index.count;i+=3) {
  const ids=[0,1,2].map(n=>joinedStream.index.getX(i+n));
  const x=ids.reduce((sum,id)=>sum+joinedPositions.getX(id),0)/3,z=ids.reduce((sum,id)=>sum+joinedPositions.getZ(id),0)/3;
  assert(!insidePond(x,z),'No clipped stream triangle covers the pond interior');
}
check(true,'Stream triangles remain outside the pond surface, eliminating coplanar overlap');
const joinedBanks=riverBanks(new T.Mesh(joinedStream));
check(joinedBanks[0].length===joinedBanks[1].length&&joinedBanks[0].length>100&&joinedBanks.flat().every(sample=>Number.isFinite(sample.outward.x)&&sample.outward.length()>.9),
  'Clipping retains paired source samples for stable automatic riverbank stones');
const untouchedStream=riverGeometry([[0,0],[0,10]],2.6);
check(joinRiverToPonds(untouchedStream,new T.Matrix4(),{...authored,items:[]})===untouchedStream,'Hiding or removing all ponds retains the original stream geometry');
joinedStream.dispose();untouchedStream.dispose();bentStream.dispose();
const waterfallItem=authored.items.find(item=>item.visible&&item.asset==='hill-waterfall');
const outletPoint=layoutWorldPoint(waterfallItem,[0,0,1.8],[0,0,0]);
const outletBed=makeRiverChannelHeight(authored,environment.landscapeHeight);
check(outletBed(outletPoint[0],outletPoint[2])<waterfallItem.position[1]-.5,'Waterfall outlet has a carved bed below its lowered water surface');
const cascadeStream = authored.rivers.find(river => river.id === 'hill-waterfall-stream');
if (cascadeStream) {
  const carve = makeRiverChannelHeight(authored, environment.landscapeHeight);
  const item = items.find(item => item.id === cascadeStream.id), offset = item.position[1] - environment.landscapeHeight(item.position[0], item.position[2]);
  check(cascadeStream.spine.every(([x, z]) => carve(x, z) <= environment.landscapeHeight(x, z) + offset + .07 - .7 + .001),
    'The waterfall stream has a carved channel beneath every sampled water section');
  check(distanceToPath(-108, -22, cascadeStream) > cascadeStream.width / 2 + 1 && carve(-108, -22) === environment.landscapeHeight(-108, -22),
    'Stream carving preserves the grassy picnic summit');
  const water = riverGeometry(cascadeStream.points, cascadeStream.width, (x, z) => environment.landscapeHeight(x, z) + offset);
  const positions = water.attributes.position;
  const coarseGround = (x, z) => {
    const gx = Math.floor(x / 2) * 2, gz = Math.floor(z / 2) * 2, tx = (x - gx) / 2, tz = (z - gz) / 2;
    const a = carve(gx, gz), b = carve(gx + 2, gz), c = carve(gx, gz + 2), d = carve(gx + 2, gz + 2);
    return tx + tz <= 1 ? a * (1 - tx - tz) + b * tx + c * tz : d * (tx + tz - 1) + c * (1 - tx) + b * (1 - tz);
  };
  let minimum = Infinity;
  for (let i = 0; i < positions.count; i++) minimum = Math.min(minimum, positions.getY(i) - coarseGround(positions.getX(i), positions.getZ(i)));
  check(minimum > .01, 'Every waterfall-stream edge vertex clears the actual 2m terrain triangle interpolation');
  streamWaterClearance = { waterVertices: positions.count, minimumGroundClearance: minimum }; water.dispose();
}

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
    if (item.id !== 'hill-stream-bridge') check(riding.clear(horse, x, z, Math.PI / 2 + item.rotation[1] * Math.PI / 180, 1),
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
  if (withPhysics) for (const fps of [30, 60, 120]) for (const direction of [-1, 1]) for (const side of [-1, 1]) {
    const yaw = item.rotation[1] * Math.PI / 180, c = Math.cos(yaw), s = Math.sin(yaw);
    const railInset = (BRIDGE.width / 2 + .22 - (.64 + BRIDGE.collisionMargin * 2) / 2) * item.scale[2] - MOVEMENT.radius - .025;
    const [x, , z] = layoutWorldPoint(item, [BRIDGE.x - direction * 3, 0, BRIDGE.z + side * railInset / item.scale[2]], [BRIDGE.x, 0, BRIDGE.z]);
    movement.settle(x, z);
    let minimumSpeed = Infinity;
    for (let frame = 0; frame < fps * 2; frame++) {
      // Hold diagonally into the rail while moving toward the opposite bank.
      movement.update(1 / fps, { x: (direction * c + side * s * .25) / Math.hypot(1, .25),
        z: (-direction * s + side * c * .25) / Math.hypot(1, .25), run: false, sprint: false, blocked: false });
      if (frame > fps / 2) minimumSpeed = Math.min(minimumSpeed, movement.speed);
      assert(movement.clear(movement.position.x, movement.position.z, movement.position.y), `Rail contact stays clear: ${item.id}/${fps}/${direction}/${side}/${frame}`);
    }
    const progress = (movement.position.x - x) * direction * c - (movement.position.z - z) * direction * s;
    check(progress > 4 && minimumSpeed > 2.4, `Rail contact stays smooth at ${fps} fps: ${item.id}/${direction}/${side}`);
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
const picnicMat = items.find(item => item.id === 'picnic-hill-mat');
const kitchen = items.find(item => item.id === 'farm-kitchen');
check(picnicMat.position[0] < -90 && Math.hypot(picnicMat.position[0] - kitchen.position[0], picnicMat.position[2] - kitchen.position[2]) > 200,
  'Pond-side picnic hill and eastern kitchen remain separate destinations');
check(environment.floorHeight(...[picnicMat.position[0], picnicMat.position[2]]) === 24,
  'The grassy picnic summit stands 24 metres above the village');
const climb = authored.paths.find(lane => lane.id === 'picnic-hill-path').spine;
let crossFall = 0, climbGrade = 0;
for (let i = 1; i < climb.length - 1; i++) {
  const [x, z] = climb[i], [px, pz] = climb[i - 1], [nx, nz] = climb[i + 1];
  const span = Math.hypot(nx - px, nz - pz), dx = (nz - pz) / span * 1.8, dz = -(nx - px) / span * 1.8;
  crossFall = Math.max(crossFall, Math.abs(environment.floorHeight(x + dx, z + dz) - environment.floorHeight(x - dx, z - dz)));
  climbGrade = Math.max(climbGrade, Math.abs(environment.floorHeight(x, z) - environment.floorHeight(px, pz)) / Math.hypot(x - px, z - pz));
}
check(crossFall < .1 && climbGrade < .2, 'The 3.6 m hill trail has a level cross-section and gentle walking grade');
check(Math.hypot(...climb.at(-1).map((value, i) => value - picnicMat.position[i * 2])) > 5,
  'The trail ends behind the picnic without paving through the blanket');
const picnicYaw = picnicMat.rotation[1] * Math.PI / 180;
check(-Math.sin(picnicYaw) > .9 && -Math.cos(picnicYaw) > 0, 'The picnic seats face east toward the village and pond');

movement.settle(...climb[0]);
let climbed = true;
for (const point of climb.slice(1)) {
  for (let frame = 0; frame < 600; frame++) {
    const dx = point[0] - movement.position.x, dz = point[1] - movement.position.z, distance = Math.hypot(dx, dz);
    if (distance < .08) break;
    movement.update(1 / 60, { x: dx / distance, z: dz / distance, run: false, sprint: false, blocked: false });
  }
  if (Math.hypot(point[0] - movement.position.x, point[1] - movement.position.z) >= .1) { climbed = false; break; }
}
check(climbed && movement.position.y >= 23.9, 'Real walking movement climbs the entire pond-side path without jumping');

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
  terrainPoints: layout.terrain.samples.length, grassCandidates: authored.grass.reduce((sum, zone) => sum + zone.count, 23000),
  hillGrassCoverageSamples: coveredHillSamples, streamWaterClearance, trailMaxGrade: climbGrade, trailMaxCrossFallMetres: crossFall };
if (process.env.OUTPUT_FILE) fs.writeFileSync(process.env.OUTPUT_FILE, JSON.stringify(result, null, 2) + '\n');
console.log(`${checks.length} focused town layout checks passed (${result.scope}).`);

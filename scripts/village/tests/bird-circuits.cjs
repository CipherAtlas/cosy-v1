const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const T = require('three');

// Load the actual bird renderer and simulation without a running village server.
const root = path.resolve(__dirname, '../../..'), cache = new Map();
let now = 1000000;
const document = { createElement: () => ({ style: {}, setAttribute() {}, remove() {} }) };
function load(file) {
  if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const requireLocal = name => name.startsWith('.')
    ? load(path.resolve(path.dirname(file), name) + (path.extname(name) ? '' : '.ts')) : require(name);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { exports, require: requireLocal, document, Date: class extends Date { static now() { return now; } } }, { filename: file });
  return exports;
}
const { BirdFlock, BIRD_FEEDING } = load(path.join(root, 'features/village/birds.ts'));
const { VillageSimulation } = load(path.join(root, 'worker/simulation.ts'));
const { BIRD_CLEARING } = load(path.join(root, 'features/village/environment.ts'));
const checks = [], check = (ok, label) => { assert(ok, label); checks.push(label); };
const simulation = new VillageSimulation();
const visitor = { id: 'observer', x: BIRD_CLEARING.x, z: BIRD_CLEARING.z, heading: 0 };
check(simulation.birds.flightCount === 0, 'Shared flock starts with the first circuit');
for (let cycle = 1; cycle <= 3; cycle++) {
  Object.assign(simulation.birds, { phase: 'ground', since: now - 18000, served: false, queued: false, mealAt: null });
  simulation.step(now, [visitor]);
  check(simulation.birds.phase === 'flight' && simulation.birds.flightCount === cycle, 'Takeoff advances shared circuit ' + cycle);
  simulation.step(now + 100, [visitor]);
  check(simulation.birds.flightCount === cycle, 'Mid-flight steps retain circuit ' + cycle);
  now += 1000;
}
const saved = JSON.parse(JSON.stringify(simulation.save()));
const restored = new VillageSimulation(saved);
check(restored.snapshot(now).birds.flightCount === 3, 'Saved and broadcast snapshots retain the circuit choice');
const source = new T.Group(), dove = new T.Group(); dove.name = 'Dove'; source.add(dove);
for (const name of ['DoveBody', 'DoveHead', 'DoveWingLeft', 'DoveWingRight']) {
  const mesh = new T.Mesh(new T.SphereGeometry(.1, 4, 3), new T.MeshBasicMaterial()); mesh.name = name; dove.add(mesh);
}
const host = { append() {} }, camera = new T.PerspectiveCamera(), player = new T.Vector3(0, 0, 30);
const clients = [new BirdFlock(source, host, () => {}, () => {}), new BirdFlock(source, host, () => {}, () => {})];
const midpoints = [];
for (let cycle = 0; cycle <= 3; cycle++) {
  const state = { phase: 'flight', since: now - 15000, mealAt: null, queued: false, served: false, throwAt: null, origin: [0, 0, 0], flightCount: cycle };
  for (const client of clients) { client.applyShared(state, now); client.update(0, 15, false, camera, player, false, true); }
  check(clients[0].birds.every((bird, index) => bird.root.position.distanceTo(clients[1].birds[index].root.position) < 1e-8), 'Two renderers agree on shared circuit ' + cycle);
  midpoints.push(clients[0].birds[0].root.position.clone());
}
check(midpoints[0].distanceTo(midpoints[3]) < 1e-8, 'The fourth shared flight wraps to the first route');
check(midpoints.slice(0, 3).every((point, i) => midpoints.slice(0, 3).every((other, j) => i === j || point.distanceTo(other) > 5)), 'Shared flights use three distinct routes');
const meal = { ...restored.snapshot(now).birds, phase: 'ground', mealAt: now - 1500, served: true, throwAt: now - 2000 };
clients[0].applyShared(meal, now); clients[0].update(0, 2, false, camera, player, false, true);
check(clients[0].crumbs.visible && clients[0].crumbs.count === BIRD_FEEDING.servingCrumbs && clients[0].thrownCrumbs.count === BIRD_FEEDING.thrownCrumbs, 'A shared meal shows the fuller serving and separate thrown crumbs');
const matrix = new T.Matrix4(), position = new T.Vector3(); let inside = 0, outside = 0;
for (let index = 0; index < clients[0].crumbs.count; index++) {
  clients[0].crumbs.getMatrixAt(index, matrix); position.setFromMatrixPosition(matrix);
  const radius = Math.hypot(position.x - BIRD_CLEARING.x, position.z - BIRD_CLEARING.z);
  if (radius < BIRD_FEEDING.bowlRadius) inside++; else outside++;
}
check(inside > 50 && outside > 20, 'The full serving fills the bowl and spills around its rim');
clients.forEach(client => client.dispose());
const result = { checks, sharedMidpoints: midpoints.map(point => point.toArray()), inside, outside };
if (process.env.OUTPUT_FILE) fs.writeFileSync(process.env.OUTPUT_FILE, JSON.stringify(result, null, 2));
console.log(checks.length + ' focused shared bird circuit checks passed');

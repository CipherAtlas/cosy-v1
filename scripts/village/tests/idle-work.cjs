const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const T = require('three');
function load(name) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(`features/village/${name}.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: name => { assert.equal(name, 'three'); return T; } });
  return exports;
}
const { VillageFrameBudget } = load('frameBudget');
for (const refresh of [60, 120, 144]) {
  const budget = new VillageFrameBudget();
  let idle = 0, active = 0;
  for (let i = 0; i < refresh * 2; i++) if (budget.accept(i * 1000 / refresh, false)) idle++;
  assert(idle >= 48 && idle <= 61, `${refresh} Hz displays keep idle work within a 30 FPS budget`);
  for (let i = 0; i < refresh; i++) if (budget.accept(2500 + i * 1000 / refresh, true)) active++;
  assert.equal(active, refresh, 'Held movement is never throttled by the idle budget');
  budget.wake(5000);
  assert(budget.accept(5000, false)); assert(!budget.idle, 'New camera input wakes the next frame');
  assert(budget.accept(7000, false) && budget.idle && budget.cadenceChanged, 'Settling returns to idle with an explicit statistics boundary');
  budget.reset(); assert(budget.accept(7001, false), 'Resuming visibility renders immediately');
}
const { TreeVisibility } = load('treeVisibility');
const bounds = [new T.Sphere(new T.Vector3(0, 0, 0), 1), new T.Sphere(new T.Vector3(0, 0, -25), 2),
  new T.Sphere(new T.Vector3(200, 0, 0), 1)];
const transforms = bounds.map(sphere => new T.Matrix4().makeTranslation(...sphere.center.toArray()));
const mesh = () => new T.InstancedMesh(new T.BoxGeometry(), new T.MeshBasicMaterial(), 3);
const world = { trees: [{ mesh: mesh(), bounds, transforms }], treeLod: mesh() };
const camera = new T.PerspectiveCamera(55, 1.6, .12, 300);
camera.position.set(0, 2, 10); camera.lookAt(0, 0, -10); camera.updateMatrixWorld();
const player = new T.Vector3(), visibility = new TreeVisibility();
visibility.update(world, camera, player, 5);
assert.equal(world.trees[0].mesh.count, 1, 'Nearby trees retain their detailed transform');
assert.equal(world.treeLod.count, 1, 'Only visible distant trees enter the distant batch');
const version = world.trees[0].mesh.instanceMatrix.version;
for (let i = 0; i < 180; i++) visibility.update(world, camera, player, 5);
assert.equal(visibility.uploads, 1); assert.equal(world.trees[0].mesh.instanceMatrix.version, version,
  'A stationary camera performs no repeated instance-matrix uploads');
camera.position.x = 2; camera.updateMatrixWorld(); visibility.update(world, camera, player, 5);
assert.equal(visibility.uploads, 2, 'Camera motion updates tree visibility');
visibility.update(world, camera, player, 30);
assert.equal(world.trees[0].mesh.count, 2, 'A graphics distance change immediately rebuilds detail');
player.x = 200; visibility.update(world, camera, player, 5);
assert.equal(world.trees[0].mesh.count, 1);
world.trees[0].mesh.getMatrixAt(0, transforms[0]);
assert.equal(transforms[0].elements[12], 200, 'Travel replaces detailed trees with those near the new player position');
console.log('Idle frame cadence, immediate input/visibility wake, and cached tree classification/upload regressions pass.');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const T = require('three');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { buildTower } = require('../../../features/village/towerScene.ts');
const { LOOKOUT_HEIGHT } = require('../../../features/village/towerLookout.ts');
const materials = Object.fromEntries(['plaster', 'trim', 'wood', 'darkWood', 'roof', 'glass'].map(name => [name, new T.MeshStandardMaterial()]));
const tower = buildTower(materials);
tower.updateMatrixWorld(true);
for (const [x, z] of [[.73, .31], [2.71, .19], [-1.21, 1.67], [.29, -2.83]]) {
  const ray = new T.Raycaster(new T.Vector3(x, LOOKOUT_HEIGHT + 1, z), new T.Vector3(0, -1, 0));
  const hits = ray.intersectObject(tower, true);
  assert(hits.length, 'The gallery has a floor beneath each viewpoint');
  assert(Math.abs(hits[0].point.y - LOOKOUT_HEIGHT) < .00001, 'The floor matches the shared gallery height');
  const front = new Set(hits.filter(hit => Math.abs(hit.distance - hits[0].distance) < .00001).map(hit => hit.object));
  assert.equal(front.size, 1, `The floor at ${x},${z} has one visible surface; overlapping caps cause Firefox flicker`);
  assert.equal(hits[0].object.material, materials.wood, 'The sole gallery surface is timber decking');
}
console.log('Four gallery floor rays have a single timber surface at the authoritative height.');

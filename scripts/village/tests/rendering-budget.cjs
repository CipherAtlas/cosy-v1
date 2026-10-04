const assert = require('node:assert/strict');
const path = require('node:path');
const T = require('three');
const { geometryCells, instanceCells, batchStaticProp } = require(path.join(process.argv[2], 'spatialRendering.js'));
const { registerGrassDetail, VegetationDetail } = require(path.join(process.argv[2], 'vegetationDetail.js'));
let checks = 0;
const check = (condition, label) => { assert(condition, label); checks++; };
const triangles = geometry => {
  const values = [], count = geometry.index?.count ?? geometry.attributes.position.count;
  for (let i = 0; i < count; i += 3) {
    const triangle = [];
    for (let j = 0; j < 3; j++) {
      const index = geometry.index ? geometry.index.getX(i + j) : i + j;
      for (const attribute of Object.values(geometry.attributes))
        for (let k = 0; k < attribute.itemSize; k++) triangle.push(attribute.getComponent(index, k));
    }
    values.push(JSON.stringify(triangle));
  }
  return values.sort();
};
for (const indexed of [true, false]) {
  let geometry = new T.PlaneGeometry(160, 160, 16, 16); geometry.rotateX(-Math.PI / 2);
  if (!indexed) geometry = geometry.toNonIndexed();
  const cells = geometryCells(geometry, 24);
  assert.deepEqual(cells.flatMap(triangles).sort(), triangles(geometry)); checks++;
  check(cells.length > 4, 'Large surfaces have independent bounds');
  for (const cell of cells) {
    const position = cell.attributes.position;
    for (let i = 0; i < position.count; i++) check(cell.boundingSphere.center.distanceTo(new T.Vector3().fromBufferAttribute(position, i)) <= cell.boundingSphere.radius + 1e-6, 'Every vertex remains within its culling bound');
  }
}
const parent = new T.Group(); parent.position.set(19, 3, -7); parent.rotation.y = .8;
const mesh = new T.InstancedMesh(new T.BoxGeometry(1, 2, 1), new T.MeshStandardMaterial(), 4);
mesh.position.set(3, 2, -4); mesh.rotation.y = .4; parent.add(mesh);
const matrix = new T.Matrix4(), expected = [];
for (let i = 0; i < 4; i++) {
  matrix.makeTranslation(i * 30, 0, -i * 25);
  if (i === 3) matrix.scale(new T.Vector3(0, 0, 0));
  mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, new T.Color().setHSL(i / 4, .5, .5));
}
parent.updateMatrixWorld(true);
for (let i = 0; i < 3; i++) { mesh.getMatrixAt(i, matrix); expected.push(mesh.matrixWorld.clone().multiply(matrix).elements); }
const chunks = instanceCells(mesh, 18, 'Plants'); parent.updateMatrixWorld(true);
check(chunks.reduce((sum, chunk) => sum + chunk.count, 0) === 3, 'Cleared instances are omitted');
chunks.forEach((chunk, i) => {
  chunk.getMatrixAt(0, matrix); assert.deepEqual(chunk.matrixWorld.clone().multiply(matrix).elements, expected[i]); checks++;
  const color = new T.Color(); chunk.getColorAt(0, color);
  check(Math.abs(color.r - new T.Color().setHSL(i / 4, .5, .5).r) < 1e-7, 'Instance color survives partitioning');
});
const prop = new T.Group(), material = new T.MeshStandardMaterial();
for (let i = 0; i < 8; i++) { const part = new T.Mesh(new T.BoxGeometry(), material); part.position.x = i; prop.add(part); }
batchStaticProp(prop);
check(prop.children.length === 1 && prop.children[0].geometry.index.count === 8 * 36, 'Static prop batching retains all eight parts in one draw');
const grass = new T.BufferGeometry(); grass.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(24 * 3), 3)); grass.setIndex(Array.from({ length: 54 }, (_, i) => i % 24));
registerGrassDetail(grass);
const meadow = new T.InstancedMesh(grass, material, 1); meadow.setMatrixAt(0, new T.Matrix4()); meadow.computeBoundingSphere(); meadow.updateMatrixWorld(true);
const detail = new VegetationDetail([meadow]), camera = new T.PerspectiveCamera();
camera.position.set(0, 1, 10); detail.update(camera); check(meadow.geometry === grass, 'Nearby grass retains full geometry');
camera.position.z = 40; detail.update(camera); check(meadow.geometry.index.count === 18 && meadow.count === 1, 'Distant grass uses one third of the triangles and retains density');
camera.position.z = 16; detail.update(camera); check(meadow.geometry !== grass, 'Grass LOD retains hysteresis');
camera.position.z = 10; detail.update(camera); check(meadow.geometry === grass, 'Approaching restores curved blades');
detail.dispose(); check(meadow.geometry === grass, 'Disposal restores shared geometry before world teardown');
console.log(`${checks} rendering topology, placement, bounds and detail checks passed.`);

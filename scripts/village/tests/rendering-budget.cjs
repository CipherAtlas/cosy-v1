const assert = require('node:assert/strict');
const path = require('node:path');
const T = require('three');
const { geometryCells, instanceCells, batchStaticProp, instanceStaticProps } = require(path.join(process.argv[2], 'spatialRendering.js'));
const { registerGrassDetail, VegetationDetail } = require(path.join(process.argv[2], 'vegetationDetail.js'));
const { TownCropRendering } = require(path.join(process.argv[2], 'townCropRendering.js'));
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
const staticParent = new T.Group(), roots = [], staticGeometry = new T.BoxGeometry();
staticParent.position.set(9, 2, -4); staticParent.rotation.y = .3;
for (let i = 0; i < 4; i++) {
  const root = new T.Group(); root.position.set(i * 2, i, 3); root.rotation.y = i * .4;
  const part = new T.Mesh(staticGeometry, material); part.castShadow = i < 2; part.receiveShadow = true;
  root.add(part); staticParent.add(root); roots.push(root);
}
staticParent.updateMatrixWorld(true);
const staticTransforms = roots.map(root => root.children[0].matrixWorld.elements.slice());
instanceStaticProps(roots, staticParent); staticParent.updateMatrixWorld(true);
const instances = staticParent.children.filter(part => part.isInstancedMesh);
check(instances.length === 2, 'Static props batch together with separate shadow flags');
let instanceIndex = 0;
for (const batch of instances) for (let i = 0; i < batch.count; i++) {
  batch.getMatrixAt(i, matrix);
  const actual = batch.matrixWorld.clone().multiply(matrix).elements;
  check(actual.every((value, component) => Math.abs(value - staticTransforms[instanceIndex][component]) < 1e-6), 'Static world transforms survive instancing');
  instanceIndex++;
}
const unique = new T.Mesh(new T.BoxGeometry(), material); staticParent.add(unique);
const transparent = new T.Mesh(staticGeometry, new T.MeshStandardMaterial({ transparent: true })); staticParent.add(transparent);
instanceStaticProps([unique, transparent], staticParent);
check(unique.parent === staticParent && transparent.parent === staticParent, 'Unique and transparent meshes retain their original rendering');
const grass = new T.BufferGeometry(); grass.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(24 * 3), 3)); grass.setIndex(Array.from({ length: 54 }, (_, i) => i % 24));
registerGrassDetail(grass);
const meadow = new T.InstancedMesh(grass, material, 1); meadow.setMatrixAt(0, new T.Matrix4()); meadow.computeBoundingSphere(); meadow.updateMatrixWorld(true);
const detail = new VegetationDetail([meadow]), camera = new T.PerspectiveCamera();
camera.position.set(0, 1, 10); detail.update(camera); check(meadow.geometry === grass, 'Nearby grass retains full geometry');
camera.position.z = 40; detail.update(camera); check(meadow.geometry.index.count === 18 && meadow.count === 1, 'Distant grass uses one third of the triangles and retains density');
camera.position.z = 16; detail.update(camera); check(meadow.geometry !== grass, 'Grass LOD retains hysteresis');
camera.position.z = 10; detail.update(camera); check(meadow.geometry === grass, 'Approaching restores curved blades');
detail.dispose(); check(meadow.geometry === grass, 'Disposal restores shared geometry before world teardown');
const kit = new T.Group();
for (const name of ['Carrot', 'Radish', 'Mint', 'Sprout']) { const crop = new T.Mesh(new T.BoxGeometry(.2, 1, .2), material); crop.name = name; kit.add(crop); }
const rows = [0, 1].map(i => ({ id: `row-${i}`, asset: 'farm-row', visible: true, position: [i * 80, 2, -5], rotation: [0, 90, 0], scale: [2, 1.5, .8] }));
const farm = new TownCropRendering(rows, kit);
const beds = rows.map((row, i) => ({ id: row.id, crop: i ? 'mint' : 'carrot', plantedAt: 0, wateredAt: 0, growAt: 180000 }));
farm.update(beds, 90000);
const active = farm.group.children.filter(mesh => mesh.visible);
check(active.length === 2 && active.every(mesh => mesh.count === 28), 'Accepted farms retain 28 plants with separate bounds for each row');
active[0].getMatrixAt(0, matrix);
check(Math.abs(matrix.elements[12] + .228) < 1e-6 && Math.abs(matrix.elements[14] - 9.5) < 1e-6, 'Rotated/scaled farm plants retain their real positions');
check(Math.abs(new T.Vector3().setFromMatrixScale(matrix).y - 1.5 * .59) < 1e-6, 'Crop height follows the accepted halfway growth clock');
check(active[0].boundingSphere.center.distanceTo(active[1].boundingSphere.center) > 70, 'Distant rows have independent culling bounds');
farm.update([{ ...beds[0], wateredAt: null }, { ...beds[1], crop: null }], 180000);
check(farm.group.children.filter(mesh => mesh.visible).length === 1 && farm.group.children.find(mesh => mesh.visible).name.endsWith('sprout'), 'Unwatered and empty rows render only their accepted state');
farm.hide(); check(farm.group.children.every(mesh => !mesh.visible), 'Shared disconnect hides every crop row');
farm.dispose();
console.log(`${checks} rendering topology, placement, bounds and detail checks passed.`);

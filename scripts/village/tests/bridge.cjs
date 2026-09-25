const assert = require('node:assert/strict');
const path = require('node:path');
const T = require('three');
const build = process.argv[2];
const { buildBridge } = require(path.join(build, 'bridge.js'));
const { BRIDGE, bridgeHeight } = require(path.join(build, 'environment.js'));
const { VillageMovement } = require(path.join(build, 'movement.js'));
const colliders = [];
const bridge = buildBridge(new T.MeshStandardMaterial(), new T.MeshStandardMaterial(), colliders);
bridge.updateMatrixWorld(true);
const ray = new T.Raycaster();
for (let i = 0; i <= 48; i++) {
 const x = BRIDGE.x - BRIDGE.length / 2 + .02 + i / 48 * (BRIDGE.length - .04);
 for (const z of [BRIDGE.z - 1, BRIDGE.z, BRIDGE.z + 1]) {
  ray.set(new T.Vector3(x, 10, z), new T.Vector3(0, -1, 0));
  const hits = ray.intersectObject(bridge, true);
  assert(hits.length, 'Deck must be visible to a ray from above');
  assert(Math.abs(hits[0].point.y - bridgeHeight(x) - .012) < .003, 'Rendered paving must follow the walking surface');
  assert(hits[0].face.normal.y > 0, 'Paving must face upward');
 }
}
console.log('PASS full bridge width has upward-facing paving matching the physical arch');
ray.set(new T.Vector3(BRIDGE.x, -.3, BRIDGE.z), new T.Vector3(0, 1, 0));
const underside = ray.intersectObject(bridge, true)[0];
assert(underside);assert(Math.abs(underside.point.y - (bridgeHeight(BRIDGE.x) - .34)) < .005);
assert(underside.point.y > .7);
console.log('PASS solid deck has an arched underside with a clear water opening');
for (const direction of [-1, 1]) {
 const m = new VillageMovement(colliders, () => {});
 m.settle(BRIDGE.x - direction * (BRIDGE.length / 2 + .7), BRIDGE.z);
 for(let i=0;i<390;i++) {
  m.update(1/60,{x:direction,z:0,run:false,sprint:false,blocked:false});
  if(Math.abs(m.position.x-BRIDGE.x) <= BRIDGE.length/2) assert(Math.abs(m.position.y-bridgeHeight(m.position.x)) < .01);
 }
 assert(direction*(m.position.x-BRIDGE.x)>BRIDGE.length/2+.5,'Must reach the opposite bank');
 m.settle(BRIDGE.x,BRIDGE.z);m.jump();
 for(let i=0;i<70;i++)m.update(1/60,{x:0,z:direction,run:false,sprint:false,blocked:false});
 assert(Math.abs(m.position.z-BRIDGE.z)<BRIDGE.width/2-.25,'Parapet must contain a jump');
}
console.log('PASS bank-to-bank traversal in both directions and both parapet barriers');

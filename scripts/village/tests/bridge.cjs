const assert = require('node:assert/strict');
const path = require('node:path');
const T = require('three');
const build = process.argv[2];
const { buildBridge } = require(path.join(build, 'bridge.js'));
const { BRIDGE, bridgeHeight, onBridge } = require(path.join(build, 'environment.js'));
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
for (const offset of [-5.4, 0, 5.4]) {
 const m = new VillageMovement(colliders, () => {});
 m.settle(BRIDGE.x + offset, BRIDGE.z + 1.35);
 const spot = m.recoverySpot();
 assert(spot, 'Recovery must find nearby ground at the bridge');
 assert(Math.hypot(spot.x - m.position.x, spot.z - m.position.z) <= 12.01);
 assert(!onBridge(spot.x, spot.z), 'Recovery must leave the bridge');
 assert(m.clear(spot.x, spot.z), 'Recovery destination must pass movement collision');
 if (offset) assert(Math.sign(spot.x - BRIDGE.x) === Math.sign(offset), 'Recovery should keep the player on the same bank');
}
console.log('PASS bridge recovery reaches nearby clear ground without crossing banks');
// The reported pinch point is between the eastern end stone and the path lamp.
const approachColliders = [...colliders, { x: -4.5, z: 8.5, w: .4, d: .4, top: 3.5 }];
const northRailZ = BRIDGE.z + BRIDGE.width / 2 + .22;
ray.set(new T.Vector3(-5.5, 4, northRailZ), new T.Vector3(0, -1, 0));
assert(ray.intersectObject(bridge, true)[0].point.y < .3, 'The bank-side opening must be visible, not hidden behind a stone rail');
ray.set(new T.Vector3(-7, 4, northRailZ), new T.Vector3(0, -1, 0));
assert(ray.intersectObject(bridge, true)[0].point.y > 1, 'The remaining parapet must still protect the raised bridge');
const approach = new VillageMovement(approachColliders, () => {});
for (const x of [-5.8, -5.5, -5.2]) {
 approach.settle(x, 6);
 assert(approach.canWalkTo(x, 3.5), 'The bank-side gap must connect directly to the bridge deck');
 for (let i = 0; i < 180; i++) approach.update(1 / 60, { x: 0, z: -1, run: false, sprint: false, blocked: false });
 assert(approach.position.z < 3.5, 'Walking toward the bridge must pass through the opened approach');
 approach.settle(x, 3.5);
 assert(approach.canWalkTo(x, 6), 'The opening must also allow a safe exit to the bank');
}
approach.settle(-5.5, 6);
const landing = approach.recoverySpot();
assert(landing && landing.x > approach.position.x, 'The east-bank recovery must move away from the end stone');
assert(approach.clear(landing.x, landing.z) && !onBridge(landing.x, landing.z));
console.log('PASS pictured bridge-end gap is walkable in both directions and still has recovery');

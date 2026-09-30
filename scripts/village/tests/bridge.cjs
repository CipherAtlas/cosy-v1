const assert = require('node:assert/strict');
const path = require('node:path');
const T = require('three');
const build = process.argv[2];
const { buildBridge } = require(path.join(build, 'bridge.js'));
const { BRIDGE, bridgeHeight, onBridge, riverX } = require(path.join(build, 'environment.js'));
const { VillageMovement, MOVEMENT } = require(path.join(build, 'movement.js'));
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
for (const end of [-1, 1]) for (const side of [-1, 1]) {
 const x = BRIDGE.x + end * (BRIDGE.length / 2 - .17);
 const z = BRIDGE.z + side * (BRIDGE.width / 2 + .37);
 const m = new VillageMovement(colliders, () => {});
 m.settle(x, z); m.position.y = bridgeHeight(x) + .94;
 for (let i = 0; i < 120; i++) m.update(1 / 60, { x: end, z: 0, run: false, sprint: false, blocked: false });
 assert(end * (m.position.x - x) > 1, 'A spirit at an old bridge end post must be able to move onto its bank');
 assert(m.clear(m.position.x, m.position.z, m.position.y), 'Escaping an old post must leave the spirit clear');
}
console.log('PASS all four old bridge-end post traps allow escape');
for (const xOffset of [-5.5, -4.7, -4, 0, 4, 4.7, 5.5]) {
 for (const zOffset of [0, 1.35, 1.64, 1.66, 1.87, 2.05]) {
  const heights = [];
  for (const end of [-1, 1]) for (const side of [-1, 1]) {
   ray.set(new T.Vector3(BRIDGE.x + end * xOffset, 4, BRIDGE.z + side * zOffset), new T.Vector3(0, -1, 0));
   heights.push(ray.intersectObject(bridge, true)[0]?.point.y ?? -10);
  }
  assert(Math.max(...heights) - Math.min(...heights) < .003, 'Masonry must be symmetric across both bridge axes');
 }
}
console.log('PASS rendered deck, coping and posts are symmetric across both axes');
for (const end of [-1, 1]) for (const side of [-1, 1]) {
 const x = BRIDGE.x + end * (BRIDGE.length / 2 - .8);
 const m = new VillageMovement(approachColliders, () => {});
 for (const direction of [-1, 1]) {
  m.settle(x, BRIDGE.z + side * (direction === -1 ? 3 : .5));
  const targetZ = BRIDGE.z + side * (direction === -1 ? .5 : 3);
  assert(m.canWalkTo(x, targetZ), 'Every bank opening must allow direct entry and exit');
  for (let i = 0; i < 100; i++) m.update(1 / 60, { x: 0, z: side * direction, run: false, sprint: false, blocked: false });
  assert(side * direction * (m.position.z - targetZ) >= 0, 'Walking must pass through each bank opening');
 }
}
console.log('PASS all four bank-side openings allow entry and exit');
for (const fps of [30, 60, 120]) for (const end of [-1, 1]) for (const side of [-1, 1]) {
 const postX = BRIDGE.x + end * (BRIDGE.length / 2 - BRIDGE.approachOpening - .17);
 const wallZ = BRIDGE.z + side * (BRIDGE.width / 2 + .22);
 for (const y of [0, bridgeHeight(postX) + .94]) {
  const m = new VillageMovement(colliders, () => {});
  m.settle(postX, wallZ + side * .15); m.position.y = y;
  m.update(1 / fps, { x: end, z: 0, run: false, sprint: false, blocked: false });
  assert(m.clear(m.position.x, m.position.z, m.position.y), 'An overlapping or post-top spirit must be nudged clear in one frame');
  assert(Math.hypot(m.position.x - postX, m.position.z - wallZ - side * .15) < 1, 'The correction must stay local to the post');
  assert(Math.abs(m.position.x - riverX(m.position.z)) >= 3.6 || onBridge(m.position.x, m.position.z), 'Correction must never land in water');
  for (let i = 0; i < fps * 2; i++) m.update(1 / fps, { x: end, z: 0, run: false, sprint: false, blocked: false });
  assert(end * (m.position.x - postX) > 1, 'The corrected spirit must keep moving normally');
 }
 // Approach the protruding post diagonally, jumping repeatedly, then reverse away.
 const m = new VillageMovement(colliders, () => {});
 m.settle(BRIDGE.x + end * (BRIDGE.length / 2 + .7), BRIDGE.z + side * 3);
 for (let i = 0; i < fps * 2; i++) {
  if (i % fps === 0) m.jump();
  m.update(1 / fps, { x: -end / Math.SQRT2, z: -side / Math.SQRT2, run: false, sprint: true, blocked: false });
  assert(m.clear(m.position.x, m.position.z, m.position.y), 'Diagonal jumping must never embed the spirit in stone');
 }
 const before = { ...m.position };
 for (let i = 0; i < fps; i++) m.update(1 / fps, { x: end, z: 0, run: false, sprint: false, blocked: false });
 assert(end * (m.position.x - before.x) > 1, 'Reversing away from a corner must not stick');
}
console.log('PASS post overlap, post-top recovery and diagonal jumping stay safe at 30/60/120 fps');
for (const side of [-1, 1]) {
 const m = new VillageMovement(colliders, () => {});
 const z = BRIDGE.z + side * (BRIDGE.width / 2 + .22);
 m.settle(BRIDGE.x, z);
 m.update(1 / 60, { x: 0, z: 0, run: false, sprint: false, blocked: false });
 assert(m.clear(m.position.x, m.position.z, m.position.y), 'A mid-rail overlap must resolve onto the deck');
 assert(onBridge(m.position.x, m.position.z), 'Mid-rail correction must stay out of the river');
 assert(Math.hypot(m.position.x - BRIDGE.x, m.position.z - z) < 1, 'Correction must never teleport across the bridge');
}
console.log('PASS central rail overlap resolves locally onto the deck, away from water');
for (const side of [-1, 1]) {
 const m = new VillageMovement(colliders, () => {});
 m.settle(BRIDGE.x - 3, BRIDGE.z + side * (BRIDGE.width / 2 - MOVEMENT.radius - .35));
 for (let i = 0; i < 90; i++) m.update(1 / 60, { x: 1 / Math.SQRT2, z: side / Math.SQRT2, run: true, sprint: false, blocked: false });
 assert(m.position.x > BRIDGE.x, 'Movement into a rail must still slide along the crossing');
 assert(m.clear(m.position.x, m.position.z, m.position.y));
}
console.log('PASS rail contact preserves sliding along the crossing');

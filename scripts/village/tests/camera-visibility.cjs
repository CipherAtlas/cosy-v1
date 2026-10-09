const assert = require('node:assert/strict');
const path = require('node:path');
const T = require('three');
const build = process.argv[2];
if (!build) throw Error('Pass the compiled village directory.');
const { SceneSight } = require(path.join(build, 'sceneSight.js'));
const { ACTIVITY_STAGES } = require(path.join(build, 'sharedActors.js'));
const { bubbleLayout } = require(path.join(build, 'bubbleLayout.js'));
const { VillageCamera } = require(path.join(build, 'villageCamera.js'));
const sight = new SceneSight();
let checks = 0;
function test(name, check) { check(); checks++; console.log('PASS', name); }

test('Indexed rays agree with all-solid rays across diagonal grid boundaries', () => {
  const colliders = Array.from({ length: 72 }, (_, i) => ({ x: (i % 9) * 7 - 28, z: Math.floor(i / 9) * 7 - 28, w: 1.6, d: 2, bottom: 0, top: 5 }));
  sight.setColliders(colliders);
  for (let i = 0; i < 80; i++) {
    const start = new T.Vector3(-39 + i % 3, 2, -38 + i % 5), end = new T.Vector3(30 - i % 7, 3, 30 - i % 11);
    const ray = new T.Ray(start, end.clone().sub(start).normalize()), hit = new T.Vector3();
    let expected = start.distanceTo(end);
    for (const c of colliders) {
      const box = new T.Box3(new T.Vector3(c.x - c.w / 2, c.bottom, c.z - c.d / 2), new T.Vector3(c.x + c.w / 2, c.top, c.z + c.d / 2));
      if (!box.containsPoint(start) && ray.intersectBox(box, hit)) expected = Math.min(expected, hit.distanceTo(start));
    }
    assert(Math.abs(sight.clearance(start, end) - expected) < 1e-8);
  }
});

test('Exact mixed-direction boundary endpoints terminate without crossing past the target', () => {
  sight.setColliders([]);
  const start = new T.Vector3(4, 2, 12), end = new T.Vector3(8, 2, 0);
  assert.equal(sight.clearance(start, end), start.distanceTo(end));
  assert.equal(sight.clearance(end, start), start.distanceTo(end));
  assert.equal(sight.clearance(new T.Vector3(8, 2, 16), new T.Vector3(0, 2, 8)), Math.hypot(8, 8));
});

test('Sight lines hide scenery-covered labels but permit anchors inside their own prop', () => {
  sight.setColliders([{ x: 0, z: 3, w: 4, d: 1, top: 6 }]);
  assert.equal(sight.visible(new T.Vector3(0, 2, 7), new T.Vector3(0, 2, 0)), false);
  assert.equal(sight.visible(new T.Vector3(0, 2, 7), new T.Vector3(0, 2, 3)), false);
  sight.setColliders([{ x: 0, z: 3, w: .3, d: .3, top: 3 }]);
  assert.equal(sight.visible(new T.Vector3(0, 2, 7), new T.Vector3(0, 2, 3)), true);
});

test('Walking beside a rail chooses a clear viewpoint without a body-sized closeup', () => {
  const view = new VillageCamera(), player = new T.Group();
  view.walking({ player, yaw: 0, pitch: .22, distance: 5, seated: false,
    colliders: [{ x: 0, z: 1, w: 2, d: .2, top: 6 }] });
  assert(view.goal.distanceTo(view.look) >= 2.8);
  assert(Math.abs(view.goal.x) > 1);
});

test('Mounted stable view stays beneath the roof with a readable following distance', () => {
  const view = new VillageCamera(), player = new T.Group(); player.position.y = 1.35;
  view.walking({ player, yaw: 0, pitch: .35, distance: 6.5, seated: false, mounted: true,
    colliders: [], items: [{ asset: 'horse-stable', visible: true, position: [0, 0, 0], rotation: [0, 180, 0], scale: [1, 1, 1] }] });
  assert(view.goal.y < 3.28);
  assert(view.goal.distanceTo(view.look) >= 3.8);
});

test('Default pond view is solved even without a manual orbit', () => {
  const view = new VillageCamera();
  view.activity('breathe', { teaPan: 1, companionCount: 0, compactView: false, activityOrbit: { yaw: 0, pitch: 0 }, colliders: [],
    items: [{ id: 'willow', asset: 'willow-1', visible: true, position: [-15.9, 0, -3.5], scale: [1.3, 1.3, 1.3] }] });
  assert(view.goal.x < -21.1);
  assert(view.goal.distanceTo(view.look) >= 3.2);
});
test('Pond camera follows a relocated and rotated activity stage', () => {
  const original = ACTIVITY_STAGES.breathe;
  try {
    ACTIVITY_STAGES.breathe = { ...original, actor: [23, .24, -5.5], camera: [26.5, 3.7, 4], look: [19, .5, -3], yaw: Math.PI * 1.5 };
    const view = new VillageCamera();
    view.activity('breathe', { teaPan: 1, companionCount: 0, compactView: false, activityOrbit: { yaw: 0, pitch: 0 }, colliders: [] });
    assert(Math.abs(view.goal.x - 29) < 1e-8);
    assert(Math.abs(view.goal.z - 8.9) < 1e-8);
  } finally { ACTIVITY_STAGES.breathe = original; }
});

test('Explicit overlay frames preserve speaker priority as active layers change', () => {
  const host = { getBoundingClientRect: () => ({ left: 0, top: 0 }), closest: () => null, parentElement: null, querySelectorAll: () => [] };
  const layout = bubbleLayout(host), npc = {}, animal = {}, visitor = {};
  layout.beginFrame(); layout.begin(animal); layout.place(250, 220, 100, 60, 800, 600);
  layout.begin(visitor); layout.place(450, 220, 100, 60, 800, 600);
  layout.beginFrame(); layout.begin(npc);
  const speaking = layout.place(250, 220, 100, 60, 800, 600);
  assert.equal(speaking.left, 200);
  layout.begin(animal);
  const response = layout.place(250, 220, 100, 60, 800, 600);
  assert(response);
  assert(response.right < speaking.left || response.left > speaking.right || response.bottom < speaking.top || response.top > speaking.bottom);
  layout.begin(visitor);
  assert.equal(layout.place(250, 220, 100, 60, 800, 600, false), undefined);
});
console.log(`${checks} camera visibility checks passed.`);

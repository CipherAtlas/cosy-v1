// Exercise the production activity staging code without a browser or live shared world.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const T = require('three');

const root = path.resolve(__dirname, '../../..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'cosy-activity-seating-'));
try {
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(output, 'node_modules'), 'dir');
  execFileSync(path.join(root, 'node_modules/.bin/tsc'), [
    'features/village/activityScene.ts', 'features/village/places.ts',
    'features/village/focusCottageProps.ts', '--module', 'nodenext',
    '--moduleResolution', 'nodenext', '--target', 'ES2022', '--outDir', output,
    '--skipLibCheck', '--esModuleInterop',
  ], { cwd: root, stdio: 'pipe' });
  const { VillageActivities, ACTIVITY_STAGES } = require(path.join(output, 'activityScene.js'));
  const activities = new VillageActivities([]);
  let checks = 0;
  for (const [id, stage] of Object.entries(ACTIVITY_STAGES)) {
    const camera = new T.PerspectiveCamera(65, 1280 / 720, .1, 1000);
    camera.position.fromArray(stage.camera);
    camera.lookAt(new T.Vector3(...stage.look));
    camera.updateMatrixWorld();
    for (const slot of [null, 1, 2, 63, 1000]) {
      const player = new T.Group();
      activities.update(1, id, false, player, undefined, 1, slot);
      const distance = Math.hypot(player.position.x - stage.actor[0], player.position.z - stage.actor[2]);
      assert.ok(distance < .02, `${id}, visitor slot ${slot}: blob is ${distance.toFixed(2)} m from its authored activity position`);
      const projected = player.position.clone().add(new T.Vector3(0, 1, 0)).project(camera);
      assert.ok(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 && projected.z < 1,
        `${id}, visitor slot ${slot}: blob is outside the activity camera`);
      checks += 2;
    }
  }
  const chair = { x: 108.6, z: -.7 };
  assert.ok(Math.hypot(ACTIVITY_STAGES.focus.actor[0] - chair.x, ACTIVITY_STAGES.focus.actor[2] - chair.z) < .1,
    'Focus staging no longer lines up with the cottage chair');
  console.log(JSON.stringify({ pass: true, activities: Object.keys(ACTIVITY_STAGES).length, slots: 5, checks: checks + 1 }));
} finally {
  fs.rmSync(output, { recursive: true, force: true });
}

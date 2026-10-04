// Actual saved-layout geometry and player model, from both sides of every bench.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:3063');
    const checks = await page.evaluate(async () => {
      const { VillageEngine } = await import('/modules/features/village/VillageEngine.js');
      const T = await import('three');
      const noop = () => {};
      const engine = new VillageEngine(document.querySelector('#scene'), {
        progress: noop, ready: noop, near: noop, interact: noop, movement: noop,
        stats: noop, contact: noop, environment: noop, error: message => { throw Error(message); },
      });
      try {
        await engine.load(); engine.setBlocked(false); engine.renderer.setAnimationLoop(null);
        let now = performance.now();
        const checks = [];
        for (const bench of engine.world.benches) {
          // The bird asset's backrest is at local +Z; ordinary bench backrests are at -Z.
          const item = engine.world.authored.items.find(item => item.id === bench.id);
          const expected = item.rotation[1] * Math.PI / 180 + (bench.birdClearing ? Math.PI : 0);
          for (const approach of [-1, 1]) {
            engine.movement.settle(bench.x + Math.sin(expected) * 1.6 * approach,
              bench.z + Math.cos(expected) * 1.6 * approach);
            engine.frame(now += 50);
            engine.sit(bench.id); engine.frame(now += 50);
            if (engine.seatedBench?.id !== bench.id) throw Error(`${bench.id}: failed to sit`);
            engine.scene.updateMatrixWorld(true);
            const face = new T.Box3().setFromObject(engine.character.getObjectByName('SpiritFace')).getCenter(new T.Vector3());
            const forward = (face.x - engine.player.position.x) * Math.sin(expected)
              + (face.z - engine.player.position.z) * Math.cos(expected);
            if (forward < .2) throw Error(`${bench.id}: face points into backrest from approach ${approach}: forward=${forward}, expected=${expected}, heading=${engine.player.rotation.y}`);
            const heading = engine.getPlayerPose().heading;
            if (Math.abs(Math.atan2(Math.sin(heading - expected), Math.cos(heading - expected))) > .001)
              throw Error(`${bench.id}: published heading differs from bench front`);
            engine.stand(); engine.frame(now += 50);
            if (!engine.movement.clear(engine.movement.position.x, engine.movement.position.z))
              throw Error(`${bench.id}: standing exits into collision`);
            checks.push(`${bench.id}: approach ${approach}, face/heading/exit`);
          }
        }
        return checks;
      } finally { engine.dispose(); }
    });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ pass: true, checks }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

// Run against preview_qa.py with an existing Playwright installation.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:3054/');
    const checks = await page.evaluate(async () => {
      const { VillageEngine } = await import('/modules/features/village/VillageEngine.js');
      const near = [], seats = [];
      const engine = new VillageEngine(document.querySelector('#scene'), {
        progress: () => {}, ready: () => {}, near: id => near.push(id),
        nearBench: id => near.push(id), seat: id => seats.push(id),
        interact: () => {}, error: message => { throw Error(message); },
        stats: () => {}, movement: () => {}, contact: () => {}, environment: () => {},
      });
      try {
        await engine.load(); engine.setBlocked(false);
        const tick = () => engine.frame(performance.now());
        const benches = [];
        for (const bench of engine.world.benches) {
          const x = bench.x + Math.sin(bench.facing) * 1.35;
          const z = bench.z + Math.cos(bench.facing) * 1.35;
          engine.movement.settle(x, z); tick();
          if (engine.nearBench?.id !== bench.id) throw Error(`${bench.id}: Sit is not offered nearby`);
          engine.sit(bench.id); tick();
          if (engine.seatedBench?.id !== bench.id || Math.hypot(engine.player.position.x - bench.x, engine.player.position.z - bench.z) > .01)
            throw Error(`${bench.id}: player did not sit on the bench`);
          engine.onKeyDown(new KeyboardEvent('keydown', { key: 'e', bubbles: true })); tick();
          if (engine.seatedBench) throw Error(`${bench.id}: E did not stand up`);
          if (!engine.movement.clear(engine.movement.position.x, engine.movement.position.z))
            throw Error(`${bench.id}: standing exits into a collider`);
          benches.push(bench.id);
        }
        engine.movement.settle(-37, 4); tick();
        if (engine.near !== 'birds') throw Error('Bird clearing does not offer nearby scattering');
        if (engine.gardenState.crumbPouch) throw Error('Test expected no crumb pouch');
        if (!engine.gardenAction({ kind: 'feedBirds' }) || engine.gardenAction({ kind: 'feedBirds' }))
          throw Error('First scatter should work without a pouch; repeat should wait for the flock');
        return { benches, nearBirds: true, scatterWithoutPouch: true, seatEvents: seats.length, nearEvents: near.length };
      } finally { engine.dispose(); }
    });
    if (errors.length) throw Error(errors.join('\n'));
    console.log(JSON.stringify({ pass: true, ...checks }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

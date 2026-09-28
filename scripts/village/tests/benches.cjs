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
      const near = [], seats = [], full = [];
      const engine = new VillageEngine(document.querySelector('#scene'), {
        progress: () => {}, ready: () => {}, near: id => near.push(id),
        nearBench: id => near.push(id), seat: id => seats.push(id), seatFull: () => full.push(true),
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
          const point = offset => ({ x: bench.x + Math.cos(bench.facing) * offset, z: bench.z - Math.sin(bench.facing) * offset });
          const left = point(-.68), right = point(.68);
          engine.setRemoteVisitors([{ id: 'other', name: 'Other', color: '#a4d5ae', slot: 1, ...right, heading: bench.facing }]);
          engine.sit(bench.id); tick();
          if (engine.seatedBench?.id !== bench.id || Math.hypot(engine.player.position.x - left.x, engine.player.position.z - left.z) > .01)
            throw Error(`${bench.id}: player did not take the empty left seat`);
          if (Math.hypot(engine.player.position.x - right.x, engine.player.position.z - right.z) < 1.3)
            throw Error(`${bench.id}: visitors overlap on the bench`);
          engine.onKeyDown(new KeyboardEvent('keydown', { key: 'e', bubbles: true })); tick();
          if (engine.seatedBench) throw Error(`${bench.id}: E did not stand up`);
          if (!engine.movement.clear(engine.movement.position.x, engine.movement.position.z))
            throw Error(`${bench.id}: standing exits into a collider`);
          engine.setRemoteVisitors([{ id: 'other', name: 'Other', color: '#a4d5ae', slot: 1, ...left, heading: bench.facing }]);
          engine.sit(bench.id); tick();
          if (Math.hypot(engine.player.position.x - right.x, engine.player.position.z - right.z) > .01)
            throw Error(`${bench.id}: player did not take the empty right seat`);
          engine.stand(); tick();
          if (bench === engine.world.benches[0]) {
            engine.setRemoteVisitors([
              { id: 'other', name: 'Other', color: '#a4d5ae', slot: 1, ...left, heading: bench.facing },
              { id: 'third', name: 'Third', color: '#b0c8e3', slot: 2, ...right, heading: bench.facing },
            ]);
            engine.sit(bench.id);
            if (engine.seatedBench || full.length !== 1) throw Error('A full bench accepted a third visitor');
            engine.setRemoteVisitors([]);
            engine.setSharedIdentity(2, '#e6a5b0');
            engine.sit(bench.id); tick();
            engine.setRemoteVisitors([{ id: 'other', name: 'Other', color: '#a4d5ae', slot: 0, ...left, heading: bench.facing }]);
            tick();
            if (Math.hypot(engine.player.position.x - right.x, engine.player.position.z - right.z) > .01)
              throw Error('Simultaneous arrivals did not resolve to separate seats');
            engine.stand(); tick();
            engine.setRemoteVisitors([{ id: 'older-client', name: 'Older client', color: '#a4d5ae', slot: 3, x: bench.x, z: bench.z, heading: bench.facing }]);
            engine.sit(bench.id);
            if (engine.seatedBench || full.length !== 2) throw Error('A centered visitor from an older client was overlapped');
            engine.setRemoteVisitors([]);
            engine.sit(bench.id); tick();
            engine.setRemoteVisitors([{ id: 'older-client', name: 'Older client', color: '#a4d5ae', slot: 3, x: bench.x, z: bench.z, heading: bench.facing }]);
            if (engine.seatedBench || full.length !== 3) throw Error('A newly arrived older client was overlapped');
          }
          engine.setRemoteVisitors([]);
          benches.push(bench.id);
        }
        engine.movement.settle(-37, 4); tick();
        if (engine.near !== 'birds') throw Error('Bird clearing does not offer nearby scattering');
        if (engine.gardenState.crumbPouch) throw Error('Test expected no crumb pouch');
        if (!engine.gardenAction({ kind: 'feedBirds' }) || engine.gardenAction({ kind: 'feedBirds' }))
          throw Error('First scatter should work without a pouch; repeat should wait for the flock');
        engine.movement.settle(24.6, -2.7); tick();
        if (engine.near === 'garden') throw Error('Walking into the kitchen garden still offers a scene transition');
        return { benches, nearBirds: true, scatterWithoutPouch: true, noGardenTransition: true, simultaneousSeatResolved: true, olderClientProtected: true, seatEvents: seats.length, fullBenchNotices: full.length, nearEvents: near.length };
      } finally { engine.dispose(); }
    });
    if (errors.length) throw Error(errors.join('\n'));
    console.log(JSON.stringify({ pass: true, ...checks }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

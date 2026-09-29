// Run against preview_qa.py with an existing Playwright installation.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:3054/');
    const count = await page.evaluate(async () => {
      const { VillageEngine } = await import('/modules/features/village/VillageEngine.js');
      const noop = () => {};
      window.benchEngine = new VillageEngine(document.querySelector('#scene'), {
        progress: noop, ready: noop, near: noop, nearBench: noop, seat: noop,
        interact: noop, error: message => { throw Error(message); }, stats: noop,
        movement: noop, contact: noop, environment: noop,
      });
      await benchEngine.load();
      benchEngine.setBlocked(false);
      benchEngine.renderer.setAnimationLoop(null);
      return benchEngine.world.benches.length;
    });
    const position = (index, side) => page.evaluate(({ index, side }) => {
      const engine = window.benchEngine, bench = engine.world.benches[index];
      const frontX = Math.sin(bench.facing), frontZ = Math.cos(bench.facing);
      engine.movement.settle(bench.x + frontX * 1.65, bench.z + frontZ * 1.65);
      engine.frame(performance.now());
      if (engine.nearBench?.id !== bench.id) throw Error(`${bench.id}: not near bench`);
      engine.camera.position.set(bench.x + frontX * 2.9, bench.seatHeight + 1.8, bench.z + frontZ * 2.9);
      engine.camera.lookAt(bench.x, bench.seatHeight, bench.z);
      engine.camera.updateMatrixWorld();
      const seat = engine.seatPoint(bench, side);
      const target = engine.camera.position.clone().set(seat.x, bench.seatHeight - .12, seat.z).project(engine.camera);
      const rect = engine.renderer.domElement.getBoundingClientRect();
      const x = rect.left + (target.x + 1) * rect.width / 2, y = rect.top + (1 - target.y) * rect.height / 2;
      const picked = engine.pickBenchSeat(x, y);
      if (picked?.id !== bench.id || picked.index !== side)
        throw Error(`${bench.id}: projected side ${side} picked ${JSON.stringify(picked)} at ${x},${y}`);
      return { id: bench.id, x, y };
    }, { index, side });
    const seated = () => page.evaluate(() => {
      const engine = window.benchEngine;
      engine.frame(performance.now());
      return { id: engine.seatedBench?.id, index: engine.seatedIndex };
    });
    const visited = [];
    for (let index = 0; index < count; index++) {
      for (const side of [0, 1]) {
        const target = await position(index, side);
        await page.mouse.click(target.x, target.y);
        const result = await seated();
        if (result.id !== target.id || result.index !== side)
          throw Error(`${target.id}: clicking side ${side} selected ${JSON.stringify(result)}`);
        await page.evaluate(() => benchEngine.stand());
        visited.push(`${target.id}:${side}`);
      }
    }
    const touch = await position(0, 1);
    await page.touchscreen.tap(touch.x, touch.y);
    if ((await seated()).index !== 1) throw Error('Touch tap did not choose the tapped side');
    await page.evaluate(() => benchEngine.stand());
    await position(0, 1);
    await page.evaluate(() => {
      const engine = benchEngine, bench = engine.world.benches[0], seat = engine.seatPoint(bench, 1);
      engine.camera.lookAt(seat.x, bench.seatHeight - .12, seat.z);
      engine.camera.updateMatrixWorld();
    });
    await page.mouse.click(1080, 580);
    try {
      await page.waitForFunction(() => document.pointerLockElement === benchEngine.renderer.domElement, null, { timeout: 10000 });
    } catch (error) {
      console.error(await page.evaluate(() => ({ mode: benchEngine.mouseLook, pending: benchEngine.pointerLockPending,
        wants: benchEngine.wantsMouseLook, picked: benchEngine.pickBenchSeat(1080, 580) })));
      throw error;
    }
    await page.mouse.click(640, 360);
    if ((await seated()).index !== 1) throw Error('Pointer-locked center aim did not choose the aimed side');
    await page.evaluate(() => benchEngine.stand());
    const drag = await position(0, 0);
    await page.mouse.move(drag.x, drag.y);
    await page.mouse.down();
    await page.mouse.move(drag.x + 35, drag.y + 20, { steps: 4 });
    await page.mouse.up();
    if ((await seated()).id) throw Error('Dragging from a bench seated the player');
    if (errors.length) throw Error(errors.join('\n'));
    console.log(JSON.stringify({ pass: true, clickedSides: visited.length, benches: count, touch: true, pointerLock: true, dragDoesNotSit: true }));
    await page.evaluate(() => benchEngine.dispose());
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

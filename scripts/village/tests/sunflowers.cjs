// Run with preview_qa.py on QA_URL and an existing PLAYWRIGHT_PATH.
const { chromium, firefox } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const kind = process.argv[2] || 'chrome';
  const browser = await (kind === 'firefox' ? firefox : chromium).launch({
    headless: true, ...(kind === 'chrome' ? { channel: 'chrome' } : {}),
    ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
  });
  const errors = [], output = process.env.OUTPUT_DIR || '/tmp/cosy-sunflowers';
  fs.mkdirSync(output, { recursive: true });
  try {
    const page = await browser.newPage({ viewport: kind === 'firefox' ? null : { width: 1280, height: 720 } });
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:3041/');
    const result = await page.evaluate(async () => {
      const T = await import('three');
      const g = await import('/modules/features/village/garden.js');
      const { VillageEngine } = await import('/modules/features/village/VillageEngine.js');
      const checks = [], check = (ok, label) => { if (!ok) throw Error(label); checks.push(label); };
      const start = 1800000000000, bed = g.SUNFLOWER_BED;
      let state = g.freshGarden();
      for (const length of [5, 6]) {
        const old = { ...state, beds: state.beds.slice(0, length), carrots: 8, radishes: 3, mint: 2, daisies: 4, mintTea: 1, crumbPouch: true };
        delete old.sunflowers;
        const restored = g.readGarden(JSON.stringify(old), start);
        check(restored.beds.length === 7 && restored.beds[bed].crop === 'sunflower' && restored.sunflowers === 0, 'Older ' + length + '-bed save gains a ready sunflower row');
        check(restored.carrots === 8 && restored.radishes === 3 && restored.mint === 2 && restored.daisies === 4 && restored.mintTea === 1 && restored.crumbPouch, 'Older ' + length + '-bed save keeps its inventory');
      }
      state = g.gardenAction(state, { kind: 'harvest', bed }, start);
      check(state.sunflowers === 1 && state.beds[bed].stage === 'empty', 'Sunflower harvest enters stored inventory and empties the row');
      check(g.gardenAction(state, { kind: 'harvest', bed }, start) === state, 'An empty row cannot be harvested twice');
      check(!g.gardenActionAllowed(state, { kind: 'plant', bed, crop: 'carrot' }), 'Sunflower row keeps its crop');
      state = g.gardenAction(state, { kind: 'plant', bed, crop: 'sunflower' }, start);
      check(state.beds[bed].stage === 'sprout', 'Sunflowers can be replanted');
      state = g.gardenAction(state, { kind: 'water', bed }, start);
      check(state.beds[bed].wateredAt === start && state.beds[bed].stage === 'growing', 'Water once to begin saved sunflower growth');
      check(!g.gardenActionAllowed(state, { kind: 'harvest', bed }), 'Sunflowers cannot be harvested early');
      check(g.gardenAction(state, { kind: 'water', bed }, start + 1000) === state, 'Repeated water does not reset growth');
      check(g.growthProgress(state.beds[bed], start + 150000) === .5 && g.growthTimeLeft(state.beds[bed], start + 150000) === '2:30', 'Sunflower countdown and growth agree at halfway');
      check(g.growGarden(state, start + 299999).beds[bed].stage === 'growing', 'Five-minute boundary is respected');
      state = g.readGarden(JSON.stringify(state), start + 300000);
      check(state.beds[bed].stage === 'grown', 'Reload completes growth at five minutes');
      check(g.growGarden(state, start + 30 * 86400000).beds[bed].stage === 'grown', 'Ripe sunflowers wait indefinitely');
      state = g.gardenAction(state, { kind: 'harvest', bed }, start + 300000);
      check(state.sunflowers === 2, 'Successive harvests accumulate');
      state = g.gardenAction(state, { kind: 'gift', crop: 'sunflower' });
      check(state.sunflowers === 1 && state.mintTea === 0, 'Giving Luma a sunflower consumes one stored flower');
      const bad = g.readGarden(JSON.stringify({ ...state, sunflowers: -7, beds: [...state.beds.slice(0, bed), { crop: 'sunflower', stage: 'growing', wateredAt: 'bad' }] }));
      check(bad.sunflowers === 0 && bad.beds[bed].stage === 'sprout', 'Damaged sunflower values restore safely');
      check(g.nearbyGardenAction('basket', state).kind === 'basket', 'Basket is a nearby interaction');
      check(g.gardenAction(state, { kind: 'basket' }) === state, 'Viewing inventory never consumes or changes harvests');
      document.body.innerHTML = '<div id="scene" style="position:fixed;inset:0"></div>';
      const noop = () => {};
      window.engine = new VillageEngine(document.querySelector('#scene'), {
        progress: noop, ready: noop, near: noop, interact: noop, error: message => { throw Error(message); },
        stats: noop, movement: noop, contact: noop, environment: noop,
      });
      await engine.load(); engine.setQuality('low'); engine.setBlocked(false);
      const garden = engine.garden, matrix = new T.Matrix4(), rotation = new T.Quaternion(), position = new T.Vector3(), scale = new T.Vector3();
      const sun = engine.sun.position.clone().sub(engine.sun.target.position); sun.y = 0; sun.normalize();
      const sunflower = garden.beds[bed].sunflower;
      check(sunflower.count === 13, 'Original thirteen-sunflower row is retained');
      for (let i = 0; i < sunflower.count; i++) {
        sunflower.getMatrixAt(i, matrix); matrix.decompose(position, rotation, scale);
        check(new T.Vector3(0, 0, 1).applyQuaternion(rotation).dot(sun) > .9999, 'Sunflower ' + (i + 1) + ' faces the actual sunlight direction');
      }
      engine.setGarden(state);
      check(!sunflower.visible && !garden.beds[bed].sprout.visible, 'Harvested sunflower row is visibly empty');
      const growing = g.gardenAction(g.gardenAction(state, { kind: 'plant', bed, crop: 'sunflower' }), { kind: 'water', bed }, Date.now() - 150000);
      engine.setGarden(growing); garden.update(1, 5, false);
      check(sunflower.visible && garden.beds[bed].root.scale.y > .58 && garden.beds[bed].root.scale.y < .62, 'Growing sunflower row visibly scales with elapsed time');
      check(garden.clocks[bed].sprite.visible && garden.labels[bed].text === 'Sunflowers', 'Sunflower row has a named countdown');
      engine.setLanguage('ja'); check(garden.labels[bed].text === 'ひまわり', 'Sunflower sign is translated'); engine.setLanguage('en');
      engine.setGarden(g.freshGarden());
      let calls = [];
      engine.callbacks.gardenInteract = id => calls.push(id);
      for (const [x, z] of [[20.1, -11.65], [24.7, -11.65], [29.3, -11.65]]) {
        engine.movement.settle(x, z); engine.frame(performance.now());
        check(engine.nearGarden === 'bed-' + bed, 'Sunflower prompt covers row at ' + x);
        engine.renderer.domElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
        engine.renderer.domElement.dispatchEvent(new KeyboardEvent('keyup', { key: 'e', bubbles: true }));
      }
      check(calls.length === 3 && calls.every(id => id === 'bed-' + bed), 'E reaches sunflower harvest from both ends and the middle');
      engine.movement.settle(18.8, -3.2); engine.frame(performance.now());
      check(engine.nearGarden === 'basket', 'Basket prompt is reachable from the path');
      const basket = garden.group.getObjectByName('Harvest basket');
      check(basket && !engine.movement.clear(g.HARVEST_BASKET[0], g.HARVEST_BASKET[2]), 'Harvest basket has a matching collision footprint');
      for (const [x, z] of [[19.2, -4.5], [19.2, -3.2], [19.2, -2], [24.7, -2.7]]) check(engine.movement.clear(x, z), 'Walking path stays clear at ' + x + ', ' + z);
      const stocked = { ...g.freshGarden(), carrots: 3, radishes: 2, mint: 4, daisies: 5, sunflowers: 6 };
      engine.setGarden(stocked);
      check(garden.basketContents.every(item => item.root.visible), 'Each stored crop appears in the basket');
      engine.gardenAction({ kind: 'harvest', bed }); garden.update(0, garden.time + 1.59, false);
      check(Math.hypot(garden.harvest.position.x - g.HARVEST_BASKET[0], garden.harvest.position.z - g.HARVEST_BASKET[2]) < .15, 'Harvest animation arrives at the physical basket');
      garden.update(0, garden.time + 2, false);
      engine.travel('garden'); engine.renderer.setAnimationLoop(null);
      window.setShot = (position, look) => { const camera = engine.camera.clone(); camera.clearViewOffset(); camera.position.set(...position); camera.lookAt(...look); camera.updateMatrixWorld(); engine.renderer.render(engine.scene, camera); return engine.renderer.domElement.toDataURL("image/png"); };
      setShot([23.8, 3.1, -2.7], [17.3, .5, -3.2]);
      return { checks, count: checks.length };
    });
    
    fs.writeFileSync(path.join(output, 'basket-' + kind + '.png'), Buffer.from((await page.evaluate(() => setShot([23.8, 3.1, -2.7], [17.3, .5, -3.2]))).split(',')[1], 'base64'));
    fs.writeFileSync(path.join(output, 'sunflowers-' + kind + '.png'), Buffer.from((await page.evaluate(() => setShot([28.5, 3.2, -17], [24.7, .9, -12.7]))).split(',')[1], 'base64'));
    
    
    if (errors.length) throw Error(errors.join('\n'));
    const report = { ...result, browser: kind, version: browser.version(), errors, growthTiming: 'Injected timestamps; no real five-minute wait' };
    fs.writeFileSync(path.join(output, 'checks-' + kind + '.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

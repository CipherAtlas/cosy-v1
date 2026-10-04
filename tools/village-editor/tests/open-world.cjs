// Run with isolated --layouts-dir and --playable-file; never overwrites a user's design.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const url = process.env.STUDIO_URL || 'http://127.0.0.1:3048';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = []; page.on('pageerror', error => errors.push(String(error)));
    await page.goto(url); await page.waitForFunction(() => window.cosyStudio, null, { timeout: 90000 });
    const snapshot = () => page.evaluate(() => window.cosyStudio.snapshot());
    const original = (await snapshot()).layout;
    const trees = original.objects.filter(item => /^forest-\d+$/.test(item.asset));
    assert.equal(trees.length, 360); assert(trees.every(item => !item.locked));
    assert(!original.objects.some(item => item.asset === 'forest'));
    await page.getByRole('tab', { name: /Scene/ }).click();
    await page.getByRole('searchbox').fill('Distant tree 1');
    await page.locator('.scene-select').first().click();
    const selected = await page.evaluate(() => window.cosyStudio.selection()[0]);
    await page.locator('#delete').click();
    assert(!(await snapshot()).layout.objects.some(item => item.id === selected));
    await page.locator('#undo').click(); assert.deepEqual((await snapshot()).layout, original);
    await page.locator('#redo').click();
    const beforeFlat = (await snapshot()).layout;
    await page.locator('#sculpt-terrain').click();
    await page.locator('#flatten-world').click();
    const flat = (await snapshot()).layout;
    assert.equal(flat.terrain.base, 'flat'); assert.equal(flat.terrain.samples.length, 0); assert(flat.openWorld);
    assert(!flat.objects.some(item => /^(mountain-|island-)/.test(item.asset)));
    assert(flat.objects.some(item => item.asset === 'river')); assert(flat.objects.some(item => item.asset === 'pond'));
    assert(!flat.objects.some(item => item.asset === 'walkable-region'));
    assert(flat.objects.filter(item => item.asset === 'meadow-swings').every(item => Math.abs(item.position[1]) < .001));
    await page.locator('#undo').click(); assert.deepEqual((await snapshot()).layout, beforeFlat);
    await page.locator('#redo').click(); assert.deepEqual((await snapshot()).layout, flat);
    const result = await page.evaluate(async layout => {
      const T = await import('/three/build/three.module.js');
      const { projectWorldLayout } = await import('/modules/features/village/worldLayout.js');
      const { SceneLayout } = await import('/modules/features/village/sceneLayout.js');
      const { setAuthoredWorld, inWalkableWorld, landscapeHeight } = await import('/modules/features/village/environment.js');
      const { buildWorld } = await import('/modules/features/village/world.js');
      const authored = projectWorldLayout(layout); setAuthoredWorld(authored);
      const heights = [[70, 30], [150, 150], [-250, -180], [310, 300]].map(([x, z]) => landscapeHeight(x, z));
      const walkable = [[70, 30], [150, 150], [-250, -180], [310, 300]].map(([x, z]) => inWalkableWorld(x, z));
      const renderer = new T.WebGLRenderer();
      const world = await buildWorld(() => {}, renderer, undefined, authored);
      const forestCount = world.vegetation.filter(mesh => mesh.name.startsWith('Distant forest')).reduce((sum, mesh) => sum + mesh.count, 0);
      const emptyForest = { ...layout, objects: layout.objects.filter(item => !/^forest-\d+$/.test(item.asset)) };
      const emptyAuthored = projectWorldLayout(emptyForest); setAuthoredWorld(emptyAuthored);
      const emptyWorld = await buildWorld(() => {}, renderer, undefined, emptyAuthored);
      const emptyForestCount = emptyWorld.vegetation.filter(mesh => mesh.name.startsWith('Distant forest')).reduce((sum, mesh) => sum + mesh.count, 0);
      emptyWorld.dispose();
      const group = new T.Group(), walls = [], seats = [];
      const scene = new SceneLayout({ ...authored, items: [{ id: 'moved', asset: 'prop', visible: true, position: [20, 0, 0], rotation: [0, 0, 0], scale: [2, 1, 1] }] }, group, walls, seats);
      const prop = new T.Group(); prop.position.x = 5; prop.add(new T.Mesh(new T.BoxGeometry(2, 2, 2), new T.MeshBasicMaterial())); group.add(prop);
      walls.push({ x: 5, z: 0, w: 2, d: 2, top: 2 }); scene.capture('prop', 'Prop', 'Nature', [prop], [5, 0, 0]); scene.apply();
      const movedCollider = walls[0]; const retainsDynamicRoot = prop.parent === group;
      world.dispose(); renderer.dispose();
      return { heights, walkable, forestCount, emptyForestCount, movedCollider, retainsDynamicRoot };
    }, flat);
    assert.deepEqual(result.heights, [0, 0, 0, 0]); assert(result.walkable.every(Boolean));
    assert.equal(result.forestCount, 359); assert.equal(result.movedCollider.x, 20); assert.equal(result.movedCollider.w, 4); assert(result.retainsDynamicRoot);
    assert.equal(result.emptyForestCount, 0);
    await page.getByRole('button', { name: 'Save layout', exact: false }).click();
    await page.waitForFunction(() => window.cosyStudio.snapshot().fileId);
    const saved = await snapshot();
    assert.deepEqual((await (await page.request.get(`${url}/api/layouts/${saved.fileId}`)).json()).layout, saved.layout);
    const published = await (await page.request.get(`${url}/api/playable`)).json();
    const response = await page.request.post(`${url}/api/apply`, { data: saved.layout, headers: { Origin: url, 'If-Match': published.revision } });
    assert.equal(response.status(), 200, await response.text());
    await page.reload(); await page.waitForFunction(() => window.cosyStudio, null, { timeout: 90000 });
    assert.deepEqual((await snapshot()).layout, saved.layout);
    if (process.env.FLAT_LAYOUT_OUTPUT) { const tree = trees.find(item => item.id === selected); const delivery = { ...saved.layout, name: 'Flat open village', objects: [...saved.layout.objects, { ...tree, position: [tree.position[0], 0, tree.position[2]] }] }; fs.writeFileSync(process.env.FLAT_LAYOUT_OUTPUT, JSON.stringify(delivery, null, 2) + '\n'); }
    for (const width of [1280, 1024]) {
      await page.setViewportSize({ width, height: width === 1280 ? 800 : 700 });
      if (!(await page.locator('#terrain-tool').isVisible())) await page.locator('#sculpt-terrain').click();
      assert(await page.locator('#flatten-world').isVisible());
      await page.getByRole('tab', { name: 'Assets', exact: true }).click(); await page.getByRole('searchbox').fill('');
      await page.screenshot({ path: `/tmp/cosy-open-world-${width}.png` });
    }
    assert.deepEqual(errors, []);
    console.log('PASS individual distant-tree deletion, undo/redo, whole-map flatten, water preservation, distant walking, runtime tree deletion/collision parity, save/apply/reload and laptop layouts');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

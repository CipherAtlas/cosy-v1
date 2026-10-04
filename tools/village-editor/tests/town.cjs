// Run only with isolated --layouts-dir and --playable-file paths.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

(async () => {
  const url = process.env.EDITOR_URL || 'http://127.0.0.1:3049';
  const output = process.env.OUTPUT_DIR || '/tmp/cosy-town-editor';
  fs.mkdirSync(output, { recursive: true });
  const protectedFiles = [
    'public/village/world-layout.json',
    ...fs.readdirSync('tools/village-editor/presets').filter(name => name.endsWith('.json')).map(name => `tools/village-editor/presets/${name}`),
    ...fs.readdirSync('tools/village-editor/layouts').filter(name => name.endsWith('.json')).map(name => `tools/village-editor/layouts/${name}`),
  ];
  const hashes = () => Object.fromEntries(protectedFiles.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
  const before = hashes(), checks = [], errors = [], assets = [], placed = {};
  const check = (valid, label) => { assert(valid, label); checks.push(label); };
  const forageOnly = process.env.FORAGE_ONLY === '1';
  const forage = ['cow-highland-girl', 'forage-apple', 'forage-mushroom', 'apple-tree', 'mushroom-patch'];
  const wanted = forageOnly ? forage : ['horse-racetrack', 'horse-stable', 'farm-row', 'owl-feeding-perch', 'hay-bale', 'owl-brown', 'cow-highland', 'sheep', 'lamb', 'hedgehog', 'garden-fish', ...forage];
  let fileId, browser;
  const report = status => fs.writeFileSync(path.join(output, 'editor-checks.json'), JSON.stringify({ status, checks, errors, assets, placed, fileId, protectedBefore: before, protectedAfter: hashes() }, null, 2) + '\n');
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', error => errors.push(String(error)));
    const writes = []; page.on('request', request => { if (request.url().includes('/api/') && request.method() !== 'GET') writes.push(request.method()); });
    await page.goto(url); await page.waitForFunction(() => window.cosyStudio, null, { timeout: 120000 });
    if (process.env.MEADOW_THUMBNAIL_ONLY === '1') {
      const original = await page.evaluate(() => cosyStudio.snapshot());
      await page.locator('#search').fill('Meadow wildflowers');
      const card = page.locator('[data-asset="flower-meadow"]'); await card.waitFor();
      await page.waitForFunction(() => document.querySelector('[data-asset="flower-meadow"] img')?.src.startsWith('data:image'), null, { timeout: 120000 });
      const native = await page.evaluate(async () => {
        const T = await import('three'), { meadowFlowers, MEADOW_WIDTH } = await import('/modules/features/village/meadowVegetation.js');
        const { StudioView } = await import('/modules/tools/village-editor/view.js');
        const template = meadowFlowers([{ id: 'flower-meadow', asset: 'flower-meadow', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], visible: true }], () => 0);
        const snapshot = () => {
          const parts = []; template.traverse(node => { if (node.isInstancedMesh) parts.push({ count: node.count, matrices: Array.from(node.instanceMatrix.array), colors: node.instanceColor && Array.from(node.instanceColor.array) }); });
          return { parts, bounds: new T.Box3().setFromObject(template).getSize(new T.Vector3()).toArray() };
        };
        const before = snapshot(), asset = { id: 'flower-meadow', shelf: true, template };
        await StudioView.prototype.thumbnails.call({ model: { assets: new Map([[asset.id, asset]]) } }, () => {});
        const after = snapshot(), image = document.querySelector('[data-asset="flower-meadow"] img');
        const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0); const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let opaque = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 30) opaque++;
        return { width: MEADOW_WIDTH, counts: before.parts.map(part => part.count), bounds: before.bounds,
          nativeUnchanged: JSON.stringify(before) === JSON.stringify(after), previewMatchesSource: asset.thumbnail === image.src, opaque, src: image.src };
      });
      check(native.width === 48 && native.counts.every(count => count === 120) && native.nativeUnchanged, 'Native48m meadow dimensions,120 instances, matrices and colors survive thumbnail rendering unchanged');
      check(native.previewMatchesSource && native.opaque > 1500, 'Shelf shows the actual flower geometry in a legible representative cluster');
      fs.writeFileSync(path.join(output, 'flower-meadow-thumbnail.png'), Buffer.from(native.src.split(',')[1], 'base64')); delete native.src; assets.push(native);
      for (const viewport of [{ width: 1280, height: 800 }, { width: 1024, height: 700 }]) {
        await page.setViewportSize(viewport); await page.screenshot({ path: path.join(output, `flower-library-${viewport.width}.png`) });
        const box = await card.boundingBox(); check(box.width >= 44 && box.x >= 0 && box.x + box.width <= viewport.width, `Wildflower shelf card fits ${viewport.width}×${viewport.height}`);
      }
      assert.deepEqual(await page.evaluate(() => cosyStudio.snapshot()), original); checks.push('Read-only preview review leaves the working layout unchanged');
      check(writes.length === 0, 'Preview review sends no API writes'); assert.deepEqual(hashes(), before); checks.push('Protected layouts and active source remain byte-identical');
      check(errors.length === 0, 'Editor reports no application page errors'); report('passed'); console.log(`${checks.length} read-only meadow thumbnail checks passed.`); return;
    }
    // Resident route QA is separate; this working copy exercises reusable asset Apply.
    const fixture = await page.evaluate(() => cosyStudio.snapshot().layout); delete fixture.routes;
    await page.locator('#import-file').setInputFiles({ name: 'town-assets-only.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
    await page.waitForFunction(() => !cosyStudio.snapshot().layout.routes);
    const catalog = await page.evaluate(() => cosyStudio.assets());
    const townCategory = page.locator('#categories button').filter({ hasText: /^Town$/ });
    await townCategory.click();
    check(await page.locator('[data-asset="horse-racetrack"]').count() === 1, 'Town category exposes the horse circuit on the asset shelf');
    await page.locator('#scene-tab').click();
    check(await page.locator('#scene-list .scene-select').count() >= 18, 'Town category exposes existing circuit, stable, roost and farm rows in the Scene list');
    await page.locator('#categories button').filter({ hasText: /^All$/ }).click();
    await page.locator('#assets-tab').click(); await page.locator('#avoid-overlaps').uncheck();
    await page.getByRole('button', { name: 'Top down', exact: true }).click();
    for (const [index, id] of wanted.entries()) {
      const info = catalog.find(asset => asset.id === id); check(Boolean(info), `${id} retains its catalog identity`);
      await page.locator('#search').fill(info.name);
      const card = page.locator(`[data-asset="${id}"]`); await card.waitFor();
      await page.waitForFunction(id => document.querySelector(`[data-asset="${id}"] img`)?.src?.startsWith('data:image'), id, { timeout: 120000 });
      const preview = await card.locator('img').evaluate(image => {
        const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0); const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let opaque = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 30) opaque++;
        return { src: image.src, width: canvas.width, height: canvas.height, opaque };
      });
      check(preview.width === 240 && preview.height === 192 && preview.opaque > 100, `${id} has a nonempty rendered preview`);
      fs.writeFileSync(path.join(output, `editor-preview-${id}.png`), Buffer.from(preview.src.split(',')[1], 'base64'));
      const count = await page.evaluate(id => cosyStudio.snapshot().layout.objects.filter(item => item.asset === id).length, id);
      await card.click();
      const point = await page.evaluate(() => cosyStudio.screenPoint('terrain', [24, 0, 23]));
      const viewport = await page.locator('#viewport').boundingBox();
      check(point.x > viewport.x && point.x < viewport.x + viewport.width && point.y > viewport.y && point.y < viewport.y + viewport.height, `${id} placement target is in the real canvas`);
      await page.mouse.move(point.x, point.y); await page.mouse.click(point.x, point.y);
      await page.waitForFunction(id => cosyStudio.selection().some(selected => cosyStudio.snapshot().layout.objects.some(item => item.id === selected && item.asset === id)), id);
      await page.keyboard.press('Escape');
      check(await page.evaluate(({ id, count }) => cosyStudio.snapshot().layout.objects.filter(item => item.asset === id).length === count + 1, { id, count }), `${id} can be placed and selected from its shelf card`);
      const x = id === 'sheep' ? 160 : id === 'lamb' ? 162 : 120 + index * 6;
      const z = ['sheep', 'lamb'].includes(id) ? 130 : 120 + index * 3;
      for (const [field, value] of Object.entries({ 'position-0': String(x), 'position-1': '5', 'position-2': String(z), 'rotation-1': '35', 'scale-0': '1.2', 'object-name': `Town QA ${id}` })) {
        await page.locator(`#${field}`).fill(value); await page.locator(`#${field}`).press('Tab');
      }
      const item = await page.evaluate(() => cosyStudio.snapshot().layout.objects.find(item => item.id === cosyStudio.selection()[0]));
      check(item.position[0] === x && item.position[1] === 5 && item.position[2] === z && item.rotation[1] === 35 && item.scale.every(value => Math.abs(value - 1.2) < 1e-6), `${id} supports real position, Y rotation and uniform scale controls`);
      placed[id] = item.id; assets.push({ id, name: info.name, previewPixels: preview.opaque, position: item.position, rotation: item.rotation, scale: item.scale });
      await page.locator('#scene-tab').click(); await page.locator('#search').fill(`Town QA ${id}`);
      await page.locator('#scene-list .scene-select').filter({ hasText: `Town QA ${id}` }).click();
      check((await page.evaluate(() => cosyStudio.selection()))[0] === item.id, `${id} can be reselected from the Scene list`);
      console.log(`${id}: preview, placement, transforms and selection passed`);
      if (['cow-highland', 'cow-highland-girl', 'hedgehog', 'owl-brown', 'apple-tree', 'mushroom-patch'].includes(id)) {
        await page.locator('#focus-object').click(); await page.waitForTimeout(120);
        await page.screenshot({ path: path.join(output, `editor-${id}.png`) });
      }
      await page.locator('#home-view').click(); await page.getByRole('button', { name: 'Top down', exact: true }).click();
      await page.locator('#search').fill(''); await page.locator('#assets-tab').click();
    }
    if (!forageOnly) {
    await page.locator('#scene-tab').click(); await page.locator('#search').fill('Town QA farm-row');
    await page.locator('#scene-list .scene-select').filter({ hasText: /^Town QA farm-row$/ }).click();
    await page.locator('#rotation-0').fill('5'); await page.locator('#rotation-0').press('Tab');
    check(await page.evaluate(id => cosyStudio.snapshot().layout.objects.find(item => item.id === id).rotation[0] === 0, placed['farm-row']), 'Interactive farms refuse tilt with visible upright guidance');
    await page.locator('#search').fill('Town QA hay-bale');
    await page.locator('#scene-list .scene-select').filter({ hasText: /^Town QA hay-bale$/ }).click();
    await page.locator('#rotation-0').fill('5'); await page.locator('#rotation-0').press('Tab');
    check(await page.evaluate(id => cosyStudio.snapshot().layout.objects.find(item => item.id === id).rotation[0] === 5, placed['hay-bale']), 'Decorative hay keeps full rotation controls');
    await page.locator('#rotation-0').fill('0'); await page.locator('#rotation-0').press('Tab');
    }
    const tiltFixture = await page.evaluate(() => cosyStudio.snapshot().layout);
    for (const asset of wanted.filter(id => !['hay-bale', 'garden-fish', 'forage-apple', 'forage-mushroom'].includes(id))) {
      const invalid = structuredClone(tiltFixture); invalid.objects.find(item => item.asset === asset).rotation[2] = 5;
      const response = await page.request.post(`${url}/api/layouts/town-invalid-tilt`, { headers: { 'If-Match': 'new', Origin: url }, data: invalid });
      check(response.status() === 400 && (await response.json()).error.includes('upright'), `${asset} server save rejects unsupported tilt`);
    }
    const modelChecks = await page.evaluate(async () => {
      const T = await import('/three/build/three.module.js');
      const { loadTownAssetKit, townAssets } = await import('/modules/features/village/townAssets.js');
      const { applyTransform } = await import('/modules/tools/village-editor/model.js');
      const source = await loadTownAssetKit(), catalog = townAssets(source), models = {};
      for (const [id, name] of [['cow-highland', 'CowHighland'], ['cow-highland-girl', 'CowHighlandGirl'], ['sheep', 'Sheep'], ['lamb', 'Lamb'], ['hedgehog', 'Hedgehog'], ['owl-brown', 'OwlBrown']]) {
        const sculpture = source.getObjectByName(name), template = catalog.get(id).template;
        const placed = template.clone(true); applyTransform(placed, { position: [160, 5, 130], rotation: [0, 35, 0], scale: [1.2, 1.2, 1.2], visible: true });
        const originalSize = new T.Box3().setFromObject(template).getSize(new T.Vector3()), editedSize = new T.Box3().setFromObject(placed).getSize(new T.Vector3());
        let meshes = 0; sculpture.traverse(object => { if (object instanceof T.Mesh) meshes++; });
        models[id] = { root: sculpture.name, sourceScale: sculpture.scale.toArray(), height: originalSize.y, transformedHeight: editedSize.y, meshes,
          head: Boolean(sculpture.getObjectByName(id === 'owl-brown' ? 'OwlHead' : `${name}Head`)) };
      }
      return models;
    });
    check(Object.values(modelChecks).every(model => model.head && model.meshes <= 8), 'Real GLTF loader exposes every animal root, head joint and bounded render mesh count');
    check(Math.abs(modelChecks.lamb.height / modelChecks.sheep.height - .63) < .003, 'Lamb authoring template is 0.63 times the sheep height');
    check(Math.abs(modelChecks.lamb.transformedHeight / modelChecks.lamb.height - 1.2) < .001, 'Editable lamb pivot preserves authored size under rotation and scaling');
    check(Math.abs(modelChecks['cow-highland-girl'].height - modelChecks['cow-highland'].height) < .001, 'Flower cow keeps the same native cow height and named joints');
    const forageChecks = await page.evaluate(async () => {
      const T = await import('/three/build/three.module.js');
      const { loadTownAssetKit, townAssets } = await import('/modules/features/village/townAssets.js');
      const assets = townAssets(await loadTownAssetKit()), details = {};
      for (const id of ['forage-apple', 'forage-mushroom', 'apple-tree', 'mushroom-patch']) {
        const asset = assets.get(id), box = new T.Box3().setFromObject(asset.template);
        let draws = 0; asset.template.traverse(object => { if (object instanceof T.Mesh) draws++; });
        details[id] = { dimensions: box.getSize(new T.Vector3()).toArray(), bottom: box.min.y, draws, localColliders: asset.localColliders };
      }
      return details;
    });
    check(['forage-apple', 'forage-mushroom'].every(id => forageChecks[id].draws === 1 && forageChecks[id].dimensions.every(size => size > .2 && size < .3) && Math.abs(forageChecks[id].bottom) < .001), 'Original forage GLBs retain tiny native dimensions, floor pivots and one render draw each');
    check(forageChecks['apple-tree'].draws === 2 && forageChecks['mushroom-patch'].draws === 2, 'Fruit tree and mushroom patch reuse Blender props in bounded instanced draws');
    check(forageChecks['apple-tree'].localColliders.length === 1 && forageChecks['apple-tree'].localColliders[0].w === .42 && forageChecks['mushroom-patch'].localColliders.length === 0, 'Forage scenery keeps collection contacts clear with only a narrow tree-trunk collider');
    if (!forageOnly) {
    await page.locator('#scene-tab').click(); await page.locator('#search').fill('Town QA');
    await page.locator('#scene-list .scene-select').filter({ hasText: /^Town QA sheep$/ }).click();
    await page.locator('#scene-list .scene-select').filter({ hasText: /^Town QA lamb$/ }).click({ modifiers: ['Shift'] });
    await page.locator('#focus-object').click(); await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(output, 'editor-sheep-lamb.png') });
    }
    await page.locator('#layout-name').fill('Town asset QA 2026-10-04'); await page.locator('#layout-name').press('Tab');
    await page.locator('#save').click(); await page.waitForFunction(() => cosyStudio.snapshot().fileId);
    fileId = await page.evaluate(() => cosyStudio.snapshot().fileId);
    const saved = (await (await page.request.get(`${url}/api/layouts/${fileId}`)).json()).layout;
    for (const id of wanted) {
      const item = saved.objects.find(item => item.id === placed[id]);
      check(item.asset === id && item.rotation[1] === 35 && item.scale.every(value => Math.abs(value - 1.2) < 1e-6), `${id} identity and transform survive named file save`);
    }
    await page.reload(); await page.waitForFunction(() => window.cosyStudio, null, { timeout: 120000 });
    assert.deepEqual(await page.evaluate(() => cosyStudio.snapshot().layout), saved); checks.push('The complete working-copy layout survives an actual browser reload');
    await page.locator('#layouts').click(); await page.locator('#apply-game').click();
    await page.waitForFunction(() => document.querySelector('#layout-dialog').open === false);
    const applied = (await (await page.request.get(`${url}/api/playable`)).json()).layout;
    assert.deepEqual(applied, saved); checks.push('Apply accepts every tested town asset in the isolated playable file');
    for (const viewport of [{ width: 1280, height: 800 }, { width: 1024, height: 700 }]) {
      await page.setViewportSize(viewport); await page.locator('#assets-tab').click(); await page.locator('#search').fill('');
      await page.locator('#categories button').filter({ hasText: /^Town$/ }).click();
      const card = page.locator('[data-asset="horse-racetrack"]'); await card.waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('#asset-grid img')].every(image => image.src.startsWith('data:image')), null, { timeout: 120000 });
      const box = await page.evaluate(() => { const rect = document.querySelector('[data-asset="horse-racetrack"]').getBoundingClientRect(); return { x: rect.x, width: rect.width }; });
      check(box.width >= 44 && box.x >= 0 && box.x + box.width <= viewport.width, `Town shelf remains visible at ${viewport.width}×${viewport.height}`);
      await page.screenshot({ path: path.join(output, `editor-town-${viewport.width}.png`) });
    }
    assert.deepEqual(hashes(), before); checks.push('Five named designs, both protected presets and active layout remain byte-identical');
    check(errors.length === 0, 'Editor reports no application page errors');
    report('passed');
    const final = JSON.parse(fs.readFileSync(path.join(output, 'editor-checks.json'), 'utf8')); final.models = modelChecks; final.forage = forageChecks;
    fs.writeFileSync(path.join(output, 'editor-checks.json'), JSON.stringify(final, null, 2) + '\n');
    console.log(`${checks.length} town editor checks passed; ${protectedFiles.length} protected files unchanged.`);
  } catch (error) {
    errors.push(String(error)); report('failed'); throw error;
  } finally { if (browser) await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });

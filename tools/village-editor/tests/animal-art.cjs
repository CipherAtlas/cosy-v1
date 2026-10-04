// Use a studio with isolated --layouts-dir and --playable-file arguments.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

(async () => {
  const url = process.env.EDITOR_URL || 'http://127.0.0.1:3049';
  const output = process.env.OUTPUT_DIR || '/tmp/cosy-animal-art-review/evidence';
  fs.mkdirSync(output, { recursive: true });
  const protectedPaths = ['public/village/world-layout.json', ...['presets', 'layouts'].flatMap(dir => fs.readdirSync(`tools/village-editor/${dir}`).filter(p => p.endsWith('.json')).map(p => `tools/village-editor/${dir}/${p}`))];
  const hashes = () => Object.fromEntries(protectedPaths.map(p => [p, createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
  const before = hashes(), checks = [], errors = [], assets = [];
  const check = (condition, label) => { assert(condition, label); checks.push(label); };
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', e => { errors.push(String(e)); console.error(String(e)); });
    await page.goto(url); await page.waitForFunction(() => window.cosyStudio, null, { timeout: 120000 });
    console.log('Editor ready.');
    const fixture = await page.evaluate(() => cosyStudio.snapshot().layout); delete fixture.routes; fixture.name = 'Animal art fixture';
    fixture.objects = fixture.objects.filter(item => item.asset === 'terrain');
    await page.locator('#import-file').setInputFiles({ name: 'animal-art-review.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
    await page.waitForFunction(() => cosyStudio.snapshot().layout.name === 'Animal art fixture copy');
    const catalog = (await page.evaluate(() => cosyStudio.assets())).filter(a => a.id.startsWith('animal-'));
    check(catalog.length === 17, 'All seventeen animals appear in the editor catalog');
    await page.locator('#categories button').filter({ hasText: /^Animals$/ }).click();
    await page.locator('#assets-tab').click(); await page.locator('#avoid-overlaps').uncheck();
    await page.getByRole('button', { name: 'Top down', exact: true }).click();
    for (const [index, asset] of catalog.entries()) {
      await page.locator('#assets-tab').click(); await page.locator('#search').fill(asset.name);
      const card = page.locator(`[data-asset="${asset.id}"]`); await card.waitFor();
      await page.waitForFunction(id => document.querySelector(`[data-asset="${id}"] img`)?.src.startsWith('data:image'), asset.id, { timeout: 120000 });
      const preview = await card.locator('img').evaluate(image => {
        const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let filled = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 100) filled++;
        return { src: image.src, filled, width: canvas.width, height: canvas.height };
      });
      check(preview.width === 240 && preview.height === 192 && preview.filled > 100, `${asset.id}: rendered preview`);
      fs.writeFileSync(path.join(output, `${asset.id}-preview.png`), Buffer.from(preview.src.split(',')[1], 'base64'));
      await card.click();
      const point = await page.evaluate(() => cosyStudio.screenPoint('terrain', [24, 0, 23]));
      await page.mouse.click(point.x, point.y);
      await page.waitForFunction(id => cosyStudio.selection().some(selected => cosyStudio.snapshot().layout.objects.some(item => item.id === selected && item.asset === id)), asset.id);
      await page.keyboard.press('Escape');
      for (const [field, value] of Object.entries({ 'position-0': String(150 + index * 4), 'position-1': '3', 'position-2': '130', 'rotation-1': '35', 'scale-0': '1.2', 'object-name': `Animal review ${asset.id}` })) {
        await page.locator(`#${field}`).fill(value); await page.locator(`#${field}`).press('Tab');
      }
      const item = await page.evaluate(() => cosyStudio.snapshot().layout.objects.find(item => item.id === cosyStudio.selection()[0]));
      check(item.asset === asset.id && item.position[0] === 150 + index * 4 && item.position[1] === 3 && item.rotation[1] === 35 && item.scale.every(v => Math.abs(v - 1.2) < .0001), `${asset.id}: placement and transforms`);
      assets.push(item); console.log(`Placed ${asset.id}.`);
    }
    const modelProof = await page.evaluate(async () => {
      const T = await import('/three/build/three.module.js');
      const { loadAnimalArt } = await import('/modules/features/village/animalArt.js');
      const source = await loadAnimalArt(), proof = [];
      for (const [id, asset] of source) {
        let triangles = 0, meshes = 0, skins = 0, colored = true;
        asset.template.traverse(o => { if (o.isMesh) { meshes++; if (o.isSkinnedMesh) skins++; triangles += o.geometry.index.count / 3; colored = colored && Boolean(o.geometry.attributes.color); } });
        const bounds = new T.Box3().setFromObject(asset.template);
        proof.push({ id, triangles, meshes, skins, colored, floor: bounds.min.y, height: bounds.max.y });
      }
      const selective = await loadAnimalArt(new Set(['animal-cat']));
      const { addSupplementalLayout } = await import('/modules/features/village/placeableAssets.js');
      const material = new T.MeshStandardMaterial();
      const world = { authored: { sceneVersion: 1, items: [{ id: 'review-cat', asset: 'animal-cat', visible: true, position: [7, 3, 9], rotation: [0, 35, 0], scale: [1.2, 1.2, 1.2] }] }, gardenSurfaces: { ground: material, wood: material }, group: new T.Group(), colliders: [] };
      await addSupplementalLayout(world, new T.Group());
      const placed = world.group.children[0];
      return { proof, selective: [...selective.keys()], placed: placed && { count: world.group.children.length, position: placed.position.toArray(), scale: placed.scale.toArray() } };
    });
    check(modelProof.proof.every(a => a.meshes === 2 && a.skins === 2 && a.colored && Math.abs(a.floor) < .001), 'Three.js loads every GLB with two independent colored skins and a ground pivot');
    assert.deepEqual(modelProof.selective, ['animal-cat']); checks.push('Selective runtime loading returns only the requested animal');
    assert.deepEqual(modelProof.placed, { count: 1, position: [7, 3, 9], scale: [1.2, 1.2, 1.2] }); checks.push('A layout containing only new animal art renders with its saved transform');
    await page.locator('#layout-name').fill('Animal art review 2026-10-04'); await page.locator('#layout-name').press('Tab');
    await page.locator('#save').click(); await page.waitForFunction(() => cosyStudio.snapshot().fileId);
    const id = await page.evaluate(() => cosyStudio.snapshot().fileId);
    const saved = (await (await page.request.get(`${url}/api/layouts/${id}`)).json()).layout;
    for (const item of assets) assert.deepEqual(saved.objects.find(o => o.id === item.id), item);
    checks.push('All seventeen transforms survive named save');
    await page.reload(); await page.waitForFunction(() => window.cosyStudio, null, { timeout: 120000 });
    for (const item of assets) assert.deepEqual(await page.evaluate(id => cosyStudio.snapshot().layout.objects.find(o => o.id === id), item.id), item);
    checks.push('All seventeen transforms survive reload');
    for (const viewport of [{ width: 1280, height: 800 }, { width: 1024, height: 700 }]) {
      await page.setViewportSize(viewport); await page.locator('#assets-tab').click(); await page.locator('#search').fill('');
      await page.locator('#categories button').filter({ hasText: /^Animals$/ }).click();
      await page.waitForFunction(() => [...document.querySelectorAll('#asset-grid img')].every(img => img.src.startsWith('data:image')));
      const box = await page.evaluate(() => {
        const element = document.querySelector('[data-asset="animal-horse-bay"]');
        element.scrollIntoView({ block: 'nearest' });
        const r = element.getBoundingClientRect(); return { x: r.x, width: r.width };
      });
      check(box.width >= 44 && box.x >= 0 && box.x + box.width <= viewport.width, `Animal shelf fits ${viewport.width}×${viewport.height}`);
      await page.screenshot({ path: path.join(output, `editor-${viewport.width}.png`) });
    }
    assert.deepEqual(hashes(), before); checks.push('Playable layout, protected presets and existing named designs remain byte-identical');
    check(errors.length === 0, 'No editor application page errors');
    fs.writeFileSync(path.join(output, 'editor-checks.json'), JSON.stringify({ status: 'passed', checks, models: modelProof.proof, errors }, null, 2));
    console.log(`${checks.length} animal editor checks passed.`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });

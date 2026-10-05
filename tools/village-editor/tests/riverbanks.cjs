const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const url = process.env.EDITOR_URL || 'http://127.0.0.1:3040';
const output = process.env.OUTPUT_DIR || '/tmp/cosy-riverbanks';
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [], checks = [];
  const check = (ok, label) => { assert(ok, label); checks.push(label); console.log(label); };
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(url); await page.waitForFunction(() => window.cosyStudio, null, { timeout: 120000 });
    await page.locator('#search').fill('Small riverbank stone');
    const card = page.locator('[data-asset="riverbank-stone"]'); await card.waitFor();
    await page.waitForFunction(() => document.querySelector('[data-asset="riverbank-stone"] img')?.src.startsWith('data:image'), null, { timeout: 120000 });
    check(await card.locator('img').evaluate(image => image.naturalWidth === 240 && image.naturalHeight === 192), 'Small riverbank stone has a rendered Nature shelf preview');
    const result = await page.evaluate(async () => {
      const T = await import('/three/build/three.module.js');
      const { riverGeometry } = await import('/modules/features/village/riverGeometry.js');
      const { buildRiverbankStones, riverBanks, disposeRiverbankStones, makeRiverbankStone } = await import('/modules/features/village/riverbankStones.js');
      const { PlantingSurfaceMask } = await import('/modules/features/village/plantingClearance.js');
      const { LayoutScene, validateLayout } = await import('/modules/tools/village-editor/model.js');
      const material = new T.MeshStandardMaterial();
      const read = root => { const samples = [], matrix = new T.Matrix4(); root.traverse(mesh => { if (mesh instanceof T.InstancedMesh) for (let i = 0; i < mesh.count; i++) { mesh.getMatrixAt(i, matrix); samples.push({ position: new T.Vector3().setFromMatrixPosition(matrix), scale: new T.Vector3().setFromMatrixScale(matrix), id: mesh.userData.layoutId }); } }); return samples; };
      const reports = [];
      for (const width of [2, 6, 18]) {
        const group = new T.Group(), ribbon = new T.Mesh(riverGeometry([[0, 0], [5, -30], [-6, -60], [0, -110]], width), material); group.add(ribbon);
        if (width === 18) { ribbon.rotation.y = .7; ribbon.scale.set(1.5, 1, .8); ribbon.position.set(30, 3, 10); }
        const root = buildRiverbankStones(group, material, () => 0), samples = read(root), banks = riverBanks(ribbon);
        const distances = banks.map(bank => {
          let total = 0; const chain = bank.map((sample, i) => { if (i) total += sample.point.distanceTo(bank[i - 1].point); return { ...sample, distance: total }; });
          const covered = [];
          for (const sample of samples) {
            const near = chain.reduce((best, entry) => Math.hypot(entry.point.x - sample.position.x, entry.point.z - sample.position.z) < Math.hypot(best.point.x - sample.position.x, best.point.z - sample.position.z) ? entry : best);
            if (Math.hypot(near.point.x - sample.position.x, near.point.z - sample.position.z) < .7) covered.push(near.distance);
          }
          covered.sort((a, b) => a - b);
          return { length: total, first: covered[0], last: covered.at(-1), maxGap: Math.max(...covered.slice(1).map((d, i) => d - covered[i])) };
        });
        const repeat = buildRiverbankStones(group, material, () => 0);
        reports.push({ width, count: samples.length, distances, deterministic: JSON.stringify(read(repeat)) === JSON.stringify(samples), small: samples.every(sample => sample.scale.x <= .5 && sample.scale.y <= .38), elevated: width !== 18 || samples.every(sample => sample.position.y > 3) });
        disposeRiverbankStones(root); disposeRiverbankStones(repeat); ribbon.geometry.dispose();
      }
      const group = new T.Group(), ribbon = new T.Mesh(riverGeometry([[0, 0], [0, -80]], 6), material); group.add(ribbon);
      const paving = new T.Mesh(new T.PlaneGeometry(20, 4), material); paving.rotation.x = -Math.PI / 2; paving.position.z = -30; paving.geometry.userData.plantingSurface = 'paving'; group.add(paving);
      const junction = new T.Mesh(riverGeometry([[-20, -60], [20, -60]], 8), material); group.add(junction);
      const dressed = buildRiverbankStones(group, material, () => 0), samples = read(dressed), mask = new PlantingSurfaceMask(group, 'paving'), water = new PlantingSurfaceMask(group, 'water');
      const clearPaths = samples.every(sample => !mask.covers(sample.position.x, sample.position.z, sample.scale.x + .1));
      const openJunction = samples.every(sample => !water.covers(sample.position.x, sample.position.z));
      const hiddenGroup = new T.Group(); ribbon.visible = false; junction.visible = false; hiddenGroup.add(ribbon, junction);
      const hidden = read(buildRiverbankStones(hiddenGroup, material, () => 0)).length === 0;
      disposeRiverbankStones(dressed);
      const scene = new LayoutScene(); scene.world = { water: { material }, gardenSurfaces: { stone: material } };
      scene.assets.set('custom-river', { template: new T.Group() }); scene.assets.set('riverbank-stone', { template: makeRiverbankStone(material) });
      const layout = { version: 1, base: 'cosy-village-2026-09-27', sceneVersion: 1, name: 'Riverbank working copy', objects: [
        { id: 'test-river', asset: 'custom-river', name: 'Test river', position: [20, 2, 10], rotation: [0, 32, 0], scale: [1.2, 1, 1.2], visible: true, locked: false, path: { points: [[0, 0], [8, -20], [0, -50]], width: 4 } },
        { id: 'test-stone', asset: 'riverbank-stone', name: 'Small riverbank stone', position: [8, 1, 2], rotation: [0, 43, 0], scale: [.8, .9, 1.2], visible: true, locked: false },
      ] };
      scene.apply(layout); scene.conformPaths(() => 0);
      const before = read(scene.group).filter(sample => sample.id === 'test-river');
      layout.objects[0].path.width = 12; layout.objects[0].path.points[1] = [-8, -30]; layout.objects[0].position[0] += 25;
      scene.apply(layout); scene.conformPaths(() => 0);
      const after = read(scene.group).filter(sample => sample.id === 'test-river');
      const updates = before.length > 80 && after.length > 80 && JSON.stringify(before) !== JSON.stringify(after);
      const saved = validateLayout(JSON.parse(JSON.stringify(layout)), scene.assets); scene.apply(saved); scene.conformPaths(() => 0);
      const restored = JSON.stringify(read(scene.group).filter(sample => sample.id === 'test-river')) === JSON.stringify(after);
      const placed = scene.roots.get('test-stone');
      const transforms = placed.position.toArray().every((v, i) => v === saved.objects[1].position[i]) && placed.scale.toArray().every((v, i) => v === saved.objects[1].scale[i]) && Math.abs(placed.rotation.y - 43 * Math.PI / 180) < 1e-9;
      const tint = makeRiverbankStone(material).children[0].geometry.getAttribute('color');
      const whiteTint = Array.from(tint.array).every(value => value === 1);
      return { reports, clearPaths, openJunction, hidden, updates, restored, transforms, whiteTint, fixture: saved };
    });
    for (const report of result.reports) {
      check(report.count > 200 && report.distances.every(bank => bank.first < 1 && bank.length - bank.last < 1.3 && bank.maxGap < 1.9), `${report.width} m river has continuous rocks on both banks through its full length`);
      check(report.small && report.elevated && report.deterministic, `${report.width} m river keeps small, grounded, deterministic stones after transforms`);
    }
    check(result.clearPaths, 'All path and bridge paving crossings stay clear');
    check(result.openJunction, 'Joined waterways have no stone rows across open water');
    check(result.hidden, 'Hidden rivers produce no stones');
    check(result.updates, 'Editor width, bend and position changes regenerate bank rocks');
    check(result.restored && result.transforms, 'River dressing and independently placed stone transforms survive JSON save/reload');
    check(result.whiteTint, 'Limestone stones provide a white vertex tint for the shared architecture material');
    await page.locator('#search').fill('');
    await page.screenshot({ path: path.join(output, 'editor.png') });
    await page.locator('#import-file').setInputFiles({ name: 'riverbank-working-copy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(result.fixture)) });
    await page.waitForFunction(() => cosyStudio.snapshot().layout.objects.some(item => item.id === 'test-stone'));
    await page.locator('#save').click(); await page.waitForFunction(() => cosyStudio.snapshot().fileId);
    const saved = await page.evaluate(() => cosyStudio.snapshot());
    const disk = await (await page.request.get(`${url}/api/layouts/${saved.fileId}`)).json();
    check(JSON.stringify(disk.layout) === JSON.stringify(saved.layout), 'Named layout file persists the river and independent stone');
    await page.reload(); await page.waitForFunction(() => window.cosyStudio, null, { timeout: 120000 });
    check(JSON.stringify((await page.evaluate(() => cosyStudio.snapshot())).layout) === JSON.stringify(saved.layout), 'Browser reload restores the saved river and stone transforms');
    if (process.env.APPLY_TEST === '1') {
      const playable = await (await page.request.get(`${url}/api/playable`)).json();
      const response = await page.request.post(`${url}/api/apply`, { headers: { Origin: url, 'If-Match': playable.revision }, data: saved.layout });
      check(response.ok(), 'Apply accepts the Small riverbank stone in the isolated playable layout');
    }
    check(errors.length === 0, 'Editor has no page errors');
    fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ checks, result, errors }, null, 2));
    console.log(`${checks.length} riverbank checks passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });

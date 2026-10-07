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
    if (process.env.RIVERBANK_FIXTURE === '1') {
      const layout = { version: 1, base: 'cosy-village-2026-09-27', sceneVersion: 1, name: 'Riverbank regression', objects: [
        { id: 'fixture-river', asset: 'custom-river', name: 'River', visible: true, locked: false, position: [0,0,0], rotation: [0,0,0], scale: [1,1,1], path: { points: [[0,-10],[2,0],[0,10]], width: 4 } }
      ] };
      await page.route('**/api/presets/current-village', route => route.fulfill({ json: { layout } }));
      await page.route('**/api/presets/original-village', route => route.fulfill({ json: { layout } }));
      await page.route('**/api/playable', route => route.fulfill({ json: { layout, revision: 'fixture' } }));
    }
    await page.goto(url); await page.waitForFunction(() => window.cosyStudio, null, { timeout: Number(process.env.STUDIO_READY_TIMEOUT || 120000) });
    await page.locator('#search').fill('Small riverbank stone');
    const card = page.locator('[data-asset="riverbank-stone"]'); await card.waitFor();
    await page.waitForFunction(() => document.querySelector('[data-asset="riverbank-stone"] img')?.src.startsWith('data:image'), null, { timeout: Number(process.env.STUDIO_READY_TIMEOUT || 120000) });
    check(await card.locator('img').evaluate(image => image.naturalWidth === 240 && image.naturalHeight === 192), 'Small riverbank stone has a rendered Nature shelf preview');
    const result = await page.evaluate(async () => {
      const T = await import('/three/build/three.module.js');
      const { riverGeometry } = await import('/modules/features/village/riverGeometry.js');
      const { buildRiverbankStones, riverBanks, disposeRiverbankStones, makeRiverbankStone } = await import('/modules/features/village/riverbankStones.js');
      const { PlantingSurfaceMask } = await import('/modules/features/village/plantingClearance.js');
      const { LayoutScene, validateLayout } = await import('/modules/tools/village-editor/model.js');
      const material = new T.MeshStandardMaterial();
      const clippedGeometry = riverGeometry([[0, 0], [0, 20]], 4);
      for (let i = 0; i < clippedGeometry.attributes.uv.count; i++)
        if (clippedGeometry.attributes.uv.getX(i) > .5 && i > 40) clippedGeometry.attributes.uv.setX(i, .5);
      const clippedBanks = riverBanks(new T.Mesh(clippedGeometry, material));
      const independentBanks = clippedBanks[0].length !== clippedBanks[1].length && clippedBanks.every(bank => bank.every(sample => sample.outward.toArray().every(Number.isFinite) && sample.outward.length() > .99));
      clippedGeometry.dispose();
      const read = root => { const samples = [], matrix = new T.Matrix4(); root.traverse(mesh => { if (mesh instanceof T.InstancedMesh) for (let i = 0; i < mesh.count; i++) { mesh.getMatrixAt(i, matrix); samples.push({ position: new T.Vector3().setFromMatrixPosition(matrix), scale: new T.Vector3().setFromMatrixScale(matrix), id: mesh.userData.layoutId }); } }); return samples; };
      const reports = [];
      for (const width of [2, 6, 18]) {
        const group = new T.Group(), ribbon = new T.Mesh(riverGeometry([[0, 0], [5, -30], [-6, -60], [0, -110]], width), material); group.add(ribbon);
        if (width === 18) { ribbon.rotation.y = .7; ribbon.scale.set(1.5, 1, .8); ribbon.position.set(30, 3, 10); }
        const groundHeight = () => width === 18 ? 3 : 0;
        const colliders = [], root = buildRiverbankStones(group, material, groundHeight, colliders), samples = read(root), banks = riverBanks(ribbon);
        const distances = banks.map(bank => {
          let total = 0; const chain = bank.map((sample, i) => { if (i) total += sample.point.distanceTo(bank[i - 1].point); return { ...sample, distance: total }; });
          const covered = [];
          for (const sample of samples) {
            const near = chain.reduce((best, entry) => Math.hypot(entry.point.x - sample.position.x, entry.point.z - sample.position.z) < Math.hypot(best.point.x - sample.position.x, best.point.z - sample.position.z) ? entry : best);
            if (Math.hypot(near.point.x - sample.position.x, near.point.z - sample.position.z) < 1.5) covered.push(near.distance);
          }
          covered.sort((a, b) => a - b);
          return { length: total, first: covered[0], last: covered.at(-1), maxGap: Math.max(...covered.slice(1).map((d, i) => d - covered[i])) };
        });
        const repeat = buildRiverbankStones(group, material, groundHeight);
        reports.push({ width, solid: colliders.length === samples.length, count: samples.length, distances, deterministic: JSON.stringify(read(repeat)) === JSON.stringify(samples), small: samples.every(sample => sample.scale.x <= .5 && sample.scale.y <= .38), elevated: width !== 18 || samples.every(sample => sample.position.y > 3) });
        disposeRiverbankStones(root); disposeRiverbankStones(repeat); ribbon.geometry.dispose();
      }
      const group = new T.Group(), ribbon = new T.Mesh(riverGeometry([[0, 0], [0, -80]], 6), material); group.add(ribbon);
      const paving = new T.Mesh(new T.PlaneGeometry(20, 4), material); paving.rotation.x = -Math.PI / 2; paving.position.z = -30; paving.geometry.userData.plantingSurface = 'paving'; group.add(paving);
      const junction = new T.Mesh(riverGeometry([[-20, -60], [20, -60]], 8), material); group.add(junction);
      const dressed = buildRiverbankStones(group, material, () => 0), samples = read(dressed), mask = new PlantingSurfaceMask(group, 'paving'), water = new PlantingSurfaceMask(group, 'water');
      const clearPaths = samples.every(sample => !mask.covers(sample.position.x, sample.position.z, sample.scale.x));
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
      const sloped = new T.Group(), terrainGeometry = new T.PlaneGeometry(60, 60, 4, 4); terrainGeometry.rotateX(-Math.PI / 2);
      const terrainPositions = terrainGeometry.attributes.position;
      for (let i = 0; i < terrainPositions.count; i++) terrainPositions.setY(i, -.8 + terrainPositions.getX(i) * .06 + terrainPositions.getZ(i) * .02);
      terrainGeometry.computeVertexNormals();
      const terrain = new T.Mesh(terrainGeometry, material); terrain.name = 'Valley ground'; terrain.position.set(5, .3, 0); terrain.rotation.y = .4;
      sloped.add(terrain, new T.Mesh(riverGeometry([[0, -20], [2, 0], [0, 20]], 6), material));
      const grounded = buildRiverbankStones(sloped, material, () => 8), ray = new T.Raycaster(), vertex = new T.Vector3(), matrix = new T.Matrix4();
      let groundedCount = 0, minimumContact = Infinity, maximumContact = -Infinity;
      grounded.traverse(mesh => { if (!(mesh instanceof T.InstancedMesh)) return;
        for (let instance = 0; instance < mesh.count; instance++) {
          mesh.getMatrixAt(instance, matrix); let contact = Infinity;
          for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
            vertex.fromBufferAttribute(mesh.geometry.attributes.position, i).applyMatrix4(matrix);
            if (vertex.y > matrix.elements[13]) continue;
            ray.set(new T.Vector3(vertex.x, 20, vertex.z), new T.Vector3(0, -1, 0));
            const hit = ray.intersectObject(terrain)[0]; if (hit) contact = Math.min(contact, vertex.y - hit.point.y);
          }
          minimumContact = Math.min(minimumContact, contact); maximumContact = Math.max(maximumContact, contact); groundedCount++;
        }
      });
      const groundedSlopes = groundedCount > 70 && minimumContact >= -.101 && maximumContact <= -.054;
      disposeRiverbankStones(grounded); terrainGeometry.dispose();
      scene.assets.set('pond', { template: new T.Group() });
      const joinLayout = { ...saved, objects: [
        { ...saved.objects[0], position: [0,0,0], rotation: [0,0,0], scale: [1,1,1], path: { points: [[0,-30],[0,30]], width: 2.6 } },
        { ...saved.objects[1], id: 'join-pond', asset: 'pond', position: [0,0,0], rotation: [0,0,0], scale: [1,1,1] },
      ] };
      scene.apply(joinLayout); scene.conformPaths(() => 0);
      const joinGeometry = scene.roots.get('test-river').children[0].geometry, joinedPosition = joinGeometry.attributes.position;
      const joinedPondCut = Array.from({length:joinedPosition.count},(_,i)=>Math.hypot(joinedPosition.getX(i)/9,joinedPosition.getZ(i)/12)).every(radius=>radius>.999)
        && Math.max(...joinGeometry.attributes.waterJoin.array)>.99;
      joinLayout.objects[1].position[0] = 40;
      scene.apply(joinLayout); scene.conformPaths(() => 0);
      const fullPosition = scene.roots.get('test-river').children[0].geometry.attributes.position;
      const pondMoveRestores = Array.from({length:fullPosition.count},(_,i)=>Math.abs(fullPosition.getZ(i))).some(z=>z<1);
      const reloadedJoin = validateLayout(JSON.parse(JSON.stringify(joinLayout)), scene.assets);
      scene.apply(reloadedJoin); scene.conformPaths(() => 0);
      const restoredPosition = scene.roots.get('test-river').children[0].geometry.attributes.position;
      const joinReload = JSON.stringify(Array.from(restoredPosition.array))===JSON.stringify(Array.from(fullPosition.array));
      return { reports, clearPaths, openJunction, hidden, updates, restored, transforms, whiteTint, groundedSlopes, independentBanks,
        joinedPondCut, pondMoveRestores, joinReload,
        contact: { groundedCount, minimumContact, maximumContact }, fixture: saved };
    });
    for (const report of result.reports) {
      check(report.count > 200 && report.distances.every(bank => bank.first < 1 && bank.length - bank.last < 1.3 && bank.maxGap < 1.9), `${report.width} m river has continuous rocks on both banks through its full length`);
      check(report.solid, `${report.width} m transformed river registers collision for every visible stone`);
      check(report.small && report.elevated && report.deterministic, `${report.width} m river keeps small, grounded, deterministic stones after transforms`);
    }
    check(result.clearPaths, 'All path and bridge paving crossings stay clear');
    check(result.openJunction, 'Joined waterways have no stone rows across open water');
    check(result.hidden, 'Hidden rivers produce no stones');
    check(result.updates, 'Editor width, bend and position changes regenerate bank rocks');
    check(result.restored && result.transforms, 'River dressing and independently placed stone transforms survive JSON save/reload');
    check(result.whiteTint, 'Limestone stones provide a white vertex tint for the shared architecture material');
    check(result.groundedSlopes, 'Every rotated rock embeds 5.5–10 cm into the rendered transformed slope despite an incorrect original height callback');
    check(result.independentBanks, 'Clipped water joins support unequal bank samples without losing outward directions');
    check(result.joinedPondCut, 'Editor clips a stream at the pond rim and blends its surface state');
    check(result.pondMoveRestores && result.joinReload, 'Moving the pond restores the complete stream and JSON reload retains the new join');
    await page.locator('#search').fill('');
    await page.screenshot({ path: path.join(output, 'editor.png') });
    await page.locator('#import-file').setInputFiles({ name: 'riverbank-working-copy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(result.fixture)) });
    await page.waitForFunction(() => cosyStudio.snapshot().layout.objects.some(item => item.id === 'test-stone'));
    await page.locator('#save').click(); await page.waitForFunction(() => cosyStudio.snapshot().fileId);
    const saved = await page.evaluate(() => cosyStudio.snapshot());
    const disk = await (await page.request.get(`${url}/api/layouts/${saved.fileId}`)).json();
    check(JSON.stringify(disk.layout) === JSON.stringify(saved.layout), 'Named layout file persists the river and independent stone');
    await page.reload(); await page.waitForFunction(() => window.cosyStudio, null, { timeout: Number(process.env.STUDIO_READY_TIMEOUT || 120000) });
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

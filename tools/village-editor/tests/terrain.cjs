// Run with an isolated --layouts-dir and --playable-file.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const url = process.env.STUDIO_URL || 'http://127.0.0.1:3047';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = []; page.on('pageerror', error => errors.push(String(error)));
    await page.goto(url); await page.waitForFunction(() => window.cosyStudio, null, { timeout: 90000 });
    const result = await page.evaluate(async () => {
      const T = await import('/three/build/three.module.js');
      const terrain = await import('/modules/features/village/terrain.js');
      const { projectWorldLayout } = await import('/modules/features/village/worldLayout.js');
      const { setAuthoredWorld, floorHeight, inWalkableWorld } = await import('/modules/features/village/environment.js');
      const { VillageNavigation } = await import('/modules/features/village/navigation.js');
      const { VillageMovement } = await import('/modules/features/village/movement.js');
      const { StudioCollision } = await import('/modules/tools/village-editor/spatial.js');
      let raised = terrain.sculptTerrain(undefined, 70, 30, 12, 2, 'raise', 0);
      const before = terrain.sampleTerrainHeight(undefined, 70, 30), after = terrain.sampleTerrainHeight(raised, 70, 30);
      const lowered = terrain.sculptTerrain(raised, 70, 30, 12, 1, 'lower', 0);
      const flat = terrain.sculptTerrain(raised, 70, 30, 12, 1, 'flatten', 4);
      const smooth = terrain.sculptTerrain(raised, 70, 30, 12, 1, 'smooth', 0);
      const geometry = new T.PlaneGeometry(640, 640, 320, 320); geometry.rotateX(-Math.PI / 2);
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) positions.setY(i, terrain.sampleTerrainHeight(raised, positions.getX(i), positions.getZ(i)));
      const mesh = new T.Mesh(geometry, new T.MeshBasicMaterial({ side: T.DoubleSide })); mesh.updateMatrixWorld();
      let error = 0;
      for (const [x, z] of [[70.3, 30.4], [70.8, 30.6], [71.7, 31.5], [75.1, 33.7]]) {
        const ray = new T.Raycaster(new T.Vector3(x, 100, z), new T.Vector3(0, -1, 0));
        error = Math.max(error, Math.abs(ray.intersectObject(mesh)[0].point.y - terrain.sampleTerrainHeight(raised, x, z)));
      }
      let high = undefined;
      for (let i = 0; i < 3; i++) high = terrain.sculptTerrain(high, 70, 30, 12, 8, 'raise', 0);
      const hillGeometry = geometry.clone(), hillPositions = hillGeometry.attributes.position;
      for (let i = 0; i < hillPositions.count; i++) hillPositions.setY(i, terrain.sampleTerrainHeight(high, hillPositions.getX(i), hillPositions.getZ(i)));
      hillGeometry.computeBoundingSphere(); const hill = new T.Mesh(hillGeometry, mesh.material); hill.updateMatrixWorld();
      const hillRoot = new T.Group(); hillRoot.add(hill); hillRoot.updateMatrixWorld(true);
      const collision = new StudioCollision({ assets: new Map([['terrain', { surface: true, template: hillRoot }]]), roots: new Map([['terrain', hillRoot]]) });
      collision.refresh({ objects: [{ id: 'terrain', asset: 'terrain', visible: true, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }] });
      const origin = new T.Vector3(70, 45, 75), direction = new T.Vector3(70, 18, 30).sub(origin).normalize(), perspectiveRay = new T.Ray(origin, direction);
      const expected = new T.Raycaster(origin, direction).intersectObject(hill)[0].point;
      const pickError = collision.pickGround(perspectiveRay).distanceTo(expected); hillGeometry.dispose();
      const doc = window.cosyStudio.snapshot().layout;
      doc.terrain = raised;
      doc.objects.push({ id: 'terrain-expansion-test', asset: 'walkable-region', name: 'Meadow', position: [70, 0, 30], rotation: [0, 0, 0], scale: [2, 1, 2], visible: true, locked: false });
      setAuthoredWorld(projectWorldLayout(doc));
      const floor = floorHeight(70.3, 30.4), walkable = inWalkableWorld(70, 30), beyond = inWalkableWorld(321, 30);
      const plateau = [];
      for (let x = 240; x <= 312; x += 2) for (let z = 0; z <= 70; z += 2) plateau.push([x / 2, z / 2, 4 - terrain.baseLandscapeHeight(x, z)]);
      doc.terrain = { version: 1, cellSize: 2, samples: plateau };
      doc.objects.push({ id: 'long-meadow', asset: 'walkable-region', name: 'Long meadow', position: [160, 0, 30], rotation: [0, 0, 0], scale: [13, 1, 5], visible: true, locked: false });
      const authored = projectWorldLayout(doc); setAuthoredWorld(authored);
      const walls = [{ x: 280, z: 30, w: 2, d: 10, top: 20 }];
      const navigation = new VillageNavigation(walls, authored), from = [274, 30], to = [286, 30];
      const route = navigation.path(from, to), probe = new VillageMovement(walls, () => {});
      probe.settle(...from); const directBlocked = !probe.canWalkTo(...to);
      let previous = from, clearRoute = route.length > 1;
      for (const point of route) { probe.settle(...previous); clearRoute &&= probe.canWalkTo(...point); previous = point; }
      const huge = new VillageNavigation([], { ...authored, walkable: [{ id: 'huge', x: 0, z: 0, radiusX: 100000, radiusZ: 100000, yaw: 0 }] });
      const gridSize = huge.width * huge.height;
      setAuthoredWorld(projectWorldLayout(window.cosyStudio.snapshot().layout));
      geometry.dispose(); mesh.material.dispose();
      return { rise: after - before, fall: after - terrain.sampleTerrainHeight(lowered, 70, 30), flat: terrain.sampleTerrainHeight(flat, 70, 30), smooth: terrain.sampleTerrainHeight(smooth, 70, 30), after, error, floorError: Math.abs(floor - terrain.sampleTerrainHeight(raised, 70.3, 30.4)), walkable, beyond, protected: terrain.sculptTerrain(undefined, -11, 3, 3, 2, 'raise', 0).samples.length, route, clearRoute, directBlocked, gridSize, pickError };
    });
    assert(Math.abs(result.rise - 2) < .00001); assert(Math.abs(result.fall - 1) < .00001);
    assert(Math.abs(result.flat - 4) < .00001); assert(result.smooth < result.after);
    assert(result.error < .00001); assert(result.floorError < .00001); assert(result.walkable); assert(!result.beyond); assert.equal(result.protected, 0);
    assert(result.directBlocked); assert(result.clearRoute); assert.deepEqual(result.route.at(-1), [286, 30]); assert(result.gridSize <= 855 * 855);
    assert(result.pickError < .000001);
    console.log('PASS raise, lower, level, smooth, protected water, expanded walking and rendered triangle/floor parity');
    console.log('PASS navigation detours around a real obstacle at x280 beyond the former grid limit; huge authored areas stay within 855 squared cells');
    console.log('PASS perspective sculpt brush ray hits the actual high-hill mesh');
    await page.getByRole('button', { name: 'Top down', exact: true }).click();
    const point = await page.evaluate(() => window.cosyStudio.screenPoint('terrain', [24, 0, 23]));
    const snapshot = () => page.evaluate(() => window.cosyStudio.snapshot());
    const original = await snapshot();
    await page.locator('#sculpt-terrain').click();
    await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.mouse.move(point.x + 20, point.y + 10, { steps: 4 }); await page.mouse.up();
    const raised = await snapshot(); assert(raised.layout.terrain.samples.length > 0);
    await page.getByRole('button', { name: 'Undo', exact: true }).click(); assert.deepEqual((await snapshot()).layout, original.layout);
    await page.getByRole('button', { name: 'Redo', exact: true }).click(); assert.deepEqual((await snapshot()).layout, raised.layout);
    await page.keyboard.down('Alt'); await page.mouse.click(point.x, point.y); await page.keyboard.up('Alt');
    assert.equal(await page.locator('#terrain-mode').inputValue(), 'flatten');
    assert(Number(await page.locator('#terrain-height').inputValue()) > 0);
    await page.keyboard.press('Escape');
    await page.getByRole('searchbox').fill('riding horse');
    await page.getByRole('button', { name: 'Place Bay riding horse', exact: true }).click();
    await page.mouse.move(point.x, point.y); await page.mouse.click(point.x, point.y); await page.keyboard.press('Escape');
    const horses = (await snapshot()).layout.objects.filter(item => item.asset === 'horse-bay'); assert(horses.length > 0);
    await page.getByRole('button', { name: 'Save layout', exact: false }).click();
    await page.waitForFunction(() => window.cosyStudio.snapshot().fileId);
    const saved = await snapshot();
    const disk = await (await page.request.get(`${url}/api/layouts/${saved.fileId}`)).json(); assert.deepEqual(saved.layout, disk.layout);
    const published = await (await page.request.get(`${url}/api/playable`)).json();
    const response = await page.request.post(`${url}/api/apply`, { data: saved.layout, headers: { Origin: url, 'If-Match': published.revision } });
    assert.equal(response.status(), 200, await response.text());
    await page.reload(); await page.waitForFunction(() => window.cosyStudio, null, { timeout: 90000 });
    assert.deepEqual((await snapshot()).layout, saved.layout);
    for (const size of [{ width: 1280, height: 800 }, { width: 1024, height: 700 }]) {
      await page.setViewportSize(size); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); await page.screenshot({ path: `/tmp/cosy-terrain-${size.width}.png` });
      assert(await page.locator('#sculpt-terrain').isVisible());
    }
    assert.deepEqual(errors, []);
    console.log('PASS real editor stroke undo/redo, sampled level, horse placement, save/reload/apply, laptop/small-window captures and no page errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

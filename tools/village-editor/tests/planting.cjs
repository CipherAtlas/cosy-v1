// Read-only browser fixture: editor path moves must clear and restore original plant instances.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const errors = [], writes = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (r.url().includes('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(r.method())) writes.push(r.url()); });
    await page.goto(process.env.STUDIO_URL || 'http://127.0.0.1:3040');
    await page.waitForFunction(() => window.cosyStudio, null, { timeout: 120000 });
    const result = await page.evaluate(async () => {
      const T = await import('/three/build/three.module.js');
      const { LayoutScene } = await import('/modules/tools/village-editor/model.js');
      const { PlantingSurfaceMask, clearPavingBorders } = await import('/modules/features/village/plantingClearance.js');
      const { POND } = await import('/modules/features/village/environment.js');
      const checks = [], check = (ok, label) => { if (!ok) throw Error(label); checks.push(label); };
      const scene = new LayoutScene(); scene.world = { authored: {} };
      const geometry = new T.BoxGeometry(.24, .5, .24); geometry.translate(0, .25, 0);
      geometry.userData.groundPlant = true; geometry.userData.plantingSway = .16;
      const mesh = new T.InstancedMesh(geometry, new T.MeshBasicMaterial(), 2);
      mesh.setMatrixAt(0, new T.Matrix4()); mesh.setMatrixAt(1, new T.Matrix4().makeTranslation(2, 0, 0));
      const template = new T.Group(); template.add(mesh);
      scene.assets.set('meadow-grass', { template });
      const grass = template.clone(true); grass.userData.asset = 'meadow-grass';
      scene.roots.set('grass', grass); scene.group.add(grass);
      const paveGeo = new T.PlaneGeometry(2, 6); paveGeo.rotateX(-Math.PI / 2); paveGeo.userData.plantingSurface = 'paving';
      const paving = new T.Mesh(paveGeo, new T.MeshBasicMaterial()); scene.group.add(paving);
      const waterGeo = new T.CircleGeometry(1, 24); waterGeo.rotateX(-Math.PI / 2); waterGeo.userData.plantingSurface = 'water';
      const water = new T.Mesh(waterGeo, new T.MeshBasicMaterial()); water.position.set(8, 0, 0); scene.group.add(water);
      const alive = (object, index = 0) => { const m = new T.Matrix4(); object.getMatrixAt(index, m); return Math.abs(m.determinant()) > .001; };
      const refresh = () => {
        const mask = new PlantingSurfaceMask(scene.group), paved = new PlantingSurfaceMask(scene.group, 'paving');
        scene.conformGrass(() => 0, () => false, (x, z, r) => mask.covers(x, z, r));
        scene.conformBorderPlants((x, z, r) => mask.covers(x, z, r), (x, z, r) => paved.covers(x, z, r));
        clearPavingBorders(scene.group, paved);
      };
      refresh(); check(!alive(grass.children[0], 0) && alive(grass.children[0], 1), 'Native tagged paving clears blades while its green verge survives');
      paving.position.x = 5; refresh(); check(alive(grass.children[0], 0), 'Moving paving away restores original grass');
      paving.position.x = 0; refresh(); check(!alive(grass.children[0], 0), 'Undoing a paving move clears the original footprint again');
      paving.visible = false; refresh(); check(alive(grass.children[0], 0), 'Hidden paving does not erase planting');
      paving.visible = true; paving.position.x = 5; water.position.x = 2; refresh(); check(!alive(grass.children[0], 1), 'Actual moved pond water clears land grass');
      const bankTemplate = new T.Group(), bank = new T.InstancedMesh(geometry, mesh.material, 1);
      bank.userData.bankPlant = true; bank.setMatrixAt(0, new T.Matrix4().makeTranslation(2, 0, 0)); bankTemplate.add(bank);
      scene.assets.set('kitchen-garden', { template: bankTemplate });
      const shore = bankTemplate.clone(true); shore.userData.asset = 'kitchen-garden'; scene.roots.set('shore', shore); scene.group.add(shore);
      refresh(); check(alive(shore.children[0]), 'Bank plants may touch water naturally');
      paving.position.x = 2; refresh(); check(!alive(shore.children[0]), 'Bank plants cannot stand on paving');
      paving.position.x = 5; refresh(); check(alive(shore.children[0]), 'Moving a bank path away restores reeds');
      paving.position.set(10, 0, 10); paving.rotation.y = Math.PI / 4; paving.scale.set(2, 1, .5);
      const mask = new PlantingSurfaceMask(scene.group);
      const inside = new T.Vector3(.9, 0, 2).applyMatrix4(paving.matrixWorld);
      check(mask.covers(inside.x, inside.z), 'Rotated and nonuniformly scaled paving uses its rendered footprint');
      const outside = new T.Vector3(1.1, 0, 0).applyMatrix4(paving.matrixWorld);
      check(!mask.covers(outside.x, outside.z) && mask.covers(outside.x, outside.z, .25), 'Blade extent is cleared even when its root is just outside paving');
      const border = new T.Group(); border.userData.pavingBorder = true; border.userData.pavingBorderRadius = .15;
      border.position.copy(paving.position); scene.group.add(border); clearPavingBorders(scene.group);
      check(!border.visible, 'Whole border flower is removed together');
      paving.position.x = 20; clearPavingBorders(scene.group); check(border.visible, 'Border flower returns after paving moves away');
      const originalBank = new T.Matrix4().makeTranslation(POND.x + POND.rx * 1.05, 0, POND.z);
      bank.setMatrixAt(0, originalBank); bank.userData.pondPlant = true;
      const layout = { version: 1, base: 'cosy-village-2026-09-27', name: 'Pond fixture', sceneVersion: 1, objects: [
        { id: 'pond', asset: 'pond', name: 'Pond', visible: true, locked: false, position: [-50, 0, -40], rotation: [0, 30, 0], scale: [2, 1, 1.5] },
      ] };
      const mapped = new T.Matrix4(), distance = POND.rx * 1.05 * 2;
      scene.conformBorderPlants(() => false, () => false, layout); shore.children[0].getMatrixAt(0, mapped);
      check(Math.abs(mapped.elements[12] - (-50 + Math.cos(Math.PI / 6) * distance)) < .0001
        && Math.abs(mapped.elements[14] - (-40 - Math.sin(Math.PI / 6) * distance)) < .0001, 'Shore planting follows the saved pond position, rotation and scale');
      check(Math.abs(mapped.elements[0] - 1) < .0001, 'A larger pond keeps its reeds at their natural size');
      layout.objects[0].position[0] += 5; scene.conformBorderPlants(() => false, () => false, layout);
      const moved = new T.Matrix4(); shore.children[0].getMatrixAt(0, moved);
      check(Math.abs(moved.elements[12] - mapped.elements[12] - 5) < .0001, 'Repeated pond edits map original coordinates without accumulating transforms');
      bank.getMatrixAt(0, mapped); check(mapped.elements.every((n, i) => Math.abs(n - originalBank.elements[i]) < .00001), 'Pond edits preserve the original asset matrices');
      return { pass: true, checks, scope: 'Actual editor methods with isolated in-memory geometry; no layout or browser-draft writes.' };
    });
    assert.deepEqual(errors, []); assert.deepEqual(writes, []);
    result.errors = errors; result.apiWrites = writes;
    if (process.env.OUTPUT_FILE) fs.writeFileSync(process.env.OUTPUT_FILE, JSON.stringify(result, null, 2) + '\n');
    console.log(`${result.checks.length} editor planting checks passed.`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

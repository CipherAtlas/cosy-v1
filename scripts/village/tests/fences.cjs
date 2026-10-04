// Real Chrome imports production/editor modules; all test placements remain in memory.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const url = process.env.STUDIO_URL || 'http://127.0.0.1:3047';
const output = process.env.OUTPUT_DIR || '/private/tmp/cosy-fence-proof';
const layoutBytes = fs.readFileSync('public/village/world-layout.json');
const layout = JSON.parse(layoutBytes), physics = JSON.parse(fs.readFileSync('worker/world-physics.json'));
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = []; page.on('pageerror', error => errors.push(String(error)));
    await page.goto(url); await page.waitForFunction(() => window.cosyStudio, null, { timeout: 90000 });
    assert.equal(physics.layoutHash, createHash('sha256').update(layoutBytes).digest('hex'), 'Use physics exported from the current engine/layout');
    const result = await page.evaluate(async ({ layout, physics }) => {
      const T = await import('/three/build/three.module.js');
      const { buildWorld } = await import('/modules/features/village/world.js');
      const { fenceGeometry, conformFenceGeometry, fenceCollisionBoxes } = await import('/modules/features/village/fenceGeometry.js');
      const { projectWorldLayout, RESIDENT_IDS } = await import('/modules/features/village/worldLayout.js');
      const { RESIDENT_ROUTES } = await import('/modules/features/village/sharedActors.js');
      const { trackPoint } = await import('/modules/features/village/townShared.js');
      const { landscapeHeight, floorHeight, roadX, setAuthoredWorld } = await import('/modules/features/village/environment.js');
      const { VillageMovement } = await import('/modules/features/village/movement.js');
      const { VillageNavigation } = await import('/modules/features/village/navigation.js');
      const { LayoutScene } = await import('/modules/tools/village-editor/model.js');
      const { StudioCollision } = await import('/modules/tools/village-editor/spatial.js');
      const checks = [];
      const check = (condition, label) => { if (!condition) throw Error(label); checks.push(label); };
      const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setSize(1280, 800);
      const authored = projectWorldLayout(layout), world = await buildWorld(() => {}, renderer, undefined, authored);
      const catalog = new Set(physics.colliders.map(collider => JSON.stringify(collider)));
      check(world.colliders.every(collider => catalog.has(JSON.stringify(collider))), 'Every rendered base-world fence collider is present in the exported Worker catalog');
      const movement = new VillageMovement(physics.colliders, () => {});
      for (const item of layout.objects.filter(item => item.visible && /^fence-[-1]+-\d+$/.test(item.asset))) {
        const z = Number(item.asset.match(/-(\d+)$/)[1]) / 10;
        const x = item.position[0] + (roadX(z + 2.4) - roadX(z)) / 2;
        check(!movement.clear(x, item.position[2]), `Legacy rails block crossing: ${item.id}`);
      }
      movement.settle(roadX(16), 16);
      check(movement.canWalkTo(roadX(42), 42), 'Existing arrival road remains open between both fence runs');
      for (const fence of authored.fences) {
        const blocked = fence.points.slice(1).every((b, i) => [.2, .5, .8].every(t => {
          const a = fence.points[i]; return !movement.clear(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
        }));
        check(blocked, `Every authored fence segment blocks walking: ${fence.id}`);
      }
      for (const farm of [1, 2, 3]) {
        const west = authored.fences.find(fence => fence.id === `farm-${farm}-fence-west`);
        const east = authored.fences.find(fence => fence.id === `farm-${farm}-fence-east`);
        const end = west.points.at(-1);
        for (const x of [end[0] + .55, east.points.at(-1)[0] - .55]) {
          movement.settle(x, end[1] + 3);
          check(movement.canWalkTo(x, end[1] - 1), `Farm ${farm} entrance side aisle at ${x} remains open beside the real crop rows`);
        }
      }
      const pasture = authored.fences.find(fence => fence.id === 'town-pasture-fence');
      const a = pasture.points[0], b = pasture.points.at(-1), entrance = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      movement.settle(entrance[0], entrance[1] - 3);
      check(movement.canWalkTo(entrance[0], entrance[1] + 3), 'Pasture entrance remains open across its terrain slope');
      const track = authored.items.find(item => item.visible && item.asset === 'horse-racetrack');
      check(Array.from({ length: 80 }, (_, i) => trackPoint(track, i / 80 * Math.PI * 2)).every(point => movement.clear(...point)), 'Racecourse walking ribbon remains clear');
      const horseClear = (x, z, heading) => [-.65, 0, .65].every(along => [-.25, .25].every(side => {
        const px = x + Math.sin(heading) * along + Math.cos(heading) * side, pz = z + Math.cos(heading) * along - Math.sin(heading) * side;
        return movement.clear(px, pz) && movement.clear(px, pz, floorHeight(x, z) + 1) && Math.abs(floorHeight(px, pz) - floorHeight(x, z)) <= .55;
      }));
      check(Array.from({ length: 80 }, (_, i) => { const angle = i / 80 * Math.PI * 2, point = trackPoint(track, angle), next = trackPoint(track, angle + .01); return horseClear(...point, Math.atan2(next[0] - point[0], next[1] - point[1])); }).every(Boolean), 'Entire horse body fits the race ribbon beside its existing wooden rails');
      check(Array.from({ length: 41 }, (_, i) => horseClear(85, 37 - i * .1, Math.PI)).every(Boolean), 'Stable approach and south racecourse gate admit the whole horse');
      const navigation = new VillageNavigation(physics.colliders, authored);
      for (const [index, id] of RESIDENT_IDS.entries()) {
        const points = authored.routes[id]?.points ?? RESIDENT_ROUTES[index];
        for (let i = 0; i < points.length; i++) {
          movement.settle(...points[i]); const target = points[(i + 1) % points.length], route = navigation.path(points[i], target);
          const end = route.at(-1), clear = route.every(point => { const pass = movement.canWalkTo(...point); movement.settle(...point); return pass; });
          check(clear && end && Math.hypot(end[0] - target[0], end[1] - target[1]) < .05, `Resident route avoids physical fences: ${id} leg ${i + 1}`);
        }
      }
      const points = [[-4, 0], [0, 0], [4, 4], [4, 8]], ground = (x, z) => 1 + (x - 130) * .06 + (z - 110) * .035;
      const source = fenceGeometry(points, 1.3), root = new T.Group(); root.position.set(130, 1, 110); root.rotation.y = .61; root.scale.set(1.4, 1.2, .8);
      const mesh = new T.Mesh(source, new T.MeshStandardMaterial()); root.add(mesh); root.userData = { asset: 'fence-line', path: { points, width: 1.3 } }; root.updateMatrixWorld(true);
      const model = new LayoutScene(); model.assets.set('fence-line', { id: 'fence-line', template: root, solid: true }); model.roots.set('bend', root);
      model.conformPaths(ground);
      const expected = conformFenceGeometry(source, root.matrixWorld, ground), boxes = fenceCollisionBoxes(mesh.geometry, mesh.matrixWorld), bounds = fenceCollisionBoxes(expected, root.matrixWorld);
      check(boxes.every((box, i) => box.min.distanceTo(bounds[i].min) < 1e-6 && box.max.distanceTo(bounds[i].max) < 1e-6), 'Editor and runtime use identical rotated, scaled terrain bounds');
      const vertices = mesh.geometry.attributes.position;
      check(Array.from({ length: vertices.count }, (_, i) => new T.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld)).every(point => boxes.some(box => box.containsPoint(point))), 'Collision bounds cover all rounded wood including caps');
      const item = { id: 'bend', asset: 'fence-line', visible: true, position: root.position.toArray(), rotation: [0, T.MathUtils.radToDeg(root.rotation.y), 0], scale: root.scale.toArray(), path: { points, width: 1.3 } };
      const collision = new StudioCollision(model); collision.refresh({ objects: [item] });
      const colliders = boxes.map(box => { const center = box.getCenter(new T.Vector3()), size = box.getSize(new T.Vector3()); return { x: center.x, z: center.z, w: size.x, d: size.z, bottom: box.min.y, top: box.max.y }; });
      const probe = new VillageMovement(colliders, () => {}), worldPoint = (x, z) => new T.Vector3(x, 0, z).applyMatrix4(root.matrixWorld);
      const onRail = worldPoint(2, 2), gap = worldPoint(0, 5);
      check(!probe.clear(onRail.x, onRail.z, ground(onRail.x, onRail.z)) && !collision.playerClear(onRail.x, onRail.z, ground(onRail.x, onRail.z)), 'Rotated diagonal rail blocks both collision engines');
      check(probe.clear(gap.x, gap.z, ground(gap.x, gap.z)) && collision.playerClear(gap.x, gap.z, ground(gap.x, gap.z)), 'Inside of rotated bend remains clear in both engines');
      const post = mesh.geometry.userData.fencePieces.find(piece => piece.kind === 'post');
      const base = new T.Vector3(post.center[0], post.center[1] - post.size[1] / 2, post.center[2]).applyMatrix4(mesh.matrixWorld);
      check(Math.abs(base.y - ground(base.x, base.z)) < 1e-6, 'Terrain-following post base reaches the actual ground after scaling');
      root.position.y += .6; root.updateMatrixWorld(true); model.conformPaths(ground);
      const lifted = mesh.geometry.userData.fencePieces.find(piece => piece.kind === 'post');
      const liftBase = new T.Vector3(lifted.center[0], lifted.center[1] - lifted.size[1] / 2, lifted.center[2]).applyMatrix4(mesh.matrixWorld);
      check(Math.abs(liftBase.y - ground(liftBase.x, liftBase.z) - .6) < 1e-6, 'Explicit vertical fence lift survives terrain conforming');
      source.dispose(); expected.dispose(); mesh.geometry.dispose(); mesh.material.dispose();
      setAuthoredWorld(authored);
      const scene = new T.Scene(); scene.background = new T.Color('#c4d8df'); scene.add(world.group, new T.HemisphereLight('#fff3da', '#637d57', 2));
      const sun = new T.DirectionalLight('#fff1d4', 3); sun.position.set(10, 35, 20); scene.add(sun);
      const camera = new T.PerspectiveCamera(48, 1280 / 800, .1, 150); camera.position.set(10, 3.2, 27); camera.lookAt(4.8, .7, 25.5);
      const cover = document.createElement('div'); cover.style.cssText = 'position:fixed;inset:0;z-index:99999'; cover.append(renderer.domElement); document.body.append(cover);
      renderer.render(scene, camera);
      window.fenceProof = { renderer, scene, camera, world };
      return { checks, colliders: physics.colliders.length, baseWorldColliders: world.colliders.length, fences: authored.fences.length, vertices: vertices.count };
    }, { layout, physics });
    await page.screenshot({ path: path.join(output, 'fence-legacy.png') });
    await page.evaluate(() => { const { renderer, scene, camera } = window.fenceProof; camera.position.set(-30, 4, 64); camera.lookAt(-33, .8, 58); renderer.render(scene, camera); });
    await page.screenshot({ path: path.join(output, 'fence-pasture.png') });
    assert.deepEqual(errors, []);
    assert.equal(createHash('sha256').update(fs.readFileSync('public/village/world-layout.json')).digest('hex'), createHash('sha256').update(layoutBytes).digest('hex'), 'Fence checks must not change the playable layout');
    fs.writeFileSync(path.join(output, 'fences.json'), JSON.stringify({ pass: true, scope: 'Local real Chrome production/editor fence geometry and actual authored movement', layoutHash: physics.layoutHash, physicsLayoutHash: physics.layoutHash, ...result, errors }, null, 2) + '\n');
    console.log(`${result.checks.length} fence checks passed; ${result.colliders} rendered colliders; no playable layout writes or browser errors.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

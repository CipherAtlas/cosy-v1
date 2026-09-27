// Run against the local preview_qa.py harness; uses an existing Playwright install.
const { chromium, firefox } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const kind = process.argv[2] || 'chrome', output = process.env.OUTPUT_DIR || '/tmp/cosy-companions';
  fs.mkdirSync(output, { recursive: true });
  const browser = await (kind === 'firefox' ? firefox : chromium).launch({ headless: true,
    ...(kind === 'chrome' ? { channel: 'chrome' } : {}),
    ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: kind === 'firefox' ? null : { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', error => errors.push(String(error)));
  try {
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:3048/');
    const result = await page.evaluate(async () => {
      const T = await import('three');
      const { VillageEngine } = await import('/modules/features/village/VillageEngine.js');
      const { VillageLife } = await import('/modules/features/village/life.js');
      const { CompanionWalk } = await import('/modules/features/village/companionWalk.js');
      const { VillageNavigation } = await import('/modules/features/village/navigation.js');
      const checks = [], check = (ok, label) => { if (!ok) throw Error(label); checks.push(label); };
      const metrics = [];
      // A walkable 1.6 m passage cannot accommodate two spirits side by side.
      const walls = [{ x: 18.7, z: 20, w: 1, d: 5 }, { x: 21.3, z: 20, w: 1, d: 5 }];
      for (const fps of [30, 60, 120]) {
        const life = new VillageLife(new T.Group(), walls), r = life.residents[3];
        life.setCompanions(['luma']);
        const player = new T.Vector3(20, 0, 27);
        r.movement.settle(21.05, 27); r.root.rotation.y = Math.PI;
        let time = 0, narrow = false, behind = false, safe = true, maxError = 0;
        const tick = () => { time += 1 / fps; life.update(1 / fps, time, player, false, false, undefined, Math.PI); };
        for (let i = 0; i < 2 * fps; i++) tick();
        check(r.root.position.distanceTo(player) < 1.15, `Luma alone occupies the hand-holding slot at ${fps} fps`);
        for (let i = 0; i < 9 * fps; i++) {
          player.z -= 1.5 / fps; tick();
          safe &&= r.movement.clear(r.root.position.x, r.root.position.z);
          if (player.z < 21 && player.z > 19) {
            narrow ||= life.companionWalk.singleFile;
            behind ||= Math.abs(r.root.position.x - player.x) < .25 && r.root.position.z > player.z + .55;
          }
          if (player.z < 15) maxError = Math.max(maxError, Math.hypot(r.root.position.x - 21.05, r.root.position.z - player.z));
        }
        check(narrow && behind, `Companion moves behind through the narrow passage at ${fps} fps`);
        check(safe, `Companion never crosses passage walls at ${fps} fps`);
        check(!life.companionWalk.singleFile && maxError < .2, `Companion rejoins beside the moving player at ${fps} fps (error ${maxError}, position ${r.root.position.toArray()})`);
        metrics.push({ fps, maxError }); life.dispose();
      }
      const formation = new CompanionWalk(walls), at = new T.Vector3(20, 0, 21);
      formation.update(.1, at, 1, Math.PI);
      check(formation.singleFile, 'A stationary player inside a narrow passage keeps single file');
      at.z = 17; formation.update(.1, at, 1, Math.PI);
      for (let i = 0; i < 12; i++) formation.update(.1, at, 1, Math.PI);
      check(!formation.singleFile, 'Waiting in the open allows the companion to return');

      document.body.innerHTML = '<div class="village"><div id="scene" style="position:fixed;inset:0"></div></div>';
      const noop = () => {}, e = window.engine = new VillageEngine(document.querySelector('#scene'), {
        progress: noop, ready: noop, near: noop, interact: noop, movement: noop, contact: noop,
        environment: noop, stats: noop, error: message => { throw Error(message); },
      });
      await e.load(); e.setQuality('low'); e.setBlocked(false); e.renderer.setAnimationLoop(null);
      let now = performance.now(); e.lastTime = now;
      const tick = (seconds) => { for (let i = 0; i < seconds * 60; i++) { now += 1000 / 60; e.frame(now); } };
      e.movement.settle(1, 27); e.player.rotation.y = Math.PI; e.setCompanions(['pip']);
      const pip = e.life.residents[0]; pip.movement.settle(2.05, 27); pip.root.rotation.y = Math.PI;
      tick(2);
      check(e.companionHands.posed.length === 2, 'Player and Pip hold their existing hands while standing together');
      e.keys.add('w'); tick(2); e.keys.clear();
      check(e.companionHands.posed.length === 2, 'Player and Pip keep holding hands while walking, including during dialogue');
      const gap = () => {
        e.player.updateWorldMatrix(true, true); pip.root.updateWorldMatrix(true, true);
        const a = e.spiritFins.find(f => f.name === 'SpiritFinL'), b = pip.fins.find(f => f.name === 'SpiritFinR');
        return a.localToWorld(new T.Vector3(-.135, 0, 0)).distanceTo(b.localToWorld(new T.Vector3(.135, 0, 0)));
      };
      check(gap() < .035, 'The two hand tips visibly meet while walking');
      e.camera.position.set(-.7, 1.8, e.player.position.z - 4.2);
      e.camera.lookAt(1.5, .9, e.player.position.z); e.renderer.render(e.scene, e.camera);
      window.captureCompanions = () => e.renderer.render(e.scene, e.camera);
      metrics.push({ handGap: gap() });
      e.keys.add('d'); tick(2); e.keys.clear(); tick(1);
      check(e.companionHands.posed.length === 2 && gap() < .035, 'A quarter turn reforms the hand-hold in the new walking direction');
      let turnClearance = Infinity;
      e.keys.add('a');
      for (let i = 0; i < 120; i++) { tick(1 / 60); turnClearance = Math.min(turnClearance, Math.hypot(pip.root.position.x - e.player.position.x, pip.root.position.z - e.player.position.z)); }
      e.keys.clear(); tick(1); metrics.push({ turnClearance });
      check(turnClearance > .7, 'Turning back preserves space between the two bodies');
      check(e.companionHands.posed.length === 2 && gap() < .035, 'Turning back reforms the hand-hold');
      e.player.rotation.y = Math.PI; tick(2);
      e.reducedMotion = true; tick(1);
      check(e.companionHands.posed.length === 2 && gap() < .035, 'Reduced motion retains the resting hand-hold');
      e.reducedMotion = false; e.movement.jump(); tick(.1);
      check(!e.companionHands.posed.length, 'Jumping releases the hand-hold'); tick(2);
      e.setCompanions(['pip', 'maple']); const maple = e.life.residents[1];
      maple.movement.settle(e.player.position.x - 1.05, e.player.position.z); maple.root.rotation.y = Math.PI;
      tick(2);
      check(e.companionHands.posed.length === 4, 'Two companions can hold the left and right hand');
      e.setPlace('mood'); tick(.1);
      check(!e.companionHands.posed.length, 'Entering an activity restores normal hands and poses');
      e.setPlace(null); e.setCompanions([]); tick(.1);
      check(!e.companionHands.posed.length && e.spiritFins.every(f => f.scale.x === 1), 'Dismissal restores the original fin scale');
      const { PLACES } = await import('/modules/features/village/places.js');
      e.setCompanions(['pip', 'maple', 'moss', 'luma', 'wren']);
      for (const place of PLACES) {
        e.travel(place.id); tick(.1);
        check(!e.companionHands.posed.length && e.life.residents.every(r => r.root.visible && r.root.position.distanceTo(e.player.position) < 7), `All companions release hands and join ${place.id}`);
      }
      e.setPlace(null);
      e.setCompanions(['pip']); e.movement.settle(-18.5, -5.5); pip.movement.settle(-18.5, -6.55);
      e.player.rotation.y = pip.root.rotation.y = -Math.PI / 2; e.yaw = Math.PI / 2; tick(1);
      e.keys.add('w'); tick(1.2); e.keys.clear();
      check(e.life.companionWalk.singleFile && !e.companionHands.posed.length && pip.root.position.x > e.player.position.x + .5,
        'The actual pond dock releases hands and puts Pip behind the player');
      e.yaw = 0;

      // Preserve the existing multi-companion bridge, water, cottage and return-route contract.
      const navigation = new VillageNavigation(e.world.colliders);
      for (const fps of [30, 60, 120]) {
        const life = new VillageLife(new T.Group(), e.world.colliders);
        life.setCompanions(['pip', 'maple', 'moss', 'luma', 'wren']);
        const player = new T.Vector3(-19, 0, 0);
        for (let i = 0; i < 75 * fps; i++) life.update(1 / fps, i / fps, player, false, false);
        check(life.residents.every(r => r.root.position.distanceTo(player) < 4.3), `Five companions arrive across the village at ${fps} fps`);
        const route = navigation.path([-19, 0], [24.6, -3]); let waypoint = 0, safe = true;
        for (let i = 0; i < 55 * fps; i++) {
          const next = route[waypoint];
          if (next) {
            const dx = next[0] - player.x, dz = next[1] - player.z, length = Math.hypot(dx, dz), step = Math.min(length, 4.2 / fps);
            if (length < .05) waypoint++; else { player.x += dx / length * step; player.z += dz / length * step; }
          }
          life.update(1 / fps, 75 + i / fps, player, false, false);
          if (i % fps === 0) safe &&= life.residents.every(r => r.movement.clear(r.root.position.x, r.root.position.z));
        }
        check(waypoint === route.length && life.residents.every(r => r.root.position.distanceTo(player) < 4.3), `Five companions follow over the bridge and around cottages at ${fps} fps`);
        check(safe, `All companions respect world and water bounds at ${fps} fps`);
        life.setCompanions([]);
        for (let i = 0; i < 90 * fps; i++) life.update(1 / fps, 130 + i / fps, player, false, false);
        check(life.residents.every(r => !r.following && !r.returning), `Dismissed companions return to their routes at ${fps} fps`);
        life.dispose();
      }
      // End with a front view of the actual hand-holding actors.
      e.setCompanions(['pip']); e.movement.settle(1, 27); pip.movement.settle(2.05, 27);
      e.player.rotation.y = pip.root.rotation.y = Math.PI; tick(2);
      e.camera.position.set(-.7, 1.8, 22.8); e.camera.lookAt(1.5, .9, 27); captureCompanions();
      const { checkResidents } = await import('/resident-tests.js');
      return { checks, metrics, encounters: checkResidents() };
    });
    await page.screenshot({ path: path.join(output, `hand-holding-${kind}.png`) });
    result.errors = errors;
    fs.writeFileSync(path.join(output, `checks-${kind}.json`), JSON.stringify(result, null, 2));
    if (errors.length) throw Error(errors.join('\n'));
    console.log(`${result.checks.length} companion checks passed in ${kind}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });

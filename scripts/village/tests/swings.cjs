// Run against preview_qa.py with an existing Playwright installation.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:3091/');
    const result = await page.evaluate(async () => {
      const { VillageEngine } = await import('/modules/features/village/VillageEngine.js');
      const { SwingPendulum, SWING_MAX_ANGLE, SWING_LENGTH } = await import('/modules/features/village/swings.js');
      const { floorHeight } = await import('/modules/features/village/environment.js');
      const { Vector3 } = await import('three');
      const checks = [], check = (ok, name) => { if (!ok) throw Error(name); checks.push(name); };
      const runs = [];
      for (const fps of [30, 60, 120]) {
        const p = new SwingPendulum(); let peak = 0;
        for (let i = 0; i < fps * 30; i++) {
          p.update(1 / fps, p.velocity >= 0 ? 1 : -1, false, true);
          peak = Math.max(peak, Math.abs(p.angle));
        }
        check(peak > 1.25 && peak <= SWING_MAX_ANGLE + .001, `Timed pumping reaches a high bounded arc at ${fps} FPS`);
        runs.push({ fps, peak, angle: p.angle, velocity: p.velocity });
      }
      check(Math.max(...runs.map(p => p.peak)) - Math.min(...runs.map(p => p.peak)) < .025, 'High arcs agree across frame rates');
      const free = new SwingPendulum(); free.angle = .8;
      const energy = p => .5 * p.velocity ** 2 + 9.81 / p.length * (1 - Math.cos(p.angle));
      const startEnergy = energy(free);
      for (let i = 0; i < 120 * 20; i++) free.update(1 / 120, 0, false, false);
      check(energy(free) < startEnergy * .025, 'An empty swing loses energy naturally');
      const brake = new SwingPendulum(); brake.angle = 1.1; brake.velocity = 1.2;
      const brakeEnergy = energy(brake);
      for (let i = 0; i < 120 * 4; i++) brake.update(1 / 120, 0, true, true);
      check(energy(brake) < brakeEnergy * .003, 'Holding the brake dissipates energy');
      const periods = [];
      for (const length of [SWING_LENGTH, SWING_LENGTH * 2]) {
        const p = new SwingPendulum(length); p.angle = .1; let firstCrossing = 0;
        for (let i = 0; i < 120 * 8; i++) { p.update(1 / 120, 0, false, true); if (p.angle < 0) { firstCrossing = i / 120; break; } }
        periods.push(firstCrossing);
      }
      check(Math.abs(periods[1] / periods[0] - Math.sqrt(2)) < .03, 'Scaled chain length changes the physical period');
      const mounts = [];
      const engine = new VillageEngine(document.querySelector('#scene'), {
        progress: () => {}, ready: () => {}, near: () => {}, interact: () => {},
        error: message => { throw Error(message); }, stats: () => {}, movement: () => {}, contact: () => {}, environment: () => {},
        ridingSwing: seat => mounts.push(seat),
      });
      await engine.load(); engine.renderer.setAnimationLoop(null); engine.setBlocked(false); engine.setWeather('golden');
      window.swingTestEngine = engine;
      let time = performance.now();
      const tick = (n = 1) => { for (let i = 0; i < n; i++) { time += 1000 / 60; engine.frame(time); } };
      const swing = engine.world.swings[0];
      check(swing?.placement.id === 'sunrise-meadow-swings', 'Swing set replaces the far eastern meadow bench');
      check(!engine.world.benches.some(b => b.id === 'sunrise-meadow-bench'), 'Old meadow bench and seating target are removed');
      check(swing.pivots.length === 2 && [...swing.dynamicMeshes].every(mesh => mesh.parent), 'Both hanging assemblies survive runtime static batching');
      const approach = index => {
        swing.root.localToWorld(engine.temp.set(index === 0 ? -.98 : .98, 0, 1.65));
        const { x, z } = engine.temp;
        check(engine.movement.clear(x, z), `Seat ${index + 1} has a clear ground approach`);
        engine.movement.settle(x, z); engine.player.position.set(x, floorHeight(x, z), z); tick(2);
      };
      for (const index of [0, 1]) {
        approach(index);
        check(engine.nearSwing?.index === index, `Seat ${index + 1} has a proximity prompt`);
        engine.onKeyDown(new KeyboardEvent('keydown', { key: 'e' })); tick();
        check(engine.ridingSwing?.index === index, `E mounts seat ${index + 1}`);
        engine.swingKey('w', true); tick(20); engine.swingKey('w', false);
        let peak = 0;
        for (let i = 0; i < 60 * 18; i++) {
          const p = swing.pendulums[index];
          engine.swingKey('w', p.velocity >= 0); engine.swingKey('s', p.velocity < 0); tick();
          peak = Math.max(peak, Math.abs(p.angle));
          const seat = swing.seatPoint(index, new Vector3()), pivot = swing.pivots[index].getWorldPosition(new Vector3());
          check(Math.abs(seat.distanceTo(pivot) - SWING_LENGTH) < .00001 && Number.isFinite(engine.player.position.y), `Seat ${index + 1} fixed chain step ${i}`);
          if (Math.abs(p.angle) > 1.25 && index === 0) break;
        }
        engine.swingKey('w', false); engine.swingKey('s', false);
        check(peak > 1.25, `Seat ${index + 1} rider reaches more than 72 degrees`);
        check(Math.abs(swing.pendulums[1 - index].angle) < (index === 0 ? .001 : SWING_MAX_ANGLE), 'Other seat moves independently');
        if (index === 0) {
          engine.setBlocked(true); tick(30);
          window.swingHighPose = { angle: swing.pendulums[0].angle, y: engine.player.position.y };
          await new Promise(resolve => setTimeout(resolve, 0));
          engine.renderer.render(engine.scene, engine.camera);
          window.swingHighCapture = engine.renderer.domElement.toDataURL('image/png');
          engine.setBlocked(false);
        }
        const before = energy(swing.pendulums[index]); engine.swingKey(' ', true); tick(240); engine.swingKey(' ', false);
        check(energy(swing.pendulums[index]) < before * .005, `Space brakes seat ${index + 1}`);
        engine.onKeyDown(new KeyboardEvent('keydown', { key: index === 0 ? 'e' : 'Escape' })); tick(2);
        check(!engine.ridingSwing && engine.movement.clear(engine.player.position.x, engine.player.position.z) && Math.abs(engine.player.rotation.x) < .001, `Seat ${index + 1} exits safely with E / Escape`);
      }
      approach(0); engine.rideSwing(swing.placement.id, 0); tick();
      engine.swingKey('w', true); engine.onBlur();
      check(!engine.keys.size, 'Blur clears held pumping');
      engine.setBlocked(true); engine.onKeyDown(new KeyboardEvent('keydown', { key: 'w' }));
      check(!engine.keys.size, 'Menus block pumping input');
      engine.setBlocked(false);
      const input = document.createElement('input'); document.body.append(input); input.focus();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true })); input.remove();
      check(!engine.keys.size, 'Typing does not pump the swing');
      engine.travel('mood'); tick();
      check(!engine.ridingSwing && engine.place === 'mood', 'Activity travel releases the swing');
      engine.setPlace(null); tick(); approach(0); engine.rideSwing(swing.placement.id, 0); tick();
      engine.resetPosition(); tick();
      check(!engine.ridingSwing && engine.movement.clear(engine.player.position.x, engine.player.position.z), 'Recovery releases the swing onto clear ground');
      return { checks: checks.filter(name => !name.includes('fixed chain step')), chainSteps: checks.filter(name => name.includes('fixed chain step')).length, runs, highPose: window.swingHighPose, mounts };
    });
    const output = process.env.SWING_EVIDENCE || '/tmp/cosy-swings'; fs.mkdirSync(output, { recursive: true });
    const high = await page.evaluate(() => window.swingHighCapture);
    fs.writeFileSync(output + '/swing-high.png', Buffer.from(high.split(',')[1], 'base64'));
    fs.writeFileSync(output + '/engine-checks.json', JSON.stringify({ ...result, errors }, null, 2));
    if (errors.length) throw Error(errors.join('\n'));
    console.log(JSON.stringify({ checks: result.checks.length, chainSteps: result.chainSteps, runs: result.runs, errors }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

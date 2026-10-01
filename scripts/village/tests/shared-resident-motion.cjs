// Replay authoritative positions through the actual resident renderer at high frame rates.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:3063');
    const results = await page.evaluate(async () => {
      const T = await import('three');
      const { VillageLife } = await import('/modules/features/village/life.js');
      const nativeNow = Date.now, nativePerformanceNow = performance.now, results = [], checks = [];
      const check = (ok, label) => { if (!ok) throw Error(label); checks.push(label); };
      let now = 500000; Date.now = () => now;
      performance.now = () => now - 500000;
      try {
        for (const fps of [30, 60, 90, 120]) for (const cadence of [100, 120]) for (const jitter of ['none', 'mild', 'burst']) {
          now = 500000;
          const life = new VillageLife(new T.Group(), []);
          const resident = life.residents[0];
          const state = { id: 'pip', kind: 'resident', x: 4, y: .05, z: 20, heading: Math.PI / 2, speed: 2,
            owner: null, following: false, mode: 'roam', action: null, startedAt: now, until: 0, speech: null };
          life.applyShared([state], 'observer', now);
          let nextSnapshot = cadence, previousX = 4, packet = 0;
          const delays = jitter === 'burst' ? [0, 150, 0, 0, 120, 0] : jitter === 'mild' ? [0, 25, 10, 35, 0] : [0];
          const speeds = [];
          for (let frame = 1; frame <= fps * 4; frame++) {
            const ms = frame * 1000 / fps; now = 500000 + ms;
            while (ms + 1e-6 >= nextSnapshot + delays[packet % delays.length]) {
              life.applyShared([{ ...state, x: 4 + nextSnapshot / 1000 * 2 }], 'observer', 500000 + nextSnapshot);
              nextSnapshot += cadence; packet++;
            }
            life.update(1 / fps, ms / 1000, new T.Vector3(40, .05, 20), false, false);
            if (ms > 1000) speeds.push((resident.root.position.x - previousX) * fps);
            previousX = resident.root.position.x;
          }
          const mean = speeds.reduce((a, b) => a + b) / speeds.length;
          const variation = Math.sqrt(speeds.reduce((sum, speed) => sum + (speed - mean) ** 2, 0) / speeds.length) / mean;
          results.push({ fps, cadence, jitter, meanSpeed: mean, variation, minSpeed: Math.min(...speeds), maxSpeed: Math.max(...speeds) });
          check(12 - resident.root.position.x < (jitter === 'burst' ? .85 : .5), `${fps} fps / ${cadence} ms / jitter ${jitter}: display lag stays bounded`);
          now += 1000;
          life.update(1 / fps, 5, new T.Vector3(), false, false);
          const lastX = 4 + (nextSnapshot - cadence) / 1000 * 2;
          check(Math.abs(resident.root.position.x - lastX) < 1e-8, 'Interrupted delivery holds the last accepted position without extrapolation');
          const stopped = { ...state, x: lastX, speed: 0, mode: 'talk', owner: 'owner' };
          life.applyShared([stopped], 'observer', now);
          const heldX = resident.root.position.x;
          now += 300; life.update(.01, 5.3, new T.Vector3(), false, false);
          check(resident.root.position.x === heldX && !resident.following && !life.available('pip'), 'Talking ownership holds the resident for an observer');
          const privatePose = { ...stopped, x: 107.6, z: -.45, y: .1, mode: 'activity', activity: 'focus' };
          life.applyShared([privatePose], 'owner', now);
          life.setActivity('focus'); life.update(.01, 5.3, new T.Vector3(), false, false);
          check(resident.root.position.x === privatePose.x && resident.root.visible, 'Private activity placement snaps immediately for its owner');
          const rejoined = { ...state, x: 8, heading: -3.13 };
          now += 10; life.applyShared([rejoined], 'reconnected-observer', now);
          life.setActivity(null); life.update(.01, 5.31, new T.Vector3(), true, false);
          check(resident.root.position.x === 8 && resident.root.rotation.y === -3.13, 'Reconnect discards the previous interpolation path');
          life.dispose();
        }
        for (const gap of [600, 1100]) {
          now = 500000;
          const life = new VillageLife(new T.Group(), []), resident = life.residents[0];
          const state = { id: 'pip', kind: 'resident', x: 4, y: .05, z: 20, heading: Math.PI / 2, speed: 2,
            owner: null, following: false, mode: 'roam', action: null, startedAt: now, until: 0, speech: null };
          life.applyShared([state], 'observer', now);
          let nextSnapshot = 120, previousX = 4, peak = 0;
          for (let frame = 1; frame <= 90 * 18; frame++) {
            const ms = frame * 1000 / 90; now = 500000 + ms;
            if (ms < 1000 || ms >= 1000 + gap) while (nextSnapshot <= ms) {
              life.applyShared([{ ...state, x: 4 + nextSnapshot / 1000 * 2 }], 'observer', 500000 + nextSnapshot);
              nextSnapshot += 120;
            }
            life.update(1 / 90, ms / 1000, new T.Vector3(40, .05, 20), false, false);
            peak = Math.max(peak, (resident.root.position.x - previousX) * 90);
            previousX = resident.root.position.x;
          }
          check(peak <= 2.21, `${gap} ms interruption resumes without a display jump`);
          check(40 - resident.root.position.x < .8, `${gap} ms interruption recovers display delay below 400 ms gradually`);
          life.dispose();
        }
        now = 500000;
        const life = new VillageLife(new T.Group(), []), resident = life.residents[0];
        const state = { id: 'pip', kind: 'resident', x: 4, y: .05, z: 20, heading: 3.13, speed: 0,
          owner: null, following: false, mode: 'roam', action: null, startedAt: now, until: 0, speech: null };
        life.applyShared([state], 'observer', now);
        now += 120; life.applyShared([{ ...state, heading: -3.13 }], 'observer', now);
        now += 120; life.update(.01, .24, new T.Vector3(), false, false);
        check(Math.abs(Math.abs(resident.root.rotation.y) - Math.PI) < .02, 'Facing crosses the angle boundary by the short turn');
        life.dispose();
      } finally { Date.now = nativeNow; performance.now = nativePerformanceNow; }
      return { results, checks };
    });
    console.log(JSON.stringify(results.results.map(({ fps, cadence, jitter, meanSpeed, variation }) => ({ fps, cadence, jitter, meanSpeed, variation })), null, 2));
    if (process.env.OUTPUT_FILE) fs.writeFileSync(process.env.OUTPUT_FILE, JSON.stringify(results, null, 2) + '\n');
    for (const result of results.results) {
      assert(Math.abs(result.meanSpeed - 2) < .03, `${result.fps} fps retains authoritative travel speed`);
      assert(result.variation < .1, `${result.fps} fps: steady NPC motion must not pulse between snapshots (variation ${result.variation.toFixed(3)})`);
    }
    console.log(`${results.checks.length + results.results.length * 2} resident motion checks passed at 30/60/90/120 fps, with delayed delivery, stops and reconnects.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

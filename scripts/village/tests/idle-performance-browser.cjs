// Local rendered cadence/traffic regression. Counts actual work; it is not a GPU, power or thermal benchmark.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const villageUrl = process.env.VILLAGE_URL || 'http://127.0.0.1:3051';
const workerUrl = process.env.WORKER_URL || 'ws://127.0.0.1:2577';
const baseline = process.env.BASELINE === '1';
for (const url of [villageUrl, workerUrl]) assert.equal(new URL(url).hostname, '127.0.0.1', 'Idle checks must use isolated loopback servers');
const output = process.env.OUTPUT_DIR || '/tmp/cosy-idle-performance';
fs.mkdirSync(output, { recursive: true });
const checks = [], errors = [];
const measurements = { baseline, limits: ['Short local Chrome samples with live shared actors.', 'Render counts establish budget reduction; they do not measure CPU/GPU watts, fan noise or physical iPad performance.', 'Interactive baseline holds Shift without movement to keep the same camera, assets and player pose.'] };
const check = (ok, label) => { assert(ok, label); checks.push(label); console.log(label); };
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--disable-features=LocalNetworkAccessChecks'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference' });
    await context.addInitScript(endpoint => {
      localStorage.setItem('cosy-village-preferences', JSON.stringify({ weather: 'golden', weatherMode: 'manual', quality: 'low', dontShowTutorial: true, language: 'en' }));
      window.idleTraffic = [];
      const Native = WebSocket;
      window.WebSocket = class extends Native {
        constructor(url, protocols) { super(endpoint, protocols); }
        send(raw) { const payload = JSON.parse(raw); idleTraffic.push({ at: performance.now(), type: payload.type, active: payload.active }); return super.send(raw); }
      };
    }, workerUrl);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(villageUrl);
    await page.getByRole('button', { name: 'Enter Hearthwillow', exact: true }).click({ timeout: 120000 });
    const guide = page.locator('[data-tutorial-done]'); if (await guide.count()) await guide.click();
    await page.waitForFunction(() => {
      for (let element = document.querySelector('canvas'); element; element = element.parentElement)
        for (let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return)
          for (const branch of [fiber, fiber.alternate]) for (let hook = branch?.memoizedState; hook; hook = hook.next) {
            const ref = hook.memoizedState?.current;
            if (ref?.getPerformanceReport && ref?.setSharedActors) window.idleEngine = ref;
          }
      return window.idleEngine?.sharedConnected;
    }, null, { timeout: 120000 });
    await page.bringToFront();
    const closeChat = page.getByRole('button', { name: 'Close Hearthwillow chat', exact: true });
    if (await closeChat.count()) await closeChat.click();
    await page.evaluate(() => {
      const e = idleEngine, render = e.renderer.render;
      window.idleRenderCounts = { main: 0, window: 0, drawCalls: 0, triangles: 0 };
      e.renderer.render = function(scene, camera) {
        const result = render.call(this, scene, camera);
        if (camera === e.camera) { idleRenderCounts.main++; idleRenderCounts.drawCalls += this.info.render.calls; idleRenderCounts.triangles += this.info.render.triangles; }
        else if (camera === e.bridgeCamera) idleRenderCounts.window++;
        return result;
      };
    });
    const sample = async (label, milliseconds = 6000) => {
      const value = await page.evaluate(async duration => {
        const e = idleEngine, report = e.getPerformanceReport();
        const start = performance.now(), first = { ...idleRenderCounts }, traffic = idleTraffic.length;
        const pose = { player: e.player.position.toArray(), camera: e.camera.position.toArray(), quaternion: e.camera.quaternion.toArray() };
        let refreshFrames = 0;
        await new Promise(resolve => {
          const step = now => { refreshFrames++; if (now - start < duration) requestAnimationFrame(step); else resolve(); };
          requestAnimationFrame(step);
        });
        const seconds = (performance.now() - start) / 1000;
        return { seconds, refreshFps: refreshFrames / seconds, mainFps: (idleRenderCounts.main - first.main) / seconds,
          windowFps: (idleRenderCounts.window - first.window) / seconds, drawCallsPerSecond: (idleRenderCounts.drawCalls - first.drawCalls) / seconds,
          trianglesPerSecond: (idleRenderCounts.triangles - first.triangles) / seconds,
          treeUploads: typeof report.treeVisibilityUploads === 'number' ? e.getPerformanceReport().treeVisibilityUploads - report.treeVisibilityUploads : null,
          reportBefore: report, reportAfter: e.getPerformanceReport(), poseBefore: pose,
          poseAfter: { player: e.player.position.toArray(), camera: e.camera.position.toArray(), quaternion: e.camera.quaternion.toArray() },
          traffic: idleTraffic.slice(traffic) };
      }, milliseconds);
      measurements[label] = value; return value;
    };
    await page.waitForTimeout(5000); // Finish shader/camera settling and the startup adaptation grace period.
    if (baseline) {
      await sample('outdoorIdle');
      await page.screenshot({ path: path.join(output, 'baseline-outdoor.png') });
      await page.getByRole('button', { name: 'Expand village map', exact: true }).click();
      await page.getByRole('button', { name: 'Focus cottage', exact: true }).click();
      await page.waitForFunction(() => idleEngine.currentPlace === 'focus' && idleEngine.bridgeWindow);
      await page.waitForTimeout(3000);
      await sample('cottageIdle');
      await page.screenshot({ path: path.join(output, 'baseline-cottage.png') });
      check(errors.length === 0, `No captured baseline page errors (${errors.join('; ')})`);
      fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ checks, errors, measurements }, null, 2));
      return;
    }
    const idle = await sample('outdoorIdle');
    check(idle.reportAfter.renderCadence === 'idle-30' && idle.mainFps >= 24 && idle.mainFps <= 31, 'Stationary outdoor scene renders within the quiet 30 FPS budget');
    check(idle.treeUploads === 0, 'A steady outdoor camera uploads no repeated tree instance matrices');
    await page.locator('canvas').focus(); await page.keyboard.down('Shift');
    await page.waitForFunction(() => idleEngine.getPerformanceReport().renderCadence === 'interactive');
    const active = await sample('matchedInteractive', 3000);
    await page.keyboard.up('Shift');
    check(active.mainFps >= idle.mainFps * 1.2, 'Keyboard input immediately restores a materially faster interactive rendering cadence');
    check(JSON.stringify(active.poseBefore) === JSON.stringify(active.poseAfter)
      && JSON.stringify(idle.poseAfter) === JSON.stringify(active.poseBefore)
      && JSON.stringify(idle.reportAfter.drawingBuffer) === JSON.stringify(active.reportAfter.drawingBuffer)
      && idle.reportAfter.tier === active.reportAfter.tier, 'Idle and interactive samples use matching camera/player pose, scene tier and drawing buffer');
    measurements.renderReduction = { fraction: 1 - idle.mainFps / active.mainFps,
      callsFraction: 1 - idle.drawCallsPerSecond / active.drawCallsPerSecond };
    check(measurements.renderReduction.fraction >= .15, 'The idle budget avoids at least 15 percent of matched interactive render submissions');
    await page.waitForTimeout(1800);
    await page.locator('canvas').hover(); await page.mouse.wheel(0, 120);
    await page.waitForFunction(uploads => idleEngine.getPerformanceReport().treeVisibilityUploads > uploads, idle.reportAfter.treeVisibilityUploads);
    check(true, 'A camera zoom invalidates cached tree classification');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const trafficStart = await page.evaluate(() => { idleTraffic.length = 0; return performance.now(); });
    await page.waitForTimeout(1600);
    const modalTraffic = await page.evaluate(start => idleTraffic.filter(entry => entry.type === 'heartbeat' && entry.at >= start), trafficStart);
    measurements.visibleModalTraffic = modalTraffic;
    check(modalTraffic.length >= 8 && modalTraffic.every(entry => entry.active === false), 'Visible Settings retains shared clock traffic while marking gameplay inactive');
    await page.keyboard.press('Escape');
    // A real foreground switch may keep both contexts visible in headless Chrome. Record the limit instead of faking visibility.
    const other = await context.newPage(); await other.goto('about:blank'); await other.bringToFront();
    const hidden = await page.evaluate(() => document.hidden);
    if (hidden) {
      await page.evaluate(() => { idleTraffic.length = 0; });
      await other.waitForTimeout(3200);
      const hiddenTraffic = await page.evaluate(() => idleTraffic.filter(entry => entry.type === 'heartbeat'));
      measurements.hiddenTraffic = hiddenTraffic;
      check(hiddenTraffic.length >= 1 && hiddenTraffic.length <= 5 && hiddenTraffic.every(entry => entry.active === false), 'Hidden scene renews presence with bounded inactive heartbeat traffic');
    } else measurements.limits.push('Headless Chrome kept the background page visible; actual hidden-browser traffic was not established in this run.');
    await other.close(); await page.bringToFront();
    await page.getByRole('button', { name: 'Expand village map', exact: true }).click();
    await page.getByRole('button', { name: 'Focus cottage', exact: true }).click();
    await page.waitForFunction(() => idleEngine.currentPlace === 'focus' && idleEngine.bridgeWindow);
    await page.waitForTimeout(3000);
    const cottage = await sample('cottageIdle');
    check(cottage.mainFps >= 24 && cottage.mainFps <= 31 && cottage.windowFps >= 7 && cottage.windowFps <= 11,
      'Idle private cottage retains 30 FPS interior and approximately 10 Hz living window');
    await page.screenshot({ path: path.join(output, 'idle-cottage.png') });
    check(errors.length === 0, `No captured page errors (${errors.join('; ')})`);
    fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ checks, errors, measurements }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

// Run against preview_qa.py with an existing Playwright install; no shipped test route.
const { chromium, firefox } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const kind = process.argv[2] || 'chrome';
  const browser = await (kind === 'firefox' ? firefox : chromium).launch({
    headless: process.env.HEADED !== '1',
    ...(kind === 'chrome' ? { channel: 'chrome' } : {}),
    ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
  });
  const results = [], errors = [];
  const check = (condition, name) => { assert.ok(condition, name); results.push(name); };
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, hasTouch: kind === 'chrome' });
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(process.env.URL || 'http://127.0.0.1:3026/');
    await page.evaluate(async () => {
      const { VillageEngine } = await import('/modules/features/village/VillageEngine.js');
      document.body.innerHTML = '<div id="scene" style="width:1280px;height:720px"></div>';
      const noop = () => {};
      window.engine = new VillageEngine(document.querySelector('#scene'), {
        progress: noop, ready: noop, near: noop, interact: noop, error: console.error,
        stats: noop, movement: noop, contact: noop, environment: noop,
      });
      await engine.load(); engine.setQuality('low'); engine.setBlocked(false);
      window.pointerEvents = [];
      document.addEventListener('pointerdown', e => pointerEvents.push({ type: e.type, pointerType: e.pointerType, button: e.button }), true);
      for (const type of ['pointerlockchange', 'pointerlockerror']) document.addEventListener(type, () => pointerEvents.push({ type, locked: !!document.pointerLockElement }));
    });
    const canvas = page.locator('#scene > canvas');
    const state = () => page.evaluate(() => ({
      locked: document.pointerLockElement === engine.renderer.domElement,
      yaw: engine.yaw, pitch: engine.pitch, position: { ...engine.movement.position },
      keys: engine.keys.size, mode: engine.mouseLook,
    }));
    const lock = async () => {
      await canvas.click({ position: { x: 620, y: 550 } });
      try {
        await page.waitForFunction(() => document.pointerLockElement === engine.renderer.domElement && engine.mouseLook === 'locked', null, { timeout: 10000 });
      } catch (error) {
        console.error(await page.evaluate(() => ({ events: pointerEvents, mode: engine.mouseLook, pending: engine.pointerLockPending,
          wanted: engine.wantsMouseLook, blocked: engine.blocked, place: engine.place, focused: document.hasFocus() })));
        throw error;
      }
    };
    const released = () => page.waitForFunction(() => document.pointerLockElement === null);
    const travelled = (a, b) => Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
    const initial = await state();
    await lock(); await page.waitForTimeout(350);
    check(travelled(initial, await state()) < .01, 'Click captures the mouse without moving the player');
    check((await state()).mode === 'locked', 'Mouse-look state reflects the real browser lock');
    const beforeLook = await state();
    await page.mouse.move(800, 620); await page.waitForTimeout(100);
    const afterLook = await state();
    check(Math.abs(afterLook.yaw - beforeLook.yaw) > .1 && Math.abs(afterLook.pitch - beforeLook.pitch) > .05,
      'Mouse movement rotates both camera axes without a held button');
    check(travelled(beforeLook, afterLook) < .01, 'Looking around does not move the player');
    await page.keyboard.down('w'); await page.waitForTimeout(500);
    const walking = await state();
    check(travelled(afterLook, walking) > .3, 'WASD movement still works during mouse look');
    await page.keyboard.press('Escape'); await released();
    const escaped = await state();
    await page.mouse.move(250, 250); await page.waitForTimeout(300);
    const free = await state();
    check(free.mode === 'free' && free.keys === 0 && travelled(escaped, free) < .01,
      'Escape releases the cursor and clears held movement');
    check(free.yaw === escaped.yaw && free.pitch === escaped.pitch, 'Released mouse movement does not rotate the camera');
    await page.keyboard.up('w');
    // Browsers require a fresh engagement gesture after the default Escape release.
    await page.waitForTimeout(1200); await lock();
    check((await state()).locked, 'A new click resumes mouse look after Escape');
    await page.evaluate(() => engine.setBlocked(true)); await released();
    check((await state()).mode === 'free', 'Opening a menu releases the cursor');
    await canvas.click({ position: { x: 620, y: 550 } });
    check(!(await state()).locked, 'Clicks cannot capture the mouse while a menu blocks exploration');
    await page.evaluate(() => engine.setBlocked(false));
    await page.mouse.move(400, 350);
    check(!(await state()).locked, 'Closing a menu does not recapture the cursor');
    await lock(); await page.evaluate(() => engine.travel('music')); await released();
    check((await state()).mode === 'free', 'Entering an activity releases the cursor');
    await page.evaluate(() => engine.setPlace(null));
    check(!(await state()).locked, 'Leaving an activity restores exploration with a free cursor');
    await lock(); await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await released();
    check((await state()).keys === 0, 'Window blur releases the cursor and stops movement');

    await page.evaluate(() => {
      const canvas = engine.renderer.domElement, request = canvas.requestPointerLock;
      window.nativePointerLock = request;
      canvas.requestPointerLock = function () {
        const pending = request.call(this); engine.setBlocked(true); return pending;
      };
    });
    await canvas.click({ position: { x: 620, y: 550 } }); await page.waitForTimeout(350);
    check(!(await state()).locked && (await state()).mode === 'free',
      'Opening a menu during a pending capture prevents a late mouse grab');
    await page.evaluate(() => { engine.renderer.domElement.requestPointerLock = nativePointerLock; engine.setBlocked(false); });

    if (kind === 'chrome') {
      const session = await page.context().newCDPSession(page);
      const start = await state();
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 520, y: 440 }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 660, y: 470 }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const end = await state();
      check(Math.abs(start.yaw - end.yaw) > .2 && !end.locked, 'Touch drag still rotates the camera without mouse capture');
      check(travelled(start, end) < .01, 'Touch gestures do not create movement destinations');
      await page.touchscreen.tap(700, 600); await page.waitForTimeout(300);
      check(travelled(end, await state()) < .01, 'Tapping the ground does not move the player');
    }
    await page.evaluate(() => {
      const canvas = engine.renderer.domElement;
      window.originalPointerLock = canvas.requestPointerLock;
      canvas.requestPointerLock = function () { originalPointerLock.call(this); };
    });
    await lock();
    check((await state()).mode === 'locked', 'Event-only requestPointerLock implementations are supported');
    await page.evaluate(() => engine.setBlocked(true)); await released();
    await page.evaluate(() => {
      engine.setBlocked(false);
      engine.renderer.domElement.requestPointerLock = () => Promise.reject(new Error('Capture denied for test'));
    });
    await canvas.click({ position: { x: 600, y: 550 } });
    await page.waitForFunction(() => engine.mouseLook === 'drag');
    const denied = await state();
    await page.mouse.move(600, 450); await page.mouse.down(); await page.mouse.move(710, 470); await page.mouse.up();
    check(Math.abs((await state()).yaw - denied.yaw) > .2 && !(await state()).locked,
      'A denied capture exposes working drag-to-look fallback');
    check(travelled(denied, await state()) < .01, 'Fallback dragging still cannot move the player');
    await page.evaluate(() => { engine.renderer.domElement.requestPointerLock = originalPointerLock; });
    await lock(); await page.evaluate(() => engine.dispose()); await released();
    check(await page.locator('#scene > canvas').count() === 0, 'Disposal releases mouse capture and removes the canvas');
    if (process.env.APP_URL) {
      const app = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      app.on('pageerror', error => errors.push(String(error)));
      await app.addInitScript(() => localStorage.setItem('cosy-village-preferences', JSON.stringify({ quality: 'low' })));
      await app.goto(process.env.APP_URL);
      await app.getByRole('button', { name: 'Enter the village', exact: true }).click({ timeout: 90000 });
      await app.locator('.v-canvas canvas').click({ position: { x: 620, y: 550 } });
      await app.waitForFunction(() => !!document.pointerLockElement);
      check(await app.getByText('Mouse to look · Esc to release', { exact: true }).isVisible(), 'Exported app shows the active mouse-look hint');
      await app.mouse.move(720, 510);
      if (process.env.SCREENSHOT) await app.screenshot({ path: process.env.SCREENSHOT });
      await app.keyboard.press('m');
      await app.getByRole('dialog').waitFor();
      await app.waitForFunction(() => document.pointerLockElement === null);
      check(await app.getByRole('dialog').isVisible(), 'M opens Places and releases the cursor in the exported app');
      await app.getByRole('button', { name: /Village hearth Stay a while/ }).click();
      await app.getByRole('button', { name: 'Back to village', exact: true }).click();
      await app.locator('.v-canvas canvas').click({ position: { x: 620, y: 550 } });
      await app.waitForFunction(() => !!document.pointerLockElement);
      await app.keyboard.press('e');
      await app.getByRole('button', { name: 'Back to village', exact: true }).waitFor();
      check(await app.evaluate(() => document.pointerLockElement === null), 'E enters the hearth and releases the cursor in the exported app');
      await app.keyboard.press('Escape');
      await app.getByRole('button', { name: 'Controls', exact: true }).click();
      const guide = await app.getByRole('dialog').innerText();
      check(guide.includes('Click, then move mouse') && guide.includes('Touch drag') && !guide.includes('Glide to a spot'),
        'Controls explain mouse capture, Escape and touch without click-to-move');
      await app.keyboard.press('Escape');
      await app.setViewportSize({ width: 390, height: 844 });
      check(await app.getByRole('button', { name: 'Glide forward', exact: true }).isVisible(), 'Portrait layout retains touch movement buttons');
      await app.close();
    }
    check(errors.length === 0, 'No uncaught browser errors');
    const result = { pass: true, browser: kind, checks: results.length, results, errors };
    fs.writeFileSync(process.env.OUTPUT || `/tmp/cosy-camera-${kind}.json`, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

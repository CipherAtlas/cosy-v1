// Actual exported UI, simultaneous native touch contacts and local shared movement.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const output = process.env.OUTPUT_DIR || '/tmp/cosy-tablet-controls';
fs.mkdirSync(output, { recursive: true });
const url = process.env.VILLAGE_URL || 'http://127.0.0.1:3051';
const checks = [], errors = [];
const check = (ok, name) => { assert(ok, name); checks.push(name); console.log(name); };
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-features=LocalNetworkAccessChecks', '--disable-backgrounding-occluded-windows'] });
  try {
    const join = async options => {
      const page = await browser.newPage(options);
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        localStorage.setItem('cosy-village-preferences', JSON.stringify({ quality: 'low', weather: 'golden', weatherMode: 'manual', mix: { enabled: false } }));
      });
      await page.goto(url);
      await page.getByRole('button', { name: 'Enter Hearthwillow', exact: true }).click({ timeout: 120000 });
      await page.locator('[data-tutorial-done]').click();
      await page.waitForFunction(() => {
        for (let el = document.querySelector('canvas'); el; el = el.parentElement)
          for (let fiber = el[Object.keys(el).find(k => k.startsWith('__reactFiber'))]; fiber; fiber = fiber.return)
            for (const branch of [fiber, fiber.alternate]) for (let hook = branch?.memoizedState; hook; hook = hook.next) {
              const engine = hook.memoizedState?.current;
              if (engine?.setTouchMovement && engine.sharedConnected) { window.e = engine; return true; }
            }
      }, null, { timeout: 120000 });
      return page;
    };
    const tablet = await join({ viewport: { width: 1133, height: 650 }, hasTouch: true, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Safari/605.1.15' });
    const observer = await join({ viewport: { width: 1280, height: 800 } });
    check(await tablet.locator('.v-thumbstick').count() === 1, 'Tablet desktop identity has one movement thumbstick');
    check(!await tablet.locator('.v-shared-chat').count(), 'Tablet chat starts collapsed');
    check(!await observer.locator('.v-thumbstick').count(), 'PC keeps keyboard/mouse controls');
    await observer.evaluate(() => e.setMapOpen(true));
    await tablet.bringToFront();
    const cdp = await tablet.context().newCDPSession(tablet);
    const center = async selector => { const b = await tablet.locator(selector).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, id) => ({ ...p, id, radiusX: 4, radiusY: 4 })) });
    const pose = () => tablet.evaluate(() => ({ x: e.player.position.x, y: e.player.position.y, z: e.player.position.z, yaw: e.yaw, pitch: e.pitch }));
    const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
    const left = await center('.v-touch-left .v-thumbstick'), right = { x: 700, y: 220 };
    const initial = await pose();
    await touch('touchStart', [left, right]); await tablet.waitForTimeout(250);
    check(distance(initial, await pose()) < .02, 'Thumbstick center dead zone prevents accidental walking');
    await touch('touchMove', [{ x: left.x, y: left.y - 25 }, { x: right.x + 90, y: right.y - 40 }]);
    await tablet.waitForTimeout(550);
    const moved = await pose();
    check(distance(initial, moved) > .2 && Math.abs(moved.yaw - initial.yaw) > .2 && Math.abs(moved.pitch - initial.pitch) > .05, 'Left thumb walks while a second thumb drags the actual camera');
    const self = await tablet.evaluate(() => e.sharedSelfId);
    await observer.waitForFunction(({ self, moved }) => {
      const remote = e.remoteVisitors.get(self); return remote && Math.hypot(remote.target.x - moved.x, remote.target.z - moved.z) < 2;
    }, { self, moved });
    check(true, 'A second real client observes tablet movement through the Worker');
    await touch('touchEnd', []); await tablet.waitForTimeout(350);
    check(await tablet.evaluate(() => e.touchMove.lengthSq() === 0 && !e.pointer), 'Releasing contacts centers movement and stops camera dragging');
    await touch('touchStart', [left]);
    await touch('touchMove', [{ x: left.x, y: left.y - 35 }]);
    const jump = await center('.v-touch-buttons button:last-child');
    await touch('touchStart', [{ x: left.x, y: left.y - 35 }, jump]);
    await tablet.waitForTimeout(160);
    check(await tablet.evaluate(() => !e.movement.grounded || e.movement.position.y > .2), 'A second finger jumps while the left thumb keeps moving');
    await touch('touchCancel', []);
    check(await tablet.evaluate(() => e.touchMove.lengthSq() === 0), 'Touch cancellation cannot leave movement stuck');
    await tablet.getByRole('button', { name: 'Run', exact: true }).click();
    check(await tablet.evaluate(() => e.touchSprint), 'Run toggle sets faster walking');
    await tablet.keyboard.press('Escape');
    check(await tablet.evaluate(() => !e.touchSprint) && await tablet.getByRole('button', { name: 'Run', exact: true }).getAttribute('aria-pressed') === 'false', 'Escape clears the Run toggle and its visible state together');
    await tablet.getByRole('button', { name: 'Run', exact: true }).click();
    await tablet.getByRole('button', { name: 'Settings', exact: true }).click();
    check(await tablet.evaluate(() => !e.touchSprint && e.touchMove.lengthSq() === 0 && !e.pointer), 'Opening Settings clears movement, look and run');
    check(!await tablet.locator('.v-thumbstick').count(), 'Menus hide the controls');
    await tablet.keyboard.press('Escape');
    await tablet.waitForTimeout(100);
    for (const [name, width, height] of [['ipad', 1180, 700], ['air', 1180, 730], ['mini', 1133, 650], ['mini-portrait', 744, 1000], ['ipad-portrait', 820, 1060], ['split-view', 600, 700]]) {
      await tablet.setViewportSize({ width, height });
      await tablet.waitForTimeout(150);
      const boxes = await tablet.locator('.v-thumbstick, .v-touch-buttons button').evaluateAll(nodes => nodes.map(node => { const b = node.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; }));
      check(boxes.length >= 3 && boxes.every(b => b.x >= 0 && b.y >= 0 && b.x + b.w <= width && b.y + b.h <= height && b.w >= 44 && b.h >= 44), `${name}: thumbsticks and action targets fit inside viewport`);
      await tablet.screenshot({ path: `${output}/${name}.png` });
    }
    await tablet.evaluate(() => { e.setTouchMovement(.5, -.5); window.dispatchEvent(new Event('blur')); });
    check(await tablet.evaluate(() => !e.touchMove.lengthSq() && !e.pointer && !e.touchSprint), 'Background focus loss clears all held input');
    await observer.setViewportSize({ width: 600, height: 700 });
    check(!await observer.locator('.v-thumbstick').count(), 'A narrow PC window does not acquire tablet controls');
    for (const userAgent of ['Mozilla/5.0 (iPhone) Mobile Safari/604.1', 'Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/140.0 Mobile Safari/537.36']) {
      const phone = await browser.newPage({ userAgent, hasTouch: true });
      let assets = 0, sockets = 0;
      phone.on('request', r => { if (r.url().includes('/village/')) assets++; });
      phone.on('websocket', () => sockets++);
      await phone.goto(url); await phone.getByText('Please open the village on an iPad, tablet, laptop or PC.', { exact: true }).waitFor();
      check(!await phone.locator('canvas').count() && assets === 0 && sockets === 0, 'Phone is blocked before world assets and shared connection');
      await phone.close();
    }
    const approachHorse = async page => {
      await page.evaluate(() => {
        const h = e.sharedActors.actors.find(a => a.id === 'horse-juniper');
        const candidates = Array.from({ length: 8 }, (_, i) => ({ x: h.x + Math.cos(i * Math.PI / 4) * 1.8, z: h.z + Math.sin(i * Math.PI / 4) * 1.8 }));
        const target = candidates.find(p => e.movement.clear(p.x, p.z));
        if (!target) throw Error('No clear horse approach');
        e.movement.settle(target.x, target.z);
      });
      await page.waitForFunction(() => e.nearHorse?.id === 'horse-juniper' && e.movement.grounded);
    };
    await approachHorse(tablet);
    await tablet.waitForFunction(() => e.nearHorse.mode !== 'hold');
    await tablet.getByRole('button', { name: 'Ride', exact: true }).click();
    await tablet.waitForFunction(() => !!e.horseRiding.actor);
    await observer.waitForFunction(self => e.sharedActors.actors.find(a => a.id === 'horse-juniper')?.owner === self, self);
    await approachHorse(observer);
    await observer.evaluate(() => e.mountHorse('horse-juniper'));
    await observer.waitForTimeout(300);
    check(await observer.evaluate(() => !e.horseRiding.actor), 'Competing client cannot take the tablet rider’s horse');
    const horseStart = await tablet.evaluate(() => ({ ...e.horseRiding.actor }));
    const horseStick = await center('.v-touch-left .v-thumbstick');
    await touch('touchStart', [horseStick]);
    await touch('touchMove', [{ x: horseStick.x - 12, y: horseStick.y - 30 }]);
    await tablet.waitForTimeout(650);
    check(await tablet.evaluate(start => {
      const h = e.horseRiding.actor;
      return h && (Math.hypot(h.x - start.x, h.z - start.z) > .1 || Math.abs(h.heading - start.heading) > .1);
    }, horseStart), 'Movement thumbstick drives the Worker-owned horse');
    await touch('touchEnd', []);
    await tablet.locator('.v-touch-buttons').getByRole('button', { name: 'Canter', exact: true }).click();
    check(await tablet.evaluate(() => e.touchSprint), 'Canter uses the same reachable toggle');
    await tablet.locator('.v-touch-buttons').getByRole('button', { name: 'Brake', exact: true }).click();
    await tablet.waitForFunction(() => Math.abs(e.horseRiding.actor?.speed ?? 0) < .2);
    check(true, 'Brake stops the accepted horse');
    await tablet.getByRole('button', { name: 'Dismount', exact: true }).last().click();
    await tablet.waitForFunction(() => !e.horseRiding.actor);
    await observer.waitForFunction(() => !e.sharedActors.actors.find(a => a.id === 'horse-juniper')?.owner);
    check(true, 'Dismount releases the real shared horse claim');
    check(errors.length === 0, `No page errors: ${errors.join('; ')}`);
    fs.writeFileSync(`${output}/checks.json`, JSON.stringify({ checks, errors }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

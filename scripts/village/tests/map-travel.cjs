// Check an isolated export, or the actual preview with USE_SERVED_EXPORT=1.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
assert(process.env.EXPORT_DIR && process.env.LOCAL_WORKER_URL, 'Set EXPORT_DIR and LOCAL_WORKER_URL to isolated builds');
const root = path.resolve(process.env.EXPORT_DIR);
const checks = [], errors = [];
const check = (condition, label) => { assert(condition, label); checks.push(label); console.log(label); };
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-features=LocalNetworkAccessChecks'] });
  try {
    async function join() {
      const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
      page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
      if (process.env.USE_SERVED_EXPORT !== '1') await page.route('http://127.0.0.1:3051/**', route => {
        const relative = decodeURIComponent(new URL(route.request().url()).pathname);
        const file = path.resolve(root, `.${relative.endsWith('/') ? relative + 'index.html' : relative}`);
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404 });
        const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.png': 'image/png' };
        return route.fulfill({ path: file, contentType: types[path.extname(file)] || 'application/octet-stream' });
      });
      await page.addInitScript(url => {
        localStorage.setItem('cosy-village-preferences', JSON.stringify({ quality: 'low', weather: 'golden', weatherMode: 'manual', mix: { enabled: false } }));
        const Native = window.WebSocket;
        window.mapMessages = []; window.mapSocket = null;
        window.WebSocket = class extends Native {
          constructor(...args) { super(url, ...args.slice(1)); window.mapSocket = this;
            this.addEventListener('message', event => window.mapMessages.push(JSON.parse(event.data))); }
        };
      }, process.env.LOCAL_WORKER_URL);
      await page.goto('http://127.0.0.1:3051/?sharedTrial=1');
      console.log('Isolated client loaded');
      await page.getByRole('button', { name: 'Enter Hearthwillow' }).click({ timeout: 120000 });
      console.log('Isolated client entered');
      page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
      await page.waitForFunction(() => {
        for (let el = document.querySelector('canvas'); el; el = el.parentElement) {
          for (let fiber = el[Object.keys(el).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return) {
            for (let hook = fiber.memoizedState; hook; hook = hook.next) {
              const engine = hook.memoizedState?.current;
              if (engine?.travelToMapDestination) { window.e = engine; engine.setQuality('low'); return true; }
            }
          }
        }
      }, null, { timeout: 120000 });
      await page.waitForFunction(() => e.sharedConnected, null, { timeout: 15000 });
      const close = page.getByRole('button', { name: 'Close Hearthwillow chat', exact: true });
      if (await close.count()) await close.click();
      return page;
    }
    const a = await join(), b = await join();
    async function openMap(page) { await page.bringToFront(); await page.locator('canvas').focus(); await page.keyboard.press('m'); await page.locator('.v-map-canvas').waitFor(); }
    for (const page of [a, b]) {
      await openMap(page); await page.locator('[data-map-destination="focus"]').click();
      await page.waitForFunction(() => e.place === 'focus');
    }
    check(await a.evaluate(() => e.place === 'focus') && await b.evaluate(() => e.place === 'focus'), 'Both visitors can use their private focus cottages simultaneously before map travel');
    await openMap(a);
    const destinations = await a.locator('[data-map-destination]').evaluateAll(nodes => nodes.map(node => ({ id: node.dataset.mapDestination, name: node.getAttribute('aria-label') })).filter(value => value.id.includes(':')));
    check(destinations.length === 8, 'Both swings, field, circuit, three farms and owl grove have clickable map buttons');
    for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 1024, height: 640 }, { width: 800, height: 640 }]) {
      await a.setViewportSize(viewport);
      await a.waitForFunction(() => {
        const boxes = [...document.querySelectorAll('[data-map-destination]')].map(node => node.getBoundingClientRect());
        return boxes.every((box, i) => boxes.slice(i + 1).every(other => Math.abs(box.x - other.x) >= 44 || Math.abs(box.y - other.y) >= 44));
      });
      const geometry = await a.locator('[data-map-destination]').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { id: node.dataset.mapDestination, x: r.x, y: r.y, width: r.width, height: r.height }; }));
      check(geometry.every(r => r.width >= 44 && r.height >= 44 && r.x >= 0 && r.y >= 0 && r.x + r.width <= viewport.width && r.y + r.height <= viewport.height), `All map buttons remain reachable and 44 px at ${viewport.width}×${viewport.height}`);
      check(geometry.every((r, i) => geometry.slice(i + 1).every(other => Math.abs(r.x - other.x) >= 44 || Math.abs(r.y - other.y) >= 44)), `Map buttons do not overlap at ${viewport.width}×${viewport.height}`);
    }
    await a.setViewportSize({ width: 1366, height: 768 });
    for (const destination of destinations) {
      const marker = a.locator(`[data-map-destination="${destination.id}"]`);
      await marker.click();
      await a.waitForFunction(id => window.mapMessages.some(message => message.type === 'interaction_result' && message.result.ok && message.result.position) && !document.querySelector('.v-map-canvas'), destination.id);
      const pose = await a.evaluate(() => e.getPlayerPose());
      await b.waitForFunction(({ x, z }) => window.mapMessages.some(message => message.type === 'move' && Math.hypot(message.x - x, message.z - z) < .1), pose);
      check(true, `${destination.name} click moves the real player and broadcasts the accepted position to another client`);
      await openMap(a);
    }
    const owl = a.locator('[data-map-destination^="owls:"]');
    await owl.focus(); await a.keyboard.press('Enter');
    await a.waitForFunction(() => !document.querySelector('.v-map-canvas'));
    check(true, 'Enter activates the focused owl teleport');
    await a.evaluate(() => mapSocket.close());
    await a.waitForFunction(() => !e.sharedConnected);
    const before = await a.evaluate(() => e.getPlayerPose());
    await openMap(a); await a.locator('[data-map-destination^="farm:"]').first().click();
    const after = await a.evaluate(() => e.getPlayerPose());
    check(Math.hypot(before.x - after.x, before.z - after.z) < .01 && await a.locator('.v-map-canvas').isVisible(), 'Disconnected travel preserves the player position and open map');
    await a.waitForFunction(() => e.sharedConnected);
    await a.locator('[data-map-destination^="farm:"]').first().click();
    await a.waitForFunction(() => !document.querySelector('.v-map-canvas'));
    check(true, 'Reconnect restores accepted map travel');
    check(await b.evaluate(() => e.place === 'focus'), 'Travelling out of one private cottage does not alter the other visitor’s private focus');
    check(errors.length === 0, 'Two real clients have no page errors');
    console.log(`${checks.length} isolated map travel checks passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

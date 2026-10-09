// Fault one actual GLB request against an isolated local app and local Worker only.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const target = new URL(process.env.VILLAGE_URL || 'http://127.0.0.1:3051');
target.searchParams.set('sharedTrial', '1');
const url = target.toString();
const worker = process.env.LOCAL_WORKER_URL;
const output = process.env.OUTPUT_DIR || '/tmp/cosy-loading-retry';
const isLocal = value => ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(value).hostname);
assert(isLocal(url) && worker && isLocal(worker), 'Loading retry checks require local VILLAGE_URL and LOCAL_WORKER_URL');
fs.mkdirSync(output, { recursive: true });
const checks = [], pageErrors = [], responses = [];
const check = (ok, label) => { assert(ok, label); checks.push(label); console.log(label); };

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('response', response => { if (response.url().includes('/village/models/spirit.glb')) responses.push(response.status()); });
    await page.addInitScript(localWorker => {
      localStorage.setItem('cosy-village-preferences', JSON.stringify({ quality: 'low', weather: 'golden', weatherMode: 'manual', mix: { enabled: false } }));
      window.loadingTestSockets = [];
      const Native = window.WebSocket;
      window.WebSocket = class extends Native {
        constructor(...args) { super(localWorker, ...args.slice(1)); window.loadingTestSockets.push(this); }
      };
      window.findLoadingTestEngine = () => {
        for (let element = document.querySelector('.v-canvas'); element; element = element.parentElement) {
          const key = Object.keys(element).find(key => key.startsWith('__reactFiber'));
          for (let fiber = element[key]; fiber; fiber = fiber.return) {
            for (const branch of [fiber, fiber.alternate]) for (let hook = branch?.memoizedState; hook; hook = hook.next) {
              const engine = hook.memoizedState?.current;
              if (engine?.renderer?.domElement && engine.loading) return engine;
            }
          }
        }
        return null;
      };
    }, worker);
    if (process.env.EXPORT_DIR) await page.route('http://127.0.0.1:3051/**', route => {
      const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
      const file = path.join(process.env.EXPORT_DIR, pathname.endsWith('/') ? `${pathname}index.html` : pathname);
      return fs.existsSync(file) && fs.statSync(file).isFile() ? route.fulfill({ path: file }) : route.continue();
    });
    let failing = true, releaseFailure;
    const failGate = new Promise(resolve => { releaseFailure = resolve; });
    await page.route('**/village/models/spirit.glb*', async route => {
      if (!failing) return route.fallback();
      await failGate;
      try { await route.fulfill({ status: 503, contentType: 'text/plain', body: 'Isolated loading failure' }); }
      catch { /* A StrictMode probe may already have cancelled its request. */ }
    });
    await page.goto(url);
    await page.waitForFunction(() => {
      const engine = window.findLoadingTestEngine();
      if (!engine || engine.disposed) return false;
      window.loadingBeforeRetry = engine; return true;
    }, null, { timeout: 120000 });
    releaseFailure();
    const retry = page.getByRole('button', { name: 'Retry the village', exact: true });
    await retry.waitFor({ timeout: 120000 });
    check(await page.locator('.v-start-error[role="alert"]').innerText() === 'A village asset could not load. Check your connection, then retry the village.', 'Failed GLB shows functional recovery copy and a real Retry button');
    check(await page.evaluate(() => window.loadingBeforeRetry.disposed && window.loadingBeforeRetry.loading.signal.aborted
      && document.querySelectorAll('.v-canvas canvas').length === 0), 'Failed startup disposes its Engine, aborts sibling work and removes its canvas');
    check(await page.evaluate(() => window.loadingTestSockets.every(socket => socket.readyState === WebSocket.CLOSED)), 'Failed title-screen startup leaves no shared socket');
    await page.screenshot({ path: path.join(output, 'failed-load.png') });
    failing = false;
    await retry.click();
    const enter = page.getByRole('button', { name: 'Enter Hearthwillow', exact: true });
    await enter.waitFor({ timeout: 120000 });
    await page.waitForFunction(() => !document.querySelector('.v-start-enter')?.disabled, null, { timeout: 120000 });
    check(await page.evaluate(() => {
      const engine = window.findLoadingTestEngine(); window.loadingAfterRetry = engine;
      return engine && engine !== window.loadingBeforeRetry && !engine.disposed && engine.world
        && !engine.loading.signal.aborted && !engine.renderer.getContext().isContextLost()
        && document.querySelectorAll('.v-canvas canvas').length === 1;
    }), 'Retry builds one fresh scene and one usable WebGL canvas');
    check(responses.includes(503) && responses.includes(200), 'Retry actually reloads the failed GLB instead of accepting a cached failure');
    await page.screenshot({ path: path.join(output, 'retry-ready.png') });
    await enter.click();
    await page.waitForFunction(() => window.loadingAfterRetry.sharedConnected
      && window.loadingTestSockets.filter(socket => socket.readyState === WebSocket.OPEN).length === 1, null, { timeout: 30000 });
    check(await page.evaluate(() => window.loadingBeforeRetry.disposed && document.querySelectorAll('.v-canvas canvas').length === 1
      && window.loadingTestSockets.filter(socket => [WebSocket.CONNECTING, WebSocket.OPEN].includes(socket.readyState)).length === 1), 'Entering after retry retains one live local shared connection and no stale scene');
    check(pageErrors.length === 0, 'Expected loading failure and retry produce no uncaught page errors');
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ checks, pageErrors, responses }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

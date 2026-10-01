// Regression coverage on the exported React UI and actual WebGL renderer.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = process.env.OUTPUT_DIR || '/tmp/cosy-audit-fixes';
fs.mkdirSync(output, { recursive: true });
const checks = [], errors = [], resources = [];
const check = (ok, label) => { assert(ok, label); checks.push(label); console.log(label); };
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().includes('/village/')) resources.push({ url: response.url(), status: response.status() }); });
    await page.addInitScript(() => localStorage.setItem('cosy-village-preferences', JSON.stringify({ weather: 'golden', weatherMode: 'manual' })));
    await page.goto(process.env.VILLAGE_URL || 'http://127.0.0.1:3051');
    const entry = page.getByRole('button', { name: 'Enter Hearthwillow', exact: true });
    await entry.waitFor({ timeout: 120000 });
    check(errors.length === 0, 'Initial reduced-motion hydration has no React errors');
    check(await page.locator('.page-transition').evaluate(el => { const style = getComputedStyle(el); return el.tagName === 'MAIN' && style.opacity === '1' && style.transform === 'none' && style.filter === 'none'; }), 'Reduced-motion page is visible and still before entry');
    await entry.click();
    await page.waitForFunction(() => {
      for (let el = document.querySelector('canvas'); el; el = el.parentElement)
        for (let fiber = el[Object.keys(el).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return)
          for (let hook = fiber.memoizedState; hook; hook = hook.next) {
            const ref = hook.memoizedState?.current;
            if (ref?.getPerformanceReport && ref.puppies) { window.auditEngine = ref; return true; }
          }
      return false;
    }, null, { timeout: 120000 });
    const startup = await page.evaluate(() => ({
      puppies: auditEngine.puppies.puppies.map(puppy => ({ breed: puppy.info.breed, actions: Object.keys(puppy.animation.actions).sort() })),
      catLoaded: !!auditEngine.cottageCat,
      villageBytes: performance.getEntriesByType('resource').filter(entry => entry.name.includes('/village/')).reduce((sum, entry) => sum + entry.decodedBodySize, 0),
    }));
    const fullKitRequested = resources.some(resource => /\/puppies\.glb/.test(resource.url));
    check(!fullKitRequested && startup.puppies.length === 4, 'Startup loads only the four placed dogs, without the full six-dog kit');
    check(startup.puppies.every(puppy => puppy.actions.length === 10), 'Every placed dog retains all ten animation actions');
    check(!startup.catLoaded && !resources.some(resource => resource.url.includes('cottage-cat.glb')), 'The cottage cat stays outside the entry loading barrier');
    await page.getByRole('button', { name: 'Expand village map', exact: true }).click();
    await page.getByRole('button', { name: /Focus cottage/ }).click();
    await page.waitForFunction(() => !!auditEngine.cottageCat && auditEngine.currentPlace === 'focus');
    check(resources.filter(resource => resource.url.includes('cottage-cat.glb')).length === 1, 'First focus entry loads the private cat once');
    const rendering = await page.evaluate(() => {
      const e = auditEngine, now = performance.now();
      e.renderer.setAnimationLoop(null);
      e.frame(now); // Warm all passes, including shadow allocation.
      e.bridgeWindowTime = now + 100;
      e.frame(now + 16);
      const interior = { ...e.renderer.info.render };
      const passes = [], render = e.renderer.render.bind(e.renderer), reset = e.renderer.info.reset.bind(e.renderer.info);
      let resets = 0;
      e.renderer.info.reset = () => { resets++; reset(); };
      e.renderer.render = (...args) => { render(...args); passes.push({ ...e.renderer.info.render }); };
      e.bridgeWindowTime = -1000;
      e.frame(now + 32);
      const combined = { ...e.renderer.info.render };
      e.renderer.render = render; e.renderer.info.reset = reset;
      e.bridgeWindowTime = now + 100;
      e.frame(now + 48);
      const result = { interior, passes, combined, next: { ...e.renderer.info.render }, resets, autoReset: e.renderer.info.autoReset };
      e.renderer.setAnimationLoop(time => e.frame(time));
      return result;
    });
    check(rendering.passes.length === 2 && rendering.resets === 1 && !rendering.autoReset, 'A cottage frame resets statistics once and counts both render passes');
    check(rendering.combined.calls === rendering.passes[0].calls + rendering.interior.calls
      && rendering.combined.triangles === rendering.passes[0].triangles + rendering.interior.triangles, 'Cottage calls and triangles equal window work plus interior work');
    check(rendering.next.calls === rendering.interior.calls && rendering.next.triangles === rendering.interior.triangles, 'The next frame clears previous work instead of accumulating counters');
    await page.getByRole('button', { name: 'Leave activity', exact: true }).click();
    await page.waitForFunction(() => auditEngine.currentPlace === null);
    await page.waitForTimeout(100); // Reentry follows the Worker's 80 ms action cooldown.
    await page.getByRole('button', { name: 'Expand village map', exact: true }).click();
    await page.getByRole('button', { name: /Focus cottage/ }).click();
    await page.waitForFunction(() => auditEngine.currentPlace === 'focus' && !document.querySelector('[role="dialog"]'));
    check(resources.filter(resource => resource.url.includes('cottage-cat.glb')).length === 1, 'Reentering focus reuses the same private cat');
    await page.screenshot({ path: path.join(output, 'reduced-motion-focus.png') });
    check(errors.length === 0 && resources.every(resource => resource.status === 200), 'No captured page errors or failed village resources');
    await page.close();
    const openCottage = async client => {
      await client.getByRole('button', { name: 'Expand village map', exact: true }).click();
      await client.getByRole('button', { name: /Focus cottage/ }).click();
    };
    const freshClient = async () => {
      const client = await browser.newPage({ viewport: { width: 1366, height: 768 } });
      client.on('pageerror', error => errors.push(error.message));
      await client.goto(process.env.VILLAGE_URL || 'http://127.0.0.1:3051');
      await client.getByRole('button', { name: 'Enter Hearthwillow', exact: true }).click({ timeout: 120000 });
      await client.waitForFunction(() => {
        for (let el = document.querySelector('canvas'); el; el = el.parentElement)
          for (let fiber = el[Object.keys(el).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return)
            for (let hook = fiber.memoizedState; hook; hook = hook.next) {
              const ref = hook.memoizedState?.current;
              if (ref?.getPerformanceReport && ref.puppies) { window.auditEngine = ref; return true; }
            }
        return false;
      });
      return client;
    };
    const retryClient = await freshClient();
    let attempts = 0;
    await retryClient.route('**/cottage-cat.glb*', route => ++attempts === 1 ? route.abort() : route.continue());
    await openCottage(retryClient);
    await retryClient.getByText("The cottage cat couldn't load. Leave and return to try again.", { exact: true }).waitFor();
    check(await retryClient.evaluate(() => auditEngine.currentPlace === 'focus' && !auditEngine.cottageCat), 'A failed optional cat request leaves the private cottage usable with retry guidance');
    await retryClient.getByRole('button', { name: 'Leave activity', exact: true }).click();
    await retryClient.waitForFunction(() => auditEngine.currentPlace === null);
    await retryClient.waitForTimeout(100);
    await openCottage(retryClient);
    await retryClient.waitForFunction(() => !!auditEngine.cottageCat);
    check(attempts === 2, 'Returning to the cottage retries a failed cat request successfully');
    await retryClient.close();
    const disposedClient = await freshClient();
    let release;
    let requested;
    const requestSeen = new Promise(resolve => { requested = resolve; });
    await disposedClient.route('**/cottage-cat.glb*', async route => {
      requested(); await new Promise(resolve => { release = resolve; }); await route.continue();
    });
    await openCottage(disposedClient); await requestSeen;
    await disposedClient.evaluate(() => auditEngine.dispose());
    release();
    await disposedClient.waitForFunction(() => !auditEngine.cottageCatLoading);
    check(await disposedClient.evaluate(() => auditEngine.disposed && !auditEngine.cottageCat), 'A cat request completed after disposal cannot attach a new cat');
    check(errors.length === 0, 'Optional asset failure, retry and disposal produce no uncaught page errors');
    await disposedClient.close();
    fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ checks, startup, rendering, errors, resources }, null, 2));
    console.log(JSON.stringify({ startup, rendering }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

// Actual exported title menus, pre-entry boundaries and transition to the shared village.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
assert(process.env.EXPORT_DIR, 'Set EXPORT_DIR to a freshly built local export');
const root = path.resolve(process.env.EXPORT_DIR);
const output = process.env.OUTPUT_DIR || '/tmp/cosy-onboarding-browser';
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-features=LocalNetworkAccessChecks'] });
  const checks = [], errors = [];
  const check = (value, name) => { assert(value, name); checks.push(name); console.log(name); };
  async function visit(options = {}, init, holdLayout = false) {
    const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1366, height: 768 }, ...options });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http://127.0.0.1:3051/**', route => {
      const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
      const file = path.resolve(root, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404 });
      const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
      return route.fulfill({ path: file, contentType: mime[path.extname(file)] || 'application/octet-stream' });
    });
    if (holdLayout) {
      let released = false, release;
      await page.route('**/village/world-layout.json', async route => {
        if (!released) await new Promise(resolve => { release = resolve; });
        await route.fallback();
      });
      page.releaseLayout = () => { released = true; release?.(); };
    }
    await page.addInitScript(() => {
      window.socketCount = 0; window.audioStarts = 0;
      const socket = window.WebSocket;
      window.WebSocket = class extends socket { constructor(...args) { super(...args); window.socketCount++; } };
      const audio = window.AudioContext;
      window.AudioContext = class extends audio { constructor(...args) { super(...args); window.audioStarts++; } };
    });
    if (init) await page.addInitScript(init);
    await page.goto('http://127.0.0.1:3051');
    return page;
  }
  async function engine(page) {
    await page.waitForFunction(() => {
      for (let el = document.querySelector('canvas'); el; el = el.parentElement)
        for (let fiber = el[Object.keys(el).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return)
          for (const branch of [fiber, fiber.alternate]) for (let hook = branch?.memoizedState; hook; hook = hook.next) {
            const ref = hook.memoizedState?.current;
            if (ref?.setTitleScreen && ref?.setSharedActors) window.e = ref;
          }
      return !!window.e;
    });
  }
  async function ready(page) { await page.waitForFunction(() => document.querySelector('.v-start-phase-menu .v-enter-button')?.disabled === false, null, { timeout: 120000 }); await engine(page); }
  const tab = (page, name) => page.locator('.v-settings-tabs').getByRole('button', { name, exact: true });
  const prefs = page => page.evaluate(() => JSON.parse(localStorage.getItem('cosy-village-preferences')));
  try {
    const a = await visit({}, () => {
      if (!localStorage.getItem('cosy-village-preferences')) localStorage.setItem('cosy-village-preferences', JSON.stringify({ weather: 'golden', weatherMode: 'manual' }));
    }, true);
    await a.locator('.v-title-loading').waitFor();
    check(await a.locator('.v-title-loading').evaluate(element => {
      const r = element.getBoundingClientRect();
      return Math.abs(r.width - innerWidth) < 1 && Math.abs(r.height - innerHeight) < 1 && !/\d|%/.test(element.innerText);
    }), 'Loading fills the screen with only Hearthwillow and a number-free progress bar');
    check(await a.locator('.v-start-reveal').getAttribute('inert') !== null && await a.evaluate(() => socketCount === 0), 'Menu is inaccessible during loading and no shared connection starts');
    await a.screenshot({ path: path.join(output, 'fullscreen-loading.png') });
    for (const [width, height] of [[810,1080], [1080,810], [820,1180], [1180,820], [744,1133], [1133,744]]) {
      await a.setViewportSize({ width, height });
      check(await a.locator('.v-title-loading').evaluate(element => {
        const r = element.getBoundingClientRect(); return Math.abs(r.width-innerWidth)<1 && Math.abs(r.height-innerHeight)<1;
      }), `${width}×${height}: loading covers the iPad viewport`);
    }
    await a.setViewportSize({ width: 1366, height: 768 });
    const fade = a.locator('.v-start-phase-fading').waitFor({ timeout: 120000 });
    a.releaseLayout(); await fade;
    check(await a.locator('.v-start-reveal').getAttribute('inert') !== null, 'The soft reveal keeps controls inert until the fade completes');
    await ready(a);
    check(await a.locator('.v-start-menu button').count() === 3 && await a.locator('.v-header').count() === 0, 'Title screen presents three menu choices without gameplay controls');
    check(await a.evaluate(() => socketCount === 0 && audioStarts === 0 && e.blocked && e.titleScreen), 'Title screen neither joins the shared world nor starts sound, and gameplay is blocked');
    check(await a.locator('canvas').getAttribute('tabindex') === '-1', 'Backdrop canvas is excluded from first-use keyboard navigation');
    const position = await a.evaluate(() => e.camera.position.toArray());
    await a.waitForTimeout(1600);
    check(await a.evaluate(position => e.camera.position.distanceTo({ x: position[0], y: position[1], z: position[2] }) > .05, position), 'Existing village backdrop camera moves gently');
    await a.locator('.v-enter-button').focus(); await a.keyboard.press('ArrowDown');
    check(await a.locator('[data-start-panel="language"]').evaluate(button => button === document.activeElement), 'ArrowDown selects Language');
    await a.keyboard.press('End'); await a.keyboard.press('Home');
    check(await a.locator('.v-enter-button').evaluate(button => button === document.activeElement), 'Home and End navigate the menu');
    await a.keyboard.press('s'); await a.keyboard.press('e');
    check(await a.locator('.v-language-menu').isVisible(), 'S navigates to Language and E opens it');
    await a.getByRole('button', { name: 'English', exact: true }).focus();
    await a.keyboard.press('d'); await a.keyboard.press('e');
    check(await a.locator('html').getAttribute('lang') === 'ja', 'D navigates language choices and E selects Japanese');
    await a.keyboard.press('a'); await a.keyboard.press('e');
    check(await a.locator('html').getAttribute('lang') === 'en', 'A returns to English and E selects it');
    await a.keyboard.press('Escape');
    await a.locator('[data-start-panel="language"]').click();
    await a.getByRole('button', { name: '日本語', exact: true }).click();
    check(await a.locator('html').getAttribute('lang') === 'ja' && (await prefs(a)).language === 'ja', 'Language applies and persists immediately before entry');
    await a.screenshot({ path: path.join(output, 'language-japanese.png') });
    await a.keyboard.press('Escape');
    await a.waitForFunction(() => document.activeElement?.matches('[data-start-panel="language"]'));
    check(await a.locator('[data-start-panel="language"]').evaluate(button => button === document.activeElement), 'Escape returns focus to the Language menu button');
    await a.locator('[data-start-panel="language"]').click(); await a.getByRole('button', { name: 'English', exact: true }).click(); await a.keyboard.press('Escape');
    for (const [width, height] of [[1366, 768], [1280, 800], [900, 640], [768, 1024], [744, 1133], [500, 640]]) {
      await a.setViewportSize({ width, height });
      check(await a.locator('.v-start').evaluate(element => [...element.querySelectorAll('h1, button, .v-start-hint')].every(item => {
        const r = item.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight;
      })), `${width}×${height}: title, menu and guidance stay inside the viewport`);
      check(await a.locator('.v-start-menu button').evaluateAll(buttons => buttons.every(button => button.getBoundingClientRect().height >= 44)), `${width}: starter menu retains touch-sized buttons`);
      await a.screenshot({ path: path.join(output, `title-${width}x${height}.png`) });
      await a.locator('[data-start-panel="settings"]').click();
      for (const name of ['Experience', 'Sound', 'Controls']) {
        await tab(a, name).click();
        check(await a.locator('.v-settings-content').evaluate(element => element.scrollTop === 0), `${width}: ${name} starts at the top after switching sections`);
        check(await a.locator('.v-start-dialog').evaluate(element => {
          const r = element.getBoundingClientRect(), body = element.querySelector('.v-settings-content');
          return r.top >= 0 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight
            && body.scrollWidth <= body.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 2;
        }), `${width}×${height}: ${name} menu stays contained with a scrolling body`);
        await a.locator('.v-settings-content').evaluate(element => { element.scrollTop = element.scrollHeight; });
      }
      if (width === 1366) await a.screenshot({ path: path.join(output, 'settings-controls.png') });
      await a.keyboard.press('Escape');
      await a.waitForFunction(() => document.activeElement?.matches('[data-start-panel="settings"]'));
      check(await a.locator('[data-start-panel="settings"]').evaluate(button => button === document.activeElement), `${width}: closing Settings restores menu focus`);
    }
    await a.setViewportSize({ width: 1366, height: 768 });
    await a.locator('[data-start-panel="settings"]').click();
    await tab(a, 'Experience').focus(); await a.keyboard.press('d'); await a.keyboard.press('e');
    check(await tab(a, 'Sound').getAttribute('aria-pressed') === 'true', 'D and E navigate and activate Settings tabs');
    await tab(a, 'Experience').click();
    await a.getByLabel('Time & weather', { exact: true }).selectOption('night');
    await a.getByLabel('Graphics', { exact: true }).selectOption('high');
    await tab(a, 'Sound').click();
    await a.getByRole('button', { name: 'Turn sound on', exact: true }).click();
    await a.getByRole('button', { name: 'Turn sound off', exact: true }).click({ timeout: 60000 });
    await a.keyboard.press('Escape');
    await a.reload(); await ready(a);
    check((await prefs(a)).weather === 'night' && (await prefs(a)).quality === 'high', 'Pre-entry weather and graphics survive reload');
    await a.locator('[data-start-panel="settings"]').click(); await tab(a, 'Experience').click();
    await a.getByLabel('Time & weather', { exact: true }).selectOption('golden'); await a.getByLabel('Graphics', { exact: true }).selectOption('low');
    await tab(a, 'Sound').click(); await a.getByRole('button', { name: 'Turn sound on', exact: true }).click();
    await a.getByRole('button', { name: 'Turn sound off', exact: true }).click({ timeout: 60000 });
    await a.keyboard.press('Escape');
    await engine(a);
    const audioStarts = await a.evaluate(() => window.audioStarts);
    await a.locator('.v-enter-button').click();
    await a.waitForFunction(() => e.sharedConnected, null, { timeout: 30000 }).catch(async error => { console.log(await a.evaluate(() => ({title:!!document.querySelector('.v-start'),connected:e.sharedConnected,blocked:e.blocked,sockets:socketCount,notice:document.querySelector('.v-notice')?.textContent}))); throw error; });
    check(await a.locator('.v-start').count() === 0 && await a.evaluate(() => !e.titleScreen && e.blocked && socketCount > 0), 'Entry joins the Worker while the welcome guide pauses local movement');
    await a.locator('[data-tutorial-done]').click();
    await a.waitForFunction(() => !e.blocked && !document.querySelector('.v-dialog'));
    check(await a.evaluate(count => audioStarts === count, audioStarts), 'Entering respects a deliberate pre-entry sound-off choice');
    check(await a.locator('canvas').evaluate(canvas => canvas === document.activeElement && canvas.tabIndex === 0), 'Entry gives keyboard focus to the gameplay canvas');
    await a.locator('canvas').focus(); await a.keyboard.press(',');
    check(await a.locator('.v-settings-dialog').isVisible(), 'The same settings remain available during gameplay');
    await tab(a, 'Experience').focus(); await a.keyboard.press('s'); await a.keyboard.press('e');
    check(await tab(a, 'Sound').getAttribute('aria-pressed') === 'true', 'Gameplay Settings also supports S and E');
    await a.keyboard.press('Escape');
    await a.context().close();
    const touch = await visit({ hasTouch: true, viewport: { width: 820, height: 1180 }, reducedMotion: 'reduce', locale: 'ja-JP' });
    await ready(touch);
    check(await touch.locator('html').getAttribute('lang') === 'ja' && (await touch.locator('.v-start-hint').innerText()).includes('スティック'), 'Fresh Japanese touch browser has Japanese menus and thumbstick guidance');
    const staticCamera = await touch.evaluate(() => e.camera.position.toArray()); await touch.waitForTimeout(1200);
    check(await touch.evaluate(previous => e.camera.position.toArray().every((value, index) => value === previous[index]), staticCamera), 'Reduced motion keeps the title camera still');
    await touch.screenshot({ path: path.join(output, 'title-touch-japanese.png') }); await touch.context().close();
    const remapped = await visit({ reducedMotion: 'reduce' }, () => localStorage.setItem('cosy-village-preferences', JSON.stringify({ keybindings: { forward: '[', interact: ']' } })));
    await ready(remapped); await remapped.locator('[data-start-panel="settings"]').focus();
    await remapped.keyboard.press('[');
    check(await remapped.locator('[data-start-panel="language"]').evaluate(button => button === document.activeElement), 'Saved movement bindings navigate the menu');
    await remapped.keyboard.press(']');
    check(await remapped.locator('.v-language-menu').isVisible(), 'Saved interaction binding opens the selected menu');
    await remapped.context().close();
    const fail = await visit({}, () => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (name, ...args) {
        if (!window.allowWebGL && name.startsWith('webgl')) return null;
        return getContext.call(this, name, ...args);
      };
    });
    await fail.getByRole('button', { name: 'Retry the village', exact: true }).waitFor({ timeout: 60000 });
    await fail.locator('[data-start-panel="settings"]').click();
    check(await fail.locator('.v-start-dialog').isVisible() && await fail.evaluate(() => socketCount === 0), 'Graphics failure still allows Settings without joining the world');
    await fail.keyboard.press('Escape'); await fail.evaluate(() => { window.allowWebGL = true; });
    await fail.getByRole('button', { name: 'Retry the village', exact: true }).click(); await ready(fail);
    check(await fail.getByRole('button', { name: 'Enter Hearthwillow', exact: true }).isEnabled(), 'Retry recovers the actual 3D village after a graphics failure');
    await fail.context().close();
    check(errors.length === 0, `No page errors (${errors.join('; ')})`);
    fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ checks, errors }, null, 2));
    console.log(`${checks.length} actual onboarding browser checks passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

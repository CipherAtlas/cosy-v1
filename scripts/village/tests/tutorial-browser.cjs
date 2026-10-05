// Actual welcome guide, persistent preferences and keyboard back navigation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
assert(process.env.EXPORT_DIR, 'Set EXPORT_DIR to a freshly built local export');
const root = path.resolve(process.env.EXPORT_DIR);
const output = process.env.OUTPUT_DIR || '/tmp/cosy-tutorial-browser';
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
  const tab = (p, n) => p.locator('.v-settings-tabs').getByRole('button', { name: n, exact: true });
  const prefs = p => p.evaluate(() => JSON.parse(localStorage.getItem('cosy-village-preferences')));
  const closed = p => p.waitForFunction(() => !document.querySelector('.v-dialog') && document.activeElement !== document.body);
  const start = async p => { await ready(p); await p.locator('.v-enter-button').click(); await p.locator('.v-tutorial').waitFor(); await p.waitForFunction(() => e.sharedConnected, null, { timeout: 30000 }); };
  try {
    const a = await visit(); await ready(a);
    await a.locator('[data-start-panel="language"]').click(); await a.keyboard.press('Backspace');
    // A rapid second key must not enter through a still-closing portal.
    await a.keyboard.press('e');
    check(await a.evaluate(() => socketCount===0 && !!document.querySelector('.v-start')), 'A rapid next key keeps the title without entering through back navigation');
    if (await a.locator('.v-dialog[data-state="open"]').count()) await a.keyboard.press('Escape');
    await closed(a);
    check(await a.locator('.v-start').count() === 1 && await a.evaluate(() => socketCount === 0), 'Backspace closes Language without activating the title through its closing portal');
    await a.locator('[data-start-panel="settings"]').click(); await a.keyboard.press('Escape'); await closed(a);
    check(await a.locator('[data-start-panel="settings"]').evaluate(b => b === document.activeElement), 'Escape returns Settings focus to the starter button');
    await start(a);
    check(await a.evaluate(() => e.blocked && !e.titleScreen), 'Fresh entry shows the guide while joining the real shared village and pausing local movement');
    check(await a.locator('.v-tutorial-dialog h2').evaluate(h => h === document.activeElement) && await a.locator('.v-tutorial').evaluate(el => el.scrollTop === 0), 'Guide focuses its heading and starts at the top');
    check(await a.locator('.v-tutorial-sections section').count() === 4, 'Guide covers movement, activities, chat and Settings in four short sections');
    check(await a.locator('.v-tutorial kbd.v-key-group').first().evaluate(el => getComputedStyle(el).paddingLeft === '8px' && getComputedStyle(el).paddingRight === '8px'), 'Guide grouped keycaps keep side padding');
    for (const [width,height] of [[1366,768],[1280,800],[900,640],[500,640],[810,1080],[1080,810],[820,1180],[1180,820],[744,1133],[1133,744]]) {
      await a.setViewportSize({width,height});
      check(await a.locator('.v-tutorial-dialog').evaluate(el => { const r=el.getBoundingClientRect(), body=el.querySelector('.v-tutorial'); return r.left>=0 && r.top>=0 && r.right<=innerWidth && r.bottom<=innerHeight && body.scrollWidth<=body.clientWidth+1 && el.scrollHeight<=el.clientHeight+1; }), `${width}×${height}: guide stays contained with its own reading scroll`);
      await a.locator('[data-tutorial-done]').scrollIntoViewIfNeeded();
      check(await a.locator('[data-tutorial-done]').evaluate(b => b.getBoundingClientRect().height>=44 && b.getBoundingClientRect().bottom<=innerHeight), `${width}: guide keeps its comfortable start target visible`);
      if(width===1366 || width===744) { await a.locator('.v-tutorial').evaluate(el => el.scrollTop=0); await a.screenshot({path:path.join(output,`guide-${width}x${height}.png`)}); }
    }
    await a.setViewportSize({width:1366,height:768});
    await a.locator('.v-tutorial-dialog h2').focus(); await a.keyboard.press('e'); await closed(a);
    check(await a.evaluate(() => !e.blocked && document.activeElement?.tagName === 'CANVAS'), 'E finishes the welcome guide and restores gameplay focus');
    await a.keyboard.press('m'); await a.locator('.v-map-dialog').waitFor();
    check(await a.locator('[data-menu-back]').evaluate(b => {const r=b.getBoundingClientRect();return r.height>=44&&r.right<=innerWidth&&r.top>=0}), 'Map Back stays visible with a comfortable target');
    await a.keyboard.press('Backspace'); await closed(a);
    check(await a.locator('canvas').evaluate(c=>c===document.activeElement), 'Backspace returns from the map to the scene');
    await a.keyboard.press('i'); await a.locator('.v-dialog').waitFor(); await a.keyboard.press('Backspace'); await closed(a);
    check(await a.locator('canvas').evaluate(c=>c===document.activeElement), 'Backspace leaves the inventory menu');
    await a.keyboard.press('o'); await a.locator('.v-dialog').waitFor(); await a.keyboard.press('Escape'); await closed(a);
    check(await a.locator('canvas').evaluate(c=>c===document.activeElement), 'Escape leaves the sound menu');
    await a.keyboard.press(','); await a.getByLabel("Don't show tutorial",{exact:true}).focus(); await a.keyboard.press('e');
    check((await prefs(a)).dontShowTutorial === true, 'E toggles the Settings checkbox and saves tutorial opt-out');
    await a.locator('[data-show-tutorial]').click(); await a.locator('.v-tutorial').waitFor();
    check(await a.getByLabel("Don't show tutorial",{exact:true}).isChecked(), 'Manual guide remains available when automatic tutorials are hidden');
    await a.keyboard.press('Backspace'); await a.locator('[data-show-tutorial]').waitFor();
    check(await a.locator('[data-show-tutorial]').evaluate(b => b===document.activeElement), 'Backspace returns a manually opened guide to Settings and restores the opening control');
    await tab(a,'Controls').click(); const slider=a.getByLabel('Mouse sensitivity',{exact:true}); await slider.focus(); await a.keyboard.press('Backspace');
    check(await a.locator('.v-settings-dialog').isVisible(), 'Backspace in a native field preserves editing instead of leaving Settings');
    await a.getByRole('button',{name:'Change key for move forward',exact:true}).click(); await a.keyboard.press('Escape');
    check(await a.locator('.v-settings-dialog').isVisible() && await a.locator('.is-capturing').count()===0, 'Escape first cancels key capture without closing Settings');
    await a.getByRole('button',{name:'Change key for move forward',exact:true}).click(); await a.keyboard.press('[');
    await a.keyboard.press('Escape'); await closed(a);
    await a.reload(); await ready(a); await a.locator('.v-enter-button').click(); await engine(a); await a.waitForFunction(()=>e.sharedConnected && !e.blocked,null,{timeout:30000});
    check(await a.locator('.v-tutorial').count()===0, 'Saved opt-out prevents the guide from opening on the next entry');
    await a.keyboard.press(','); await a.getByLabel('Language',{exact:true}).selectOption('ja'); await a.locator('[data-show-tutorial]').click();
    check(await a.locator('.v-tutorial-dialog h2').innerText()==='ハースウィローへようこそ' && (await a.locator('.v-tutorial').innerText()).includes('急がなくて大丈夫'), 'Guide and preference switch to authored Japanese');
    check((await a.locator('.v-tutorial kbd.v-key-group').first().innerText()).includes('['), 'Guide keycaps reflect the saved movement binding');
    for (const [width,height] of [[810,1080],[1080,810],[820,1180],[1180,820],[744,1133],[1133,744],[900,640],[500,640]]) {
      await a.setViewportSize({width,height});
      check(await a.locator('.v-tutorial-dialog').evaluate(el => { const r=el.getBoundingClientRect(), body=el.querySelector('.v-tutorial'); return r.left>=0 && r.top>=0 && r.right<=innerWidth && r.bottom<=innerHeight && body.scrollWidth<=body.clientWidth+1 && el.scrollHeight<=el.clientHeight+1; }), `${width}×${height}: Japanese guide remains contained and readable`);
    }
    await a.setViewportSize({width:744,height:1133}); await a.screenshot({path:path.join(output,'guide-japanese.png')});
    await a.keyboard.press('Escape'); await a.locator('[data-show-tutorial]').waitFor();
    await a.getByLabel('チュートリアルを表示しない',{exact:true}).uncheck();
    check((await prefs(a)).dontShowTutorial === false, 'Unchecking the Japanese preference restores future automatic guides');
    await a.keyboard.press('Escape'); await closed(a); await a.reload(); await ready(a); await a.locator('.v-enter-button').click(); await a.locator('.v-tutorial').waitFor();
    check(await a.locator('.v-tutorial-dialog h2').innerText()==='ハースウィローへようこそ', 'Guide returns after re-enabling it and keeps saved Japanese');
    await a.context().close();
    const b=await visit({hasTouch:true,locale:'ja-JP',reducedMotion:'reduce',viewport:{width:820,height:1180}}); await start(b);
    check((await b.locator('.v-tutorial').innerText()).includes('左のスティック') && (await b.locator('.v-tutorial').innerText()).includes('タップ'), 'Fresh Japanese touch guide explains thumbstick, dragging and tapping');
    await b.getByLabel('チュートリアルを表示しない',{exact:true}).check(); await b.keyboard.press('Backspace'); await closed(b);
    check(await b.locator('canvas').evaluate(c => c === document.activeElement), 'Backspace leaves the touch guide and restores the scene');
    await b.keyboard.press(','); await b.locator('select').last().selectOption('en'); await b.locator('[data-show-tutorial]').click();
    check((await b.locator('.v-tutorial').innerText()).includes('left thumbstick'), 'English touch guide explains the same touch controls');
    await b.context().close();
    const remapped=await visit({reducedMotion:'reduce'}, () => localStorage.setItem('cosy-village-preferences', JSON.stringify({keybindings:{map:'shift',run:'m'}})));
    await start(remapped);
    check(await remapped.locator('.v-tutorial-sections section').nth(1).locator('kbd').innerText()==='Shift', 'Guide displays a saved named-key binding');
    check(await remapped.locator('.v-tutorial-sections section').nth(1).locator('kbd').evaluate(el => el.getBoundingClientRect().width>28 && el.scrollWidth<=el.clientWidth && getComputedStyle(el).paddingLeft==='8px' && getComputedStyle(el).paddingRight==='8px'), 'Named-key keycaps expand with padding instead of clipping');
    await remapped.locator('.v-tutorial-dialog h2').focus(); await remapped.keyboard.press('e'); await closed(remapped); await remapped.keyboard.press('Shift'); await remapped.locator('.v-map-dialog').waitFor();
    check(true, 'The displayed named binding opens the map');
    await remapped.keyboard.press('Backspace'); await closed(remapped); await remapped.context().close();
    check(errors.length===0, `No guide page errors (${errors.join('; ')})`);
    fs.writeFileSync(path.join(output,'checks.json'),JSON.stringify({checks,errors},null,2));console.log(`${checks.length} guide/back browser checks passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });

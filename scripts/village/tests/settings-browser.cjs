// Actual exported settings, saved rebindings and shared action boundaries.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const output = process.env.OUTPUT_DIR || path.resolve('docs/village/evidence/settings-20261004');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-features=LocalNetworkAccessChecks'] });
  const checks = [], errors = [], pages = [];
  const check = (ok, label) => { assert(ok, label); checks.push(label); console.log(label); };
  async function join() {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } }); pages.push(page);
    page.on('pageerror', error => errors.push(error.message));
    if (process.env.EXPORT_DIR) await page.route('http://127.0.0.1:3051/**', route => {
      const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
      const file = path.resolve(process.env.EXPORT_DIR, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
      if (!file.startsWith(path.resolve(process.env.EXPORT_DIR) + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary' };
      return route.fulfill({ path: file, contentType: mime[path.extname(file)] || 'application/octet-stream' });
    });
    await page.addInitScript(() => {
      if (!localStorage.getItem('cosy-village-preferences')) localStorage.setItem('cosy-village-preferences', JSON.stringify({ weather: 'golden', weatherMode: 'manual' }));
    });
    await page.goto('http://127.0.0.1:3051');
    await enter(page); return page;
  }
  async function enter(page) {
    await page.getByRole('button', { name: 'Enter Hearthwillow', exact: true }).click({ timeout: 120000 });
    await page.waitForFunction(() => {
      for (let el = document.querySelector('canvas'); el; el = el.parentElement)
        for (let fiber = el[Object.keys(el).find(k => k.startsWith('__reactFiber'))]; fiber; fiber = fiber.return)
          for (const branch of [fiber, fiber.alternate]) for (let hook = branch?.memoizedState; hook; hook = hook.next) {
            const ref = hook.memoizedState?.current;
            if (ref?.setSharedActors && ref?.setKeybindings) window.e = ref;
          }
      return window.e?.sharedConnected;
    }, null, { timeout: 30000 });
  }
  const tab = (page, name) => page.locator('.v-settings-tabs').getByRole('button', { name, exact: true });
  async function settings(page, key = ',') { await page.locator('canvas').focus(); await page.keyboard.press(key); await page.locator('.v-settings-dialog').waitFor(); }
  async function bind(page, label, key) { await page.getByRole('button', { name: `Change key for ${label}`, exact: true }).click(); await page.keyboard.press(key); }
  try {
    const a = await join();
    await settings(a);
    check(await tab(a, 'Experience').getAttribute('aria-pressed') === 'true', 'Settings opens the experience section');
    await a.getByLabel('Graphics', { exact: true }).selectOption('high');
    check(await a.evaluate(() => e.quality === 'high'), 'Graphics applies to the live scene');
    await tab(a, 'Sound').click();
    for (const [key, expected] of [['music', '.15'], ['ambience', '.54'], ['effects', '.75']]) {
      check(Number(await a.getByRole('slider', { name: `${key} volume`, exact: true }).inputValue()) === Number(expected), `${key}: requested sound default`);
    }
    await a.getByRole('slider', { name: 'music volume', exact: true }).fill('0.27');
    await a.getByRole('button', { name: 'Reset sound', exact: true }).click();
    check(Number(await a.getByRole('slider', { name: 'music volume', exact: true }).inputValue()) === .15, 'Sound reset affects only the sound mix');
    await a.getByText('River & wind', { exact: true }).click();
    await a.getByRole('slider', { name: 'wind volume', exact: true }).fill('0.42');
    check(await a.evaluate(() => JSON.parse(localStorage.getItem('cosy-village-preferences')).mix.wind === .42), 'Advanced wind adjustment saves');
    await tab(a, 'Controls').click();
    await a.getByRole('slider', { name: 'Mouse sensitivity', exact: true }).fill('1.35');
    await bind(a, 'move forward', 'l');
    check(await a.evaluate(() => e.keybindings.forward === 'l'), 'A changed movement key reaches the live engine');
    await bind(a, 'move forward', 'i');
    check(await a.locator('.v-binding-status').innerText().then(text => text.includes('harvest basket')), 'A duplicate key explains its existing action');
    await a.getByRole('button', { name: 'Swap keys', exact: true }).focus(); await a.keyboard.press('Enter');
    check(await a.evaluate(() => e.keybindings.forward === 'i' && e.keybindings.inventory === 'l'), 'Keyboard activation explicitly swaps conflicting keys');
    await bind(a, 'move forward', '=');
    await a.getByRole('button', { name: 'Change key for move left', exact: true }).click();
    await a.keyboard.press('ArrowUp');
    check(await a.locator('.v-binding-status').innerText().then(text => text.includes('Choose a letter')), 'Navigation keys cannot be taken by a gameplay binding');
    await a.keyboard.press('Escape');
    check(await a.locator('.v-settings-dialog').isVisible(), 'Escape cancels key capture before closing Settings');
    await a.getByText('Menus', { exact: true }).click();
    await bind(a, 'village map', 'y');
    await bind(a, 'settings', '.');
    await a.getByText('Interactions', { exact: true }).click();
    await bind(a, 'interact / pet / sit', 'n');
    await bind(a, 'talk / feed / tend', ';');
    await bind(a, 'jump / brake / pause', '/');
    check(await a.evaluate(() => e.keybindings.jump === '/'), 'Jump and activity pause share the edited key');
    await a.locator('.v-settings-content').evaluate(el => { el.querySelectorAll('.v-binding-group').forEach((details,index) => details.open=index===0); el.scrollTop=0; });
    for (const [width, height] of [[1366, 768], [1280, 720], [1024, 640], [800, 640]]) {
      await a.setViewportSize({ width, height });
      await a.waitForTimeout(220);
      check(await a.locator('.v-settings-dialog').evaluate(el => {
        const rect = el.getBoundingClientRect(), content = el.querySelector('.v-settings-content');
        return rect.x >= 0 && rect.y >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight
          && el.scrollHeight <= el.clientHeight + 2 && content.scrollWidth <= content.clientWidth + 2;
      }), `Settings stays contained with an independently scrolling body at ${width}×${height}`);
      check(await a.locator('.v-settings-tabs button, .v-binding-row button').evaluateAll(buttons => buttons.filter(button => button.getClientRects().length > 0).every(button => button.getBoundingClientRect().height >= 44)), `${width}: tabs and key buttons retain 44 px targets`);
      await a.screenshot({ path: `${output}/controls-${width}.png` });
    }
    await a.setViewportSize({ width: 1366, height: 768 });
    await tab(a, 'Experience').click(); await a.screenshot({ path: `${output}/experience.png` });
    await tab(a, 'Sound').click(); await a.screenshot({ path: `${output}/sound.png` });
    await a.keyboard.press('Escape');
    await a.waitForFunction(() => !e.blocked);
    check(await a.getByRole('button', { name: 'Expand village map', exact: true }).getAttribute('aria-keyshortcuts') === 'Y', 'The map button exposes its actual reassigned shortcut');
    check(await a.locator('.v-walk-hints').innerText().then(text => text.includes('N')), 'Visible interaction keycaps follow the binding');
    await a.locator('canvas').focus(); await a.keyboard.press(',');
    check(await a.locator('.v-settings-dialog').count() === 0, 'The previous settings key stops opening its menu');
    await settings(a, '.'); await a.keyboard.press('Escape');
    await a.evaluate(() => {
      const points = [];
      for (let x = -35; x <= 35; x += 5) for (let z = -25; z <= 25; z += 5) points.push([x,z]);
      const point = points.find(([x,z]) => [[0,0],[0,2],[0,-2],[2,0],[-2,0]].every(([dx,dz]) => e.movement.clear(x+dx,z+dz)));
      if (!point) throw Error('No clear movement fixture'); e.movement.settle(...point);
    });
    await a.waitForTimeout(350); await a.locator('canvas').focus();
    const pose = () => a.evaluate(() => [e.player.position.x,e.player.position.z]);
    let before = await pose(); await a.keyboard.down('w'); await a.waitForTimeout(350); await a.keyboard.up('w'); let after = await pose();
    check(Math.hypot(after[0]-before[0],after[1]-before[1]) < .05, 'The old forward key no longer moves the visitor');
    before = await pose(); await a.keyboard.down('='); await a.waitForTimeout(450); await a.keyboard.up('='); after = await pose();
    check(Math.hypot(after[0]-before[0],after[1]-before[1]) > .2, 'The rebound forward key moves the actual visitor');
    check(await a.evaluate(() => !e.keys.has('w')), 'Releasing the edited movement key clears its held action');
    await a.reload(); await enter(a);
    check(await a.evaluate(() => e.keybindings.forward === '=' && e.keybindings.interact === 'n' && e.keybindings.settings === '.'), 'Custom keys survive a full browser reload');
    check(await a.evaluate(() => e.quality === 'high'), 'The chosen graphics setting survives reload');
    await settings(a, '.'); await tab(a, 'Controls').click();
    check(Number(await a.getByRole('slider', { name: 'Mouse sensitivity', exact: true }).inputValue()) === 1.35, 'Mouse sensitivity survives reload');
    await a.keyboard.press('Escape');
    const b = await join();
    check(await b.evaluate(() => e.keybindings.interact === 'e'), 'A second visitor keeps independent default keys');
    const cow = await a.evaluate(() => e.sharedActors.town.animals.find(a => a.species === 'cow' && !a.owner).id);
    await a.bringToFront();
    await a.evaluate(id => {
      const animal=e.sharedActors.town.animals.find(a=>a.id===id);
      const point=Array.from({length:16},(_,i)=>[animal.x+Math.cos(i*Math.PI/8)*1.8,animal.z+Math.sin(i*Math.PI/8)*1.8]).find(([x,z])=>e.movement.clear(x,z));
      e.movement.settle(...point);
    }, cow);
    await a.waitForFunction(id => e.townContext?.actions.some(action=>action.request.id===id && action.request.action==='animalPet'),cow);
    check(await a.locator('.v-town-controls button').filter({ hasText: 'Pet' }).getAttribute('aria-keyshortcuts') === 'N', 'The actual cow action shows the edited interact key');
    await a.locator('canvas').focus(); await a.keyboard.press('n');
    const owner=await a.evaluate(()=>e.sharedSelfId);
    await b.waitForFunction(({cow,owner})=>e.sharedActors.town.animals.find(a=>a.id===cow).owner===owner,{cow,owner});
    check(true, 'A rebound pet key requests and broadcasts one Worker-owned cow claim');
    check(await a.locator('.v-villager-footer button').evaluateAll(buttons=>buttons.length>0 && buttons.every(button=>button.getAttribute('aria-keyshortcuts')===';' && button.querySelector('kbd').textContent===';')), 'Native resident buttons expose the edited talk key');
    await a.getByRole('button', { name: 'Expand village map', exact: true }).click();
    await a.getByRole('button', { name: 'Focus cottage', exact: true }).click();
    await a.waitForFunction(()=>e.currentPlace==='focus');
    await a.locator('canvas').focus(); await a.keyboard.press('/');
    await a.locator('#v-activity-panel button[aria-keyshortcuts="/"]').filter({hasText:'Pause'}).waitFor();
    check(true, 'The reassigned pause key activates the real private focus timer');
    await a.keyboard.press('Escape');
    await settings(a,'.'); await tab(a,'Controls').click(); await a.getByRole('button',{name:'Reset keys',exact:true}).click();
    check(await a.evaluate(()=>e.keybindings.forward==='w' && e.keybindings.settings===',' && e.keybindings.interact==='e'),'Reset keys restores the complete default mapping');
    check(await a.evaluate(()=>JSON.parse(localStorage.getItem('cosy-village-preferences')).mix.wind===.42),'Reset keys preserves sound customizations');
    await tab(a,'Experience').click(); await a.getByRole('combobox',{name:'Language',exact:true}).selectOption('ja');
    check(await a.locator('.v-settings-tabs').getByRole('button',{name:'操作',exact:true}).count()===1,'Settings section labels follow Japanese language');
    await a.screenshot({path:`${output}/japanese.png`});
    await a.getByRole('combobox',{name:'言語',exact:true}).selectOption('en');
    assert.deepEqual(errors,[]); check(true,'No browser page errors');
    fs.writeFileSync(`${output}/checks.json`,JSON.stringify({checks,pageErrors:errors},null,2));
  } catch(error) {
    fs.writeFileSync(`${output}/failed-checks.json`,JSON.stringify({checks,pageErrors:errors,error:String(error)},null,2));
    for(let i=0;i<pages.length;i++) await pages[i].screenshot({path:`${output}/failed-${i}.png`}).catch(()=>{});
    throw error;
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});

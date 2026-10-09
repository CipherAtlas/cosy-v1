// Actual exported UI and a local Worker. No production interactions or inspection globals are added to the app.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = process.env.OUTPUT_DIR || '/tmp/cosy-keyboard-map';
fs.mkdirSync(output, { recursive: true });
const checks = [], errors = [];
const check = (ok, label) => { assert(ok, label); checks.push(label); console.log(label); };
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--disable-features=LocalNetworkAccessChecks'] });
  const pages = [];
  try {
    for (let i = 0; i < 3; i++) {
      const page = await browser.newPage({ viewport: { width: 1366, height: 768 } }); pages.push(page);
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        localStorage.setItem('cosy-village-preferences', JSON.stringify({ weather: 'golden', weatherMode: 'manual' }));
        window.testSockets = []; window.feedback = [];
        const Native = WebSocket;
        window.WebSocket = class extends Native { constructor(...args) { super(...args); window.testSockets.push(this); } };
        const animate = Element.prototype.animate;
        Element.prototype.animate = function(frames, options) { if (this.tagName === 'BUTTON') feedback.push({ label: this.textContent, frames }); return animate.call(this, frames, options); };
      });
      await page.goto(process.env.VILLAGE_URL || 'http://127.0.0.1:3051');
      await page.getByRole('button', { name: 'Enter Hearthwillow', exact: true }).click({ timeout: 120000 });
      await page.waitForFunction(() => {
        for (let el = document.querySelector('canvas'); el; el = el.parentElement)
          for (let fiber = el[Object.keys(el).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return)
            for (let hook = fiber.memoizedState; hook; hook = hook.next) {
              const ref = hook.memoizedState?.current;
              if (ref?.setSharedActors && ref.sharedActors) window.testEngine = ref;
              if (ref?.interact && ref.sendChat) window.testConnection = ref;
            }
        return !!window.testEngine && !!window.testConnection && testEngine.sharedConnected;
      }, null, { timeout: 120000 });
      const closeChat = page.getByRole('button', { name: 'Hide Hearthwillow chat', exact: true });
      if (await closeChat.count()) await closeChat.click();
    }
    const [a, b, c] = pages;
    await a.waitForFunction(() => testEngine.remoteVisitors.size === 2);
    check(await a.locator('.v-header nav > button').count() === 2, 'Top right contains only minimap and Settings');
    check(await a.getByRole('button', { name: 'Expand village map', exact: true }).isVisible(), 'The flat minimap stays visible during exploration');
    await a.getByRole('button', { name: 'Expand village map', exact: true }).click();
    await a.locator('.v-map-marker.is-selected:focus').waitFor();
    check(await a.getByRole('dialog').isVisible(), 'Clicking the minimap expands the full mouse-accessible map');
    await a.keyboard.press('Escape');
    const startX = await a.locator('.v-minimap .v-map-player').getAttribute('data-x');
    await a.locator('canvas').focus(); await a.keyboard.down('d'); await a.waitForTimeout(500); await a.keyboard.up('d');
    await a.waitForFunction(x => document.querySelector('.v-minimap .v-map-player').getAttribute('data-x') !== x, startX);
    check(true, 'Minimap player position updates during real keyboard movement');
    await a.screenshot({ path: path.join(output, 'minimap.png') });
    for (const page of pages) await page.evaluate(() => testEngine.renderer.setAnimationLoop(null));
    await a.bringToFront();
    const frameRate = await a.evaluate(() => new Promise(resolve => {
      const svg = document.querySelector('.v-minimap svg'), landscape = svg.firstElementChild;
      const saved = testEngine.player.position.clone();
      let updates = 0, sceneryMutations = 0, frames = 0, started;
      const markerObserver = new MutationObserver(records => updates += records.length);
      markerObserver.observe(svg.querySelector('.v-map-player'), { attributes: true, attributeFilter: ['transform'] });
      const sceneryObserver = new MutationObserver(records => sceneryMutations += records.length);
      sceneryObserver.observe(landscape, { subtree: true, attributes: true, childList: true });
      const frame = time => {
        started ??= time; frames++; testEngine.player.position.x += .02;
        if (time - started < 2000) requestAnimationFrame(frame);
        else {
          markerObserver.disconnect(); sceneryObserver.disconnect(); testEngine.player.position.copy(saved);
          resolve({ updates, frames, seconds: (time - started) / 1000, sceneryMutations, sameLandscape: svg.firstElementChild === landscape });
        }
      };
      requestAnimationFrame(frame);
    }));
    check(frameRate.updates >= frameRate.frames * .85 && frameRate.updates / frameRate.seconds >= 50 && frameRate.updates / frameRate.seconds <= 67, 'Minimap tracks at approximately 60 fps on a 60 Hz browser');
    check(frameRate.sceneryMutations === 0 && frameRate.sameLandscape, '60 fps tracking preserves the mounted static map artwork');
    fs.writeFileSync(path.join(output, 'map-frame-rate.json'), JSON.stringify(frameRate, null, 2) + '\n');
    for (const page of pages) await page.evaluate(() => testEngine.renderer.setAnimationLoop(time => testEngine.frame(time)));
    const capture = async page => {
      await page.bringToFront();
      await page.locator('canvas').focus();
      await page.mouse.click(500, 100);
      await page.waitForFunction(() => document.pointerLockElement === testEngine.renderer.domElement);
    };
    const map = async page => { await page.keyboard.press('m'); await page.locator('.v-map-marker.is-selected:focus').waitFor(); await page.waitForTimeout(120); };
    const travel = async (page, name) => { await map(page); await page.getByRole('button', { name, exact: true }).click(); await page.locator('.v-activity-close').waitFor(); await page.waitForFunction(() => document.querySelector('.v-activity-content').getAnimations().every(animation => animation.playState !== 'running')); };
    await capture(a);
    await a.evaluate(() => { const e = testEngine; e.renderer.setAnimationLoop(null); e.near = 'focus'; e.nearSwing = e.nearBench = e.nearGarden = e.nearPuppy = null; });
    await a.keyboard.press('e'); await a.waitForFunction(() => testEngine.currentPlace === 'focus');
    check(await a.evaluate(() => !!document.pointerLockElement), 'E enters an accepted activity without freeing the mouse');
    await a.evaluate(() => testEngine.renderer.setAnimationLoop(time => testEngine.frame(time)));
    await a.keyboard.press('Space'); await a.getByRole('button', { name: 'Pause', exact: true }).waitFor();
    await a.keyboard.press('r'); await a.getByRole('button', { name: 'Begin', exact: true }).waitFor();
    await a.keyboard.press('3');
    check(await a.locator('.v-preset-row button[aria-pressed="true"]').textContent().then(text => text.includes('10 min')), 'Activity Space, R and preset keys perform their real actions');
    await a.keyboard.press('Tab');
    check(await a.evaluate(() => !!document.pointerLockElement && document.activeElement.closest('#v-activity-panel')), 'Tab chooses activity controls while capture remains active');
    await a.keyboard.press('Space');
    check(await a.evaluate(() => !!document.pointerLockElement), 'Focused native button activation preserves capture');
    await a.locator('canvas').focus(); const orbit = await a.evaluate(() => testEngine.activityOrbit.yaw);
    await a.mouse.move(720, 250);
    check(await a.evaluate(yaw => testEngine.activityOrbit.yaw !== yaw, orbit), 'Captured mouse movement orbits a settled activity');
    await map(a);
    check(await a.evaluate(() => testEngine.currentPlace === 'focus' && !document.pointerLockElement), 'Expanded map makes the cursor available without leaving the activity');
    await a.keyboard.press('Escape'); await a.getByRole('dialog').waitFor({ state: 'hidden' });
    await capture(a);
    check(await a.evaluate(() => testEngine.currentPlace === 'focus' && !!document.pointerLockElement), 'Scene click restores capture inside an activity after a menu');
    await a.keyboard.press('u'); check(await a.locator('#v-activity-panel').isHidden(), 'U hides activity controls');
    await a.keyboard.press('u'); await a.keyboard.press('Escape');
    await a.waitForFunction(() => !testEngine.currentPlace && !document.pointerLockElement);
    check(true, 'One Esc leaves the activity and releases capture');
    await map(a); await a.keyboard.press('w');
    check(await a.evaluate(() => document.activeElement.getAttribute('aria-label') === 'Little postbox'), 'W selects the destination to the north');
    await a.keyboard.press('a'); check(await a.evaluate(() => document.activeElement.getAttribute('aria-label') === 'Willow pond'), 'A selects a western destination');
    await a.keyboard.press('d'); await a.keyboard.press('s');
    check(await a.evaluate(() => document.activeElement.getAttribute('aria-label') === 'Focus cottage'), 'D and S navigate the map spatially');
    await a.keyboard.press('ArrowUp'); await a.keyboard.press('Enter'); await a.waitForFunction(() => testEngine.currentPlace === 'compliment');
    await a.waitForFunction(() => {
      const marker = document.querySelector('.v-minimap .v-map-player'), pose = testEngine.getPlayerPose();
      return Math.abs(Number(marker.dataset.x) - pose.x) < .01 && Math.abs(Number(marker.dataset.z) - pose.z) < .01;
    });
    check(true, 'Outdoor activity marker uses the accepted player position');
    const note = await a.locator('.v-letter blockquote').textContent(); await a.keyboard.press('e');
    check(await a.locator('.v-letter blockquote').textContent() !== note, 'Enter travels from the map and E requests another note');
    await a.keyboard.press('k'); check(await a.getByRole('button', { name: 'Kept', exact: true }).count() === 1, 'K keeps the note');
    const close = a.getByRole('button', { name: 'Leave activity', exact: true }); await close.hover();
    check(await close.evaluate(el => getComputedStyle(el).color === 'rgb(255, 248, 232)'), 'X hover keeps cream text on a green control');
    await close.click(); check(await a.evaluate(() => !testEngine.currentPlace && document.activeElement === testEngine.renderer.domElement), 'Activity X closes and returns canvas focus');
    for (const [width, height] of [[1366, 768], [1280, 720], [1024, 640], [800, 640]]) {
      await a.setViewportSize({ width, height }); await map(a);
      const canvas = await a.locator('.v-map-canvas').boundingBox();
      check(await a.locator('.v-map-canvas [data-map-swing]').count() === 1, 'Expanded map includes the actual meadow swing');
      const accurate = await a.evaluate(() => {
        const svg = document.querySelector('.v-map-canvas svg'), view = svg.viewBox.baseVal;
        const swing = svg.querySelector('[data-map-swing]'), e = testEngine;
        const matrix = swing.transform.baseVal.consolidate().matrix;
        const actual = e.world.authored.swings[0];
        const tower = svg.querySelector('[data-map-building="tower"]').transform.baseVal.consolidate().matrix;
        return matrix.e > 0 && matrix.e < view.width && matrix.f > 0 && matrix.f < view.height
          && Math.abs(Math.atan2(matrix.b, matrix.a) + actual.yaw) < .001
          && tower.e > 0 && tower.f > 0 && tower.e < view.width && tower.f < view.height;
      });
      check(accurate, 'Full map contains the swing and northern spire with real orientation');
      check(canvas.x >= 0 && canvas.y >= 0 && canvas.x + canvas.width <= width && canvas.y + canvas.height <= height, `Expanded map fits ${width} by ${height}`);
      for (const marker of await a.locator('.v-map-marker').all()) { const rect = await marker.boundingBox(); assert(rect.width >= 44 && rect.height >= 44 && rect.x >= canvas.x && rect.y >= canvas.y && rect.x + rect.width <= canvas.x + canvas.width && rect.y + rect.height <= canvas.y + canvas.height); }
      check(true, `All eight map destinations have visible 44 px targets at ${width} by ${height}`);
      await a.screenshot({ path: path.join(output, `map-${width}.png`) });
      await a.keyboard.press('Escape'); await travel(a, 'Focus cottage');
      const panel = await a.locator('.v-focus').boundingBox(), x = await a.locator('.v-activity-close').boundingBox();
      check(x.width >= 44 && x.height >= 44 && x.x >= panel.x && x.y >= panel.y && x.x + x.width <= panel.x + panel.width && x.y + x.height <= panel.y + panel.height, `Activity X stays inside the panel at ${width} by ${height}`);
      check(await a.locator('.v-focus').evaluate(el => getComputedStyle(el).backgroundColor.startsWith('rgba(26, 54, 43')), 'Focus retains its translucent forest panel');
      check(await a.locator('.v-minimap .v-map-player').getAttribute('data-z') === '11', 'Private cottage marker stays at its outdoor entrance');
      const minimap = await a.locator('.v-minimap').boundingBox();
      check((minimap.y + minimap.height <= panel.y || minimap.x + minimap.width <= panel.x || panel.x + panel.width <= minimap.x) && minimap.y + minimap.height < height / 2, `Minimap stays clear of the activity at ${width} by ${height}`);
      await a.screenshot({ path: path.join(output, `focus-${width}.png`) }); await a.keyboard.press('Escape');
    }
    await a.setViewportSize({ width: 1366, height: 768 });
    for (const name of ['Village hearth', 'Willow pond', 'Tea garden', 'Writing nook', 'Kitchen garden', 'Bird clearing']) {
      await travel(a, name);
      if (name === 'Bird clearing' && await a.locator('#v-bird-feed-help').count()) {
        check(await a.locator('#v-bird-feed-help').innerText() === 'Ask Maple or Wren for crumbs first.'
          && await a.locator('.v-bird-activity button').isDisabled(), 'Empty crumb pouch explains the disabled bird feeding action');
      }
      await a.locator('.v-activity-close').focus(); await a.keyboard.press('Escape');
      check(await a.evaluate(() => !testEngine.currentPlace), `${name} exits with Esc while a button has focus`);
    }
    await travel(a, 'Writing nook'); await a.locator('canvas').focus(); await a.keyboard.press('Tab');
    check(await a.locator('#v-note').evaluate(el => el === document.activeElement), 'Tab enters the journal without mouse release');
    await a.keyboard.type('A keyboard visit to the village.'); await a.keyboard.press('Control+Enter');
    check(await a.locator('#v-note').inputValue() === '' && await a.locator('.v-save-status').textContent().then(text => text.includes('Kept safely')), 'Ctrl Enter saves a journal note through the same submit action');
    await a.locator('#v-note').focus(); await a.keyboard.press('Escape'); check(await a.evaluate(() => !testEngine.currentPlace), 'Esc exits even from a text field');
    await a.keyboard.press(','); await a.getByRole('button', { name: 'Sound & music', exact: true }).focus(); await a.keyboard.press('Enter');
    check(await a.getByRole('button', { name: 'Turn sound off', exact: true }).count() === 1, 'Sound remains reachable through Settings');
    await a.keyboard.press('Escape'); await a.keyboard.press('o'); check(await a.locator('.v-mix').isVisible(), 'O opens Sound directly'); await a.keyboard.press('Escape');

    const benchId = await a.evaluate(() => testEngine.world.benches[0].id);
    const approach = async page => {
      await page.evaluate(id => { const e = testEngine, seat = e.world.benches.find(bench => bench.id === id); e.movement.settle(seat.x, seat.z + 1.8); e.player.position.copy(e.movement.position); }, benchId);
      await page.waitForFunction(id => testEngine.nearBench?.id === id, benchId);
    };
    for (const page of pages) await approach(page); await a.waitForTimeout(400);
    await capture(a); await a.keyboard.press('e'); await a.waitForFunction(() => !!testEngine.seatedBench);
    check(await a.evaluate(() => !!document.pointerLockElement), 'Shared bench E entry keeps the mouse captured');
    await b.locator('canvas').focus(); await b.keyboard.press('e'); await b.waitForFunction(() => !!testEngine.seatedBench);
    await c.locator('canvas').focus(); await c.keyboard.press('e'); await c.waitForTimeout(400);
    check(await c.evaluate(() => !testEngine.seatedBench), 'Keyboard entry refuses a full shared bench');
    await a.keyboard.press('Escape'); await a.waitForFunction(() => !testEngine.seatedBench); await a.waitForTimeout(250);
    await c.keyboard.press('e'); await c.waitForFunction(() => !!testEngine.seatedBench);
    check(true, 'Esc releases the actual bench seat for another client');
    await b.getByRole('button', { name: 'Leave bench', exact: true }).click(); check(await b.evaluate(() => !testEngine.seatedBench), 'Bench X releases occupancy');
    const oldId = await c.evaluate(() => { const id = testEngine.sharedSelfId; testSockets.at(-1).close(); return id; });
    await a.waitForFunction(id => !testEngine.remoteVisitors.has(id), oldId);
    await c.waitForFunction(id => testEngine.sharedConnected && testEngine.sharedSelfId !== id && !testEngine.seatedBench, oldId, { timeout: 15000 });
    check(true, 'Disconnection releases seating and reconnect returns without the abandoned claim');

    await a.evaluate(() => { const e = testEngine, swing = e.world.swings[0]; swing.root.localToWorld(e.temp.set(0, 0, 1.65)); e.movement.settle(e.temp.x, e.temp.z); e.player.position.copy(e.movement.position); });
    await a.waitForFunction(() => !!testEngine.nearSwing); await capture(a); await a.keyboard.press('e'); await a.waitForFunction(() => !!testEngine.ridingSwing);
    check(await a.evaluate(() => !!document.pointerLockElement), 'Swing keyboard entry preserves capture');
    await a.keyboard.down('w'); await a.waitForTimeout(250); await a.keyboard.up('w');
    check(await a.evaluate(() => Math.abs(testEngine.world.swings[0].pendulums[testEngine.ridingSwing.index].angle) > .02), 'Captured W pumps the swing');
    await a.keyboard.press('e'); check(await a.evaluate(() => !testEngine.ridingSwing && !!document.pointerLockElement), 'E gets off a swing without freeing the mouse');
    await a.keyboard.press('Escape');
    await a.evaluate(() => { const e = testEngine, swing = e.world.swings[0]; swing.root.localToWorld(e.temp.set(0, 0, 1.65)); e.movement.settle(e.temp.x, e.temp.z); e.player.position.copy(e.movement.position); });
    await a.waitForFunction(() => !!testEngine.nearSwing); await a.waitForTimeout(150); await a.keyboard.press('e'); await a.waitForFunction(() => !!testEngine.ridingSwing);
    await a.getByRole('button', { name: 'Get off the swing', exact: true }).click(); check(await a.evaluate(() => !testEngine.ridingSwing), 'Swing X releases the shared seat');
    const dogId = await a.evaluate(() => testEngine.sharedActors.actors.find(actor => actor.kind === 'puppy').id);
    await a.evaluate(id => { const e = testEngine, dog = e.sharedActors.actors.find(actor => actor.id === id); e.movement.settle(dog.x, dog.z + 1.25); e.player.position.copy(e.movement.position); }, dogId);
    await a.waitForFunction(id => testEngine.nearPuppy?.id === id, dogId); await a.waitForTimeout(200); await capture(a); await a.keyboard.press('t'); await a.locator('#v-puppy-tricks').waitFor({ state: 'visible' });
    check(await a.evaluate(() => !!document.pointerLockElement), 'T opens dog tricks while mouse capture remains active');
    await b.waitForFunction(id => testEngine.sharedActors.actors.find(actor => actor.id === id)?.owner, dogId);
    await a.keyboard.press('t'); check(await a.evaluate(() => !!document.pointerLockElement), 'T closes dog tricks without releasing capture'); await a.keyboard.press('Escape');
    await a.waitForTimeout(150); await a.keyboard.press('t'); await a.locator('#v-puppy-tricks').waitFor({ state: 'visible' });
    await a.getByRole('button', { name: 'Close dog tricks', exact: true }).click();
    await b.waitForFunction(id => !testEngine.sharedActors.actors.find(actor => actor.id === id)?.owner, dogId);
    check(true, 'Dog-trick X closes the menu and releases the shared hold');

    for (const page of [a, b]) await travel(page, 'Focus cottage');
    await a.locator('canvas').focus(); await a.keyboard.press('Space');
    check(await a.getByRole('button', { name: 'Pause', exact: true }).count() === 1 && await b.getByRole('button', { name: 'Begin', exact: true }).count() === 1, 'Two simultaneous private cottages have independent timers');
    check(await a.evaluate(() => [...testEngine.remoteVisitors.values()].every(visitor => !visitor.group.visible)), 'Private focus hides shared visitors');
    await a.keyboard.press('Enter'); await a.waitForFunction(() => document.activeElement === document.querySelector('.v-shared-chat input'));
    check(await a.evaluate(() => testEngine.currentPlace === 'focus'), 'Opening chat releases the mouse without leaving the activity');
    await a.keyboard.press('Escape');
    check(await a.evaluate(() => testEngine.currentPlace === 'focus' && document.activeElement === testEngine.renderer.domElement) && await a.locator('.v-shared-chat').count() === 0, 'Esc closes chat and restores scene focus without losing the activity');
    await a.keyboard.press('Escape'); await b.keyboard.press('Escape');
    await a.emulateMedia({ reducedMotion: 'reduce' }); await map(a); await a.evaluate(() => window.feedback = []);
    await a.keyboard.press('Enter'); await a.waitForFunction(() => !!testEngine.currentPlace);
    check(await a.evaluate(() => feedback.some(item => item.frames.every(frame => !frame.scale))), 'Reduced motion uses a still shortcut highlight');
    await a.keyboard.press('Escape');
    check(errors.length === 0, 'No captured browser page errors');
    fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ checks, errors }, null, 2) + '\n');
    console.log(`${checks.length} keyboard/map/three-client checks passed`);
  } catch (error) {
    for (let i = 0; i < pages.length; i++) await pages[i].screenshot({ path: path.join(output, `failure-${i}.png`) }).catch(() => {});
    fs.writeFileSync(path.join(output, 'failed-checks.json'), JSON.stringify({ checks, errors }, null, 2) + '\n'); throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

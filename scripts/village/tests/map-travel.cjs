// Check an isolated export, or the actual preview with USE_SERVED_EXPORT=1.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
assert(process.env.EXPORT_DIR && process.env.LOCAL_WORKER_URL, 'Set EXPORT_DIR and LOCAL_WORKER_URL to isolated builds');
const root = path.resolve(process.env.EXPORT_DIR);
const output = process.env.OUTPUT_DIR || '/tmp/cosy-fullscreen-map';
fs.mkdirSync(output, { recursive: true });
const checks = [], errors = [];
const check = (condition, label) => { assert(condition, label); checks.push(label); console.log(label); };
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-features=LocalNetworkAccessChecks'] });
  const pages = [];
  try {
    async function join() {
      const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
      pages.push(page);
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
    const a = await join(), b = process.env.MAP_PROFILE_ONLY === '1' ? null : await join(), c = b ? await join() : null;
    if (c) await a.waitForFunction(() => e.remoteVisitors.size === 2);
    async function openMap(page) { await page.bringToFront(); if (await page.locator('.v-map-canvas').count()) return; await page.locator('canvas').focus(); await page.keyboard.press('m'); await page.locator('.v-map-canvas').waitFor(); }
    if (process.env.MAP_PROFILE_ONLY === '1') {
      await a.evaluate(url => new Promise((resolve, reject) => {
        window.profileSocket = new WebSocket(url);
        const timeout = setTimeout(() => reject(new Error('Profile observer did not join')), 30000);
        profileSocket.addEventListener('message', event => {
          if (JSON.parse(event.data).type === 'welcome') { clearTimeout(timeout); resolve(); }
        });
        profileSocket.addEventListener('error', reject);
      }), process.env.LOCAL_WORKER_URL);
      await a.waitForFunction(() => e.remoteVisitors.size >= 1);
      await openMap(a);
      const metrics = await a.context().newCDPSession(a); await metrics.send('Performance.enable');
      const before = await metrics.send('Performance.getMetrics');
      const profile = await a.evaluate(() => new Promise(resolve => {
          let movementIndex = 0, worldRenders = 0;
          const render = e.renderer.render;
          e.renderer.render = function(...args) { worldRenders++; return render.apply(this, args); };
          const movement = setInterval(() => {
            profileSocket.send(JSON.stringify({type:'move',x:Math.sin(movementIndex++*.2)*5,z:18,heading:0,active:true}));
            profileSocket.send(JSON.stringify({type:'heartbeat',active:true}));
          },125);
          const intervals = [], changedAt = [], start = performance.now(); let previous = start, landscapeMutations = 0;
          const observer = new MutationObserver(records => {
            if (records.some(record => record.target.closest?.('[data-map-actor]'))) changedAt.push(performance.now());
            landscapeMutations += records.filter(record => record.target.closest?.('svg.v-map-art')).length;
          });
          observer.observe(document.querySelector('.v-map-canvas'), { subtree: true, attributes: true, childList: true });
          const frame = now => {
            intervals.push(now - previous); previous = now;
            if (now - start < 5000) return requestAnimationFrame(frame);
            clearInterval(movement); observer.disconnect(); e.renderer.render = render; intervals.sort((a,b) => a-b);
            const marker = document.querySelector('[data-map-destination="compliment"]');
            resolve({ durationMs: now-start, frames: intervals.length, fps: intervals.length*1000/(now-start),
              frameP95Ms: intervals[Math.floor(intervals.length*.95)], longestFrameMs: intervals.at(-1),
              markerUpdates: changedAt.length, markerUpdatesPerSecond: changedAt.length*1000/(now-start),
              landscapeMutations, postboxOffset: { x: Number.parseFloat(marker.style.left), y: Number.parseFloat(marker.style.top) },
              mapOpen: e.mapOpen ?? false, worldRenders });
          };
          requestAnimationFrame(frame);
        }));
      const after = await metrics.send('Performance.getMetrics');
      const values = result => Object.fromEntries(result.metrics.map(metric => [metric.name, metric.value]));
      const x = values(before), y = values(after);
      profile.mainThreadTaskMs = (y.TaskDuration-x.TaskDuration)*1000;
      profile.scriptMs = (y.ScriptDuration-x.ScriptDuration)*1000;
      profile.layoutMs = (y.LayoutDuration-x.LayoutDuration)*1000;
      profile.recalcStyleMs = (y.RecalcStyleDuration-x.RecalcStyleDuration)*1000;
      fs.writeFileSync(path.join(output, 'performance.json'), JSON.stringify(profile,null,2));
      await a.screenshot({path:path.join(output,'atlas-profile.png'), animations:'disabled'});
      console.log(JSON.stringify(profile));
      if (profile.mapOpen) {
        check(profile.fps >= 55 && profile.frameP95Ms <= 20, 'The map sustains the measured 60 Hz frame budget');
        check(profile.markerUpdatesPerSecond >= profile.fps * .8, 'Accepted player motion updates on display frames rather than the roster timer');
        check(profile.landscapeMutations === 0 && profile.worldRenders === 0, 'Moving markers neither rebuild the landscape nor draw the hidden 3D scene');
      }
      fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ pass: true, checks, errors }, null, 2));
      return;
    }
    for (const [page, name] of [[b, 'Meadow Swings'], [c, 'Mint farm']]) {
      await openMap(page); await page.getByRole('button', { name, exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('.v-map-canvas'));
    }
    await openMap(a);
    await a.locator('.v-map-actors [data-map-label]').first().waitFor();
    check(await a.locator('.v-map-actors [data-map-kind="visitor"]').count() === 2, 'Both other real players appear on the atlas');
    check(await a.locator('.v-map-actors [data-map-kind="resident"], .v-map-actors [data-map-kind="puppy"]').count() === 0
      && await a.evaluate(() => e.getMapActors().every(actor => actor.kind === 'visitor')), 'NPCs and dogs are absent from both the map data and rendered atlas');
    const markerStyles = await a.locator('.v-map-actors .v-map-actor-dot').evaluateAll(nodes => nodes.map(node => ({ fill: getComputedStyle(node).fill, width: node.getBoundingClientRect().width })));
    check(markerStyles.every(marker => marker.fill === 'rgb(36, 117, 189)' && marker.width >= 27.5), 'Other players share one blue colour and large icons');
    const self = await a.locator('.v-map-actors .v-map-player').evaluate(node => ({ x: Number(node.dataset.x), z: Number(node.dataset.z), label: node.querySelector('[data-map-self-label]').textContent, width: node.querySelector('.v-map-self-icon').getBoundingClientRect().width }));
    const selfPose = await a.evaluate(() => e.getPlayerPose());
    check(self.label === 'You' && self.width >= 31.5 && Math.hypot(self.x - selfPose.x, self.z - selfPose.z) < .01, 'A distinct large gold compass marks your actual position with a You label');
    const playerPlacement = await a.locator('.v-map-actors [data-map-kind="visitor"]').evaluateAll(nodes => nodes.map(node => {
      const dot = node.querySelector('.v-map-actor-dot'), label = node.querySelector('[data-map-label]');
      const anchor = node.getCTM(), icon = dot.getCTM(), d = dot.getBoundingClientRect(), l = label.getBoundingClientRect();
      return { lines: node.querySelectorAll('path').length !== 1,
        atAnchor: Math.hypot(anchor.e - icon.e, anchor.f - icon.f) < .01,
        above: l.bottom <= d.top && Math.abs(l.x + l.width / 2 - d.x - d.width / 2) < 1 };
    }));
    check(await a.locator('.v-map-leader').count() === 0 && playerPlacement.every(player => !player.lines && player.atAnchor && player.above), 'Player markers stay at their actual positions with names directly above and no character callout lines');
    const beforeVisitorMove = await a.locator('.v-map-actors [data-map-kind="visitor"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('transform')));
    await b.bringToFront(); await b.locator('canvas').focus(); await b.keyboard.down('d'); await b.waitForTimeout(700); await b.keyboard.up('d');
    await a.bringToFront();
    await a.waitForFunction(before => [...document.querySelectorAll('.v-map-actors [data-map-kind="visitor"]')].some((node, i) => node.getAttribute('transform') !== before[i]), beforeVisitorMove);
    check(true, 'Other-player map icons follow accepted real keyboard movement');
    const mapCursor = await a.locator('.v-map-dialog').evaluate(node => getComputedStyle(node).cursor);
    check(mapCursor.includes('data:image/svg+xml'), 'The full-screen atlas uses a native custom cursor');
    check(await a.locator('[data-map-destination="focus"]').evaluate(node => getComputedStyle(node).cursor) === mapCursor,
      'Destination buttons retain the custom map cursor');
    await a.keyboard.press('m'); await a.locator('.v-map-dialog').waitFor({ state: 'detached' });
    check(await a.locator('canvas').evaluate(node => document.activeElement === node && !getComputedStyle(node).cursor.includes('data:image/svg+xml')),
      'M closes the atlas, restores canvas focus and removes the custom cursor');
    await openMap(a); await a.keyboard.press('Escape'); await a.locator('.v-map-dialog').waitFor({ state: 'detached' });
    check(await a.locator('canvas').evaluate(node => document.activeElement === node), 'Escape closes the atlas and restores canvas focus');
    await a.waitForFunction(() => !e.mapOpen && e.renderer.info.render.calls > 0);
    check(true, 'Closing the map immediately restores world rendering');
    await openMap(a);
    const destinations = await a.locator('[data-map-destination]').evaluateAll(nodes => nodes.map(node => ({ id: node.dataset.mapDestination, name: node.getAttribute('aria-label') })).filter(value => value.id.includes(':')));
    const postbox = await a.locator('[data-map-destination="compliment"]').evaluate(node => ({ x: +node.dataset.mapX, z: +node.dataset.mapZ }));
    const authoredPostbox = await a.evaluate(() => e.world.mapScenery.layout.items.find(item => item.visible && item.asset === 'postbox').position);
    check(postbox.x === authoredPostbox[0] && postbox.z === authoredPostbox[2], 'Little postbox uses the actual saved postbox location');
    check(await a.getByRole('button', { name: 'Meadow Swings', exact: true }).count() === 1, 'Meadow Swings is one unnumbered map option');
    await a.waitForFunction(() => e.mapOpen);
    const draws = await a.evaluate(() => new Promise(resolve => {
      let count = 0; const render = e.renderer.render;
      e.renderer.render = function(...args) { count++; return render.apply(this, args); };
      setTimeout(() => { e.renderer.render = render; resolve(count); }, 300);
    }));
    check(draws === 0, 'The hidden 3D scene stops drawing while shared map state continues');
    check(destinations.length === 8 && destinations.some(destination => destination.id === 'tower:watchtower'), 'One Meadow Swings option, field, circuit, three farms, owl grove and watch tower have clickable map buttons');
    for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 1024, height: 640 }, { width: 800, height: 640 }]) {
      await a.setViewportSize(viewport);
      await a.waitForFunction(({ width, height }) => {
        const view = document.querySelector('.v-map-actors').viewBox.baseVal;
        return Math.abs(view.width / view.height - width / height) < .000001;
      }, viewport);
      await a.screenshot({ path: path.join(output, `atlas-${viewport.width}.png`), animations: 'disabled' });
      const geometry = await a.locator('[data-map-destination]').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { id: node.dataset.mapDestination, x: r.x, y: r.y, width: r.width, height: r.height }; }));
      const dialog = await a.locator('.v-map-dialog').boundingBox();
      check(dialog.x === 0 && dialog.y === 0 && dialog.width === viewport.width && dialog.height === viewport.height,
        `The atlas fills the entire ${viewport.width}×${viewport.height} viewport`);
      check(geometry.every(r => r.width >= 44 && r.height >= 44 && r.x >= 0 && r.y >= 0 && r.x + r.width <= viewport.width && r.y + r.height <= viewport.height), `All map buttons remain reachable and 44 px at ${viewport.width}×${viewport.height}`);
      const anchors = await a.locator('[data-map-destination]').evaluateAll(nodes => nodes.map(node => {
        const r = node.getBoundingClientRect(), pin = node.parentElement.getBoundingClientRect();
        return Math.hypot(r.x+r.width/2-pin.x, r.y+r.height/2-pin.y) < .01 && node.style.left === '0px' && node.style.top === '0px';
      }));
      check(anchors.every(Boolean), `Destination icons remain anchored to real map coordinates at ${viewport.width}×${viewport.height}`);
      check(await a.locator('[data-map-destination]').evaluateAll(nodes => nodes.every(node => {
        const r = node.getBoundingClientRect();
        return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[data-map-destination]') === node;
      })), `Every destination can be clicked at its real centre at ${viewport.width}×${viewport.height}`);
      const labels = await a.locator('.v-map-marker-name, .v-map-actors [data-map-label], .v-map-actors [data-map-self-label]').evaluateAll(nodes => nodes.filter(node => getComputedStyle(node).visibility !== 'hidden').map(node => {
        const r = node.getBoundingClientRect();
        const icon = node.closest('.v-map-marker') ?? node.closest('[data-map-actor], .v-map-player').querySelector('.v-map-actor-dot, .v-map-self-icon');
        return { destination: node.classList.contains('v-map-marker-name'), text: node.textContent, x: r.x, y: r.y, width: r.width, height: r.height, iconTop: icon.getBoundingClientRect().y, size: parseFloat(getComputedStyle(node).fontSize) };
      }));
      check(labels.every(label => label.size >= 13 && label.y + label.height <= label.iconTop + 1 && label.x >= 0 && label.y >= 0 && label.x + label.width <= viewport.width),
        `Every name is readable, upright and above its icon at ${viewport.width}×${viewport.height}`);
      const destinationLabels = labels.filter(label => label.destination);
      check(destinationLabels.every((label, i) => destinationLabels.slice(i + 1).every(other => label.x + label.width <= other.x || other.x + other.width <= label.x || label.y + label.height <= other.y || other.y + other.height <= label.y)),
        `Destination names do not overlap at ${viewport.width}×${viewport.height}`);
      const panels = await a.locator('.v-map-footer, .v-map-help, .v-dialog-close').evaluateAll(nodes => nodes.map(node => {
        const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height };
      }));
      check(panels.every(r => r.x >= 0 && r.y >= 0 && r.x + r.width <= viewport.width && r.y + r.height <= viewport.height)
        && panels.every((r, i) => panels.slice(i + 1).every(other => r.x + r.width <= other.x || other.x + other.width <= r.x || r.y + r.height <= other.y || other.y + other.height <= r.y))
        && geometry.every(r => panels.every(other => r.x + r.width <= other.x || other.x + other.width <= r.x || r.y + r.height <= other.y || other.y + other.height <= r.y)),
        `Edge controls stay visible, separate and clear of destinations at ${viewport.width}×${viewport.height}`);
      await a.screenshot({ path: path.join(output, `atlas-${viewport.width}.png`), animations: 'disabled' });
    }
    await a.keyboard.press('Escape'); await a.locator('.v-map-dialog').waitFor({ state: 'detached' });
    for (const page of [a, b]) {
      await openMap(page); await page.locator('[data-map-destination="focus"]').click();
      await page.waitForFunction(() => e.place === 'focus');
    }
    check(await a.evaluate(() => e.place === 'focus') && await b.evaluate(() => e.place === 'focus'), 'Both visitors can use their private focus cottages simultaneously before map travel');
    await openMap(a);
    check(await a.locator('.v-map-actors [data-map-kind="visitor"]').count() === 1, 'A visitor in their private focus cottage is omitted from outdoor player markers');
    await a.setViewportSize({ width: 1366, height: 768 });
    for (const destination of destinations) {
      const marker = a.locator(`[data-map-destination="${destination.id}"]`);
      await marker.hover();
      check(await marker.locator('.v-map-marker-name').isVisible(), `${destination.name} shows its label on hover`);
      await a.evaluate(() => { window.mapMessages = []; });
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
    await a.emulateMedia({ reducedMotion: 'reduce' }); await openMap(a);
    check(await a.locator('.v-map-dialog').evaluate(node => getComputedStyle(node).animationName) === 'none',
      'Reduced motion removes the atlas fade');
    await a.getByRole('button', { name: 'Close', exact: true }).click(); await a.locator('.v-map-dialog').waitFor({ state: 'detached' });
    check(true, 'The close button also returns to the village');
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
    await a.keyboard.press(',');
    await a.getByRole('button', { name: 'Controls', exact: true }).click();
    await a.locator('.v-binding-group > summary').filter({ hasText: 'Menus' }).click();
    await a.getByRole('button', { name: 'Change key for village map', exact: true }).click();
    await a.keyboard.press('n'); await a.keyboard.press('Escape');
    await a.locator('canvas').focus(); await a.keyboard.press('n'); await a.locator('.v-map-canvas').waitFor();
    check(await a.locator('.v-map-help kbd').last().textContent() === 'N', 'The atlas close keycap follows the personal map binding');
    await a.keyboard.press('n'); await a.locator('.v-map-dialog').waitFor({ state: 'detached' });
    check(await a.locator('canvas').evaluate(node => document.activeElement === node), 'The personal map binding both opens and closes the atlas');
    await a.keyboard.press(','); await a.getByRole('combobox', { name: 'Language', exact: true }).selectOption('ja');
    await a.keyboard.press('Escape'); await a.locator('canvas').focus(); await a.keyboard.press('n');
    await a.locator('.v-map-canvas').waitFor();
    check(await a.getByRole('dialog', { name: 'ハースウィロー' }).isVisible()
      && await a.getByRole('button', { name: 'ニンジン畑', exact: true }).isVisible(), 'Japanese title and destination labels remain available in the full-screen atlas');
    const selectedBeforeArrow = await a.locator('.v-map-marker.is-selected').getAttribute('data-map-destination');
    await a.keyboard.press('ArrowRight');
    check(await a.locator('.v-map-marker:focus').count() === 1
      && await a.locator('.v-map-marker.is-selected').getAttribute('data-map-destination') !== selectedBeforeArrow,
      'Arrow keys navigate destinations after rebinding the map');
    check(await c.evaluate(() => e.sharedConnected), 'The third observer stays connected through map travel');
    check(errors.length === 0, 'Three real clients have no page errors');
    fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ pass: true, checks, errors }, null, 2));
    console.log(`${checks.length} isolated map travel checks passed.`);
  } catch (error) {
    for (const [index, page] of pages.entries()) {
      console.error('Map test state', index + 1, await page.evaluate(() => ({ place: window.e?.place, pose: window.e?.getPlayerPose(), connected: window.e?.sharedConnected,
        map: !!document.querySelector('.v-map-dialog'), results: window.mapMessages?.filter(message => message.type === 'interaction_result').slice(-3) })).catch(() => null));
      await page.screenshot({ path: path.join(output, `failed-client-${index + 1}.png`), animations: 'disabled' }).catch(() => {});
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

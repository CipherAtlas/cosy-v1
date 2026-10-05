// Actual exported village UI, with isolated assets and one local shared Worker.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
assert(process.env.EXPORT_DIR && process.env.LOCAL_WORKER_URL, 'Set the isolated export and local Worker');
const root = path.resolve(process.env.EXPORT_DIR);
const output = process.env.OUTPUT_DIR || '/tmp/cosy-tower-lookout-browser';
fs.mkdirSync(output, { recursive: true });
const checks = [], errors = [];
const check = (ok, label) => { assert(ok, label); checks.push(label); console.log(label); };
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-features=LocalNetworkAccessChecks', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  const pages = [];
  try {
    async function join() {
      const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
      pages.push(page);
      page.on('pageerror', error => errors.push(error.message));
      if (process.env.USE_SERVED !== '1') await page.route('http://127.0.0.1:3051/**', route => {
        const relative = decodeURIComponent(new URL(route.request().url()).pathname);
        const file = path.resolve(root, `.${relative.endsWith('/') ? relative + 'index.html' : relative}`);
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404 });
        const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.png': 'image/png' };
        return route.fulfill({ path: file, contentType: types[path.extname(file)] || 'application/octet-stream' });
      });
      await page.addInitScript(url => {
        localStorage.setItem('cosy-village-preferences', JSON.stringify({ quality: 'low', weather: 'golden', weatherMode: 'manual', mix: { enabled: false } }));
        window.testMessages = []; window.testSocket = null;
        const Native = window.WebSocket;
        window.WebSocket = class extends Native { constructor(...args) { super(url, ...args.slice(1)); window.testSocket = this;
          this.addEventListener('message', event => window.testMessages.push(JSON.parse(event.data))); } };
      }, process.env.LOCAL_WORKER_URL);
      await page.goto('http://127.0.0.1:3051/?sharedTrial=1');
      try { await page.getByRole('button', { name: 'Enter Hearthwillow', exact: true }).click({ timeout: 120000 }); }
      catch (error) {
        await page.screenshot({ path: `${output}/entry-failure.png` });
        console.log({ text: (await page.locator('body').innerText()).slice(0, 1200), errors });
        throw error;
      }
      await page.waitForFunction(() => {
        for (let el = document.querySelector('canvas'); el; el = el.parentElement)
          for (let fiber = el[Object.keys(el).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return)
            for (let hook = fiber.memoizedState; hook; hook = hook.next) {
              const engine = hook.memoizedState?.current;
              if (engine?.life) { window.e = engine; engine.setQuality('low'); return engine.sharedConnected && !!engine.sharedActors?.town; }
            }
      }, null, { timeout: 120000 }).catch(async error => {
        console.log(await page.evaluate(() => ({ connected: window.e?.sharedConnected, town: !!window.e?.sharedActors?.town,
          socket: window.testSocket && { url: testSocket.url, ready: testSocket.readyState },
          messages: testMessages.slice(-3), text: document.body.innerText.slice(0, 600) })));
        throw error;
      });
      if (process.env.LOW_RESOURCE === '1') await page.evaluate(() => {
        e.renderer.setPixelRatio(.5);
        const render = e.renderer.render.bind(e.renderer);
        let lastDraw = -Infinity;
        e.renderer.render = (...args) => {
          const now = performance.now();
          if (now - lastDraw >= 100) { lastDraw = now; render(...args); }
        };
      });
      const close = page.getByRole('button', { name: 'Close Hearthwillow chat', exact: true });
      if (await close.count()) await close.click();
      return page;
    }
    const a = await join(), b = await join();
    async function approach(page) {
      await page.bringToFront();
      await page.evaluate(() => {
        const tower = e.world.authored.structures.tower;
        const x = tower.x + Math.sin(tower.yaw) * 3.5, z = tower.z + Math.cos(tower.yaw) * 3.5;
        e.movement.settle(x, z); e.player.position.copy(e.movement.position); e.yaw = Math.PI; e.pitch = .22;
      });
      await page.getByRole('button', { name: 'Go up to the lookout', exact: true }).waitFor();
      await page.waitForTimeout(150); // Worker interaction cooldown after a preceding exit.
    }
    async function recordTowerTransitions(page) {
      await page.evaluate(() => {
        window.towerTransitions = [];
        const sync = e.visitors.sync.bind(e.visitors);
        let claims = new Map([...e.remoteVisitors].map(([id, v]) => [id, v.lookout ?? null]));
        e.visitors.sync = (...args) => {
          sync(...args);
          for (const visitor of args[0]) if (claims.has(visitor.id) && claims.get(visitor.id) !== (visitor.lookout ?? null)) {
            const v = e.remoteVisitors.get(visitor.id);
            towerTransitions.push({ id: visitor.id, from: claims.get(visitor.id), to: visitor.lookout ?? null, distance: v.group.position.distanceTo(v.target) });
          }
          claims = new Map(args[0].map(v => [v.id, v.lookout ?? null]));
        };
      });
    }
    if (process.env.TRANSITION_ONLY === '1') {
      await recordTowerTransitions(b);
      await approach(a); await a.keyboard.press('e'); await a.waitForFunction(() => !!e.lookoutPosition);
      await b.bringToFront(); await b.waitForFunction(() => towerTransitions.length > 0);
      check(await b.evaluate(() => towerTransitions.every(v => v.distance < .00001)), 'Tower admission places observed spirits directly on the deck without a floating ascent');
      return;
    }
    if (process.env.MULTIPLAYER_ONLY === '1') {
      const ground = await join();
      await recordTowerTransitions(ground);
      await ground.evaluate(() => {
        const tower = e.world.authored.structures.tower;
        e.movement.settle(tower.x, tower.z + 23); e.player.position.copy(e.movement.position);
        e.yaw = 0; e.pitch = -.5; e.distance = 5;
      });
      await approach(a); await approach(b);
      await Promise.all([a.getByRole('button', { name: 'Go up to the lookout', exact: true }).click(),
        b.getByRole('button', { name: 'Go up to the lookout', exact: true }).click()]);
      for (const page of [a, b]) await page.waitForFunction(() => e.lookoutPosition !== null);
      const occupants = await Promise.all([a, b].map(page => page.evaluate(() => ({
        id: e.sharedSelfId, index: e.lookoutIndex, position: e.player.position.toArray(),
      }))));
      check(occupants[0].index !== occupants[1].index, 'Simultaneous real browser entry receives distinct shared admission claims');
      await ground.bringToFront();
      await ground.waitForFunction(ids => ids.every(id => { const v = e.remoteVisitors.get(id);
        return v?.group.visible && Math.abs(v.group.position.y - 11.4) < .04 && !v.label.hidden; }), occupants.map(v => v.id));
      check(true, 'A ground-level observer sees both coloured spirits and their names on the elevated gallery');
      check(await ground.evaluate(() => towerTransitions.length >= 2 && towerTransitions.every(v => v.distance < .00001)),
        'Simultaneous entries appear directly on the deck without spirits floating through the tower');
      await ground.screenshot({ path: `${output}/multiplayer-from-ground.png` });
      await a.bringToFront();
      await a.evaluate(id => {
        const v = e.remoteVisitors.get(id), dx = v.target.x - e.player.position.x, dz = v.target.z - e.player.position.z;
        e.yaw = Math.atan2(-dx, -dz); e.pitch = 0;
      }, occupants[1].id);
      await a.waitForFunction(id => { const v = e.remoteVisitors.get(id); return !e.player.visible && v?.group.visible && !v.label.hidden; }, occupants[1].id);
      check(true, 'An upstairs first-person visitor sees the other visitor as a visible named spirit');
      await a.screenshot({ path: `${output}/multiplayer-inside.png` });
      const stationary = await a.evaluate(() => e.player.position.toArray());
      await b.bringToFront();
      await b.evaluate(() => { e.yaw = 0; e.pitch = 0; });
      const before = await b.evaluate(() => e.player.position.toArray());
      await b.keyboard.down('w');
      await b.waitForFunction(position => Math.hypot(e.player.position.x - position[0], e.player.position.z - position[2]) > 1, before);
      await b.keyboard.up('w');
      const moved = await b.evaluate(() => e.player.position.toArray());
      await ground.bringToFront();
      await ground.waitForFunction(({ id, position }) => e.remoteVisitors.get(id)?.group.position.distanceTo({ x: position[0], y: position[1], z: position[2] }) < .08,
        { id: occupants[1].id, position: moved });
      check(await a.evaluate(position => Math.hypot(e.player.position.x - position[0], e.player.position.z - position[2]) < .001, stationary),
        'One visitor walking changes the ground observer pose without moving the other visitor');
      await ground.screenshot({ path: `${output}/multiplayer-ground-after-walk.png` });
      const late = await join();
      const welcome = await late.evaluate(ids => {
        const welcome = testMessages.find(v => v.type === 'welcome');
        return welcome.visitors.filter(v => ids.includes(v.id)).map(v => ({ id: v.id, x: v.x, y: v.y, z: v.z, lookout: v.lookout }));
      }, occupants.map(v => v.id));
      fs.writeFileSync(`${output}/multiplayer-welcome.json`, JSON.stringify(welcome, null, 2));
      check(welcome.length === 2 && welcome.every(v => v.y === 11.4), 'A late joiner immediately receives both current elevated gallery positions');
      check(welcome.every(v => Number.isInteger(v.lookout)), 'Late-join snapshots include the shared gallery admission claims');
      await late.bringToFront();
      await late.waitForFunction(ids => ids.every(id => e.remoteVisitors.get(id)?.target.y === 11.4), occupants.map(v => v.id));
      check(true, 'The late-joining rendered client places both tower visitors on the deck');
      // Occupants use normal shared movement messages to exercise body overlap and all eight claims.
      const overlap = await b.evaluate(position => new Promise(resolve => {
        const corrected = event => { const v = JSON.parse(event.data); if (v.type === 'move' && v.id === e.sharedSelfId) {
          testSocket.removeEventListener('message', corrected); resolve(v); } };
        testSocket.addEventListener('message', corrected);
        testSocket.send(JSON.stringify({ type: 'move', x: position[0], y: 0, z: position[2], heading: 0, lookout: e.lookoutIndex }));
      }), stationary);
      check(overlap.y === 11.4, 'The Worker corrects a walking request that tries to leave the gallery floor height');
      const observations = { overlapAllowed: Math.hypot(overlap.x - stationary[0], overlap.z - stationary[2]) < .001,
        welcome, occupants, moved };
      await ground.bringToFront();
      await ground.waitForFunction(({ id, position }) => Math.hypot(e.remoteVisitors.get(id).target.x - position[0], e.remoteVisitors.get(id).target.z - position[2]) < .001,
        { id: occupants[1].id, position: stationary });
      await ground.screenshot({ path: `${output}/multiplayer-overlap.png` });
      console.log(`Visitor body overlap is ${observations.overlapAllowed ? 'allowed' : 'blocked'}.`);
      await late.evaluate(async () => {
        window.watchers = [];
        for (let i = 0; i < 6; i++) {
          const ws = new WebSocket(testSocket.url); watchers.push(ws);
          await new Promise(resolve => ws.addEventListener('message', event => { if (JSON.parse(event.data).type === 'welcome') resolve(); }));
          const tower = e.world.authored.structures.tower;
          const result = await new Promise(resolve => {
            ws.addEventListener('message', event => { const v = JSON.parse(event.data); if (v.type === 'interaction_result') resolve(v.result); });
            ws.send(JSON.stringify({ type: 'interaction', requestId: 'capacity', request: { kind: 'lookout' },
              pose: { x: tower.x, y: tower.y, z: tower.z + 3.5, heading: 0, active: true } }));
          });
          if (!result.ok) throw Error(result.reason);
          ws.keepAlive = setInterval(() => ws.send(JSON.stringify({ type: 'heartbeat', active: true, lookout: result.lookoutIndex })), 500);
          ws.send(JSON.stringify({ type: 'heartbeat', active: true, lookout: result.lookoutIndex }));
        }
      });
      await ground.bringToFront();
      await ground.waitForFunction(() => [...e.remoteVisitors.values()].filter(v => Math.abs(v.target.y - 11.4) < .001).length === 8);
      check(await ground.evaluate(() => [...e.remoteVisitors.values()].filter(v => Math.abs(v.target.y - 11.4) < .001).every(v => v.group.visible)), 'The ground observer renders all eight shared gallery occupants');
      check(await ground.evaluate(() => towerTransitions.every(v => v.distance < .00001)), 'Crowded gallery arrivals also use immediate accepted positions');
      await ground.screenshot({ path: `${output}/multiplayer-full-gallery.png` });
      await approach(late); await late.keyboard.press('e');
      await late.getByText('The lookout is full. Wait for someone to come down.', { exact: true }).waitFor();
      check(await late.evaluate(() => !e.lookoutPosition), 'A ninth rendered visitor is refused and remains on the ground');
      await a.bringToFront(); await a.keyboard.press('Escape'); await a.waitForFunction(() => !e.lookoutPosition);
      await ground.bringToFront();
      await ground.waitForFunction(id => e.remoteVisitors.get(id)?.target.y < 1, occupants[0].id);
      check(await b.evaluate(() => !!e.lookoutPosition), 'An exit appears on the ground to observers and leaves the other visitor upstairs');
      check(await ground.evaluate(id => towerTransitions.some(v => v.id === id && v.to === null && v.distance < .00001), occupants[0].id),
        'Coming down places the observed spirit at the door without floating through the shaft');
      await approach(late); await late.keyboard.press('e'); await late.waitForFunction(() => e.lookoutPosition !== null);
      check(true, 'The ninth visitor can enter as soon as another visitor releases admission');
      await b.evaluate(() => testSocket.close());
      await b.waitForFunction(() => !e.lookoutPosition && e.player.visible);
      await ground.bringToFront();
      await ground.waitForFunction(id => !e.remoteVisitors.has(id), occupants[1].id);
      check(true, 'Disconnect removes the remote gallery spirit and restores the disconnected local camera to ground');
      await b.waitForFunction(() => e.sharedConnected);
      await approach(b); await b.keyboard.press('e'); await b.waitForFunction(() => e.lookoutPosition !== null);
      check(true, 'A reconnecting browser requests fresh shared admission successfully');
      await late.evaluate(() => watchers.forEach(ws => { clearInterval(ws.keepAlive); ws.close(); }));
      for (const page of [b, late]) {
        await page.bringToFront(); await page.keyboard.press('m'); await page.locator('[data-map-destination="focus"]').click();
        await page.waitForFunction(() => e.place === 'focus' && !e.lookoutPosition);
      }
      await ground.bringToFront();
      await ground.waitForFunction(() => [...e.remoteVisitors.values()].every(v => v.target.y < 1 || v.activity === 'focus'));
      check(await b.evaluate(() => [...e.remoteVisitors.values()].every(v => !v.group.visible))
        && await late.evaluate(() => [...e.remoteVisitors.values()].every(v => !v.group.visible)), 'Two private focus interiors hide outdoor visitors and release both gallery claims');
      check(!errors.length, 'The multiplayer observer review has no page errors');
      fs.writeFileSync(`${output}/multiplayer-checks.json`, JSON.stringify({ checks, observations, errors }, null, 2));
      console.log(`${checks.length} multiplayer perception checks passed.`); return;
    }
    if (process.env.SMOKE_ONLY === '1') {
      await approach(a); await a.keyboard.press('e');
      await a.waitForFunction(() => e.lookoutPosition && e.camera.position.y > 12 && !e.player.visible);
      check(true, 'The actual 3051 export and Worker2567 accept elevated first-person tower entry');
      await approach(b); await b.keyboard.press('e'); await b.waitForFunction(() => e.lookoutPosition !== null);
      check(await b.evaluate(() => [...e.remoteVisitors.values()].some(v => v.target.y > 11)), 'A second served client sees the shared elevated visitor');
      await a.bringToFront();
      for (const [width, height] of [[1366,768], [1280,720], [1024,640], [800,640]]) {
        await a.setViewportSize({ width, height });
        const box = await a.locator('.v-lookout-controls').boundingBox();
        check(box && box.x >= 0 && box.x + box.width <= width && box.y > height / 2 && box.y + box.height <= height - 40 && box.height < 110, `The final served gallery control stays compact and below the view at ${width}×${height}`);
      }
      await a.setViewportSize({ width: 1366, height: 768 });
      await a.screenshot({ path: `${output}/tower-village-served.png` });
      for (const page of [a,b]) { await page.bringToFront(); await page.keyboard.press('Escape'); await page.waitForFunction(() => !e.lookoutPosition && e.player.visible && e.player.position.y < 1); }
      check(true, 'Both served visitors come down safely');
      check(!errors.length, 'The final served preview has no page errors');
      fs.writeFileSync(`${output}/served-checks.json`, JSON.stringify({ checks, errors }, null, 2));
      console.log(`${checks.length} served tower smoke checks passed.`); return;
    }
    await approach(a);
    await a.screenshot({ path: `${output}/tower-entrance.png` });
    await a.getByRole('button', { name: 'Go up to the lookout', exact: true }).click();
    await a.waitForFunction(() => e.lookoutPosition !== null && e.camera.position.y > 12 && !e.player.visible);
    check(await a.evaluate(() => e.camera.position.y > 12 && !e.player.visible), 'Entering places a first-person camera above the gallery floor');
    await b.waitForFunction(() => e.remoteVisitors.size && [...e.remoteVisitors.values()].some(v => v.target.y > 11));
    check(true, 'A real observer sees the elevated visitor');
    await approach(b); await b.keyboard.press('e'); await b.waitForFunction(() => e.lookoutPosition !== null);
    check(await b.evaluate(() => e.lookoutIndex === 1), 'A second real visitor receives a distinct shared gallery spot');
    await a.bringToFront();
    await a.waitForFunction(() => e.remoteVisitors.size && [...e.remoteVisitors.values()].some(v => v.target.y > 11));
    await a.evaluate(() => { e.yaw = 0; e.pitch = .28; });
    const start = await a.evaluate(() => ({ position: e.player.position.toArray(), yaw: e.yaw, pitch: e.pitch }));
    await a.keyboard.down('w');
    await a.waitForFunction(position => Math.hypot(e.player.position.x - position[0], e.player.position.z - position[2]) > 1, start.position);
    await a.keyboard.up('w');
    check(await a.evaluate(start => e.yaw === start.yaw && e.pitch === start.pitch && !e.player.visible
      && Math.abs(e.camera.position.y - e.player.position.y - 1.35) < .001, start), 'W walks across the deck in first person without turning or tilting');
    const walked = await a.evaluate(() => e.player.position.toArray());
    await b.bringToFront();
    await b.waitForFunction(position => [...e.remoteVisitors.values()].some(v => Math.hypot(v.target.x - position[0], v.target.z - position[2]) < .15), walked);
    check(true, 'A real observer receives the walking gallery position');
    await a.bringToFront();
    const strafe = await a.evaluate(() => e.player.position.toArray());
    await a.keyboard.down('ArrowRight');
    await a.waitForFunction(position => Math.hypot(e.player.position.x - position[0], e.player.position.z - position[2]) > .7, strafe);
    await a.keyboard.up('ArrowRight');
    check(true, 'Arrow keys strafe across the gallery');
    await a.evaluate(() => { e.yaw = 0; e.pitch = .28; });
    await a.keyboard.down('w');
    await a.waitForFunction(() => { const tower = e.world.authored.structures.tower; return e.player.position.z < tower.z - 3; });
    await a.waitForTimeout(400); await a.keyboard.up('w');
    check(await a.evaluate(() => { const tower = e.world.authored.structures.tower;
      return Math.hypot(e.player.position.x - tower.x, e.player.position.z - tower.z) <= 3.05001
        && Math.abs(e.player.position.y - tower.y - 11.4) < .001; }), 'Held movement stops at the railing and stays on the deck');
    await a.screenshot({ path: `${output}/tower-walking.png` });
    const before = await a.evaluate(() => ({ yaw: e.yaw, position: e.camera.position.toArray() }));
    await a.keyboard.down('End');
    await a.waitForFunction(yaw => Math.abs(e.yaw - yaw) >= Math.PI * 2, before.yaw, { timeout: 20000 });
    await a.keyboard.up('End');
    check(await a.evaluate(position => e.camera.position.distanceTo({ x: position[0], y: position[1], z: position[2] }) < .001, before.position), 'A full keyboard rotation leaves the viewpoint anchored in the tower');
    await a.keyboard.down('PageDown'); await a.waitForFunction(() => e.pitch > 1.3); await a.keyboard.up('PageDown');
    check(await a.evaluate(() => e.camera.getWorldDirection(e.temp).y < -.95), 'The gallery camera can look steeply down into town');
    await a.screenshot({ path: `${output}/tower-down.png` });
    await a.keyboard.down('PageUp'); await a.waitForFunction(() => e.pitch < -.8); await a.keyboard.up('PageUp');
    check(await a.evaluate(() => e.camera.getWorldDirection(e.temp).y > .7), 'The gallery camera can look up under the spire');
    await a.evaluate(() => { e.yaw = Math.atan2(10.5, -71.5); e.pitch = .28; });
    await a.screenshot({ path: `${output}/tower-village.png` });
    // Native pointer events exercise whichever mouse capture mode this browser supports.
    const yaw = await a.evaluate(() => e.yaw);
    await a.mouse.move(550, 350); await a.mouse.down(); await a.mouse.move(750, 350, { steps: 8 }); await a.mouse.up();
    await a.waitForFunction(yaw => Math.abs(e.yaw - yaw) > .1, yaw);
    check(true, 'Actual canvas mouse input rotates the lookout camera');
    await a.evaluate(() => e.releaseMouseLook());
    for (const [width, height] of [[1366, 768], [1280, 720], [1024, 640], [800, 640]]) {
      await a.setViewportSize({ width, height });
      const box = await a.getByRole('button', { name: 'Come down', exact: true }).boundingBox();
      check(box && box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= height && box.height >= 44, `Lookout exit is visible and usable at ${width}×${height}`);
    }
    await a.keyboard.press('Escape'); await a.waitForFunction(() => e.lookoutPosition === null && e.player.visible && e.player.position.y < 1);
    check(await a.evaluate(() => e.movement.clear(e.player.position.x, e.player.position.z)), 'Escape returns the visitor to clear ground beside the door');
    await approach(a); await a.keyboard.press('e'); await a.waitForFunction(() => e.lookoutIndex === 0).catch(async error => { console.log(await a.evaluate(() => ({ blocked: e.blocked, near: e.nearLookout, pending: e.lookoutPending, slot: e.lookoutIndex, notices: document.querySelector('.v-notice')?.textContent, messages: testMessages.filter(v => v.type === 'interaction_result').slice(-5) }))); throw error; });
    check(true, 'A released lookout spot can be re-entered with the keyboard');
    await a.getByRole('button', { name: 'Come down', exact: true }).click(); await a.waitForFunction(() => e.lookoutPosition === null);
    check(true, 'The visible exit button matches Escape');
    await approach(a); await a.keyboard.press('e'); await a.waitForFunction(() => e.lookoutPosition !== null);
    await a.evaluate(() => testSocket.close()); await a.waitForFunction(() => e.lookoutPosition === null && e.player.visible);
    check(true, 'Losing the connection safely returns the local camera to ground');
    await a.waitForFunction(() => e.sharedConnected, null, { timeout: 20000 });
    await approach(a); await a.keyboard.press('e'); await a.waitForFunction(() => e.lookoutPosition !== null);
    check(true, 'Reconnection permits a fresh accepted tower entry');
    const c = await join();
    await c.waitForFunction(() => [...e.remoteVisitors.values()].filter(v => v.target.y > 11).length === 2);
    check(true, 'A late-joining real client sees both visitors at the tower');
    await c.bringToFront();
    await c.evaluate(async url => {
      window.watchers = [];
      for (let index = 0; index < 6; index++) {
        const ws = new WebSocket(url); watchers.push(ws);
        await new Promise(resolve => ws.addEventListener('message', event => { if (JSON.parse(event.data).type === 'welcome') resolve(); }));
        const tower = e.world.authored.structures.tower;
        ws.send(JSON.stringify({ type: 'move', x: tower.x, y: tower.y, z: tower.z + 3.5, heading: 0 }));
        const result = await new Promise(resolve => {
          ws.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.type === 'interaction_result') resolve(message.result); });
          ws.send(JSON.stringify({ type: 'interaction', requestId: 'tower-fill', request: { kind: 'lookout' } }));
        });
        if (!result.ok) throw Error(result.reason);
        ws.send(JSON.stringify({ type: 'heartbeat', active: true, lookout: result.lookoutIndex }));
        ws.keepAlive = setInterval(() => ws.send(JSON.stringify({ type: 'heartbeat', active: true, lookout: result.lookoutIndex })), 1000);
      }
    }, process.env.LOCAL_WORKER_URL);
    await approach(c); await c.keyboard.press('e');
    await c.getByText('The lookout is full. Wait for someone to come down.', { exact: true }).waitFor();
    check(await c.evaluate(() => !e.lookoutPosition && !e.lookoutPending), 'Eight real WebSocket visitors fill the gallery; a ninth receives visible refusal without local entry');
    await c.evaluate(() => { clearInterval(watchers[0].keepAlive); watchers[0].close(); });
    await c.waitForTimeout(200); await c.keyboard.press('e'); await c.waitForFunction(() => e.lookoutIndex === 2);
    check(true, 'Closing a real full-gallery connection frees its position for the waiting visitor');
    await c.getByRole('button', { name: 'Come down', exact: true }).click();
    await c.evaluate(() => watchers.slice(1).forEach(ws => { clearInterval(ws.keepAlive); ws.close(); }));
    for (const page of [a, b]) {
      await page.bringToFront(); await page.keyboard.press('m');
      await page.locator('[data-map-destination="focus"]').click();
      await page.waitForFunction(() => e.place === 'focus' && e.lookoutPosition === null);
    }
    check(await a.evaluate(() => e.place === 'focus') && await b.evaluate(() => e.place === 'focus'), 'Both tower visitors can enter their independent private focus cottages');
    check(await b.evaluate(() => [...e.remoteVisitors.values()].every(visitor => !visitor.group.visible)), 'Private focus hides the shared outdoor tower visitors');
    check(!errors.length, `No page errors (${errors.length})`);
    fs.writeFileSync(`${output}/checks.json`, JSON.stringify({ checks, errors }, null, 2));
    console.log(`${checks.length} tower browser checks passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

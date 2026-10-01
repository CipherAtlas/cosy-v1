const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const output = process.env.OUTPUT_DIR || '/tmp/cosy-shared-ownership'; fs.mkdirSync(output, { recursive: true });
  const checks = [], errors = [], check = (ok, label) => { assert(ok, label); checks.push(label); };
  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--disable-features=LocalNetworkAccessChecks'] });
  const pages = [];
  try {
    for (let index = 0; index < 3; index++) {
      const page = await browser.newPage({ viewport: { width: 1366, height: 768 } }); pages.push(page);
      page.on('pageerror', error => { errors.push(error.message); console.error('Page error:', error.message); });
      page.on('console', message => { if (message.type() === 'error') console.error('Browser:', message.text()); });
      if (process.env.EXPORT_DIR) await page.route('http://127.0.0.1:3051/**', async route => {
        const relative = decodeURIComponent(new URL(route.request().url()).pathname);
        const file = path.join(process.env.EXPORT_DIR, relative.endsWith('/') ? `${relative}index.html` : relative);
        if (!file.startsWith(path.resolve(process.env.EXPORT_DIR) + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
        const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary' };
        await route.fulfill({ path: file, contentType: types[path.extname(file)] || 'application/octet-stream' });
      });
      await page.addInitScript(localWorker => {
        localStorage.setItem('cosy-village-preferences', JSON.stringify({ weather: 'golden', weatherMode: 'manual' }));
        window.testSockets = [];
        window.testMessages = [];
        const Native = window.WebSocket;
        window.WebSocket = class extends Native { constructor(...args) { super(localWorker || args[0], ...args.slice(1)); window.testSockets.push(this);
          this.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.type === 'interaction_result' || message.type === 'action_rejected') window.testMessages.push(message); }); } };
      }, process.env.LOCAL_WORKER_URL || null);
      console.log('Loading client', index + 1);
      await page.goto('http://127.0.0.1:3051');
      await page.getByRole('button', { name: 'Enter Hearthwillow' }).click({ timeout: 120000 });
      console.log('Entered client', index + 1);
      await page.waitForFunction(() => {
        for (let el = document.querySelector('canvas'); el; el = el.parentElement) {
          for (let fiber = el[Object.keys(el).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return) {
            for (let hook = fiber.memoizedState; hook; hook = hook.next) {
              const ref = hook.memoizedState?.current;
              if (ref?.setSharedActors && ref.sharedActors && ref.puppies) window.testEngine = ref;
              if (ref?.interact && ref.sendChat) window.testConnection = ref;
            }
          }
        }
        return !!window.testEngine && !!window.testConnection;
      }, null, { timeout: 120000 });
      await page.evaluate(() => testEngine.setQuality('low'));
    }
    console.log('All clients ready');
    const [a, b, c] = pages;
    await a.waitForFunction(() => testEngine.remoteVisitors.size === 2);
    check(await b.evaluate(() => testEngine.remoteVisitors.size === 2), 'Three real browser clients join one Worker');
    const dogId = await a.evaluate(() => testEngine.sharedActors.actors.find(actor => actor.kind === 'puppy').id);
    const nearDog = async page => {
      await page.evaluate(id => {
        const e = testEngine, dog = e.sharedActors.actors.find(actor => actor.id === id);
        e.movement.settle(dog.x + 1.1, dog.z + 1.25); e.player.position.set(e.movement.position.x, e.movement.position.y, e.movement.position.z);
        e.yaw = .65; e.pitch = .18;
      }, dogId);
      await page.waitForFunction(id => testEngine.nearPuppy?.id === id, dogId);
    };
    await nearDog(a); await a.locator('canvas').focus(); await a.keyboard.press('t');
    await a.waitForFunction(id => testEngine.sharedActors.actors.find(actor => actor.id === id)?.owner === testEngine.sharedSelfId, dogId);
    await nearDog(b);
    check(await b.getByRole('button', { name: /Pet / }).isDisabled(), 'Busy dogs show disabled Pet controls to other visitors');
    check(await b.getByRole('button', { name: /Walk with / }).isDisabled(), 'Busy dogs show disabled Walk controls to other visitors');
    await b.waitForFunction(id => { const state = testEngine.sharedActors.actors.find(actor => actor.id === id), position = testEngine.puppies.puppies.find(dog => dog.info.id === id).actor.position;
      return Math.hypot(position.x - state.x, position.z - state.z) < .02; }, dogId);
    const held = await b.evaluate(id => { const dog = testEngine.puppies.puppies.find(dog => dog.info.id === id); return dog.actor.position.toArray(); }, dogId);
    await b.waitForTimeout(1200);
    const heldAfter = await b.evaluate(id => testEngine.puppies.puppies.find(dog => dog.info.id === id).actor.position.toArray(), dogId);
    check(Math.hypot(heldAfter[0] - held[0], heldAfter[2] - held[2]) < .06, 'The observer sees the held dog stay still');
    await a.getByRole('button', { name: /Dance/ }).click();
    await b.waitForFunction(id => testEngine.puppies.puppies.find(dog => dog.info.id === id).command === 'dance', dogId);
    await c.waitForFunction(id => testEngine.sharedActors.actors.find(actor => actor.id === id)?.action === 'dance', dogId);
    check(await c.evaluate(id => testEngine.sharedActors.actors.find(actor => actor.id === id)?.action === 'dance', dogId), 'The accepted trick reaches both observing clients');
    const blocked = await b.evaluate(id => testConnection.interact({ kind: 'puppy', id, action: 'roll' }), dogId);
    check(!blocked.ok, 'Conflicting keyboard-equivalent trick requests are rejected');
    await a.waitForFunction(id => testEngine.sharedActors.actors.find(actor => actor.id === id)?.mode === 'hold', dogId, { timeout: 9000 });
    check(await a.getByRole('button', { name: /Dance/ }).isVisible(), 'A completed shared trick keeps its list open');
    await a.screenshot({ path: path.join(output, 'held-dog.png') });
    await a.keyboard.press('Escape');
    await b.waitForFunction(id => !testEngine.sharedActors.actors.find(actor => actor.id === id)?.owner, dogId);
    await b.getByRole('button', { name: /Walk with / }).click();
    await a.waitForFunction(id => testEngine.sharedActors.actors.find(actor => actor.id === id)?.following, dogId);
    await b.waitForFunction(id => testEngine.puppies.followers.some(dog => dog.id === id), dogId);
    check(true, 'Walking ownership reaches the collecting visitor');
    const beforeWalk = await a.evaluate(id => { const dog = testEngine.sharedActors.actors.find(actor => actor.id === id); return [dog.x, dog.z]; }, dogId);
    await b.locator('canvas').focus(); await b.keyboard.down('w'); await b.waitForTimeout(1600); await b.keyboard.up('w');
    const afterWalk = await a.evaluate(id => { const dog = testEngine.sharedActors.actors.find(actor => actor.id === id); return [dog.x, dog.z]; }, dogId);
    check(Math.hypot(afterWalk[0] - beforeWalk[0], afterWalk[1] - beforeWalk[1]) > .2, 'Observers see the walking dog move with its actual owner');
    const disconnectedId = await b.evaluate(() => { const id = testEngine.sharedSelfId; testSockets.at(-1).close(); return id; });
    await a.waitForFunction(id => !testEngine.sharedActors.actors.find(actor => actor.id === id)?.owner, dogId);
    check(true, 'Socket disconnect releases walking ownership on the other clients');
    await b.waitForFunction(oldId => testEngine.sharedConnected && testEngine.sharedSelfId !== oldId && testSockets.at(-1).readyState === WebSocket.OPEN, disconnectedId, { timeout: 12000 });
    const sameActors = await a.evaluate(() => testEngine.sharedActors.actors.map(actor => actor.id).sort());
    await b.waitForFunction(id => !testEngine.sharedActors.actors.find(actor => actor.id === id)?.owner, dogId);
    check(JSON.stringify(sameActors) === JSON.stringify(await b.evaluate(() => testEngine.sharedActors.actors.map(actor => actor.id).sort()))
      && await b.evaluate(id => testEngine.sharedActors.actors.every(actor => actor.owner !== id), disconnectedId), 'Reconnect receives current shared actors without abandoned owners');
    await b.evaluate(() => { testEngine.movement.settle(.3, 20); testEngine.player.position.copy(testEngine.movement.position); });
    await nearDog(a);
    await a.getByRole('button', { name: /Pet / }).click();
    await a.waitForFunction(id => testEngine.sharedActors.actors.find(actor => actor.id === id)?.mode === 'pet', dogId, { timeout: 8000 });
    await b.waitForFunction(id => testEngine.puppies.puppies.find(dog => dog.info.id === id)?.petting, dogId);
    check(await b.evaluate(() => !testEngine.puppies.pettingPuppy), 'Observers see the shared pet clip without entering the owner\'s pet camera');
    await a.waitForFunction(id => !testEngine.sharedActors.actors.find(actor => actor.id === id)?.owner, dogId, { timeout: 8000 });
    const residentId = 'wren';
    await a.evaluate(id => { const e = testEngine, actor = e.sharedActors.actors.find(actor => actor.id === id && actor.kind === 'resident');
      e.movement.settle(actor.x + 1.5, actor.z); e.player.position.copy(e.movement.position); }, residentId);
    const talk = await a.evaluate(id => testConnection.interact({ kind: 'resident', id, action: 'talk' }), residentId);
    check(talk.ok, 'A real browser can claim a resident conversation');
    await b.waitForFunction(id => testEngine.sharedActors.actors.find(actor => actor.id === id)?.mode === 'talk', residentId);
    const invite = await c.evaluate(id => testConnection.interact({ kind: 'resident', id, action: 'walk' }), residentId);
    check(!invite.ok, 'Another browser cannot collect a resident engaged in a conversation');
    await a.waitForTimeout(120);
    check((await a.evaluate(id => testConnection.interact({ kind: 'resident', id, action: 'walk' }), residentId)).ok, 'The conversation owner can invite the shared resident');
    await b.waitForFunction(id => testEngine.sharedActors.actors.find(actor => actor.id === id)?.following, residentId);
    check(await a.evaluate(() => testEngine.life.residents[4].following), 'The accepted resident invitation reaches the owner\'s renderer');
    await a.evaluate(id => testConnection.interact({ kind: 'resident', id, action: 'home' }), residentId);
    console.log('Dog hold, tricks, walk and reconnect verified');

    const benchId = await a.evaluate(() => testEngine.world.benches[0].id);
    for (const page of pages) await page.evaluate(id => {
      const e = testEngine, bench = e.world.benches.find(bench => bench.id === id);
      e.movement.settle(bench.x, bench.z + 1.8); e.player.position.set(e.movement.position.x, e.movement.position.y, e.movement.position.z);
    }, benchId);
    await a.waitForTimeout(350);
    await a.waitForFunction(id => testEngine.nearBench?.id === id, benchId);
    const approach = await a.evaluate(() => ({ id: testEngine.sharedSelfId, x: testEngine.player.position.x, z: testEngine.player.position.z }));
    await c.waitForFunction(({ id, x, z }) => { const target = testEngine.remoteVisitors.get(id)?.target; return target && Math.hypot(target.x - x, target.z - z) < .1; }, approach);
    await a.evaluate(id => testEngine.sit(id, 0), benchId);
    await a.waitForFunction(() => !!testEngine.seatedBench);
    const approachB = await b.evaluate(() => ({ id: testEngine.sharedSelfId, x: testEngine.player.position.x, z: testEngine.player.position.z }));
    await a.waitForFunction(({ id, x, z }) => { const target = testEngine.remoteVisitors.get(id)?.target; return target && Math.hypot(target.x - x, target.z - z) < .1; }, approachB);
    await b.waitForFunction(id => testEngine.nearBench?.id === id, benchId);
    await b.evaluate(id => testEngine.sit(id, 1), benchId);
    await b.waitForFunction(() => !!testEngine.seatedBench);
    await c.evaluate(id => testEngine.sit(id), benchId); await c.waitForTimeout(700);
    check(await c.evaluate(() => !testEngine.seatedBench), 'The third browser cannot sit on a full bench');
    const poses = await Promise.all([a, b].map(page => page.evaluate(() => testEngine.player.position.toArray())));
    check(Math.hypot(poses[0][0] - poses[1][0], poses[0][2] - poses[1][2]) > 1.2, 'Two accepted bench visitors occupy different physical seats');
    await a.evaluate(() => testEngine.stand()); await a.waitForTimeout(300);
    await c.evaluate(id => testEngine.sit(id, 0), benchId); await c.waitForFunction(() => !!testEngine.seatedBench);
    check(true, 'Standing frees a seat for the waiting visitor');
    await b.waitForFunction(() => !testEngine.sharedActors.birds.served && !testEngine.sharedActors.birds.queued, null, { timeout: 30000 });
    await b.locator('canvas').focus(); await b.keyboard.press('f');
    await b.waitForFunction(() => testEngine.gardenState.crumbPouch && (testEngine.sharedActors.birds.queued || testEngine.sharedActors.birds.served));
    const meal = await b.evaluate(() => testEngine.sharedActors.birds.throwAt);
    await a.waitForFunction(at => testEngine.sharedActors.birds.throwAt === at, meal);
    check(await c.evaluate(() => !testEngine.gardenState.crumbPouch), 'Bench feeding waits for a grant and keeps each visitor\'s crumbs private');
    check(true, 'Observers receive the same accepted flock serving time');
    for (const page of [b, c]) await page.evaluate(() => testEngine.stand());
    for (const page of [a, b]) {
      await page.getByRole('button', { name: 'Expand village map', exact: true }).click();
      await page.getByRole('button', { name: 'Focus cottage', exact: true }).click();
    }
    await a.waitForFunction(() => testEngine.place === 'focus'); await b.waitForFunction(() => testEngine.place === 'focus');
    check(await a.evaluate(() => [...testEngine.remoteVisitors.values()].every(visitor => !visitor.group.visible)), 'Private focus shows no other visitors');
    check(await b.evaluate(() => [...testEngine.remoteVisitors.values()].every(visitor => !visitor.group.visible)), 'Both visitors can independently use the private focus cottage');
    for (const viewport of [{ width: 1280, height: 720 }, { width: 1024, height: 640 }]) {
      await c.setViewportSize(viewport);
      check(await c.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Shared village fits ${viewport.width}×${viewport.height}`);
    }
    check(errors.length === 0, 'No captured browser page errors');
    fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ checks, errors }, null, 2) + '\n');
    console.log(`${checks.length} three-client browser checks passed.`);
  } catch (error) {
    for (const [index, page] of pages.entries()) {
      console.error('Client state', index + 1, JSON.stringify(await page.evaluate(() => window.testEngine && ({ pose: testEngine.getPlayerPose(), nearBench: testEngine.nearBench?.id, nearPuppy: testEngine.nearPuppy?.id,
        blocked: testEngine.blocked, seated: testEngine.seatedBench?.id, messages: window.testMessages?.slice(-10) })).catch(() => null)));
      await page.screenshot({ path: path.join(output, `failed-client-${index + 1}.png`) }).catch(() => {});
    }
    fs.writeFileSync(path.join(output, 'failed-checks.json'), JSON.stringify({ checks, errors }, null, 2) + '\n');
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

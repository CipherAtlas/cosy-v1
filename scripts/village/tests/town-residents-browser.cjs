// Actual exported village UI, with isolated assets and one local shared Worker.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
assert(process.env.EXPORT_DIR && process.env.LOCAL_WORKER_URL, 'Set the isolated export and local Worker');
const root = path.resolve(process.env.EXPORT_DIR);
const output = process.env.OUTPUT_DIR || '/tmp/cosy-town-residents-browser';
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
      await page.route('http://127.0.0.1:3051/**', route => {
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
      await page.getByRole('button', { name: 'Enter Hearthwillow', exact: true }).click({ timeout: 120000 });
      await page.waitForFunction(() => {
        for (let el = document.querySelector('canvas'); el; el = el.parentElement)
          for (let fiber = el[Object.keys(el).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return)
            for (let hook = fiber.memoizedState; hook; hook = hook.next) {
              const engine = hook.memoizedState?.current;
              if (engine?.life && engine.sharedConnected && engine.sharedActors?.town) { window.e = engine; engine.setQuality('low'); return true; }
            }
      }, null, { timeout: 120000 });
      const close = page.getByRole('button', { name: 'Close Hearthwillow chat', exact: true });
      if (await close.count()) await close.click();
      return page;
    }
    const a = await join(), b = await join();
    async function approach(page, id, side = 1) {
      await page.bringToFront();
      await page.evaluate(({ id, side }) => {
        const resident = e.sharedActors.actors.find(actor => actor.id === id);
        const model = e.life.residents.find(value => value.root.name.toLowerCase() === id);
        const options = Array.from({ length: 32 }, (_, i) => {
          const angle = i * Math.PI / 16 + side * .5 + (id === 'rowan' ? Math.PI : 0);
          return [resident.x + Math.sin(angle) * 2.7, resident.z + Math.cos(angle) * 2.7];
        });
        const point = options.find(point => e.movement.clear(...point) && model.movement.canWalkTo(...point));
        if (!point) throw Error(`No clear conversation approach for ${id}`);
        e.movement.settle(...point); e.yaw = Math.atan2(point[0] - resident.x, point[1] - resident.z); e.pitch = .3;
      }, { id, side });
      await page.waitForFunction(id => !document.querySelector(`.v-villager-bubble[data-villager="${id}"]`)?.hidden
        && e.life.residents[e.dialogue.nearest]?.root.name.toLowerCase() === id, id);
      await page.waitForTimeout(600);
    }
    const bubble = (page, id) => page.locator(`.v-villager-bubble[data-villager="${id}"]`);
    for (const [id, name] of [['rusk', 'Rusk'], ['poppy', 'Poppy'], ['cress', 'Cress']]) {
      await approach(a, id);
      const chat = a.getByRole('button', { name: `Chat with ${name}`, exact: true });
      check(await chat.isVisible() && await chat.locator('kbd').innerText() === 'F', `${name} uses the floating villager dialogue and a real F keycap`);
      await a.locator('canvas').focus(); await a.keyboard.press('f');
      await a.waitForFunction(id => e.life.sharedState(id)?.owner === e.sharedSelfId && e.life.sharedState(id)?.mode === 'talk', id);
      const speech = await bubble(a, id).locator('p').innerText();
      check(speech.length > 20, `${name} responds with their own personality`);
      await approach(b, id, -1);
      check(await b.getByRole('button', { name: `Chat with ${name}`, exact: true }).isDisabled(), `${name} cannot be taken from another visitor`);
      check(await bubble(b, id).locator('p').innerText() === speech, `${name}'s accepted dialogue is shared with the observer`);
      await a.bringToFront();
      for (const viewport of [{ width: 1366, height: 768 }, { width: 1024, height: 640 }]) {
        await a.setViewportSize(viewport);
        const rect = await chat.boundingBox();
        check(rect && rect.width >= 44 && rect.height >= 44 && rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= viewport.width && rect.y + rect.height <= viewport.height, `${name}'s chat stays reachable at ${viewport.width}×${viewport.height}`);
      }
      await a.screenshot({ path: path.join(output, `${id}-dialogue.png`) });
    }
    await a.setViewportSize({ width: 1366, height: 768 });
    await approach(a, 'rowan');
    check(await a.getByRole('button', { name: 'Invite Rowan to race', exact: true }).isHidden(), 'Rowan offers no race before a conversation');
    await a.locator('canvas').focus(); await a.keyboard.press('f');
    await a.waitForFunction(() => e.life.sharedState('rowan')?.owner === e.sharedSelfId && e.life.sharedState('rowan')?.mode === 'talk');
    await a.getByRole('button', { name: 'Invite Rowan to race', exact: true }).waitFor();
    check(await a.getByRole('button', { name: 'Invite Rowan to race', exact: true }).locator('kbd').innerText() === 'C', 'Rowan offers the race inside the same dialogue with its real C keycap');
    await approach(b, 'rowan', -1);
    check(await b.getByRole('button', { name: 'Chat with Rowan', exact: true }).isDisabled(), 'Rowan’s invitation remains with the speaking visitor');
    await a.screenshot({ path: path.join(output, 'rowan-invitation.png') });
    await a.bringToFront(); await a.locator('canvas').focus(); await a.keyboard.press('c');
    await a.waitForFunction(() => !!e.horseRiding.actor && e.sharedActors.town.race?.owner === e.sharedSelfId);
    await b.waitForFunction(() => e.sharedActors.actors.some(actor => actor.id === 'rowan' && actor.mode === 'ride') && !!e.sharedActors.town.rival);
    check(true, 'The dialogue invitation automatically mounts the visitor and Rowan for both real clients');
    check(await a.evaluate(() => !e.life.residents.find(resident => resident.root.name === 'Rowan').root.visible), 'Rowan has no duplicate standing blob while mounted');
    await a.waitForFunction(() => e.sharedActors.town.race.phase === 'racing');
    await a.screenshot({ path: path.join(output, 'race-mounted.png') });
    await a.keyboard.press('Escape');
    await a.waitForFunction(() => !e.horseRiding.actor && e.sharedActors.town.race.phase === 'cancelled');
    await b.waitForFunction(() => !e.sharedActors.town.rival && e.sharedActors.actors.find(actor => actor.id === 'rowan')?.mode !== 'ride');
    check(true, 'Leaving the race releases both racers and restores Rowan’s care routine');
    await approach(a, 'rowan'); await a.locator('canvas').focus(); await a.keyboard.press('f');
    await a.getByRole('button', { name: 'Invite Rowan to race', exact: true }).waitFor();
    await a.evaluate(() => testSocket.close());
    await a.waitForFunction(() => !e.sharedConnected);
    await b.waitForFunction(() => !e.sharedActors.actors.find(actor => actor.id === 'rowan')?.owner);
    check(true, 'Disconnect releases Rowan’s accepted conversation for other visitors');
    await a.waitForFunction(() => e.sharedConnected);
    check(true, 'The visitor reconnects to the same shared residents');
    check(errors.length === 0, 'Two real clients report no page errors');
    fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ checks, errors }, null, 2) + '\n');
    console.log(`${checks.length} town resident browser checks passed.`);
  } catch (error) {
    for (const page of pages) console.error(JSON.stringify(await page.evaluate(() => ({
      player: e?.player.position.toArray(), nearest: e?.dialogue?.nearest, enabled: e?.dialogue?.enabled,
      actors: e?.sharedActors?.actors.filter(actor => ['rusk','poppy','cress','rowan'].includes(actor.id)),
      results: testMessages.filter(message => message.type === 'interaction_result').slice(-5),
    })).catch(() => null), null, 2));
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

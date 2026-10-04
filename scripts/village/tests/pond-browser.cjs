// Real pond feeding and shared-clock rendering in two local exported-game clients.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const out = process.env.OUTPUT_DIR || '/tmp/cosy-pond-browser';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true }), errors = [], checks = [];
  const check = (ok, label) => { assert(ok, label); checks.push(label); console.log(label); };
  async function join() {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('cosy-village-preferences', JSON.stringify({ weather: 'golden', weatherMode: 'manual', mix: { enabled: false } }));
      window.pondSockets = []; const Native = window.WebSocket;
      window.WebSocket = class extends Native { constructor(...args) { super(...args); window.pondSockets.push(this); } };
    });
    await page.goto(process.env.VILLAGE_URL || 'http://127.0.0.1:3051/?sharedTrial=1');
    await page.getByRole('button', { name: 'Enter Hearthwillow' }).click({ timeout: 120000 });
    await page.waitForFunction(() => {
      for (let element = document.querySelector('canvas'); element; element = element.parentElement)
        for (let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return)
          for (let hook = fiber.memoizedState; hook; hook = hook.next) {
            const engine = hook.memoizedState?.current;
            if (engine?.garden && engine.sharedConnected) { window.e = engine; engine.setQuality('low'); return true; }
          }
    }, null, { timeout: 120000 });
    const close = page.getByRole('button', { name: 'Close Hearthwillow chat', exact: true }); if (await close.count()) await close.click();
    return page;
  }
  async function move(page, point, yaw = .25, pitch = .25) {
    await page.bringToFront(); await page.evaluate(([point, yaw, pitch]) => { e.movement.settle(...point); e.yaw = yaw; e.pitch = pitch; }, [point, yaw, pitch]);
    await page.waitForTimeout(800);
  }
  const sample = page => page.evaluate(() => ({ at: Date.now(), feedAt: e.sharedActors.pondFeedAt,
    birds: e.garden.birds.map(bird => ({ position: bird.root.position.toArray(), head: bird.head?.rotation.x, wings: bird.wings.map(wing => wing.rotation.z) })),
    pond: e.world.authored.items.find(item => item.asset === 'pond'), camera: e.camera.position.toArray(), draws: e.renderer.info.render.calls, triangles: e.renderer.info.render.triangles }));
  try {
    const a = await join(), b = await join();
    check(await a.evaluate(() => e.garden.birds.length === 15 && e.garden.birds.filter(b => b.swan).length === 3 && e.garden.fish.length === 8), 'Three swans, four ducks, eight ducklings and eight fish render');
    await move(a, [-22, -3], .4, .28); await move(b, [-22.5, -3], .4, .28);
    const before = await sample(a); await a.waitForTimeout(3500); const after = await sample(a), observer = await sample(b);
    check(after.birds.every((bird, i) => Math.hypot(bird.position[0] - before.birds[i].position[0], bird.position[2] - before.birds[i].position[2]) > .1), 'Every water bird swims along its shared route');
    check(after.birds.some((bird, i) => Math.abs(bird.head - before.birds[i].head) > .05 || bird.wings.some((wing, side) => Math.abs(wing - before.birds[i].wings[side]) > .05)), 'Quiet head dips and wing gestures vary between birds');
    check(after.birds.every((bird, i) => Math.hypot(bird.position[0] - observer.birds[i].position[0], bird.position[2] - observer.birds[i].position[2]) < .35), 'Both visitors observe the same swimming flock');
    const wet = data => data.birds.every(bird => ((bird.position[0] - data.pond.position[0]) / (9 * data.pond.scale[0])) ** 2 + ((bird.position[2] - data.pond.position[2]) / (12 * data.pond.scale[2])) ** 2 < 1);
    check(wet(after), 'All swimming birds remain within the enlarged pond');
    await a.screenshot({ path: `${out}/pond-families.png` });
    const maple = await a.evaluate(() => { const actor = e.sharedActors.actors.find(actor => actor.id === 'maple'); return [actor.x, actor.z + 2]; });
    await move(a, maple);
    await a.evaluate(() => pondSockets.at(-1).send(JSON.stringify({ type: 'garden', action: { kind: 'crumbs' } })));
    await a.waitForFunction(() => e.gardenState.crumbPouch);
    await move(a, [-23.7, -6.6]);
    await a.waitForFunction(() => e.nearGarden === 'feed');
    const previous = await a.evaluate(() => e.sharedActors.pondFeedAt);
    await a.locator('canvas').focus(); await a.keyboard.press('e');
    await a.waitForFunction(previous => e.sharedActors.pondFeedAt !== previous, previous);
    await b.waitForFunction(() => e.sharedActors.pondFeedAt !== null);
    check(await a.evaluate(() => e.sharedActors.pondFeedAt) === await b.evaluate(() => e.sharedActors.pondFeedAt), 'E starts one accepted pond meal observed by both visitors');
    await a.waitForTimeout(4500);
    check(wet(await sample(a)), 'Feeding approaches stay in water beside the dock');
    check(await a.evaluate(() => e.garden.birds.slice(3).every((bird, index, birds) => birds.every((other, j) => index === j || bird.root.position.distanceTo(other.root.position) > .35))), 'Duck families use distinct feeding places');
    await b.bringToFront(); await b.waitForFunction(() => e.garden.hearts.visible, null, { timeout: 6000 });
    check(true, 'The shared supper produces visible happy hearts for observers');
    await a.bringToFront(); await a.waitForFunction(() => e.garden.hearts.visible, null, { timeout: 2000 });
    await a.screenshot({ path: `${out}/pond-feeding-hearts.png` });
    await a.emulateMedia({ reducedMotion: 'reduce' }); await a.waitForTimeout(300);
    check(await a.evaluate(() => e.garden.birds.every(bird => bird.root.rotation.z === 0 && bird.wings.every(wing => wing.rotation.z === 0))), 'Reduced motion suppresses bouncing and wing flutters');
    await a.setViewportSize({ width: 1024, height: 640 }); await a.screenshot({ path: `${out}/pond-small-window.png` });
    const last = await sample(a); check(wet(last), 'The final feeding flock remains within the pond');
    check(errors.length === 0, 'No pond browser errors');
    fs.writeFileSync(`${out}/pond-checks.json`, JSON.stringify({ checks, errors, before, after, observer, last }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

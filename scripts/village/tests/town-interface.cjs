// Render the authored map and private basket in the actual exported local app.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const output = process.env.OUTPUT_DIR || '/tmp/cosy-town-interface';
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-features=LocalNetworkAccessChecks'] });
  const errors = [], checks = [];
  const check = (okay, name) => { assert(okay, name); checks.push(name); console.log(name); };
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('cosy-village-preferences', JSON.stringify({ weather: 'golden', weatherMode: 'manual', mix: { enabled: false } })));
    await page.goto(process.env.VILLAGE_URL || 'http://127.0.0.1:3051/');
    await page.getByRole('button', { name: 'Enter Hearthwillow' }).click({ timeout: 120000 });
    await page.waitForFunction(() => {
      for (let el = document.querySelector('canvas'); el; el = el.parentElement) {
        for (let fiber = el[Object.keys(el).find(k => k.startsWith('__reactFiber'))]; fiber; fiber = fiber.return) {
          for (let hook = fiber.memoizedState; hook; hook = hook.next) {
            const engine = hook.memoizedState?.current;
            if (engine?.getMapActors && engine.sharedConnected) { window.e = engine; engine.setQuality('low'); return true; }
          }
        }
      }
    }, null, { timeout: 120000 });
    const chat = page.getByRole('button', { name: 'Close Hearthwillow chat', exact: true });
    if (await chat.count()) await chat.click();
    await page.locator('canvas').focus(); await page.keyboard.press('m');
    const map = page.locator('.v-map-canvas'); await map.waitFor();
    const postbox = map.locator('[data-map-destination="compliment"]');
    const anchor = await postbox.evaluate(node => [Number(node.dataset.mapX), Number(node.dataset.mapZ)]);
    const actual = await page.evaluate(() => e.world.mapScenery.layout.items.find(item => item.visible && item.asset === 'postbox').position);
    check(anchor[0] === actual[0] && anchor[1] === actual[2], 'Little postbox is anchored to its actual saved placement');
    check(await map.getByRole('button', { name: 'Meadow Swings', exact: true }).count() === 1, 'One unnumbered Meadow Swings option is served');
    const draws = await page.evaluate(() => new Promise(resolve => {
      let count = 0; const render = e.renderer.render;
      e.renderer.render = function(...args) { count++; return render.apply(this, args); };
      setTimeout(() => { e.renderer.render = render; resolve(count); }, 300);
    }));
    check(draws === 0, 'The served atlas suspends hidden 3D drawing');
    check(await map.locator('[data-map-landmark="farm-row"]').count() === 15, 'The map shows all fifteen actual farm rows');
    for (const place of ['racetrack', 'stable', 'grazing-field', 'owl-grove'])
      check(await map.locator(`[data-map-landmark="${place}"]`).count() === 1, `The map marks ${place}`);
    check(await map.locator('[data-map-actor][data-map-kind="resident"]').count() === 0, 'The map omits NPC markers');
    check(await map.locator('[data-map-actor][data-map-kind="puppy"]').count() === 0, 'The map omits dog markers');
    check(await map.locator('[data-map-swing]').count() === 2, 'The map shows both pasture swing placements');
    check(await map.locator('[data-map-river]').count() === 2 && await map.locator('[data-map-bridge]').count() === 3,
      'The map uses both authored river channels and all three bridges');
    check(await map.locator('[data-map-actor]').evaluateAll(nodes => nodes.every(node => node.dataset.mapKind === 'visitor')),
      'The map renders only other-player actor markers');
    check(await map.locator('.v-map-self-icon').count() === 1, 'The map includes your distinct compass marker');
    // Accepted other-player movement is covered by the three-client map-travel runner.
    for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 1024, height: 640 }, { width: 800, height: 640 }]) {
      await page.setViewportSize(viewport); await page.waitForTimeout(150);
      const box = await map.boundingBox();
      check(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height,
        `The expanded authored map fits ${viewport.width}x${viewport.height}`);
      const help = await page.locator('.v-map-help').boundingBox();
      check(help && help.y >= 0 && help.y + help.height <= viewport.height,
        `Map keyboard help stays visible at ${viewport.width}x${viewport.height}`);
      await postbox.hover();
      const label = await postbox.locator('.v-map-marker-name').boundingBox(), icon = await postbox.boundingBox();
      check(label && Math.abs(label.y + label.height - (icon.y - 7)) < 1 && Math.abs(label.x + label.width / 2 - icon.x - icon.width / 2) < 1,
        `The served postbox name reveals upright above its true icon at ${viewport.width}x${viewport.height}`);
      await page.screenshot({ path: `${output}/map-${viewport.width}.png` });
    }
    await page.keyboard.press('Escape'); await page.locator('canvas').focus(); await page.keyboard.press('i');
    await page.waitForFunction(() => !e.mapOpen && e.renderer.info.render.calls > 0);
    check(true, 'Closing the served map resumes 3D drawing');
    const basket = page.locator('.v-local-inventory'); await basket.waitFor();
    check(await basket.locator('dl > div').count() === 8, 'I opens one basket for farm/kitchen crops, woodland treats and tea');
    const displayed = await basket.locator('dd').allTextContents();
    const accepted = await page.evaluate(() => {
      const value = e.forageInventory; return ['apples','mushrooms','carrots','radishes','mint','daisies','sunflowers','mintTea'].map(key => String(value[key] || 0));
    });
    check(JSON.stringify(displayed) === JSON.stringify(accepted), 'The visible basket matches this visitor’s accepted private inventory');
    await page.screenshot({ path: `${output}/inventory.png` });
    check(errors.length === 0, `No page errors in map/inventory flow (${errors.length})`);
    fs.writeFileSync(`${output}/checks.json`, JSON.stringify({ pass: true, checks, errors }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

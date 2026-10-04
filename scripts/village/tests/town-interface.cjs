// Render the authored map and private basket in the actual exported local app.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const output = process.env.OUTPUT_DIR || '/tmp/cosy-town-interface';
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
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
    check(await map.locator('[data-map-landmark="farm-row"]').count() === 15, 'The map shows all fifteen actual farm rows');
    for (const place of ['racetrack', 'stable', 'grazing-field', 'owl-grove'])
      check(await map.locator(`[data-map-landmark="${place}"]`).count() === 1, `The map marks ${place}`);
    check(await map.locator('[data-map-actor][data-map-kind="resident"]').count() === 5, 'The map names all five shared villagers');
    check(await map.locator('[data-map-actor][data-map-kind="puppy"]').count() === 4, 'The map marks all four shared dogs');
    check(await map.locator('[data-map-swing]').count() === 2, 'The map shows both pasture swing placements');
    check(await map.locator('[data-map-river]').count() === 2 && await map.locator('[data-map-bridge]').count() === 3,
      'The map uses both authored river channels and all three bridges');
    const before = await map.locator('[data-map-actor]').evaluateAll(nodes => nodes.map(node => node.getAttribute('transform')));
    await page.waitForTimeout(1800);
    const after = await map.locator('[data-map-actor]').evaluateAll(nodes => nodes.map(node => node.getAttribute('transform')));
    check(after.some((value, i) => value !== before[i]), 'Live actor markers follow accepted moving poses while the map stays open');
    for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 1024, height: 640 }]) {
      await page.setViewportSize(viewport); await page.waitForTimeout(150);
      const box = await map.boundingBox();
      check(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height,
        `The expanded authored map fits ${viewport.width}x${viewport.height}`);
      const help = await page.locator('.v-map-help').boundingBox();
      check(help && help.y + help.height <= viewport.height - 24,
        `Map keyboard help stays visible at ${viewport.width}x${viewport.height}`);
      await page.screenshot({ path: `${output}/map-${viewport.width}.png` });
    }
    await page.keyboard.press('Escape'); await page.locator('canvas').focus(); await page.keyboard.press('i');
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

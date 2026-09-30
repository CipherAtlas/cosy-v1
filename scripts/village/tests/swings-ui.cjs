// Browser checks against the isolated static export, without public inspection globals.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const checks = [], errors = [], check = (ok, label) => { if (!ok) throw Error(label); checks.push(label); };
  const output = process.env.SWING_EVIDENCE || '/tmp/cosy-swings';
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.VILLAGE_URL || 'http://127.0.0.1:3093');
    await page.getByRole('button', { name: 'Enter Hearthwillow' }).waitFor({ timeout: 120000 });
    await page.getByRole('button', { name: 'Enter Hearthwillow' }).click();
    await page.evaluate(() => {
      // Test-only access to the existing React ref; the export exposes no engine global.
      for (let el = document.querySelector('canvas'); el; el = el.parentElement) {
        for (let fiber = el[Object.keys(el).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return) {
          for (let hook = fiber.memoizedState; hook; hook = hook.next) {
            const engine = hook.memoizedState?.current;
            if (!engine?.rideSwing) continue;
            window.swingUIEngine = engine;
            const swing = engine.world.swings[0]; swing.root.localToWorld(engine.temp.set(0, 0, 1.65));
            engine.movement.settle(engine.temp.x, engine.temp.z); engine.player.position.copy(engine.movement.position);
            return;
          }
        }
      }
      throw Error('Could not locate the village engine ref');
    });
    const left = page.getByRole('button', { name: 'Left swing', exact: true });
    await left.waitFor(); await left.click();
    await page.getByRole('button', { name: 'Forward', exact: true }).waitFor();
    check(await page.evaluate(() => swingUIEngine.ridingSwing?.index === 0), 'Left swing click seats the player');
    for (const name of ['Forward', 'Back', 'Brake', 'Get off']) {
      const button = page.getByRole('button', { name, exact: true }), rect = await button.boundingBox();
      check(rect.height >= 44 && rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= 1280 && rect.y + rect.height <= 800, `${name} desktop target fits`);
      check(await button.locator('kbd').isVisible(), `${name} keycap is visible`);
    }
    const forward = page.getByRole('button', { name: 'Forward', exact: true });
    await forward.focus(); await page.keyboard.down('w'); await page.waitForTimeout(650);
    check(await page.evaluate(() => swingUIEngine.keys.has('w') && Math.abs(swingUIEngine.world.swings[0].pendulums[0].angle) > .08), 'Focused W control pumps the physical seat');
    await page.keyboard.up('w'); await page.keyboard.down('s');
    check(await page.evaluate(() => swingUIEngine.keys.has('s') && !swingUIEngine.keys.has('w')), 'S switches to backward pumping');
    await page.keyboard.up('s'); await page.keyboard.down('Space');
    check(await page.evaluate(() => swingUIEngine.keys.has(' ') && !swingUIEngine.movement.takeoff), 'Space brakes while a pump button has focus');
    await page.keyboard.up('Space');
    const rect = await forward.boundingBox(); await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
    check(await page.evaluate(() => swingUIEngine.keys.has('w')), 'Holding the on-screen Forward button pumps');
    await page.mouse.move(15, 15); await page.mouse.up();
    check(await page.evaluate(() => !swingUIEngine.keys.has('w')), 'Pointer capture releases pumping outside the button');
    await page.getByRole('button', { name: 'Get off', exact: true }).click();
    check(await page.evaluate(() => !swingUIEngine.ridingSwing && document.activeElement === swingUIEngine.renderer.domElement), 'Get off restores clear ground and canvas focus');
    await page.evaluate(() => { const e = swingUIEngine, s = e.world.swings[0]; s.root.localToWorld(e.temp.set(.98, 0, 1.65)); e.movement.settle(e.temp.x, e.temp.z); });
    await page.getByRole('button', { name: 'Right swing', exact: true }).click();
    check(await page.evaluate(() => swingUIEngine.ridingSwing?.index === 1), 'Right swing click selects the second independent seat');
    for (const [width, height] of [[1280, 720], [1366, 768]]) {
      await page.setViewportSize({ width, height }); await page.waitForTimeout(150);
      const panel = await page.locator('.v-swing-controls').boundingBox();
      check(panel.x > width / 2 && panel.y > height / 2 && panel.x + panel.width <= width && panel.y + panel.height <= height,
        `${width} by ${height} laptop viewport keeps the compact panel in a clear corner`);
    }
    await page.setViewportSize({ width: 1024, height: 640 }); await page.waitForTimeout(200);
    const card = await page.locator('.v-swing-controls').boundingBox();
    check(card.y > 300 && card.y + card.height <= 640 && card.width <= 400, 'Smaller laptop keeps most of the world view clear');
    check(card.width * card.height < 1024 * 640 * .1 && card.x > 650, 'Riding panel uses less than 10 percent of the smaller laptop and stays off the main scene');
    const alpha = await page.locator('.v-swing-controls').evaluate(el => [el, el.querySelector('button')].map(node => Number(getComputedStyle(node).backgroundColor.match(/[\d.]+/g)[3])));
    check(alpha[0] < .75 && alpha[1] < .5, 'Panel and buttons have translucent backgrounds');
    await page.screenshot({ path: output + '/swing-laptop.png' });
    await page.getByRole('button', { name: 'Back', exact: true }).focus(); await page.keyboard.press('e');
    check(await page.evaluate(() => !swingUIEngine.ridingSwing), 'Focused E shortcut gets off the swing');
    check(errors.length === 0, 'Rendered export has no captured page errors');
    fs.writeFileSync(output + '/ui-checks.json', JSON.stringify({ checks, errors }, null, 2));
    console.log(JSON.stringify({ checks, errors }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

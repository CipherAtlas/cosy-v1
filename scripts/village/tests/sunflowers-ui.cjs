const { chromium, firefox } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const kind = process.argv[2] || 'chrome';
  const browser = await (kind === 'firefox' ? firefox : chromium).launch({
    headless: true, ...(kind === 'chrome' ? { channel: 'chrome' } : {}),
    ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
  });
  const output = process.env.OUTPUT_DIR || '/tmp/cosy-sunflowers', checks = [], errors = [];
  fs.mkdirSync(output, { recursive: true });
  const check = (ok, label) => { if (!ok) throw Error(label); checks.push(label); };
  try {
    const page = await browser.newPage({ viewport: kind === 'firefox' ? null : { width: 1280, height: 720 } });
    page.on('pageerror', error => errors.push(String(error)));
    const garden = async () => {
      await page.getByRole('button', { name: 'Places', exact: true }).click();
      await page.getByRole('button', { name: /Kitchen garden A sprout/ }).click();
      await page.getByRole('button', { name: 'Flowers & mint', exact: true }).click();
    };
    const inventory = () => page.locator('.v-harvest-inventory dl > div').evaluateAll(rows =>
      Object.fromEntries(rows.map(row => [row.querySelector('dt').textContent, Number(row.querySelector('dd').textContent)])));
    await page.goto(process.env.APP_URL || 'http://127.0.0.1:3042/');
    await page.getByRole('button', { name: 'Enter the village', exact: true }).click({ timeout: 60000 });
    await garden();
    await page.getByRole('button', { name: 'View harvest basket', exact: true }).click();
    check(await page.getByText('Your basket is empty.', { exact: false }).isVisible(), 'Empty basket is explained');
    check(Object.values(await inventory()).every(n => n === 0), 'Inventory shows all five crops with zero quantities');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Harvest sunflowers', exact: true }).click();
    await page.getByRole('button', { name: 'Harvest daisies', exact: true }).click();
    await page.getByRole('button', { name: 'Vegetables', exact: true }).click();
    await page.getByRole('button', { name: 'Harvest bed 1', exact: true }).click();
    await page.getByRole('button', { name: 'View harvest basket', exact: true }).click();
    let amounts = await inventory();
    check(amounts.Sunflowers === 1 && amounts.Daisies === 1 && amounts.Carrots === 1, 'Harvesting different crops increments the matching inventory rows');
    await page.screenshot({ path: path.join(output, 'inventory-desktop-' + kind + '.png') });
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Back to village', exact: true }).click();
    await page.keyboard.down('w'); await page.waitForTimeout(250); await page.keyboard.up('w');
    await page.keyboard.down('a');
    try { await page.locator('.v-interact').filter({ hasText: 'Open harvest basket' }).waitFor({ timeout: 6000 }); }
    finally { await page.keyboard.up('a'); }
    check(await page.locator('.v-interact').innerText().then(s => s.includes('Open harvest basket')), 'Walking along the garden path offers the basket');
    await page.keyboard.press('e');
    await page.getByRole('dialog').waitFor();
    check(await page.getByRole('heading', { name: 'Harvest basket', exact: true }).isVisible(), 'E beside the basket opens the inventory');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.locator('.v-interact').filter({ hasText: 'Open harvest basket' }).click();
    check(await page.getByRole('heading', { name: 'Harvest basket', exact: true }).isVisible(), 'The nearby click control opens the same inventory');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await garden();
    await page.getByRole('button', { name: 'Plant sunflower in the sunflower row', exact: true }).click();
    await page.getByRole('button', { name: 'Water sunflowers', exact: true }).click();
    const clock = page.getByRole('img', { name: /Sunflowers:.*until ready/ });
    await clock.waitFor();
    const before = await clock.innerText(); await page.waitForTimeout(2200);
    check(await clock.innerText() !== before, 'Sunflower countdown ticks in the exported app');
    await page.reload();
    await page.getByRole('button', { name: 'Enter the village', exact: true }).click({ timeout: 60000 });
    await garden();
    check(await clock.isVisible(), 'Watered sunflowers continue growing after reload');
    await page.getByRole('button', { name: 'View harvest basket', exact: true }).click();
    amounts = await inventory();
    check(amounts.Sunflowers === 1 && amounts.Daisies === 1 && amounts.Carrots === 1, 'Stored inventory survives reload');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    // Advance only the saved crop timestamp to exercise the real UI completion boundary.
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('cosy-village-garden-v1'));
      state.beds[6].wateredAt = Date.now() - 298000;
      localStorage.setItem('cosy-village-garden-v1', JSON.stringify(state));
    });
    await page.reload();
    await page.getByRole('button', { name: 'Enter the village', exact: true }).click({ timeout: 60000 });
    await garden();
    await page.getByRole('button', { name: 'Harvest sunflowers', exact: true }).click({ timeout: 10000 });
    await page.getByRole('button', { name: 'View harvest basket', exact: true }).click();
    check((await inventory()).Sunflowers === 2, 'Completed sunflower growth yields another stored harvest');
    if (kind === 'chrome') {
      await page.setViewportSize({ width: 390, height: 844 });
      const bounds = await page.getByRole('dialog').boundingBox();
      check(bounds.x >= 0 && bounds.x + bounds.width <= 390 && await page.getByRole('button', { name: 'Close', exact: true }).isVisible(), 'Phone inventory fits the viewport and has a visible close button');
      await page.screenshot({ path: path.join(output, 'inventory-phone.png') });
    }
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Bring your harvest to Luma', exact: true }).click();
    await page.getByRole('button', { name: 'Give Luma a sunflower', exact: true }).click();
    check(await page.getByText('Luma: A sunflower!', { exact: false }).isVisible(), 'Sunflowers can be shared with Luma');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByLabel(/Language/).selectOption('ja');
    await page.getByLabel('シンプル表示', { exact: true }).click();
    await page.getByRole('button', { name: '場所', exact: true }).click();
    await page.getByRole('button', { name: /小さな菜園/ }).click();
    await page.getByRole('button', { name: '収穫かごを見る', exact: true }).click();
    check((await inventory())['ひまわり'] === 1, 'Japanese simple view shows the saved inventory after gifting');
    check(await page.getByRole('button', { name: '閉じる', exact: true }).isVisible(), 'Japanese simple view keeps an accessible close action');
    check(errors.length === 0, 'No application errors were captured');
    const report = { browser: kind, version: browser.version(), checks, errors, growthTiming: 'UI ticking/reload plus a shortened saved timestamp; no real five-minute wait' };
    fs.writeFileSync(path.join(output, 'ui-' + kind + '.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

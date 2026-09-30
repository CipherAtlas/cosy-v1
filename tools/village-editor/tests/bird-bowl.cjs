const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

(async () => {
  const output = process.env.OUTPUT_DIR || '/tmp/cosy-bird-redesign';
  fs.mkdirSync(output, { recursive: true });
  const presets = ['original-village', 'current-village'];
  const hashes = () => presets.map(name => crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '../presets', name + '.json'))).digest('hex'));
  const before = hashes(), errors = [], checks = [];
  const check = (ok, label) => { if (!ok) throw Error(label); checks.push(label); };
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.EDITOR_URL || 'http://127.0.0.1:3040');
    await page.waitForFunction(() => window.cosyStudio, { timeout: 60000 });
    // This fixture exercises prop transforms; existing scene overlaps are permitted.
    await page.locator('#avoid-overlaps').uncheck();
    await page.getByRole('searchbox').fill('Sourdough feeding dish');
    const card = page.locator('[data-asset="bird-feeding-dish"]');
    await card.waitFor();
    await page.waitForFunction(() => document.querySelector('[data-asset="bird-feeding-dish"] img')?.src?.startsWith('data:image'));
    check(true, 'Updated bowl has a rendered shelf preview');
    await card.click();
    const bounds = await page.locator('#viewport').boundingBox();
    await page.mouse.move(bounds.x + bounds.width * .52, bounds.y + bounds.height * .55);
    await page.mouse.click(bounds.x + bounds.width * .52, bounds.y + bounds.height * .55);
    await page.waitForFunction(() => cosyStudio.selection().some(id => cosyStudio.snapshot().layout.objects.some(item => item.id === id && item.asset === 'bird-feeding-dish')));
    check(true, 'Existing asset ID remains placeable and selectable');
    for (const [field, value] of Object.entries({ 'position-0': '-24', 'position-1': '0.4', 'position-2': '-31', 'rotation-1': '35', 'scale-0': '1.2' })) {
      await page.locator('#' + field).fill(value);
      await page.locator('#' + field).press('Tab');
    }
    await page.getByLabel('Layout name', { exact: true }).fill('Bigger bird bowl QA');
    await page.getByLabel('Layout name', { exact: true }).press('Tab');
    await page.locator('#save').click();
    await page.waitForFunction(() => cosyStudio.snapshot().fileId);
    const snapshot = await page.evaluate(() => cosyStudio.snapshot());
    const selected = await page.evaluate(() => cosyStudio.selection()[0]);
    await page.reload();
    await page.waitForFunction(() => window.cosyStudio, { timeout: 60000 });
    const item = await page.evaluate(id => cosyStudio.snapshot().layout.objects.find(item => item.id === id), selected);
    check(item?.position[0] === -24 && item.position[1] === .4 && item.position[2] === -31 && item.rotation[1] === 35 && item.scale.every(value => value === 1.2), 'Position, rotation and scale survive working-copy save/reload');
    check(JSON.stringify(hashes()) === JSON.stringify(before), 'Both protected presets remain byte-identical');
    check(!errors.length, 'No editor page errors');
    fs.writeFileSync(path.join(output, 'bowl-editor-checks.json'), JSON.stringify({ checks, savedLayout: snapshot.fileId, item, errors, presetHashes: before }, null, 2));
    console.log(checks.length + ' focused bowl editor checks passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

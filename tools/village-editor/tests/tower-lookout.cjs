const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const url = process.env.EDITOR_URL || 'http://127.0.0.1:3042';
const output = process.env.OUTPUT_DIR || '/tmp/cosy-tower-editor';
fs.mkdirSync(output, { recursive: true });
const checks = [], errors = [];
const check = (ok, label) => { assert(ok, label); checks.push(label); console.log(label); };
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url); await page.waitForFunction(() => window.cosyStudio, null, { timeout: 120000 });
    const catalog = await page.evaluate(() => cosyStudio.assets());
    const info = catalog.find(asset => asset.id === 'tower');
    check(info?.category === 'Buildings' && info.name.includes('lookout'), 'The complete watchtower gallery is registered in Buildings');
    await page.locator('#search').fill(info.name);
    const card = page.locator('[data-asset="tower"]'); await card.waitFor();
    await page.waitForFunction(() => document.querySelector('[data-asset="tower"] img')?.src.startsWith('data:image'), null, { timeout: 120000 });
    const src = await card.locator('img').getAttribute('src');
    fs.writeFileSync(path.join(output, 'editor-tower-preview.png'), Buffer.from(src.split(',')[1], 'base64'));
    check(await card.locator('img').evaluate(image => image.naturalWidth === 240 && image.naturalHeight === 192), 'The tower has a rendered gallery preview');
    const original = await page.evaluate(() => cosyStudio.original());
    await page.locator('#import-file').setInputFiles({ name: 'tower-working-copy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(original)) });
    await page.waitForFunction(() => cosyStudio.snapshot().layout.objects.some(item => item.id === 'tower')).catch(async error => { console.log(await page.locator('#status-message').textContent()); throw error; });
    await page.locator('#avoid-overlaps').uncheck(); await page.locator('#scene-tab').click();
    const tower = original.objects.find(item => item.id === 'tower');
    await page.locator('#search').fill(tower.name);
    await page.locator('#scene-list .scene-select').filter({ hasText: tower.name }).click();
    for (const [field, value] of Object.entries({ 'position-0': tower.position[0] + 4, 'rotation-1': 30 })) {
      await page.locator(`#${field}`).fill(String(value)); await page.locator(`#${field}`).press('Tab');
    }
    const changed = await page.evaluate(() => cosyStudio.snapshot().layout.objects.find(item => item.id === 'tower'));
    check(changed.position[0] === tower.position[0] + 4 && changed.rotation[1] === 30, 'The complete tower can be selected, moved and rotated');
    await page.locator('#layout-name').fill('Tower QA working copy'); await page.locator('#layout-name').press('Tab');
    await page.locator('#save').click(); await page.waitForFunction(() => !!cosyStudio.snapshot().fileId && !cosyStudio.snapshot().dirty);
    const id = await page.evaluate(() => cosyStudio.snapshot().fileId);
    const saved = (await (await page.request.get(`${url}/api/layouts/${id}`)).json()).layout;
    check(JSON.stringify(saved.objects.find(item => item.id === 'tower')) === JSON.stringify(changed), 'Saving preserves the tower transform and asset identity');
    await page.locator('#import-file').setInputFiles({ name: 'saved-tower.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) });
    await page.waitForFunction(x => cosyStudio.snapshot().layout.objects.find(item => item.id === 'tower').position[0] === x, changed.position[0]);
    check(true, 'Reloading the saved working copy retains the gallery placement');
    check(!errors.length, 'Editor has no page errors');
    fs.writeFileSync(path.join(output, 'editor-checks.json'), JSON.stringify({ checks, errors }, null, 2));
    console.log(`${checks.length} tower editor checks passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

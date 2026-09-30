// Run with --playable-file and --layouts-dir pointing at isolated QA copies.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const crypto = require('node:crypto');

(async () => {
  const url = process.env.EDITOR_URL || 'http://127.0.0.1:3058';
  const preset = 'tools/village-editor/presets/current-village.json';
  const hash = () => crypto.createHash('sha256').update(fs.readFileSync(preset)).digest('hex');
  const before = hash(), checks = [], errors = [];
  const check = (ok, label) => { if (!ok) throw Error(label); checks.push(label); };
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(url); await page.waitForFunction(() => window.cosyStudio, { timeout: 60000 });
    await page.getByRole('searchbox').fill('Sourdough crumb pouch');
    const card = page.locator('[data-asset="bird-crumb-pouch"]');
    await card.waitFor();
    await page.waitForFunction(() => document.querySelector('[data-asset="bird-crumb-pouch"] img')?.getAttribute('src')?.startsWith('data:image'));
    check(true, 'Pouch has a rendered Furnishings library preview');
    await page.locator('#scene-tab').click();
    await page.locator('#scene-list .scene-select').filter({ hasText: 'Sourdough crumb pouch' }).click();
    for (const [field, value] of Object.entries({ 'position-0': '-35.2', 'rotation-0': '5', 'rotation-1': '35', 'scale-0': '1.1' })) {
      await page.locator('#' + field).fill(value); await page.locator('#' + field).press('Tab');
    }
    const edited = await page.evaluate(() => cosyStudio.snapshot().layout.objects.find(o => o.id === 'bird-crumb-pouch'));
    check(edited.position[0] === -35.2 && edited.rotation[0] === 5 && edited.rotation[1] === 35 && edited.scale.every(n => Math.abs(n - 1.1) < .001), 'Pouch supports position, full rotation and scale');
    await page.getByLabel('Layout name', { exact: true }).fill('Crumb pouch QA');
    await page.getByLabel('Layout name', { exact: true }).press('Tab'); await page.locator('#save').click();
    await page.waitForFunction(() => cosyStudio.snapshot().fileId);
    const id = await page.evaluate(() => cosyStudio.snapshot().fileId);
    const saved = (await (await page.request.get(`${url}/api/layouts/${id}`)).json()).layout;
    check(JSON.stringify(saved.objects.find(o => o.id === 'bird-crumb-pouch')) === JSON.stringify(edited), 'Named save keeps the pouch transform');
    await page.reload(); await page.waitForFunction(() => window.cosyStudio, { timeout: 60000 });
    check(await page.evaluate(edited => JSON.stringify(cosyStudio.snapshot().layout.objects.find(o => o.id === 'bird-crumb-pouch')) === JSON.stringify(edited), edited), 'Reload restores the pouch transform');
    await page.locator('#layouts').click(); await page.locator('#apply-game').click();
    await page.waitForFunction(async edited => {
      const value = await (await fetch('/api/playable')).json();
      return JSON.stringify(value.layout.objects.find(o => o.id === 'bird-crumb-pouch')) === JSON.stringify(edited);
    }, edited);
    check(true, 'Apply writes the pouch transform into the isolated playable layout');
    const projected = await page.evaluate(async () => {
      const { projectWorldLayout } = await import('/modules/features/village/worldLayout.js');
      return projectWorldLayout((await (await fetch('/api/playable')).json()).layout).crumbPouches[0];
    });
    check(projected.x === -35.2 && Math.abs(projected.rotation[0] - 5 * Math.PI / 180) < .00001 && projected.scale[0] === 1.1, 'Runtime projection uses the saved pouch placement');
    check(hash() === before, 'Protected preset remains byte-identical');
    check(!errors.length, 'Editor has no page errors');
    console.log(JSON.stringify({ checks, errors }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

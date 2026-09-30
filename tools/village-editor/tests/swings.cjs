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
    await page.getByRole('searchbox').fill('Meadow swing set');
    const card = page.locator('[data-asset="meadow-swings"]');
    await card.waitFor();
    await page.waitForFunction(() => document.querySelector('[data-asset="meadow-swings"] img')?.getAttribute('src')?.startsWith('data:image'));
    check(true, 'Swing has a rendered Furnishings library preview');
    await page.getByRole('searchbox').fill('');
    await page.locator('#scene-tab').click();
    await page.locator('#scene-list .scene-select').filter({ hasText: 'Sunrise meadow swings' }).click();
    for (const [field, value] of Object.entries({ 'position-0': '60', 'rotation-1': '35', 'scale-0': '1.1' })) {
      await page.locator('#' + field).fill(value); await page.locator('#' + field).press('Tab');
    }
    const edited = await page.evaluate(() => cosyStudio.snapshot().layout.objects.find(o => o.id === 'sunrise-meadow-swings'));
    check(edited.position[0] === 60 && edited.rotation[0] === 0 && edited.rotation[1] === 35 && edited.scale.every(n => Math.abs(n - 1.1) < .001), 'Swing supports position, upright rotation and scale');
    await page.getByLabel('Layout name', { exact: true }).fill('Swing set QA');
    await page.getByLabel('Layout name', { exact: true }).press('Tab'); await page.locator('#save').click();
    await page.waitForFunction(() => cosyStudio.snapshot().fileId);
    const id = await page.evaluate(() => cosyStudio.snapshot().fileId);
    const saved = (await (await page.request.get(`${url}/api/layouts/${id}`)).json()).layout;
    check(JSON.stringify(saved.objects.find(o => o.id === 'sunrise-meadow-swings')) === JSON.stringify(edited), 'Named save keeps the swing transform');
    await page.reload(); await page.waitForFunction(() => window.cosyStudio, { timeout: 60000 });
    check(await page.evaluate(edited => JSON.stringify(cosyStudio.snapshot().layout.objects.find(o => o.id === 'sunrise-meadow-swings')) === JSON.stringify(edited), edited), 'Reload restores the swing transform');
    await page.locator('#layouts').click(); await page.locator('#apply-game').click();
    await page.waitForFunction(async edited => {
      const value = await (await fetch('/api/playable')).json();
      return JSON.stringify(value.layout.objects.find(o => o.id === 'sunrise-meadow-swings')) === JSON.stringify(edited);
    }, edited);
    check(true, 'Apply writes the swing transform into the isolated playable layout');
    const projected = await page.evaluate(async () => {
      const { projectWorldLayout } = await import('/modules/features/village/worldLayout.js');
      return projectWorldLayout((await (await fetch('/api/playable')).json()).layout).swings[0];
    });
    check(projected.x === 60 && Math.abs(projected.yaw - 35 * Math.PI / 180) < .00001 && projected.scale[0] === 1.1, 'Runtime projection uses the saved swing placement');
    const playable = await (await page.request.get(`${url}/api/playable`)).json();
    for (const change of [{ scale: [1, 1.3, 1] }, { rotation: [10, 35, 0] }]) {
      const invalid = structuredClone(playable.layout);
      Object.assign(invalid.objects.find(o => o.id === 'sunrise-meadow-swings'), change);
      const response = await page.request.post(`${url}/api/apply`, { headers: { Origin: url, 'If-Match': playable.revision }, data: invalid });
      check(response.status() === 422, 'Apply rejects a nonphysical swing scale or tilt');
    }
    check(hash() === before, 'Protected preset remains byte-identical');
    check(!errors.length, 'Editor has no page errors');
    fs.writeFileSync((process.env.SWING_EVIDENCE || '/tmp/cosy-swings') + '/editor-checks.json', JSON.stringify({ checks, errors }, null, 2));
    console.log(JSON.stringify({ checks, errors }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

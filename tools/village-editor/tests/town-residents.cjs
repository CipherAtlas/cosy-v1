const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const url = process.env.EDITOR_URL || 'http://127.0.0.1:3042';
const output = process.env.OUTPUT_DIR || '/tmp/cosy-town-residents-editor';
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
    for (const id of ['rusk', 'poppy', 'cress', 'rowan']) {
      const info = catalog.find(asset => asset.id === `villager-${id}`);
      check(info?.category === 'Villagers', `${id} is a named placeable asset on the Villagers shelf`);
      await page.locator('#search').fill(info.name);
      const card = page.locator(`[data-asset="villager-${id}"]`); await card.waitFor();
      await page.waitForFunction(id => document.querySelector(`[data-asset="villager-${id}"] img`)?.src.startsWith('data:image'), id, { timeout: 120000 });
      const src = await card.locator('img').getAttribute('src');
      fs.writeFileSync(path.join(output, `editor-${id}-preview.png`), Buffer.from(src.split(',')[1], 'base64'));
      check(await card.locator('img').evaluate(image => image.naturalWidth === 240 && image.naturalHeight === 192), `${id} has a real rendered preview`);
    }
    const original = (await (await page.request.get(`${url}/api/playable`)).json()).layout;
    await page.locator('#import-file').setInputFiles({ name: 'resident-working-copy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(original)) });
    await page.waitForFunction(() => cosyStudio.snapshot().layout.objects.some(item => item.id === 'resident-rowan'));
    await page.locator('#avoid-overlaps').uncheck(); await page.locator('#scene-tab').click();
    for (const id of ['rusk', 'poppy', 'cress', 'rowan']) {
      const originalItem = original.objects.find(item => item.id === `resident-${id}`);
      await page.locator('#search').fill(originalItem.name);
      await page.locator('#scene-list .scene-select').filter({ hasText: originalItem.name }).click();
      for (const [field, value] of Object.entries({ 'position-0': originalItem.position[0] + 2, 'rotation-1': 30, 'scale-0': 1.1 })) {
        await page.locator(`#${field}`).fill(String(value)); await page.locator(`#${field}`).press('Tab');
      }
      const item = await page.evaluate(id => cosyStudio.snapshot().layout.objects.find(item => item.id === `resident-${id}`), id);
      check(item.position[0] === originalItem.position[0] + 2 && item.rotation[1] === 30 && item.scale.every(value => Math.abs(value - 1.1) < .00001), `${id} supports real position, rotation and uniform scale controls`);
      check(await page.locator(`#route-resident option[value="${id}"]`).count() === 1, `${id} is available in the saved route editor`);
    }
    await page.locator('#layout-name').fill('Town residents QA working copy'); await page.locator('#layout-name').press('Tab');
    await page.locator('#save').click(); await page.waitForFunction(() => !!cosyStudio.snapshot().fileId && !cosyStudio.snapshot().dirty);
    const id = await page.evaluate(() => cosyStudio.snapshot().fileId);
    const saved = (await (await page.request.get(`${url}/api/layouts/${id}`)).json()).layout;
    await page.reload(); await page.waitForFunction(() => window.cosyStudio, null, { timeout: 120000 });
    assert.deepEqual(await page.evaluate(() => cosyStudio.snapshot().layout), saved); checks.push('All four resident identities, transforms and routes survive named saving and actual reload');
    await page.locator('#layouts').click(); await page.locator('#apply-game').click();
    await page.waitForFunction(() => !document.querySelector('#layout-dialog').open);
    assert.deepEqual((await (await page.request.get(`${url}/api/playable`)).json()).layout, saved); checks.push('Local Apply accepts all four new residents in the isolated playable file');
    check(errors.length === 0, 'The real editor reports no page errors');
    fs.writeFileSync(path.join(output, 'editor-checks.json'), JSON.stringify({ checks, errors, savedId: id }, null, 2) + '\n');
    console.log(`${checks.length} resident editor checks passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

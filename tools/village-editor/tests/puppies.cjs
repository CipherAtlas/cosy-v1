const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

(async () => {
  const url = process.env.EDITOR_URL || 'http://127.0.0.1:3052';
  const output = process.env.OUTPUT_DIR || '/tmp/cosy-puppy-editor';
  fs.mkdirSync(output, { recursive: true });
  const baseline = path.join(__dirname, '../presets/current-village.json');
  const hash = () => crypto.createHash('sha256').update(fs.readFileSync(baseline)).digest('hex');
  const before = hash(), checks = [], errors = [];
  const check = (valid, label) => { if (!valid) throw Error(label); checks.push(label); };
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(url);
    await page.waitForFunction(() => window.cosyStudio, { timeout: 60000 });
    const breeds = ['corgi', 'shiba', 'beagle', 'samoyed', 'collie', 'shepherd'];
    for (const breed of breeds) {
      const card = page.locator(`[data-asset="puppy-${breed}"]`);
      await card.waitFor();
      await page.waitForFunction(breed => document.querySelector(`[data-asset="puppy-${breed}"] img`)?.getAttribute('src')?.startsWith('data:image'), breed, { timeout: 60000 });
      check(true, `${breed} is in the shelf with a rendered preview`);
    }
    const initial = await page.evaluate(() => cosyStudio.snapshot());
    check(initial.layout.objects.filter(o => o.asset.startsWith('puppy-')).length === 6, 'Six pups are in the playable working copy');
    await page.locator('#scene-tab').click();
    await page.locator('#search').fill('Mochi');
    await page.locator('#scene-list .scene-select').filter({ hasText: 'Mochi' }).click();
    await page.locator('#position-0').fill('3.4'); await page.locator('#position-0').press('Tab');
    await page.locator('#rotation-1').fill('180'); await page.locator('#rotation-1').press('Tab');
    await page.locator('#scale-0').fill('1.15'); await page.locator('#scale-0').press('Tab');
    const edited = await page.evaluate(() => cosyStudio.snapshot().layout.objects.find(o => o.id === 'puppy-mochi'));
    check(edited.position[0] === 3.4 && edited.rotation[1] === 180 && edited.scale.every(value => Math.abs(value - 1.15) < .001), 'Mochi supports saved placement, facing and uniform scale');
    await page.locator('#search').fill('');
    await page.locator('#assets-tab').click();
    for (const [index, breed] of ['beagle','collie','shepherd'].entries()) {
      await page.locator(`[data-asset="puppy-${breed}"]`).click();
      const spot = await page.evaluate(offset => cosyStudio.screenPoint('puppy-mochi', [offset, 0, 0]), 2.3 + index * 1.5);
      await page.mouse.click(spot.x, spot.y);
      const placed = await page.evaluate(breed => cosyStudio.snapshot().layout.objects.filter(o => o.asset === `puppy-${breed}`).length, breed);
      check(placed === 2, `An additional ${breed} can be placed from the library`);
    }
    await page.getByLabel('Layout name', { exact: true }).fill('Puppy layout QA');
    await page.getByLabel('Layout name', { exact: true }).press('Tab');
    await page.locator('#save').click();
    await page.waitForFunction(() => cosyStudio.snapshot().fileId);
    const fileId = await page.evaluate(() => cosyStudio.snapshot().fileId);
    const savedResponse = await page.request.get(`${url}/api/layouts/${fileId}`);
    const saved = (await savedResponse.json()).layout;
    check(saved.objects.find(o => o.id === 'puppy-mochi').scale[0] === 1.15, 'Puppy transform survives a named file save');
    await page.reload(); await page.waitForFunction(() => window.cosyStudio, { timeout: 60000 });
    check((await page.evaluate(() => cosyStudio.snapshot().layout.objects.find(o => o.id === 'puppy-mochi').rotation[1])) === 180, 'Puppy transform survives editor reload');
    await page.locator('#layouts').click(); await page.locator('#apply-game').click();
    await page.waitForTimeout(500);
    const playable = await (await page.request.get(`${url}/api/playable`)).json();
    check(playable.layout.objects.find(o => o.id === 'puppy-mochi').position[0] === 3.4 && ['beagle','collie','shepherd'].every(breed => playable.layout.objects.filter(o => o.asset === `puppy-${breed}`).length === 2),
      'Apply carries puppy placement into the isolated playable layout');
    check(hash() === before, 'Protected preset is byte-identical');
    check(errors.length === 0, 'Editor has no page errors');
    fs.writeFileSync(path.join(output, 'editor-checks.json'), JSON.stringify({ checks, fileId, errors }, null, 2));
    console.log(`${checks.length} puppy editor checks passed`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });

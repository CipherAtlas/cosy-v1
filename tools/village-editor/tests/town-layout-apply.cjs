// Use a fresh loopback editor with an isolated --layouts-dir and --playable-file.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

(async () => {
  const url = process.env.EDITOR_URL;
  assert(url && ['127.0.0.1', 'localhost'].includes(new URL(url).hostname) && new URL(url).port !== '3040',
    'Use an isolated loopback editor origin; keep the user studio on port 3040 untouched');
  const playableFile = path.resolve(process.env.PLAYABLE_FILE || '');
  const layoutsDirectory = path.resolve(process.env.LAYOUTS_DIR || '');
  const canonicalFile = path.resolve('public/village/world-layout.json');
  assert(process.env.PLAYABLE_FILE && process.env.LAYOUTS_DIR && !playableFile.startsWith(process.cwd() + path.sep)
    && !layoutsDirectory.startsWith(process.cwd() + path.sep), 'Use temporary playable and layout paths outside the repository');
  const canonicalBytes = fs.readFileSync(canonicalFile), canonical = JSON.parse(canonicalBytes);
  assert.deepEqual(JSON.parse(fs.readFileSync(playableFile)), canonical, 'Isolated playable starts with the final canonical town');
  const output = process.env.OUTPUT_DIR || '/private/tmp/cosy-town-layout-apply-evidence';
  fs.mkdirSync(output, { recursive: true });
  const protectedFiles = [canonicalFile,
    ...['presets', 'layouts'].flatMap(directory => fs.readdirSync(`tools/village-editor/${directory}`)
      .filter(name => name.endsWith('.json')).map(name => path.resolve(`tools/village-editor/${directory}/${name}`)))];
  const hashes = () => Object.fromEntries(protectedFiles.map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
  const protectedBefore = hashes(), checks = [], errors = [], routes = [];
  const check = (condition, label) => { assert(condition, label); checks.push(label); };
  let browser, fileId, applyRevision;
  const report = status => fs.writeFileSync(path.join(output, 'canonical-apply-checks.json'), JSON.stringify({
    status, scope: 'Real local editor controls and Apply endpoint; isolated working files and browser origin',
    checks, errors, routes, fileId, applyRevision, canonicalHash: protectedBefore[canonicalFile],
    protectedBefore, protectedAfter: hashes(), isolatedPlayable: playableFile,
  }, null, 2) + '\n');
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(url);
    await page.waitForFunction(() => window.cosyStudio, null, { timeout: 120000 });
    await page.locator('#import-file').setInputFiles({ name: 'canonical-town.json', mimeType: 'application/json', buffer: canonicalBytes });
    await page.waitForFunction(name => cosyStudio.snapshot().layout.name === `${name} copy`, canonical.name);
    await page.locator('#layout-name').fill(canonical.name); await page.locator('#layout-name').press('Tab');
    assert.deepEqual(await page.evaluate(() => cosyStudio.snapshot().layout), canonical);
    checks.push('The complete canonical town imports without changing objects, transforms, terrain or routes');
    for (const id of ['pip', 'maple', 'moss', 'luma', 'wren']) {
      await page.locator('#route-resident').selectOption(id); await page.locator('#route-check').click();
      const result = await page.locator('#route-status').textContent(); routes.push({ id, result });
      check(result.includes(`${id} can reach all`), `The real editor validates ${id}'s canonical resident route: ${result}`);
    }
    await page.locator('#route-resident').selectOption('pip'); await page.locator('#route-check').click();
    await page.screenshot({ path: path.join(output, 'canonical-route-pip.png') });
    await page.locator('#save').click(); await page.waitForFunction(() => cosyStudio.snapshot().fileId);
    fileId = await page.evaluate(() => cosyStudio.snapshot().fileId);
    const saved = (await (await page.request.get(`${url}/api/layouts/${fileId}`)).json()).layout;
    assert.deepEqual(saved, canonical); checks.push('Named working-copy save preserves the entire canonical town');
    await page.reload(); await page.waitForFunction(() => window.cosyStudio, null, { timeout: 120000 });
    assert.deepEqual(await page.evaluate(() => cosyStudio.snapshot().layout), canonical);
    checks.push('The canonical working copy and resident routes survive a real browser reload');
    await page.locator('#layouts').click();
    const appliedResponse = page.waitForResponse(response => response.url() === `${url}/api/apply`
      && response.request().method() === 'POST', { timeout: 15000 });
    await page.locator('#apply-game').click();
    const response = await appliedResponse.catch(async error => {
      throw Error(`Canonical Apply did not reach the server: ${await page.locator('#toast').textContent()} (${error.message})`);
    });
    const appliedResult = await response.json();
    check(response.ok(), `The real Apply endpoint accepts the complete canonical town: ${appliedResult.error || response.status()}`);
    applyRevision = appliedResult.revision;
    await page.waitForFunction(() => !document.querySelector('#layout-dialog').open);
    const applied = (await (await page.request.get(`${url}/api/playable`)).json()).layout;
    assert.deepEqual(applied, canonical); checks.push('Apply writes exactly the canonical objects, terrain and resident routes to the isolated playable file');
    const history = fs.readdirSync(path.join(layoutsDirectory, '.history')).filter(name => name.startsWith('playable-'));
    check(history.some(name => fs.readFileSync(path.join(layoutsDirectory, '.history', name)).equals(canonicalBytes)),
      'Real Apply retains the previous isolated playable bytes in its history');
    await page.screenshot({ path: path.join(output, 'canonical-applied.png') });
    assert.deepEqual(hashes(), protectedBefore); checks.push('The active source layout and every original preset/named design remain byte-identical');
    check(errors.length === 0, 'Canonical editor Apply produces no page errors');
    report('passed'); console.log(`${checks.length} canonical editor Apply checks passed; ${protectedFiles.length - 1} saved designs unchanged.`);
  } catch (error) { errors.push(String(error)); report('failed'); throw error; }
  finally { if (browser) await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

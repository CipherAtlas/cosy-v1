// PLAYWRIGHT_PATH=/path/to/playwright STUDIO_URL=http://127.0.0.1:3042 node tools/village-editor/tests/editor-actions.cjs
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const url = process.env.STUDIO_URL || 'http://127.0.0.1:3042';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1560, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(url);
    await page.waitForFunction(() => window.cosyStudio, null, { timeout: 60000 });
    const snapshot = () => page.evaluate(() => window.cosyStudio.snapshot());
    const selected = async () => {
      const state = await snapshot();
      const id = await page.evaluate(() => window.cosyStudio.selection()[0]);
      return state.layout.objects.find(object => object.id === id);
    };
    await page.getByRole('button', { name: 'Top down', exact: true }).click();
    const canvas = await page.locator('#viewport > canvas').boundingBox();
    const x = canvas.x + canvas.width * .73, y = canvas.y + canvas.height * .67;

    await page.getByRole('searchbox').fill('Grass tuft');
    const shelf = page.getByRole('button', { name: 'Place Grass tuft', exact: true });
    await shelf.click();
    const count = (await snapshot()).layout.objects.length;
    await page.mouse.click(x, y);
    assert.equal((await selected()).asset, 'grass-tuft');
    assert.equal(await shelf.getAttribute('aria-pressed'), 'true');
    await page.mouse.click(x + 35, y);
    assert.equal((await snapshot()).layout.objects.length, count + 2);
    await page.keyboard.press('Escape');
    assert.equal(await shelf.getAttribute('aria-pressed'), 'false');
    console.log('PASS shelf asset remains active for repeated placement');

    await page.getByRole('button', { name: 'Draw fence' }).click();
    await page.mouse.click(x, y + 45);
    await page.mouse.click(x + 85, y + 45);
    await page.getByRole('button', { name: 'Finish fence' }).click();
    let fence = await selected();
    assert.equal(fence.asset, 'fence-line');
    assert.equal(fence.path.points.length, 2);
    await page.getByRole('spinbutton', { name: 'Height (metres)' }).fill('1.8');
    await page.getByRole('spinbutton', { name: 'Height (metres)' }).press('Tab');
    fence = await selected();
    assert.equal(fence.path.width, 1.8);
    const projection = await page.evaluate(async layout => {
      const { projectWorldLayout } = await import('/modules/features/village/worldLayout.js');
      return projectWorldLayout(layout).fences;
    }, (await snapshot()).layout);
    assert(projection.some(item => item.id === fence.id && item.height === 1.8));
    console.log('PASS fence draw, height edit and playable projection');

    await page.keyboard.press('ControlOrMeta+c');
    await page.mouse.click(x + 130, y + 110, { button: 'right' });
    const menu = page.locator('#context-menu');
    assert(await menu.isVisible());
    await menu.getByRole('menuitem', { name: 'Paste here' }).click();
    const copy = await selected();
    assert.equal(copy.asset, 'fence-line');
    assert.notEqual(copy.id, fence.id);
    console.log('PASS right-click paste at cursor');

    let picked = false;
    for (const point of copy.path.points) {
      const post = await page.evaluate(([id, x, z]) => window.cosyStudio.screenPoint(id, [x, 1, z]), [copy.id, point[0], point[1]]);
      await page.mouse.click(post.x, post.y, { button: 'right' });
      if ((await selected())?.id === copy.id) { picked = true; break; }
      await page.keyboard.press('Escape');
    }
    assert(picked, 'right click should select one of the fence posts');
    assert(await menu.isVisible());
    await menu.getByRole('menuitem', { name: 'Remove' }).click();
    assert(!(await snapshot()).layout.objects.some(object => object.id === copy.id));
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    assert((await snapshot()).layout.objects.some(object => object.id === copy.id));
    console.log('PASS right-click selects and removes an object; undo restores it');

    const beforePan = await page.evaluate(() => window.cosyStudio.camera().target);
    await page.mouse.move(x + 160, y + 100);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(x + 210, y + 100, { steps: 8 });
    await page.mouse.up({ button: 'right' });
    const afterPan = await page.evaluate(() => window.cosyStudio.camera().target);
    assert.notDeepEqual(afterPan, beforePan);
    assert(!(await menu.isVisible()));
    console.log('PASS right-drag still pans without opening the menu');

    await page.getByRole('button', { name: 'Save layout', exact: false }).click();
    await page.waitForFunction(() => window.cosyStudio.snapshot().fileId);
    const saved = await snapshot();
    await page.reload();
    await page.waitForFunction(() => window.cosyStudio, null, { timeout: 60000 });
    assert.deepEqual((await snapshot()).layout, saved.layout);
    assert.deepEqual(errors, []);
    console.log('PASS new interactions survive local save/reload without page errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

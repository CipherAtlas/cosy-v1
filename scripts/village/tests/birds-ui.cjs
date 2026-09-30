// Focused rendered-app checks; use a local static export and optionally a local dev mock room.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs'), path = require('node:path');
(async () => {
  const output = process.env.OUTPUT_DIR || '/tmp/cosy-birds'; fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const checks = [], errors = [];
  const check = (ok, label) => { if (!ok) throw Error(label); checks.push(label); };
  const seat = async (page, shared = false) => {
    await page.getByRole('button', { name: 'Enter Hearthwillow', exact: true }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'Places', exact: true }).click();
    await page.getByRole('button', { name: /Bird clearing/ }).click();
    await page.getByRole('button', { name: 'Back to village', exact: true }).click();
    if (shared) {
      // Shared activity arrivals are offset by visitor slot; use published poses to reach the bench.
      await page.waitForFunction(() => window.lastPose?.x < -30 && window.lastPose.x > -35 && window.lastPose.z < 5);
      await page.keyboard.down('s'); await page.waitForFunction(() => window.lastPose?.z >= 6); await page.keyboard.up('s');
      await page.keyboard.down('a');
      try { await page.getByRole('button', { name: /Sit on the bench/ }).waitFor({ timeout: 5000 }); }
      finally { await page.keyboard.up('a'); }
    } else {
      await page.keyboard.down('s'); await page.waitForTimeout(750); await page.keyboard.up('s');
      await page.keyboard.down('a'); await page.waitForTimeout(750); await page.keyboard.up('a');
    }
    try { await page.getByRole('button', { name: /Sit on the bench/ }).click({ timeout: 5000 }); }
    catch (error) {
      await page.screenshot({ path: path.join(output, 'navigation-failure.png') });
      console.error(await page.evaluate(() => ({ pose: window.lastPose, feedback: document.querySelector('.v-world-feedback')?.textContent })));
      throw error;
    }
  };
  try {
    for (const phone of [false, true]) {
      const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 800 }, hasTouch: phone });
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      await page.goto(process.env.APP_URL || 'http://127.0.0.1:3059/'); await seat(page);
      const scatter = page.locator('.v-world-feedback button[aria-keyshortcuts="F"]');
      check(await scatter.isVisible() && await scatter.isEnabled(), `${phone ? 'Phone' : 'Desktop'} bench offers crumbs without a resident gift`);
      const bounds = await scatter.boundingBox(), key = await scatter.locator('kbd').boundingBox();
      check(bounds.height >= 44 && key.width === key.height && await scatter.locator('kbd').innerText() === 'F', `${phone ? 'Phone' : 'Desktop'} has a square F keycap and 44 px target`);
      check(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= (phone ? 390 : 1280) && bounds.y + bounds.height <= (phone ? 844 : 800), 'Bench action fits the viewport');
      await page.screenshot({ path: path.join(output, phone ? 'bench-phone.png' : 'bench-desktop.png') });
      if (phone) await scatter.tap();
      else { await page.getByRole('button', { name: /Stand up/ }).focus(); await page.keyboard.press('f'); }
      await page.waitForFunction(() => document.querySelector('.v-world-feedback button[aria-keyshortcuts="F"]')?.disabled);
      check(await page.getByRole('button', { name: /Stand up/ }).isVisible(), `${phone ? 'Tap' : 'F with Stand up focused'} scatters without standing`);
      check(await scatter.isDisabled(), 'One meal cannot be restarted by repeated input');
      await page.locator('.v-canvas canvas').focus(); await page.keyboard.press('e');
      check(await page.getByRole('button', { name: /Sit on the bench/ }).isVisible(), 'E still stands up');
      await context.close();
    }
    if (process.env.SHARED_APP_URL) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      await context.addInitScript(() => {
        window.gardenSends = [];
        const NativeSocket = window.WebSocket;
        class MockSocket {
          static OPEN = 1;
          readyState = 1;
          constructor(url) {
            if (String(url).includes('/_next/')) return new NativeSocket(url);
            window.mockRoom = this;
            setTimeout(() => this.deliver({ type: 'welcome', selfId: 'self', visitors: [{ id: 'self', name: 'Visitor', slot: 1, color: '#e6a5b0', x: .3, z: 20, heading: 0 }], garden: { beds: [], crumbPouch: false }, chatHour: Math.floor(Date.now() / 3600000), chat: [] }), 10);
          }
          deliver(message) { this.onmessage?.({ data: JSON.stringify(message) }); }
          send(raw) {
            const message = JSON.parse(raw);
            if (message.type === 'move') window.lastPose = message;
            if (message.type !== 'garden') return;
            window.gardenSends.push(message.action.kind);
            this.hasCrumbs ||= message.action.kind === 'birdCrumbs';
            if (message.action.kind === 'feedBirds' && !this.hasCrumbs) throw Error('Shared feeding requires the visitor pouch');
            setTimeout(() => this.deliver({ type: 'garden', garden: { beds: [], crumbPouch: false }, event: { action: message.action, actor: 'self', x: -36.4, z: 6.5 } }), 0);
          }
          close() { this.readyState = 3; }
        }
        window.WebSocket = MockSocket;
      });
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      await page.goto(process.env.SHARED_APP_URL); await seat(page, true);
      await page.getByRole('button', { name: /Stand up/ }).focus(); await page.keyboard.press('f');
      await page.waitForFunction(() => window.gardenSends.includes('feedBirds'));
      check(JSON.stringify(await page.evaluate(() => window.gardenSends)) === JSON.stringify(['birdCrumbs', 'feedBirds']), 'Shared bench acquires pouch before sending feed through the existing protocol');
      await page.waitForFunction(() => document.querySelector('.v-world-feedback button[aria-keyshortcuts="F"]')?.disabled);
      check(await page.getByRole('button', { name: /Stand up/ }).isVisible(), 'Shared bench feed is accepted and visitor stays seated');
      const input = page.getByRole('textbox', { name: 'Message', exact: true });
      if (!await input.isVisible()) await page.locator('.v-shared-toggle').click();
      await input.fill(''); await input.press('f');
      check(await input.inputValue() === 'f' && (await page.evaluate(() => window.gardenSends.length)) === 2, 'Typing F in chat does not scatter crumbs');
      await context.close();
    }
    check(!errors.length, 'No application errors');
    fs.writeFileSync(path.join(output, 'ui-chrome.json'), JSON.stringify({ checks, errors }, null, 2));
    console.log(`${checks.length} rendered-app bird checks passed in Chrome`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });

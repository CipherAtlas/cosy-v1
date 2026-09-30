// Run only against an isolated local Worker and local admin proxy, never production.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const villageUrl = process.env.VILLAGE_URL || 'http://127.0.0.1:3051/?sharedTrial=1';
const adminUrl = process.env.ADMIN_URL || 'http://127.0.0.1:3056';
const workerUrl = process.env.WORKER_URL || 'ws://127.0.0.1:2577';
const output = process.env.OUTPUT_DIR || '/tmp/cosy-player-kick-qa';
for (const url of [villageUrl, adminUrl, workerUrl]) {
  assert.equal(new URL(url).hostname, '127.0.0.1', 'kick tests must use an isolated loopback server');
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const errors = [], checks = [];
  const check = (condition, label) => { assert(condition, label); checks.push(label); };
  try {
    const visitors = [];
    for (const ip of [process.env.TEST_IP || '192.0.2.10', process.env.TEST_IP || '192.0.2.10', process.env.OTHER_TEST_IP || '192.0.2.20']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, extraHTTPHeaders: { 'CF-Connecting-IP': ip } });
      const page = await context.newPage();
      await page.addInitScript(endpoint => {
        const NativeSocket = window.WebSocket;
        window.WebSocket = class extends NativeSocket {
          constructor(url, protocols) { super(endpoint, protocols); }
        };
        window.kickMedia = new Set();
        const play = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function (...args) { kickMedia.add(this); return play.apply(this, args); };
        localStorage.setItem('cosy-village-preferences', JSON.stringify({ weather: 'golden', weatherMode: 'manual' }));
      }, workerUrl);
      const frames = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('websocket', socket => socket.on('framereceived', frame => frames.push(JSON.parse(frame.payload))));
      await page.goto(villageUrl);
      await page.getByRole('button', { name: 'Enter Hearthwillow' }).click({ timeout: 120_000 });
      await page.getByRole('textbox', { name: 'Message', exact: true }).waitFor();
      await page.waitForFunction(() => document.querySelector('.v-shared-chat input')?.disabled === false, null, { timeout: 15_000 });
      const welcome = frames.find(frame => frame.type === 'welcome');
      visitors.push({ page, frames, id: welcome.selfId, name: welcome.visitors.find(visitor => visitor.id === welcome.selfId).name });
    }
    const admin = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    admin.on('pageerror', error => errors.push(error.message));
    await admin.goto(adminUrl);
    await admin.getByText('3 players online.', { exact: true }).waitFor();
    check(await admin.locator('.player-row').count() === 3, 'Console lists all connected players');
    const kick = admin.getByRole('button', { name: `Kick ${visitors[0].name} for 5 minutes`, exact: true });
    await kick.focus();
    const size = await kick.boundingBox();
    check(size.height >= 44, 'Kick has a 44 px keyboard-accessible target');
    await admin.screenshot({ path: `${output}/admin-players.png` });
    await admin.keyboard.press('Enter');
    await visitors[0].page.getByRole('heading', { name: "You've been kicked from this village." }).waitFor();
    await visitors[1].page.getByRole('heading', { name: "You've been kicked from this village." }).waitFor();
    await admin.getByText(/2 players using that IP were disconnected/).waitFor();
    check(await admin.locator('.player-row').count() === 1, 'Keyboard kick removes both sessions using the same IP');
    check(visitors[2].frames.every(frame => frame.type !== 'kicked'), 'Other IP stays connected');
    check(await visitors[2].page.locator('canvas').count() === 1, 'Other visitor keeps the scene');
    const kicked = visitors[0].page;
    check(await kicked.getByText('Log back in later!', { exact: true }).isVisible(), 'Exact return-later copy is visible');
    check(await kicked.locator('canvas, .v-header, .v-arrival, [role="dialog"]').count() === 0, 'Kicked screen replaces scene and controls');
    check(await kicked.evaluate(() => [...kickMedia].every(media => media.paused)), 'Village media playback stops after the kick');
    const lifecycle = await kicked.evaluate(() => ({ engine: window.fixtureEngineDisposed, audio: window.fixtureAudioDisposed }));
    if (lifecycle.engine !== undefined) check(lifecycle.engine && lifecycle.audio, 'Real component cleanup disposes fixture scene and audio');
    check(await kicked.getByRole('heading').evaluate(element => document.activeElement === element), 'Focus moves to the kick heading');
    for (const viewport of [{ width: 1280, height: 720 }, { width: 1366, height: 768 }, { width: 1024, height: 640 }]) {
      await kicked.setViewportSize(viewport);
      const bounds = await kicked.locator('.v-scenery-loading').boundingBox();
      check(bounds.x === 0 && bounds.y === 0 && bounds.width === viewport.width && bounds.height === viewport.height,
        `Kick screen fills ${viewport.width}×${viewport.height}`);
      check(await kicked.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Kick copy stays within the desktop window');
    }
    await kicked.emulateMedia({ reducedMotion: 'reduce' });
    check(await kicked.locator('.v-scenery-loading').evaluate(element => getComputedStyle(element).animationName === 'none'), 'Reduced-motion kick screen is still');
    await kicked.screenshot({ path: `${output}/kicked-screen.png` });
    await kicked.emulateMedia({ reducedMotion: 'no-preference' });
    await kicked.reload();
    await kicked.getByRole('button', { name: 'Enter Hearthwillow' }).click({ timeout: 120_000 });
    await kicked.getByRole('heading', { name: "You've been kicked from this village." }).waitFor();
    check(await kicked.locator('canvas').count() === 0, 'Reloading during cooldown still replaces the scene');
    await admin.getByRole('button', { name: 'Refresh', exact: true }).first().click();
    check(await admin.locator('.player-row').count() === 1, 'Refused re-entry never appears online');
    fs.writeFileSync(`${output}/checks.json`, JSON.stringify({ checks, errors, lifecycle }, null, 2));
    check(errors.length === 0, `No captured browser errors: ${errors.join('; ')}`);
    console.log(`${checks.length} local browser kick checks passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

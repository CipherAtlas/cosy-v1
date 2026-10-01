// Rendered local QA only: start write-cleanup-runtime.cjs with SERVE_LOCAL_FIXTURE=1 first.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const output = process.env.OUTPUT_DIR || '/tmp/cosy-write-browser';
const exportRoot = path.resolve(process.env.EXPORT_DIR || 'out');
const archiveRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cosy-synthetic-admin-'));
const archivePath = path.join(archiveRoot, 'chat.sqlite3');
const checks = [], errors = [], polls = [];
const check = (ok, label) => { assert(ok, label); checks.push(label); console.log(label); };
fs.mkdirSync(output, { recursive: true });
const control = async route => { const response = await fetch(`http://127.0.0.1:2568/${route}`); assert.equal(response.status, 200); return response.json(); };
const admin = spawn('python3', ['-u', '-c', `
import sys
from pathlib import Path
sys.path.insert(0, str(Path.cwd() / 'tools/village-admin'))
from server import AdminServer
server=AdminServer(('127.0.0.1',3053),'http://127.0.0.1:2567','synthetic-local-only-admin-token-0000000000000000',Path(sys.argv[1]))
server.start_archiving()
try: server.serve_forever()
finally: server.server_close()
`, archivePath], { stdio: ['ignore', 'pipe', 'pipe'] });
let adminError = ''; admin.stderr.on('data', data => adminError += data);
let browser;
(async () => {
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch('http://127.0.0.1:3053/api/session')).ok) break; } catch {}
    assert(attempt < 100 && admin.exitCode === null, `Synthetic admin startup failed: ${adminError}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--disable-features=LocalNetworkAccessChecks'] });
  const pages = [];
  for (let i = 0; i < 2; i++) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } }); pages.push(page);
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http://127.0.0.1:3051/**', route => {
      const relative = decodeURIComponent(new URL(route.request().url()).pathname);
      const file = path.resolve(exportRoot, `.${relative.endsWith('/') ? `${relative}index.html` : relative}`);
      if (!file.startsWith(exportRoot + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary' };
      return route.fulfill({ path: file, contentType: types[path.extname(file)] || 'application/octet-stream' });
    });
    await page.addInitScript(() => {
      localStorage.setItem('cosy-village-preferences', JSON.stringify({ weather: 'golden', weatherMode: 'manual' }));
      window.testSockets = []; window.testEvents = [];
      const Native = WebSocket;
      window.WebSocket = class extends Native { constructor(...args) { super(...args); testSockets.push(this); this.addEventListener('message', event => testEvents.push(JSON.parse(event.data))); } };
    });
    await page.goto('http://127.0.0.1:3051');
    await page.getByRole('button', { name: 'Enter Hearthwillow', exact: true }).click({ timeout: 120000 });
    await page.waitForFunction(() => {
      for (let el = document.querySelector('canvas'); el; el = el.parentElement)
        for (let fiber = el[Object.keys(el).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return)
          for (let hook = fiber.memoizedState; hook; hook = hook.next) {
            const ref = hook.memoizedState?.current;
            if (ref?.setSharedActors && ref.sharedActors && ref.puppies) window.testEngine = ref;
            if (ref?.interact && ref.sendChat) window.testConnection = ref;
          }
      return !!window.testConnection && !!window.testEngine && testEngine.sharedConnected;
    }, null, { timeout: 120000 });
    await page.evaluate(() => testEngine.setQuality('low'));
  }
  const [a, b] = pages;
  const send = async (page, text) => {
    if (!await page.getByRole('textbox', { name: 'Message', exact: true }).isVisible()) await page.getByRole('button', { name: /Open Hearthwillow chat/ }).click();
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill(text);
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
  };
  const openAdmin = async () => {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/chat') polls.push(Date.now()); });
    await page.goto('http://127.0.0.1:3053');
    await page.locator('#connection').filter({ hasText: 'Connected' }).waitFor(); return page;
  };
  let consolePage = await openAdmin();
  const first = 'Synthetic browser capture A';
  await send(a, first); await b.locator('.v-shared-chat-log').getByText(first, { exact: false }).waitFor();
  check(true, 'Real chat composer broadcasts to a second rendered client');
  await consolePage.locator('#messages').getByText(first, { exact: true }).waitFor({ timeout: 12000 });
  await consolePage.locator('#archive-results').getByText(first, { exact: true }).waitFor({ timeout: 12000 });
  check(true, 'The actual console displays live chat and the captured archive');
  check(await consolePage.locator('#players .player-row').count() === 2, 'The actual console lists both synthetic players');
  const before = await control('stats'), startPoll = polls.length;
  await consolePage.waitForTimeout(11000);
  const intervals = polls.slice(startPoll).map((at, i, values) => i ? at - values[i - 1] : 0).filter(Boolean);
  check(intervals.some(ms => ms > 4500 && ms < 5500), 'The console page retains its actual five-second polling cadence');
  const after = await control('stats');
  check(after.counts.alarm === before.counts.alarm && after.counts.chat === before.counts.chat, 'Unchanged page and background polls add no alarm/chat writes');
  check(after.counts.sharedActors > before.counts.sharedActors, 'Active browser heartbeats keep writing authoritative sharedActors snapshots');
  const archive = await consolePage.evaluate(() => fetch('/api/archive').then(response => response.json()));
  check(archive.items.filter(item => item.message === 'Synthetic browser capture A').length === 1, 'Repeated capture keeps exactly one archive row per message');
  await consolePage.screenshot({ path: path.join(output, 'admin.png') });
  await consolePage.locator('.live-message').filter({ hasText: first }).getByRole('button', { name: /Remove message/ }).click();
  await consolePage.locator('#messages').getByText(first, { exact: true }).waitFor({ state: 'hidden' });
  await b.locator('.v-shared-chat-log').getByText(first, { exact: false }).waitFor({ state: 'hidden' });
  check(true, 'Removing a synthetic message synchronizes both live UIs');
  await consolePage.locator('#archive-search').fill('capture A');
  await consolePage.locator('#archive-results').getByText(first, { exact: true }).waitFor();
  check(true, 'A removed message remains searchable in the private archive');
  await consolePage.close();
  const second = 'Synthetic background capture B';
  await send(b, second); await a.locator('.v-shared-chat-log').getByText(second, { exact: false }).waitFor();
  await a.waitForTimeout(6500);
  consolePage = await openAdmin();
  const background = await consolePage.evaluate(() => fetch('/api/archive').then(response => response.json()));
  const openedAt = await consolePage.evaluate(() => performance.timeOrigin);
  check(background.items.some(item => item.message === 'Synthetic background capture B' && item.firstSeenAt * 1000 < openedAt), 'Five-second background capture saves chat while the console page is closed');
  const dogId = await a.evaluate(() => testEngine.sharedActors.actors.find(actor => actor.kind === 'puppy').id);
  await a.evaluate(id => { const actor = testEngine.sharedActors.actors.find(actor => actor.id === id); testEngine.movement.settle(actor.x + 1, actor.z + 1); testEngine.player.position.copy(testEngine.movement.position); }, dogId);
  await a.waitForFunction(id => testEngine.nearPuppy?.id === id, dogId);
  await a.locator('canvas').focus(); await a.keyboard.press('t');
  await a.waitForFunction(id => testEngine.sharedActors.actors.find(actor => actor.id === id)?.owner === testEngine.sharedSelfId, dogId);
  const oldIds = await Promise.all(pages.map(page => page.evaluate(() => testEngine.sharedSelfId)));
  await control('hibernate');
  await b.evaluate(() => testSockets.at(-1).send(JSON.stringify({ type: 'heartbeat', active: true })));
  await b.waitForFunction(({ id, owner }) => testEngine.sharedActors.actors.find(actor => actor.id === id)?.owner === owner, { id: dogId, owner: oldIds[0] });
  check((await a.evaluate(() => testEngine.sharedSelfId)) === oldIds[0] && (await b.evaluate(() => testEngine.sharedSelfId)) === oldIds[1], 'Retained-socket hibernation keeps browser identities and active ownership');
  check((await control('stats')).counts.alarm === undefined, 'Hibernation and resumed real polling preserve the persisted alarm without rewriting it');
  await a.screenshot({ path: path.join(output, 'recovery.png') });
  await control('restart');
  for (let i = 0; i < pages.length; i++) await pages[i].waitForFunction(id => testEngine.sharedConnected && testEngine.sharedSelfId !== id, oldIds[i], { timeout: 20000 });
  check(true, 'A full local runtime restart reconnects both rendered browsers');
  await a.locator('.v-shared-chat-log').getByText(second, { exact: false }).waitFor();
  check(true, 'Acknowledged chat is restored in the UI after full runtime restart');
  await a.waitForFunction(ids => testEngine.sharedActors.actors.every(actor => !ids.includes(actor.owner)), oldIds);
  check(true, 'Recovery releases abandoned ownership instead of assigning it to reconnecting identities');
  const seeded = await control('previous-hour'); await control('arm-alarm');
  await a.locator('.v-shared-chat-log').getByText(second, { exact: false }).waitFor({ state: 'hidden', timeout: 8000 });
  await consolePage.locator('#refresh').click();
  await consolePage.locator('#status').filter({ hasText: 'No messages this hour' }).waitFor();
  check(true, 'A real local alarm clears seeded previous-hour chat in both browser and console');
  const stale = await consolePage.evaluate(async hour => { const session = await fetch('/api/session').then(response => response.json()); return (await fetch('/api/clear', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Session': session.csrfToken }, body: JSON.stringify({ chatHour: hour }) })).status; }, seeded.hour);
  check(stale === 409, 'The actual console proxy refuses a stale-hour clear after rollover');
  const retained = await consolePage.evaluate(() => fetch('/api/archive').then(response => response.json()));
  check(retained.items.some(item => item.message === first) && retained.items.some(item => item.message === second), 'Rollover retains both captured messages in the seven-day archive');
  check(fs.statSync(archiveRoot).mode % 512 === 448 && fs.statSync(archivePath).mode % 512 === 384, 'Synthetic archive retains private 0700 directory and 0600 file permissions');
  check(errors.length === 0, 'No captured browser page errors during console, hibernation, restart and rollover');
  fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ checks, errors, pollIntervalsMs: intervals, syntheticDataOnly: true }, null, 2) + '\n');
})().catch(error => { fs.writeFileSync(path.join(output, 'failed-checks.json'), JSON.stringify({ checks, errors }, null, 2)); console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close(); admin.kill('SIGTERM');
  await new Promise(resolve => admin.exitCode === null ? admin.once('exit', resolve) : resolve());
  fs.rmSync(archiveRoot, { recursive: true, force: true });
});

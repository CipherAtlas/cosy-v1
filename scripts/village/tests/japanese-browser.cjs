// Real exported clients: language persistence, Japanese composition, chat delivery and laptop layout.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
assert(process.env.EXPORT_DIR, 'Set EXPORT_DIR to a freshly checked local export');
const root = path.resolve(process.env.EXPORT_DIR);
const output = process.env.OUTPUT_DIR || '/tmp/cosy-japanese-browser';
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-features=LocalNetworkAccessChecks'] });
  const checks = [], errors = [];
  const check = (ok, name) => { assert(ok, name); checks.push(name); console.log(name); };
  async function visit(locale, language) {
    const context = await browser.newContext({ locale, viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http://127.0.0.1:3051/**', route => {
      const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
      const file = path.resolve(root, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404 });
      const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
      return route.fulfill({ path: file, contentType: mime[path.extname(file)] || 'application/octet-stream' });
    });
    await page.addInitScript(language => {
      if (!localStorage.getItem('cosy-village-preferences')) localStorage.setItem('cosy-village-preferences', JSON.stringify({ language, quality: 'low', weather: 'golden', weatherMode: 'manual' }));
      window.chatSent = [];
      const send = WebSocket.prototype.send;
      WebSocket.prototype.send = function (data) { const payload = JSON.parse(data); if (payload.type === 'chat') window.chatSent.push(payload.message); return send.call(this, data); };
    }, language);
    await page.goto('http://127.0.0.1:3051');
    return page;
  }
  async function enter(page, japanese) {
    await page.getByRole('button', { name: japanese ? 'ハースウィローに入る' : 'Enter Hearthwillow', exact: true }).click({ timeout: 120000 });
    await page.locator('.v-shared-chat input:not([disabled])').waitFor({ timeout: 30000 });
    await page.waitForFunction(() => {
      for (let el = document.querySelector('canvas'); el; el = el.parentElement)
        for (let fiber = el[Object.keys(el).find(k => k.startsWith('__reactFiber'))]; fiber; fiber = fiber.return)
          for (const branch of [fiber, fiber.alternate]) for (let hook = branch?.memoizedState; hook; hook = hook.next) {
            const ref = hook.memoizedState?.current;
            if (ref?.setSharedActors && ref?.setLanguage) window.e = ref;
          }
      return window.e?.sharedConnected;
    });
  }
  async function language(page, value) {
    await page.locator('canvas').focus(); await page.keyboard.press(',');
    await page.locator('.v-settings-fields select').last().selectOption(value);
    await page.getByRole('button', { name: value === 'ja' ? '閉じる' : 'Close', exact: true }).click();
  }
  try {
    const a = await visit('ja-JP');
    await a.getByRole('button', { name: 'ハースウィローに入る', exact: true }).waitFor({ timeout: 120000 });
    await a.locator('[data-start-panel="language"]').click();
    check(await a.getByRole('button', { name: '日本語', exact: true }).getAttribute('aria-pressed') === 'true', 'Fresh Japanese browser starts in Japanese with a title-screen language menu');
    await a.keyboard.press('Escape');
    await enter(a, true);
    const b = await visit('ja-JP', 'en'); await enter(b, false);
    check(await b.locator('html').getAttribute('lang') === 'en', 'Explicit English wins over Japanese browser locale');
    check((await a.locator('.v-shared-chat').innerText()).includes('毎時消去') && (await a.locator('.v-shared-people').innerText()).includes('あなた'), 'Chat room information and self label are Japanese');
    const message = `日本語の確認 ${Date.now()}。今日は村でゆっくり過ごそう。ありがとう！`;
    const input = a.getByLabel('メッセージ', { exact: true });
    await input.fill(message);
    await input.dispatchEvent('compositionstart', { data: 'にほんご' });
    await a.keyboard.press('Enter');
    await a.keyboard.press('Escape');
    await a.locator('.v-shared-chat form').evaluate(form => form.requestSubmit());
    check(await input.inputValue() === message && await a.evaluate(() => chatSent.length === 0) && await a.locator('.v-shared-chat').isVisible(), 'IME Enter, Escape and form submission preserve the draft and open chat');
    await input.dispatchEvent('compositionend', { data: '日本語' });
    const nativePrevented = await input.evaluate(element => !element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true })));
    check(nativePrevented && await a.evaluate(() => chatSent.length === 0), 'Native composition flag prevents implicit form submission');
    const prevented = await input.evaluate(element => !element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true, cancelable: true })));
    check(prevented && await a.evaluate(() => chatSent.length === 0), 'Safari-style composition Enter (229) does not submit');
    await a.keyboard.press('Enter');
    await b.locator('.v-shared-chat-log').getByText(message, { exact: true }).waitFor();
    check(await a.evaluate(() => chatSent.length === 1) && await input.inputValue() === '', 'Confirmed Japanese message sends once and clears the accepted draft');
    check(await b.locator('.v-shared-chat h2').innerText() === 'Hearthwillow chat', 'English recipient sees the original Japanese message with English controls');
    check(/秒で送信/.test(await a.locator('.v-shared-chat button[type=submit]').getAttribute('aria-label')), 'Send cooldown announces Japanese seconds');
    for (const size of [[1366, 768], [1280, 800], [1024, 720], [900, 640]]) {
      await a.setViewportSize({ width: size[0], height: size[1] });
      const geometry = await a.locator('.v-shared-chat').evaluate(panel => {
        const r = panel.getBoundingClientRect();
        const log = panel.querySelector('.v-shared-chat-log');
        return { left: r.left, right: r.right, bottom: r.bottom, logWidth: log.clientWidth, contentWidth: log.scrollWidth, font: getComputedStyle(log.querySelector('p')).fontFamily };
      });
      check(geometry.left >= 0 && geometry.right <= size[0] && geometry.bottom <= size[1] && geometry.contentWidth <= geometry.logWidth && geometry.font.includes('Hiragino'), `${size.join('×')}: Japanese chat stays within the laptop window without horizontal overflow`);
      await a.screenshot({ path: path.join(output, `chat-${size.join('x')}.png`) });
    }
    await input.fill('入力途中');
    await input.dispatchEvent('compositionstart', { data: 'にゅうりょく' });
    await a.getByRole('button', { name: '村のチャットを閉じる', exact: true }).click();
    await a.getByRole('button', { name: '村のチャットを開く', exact: true }).click();
    await a.getByLabel('メッセージ', { exact: true }).fill('再びこんにちは');
    await a.waitForFunction(() => !document.querySelector('.v-shared-chat button[type=submit]').disabled);
    await a.keyboard.press('Enter');
    await b.locator('.v-shared-chat-log').getByText('再びこんにちは', { exact: true }).waitFor();
    check(await a.evaluate(() => chatSent.length === 2), 'Closing chat during composition cannot leave the reopened composer stuck');
    await a.locator('canvas').focus(); await a.keyboard.press('i');
    check((await a.locator('.v-local-inventory').innerText()).includes('ミントティー') && !(await a.locator('.v-local-inventory').innerText()).includes('Apples'), 'Harvest basket translates every item');
    await a.getByRole('button', { name: '閉じる', exact: true }).click();
    await language(a, 'en');
    check(await a.locator('.v-shared-chat h2').innerText() === 'Hearthwillow chat' && await a.evaluate(() => e.language === 'en'), 'Language changes update chat and the live dialogue engine');
    await language(a, 'ja');
    await a.reload();
    await a.getByRole('button', { name: 'ハースウィローに入る', exact: true }).waitFor({ timeout: 120000 });
    await a.locator('[data-start-panel="language"]').click();
    check(await a.getByRole('button', { name: '日本語', exact: true }).getAttribute('aria-pressed') === 'true', 'Japanese selection survives reloading');
    check(errors.length === 0, `No page errors (${errors.join('; ')})`);
    fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ checks, errors }, null, 2));
    console.log(`${checks.length} actual two-client Japanese browser checks passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

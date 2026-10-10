// Current React UI against an isolated local preview and Worker; never send audit chat to production.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const villageUrl = process.env.VILLAGE_URL || 'http://127.0.0.1:3051';
const workerUrl = process.env.WORKER_URL || 'ws://127.0.0.1:2577';
for (const url of [villageUrl, workerUrl]) assert.equal(new URL(url).hostname, '127.0.0.1', 'Quiet UI checks must use loopback servers');
const output = process.env.OUTPUT_DIR || '/tmp/cosy-quiet-ui';
fs.mkdirSync(output, { recursive: true });
const checks = [], errors = [];
const focused = process.env.FOCUSED === '1';
const chatOnly = process.env.CHAT_ONLY === '1';
const geometry = [];
const check = (ok, label) => { assert(ok, label); checks.push(label); console.log(label); };
const viewports = [[1280,800], [900,640], [810,1080], [1080,810], [820,1180], [1180,820], [744,1133], [1133,744]];
const resize = async (page, width, height) => {
  await page.setViewportSize({ width, height });
  // The canvas ResizeObserver updates the containing block on the next paint.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
};
const checkChatLayouts = async (page, label, prefix) => {
  for (const [width, height] of viewports) {
    await resize(page, width, height);
    const measured = await page.locator('.v-shared-toggle').evaluate(button => {
      const rect = button.getBoundingClientRect(), label = button.querySelector('.v-shared-chat-label'), status = button.querySelector('.v-shared-status');
      const dot = button.querySelector('.v-shared-unread')?.getBoundingClientRect();
      return { label: label.textContent, status: status.textContent, height: rect.height,
        bounds: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
        noClipping: button.scrollWidth <= button.clientWidth && label.getBoundingClientRect().right < status.getBoundingClientRect().left,
        dotInside: dot && dot.left >= rect.left && dot.right <= rect.right && dot.top >= rect.top && dot.bottom <= rect.bottom };
    });
    check(measured.label === label && measured.bounds && measured.noClipping && measured.height >= 44 && measured.dotInside,
      `${width}×${height}: ${label} entry, secondary presence and unread dot are readable with a 44 px target`);
    await page.screenshot({ path: path.join(output, `${prefix}-${width}x${height}.png`) });
    if (width === 1280) await page.locator('.v-shared-toggle').screenshot({ path: path.join(output, `${prefix}-control.png`) });
  }
  await resize(page, 1280, 800);
};
const checkChatScrolling = async (page, sender) => {
  await page.evaluate(() => {
    const socket = quietSockets.at(-1), hour = Math.floor(Date.now() / 3_600_000);
    window.scrollChatFixture = (type, extra) => socket.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type, chatHour: hour, ...extra }) }));
    window.scrollChatEntries = Array.from({ length: 80 }, (_, index) => ({ id: 'synthetic-scroll-visitor', messageId: `scroll-${index}`, name: 'Scroll visitor', message: `Message ${index}: ${'Long chat text '.repeat(index % 4 + 1)}`, sentAt: Date.now() + index }));
    scrollChatFixture('chat_sync', { chat: scrollChatEntries, removedMessageIds: [] });
  });
  const log = page.locator('.v-shared-chat-log');
  const atBottom = async label => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForFunction(() => {
      const log = document.querySelector('.v-shared-chat-log');
      return log && log.scrollHeight > log.clientHeight && Math.abs(log.scrollHeight - log.clientHeight - log.scrollTop) <= 1;
    }, null, { timeout: 5000 });
    check(true, label);
  };
  await atBottom('Long history opens at the newest message');
  await page.locator('.v-shared-chat').evaluate(panel => panel.style.height = '330px');
  await atBottom('Shrinking the chat panel keeps the newest message visible');
  await log.evaluate(log => log.scrollTop -= 100);
  await page.getByLabel('Message', { exact: true }).focus();
  await atBottom('Focusing the composer returns displaced history to the newest message');
  await log.evaluate(log => log.scrollTop -= 100);
  await page.getByLabel('Message', { exact: true }).pressSequentially('typing');
  await atBottom('Typing restores the newest message while the composer is already focused');
  await sender.getByLabel('Message', { exact: true }).fill('Remote message during typing');
  await sender.getByRole('button', { name: 'Send message', exact: true }).click();
  await log.getByText('Remote message during typing', { exact: true }).waitFor();
  await atBottom('A real remote message stays visible while a draft is being typed');
  check(await page.getByLabel('Message', { exact: true }).inputValue() === 'typing', 'Incoming messages preserve the current draft');
  await page.locator('.v-shared-chat-log p').evaluateAll(rows => rows.forEach(row => row.style.fontSize = '17px'));
  await atBottom('Late message-content reflow keeps the newest message visible');
  for (const [width, height] of [[1366,768], ...viewports]) {
    await resize(page, width, height);
    await page.locator('.v-shared-chat').evaluate(panel => panel.style.width = '290px');
    await atBottom(`${width}×${height}: wrapping and viewport changes keep chat at the bottom`);
  }
  await page.evaluate(() => {
    window.scrollRetainedRow = [...document.querySelectorAll('.v-shared-chat-log p')].find(row => row.textContent.includes('Message 79:'));
    scrollChatFixture('chat', { entry: { ...scrollChatEntries[79], messageId: 'scroll-80', message: 'Newest rolling message' } });
  });
  await atBottom('The eighty-message rolling history follows new messages');
  check(await page.evaluate(() => [...document.querySelectorAll('.v-shared-chat-log p')].find(row => row.textContent.includes('Message 79:')) === scrollRetainedRow),
    'Retained message rows keep their identity when old history is pruned');
  await log.evaluate(log => log.scrollTop = 0);
  await page.getByLabel('Message', { exact: true }).evaluate(input => input.blur());
  await atBottom('Chat returns to the bottom while idle with the composer unfocused');
  check(await page.getByLabel('Message', { exact: true }).evaluate(input => document.activeElement !== input), 'Idle scrolling recovery does not focus the composer');
  await log.hover();
  await page.mouse.wheel(0, -400);
  await atBottom('Wheel scrolling always returns to the newest message without typing');
  await page.waitForTimeout(300);
  await atBottom('Chat remains at the bottom after wheel scrolling settles');
  await page.getByRole('button', { name: 'Close Hearthwillow chat', exact: true }).click();
  await page.getByRole('button', { name: 'Open Hearthwillow chat', exact: true }).click();
  await atBottom('Reopening chat follows the newest message');
  await page.evaluate(() => scrollChatFixture('hour', {}));
  await page.getByText('No messages yet.', { exact: true }).waitFor();
  check(await log.evaluate(log => log.scrollTop === 0), 'Hourly clearing resets the empty chat position');
  await page.getByLabel('Message', { exact: true }).fill('');
  await page.locator('.v-shared-chat').evaluate(panel => { panel.style.width = ''; panel.style.height = ''; });
  await resize(page, 1280, 800);
};
const engine = async page => page.waitForFunction(() => {
  for (let element = document.querySelector('canvas'); element; element = element.parentElement)
    for (let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return)
      for (const branch of [fiber, fiber.alternate]) for (let hook = branch?.memoizedState; hook; hook = hook.next) {
        const ref = hook.memoizedState?.current;
        if (ref?.setSharedActors && ref?.setQuality) window.quietEngine = ref;
      }
  return window.quietEngine?.sharedConnected;
}, null, { timeout: 120000 });
const enter = async page => {
  await page.getByRole('button', { name: 'Enter Hearthwillow', exact: true }).click({ timeout: 120000 });
  const guide = page.locator('[data-tutorial-done]');
  if (await guide.count()) await guide.click();
  await engine(page);
};
const travel = async (page, name) => {
  await page.getByRole('button', { name: 'Expand village map', exact: true }).click();
  await page.getByRole('button', { name, exact: true }).click();
  await page.locator('#v-activity-panel .v-activity').waitFor();
};
const leave = async page => {
  await page.getByRole('button', { name: 'Leave activity', exact: true }).click();
  await page.waitForFunction(() => quietEngine.currentPlace === null);
  await page.waitForTimeout(100); // The Worker enforces an 80 ms action cooldown.
};
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--disable-features=LocalNetworkAccessChecks'] });
  try {
    const receiverContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true, reducedMotion: 'reduce' });
    const senderContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    for (const context of [receiverContext, senderContext]) await context.addInitScript(endpoint => {
      localStorage.setItem('cosy-village-preferences', JSON.stringify({ weather: 'golden', weatherMode: 'manual', quality: 'low', dontShowTutorial: true, language: 'en' }));
      const Native = WebSocket;
      window.quietSockets = [];
      window.WebSocket = class extends Native { constructor(url, protocols) { super(endpoint, protocols); quietSockets.push(this); } };
    }, workerUrl);
    const receiver = await receiverContext.newPage(), sender = await senderContext.newPage();
    for (const page of [receiver, sender]) {
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(villageUrl); await enter(page);
      check(await page.locator('.v-shared-chat').count() === 0, 'Fresh visitor starts with collapsed chat and a visible entry');
    }
    await sender.getByRole('button', { name: 'Open Hearthwillow chat', exact: true }).click();
    await sender.getByLabel('Message', { exact: true }).fill(`Quiet UI check ${Date.now()}`);
    await sender.getByRole('button', { name: 'Send message', exact: true }).click();
    const unreadToggle = receiver.getByRole('button', { name: 'Open Hearthwillow chat, new message', exact: true });
    await unreadToggle.waitFor();
    check(await receiver.locator('.v-shared-unread').count() === 1 && await receiver.locator('.v-shared-chat-label').innerText() === 'Chat' && await receiver.locator('.v-shared-chat').count() === 0,
      'Real remote chat produces a persistent unread dot beside the explicit Chat label without opening the panel');
    check(await receiver.locator('.v-shared-unread').evaluate(element => getComputedStyle(element).animationName === 'none'), 'Unread indicator stays still');
    if (chatOnly) {
      await checkChatLayouts(receiver, 'Chat', 'chat-en');
      await unreadToggle.focus(); await receiver.keyboard.press('Enter');
    } else await unreadToggle.click();
    check(await receiver.locator('.v-shared-chat-log p').count() > 0 && await receiver.locator('.v-shared-unread').count() === 0, 'Opening chat shows the new message and clears unread');
    if (chatOnly) await checkChatScrolling(receiver, sender);
    await receiver.reload(); await enter(receiver);
    check(await receiver.locator('.v-shared-chat').isVisible(), 'Explicit open chat preference survives reload');
    if (chatOnly) {
      await receiver.getByRole('button', { name: 'Hide Hearthwillow chat', exact: true }).focus();
      await receiver.keyboard.press('Space');
    } else await receiver.getByRole('button', { name: 'Close Hearthwillow chat', exact: true }).click();
    await receiver.reload(); await enter(receiver);
    check(await receiver.locator('.v-shared-chat').count() === 0, 'Explicit collapsed preference survives reload');
    await receiver.evaluate(() => {
      const socket = quietSockets.at(-1), hour = Math.floor(Date.now() / 3_600_000);
      window.quietChatFixture = (type, extra) => socket.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type, chatHour: hour, ...extra }) }));
      window.quietUnreadEntries = [1, 2].map(index => ({ id: 'synthetic-remote', messageId: `synthetic-unread-${index}`, name: 'Synthetic visitor', message: `Unread fixture ${index}`, sentAt: Date.now() + index }));
      for (const entry of quietUnreadEntries) quietChatFixture('chat', { entry });
    });
    await receiver.getByRole('button', { name: 'Open Hearthwillow chat, new message', exact: true }).waitFor();
    await receiver.evaluate(() => quietChatFixture('chat_sync', { chat: [quietUnreadEntries[1]], removedMessageIds: [quietUnreadEntries[0].messageId] }));
    await receiver.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    check(await receiver.locator('.v-shared-unread').count() === 1, 'Synthetic moderation retains the badge while another unread message remains');
    await receiver.evaluate(() => quietChatFixture('chat_sync', { chat: [{ ...quietUnreadEntries[0], id: quietEngine.sharedSelfId, messageId: 'synthetic-own-message' }], removedMessageIds: [quietUnreadEntries[1].messageId] }));
    await receiver.getByRole('button', { name: 'Open Hearthwillow chat', exact: true }).waitFor();
    check(await receiver.locator('.v-shared-unread').count() === 0, 'Synthetic moderation clears the final unread message even with retained history');
    await receiver.evaluate(() => quietChatFixture('chat', { entry: { ...quietUnreadEntries[0], messageId: 'synthetic-hour-unread' } }));
    await receiver.getByRole('button', { name: 'Open Hearthwillow chat, new message', exact: true }).waitFor();
    await receiver.evaluate(() => quietChatFixture('hour', {}));
    await receiver.getByRole('button', { name: 'Open Hearthwillow chat', exact: true }).waitFor();
    check(await receiver.locator('.v-shared-unread').count() === 0, 'Synthetic hourly reset clears unread without opening chat');
    // Synthetic socket events exercise the actual React/connection path; they do not moderate Worker data.
    if (chatOnly) {
      await receiver.getByRole('button', { name: 'Settings', exact: true }).click();
      await receiver.getByLabel('Language', { exact: true }).selectOption('ja');
      await receiver.getByRole('button', { name: '閉じる', exact: true }).click();
      await sender.bringToFront();
      await sender.getByLabel('Message', { exact: true }).fill(`チャット表示の確認 ${Date.now()}`);
      await sender.waitForFunction(() => !document.querySelector('.v-shared-chat button[type=submit]').disabled).catch(async error => {
        fs.writeFileSync(path.join(output, 'sender-state.json'), JSON.stringify(await sender.evaluate(() => ({
          hidden: document.hidden, connected: quietEngine.sharedConnected,
          control: document.querySelector('.v-shared-toggle').innerText,
          send: document.querySelector('.v-shared-chat button[type=submit]').outerHTML,
        })), null, 2));
        throw error;
      });
      await sender.getByRole('button', { name: 'Send message', exact: true }).click();
      const japaneseToggle = receiver.getByRole('button', { name: '村のチャットを開く。新しいメッセージがあります', exact: true });
      await japaneseToggle.waitFor();
      await checkChatLayouts(receiver, 'チャット', 'chat-ja');
      await japaneseToggle.focus(); await receiver.keyboard.press('Space');
      check(await receiver.locator('.v-shared-chat').isVisible() && await receiver.locator('.v-shared-unread').count() === 0
        && await receiver.locator('.v-shared-toggle').getAttribute('aria-controls') === 'v-shared-chat',
        'Japanese Space activation opens the controlled chat panel and clears the unread dot');
      check(errors.length === 0, `No captured page errors (${errors.join('; ')})`);
      fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ checks, errors }, null, 2));
      return;
    }
    await sender.close();
    await receiver.bringToFront();
    if (!focused) {
    await travel(receiver, 'Willow pond');
    for (const [width, height] of viewports) {
      await resize(receiver, width, height);
      const measured = await receiver.locator('.v-breathe').evaluate(panel => {
        const rect = panel.getBoundingClientRect(), style = getComputedStyle(panel), color = style.backgroundColor.match(/[\d.]+/g);
        const container = panel.closest('#v-activity-panel');
        const controls = [...panel.querySelectorAll('button, select, input')];
        return { viewport: [innerWidth, innerHeight], rect: rect.toJSON(), background: style.backgroundColor, color: style.color,
          panelScroll: [panel.scrollWidth, panel.clientWidth, panel.scrollHeight, panel.clientHeight],
          containerScroll: [container.scrollHeight, container.clientHeight],
          controls: controls.map(control => ({ label: control.innerText, height: control.getBoundingClientRect().height })),
          passes: { bounds: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
            width: rect.width <= 342, transparency: Number(color?.[3]) >= .7 && Number(color?.[3]) < .9,
            green: Number(color?.[1]) > Number(color?.[0]), creamText: style.color === 'rgb(255, 242, 217)',
            horizontal: panel.scrollWidth <= panel.clientWidth + 1, container: container.scrollHeight <= container.clientHeight + 2,
            touchTargets: controls.every(control => control.getBoundingClientRect().height >= 44) } };
      });
      geometry.push(measured);
      fs.writeFileSync(path.join(output, 'panel-geometry.json'), JSON.stringify(geometry, null, 2));
      await receiver.screenshot({ path: path.join(output, `pond-${width}x${height}.png`) });
      if (!Object.values(measured.passes).every(Boolean)) console.error(JSON.stringify(measured, null, 2));
      check(Object.values(measured.passes).every(Boolean), `${width}×${height}: compact green breathing controls fit, remain readable and retain touch targets`);
      for (const control of await receiver.locator('.v-breathe button, .v-breathe select, .v-breathe input').all()) {
        await control.scrollIntoViewIfNeeded();
        check(await control.evaluate(element => {
          const rect = element.getBoundingClientRect(), panel = element.closest('.v-breathe').getBoundingClientRect();
          return rect.top >= panel.top && rect.bottom <= panel.bottom && rect.left >= panel.left && rect.right <= panel.right;
        }), `${width}×${height}: ${await control.innerText()} remains reachable through the activity scroll`);
      }
      await receiver.locator('.v-breathe').evaluate(panel => { panel.scrollTop = 0; });
    }
    await leave(receiver);
    await resize(receiver, 1280, 800);
    for (const name of ['Village hearth', 'Kitchen garden', 'Bird clearing', 'Writing nook', 'Little postbox']) {
      await travel(receiver, name);
      const paper = name === 'Writing nook' || name === 'Little postbox';
      check(await receiver.locator('#v-activity-panel .v-activity').evaluate((panel, paper) => {
        const style = getComputedStyle(panel), rgb = style.backgroundColor.match(/[\d.]+/g);
        return paper ? style.backgroundImage.includes('gradient') && style.color !== 'rgb(255, 242, 217)'
          : style.backgroundImage === 'none' && Number(rgb?.[3]) < .9 && style.color === 'rgb(255, 242, 217)';
      }, paper), `${name}: ${paper ? 'paper treatment is preserved' : 'controls use the translucent green surface'}`);
      if (name === 'Bird clearing') {
        const feed = receiver.locator('.v-bird-activity button');
        check(await receiver.locator('#v-bird-feed-help').innerText() === 'Ask Maple or Wren for crumbs first.'
          && await feed.isDisabled() && await feed.getAttribute('aria-describedby') === 'v-bird-feed-help', 'Missing crumbs give a visible and programmatically associated prerequisite');
      }
      await leave(receiver);
    }
    for (const [width, height] of viewports) {
      await resize(receiver, width, height);
      await receiver.getByRole('button', { name: 'Settings', exact: true }).click();
      for (const section of ['Controls', 'Sound', 'Experience']) {
        await receiver.locator('.v-settings-tabs').getByRole('button', { name: section, exact: true }).click();
        check(await receiver.locator('.v-settings-content').evaluate(element => element.scrollTop === 0), `${width}×${height}: ${section} starts at the top`);
        await receiver.locator('.v-settings-content').evaluate(element => { element.scrollTop = element.scrollHeight; });
      }
      await receiver.keyboard.press('Escape');
    }
    await resize(receiver, 1280, 800);
    await receiver.getByRole('button', { name: 'Expand village map', exact: true }).click();
    await receiver.getByRole('button', { name: 'Meadow Swings', exact: true }).click();
    // Wait for the Worker-approved arrival before approaching; it otherwise overwrites the test pose.
    await receiver.getByRole('dialog').waitFor({ state: 'hidden' });
    await receiver.waitForFunction(() => !quietEngine.blocked && quietEngine.world?.swings?.length > 0);
    await receiver.evaluate(() => {
      const e = quietEngine, swing = e.world.swings[0];
      swing.root.localToWorld(e.temp.set(0, 0, 1.65));
      e.movement.settle(e.temp.x, e.temp.z); e.player.position.copy(e.movement.position);
    });
    try { await receiver.waitForFunction(() => !!quietEngine.nearSwing); }
    catch (error) {
      const state = await receiver.evaluate(() => ({ hidden: document.hidden, blocked: quietEngine.blocked, mapOpen: quietEngine.mapOpen,
        nearSwing: quietEngine.nearSwing, pose: quietEngine.getPlayerPose(), movement: quietEngine.movement.position,
        dialog: !!document.querySelector('[role="dialog"]'), notice: document.querySelector('.v-notice')?.innerText,
        swings: quietEngine.world.swings.map(swing => ({ placement: swing.placement, nearest: swing.nearest(quietEngine.player.position) })) }));
      fs.writeFileSync(path.join(output, 'swing-failure.json'), JSON.stringify(state, null, 2));
      await receiver.screenshot({ path: path.join(output, 'swing-failure.png') });
      console.error(JSON.stringify(state, null, 2)); throw error;
    }
    await receiver.getByRole('button', { name: 'Left swing', exact: true }).click({ timeout: 10000 });
    await receiver.getByRole('button', { name: 'Brake', exact: true }).waitFor();
    for (const [width, height] of viewports) {
      await resize(receiver, width, height);
      check(await receiver.locator('.v-swing-controls kbd').evaluateAll(keys => keys.every(key => {
        const range = document.createRange(); range.selectNodeContents(key);
        const text = range.getBoundingClientRect(), border = key.getBoundingClientRect();
        return text.left >= border.left + 3 && text.right <= border.right - 3
          && (key.dataset.wide === 'true' || Math.abs(border.width - border.height) <= 1);
      })), `${width}×${height}: swing Space/Esc labels fit with padding and single keys remain square`);
    }
    await receiver.screenshot({ path: path.join(output, 'swing-keycaps.png') });
    await receiver.getByRole('button', { name: 'Get off the swing', exact: true }).click();
    await receiver.waitForFunction(() => !quietEngine.ridingSwing);
    }
    await resize(receiver, 1280, 800);
    await receiver.getByRole('button', { name: 'Settings', exact: true }).click();
    await receiver.locator('.v-settings-tabs').getByRole('button', { name: 'Controls', exact: true }).click();
    for (const [name, key] of [['interact / pet / sit', 'Shift'], ['walk with a dog', 'Space']]) {
      const group = name === 'walk with a dog' ? 'Dogs' : 'Interactions';
      await receiver.locator('.v-binding-group').filter({ has: receiver.getByText(group, { exact: true }) }).locator('summary').click();
      await receiver.getByRole('button', { name: `Change key for ${name}`, exact: true }).click();
      await receiver.keyboard.press(key);
      await receiver.getByRole('button', { name: 'Swap keys', exact: true }).click();
    }
    await receiver.waitForFunction(() => quietEngine.keybindings.interact === 'shift' && quietEngine.keybindings.walkDog === ' ');
    await receiver.keyboard.press('Escape');
    const dogId = await receiver.evaluate(() => quietEngine.sharedActors.actors.find(actor => actor.kind === 'puppy' && !actor.owner).id);
    await receiver.evaluate(id => {
      const e = quietEngine, dog = e.sharedActors.actors.find(actor => actor.id === id);
      e.movement.settle(dog.x, dog.z + 1.25); e.player.position.copy(e.movement.position);
    }, dogId);
    await receiver.waitForFunction(id => quietEngine.nearPuppy?.id === id, dogId);
    await receiver.locator('.v-puppy-actions').waitFor();
    await receiver.locator('.v-puppy-tricks-toggle').click();
    await receiver.waitForFunction(id => quietEngine.sharedActors.actors.find(actor => actor.id === id)?.owner === quietEngine.sharedSelfId, dogId);
    const dogGeometry = [];
    for (const [width, height] of viewports.filter(([width, height]) => width !== 900)) {
      await resize(receiver, width, height);
      const measured = await receiver.locator('.v-puppy-main-actions button').evaluateAll(buttons => buttons.map(button => {
        const key = button.querySelector('kbd'), range = document.createRange(); range.selectNodeContents(key);
        const text = range.getBoundingClientRect(), border = key.getBoundingClientRect(), target = button.getBoundingClientRect();
        return { key: key.innerText, border: border.toJSON(), text: text.toJSON(), target: target.toJSON(),
          passes: text.left >= border.left + 3 && text.right <= border.right - 3 && target.height >= 44 && target.left >= 0 && target.right <= innerWidth && target.top >= 0 && target.bottom <= innerHeight };
      }));
      dogGeometry.push({ viewport: [width, height], controls: measured });
      fs.writeFileSync(path.join(output, 'dog-remapped-keycaps.json'), JSON.stringify(dogGeometry, null, 2));
      await receiver.screenshot({ path: path.join(output, `dog-remapped-${width}x${height}.png`) });
      if (!measured.every(control => control.passes)) console.error(JSON.stringify(dogGeometry.at(-1), null, 2));
      check(measured.length === 3 && measured[0].key === 'Shift' && measured[1].key === 'Space' && measured.every(control => control.passes), `${width}×${height}: actual remapped dog Shift/Space labels have padding and contained 44 px targets`);
    }
    check(errors.length === 0, `No captured page errors (${errors.join('; ')})`);
    fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ checks, errors }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

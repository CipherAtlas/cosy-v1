// Two real browser clients against a local static export and the local Worker.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');

(async () => {
  const output = process.env.OUTPUT_DIR || '/tmp/cosy-shared-interactions';
  fs.mkdirSync(output, { recursive: true });
  const checks = [], errors = [], frames = [], check = (ok, label) => { if (!ok) throw Error(label); checks.push(label); };
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const pages = [];
    for (let index = 0; index < 2; index++) {
      const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
      pages.push(page);
      page.on('pageerror', error => errors.push(error.message));
      page.on('websocket', socket => socket.on('framereceived', event => {
        const m = JSON.parse(event.payload);
        if (['welcome','puppy_trick'].includes(m.type)) frames.push({client:index, receivedAt:Date.now(),message:m});
      }));
      await page.addInitScript(() => {
        window.testSockets = [];
        const Native = window.WebSocket;
        window.WebSocket = class extends Native { constructor(...args) { super(...args); window.testSockets.push(this); } };
        localStorage.setItem('cosy-village-preferences', JSON.stringify({ weather: 'golden', weatherMode: 'manual', mix: { enabled: false } }));
      });
      await page.goto(process.env.VILLAGE_URL || 'http://127.0.0.1:3051');
      await page.getByRole('button', { name: 'Enter Hearthwillow' }).click({ timeout: 120000 });
      await page.waitForFunction(() => {
        for (let el = document.querySelector('canvas'); el; el = el.parentElement) {
          for (let fiber = el[Object.keys(el).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return) {
            for (let hook = fiber.memoizedState; hook; hook = hook.next) {
              const engine = hook.memoizedState?.current;
              if (engine?.rideSwing && engine.puppies) { engine.setQuality('low'); window.testEngine = engine; return true; }
            }
          }
        }
      }, null, { timeout: 120000 });
    }
    const [rider, observer] = pages;
    await observer.waitForFunction(() => testEngine.remoteVisitors.size === 1);
    check(await rider.evaluate(() => testEngine.remoteVisitors.size === 1), 'Both visitors join the same local Worker');
    await rider.evaluate(() => {
      const e = testEngine, s = e.world.swings[0];
      s.root.localToWorld(e.temp.set(-.98, 0, 1.65)); e.movement.settle(e.temp.x, e.temp.z);
    });
    await rider.getByRole('button', { name: 'Left swing', exact: true }).click();
    await rider.keyboard.down('w');
    await observer.waitForFunction(() => [...testEngine.remoteVisitors.values()].some(remote => Math.abs(remote.swing?.angle ?? 0) > .1));
    await observer.evaluate(() => {
      const e = testEngine, s = e.world.swings[0];
      s.root.localToWorld(e.temp.set(0, 0, 1.65)); e.movement.settle(e.temp.x, e.temp.z);
      e.yaw = s.placement.yaw; e.pitch = .35;
    });
    const samples = [];
    for (let sample = 0; sample < 12; sample++) {
      samples.push(await observer.evaluate(() => {
        const e = testEngine, remote = [...e.remoteVisitors.values()][0], ride = remote.swing;
        const s = e.world.swings.find(s => s.placement.id === ride?.id);
        const seat = s.seatPoint(ride.index, e.temp).clone(); seat.y -= .62;
        return { gap: remote.group.position.distanceTo(seat), angle: s.pendulums[ride.index].angle, height: remote.group.position.y };
      }));
      await observer.waitForTimeout(100);
    }
    check(samples.every(sample => sample.gap < .001), 'Observer sees the visitor attached to the moving seat in all samples');
    check(Math.max(...samples.map(s => s.height)) - Math.min(...samples.map(s => s.height)) > .03, 'Remote rider follows the vertical arc');
    check(await observer.getByRole('button', { name: 'Left swing', exact: true }).isDisabled(), 'Occupied seat is visibly disabled for another visitor');
    await observer.screenshot({ path: output + '/shared-swing.png' });
    await rider.keyboard.up('w');
    await rider.getByRole('button', { name: 'Get off', exact: true }).click();
    await observer.waitForFunction(() => [...testEngine.remoteVisitors.values()].every(remote => !remote.swing));
    check(await observer.getByRole('button', { name: 'Left swing', exact: true }).isEnabled(), 'Getting off releases the shared seat');
    const dogId = await rider.evaluate(() => {
      const e = testEngine, dog = e.puppies.puppies[0];
      e.movement.settle(dog.actor.position.x, dog.actor.position.z + 1.5);
      return dog.info.id;
    });
    await rider.locator('.v-puppy-actions').waitFor();
    const approach = await rider.evaluate(() => testEngine.getPlayerPose());
    await observer.waitForFunction(({x,z}) => [...testEngine.remoteVisitors.values()].some(remote =>
      Math.hypot(remote.target.x-x,remote.target.z-z)<.05), approach);
    await rider.getByRole('button', { name: 'Tricks', exact: true }).click();
    const initial = await rider.evaluate(id => testEngine.puppies.puppies.find(p => p.info.id === id).actor.position.toArray(), dogId);
    await rider.getByRole('button', { name: 'Dance', exact: true }).click();
    await observer.waitForFunction(id => testEngine.puppies.puppies.find(p => p.info.id === id)?.command === 'dance', dogId);
    check(await rider.locator('#v-puppy-tricks').isVisible(), 'Clicking Dance keeps the trick menu open');
    const sharedDog = await observer.evaluate(id => {
      const p = testEngine.puppies.puppies.find(p => p.info.id === id);
      return { position: p.actor.position.toArray(), age: p.commandAge, clip: p.animation.actions.dance.time };
    }, dogId);
    check(Math.hypot(initial[0] - sharedDog.position[0], initial[2] - sharedDog.position[2]) < .001, 'Shared dog dances at the requesting visitor’s dog position');
    await observer.evaluate(id => {
      const e = testEngine, dog = e.puppies.puppies.find(p => p.info.id === id);
      e.movement.settle(dog.actor.position.x, dog.actor.position.z + 1.8); e.yaw = 0; e.pitch = .35;
    }, dogId);
    await observer.waitForTimeout(300);
    await observer.screenshot({ path: output + '/shared-dog-dance.png' });
    await rider.getByRole('button', { name: 'Sit', exact: true }).focus();
    await rider.keyboard.press('z');
    await observer.waitForFunction(id => testEngine.puppies.puppies.find(p => p.info.id === id)?.command === 'sit', dogId);
    check(await rider.locator('#v-puppy-tricks').isVisible(), 'Focused keyboard trick keeps the menu open');
    await observer.evaluate(() => testSockets.at(-1).close(1000));
    await observer.waitForFunction(() => testSockets.length > 1 && testSockets.at(-1).readyState === 1);
    await observer.waitForFunction(id => {
      const p = testEngine.puppies.puppies.find(p => p.info.id === id);
      return p.command === 'sit' && p.commandAge > .8;
    }, dogId);
    check(await observer.evaluate(id => {
      const p = testEngine.puppies.puppies.find(p => p.info.id === id);
      return Math.abs(p.commandAge - p.animation.actions.sit.time) < .05;
    }, dogId), 'Reconnect resumes the active trick at its current clip time');
    for (const [command, label] of [['spin','Spin'],['bow','Bow'],['wave','Wave'],['roll','Roll over']]) {
      await rider.getByRole('button', { name: label, exact: true }).click();
      await observer.waitForFunction(({id,command}) => {
        const p = testEngine.puppies.puppies.find(p => p.info.id === id);
        return p.command === command && p.animation.actions[command].time > .1
          && p.animation.actions[command].getEffectiveWeight() > .3;
      }, {id:dogId,command});
      check(await rider.locator('#v-puppy-tricks').isVisible(), `${label} animates on the other client and keeps the menu open`);
    }
    await rider.waitForFunction(id => !testEngine.puppies.puppies.find(p => p.info.id === id).command, dogId, { timeout: 12000 });
    await rider.waitForTimeout(1800);
    const final = await rider.evaluate(id => testEngine.puppies.puppies.find(p => p.info.id === id).actor.position.toArray(), dogId);
    check(Math.hypot(initial[0] - final[0], initial[2] - final[2]) < .001, 'Dog stays beside the open controls after its trick finishes');
    check(await rider.locator('#v-puppy-tricks').isVisible(), 'Completed tricks keep the list open');
    for (const [width, height] of [[1280,720],[1366,768],[1440,900],[1024,640],[844,390]]) {
      await rider.setViewportSize({ width, height });
      const panel = rider.locator('.v-puppy-actions');
      await panel.scrollIntoViewIfNeeded();
      const rect = await panel.boundingBox();
      check(rect.x >= 0 && rect.x + rect.width <= width && rect.width <= 320 && rect.y >= 0,
        `${width}×${height} panel fits the desktop window`);
      const metrics = await panel.evaluate(el => ({ alpha: +getComputedStyle(el).backgroundColor.match(/[\d.]+/g)[3],
        buttons: [...el.querySelectorAll('button')].map(b => ({ height: b.getBoundingClientRect().height, overflow: b.scrollWidth > b.clientWidth + 1,
          key: !!b.querySelector('kbd') && getComputedStyle(b.querySelector('kbd')).display !== 'none' })) }));
      check(metrics.alpha < .8 && metrics.buttons.every(b => b.height >= 44 && !b.overflow && b.key),
        `${width}×${height} translucent panel has readable keycaps and 44 px buttons without overflow`);
      if (width === 1366) {
        await rider.screenshot({ path: output + '/dog-panel-open.png' });
        await panel.screenshot({ path: output + '/dog-panel-detail.png' });
      }
    }
    await rider.keyboard.press('Escape');
    check(await rider.locator('#v-puppy-tricks').isHidden(), 'Escape closes the list explicitly');
    await rider.waitForFunction(() => testEngine.puppies.interactionId === null);
    check(true, 'Closing Tricks releases patrol and follow movement');
    await rider.evaluate(() => {
      const e = testEngine, s = e.world.swings[0];
      s.root.localToWorld(e.temp.set(0,0,3.3)); e.movement.settle(e.temp.x,e.temp.z);
    });
    await rider.locator('.v-puppy-actions').waitFor({ state: 'hidden' });
    check(await rider.evaluate(() => testEngine.puppies.interactionId === null), 'Leaving the interaction releases the dog');
    check(errors.length === 0, 'Both clients have no captured page errors');
    fs.writeFileSync(output + '/checks.json', JSON.stringify({ checks, swingSamples: samples, errors, frames }, null, 2));
    console.log(JSON.stringify({ checks, errors }, null, 2));
  } finally { fs.writeFileSync(output + '/frames.json', JSON.stringify({checks,frames},null,2)); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

// Run against the local game and matching local Worker. All visitors are synthetic.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const output = process.env.OUTPUT_DIR || '/tmp/cosy-horses-browser';
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', ...(process.env.EXPORT_DIR ? ['--disable-features=LocalNetworkAccessChecks'] : [])] });
  const checks = [], errors = [];
  const check = (ok, label) => { assert(ok, label); checks.push(label); };
  const pages = [];
  async function join() {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    pages.push(page); page.on('pageerror', e => errors.push(e.message));
    page.on('console', message => { if (message.type() === 'error') console.log(message.text()); });
    await page.addInitScript(() => {
      window.testSockets = [];
      const Native = window.WebSocket;
      window.WebSocket = class extends Native { constructor(...args) { super(...args); window.testSockets.push(this); } };
      localStorage.setItem('cosy-village-preferences', JSON.stringify({ weather: 'golden', weatherMode: 'manual', mix: { enabled: false } }));
    });
    if (process.env.EXPORT_DIR) await page.route('http://127.0.0.1:3051/**', route => {
      const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
      const file = path.join(process.env.EXPORT_DIR, pathname.endsWith('/') ? `${pathname}index.html` : pathname);
      return fs.existsSync(file) && fs.statSync(file).isFile() ? route.fulfill({ path: file }) : route.continue();
    });
    await page.goto(process.env.VILLAGE_URL || 'http://127.0.0.1:3051/?sharedTrial=1');
    await page.getByRole('button', { name: 'Enter Hearthwillow' }).click({ timeout: 120000 });
    await page.waitForFunction(() => {
      for (let el = document.querySelector('canvas'); el; el = el.parentElement) {
        for (let fiber = el[Object.keys(el).find(k => k.startsWith('__reactFiber'))]; fiber; fiber = fiber.return) {
          for (let hook = fiber.memoizedState; hook; hook = hook.next) {
            const e = hook.memoizedState?.current;
            if (e?.mountHorse && e.horses) { window.e = e; if (e.sharedConnected) { e.setQuality('low'); return true; } }
          }
        }
      }
    }, null, { timeout: process.env.HAY_ONLY === '1' ? 30000 : 120000 }).catch(async error => { console.log(await page.evaluate(() => ({ text: document.body.innerText, connected: window.e?.sharedConnected, actors: window.e?.sharedActors?.actors?.length })), errors); throw error; });
    const chat = page.getByRole('button', { name: 'Close Hearthwillow chat', exact: true });
    if (await chat.count()) await chat.click();
    console.log(`Joined horse test client ${pages.length}`);
    return page;
  }
  async function approach(page, id = 'horse-juniper') {
    await page.bringToFront();
    const target = await page.evaluate(id => {
      const h = e.sharedActors.actors.find(a => a.id === id);
      const candidates = Array.from({ length: 8 }, (_, i) => ({ x: h.x + Math.cos(i * Math.PI / 4) * 1.8, z: h.z + Math.sin(i * Math.PI / 4) * 1.8 }));
      const target = candidates.find(p => e.movement.clear(p.x, p.z));
      if (!target) throw new Error('No clear horse approach in the test scene');
      e.movement.settle(target.x, target.z); e.yaw = -.6; e.pitch = .25;
      return { ...target, id };
    }, id);
    await page.waitForFunction(p => e.nearHorse?.id === p.id && !e.horseMountPending && e.movement.grounded
      && Math.hypot(e.player.position.x - p.x, e.player.position.z - p.z) < .1, target);
    await page.locator('.v-horse-controls').waitFor();
    // Mounts share the Worker's 80 ms interaction cooldown with the preceding dismount.
    await page.waitForTimeout(100);
  }
  try {
    const rider = await join(), observer = await join();
    if (process.env.HAY_ONLY === '1') {
      const id = 'horse-willow';
      await approach(rider, id); await approach(observer, id);
      const standing = await observer.evaluate(id => {
        const horse = e.horses.horses.find(h => h.id === id); horse.actor.updateMatrixWorld(true);
        return horse.head.getWorldPosition(e.temp).y;
      }, id);
      await rider.waitForTimeout(700);
      await rider.getByRole('button', { name: 'Feed hay', exact: true }).click();
      await observer.bringToFront();
      await observer.waitForFunction(id => e.sharedActors.town.hayFeeds.some(feed => feed.horseId === id && feed.until > Date.now()), id);
      const meal = await rider.evaluate(id => e.sharedActors.town.hayFeeds.find(feed => feed.horseId === id), id);
      check(meal.owner === await rider.evaluate(() => e.sharedSelfId) && meal.until - meal.startedAt === 12000, 'Hay uses one accepted twelve-second meal');
      await observer.waitForFunction(([id, standing]) => {
        const h = e.horses.horses.find(h => h.id === id); h.actor.updateMatrixWorld(true);
        return h.head.getWorldPosition(e.temp).y < standing - .3;
      }, [id, standing]);
      const head = await observer.evaluate(id => e.horses.horses.find(h => h.id === id).head.quaternion.toArray(), id);
      await observer.waitForFunction(([id, before]) => e.horses.horses.find(h => h.id === id).head.quaternion.toArray().some((v, i) => Math.abs(v - before[i]) > .003), [id, head]);
      check(true, 'The real shared horse lowers its head and chews');
      await observer.evaluate(id => e.townAction({ kind: 'town', action: 'hay', id }), id);
      await observer.waitForTimeout(220);
      check(await observer.evaluate(meal => e.sharedActors.town.hayFeeds.find(feed => feed.horseId === meal.horseId).startedAt === meal.startedAt, meal), 'Competing feed does not restart the meal');
      for (const size of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 1024, height: 640 }]) {
        await observer.setViewportSize(size);
        check(await observer.locator('.v-horse-controls').evaluate(panel => {
          const b = panel.getBoundingClientRect();
          return b.x >= 0 && b.right <= innerWidth && b.y >= 0 && b.bottom <= innerHeight && panel.querySelectorAll('p').length === 0 && [...panel.querySelectorAll('button')].every(button => button.querySelector('kbd'));
        }), `Meal controls fit ${size.width}x${size.height}, with keycaps and no decorative helper text`);
      }
      await observer.screenshot({ path: `${output}/horse-eating.png` });
      await rider.evaluate(() => testSockets.at(-1).close(1000));
      await rider.waitForFunction(() => testSockets.length > 1 && e.sharedConnected);
      check(await observer.evaluate(([id, standing]) => {
        const horse = e.horses.horses.find(h => h.id === id); horse.actor.updateMatrixWorld(true);
        return horse.head.getWorldPosition(e.temp).y < standing - .3;
      }, [id, standing]), 'Chewing continues through feeder disconnection and reconnect');
      const late = await join(); await approach(late, id);
      check(await late.evaluate(meal => e.sharedActors.town.hayFeeds.find(feed => feed.horseId === meal.horseId).startedAt === meal.startedAt, meal), 'Late join receives the original meal clock');
      await observer.waitForFunction(id => !e.sharedActors.town.hayFeeds.some(feed => feed.horseId === id && feed.until > Date.now()), id);
      await observer.waitForFunction(([id, standing]) => {
        const horse = e.horses.horses.find(h => h.id === id); horse.actor.updateMatrixWorld(true);
        return horse.head.getWorldPosition(e.temp).y > standing - .08;
      }, [id, standing]);
      check(true, 'The horse returns to its standing pose when the accepted meal ends');
      check(errors.length === 0, `No browser page errors: ${errors.join('; ')}`);
      fs.writeFileSync(`${output}/hay-checks.json`, JSON.stringify({ checks, errors }, null, 2));
      console.log(`${checks.length} shared hay checks passed; ${output}`); return;
    }
    check(await rider.evaluate(() => e.sharedActors.actors.filter(a => a.kind === 'horse').length === 2), 'Both authored horses arrive through Worker snapshots');
    await approach(rider); await approach(observer);
    await rider.bringToFront();
    await rider.getByRole('button', { name: 'Ride', exact: true }).click();
    await rider.waitForFunction(() => e.horseRiding.actor?.id === 'horse-juniper');
    await observer.getByRole('button', { name: 'Already being ridden' }).waitFor();
    check(await observer.getByRole('button', { name: 'Already being ridden' }).isDisabled(), 'Busy horse cannot be mounted by another visitor');
    await observer.evaluate(() => e.mountHorse('horse-juniper'));
    await observer.waitForTimeout(180);
    check(await observer.evaluate(() => !e.horseRiding.actor), 'Competing programmatic mount is also rejected');
    // A saved layout can place trees across the original canter course. Turn onto clear ground first.
    const course = await rider.evaluate(() => {
      const horse = e.horseRiding.actor;
      return Array.from({ length: 16 }, (_, i) => i * Math.PI / 8).find(heading =>
        Array.from({ length: 30 }, (_, i) => i + 1).every(distance => {
          const x = horse.x + Math.sin(heading) * distance, z = horse.z + Math.cos(heading) * distance;
          return [-1.2, 0, 1.2].every(side => e.movement.clear(x + Math.cos(heading) * side, z - Math.sin(heading) * side))
            && e.sharedActors.actors.every(actor => actor.id === horse.id || Math.hypot(actor.x - x, actor.z - z) > 2.5)
            && [...e.remoteVisitors.values()].every(visitor => Math.hypot(visitor.target.x - x, visitor.target.z - z) > 2.5);
        }));
    });
    assert.notEqual(course, undefined, 'The horse test needs a clear 30 m course');
    await rider.bringToFront(); await rider.locator('canvas').focus();
    await rider.keyboard.down('d');
    await rider.waitForFunction(course => Math.abs(Math.atan2(Math.sin(e.horseRiding.actor.heading - course), Math.cos(e.horseRiding.actor.heading - course))) < .08, course);
    await rider.keyboard.up('d');
    const start = await rider.evaluate(() => ({ x: e.horseRiding.actor.x, z: e.horseRiding.actor.z }));
    await rider.locator('canvas').focus();
    await rider.keyboard.down('w');
    await rider.waitForFunction(start => Math.hypot(e.horseRiding.actor.x - start.x, e.horseRiding.actor.z - start.z) > 1, start).catch(async error => {
      console.log(await rider.evaluate(() => ({ horse: e.horseRiding.actor, keys: [...e.keys], blocked: e.blocked, place: e.currentPlace,
        others: e.sharedActors.actors.map(actor => ({ id: actor.id, x: actor.x, z: actor.z })) })));
      throw error;
    });
    await rider.keyboard.down('Shift');
    await rider.waitForFunction(() => e.horseRiding.actor.speed > 4.6);
    check(true, 'Actual W and Shift keys accelerate into canter');
    await rider.keyboard.up('Shift'); await rider.keyboard.up('w');
    await rider.keyboard.down(' ');
    await rider.waitForFunction(() => e.horseRiding.actor.speed < .05);
    await rider.keyboard.up(' ');
    check(true, 'Space brakes the server-owned horse');
    const heading = await rider.evaluate(() => e.horseRiding.actor.heading);
    await rider.keyboard.down('a');
    await rider.waitForFunction(h => Math.abs(e.horseRiding.actor.heading - h) > .25, heading);
    await rider.keyboard.up('a');
    check(true, 'A steers the horse without moving the walking character');
    await observer.waitForFunction(() => {
      const horse = e.horses.riders[0], remote = horse && e.remoteVisitors.get(horse.owner);
      if (!remote) return false;
      e.horses.seatPoint(horse.id, e.temp); e.temp.y -= .62;
      return remote.group.position.distanceTo(e.temp) < .001;
    });
    check(true, 'Observer rider stays attached to the rendered saddle');
    const late = await join();
    await late.waitForFunction(() => e.horses.riders.some(h => h.id === 'horse-juniper'));
    check(await late.evaluate(() => !e.horseRiding.actor), 'Late join sees occupied horse without taking ownership');
    for (const size of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 1024, height: 640 }]) {
      await rider.setViewportSize(size);
      const fit = await rider.locator('.v-horse-controls').evaluate(panel => {
        const b = panel.getBoundingClientRect();
        return b.x >= 0 && b.right <= innerWidth && b.y >= 0 && b.bottom <= innerHeight
          && [...panel.querySelectorAll('.v-interact')].every(button => {
            const key = button.querySelector('kbd');
            return button.getBoundingClientRect().height >= 44 && key && key.scrollWidth <= key.clientWidth;
          });
      });
      check(fit, `Riding controls fit ${size.width}x${size.height}, with 44px targets and real keycaps`);
    }
    await rider.screenshot({ path: `${output}/riding-1024.png` });
    await rider.setViewportSize({ width: 1366, height: 768 });
    await rider.bringToFront(); await rider.locator('canvas').focus();
    await rider.mouse.click(500, 100);
    await rider.waitForFunction(() => document.pointerLockElement === e.renderer.domElement);
    await rider.keyboard.press('Escape');
    await rider.waitForFunction(() => !e.horseRiding.actor);
    await observer.waitForFunction(() => !e.sharedActors.actors.find(a => a.id === 'horse-juniper').owner);
    check(await rider.evaluate(() => !document.pointerLockElement && e.movement.clear(e.player.position.x, e.player.position.z)), 'First Escape releases pointer lock and dismounts onto clear ground');
    await approach(rider); await rider.getByRole('button', { name: 'Ride', exact: true }).click();
    await rider.waitForFunction(() => !!e.horseRiding.actor);
    await rider.evaluate(() => testSockets.at(-1).close(1000));
    await rider.waitForFunction(() => !e.horseRiding.actor && testSockets.length > 1 && e.sharedConnected);
    await observer.waitForFunction(() => !e.sharedActors.actors.find(a => a.id === 'horse-juniper').owner);
    check(true, 'Disconnect releases ownership; reconnect does not resume an old ride');
    await approach(observer); await observer.getByRole('button', { name: 'Ride', exact: true }).click();
    await observer.waitForFunction(() => !!e.horseRiding.actor);
    await observer.evaluate(() => e.setBlocked(true));
    await observer.waitForFunction(() => !e.horseRiding.actor);
    check(await observer.evaluate(() => {
      const horse = e.sharedActors.actors.find(actor => actor.id === 'horse-juniper');
      return Math.hypot(e.player.position.x - horse.x, e.player.position.z - horse.z) >= 1.2;
    }), 'Forced dismount applies the accepted clear landing beside the horse');
    await observer.evaluate(() => e.setBlocked(false));
    check(true, 'Inactive visitor releases the shared horse');
    await approach(observer); await observer.getByRole('button', { name: 'Ride', exact: true }).click();
    await observer.waitForFunction(() => !!e.horseRiding.actor);
    await observer.locator('.v-horse-controls .v-interact').last().focus();
    await observer.keyboard.press('Space');
    await observer.waitForFunction(() => !e.horseRiding.actor);
    check(true, 'Space activates a focused Dismount button');
    const pixels = await rider.evaluate(() => {
      e.renderer.render(e.scene, e.camera);
      const gl = e.renderer.getContext(), p = new Uint8Array(16 * 16 * 4);
      gl.readPixels(10, 10, 16, 16, gl.RGBA, gl.UNSIGNED_BYTE, p);
      return [...p].some((v, i) => i % 4 !== 3 && v > 5);
    });
    check(pixels, 'Actual WebGL canvas contains rendered pixels');
    check(errors.length === 0, `No browser page errors: ${errors.join('; ')}`);
    fs.writeFileSync(`${output}/checks.json`, JSON.stringify({ checks, errors }, null, 2));
    console.log(`${checks.length} rendered horse checks passed; ${output}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

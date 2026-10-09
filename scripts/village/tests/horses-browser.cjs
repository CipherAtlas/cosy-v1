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
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, hasTouch: process.env.TOUCH_CHECK === '1' });
    pages.push(page); page.on('pageerror', e => errors.push(e.message));
    page.on('console', message => { if (message.type() === 'error') console.log(message.text()); });
    await page.addInitScript(localWorker => {
      window.testSockets = [];
      window.testMessages = [];
      const Native = window.WebSocket;
      window.horseLatency = { outbound: 0, inbound: 0 };
      window.WebSocket = class extends Native {
        constructor(...args) {
          super(localWorker || args[0], ...args.slice(1)); window.testSockets.push(this);
          this.addEventListener('message', event => {
            const message = JSON.parse(event.data);
            if (message.type === 'interaction_result') window.testMessages.push(message);
          });
        }
        send(raw) {
          if (JSON.parse(raw).type === 'horseInput' && window.horseLatency.outbound) {
            setTimeout(() => { if (this.readyState === Native.OPEN) super.send(raw); }, window.horseLatency.outbound);
          } else super.send(raw);
        }
        set onmessage(handler) {
          super.onmessage = event => {
            if (JSON.parse(event.data).type === 'actors' && window.horseLatency.inbound)
              setTimeout(() => handler(event), window.horseLatency.inbound);
            else handler(event);
          };
        }
      };
      localStorage.setItem('cosy-village-preferences', JSON.stringify({ weather: 'golden', weatherMode: 'manual', quality: 'low', mix: { enabled: false } }));
    }, process.env.LOCAL_WORKER_URL || null);
    if (process.env.EXPORT_DIR) await page.route('http://127.0.0.1:3051/**', route => {
      const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
      const file = path.join(process.env.EXPORT_DIR, pathname.endsWith('/') ? `${pathname}index.html` : pathname);
      return fs.existsSync(file) && fs.statSync(file).isFile() ? route.fulfill({ path: file }) : route.continue();
    });
    console.log('Loading horse test client', pages.length);
    await page.goto(process.env.VILLAGE_URL || 'http://127.0.0.1:3051/?sharedTrial=1');
    await page.getByRole('button', { name: 'Enter Hearthwillow' }).click({ timeout: 120000 });
    await page.waitForFunction(() => {
      for (const canvas of document.querySelectorAll('canvas')) for (let el = canvas; el; el = el.parentElement) {
        for (let fiber = el[Object.keys(el).find(k => k.startsWith('__reactFiber'))]; fiber; fiber = fiber.return) {
          for (const branch of [fiber, fiber.alternate]) for (let hook = branch?.memoizedState; hook; hook = hook.next) {
            const e = hook.memoizedState?.current;
            if (e?.mountHorse && e.horses) { window.e = e; if (e.sharedConnected) { e.setQuality('low'); return true; } }
          }
        }
      }
    }, null, { timeout: process.env.HAY_ONLY === '1' ? 30000 : 120000 }).catch(async error => { console.log(await page.evaluate(() => ({ text: document.body.innerText, connected: window.e?.sharedConnected, actors: window.e?.sharedActors?.actors?.length })), errors); throw error; });
    const chat = page.getByRole('button', { name: 'Close Hearthwillow chat', exact: true });
    if (await chat.count()) await chat.click();
    if (await page.locator('[data-tutorial-done]').isVisible()) await page.locator('[data-tutorial-done]').click();
    await page.waitForFunction(() => !e.blocked);
    console.log(`Joined horse test client ${pages.length}`);
    return page;
  }
  async function approach(page, id = 'horse-juniper') {
    await page.bringToFront();
    await page.waitForFunction(() => !e.horseRiding.actor && !e.horseMountPending && e.pendingInteractions.size === 0);
    const target = await page.evaluate(id => {
      const h = e.sharedActors.actors.find(a => a.id === id);
      const candidates = [1.45, 1.8, 2.2].flatMap(radius => Array.from({ length: 16 }, (_, i) => ({
        x: h.x + Math.cos(i * Math.PI / 8) * radius, z: h.z + Math.sin(i * Math.PI / 8) * radius, radius })));
      const previous = e.movement.position;
      e.movement.position = { x: h.x, y: h.y, z: h.z };
      const target = candidates.find(p => e.movement.canWalkTo(p.x, p.z)
        && [...e.remoteVisitors.values()].every(visitor => Math.hypot(visitor.target.x - p.x, visitor.target.z - p.z) > 1.2)
        && e.sharedActors.actors.every(actor => actor.id === id || actor.kind !== 'horse'
          || Math.hypot(actor.x - p.x, actor.z - p.z) > p.radius + .3));
      e.movement.position = previous;
      if (!target) throw new Error('No clear horse approach in the test scene');
      e.movement.settle(target.x, target.z); e.yaw = -.6; e.pitch = .25;
      return { ...target, id };
    }, id);
    await page.waitForFunction(p => e.nearHorse?.id === p.id && !e.horseMountPending && e.movement.grounded
      && Math.hypot(e.player.position.x - p.x, e.player.position.z - p.z) < .1, target).catch(async error => {
      console.log('Horse approach state', JSON.stringify(await page.evaluate(target => ({ target, player: e.player.position,
        near: e.nearHorse, blocked: e.blocked, grounded: e.movement.grounded, keys: [...e.keys],
        horse: e.sharedActors.actors.find(actor => actor.id === target.id) }), target), null, 2));
      throw error;
    });
    await page.locator('.v-horse-controls').waitFor();
    if (process.env.HAY_ONLY !== '1') await page.waitForFunction(id =>
      e.sharedActors.actors.find(actor => actor.id === id)?.mode === 'idle'
        && !e.sharedActors.town.hayFeeds.some(feed => feed.horseId === id && feed.until > Date.now() + e.sharedTimeOffset), id);
    // Mounts share the Worker's 80 ms interaction cooldown with the preceding dismount.
    await page.waitForTimeout(100);
  }
  try {
    const rider = await join();
    if (process.env.SMOKE_ONLY === '1') {
      check(await rider.evaluate(() => typeof e.horseRiding.sample === 'function' && typeof e.horseRiding.setColliders === 'function'), 'The served app includes the bounded rider controller');
      check(await rider.evaluate(() => testSockets.at(-1).url.startsWith('ws://127.0.0.1:2567')), 'The served app connects to the existing local Worker');
      check(await rider.evaluate(() => e.sharedActors.actors.filter(actor => actor.kind === 'horse').length === 2), 'The existing Worker provides both shared horses');
      const colliderCount = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../worker/world-physics.json'))).colliders.length;
      check(await rider.evaluate(count => e.world.colliders.length === count, colliderCount), `The served scene retains the matching ${colliderCount}-collider layout`);
      check(errors.length === 0, `No browser page errors: ${errors.join('; ')}`);
      fs.writeFileSync(`${output}/smoke-checks.json`, JSON.stringify({ checks, errors }, null, 2));
      console.log(`${checks.length} actual-served horse smoke checks passed; ${output}`); return;
    }
    const observer = await join();
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
    // Joining/approaching the other client can overlap Rowan's next accepted hay clock.
    await approach(rider);
    await rider.bringToFront();
    await rider.evaluate(() => e.mountHorse('horse-juniper'));
    await rider.waitForFunction(() => e.horseRiding.actor?.id === 'horse-juniper').catch(async error => {
      console.log(JSON.stringify(await rider.evaluate(() => ({ messages: testMessages, pose: e.getPlayerPose(), horse: e.sharedActors.actors.find(a => a.id === 'horse-juniper'), blocked: e.blocked,
        grounded: e.movement.grounded, pending: e.horseMountPending, nearHorse: e.nearHorse, request: !!e.sharedInteraction })), null, 2));
      throw error;
    });
    await observer.getByRole('button', { name: 'Already being ridden' }).waitFor();
    check(await observer.getByRole('button', { name: 'Already being ridden' }).isDisabled(), 'Busy horse cannot be mounted by another visitor');
    await observer.evaluate(() => e.mountHorse('horse-juniper'));
    await observer.waitForTimeout(180);
    check(await observer.evaluate(() => !e.horseRiding.actor), 'Competing programmatic mount is also rejected');
    if (process.env.LATENCY_CHECK === '1') {
      await rider.bringToFront(); await rider.locator('canvas').focus();
      await rider.evaluate(() => { horseLatency.outbound = horseLatency.inbound = 100; });
      await rider.waitForTimeout(350);
      await rider.evaluate(() => {
        window.turnResponse = new Promise(resolve => {
          document.addEventListener('keydown', function record(event) {
            if (event.key !== 'a') return;
            document.removeEventListener('keydown', record, true);
            const at = performance.now(), heading = e.horses.heading(e.horseRiding.actor.id);
            const acceptedHeading = e.horseRiding.actor.heading;
            let visualMs = null, authoritativeMs = null;
            function frame() {
              const turn = h => Math.abs(Math.atan2(Math.sin(h - heading), Math.cos(h - heading)));
              if (visualMs === null && turn(e.horses.heading(e.horseRiding.actor.id)) > .004) visualMs = performance.now() - at;
              if (authoritativeMs === null && Math.abs(e.horseRiding.actor.heading - acceptedHeading) > .004) authoritativeMs = performance.now() - at;
              if (visualMs !== null && authoritativeMs !== null) resolve({ visualMs, authoritativeMs });
              else if (performance.now() - at > 2500) resolve({ visualMs, authoritativeMs });
              else requestAnimationFrame(frame);
            }
            requestAnimationFrame(frame);
          }, true);
        });
      });
      await rider.keyboard.down('a');
      const response = await rider.evaluate(() => turnResponse);
      await rider.keyboard.up('a');
      console.log('Horse response under added 200ms RTT:', response);
      check(response.visualMs !== null && response.visualMs < 100, 'Rider steering responds within 100ms with added 200ms network RTT');
      check(response.authoritativeMs > response.visualMs + 80, 'The visual response precedes the accepted Worker reply');
      check(await rider.evaluate(() => e.horseRiding.actor.owner === e.sharedSelfId), 'Prediction retains the accepted Worker ownership');
      fs.writeFileSync(`${output}/latency.json`, JSON.stringify(response, null, 2));
      await rider.evaluate(() => { horseLatency.outbound = horseLatency.inbound = 0; });
      await rider.waitForTimeout(500);
    }
    // Move the synthetic spectator out of the riding route after checking nearby contention.
    await observer.evaluate(() => {
      const horse = e.sharedActors.actors.find(actor => actor.id === 'horse-juniper');
      const point = Array.from({ length: 16 }, (_, index) => ({ x: horse.x + Math.sin(index * Math.PI / 8) * 8,
        z: horse.z + Math.cos(index * Math.PI / 8) * 8 })).find(point => e.movement.clear(point.x, point.z));
      if (!point) throw Error('No clear spectator position');
      e.movement.settle(point.x, point.z);
    });
    await observer.waitForTimeout(300);
    // Twelve metres covers acceleration, the canter threshold and braking without requiring an empty pasture.
    const course = await rider.evaluate(() => {
      const horse = e.horseRiding.actor;
      const scale = e.world.authored.horses.find(placement => placement.id === horse.id).scale[0];
      return Array.from({ length: 32 }, (_, i) => i * Math.PI / 16).find(heading =>
        Array.from({ length: 24 }, (_, i) => (i + 1) / 2).every(distance => {
          const x = horse.x + Math.sin(heading) * distance, z = horse.z + Math.cos(heading) * distance;
          return [-.65, 0, .65].every(along => [-.25, .25].every(side =>
            e.movement.clear(x + (Math.sin(heading) * along + Math.cos(heading) * side) * scale,
              z + (Math.cos(heading) * along - Math.sin(heading) * side) * scale)))
            && e.sharedActors.actors.every(actor => actor.id === horse.id || actor.activity === 'focus'
              || Math.hypot(actor.x - x, actor.z - z) > (actor.kind === 'horse' ? 1.4 : .8))
            && [...e.remoteVisitors.values()].every(visitor => visitor.activity === 'focus'
              || Math.hypot(visitor.target.x - x, visitor.target.z - z) > 1);
        }));
    });
    assert.notEqual(course, undefined, 'The horse test needs a clear 12 m acceleration/braking course');
    await rider.bringToFront(); await rider.locator('canvas').focus();
    // Aim from the rendered horse: its rider display responds before server snapshots arrive.
    await rider.evaluate(async course => {
      e.horseKey('d', true);
      await new Promise(resolve => {
        function steer() {
          const heading = e.horses.heading(e.horseRiding.actor.id);
          if (Math.abs(Math.atan2(Math.sin(heading - course), Math.cos(heading - course))) < .035) { e.horseKey('d', false); resolve(); }
          else requestAnimationFrame(steer);
        }
        requestAnimationFrame(steer);
      });
    }, course);
    await rider.waitForTimeout(450);
    if (process.env.LATENCY_CHECK === '1') await rider.evaluate(() => { horseLatency.outbound = horseLatency.inbound = 100; });
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
    if (process.env.LATENCY_CHECK === '1') {
      const sustained = await rider.evaluate(() => new Promise(resolve => {
        const frames = [], solver = [], motion = [], riding = e.horseRiding, original = riding.sample;
        riding.sample = function (...args) {
          const at = performance.now(), result = original.apply(this, args);
          solver.push(performance.now() - at); return result;
        };
        const start = performance.now(); let previous = null;
        function frame(now) {
          const horse = e.horses.horses.find(h => h.id === riding.actor.id).actor;
          if (previous) {
            frames.push(now - previous.at);
            motion.push((horse.position.x - previous.x) * Math.sin(horse.rotation.y)
              + (horse.position.z - previous.z) * Math.cos(horse.rotation.y));
          }
          previous = { at: now, x: horse.position.x, z: horse.position.z };
          if (now - start < 600) return requestAnimationFrame(frame);
          riding.sample = original;
          const percentile = (values, p) => values.sort((a, b) => a - b)[Math.floor((values.length - 1) * p)];
          resolve({ frames: frames.length, frameMedianMs: percentile(frames, .5), frameP95Ms: percentile(frames, .95),
            solverMedianMs: percentile(solver, .5), solverP95Ms: percentile(solver, .95),
            stalled: motion.filter(distance => distance < .001).length, backwards: motion.filter(distance => distance < -.02).length });
        }
        requestAnimationFrame(frame);
      }));
      check(sustained.frames >= 8 && sustained.stalled / sustained.frames < .2 && sustained.backwards === 0,
        'Sustained delayed-network cantering advances without repeated stalls or backwards corrections');
      fs.writeFileSync(`${output}/sustained.json`, JSON.stringify(sustained, null, 2));
      console.log('Sustained riding with added 200ms RTT:', sustained);
    }
    await rider.keyboard.up('Shift'); await rider.keyboard.up('w');
    await rider.keyboard.down(' ');
    await rider.waitForFunction(() => e.horseRiding.actor.speed < .05);
    await rider.keyboard.up(' ');
    if (process.env.LATENCY_CHECK === '1') {
      await rider.evaluate(() => { horseLatency.outbound = horseLatency.inbound = 0; });
      await rider.waitForTimeout(300);
    }
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
    for (const size of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 1024, height: 640 },
      { width: 810, height: 1080 }, { width: 1080, height: 810 }, { width: 820, height: 1180 },
      { width: 1180, height: 820 }, { width: 744, height: 1133 }, { width: 1133, height: 744 }]) {
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
    await observer.locator('.v-horse-controls button.v-interact').filter({ hasText: 'Dismount' }).focus();
    await observer.keyboard.press('Space');
    await observer.waitForFunction(() => !e.horseRiding.actor);
    check(true, 'Space activates a focused Dismount button');
    const benchId = await rider.evaluate(() => e.world.benches.find(bench => bench.id === 'bird-clearing-bench').id);
    for (const page of pages) await page.evaluate(id => {
      const bench = e.world.benches.find(bench => bench.id === id);
      e.movement.settle(bench.x, bench.z + 1.8);
    }, benchId);
    await rider.waitForTimeout(450);
    await rider.evaluate(id => e.sit(id, 0), benchId);
    await rider.waitForFunction(() => !!e.seatedBench);
    await observer.evaluate(id => e.sit(id, 1), benchId);
    await observer.waitForFunction(() => !!e.seatedBench);
    await late.evaluate(id => e.sit(id), benchId); await late.waitForTimeout(350);
    check(await late.evaluate(() => !e.seatedBench), 'A third real client cannot take a full shared bench');
    await rider.evaluate(() => e.stand()); await rider.waitForTimeout(250);
    await late.evaluate(id => e.sit(id, 0), benchId);
    await late.waitForFunction(() => !!e.seatedBench);
    check(true, 'Leaving a shared seat releases it for the waiting client');
    for (const page of [observer, late]) await page.evaluate(() => e.stand());
    for (const page of [rider, observer]) {
      await page.bringToFront();
      await page.getByRole('button', { name: 'Expand village map', exact: true }).click();
      await page.getByRole('button', { name: 'Focus cottage', exact: true }).click();
      await page.waitForFunction(() => e.place === 'focus');
    }
    check(await rider.evaluate(() => [...e.remoteVisitors.values()].every(visitor => !visitor.group.visible))
      && await observer.evaluate(() => [...e.remoteVisitors.values()].every(visitor => !visitor.group.visible)),
      'Both former riders can simultaneously use private focus without seeing other visitors');
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
  } catch (error) {
    fs.writeFileSync(`${output}/partial-checks.json`, JSON.stringify({ checks, errors, failure: error.message }, null, 2));
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

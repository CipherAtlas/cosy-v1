// Actual rendered NPC motion with three clients; clips and frame samples are local QA evidence.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = process.env.OUTPUT_DIR || '/tmp/cosy-resident-motion-browser';
fs.mkdirSync(output, { recursive: true });
const url = process.env.VILLAGE_URL || 'http://127.0.0.1:3051';
const checks = [], errors = [];
const check = (ok, label) => { assert(ok, label); checks.push(label); console.log(label); };
const startCapture = page => page.evaluate(() => {
  window.motionFrames = []; window.motionStart = performance.now();
  const e = testEngine, canvas = e.renderer.domElement;
  window.motionChunks = [];
  window.motionRecorder = new MediaRecorder(canvas.captureStream(30), { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 2200000 });
  motionRecorder.ondataavailable = event => { if (event.data.size) motionChunks.push(event.data); };
  motionRecorder.start(); window.motionRunning = true;
  const update = e.life.update;
  window.restoreMotionUpdate = () => { e.life.update = update; };
  e.life.update = function (...args) {
    const sampledAt = performance.now();
    update.apply(this, args);
    if (!motionRunning) return;
    const r = e.life.residents[testResidentIndex].root, p = e.player.position;
    motionFrames.push({ t: sampledAt - motionStart, x: r.position.x, z: r.position.z, heading: r.rotation.y,
      playerX: p.x, playerZ: p.z, mode: e.life.sharedState(testResidentId)?.mode,
      residents: e.life.residents.map((resident, index) => ({ id: ['pip', 'maple', 'moss', 'luma', 'wren'][index],
        x: resident.root.position.x, z: resident.root.position.z, mode: e.life.sharedState(['pip', 'maple', 'moss', 'luma', 'wren'][index])?.mode })) });
  };
});
const finishCapture = async (page, name) => {
  const result = await page.evaluate(async () => {
    motionRunning = false; restoreMotionUpdate();
    await new Promise(resolve => { motionRecorder.onstop = resolve; motionRecorder.stop(); });
    return { bytes: [...new Uint8Array(await new Blob(motionChunks).arrayBuffer())], frames: motionFrames, snapshots: motionSnapshots };
  });
  fs.writeFileSync(path.join(output, `${name}.webm`), Buffer.from(result.bytes));
  return { frames: result.frames, snapshots: result.snapshots };
};
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: [
    '--disable-features=LocalNetworkAccessChecks', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  ] });
  const pages = [];
  try {
    for (let index = 0; index < 3; index++) {
      const page = await browser.newPage({ viewport: { width: 1366, height: 768 } }); pages.push(page);
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(({ local, jitter }) => {
        localStorage.setItem('cosy-village-preferences', JSON.stringify({ weather: 'golden', weatherMode: 'manual', mix: { enabled: false } }));
        window.testSockets = []; window.motionSnapshots = []; window.testResidentId = 'pip'; window.testResidentIndex = 0;
        const Native = WebSocket;
        window.WebSocket = class extends Native {
          constructor(endpoint, ...args) {
            super(local ? 'ws://127.0.0.1:2567/' : endpoint, ...args); testSockets.push(this);
            if (jitter) {
              let listener = null, due = 0, packet = 0;
              Object.defineProperty(this, 'onmessage', { get: () => listener, set: value => { listener = value; } });
              this.addEventListener('message', event => {
                const message = JSON.parse(event.data), now = performance.now();
                const delay = message.type === 'actors' ? [0, 150, 0, 0, 120, 0][packet++ % 6] : 0;
                due = Math.max(due, now + delay);
                setTimeout(() => listener?.call(this, event), due - now);
              });
            }
            this.addEventListener('message', event => {
              const message = JSON.parse(event.data);
              if (message.type === 'actors') motionSnapshots.push({ receivedAt: performance.now(), time: message.world.time,
                actors: message.world.actors.filter(actor => actor.kind === 'resident').map(({ id, x, y, z, heading, speed, mode }) => ({ id, x, y, z, heading, speed, mode })) });
            });
          }
        };
      }, { local: new URL(url).hostname === '127.0.0.1', jitter: !!process.env.NETWORK_JITTER });
      await page.goto(url);
      await page.getByRole('button', { name: 'Enter Hearthwillow', exact: true }).click({ timeout: 120000 });
      await page.waitForFunction(() => {
        for (let el = document.querySelector('canvas'); el; el = el.parentElement)
          for (let fiber = el[Object.keys(el).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return)
            for (let hook = fiber.memoizedState; hook; hook = hook.next) {
              const ref = hook.memoizedState?.current;
              if (ref?.setSharedActors && ref.sharedActors) window.testEngine = ref;
              if (ref?.interact && ref.sendChat) window.testConnection = ref;
            }
        return !!window.testEngine && !!window.testConnection && testEngine.sharedConnected;
      }, null, { timeout: 120000 });
      await page.evaluate(() => testEngine.setQuality('low'));
      const closeChat = page.getByRole('button', { name: 'Hide Hearthwillow chat', exact: true });
      if (await closeChat.count()) await closeChat.click();
      console.log(`Client ${index + 1} connected`);
    }
    const [owner, observer, other] = pages;
    await owner.waitForFunction(() => testEngine.remoteVisitors.size >= 2);
    check(true, 'Three actual village clients share the same world');
    for (const [index, page] of pages.entries()) await page.evaluate(index => {
      const e = testEngine; e.movement.settle(25 + index * 5, 35); e.player.position.copy(e.movement.position);
    }, index);
    await owner.waitForTimeout(1200);
    await observer.evaluate(() => {
      const e = testEngine; window.roamStart = performance.now();
      e.renderer.setAnimationLoop(time => {
        e.frame(time);
        const index = Math.min(4, Math.floor((performance.now() - roamStart) / 2000));
        const r = e.life.residents[index].root.position;
        e.camera.position.set(r.x + 5, r.y + 3, r.z + 5); e.camera.lookAt(r.x, r.y + .8, r.z);
        e.renderer.render(e.scene, e.camera);
      });
    });
    await startCapture(observer); await owner.waitForTimeout(10000);
    const roaming = await finishCapture(observer, 'roaming');
    const roamPeaks = new Map();
    for (let index = 1; index < roaming.frames.length; index++) {
      const a = roaming.frames[index - 1], b = roaming.frames[index], dt = (b.t - a.t) / 1000;
      if (b.t < 1000 || dt > .08 || dt < .005) continue;
      b.residents.forEach((resident, slot) => {
        const previous = a.residents[slot], speed = Math.hypot(resident.x - previous.x, resident.z - previous.z) / dt;
        roamPeaks.set(resident.id, Math.max(roamPeaks.get(resident.id) || 0, speed));
      });
    }
    fs.writeFileSync(path.join(output, 'roaming.json'), JSON.stringify({ peaks: Object.fromEntries(roamPeaks), samples: roaming }, null, 2) + '\n');
    check(roamPeaks.size === 5 && [...roamPeaks.values()].every(speed => speed < 2.5), 'All five roaming residents avoid rapid display jumps across the real clients');
    await observer.evaluate(() => testEngine.renderer.setAnimationLoop(time => testEngine.frame(time)));
    const available = await owner.evaluate(() => {
      const e = testEngine, actor = e.sharedActors.actors.find(actor => actor.kind === 'resident' && !actor.owner);
      return actor && { id: actor.id, index: ['pip', 'maple', 'moss', 'luma', 'wren'].indexOf(actor.id) };
    });
    check(!!available, 'An unclaimed resident is available without interrupting another visitor');
    for (const page of pages) await page.evaluate(({ id, index }) => { testResidentId = id; testResidentIndex = index; }, available);
    // Use the existing test seam for arrival; movement below uses actual keyboard input.
    await owner.evaluate(() => {
      const e = testEngine, actor = e.sharedActors.actors.find(actor => actor.id === testResidentId);
      e.movement.settle(actor.x + 1.5, actor.z); e.player.position.copy(e.movement.position);
    });
    const invite = await owner.evaluate(() => testConnection.interact({ kind: 'resident', id: testResidentId, action: 'walk' }));
    check(invite.ok, 'The unclaimed resident accepts the owner invitation');
    await observer.waitForFunction(() => testEngine.sharedActors.actors.find(actor => actor.id === testResidentId)?.following);
    const rejected = await observer.evaluate(() => testConnection.interact({ kind: 'resident', id: testResidentId, action: 'walk' }));
    check(!rejected.ok, 'The observing client cannot take the same blob');
    for (const [index, page] of pages.entries()) await page.evaluate(index => {
      const e = testEngine; e.movement.settle(index * 5, 24); e.player.position.copy(e.movement.position);
      e.player.rotation.y = 0; e.yaw = Math.PI; e.pitch = .32;
    }, index);
    await owner.waitForFunction(() => {
      const e = testEngine, r = e.life.residents[testResidentIndex];
      return Math.hypot(r.root.position.x - e.player.position.x, r.root.position.z - e.player.position.z) < 1.7
        && e.life.sharedState(testResidentId)?.speed < .2;
    }, null, { timeout: 30000 });
    check(true, 'The accepted blob reaches its shared side-by-side walking position');
    // The observer camera follows the same rendered actor without moving or claiming it.
    await observer.evaluate(() => {
      const e = testEngine;
      e.renderer.setAnimationLoop(time => {
        e.frame(time);
        const r = e.life.residents[testResidentIndex].root.position;
        e.camera.position.set(r.x + 6, r.y + 4, r.z + 6); e.camera.lookAt(r.x + 1, r.y + .8, r.z);
        e.renderer.render(e.scene, e.camera);
      });
    });
    for (const page of [owner, observer]) await startCapture(page);
    await owner.bringToFront(); await owner.locator('canvas').focus();
    await owner.waitForTimeout(1000);
    await owner.keyboard.down('w'); await owner.waitForTimeout(6000); await owner.keyboard.up('w');
    await owner.waitForTimeout(2000);
    await owner.screenshot({ path: path.join(output, 'owner-stop.png') });
    await observer.screenshot({ path: path.join(output, 'observer-stop.png') });
    await owner.keyboard.down('d'); await owner.waitForTimeout(2500); await owner.keyboard.up('d');
    await owner.waitForTimeout(2000);
    const samples = [];
    for (const [index, page] of [owner, observer].entries()) {
      samples.push(await finishCapture(page, index ? 'observer' : 'owner'));
    }
    const metrics = samples.map(({ frames }, view) => {
      const speeds = [], gaps = [];
      for (let index = 1; index < frames.length; index++) {
        const a = frames[index - 1], b = frames[index];
        if (b.t < 2500 || b.t > 6500 || b.t - a.t > 80) continue;
        speeds.push(Math.hypot(b.x - a.x, b.z - a.z) * 1000 / (b.t - a.t));
        if (view === 0) gaps.push(Math.hypot(b.x - b.playerX, b.z - b.playerZ));
      }
      const mean = speeds.reduce((a, b) => a + b) / speeds.length;
      return { frames: frames.length, samples: speeds.length, meanSpeed: mean,
        variation: Math.sqrt(speeds.reduce((sum, speed) => sum + (speed - mean) ** 2, 0) / speeds.length) / mean,
        minSpeed: Math.min(...speeds), maxSpeed: Math.max(...speeds), maxOwnerGap: gaps.length ? Math.max(...gaps) : null };
    });
    fs.writeFileSync(path.join(output, 'motion.json'), JSON.stringify({ metrics, samples, checks, errors }, null, 2) + '\n');
    console.log(JSON.stringify(metrics, null, 2));
    check(metrics.every(m => m.samples > 80 && m.meanSpeed > 1.5 && m.variation < .3), 'Both actual views show steady follower movement without repeated speed pulses');
    check(errors.length === 0, 'No captured browser page errors');
    await owner.evaluate(() => testConnection.interact({ kind: 'resident', id: testResidentId, action: 'home' }));
    fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ checks, metrics, errors }, null, 2) + '\n');
  } catch (error) {
    for (const [index, page] of pages.entries()) {
      const state = await page.evaluate(() => {
        const e = window.testEngine;
        if (!e) return null;
        const actor = e.sharedActors.actors.find(actor => actor.id === testResidentId);
        return { player: e.player.position.toArray(), active: e.getPlayerPose().active, blocked: e.blocked,
          actor: { x: actor.x, z: actor.z, speed: actor.speed, mode: actor.mode, following: actor.following, ownedBySelf: actor.owner === e.sharedSelfId },
          rendered: e.life.residents[testResidentIndex].root.position.toArray() };
      }).catch(() => null);
      console.log(`Client ${index + 1} state`, state);
      await page.screenshot({ path: path.join(output, `failed-${index + 1}.png`) }).catch(() => {});
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

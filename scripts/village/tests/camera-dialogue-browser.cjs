// Local-only visual regression: real Worker mounting/short ride, then explicitly staged crowd geometry.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = process.env.VILLAGE_URL || 'http://127.0.0.1:3051';
const worker = process.env.LOCAL_WORKER_URL;
assert(worker && /^ws:\/\/(127\.0\.0\.1|localhost):/.test(worker), 'Use a matching local Worker, never the public village.');
assert(/^http:\/\/(127\.0\.0\.1|localhost):/.test(app), 'Use the local exported app.');
const output = process.env.OUTPUT_DIR || '/tmp/cosy-camera-dialogue';
fs.mkdirSync(output, { recursive: true });
const results = [], errors = [];
const check = (value, label) => { assert(value, label); results.push(label); console.log(label); };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(worker => {
      const Native = window.WebSocket;
      window.fixtureInteractionResults = [];
      window.WebSocket = class extends Native { constructor(...args) {
        super(worker, ...args.slice(1));
        this.addEventListener('message', event => { const data = JSON.parse(event.data); if (data.type === 'interaction_result') fixtureInteractionResults.push(data); });
      } };
      localStorage.setItem('cosy-village-preferences', JSON.stringify({ weather: 'golden', weatherMode: 'manual', quality: 'low', mix: { enabled: false } }));
    }, worker);
    await page.goto(app);
    await page.getByRole('button', { name: 'Enter Hearthwillow', exact: true }).click({ timeout: 120000 });
    await page.waitForFunction(() => {
      for (const canvas of document.querySelectorAll('canvas')) for (let el = canvas; el; el = el.parentElement)
        for (let fiber = el[Object.keys(el).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return)
          for (const branch of [fiber, fiber.alternate]) for (let hook = branch?.memoizedState; hook; hook = hook.next) {
            const ref = hook.memoizedState?.current;
            if (ref?.mountHorse && ref.sharedConnected && ref.horses) { window.e = ref; return true; }
          }
      return false;
    }, null, { timeout: 120000 });
    const tutorial = page.locator('[data-tutorial-done]');
    if (await tutorial.isVisible()) await tutorial.click();
    const closeChat = page.getByRole('button', { name: 'Close Hearthwillow chat', exact: true });
    if (await closeChat.isVisible()) await closeChat.click();
    await page.waitForFunction(() => !e.blocked);

    let mounted = null;
    const arrivals = [];
    if (process.env.POND_ONLY !== '1') {
    await page.waitForFunction(() => {
      const stable = e.world.authored.items.find(item => item.asset === 'horse-stable' && item.visible);
      return e.sharedActors.actors.some(horse => horse.kind === 'horse' && horse.mode === 'idle' && !horse.owner
        && Math.abs(horse.x - stable.position[0]) < 4.2 * stable.scale[0] && Math.abs(horse.z - stable.position[2]) < 3.15 * stable.scale[2]
        && !e.sharedActors.town.hayFeeds.some(feed => feed.horseId === horse.id && feed.until > e.getSharedNow()));
    }, null, { timeout: 45000 }).catch(async error => {
      const state = await page.evaluate(() => ({ horses: e.sharedActors.actors.filter(actor => actor.kind === 'horse'),
        stable: e.world.authored.items.find(item => item.asset === 'horse-stable' && item.visible), hay: e.sharedActors.town.hayFeeds }));
      fs.writeFileSync(path.join(output, 'stable-availability-failure.json'), JSON.stringify(state, null, 2));
      console.error('Stable fixture availability', JSON.stringify(state)); throw error;
    });
    await page.evaluate(() => {
      const stable = e.world.authored.items.find(item => item.asset === 'horse-stable' && item.visible);
      window.auditHorseId = e.sharedActors.actors.find(horse => horse.kind === 'horse' && horse.mode === 'idle' && !horse.owner
        && Math.abs(horse.x - stable.position[0]) < 4.2 * stable.scale[0] && Math.abs(horse.z - stable.position[2]) < 3.15 * stable.scale[2]
        && !e.sharedActors.town.hayFeeds.some(feed => feed.horseId === horse.id && feed.until > e.getSharedNow())).id;
    });
    await page.evaluate(() => {
      const horse = e.sharedActors.actors.find(actor => actor.id === auditHorseId);
      const candidates = [1.45, 1.8, 2.2].flatMap(radius => Array.from({ length: 16 }, (_, i) => ({ x: horse.x + Math.cos(i * Math.PI / 8) * radius, z: horse.z + Math.sin(i * Math.PI / 8) * radius })));
      const previous = e.movement.position;
      e.movement.position = { x: horse.x, y: horse.y, z: horse.z };
      const target = candidates.find(point => e.movement.canWalkTo(point.x, point.z)
        && [...e.remoteVisitors.values()].every(visitor => Math.hypot(visitor.target.x - point.x, visitor.target.z - point.z) > 1.2)
        && e.sharedActors.actors.every(actor => actor.id === horse.id || actor.kind !== 'horse' || Math.hypot(actor.x - point.x, actor.z - point.z) > 1.8));
      e.movement.position = previous;
      if (!target) throw Error('No clear approach to the available stable horse.');
      e.movement.settle(target.x, target.z); e.yaw = 0; e.pitch = .35;
    });
    await page.waitForFunction(() => e.nearHorse?.id === auditHorseId && e.movement.grounded && !e.horseMountPending);
    await page.waitForTimeout(350); // Let the settled pose reach the Worker's idle presence cadence.
    await page.waitForFunction(() => {
      const horse = e.sharedActors.actors.find(actor => actor.id === auditHorseId);
      return horse?.mode === 'idle' && !horse.owner && !e.sharedActors.town.hayFeeds.some(feed => feed.horseId === horse.id && feed.until > e.getSharedNow());
    }, null, { timeout: 45000 });
    const beforeMount = await page.evaluate(() => fixtureInteractionResults.length);
    const requested = await page.evaluate(() => e.mountHorse(auditHorseId));
    check(requested, 'Mount request passes the grounded local control gate');
    try {
      await page.waitForFunction(before => e.horseRiding.actor?.id === auditHorseId
        || !e.horseMountPending && fixtureInteractionResults.length > before, beforeMount);
      await page.waitForFunction(() => e.horseRiding.actor?.id === auditHorseId, null, { timeout: 5000 });
    } catch (error) {
      const failure = await page.evaluate(() => ({ results: fixtureInteractionResults, pose: e.getPlayerPose(), near: e.nearHorse,
        horse: e.sharedActors.actors.find(actor => actor.id === auditHorseId), hayFeeds: e.sharedActors.town.hayFeeds,
        grounded: e.movement.grounded, blocked: e.blocked, pending: e.horseMountPending, connected: e.sharedConnected }));
      fs.writeFileSync(path.join(output, 'mount-failure.json'), JSON.stringify(failure, null, 2));
      console.error('Mount fixture state', JSON.stringify(failure)); throw error;
    }
    await page.locator('.v-canvas canvas').focus();
    await page.keyboard.down('s'); await page.waitForTimeout(650); await page.keyboard.up('s');
    await page.keyboard.down(' '); await page.waitForTimeout(200); await page.keyboard.up(' ');
    await page.waitForTimeout(1000);
    mounted = await page.evaluate(() => {
      const stable = e.world.authored.items.find(item => item.asset === 'horse-stable' && item.visible), horse = e.horseRiding.actor;
      return { owner: horse?.owner, self: e.sharedSelfId, rider: e.player.position.toArray(), camera: e.camera.position.toArray(), look: e.view.look.toArray(), distance: e.camera.position.distanceTo(e.view.look),
        stable: { position: stable.position, scale: stable.scale }, roofBottom: stable.position[1] + stable.scale[1] * 3.28 };
    });
    fs.writeFileSync(path.join(output, 'mounted-position.json'), JSON.stringify(mounted, null, 2));
    check(mounted.owner === mounted.self, 'Stable screenshot uses a Worker-accepted rider');
    check(Math.abs(mounted.rider[0] - mounted.stable.position[0]) < 4.8 * mounted.stable.scale[0]
      && Math.abs(mounted.rider[2] - mounted.stable.position[2]) < 3.2 * mounted.stable.scale[2], 'Accepted short ride is beneath the authored stable roof');
    check(mounted.camera[1] < mounted.roofBottom && mounted.distance >= 3.6, 'Mounted camera stays beneath the roof without an avatar-sized close-up');
    await page.screenshot({ path: path.join(output, 'stable-mounted-camera.png') });
    await page.evaluate(() => e.leaveHorse());
    await page.waitForFunction(() => !e.horseRiding.actor && !e.horseMountPending);
    await page.waitForTimeout(100);

    for (const [name, file] of [['Meadow Swings', 'swing-approach'], ['Owl grove', 'owl-arrival'], ['Willow circuit', 'circuit-gate']]) {
      await page.getByRole('button', { name: 'Expand village map', exact: true }).click();
      await page.getByRole('button', { name, exact: true }).click();
      await page.waitForFunction(() => !e.blocked && e.pendingInteractions.size === 0 && !document.querySelector('[role=dialog]'));
      for (const [width, height, size] of [[1366, 768, 'laptop'], [744, 1133, 'ipad-mini-portrait']]) {
        await page.setViewportSize({ width, height }); await page.waitForTimeout(1000);
        const arrival = await page.evaluate(() => {
          const anchor = e.player.position.clone(); anchor.y += 1.35; anchor.project(e.camera);
          return { distance: e.view.goal.distanceTo(e.view.look), clearance: e.view.sight.clearance(e.view.look, e.view.goal),
            anchor: anchor.toArray(), player: e.player.position.toArray(), camera: e.camera.position.toArray() };
        });
        check(arrival.distance >= 2.2, `${name} ${size} avoids extreme avatar close-up`);
        check(arrival.clearance >= arrival.distance - .21, `${name} ${size} target camera ray remains clear of indexed visual solids`);
        check(Math.abs(arrival.anchor[0]) < .95 && Math.abs(arrival.anchor[1]) < .95 && Math.abs(arrival.anchor[2]) < 1,
          `${name} ${size} keeps the visitor projected inside the scene`);
        arrivals.push({ name, size, ...arrival });
        await page.screenshot({ path: path.join(output, `${file}-${size}.png`) });
      }
      await page.setViewportSize({ width: 1366, height: 768 });
    }

    }
    await page.getByRole('button', { name: 'Expand village map', exact: true }).click();
    await page.getByRole('button', { name: 'Willow pond', exact: true }).click();
    await page.waitForFunction(() => e.currentPlace === 'breathe');
    await page.waitForTimeout(1200);
    const pond = await page.evaluate(() => ({ goal: e.view.goal.toArray(), look: e.view.look.toArray(), orbit: e.activityOrbit, distance: e.view.goal.distanceTo(e.view.look) }));
    check(pond.orbit.yaw === 0 && pond.orbit.pitch === 0 && pond.distance > 3.2, 'Pond opens with a clear default viewpoint before any manual orbit');
    const pondLayouts = [];
    for (const [width, height, size] of [[1366, 768, 'laptop'], [900, 640, 'small-window'],
      [810, 1080, 'ipad-portrait'], [1080, 810, 'ipad-landscape'], [820, 1180, 'ipad-air-portrait'],
      [1180, 820, 'ipad-air-landscape'], [744, 1133, 'ipad-mini-portrait'], [1133, 744, 'ipad-mini-landscape']]) {
      await page.setViewportSize({ width, height }); await page.waitForTimeout(1000);
      const layout = await page.evaluate(() => {
        const box = e.view.collisionBox.clone().setFromObject(e.character), points = [];
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
          const p = e.player.position.clone().set(x, y, z).project(e.camera);
          points.push([(p.x * .5 + .5) * innerWidth, (-p.y * .5 + .5) * innerHeight]);
        }
        const panel = document.querySelector('#v-activity-panel').getBoundingClientRect();
        return { avatar: { left: Math.min(...points.map(p => p[0])), right: Math.max(...points.map(p => p[0])), top: Math.min(...points.map(p => p[1])), bottom: Math.max(...points.map(p => p[1])) },
          panel: { left: panel.left, right: panel.right, top: panel.top, bottom: panel.bottom } };
      });
      fs.writeFileSync(path.join(output, `pond-layout-${size}.json`), JSON.stringify(layout, null, 2));
      const a = layout.avatar, p = layout.panel;
      check(a.right < p.left || a.left > p.right || a.bottom < p.top || a.top > p.bottom, `Pond ${size} keeps the complete avatar clear of the activity panel`);
      check(a.left >= 0 && a.right <= width && a.top >= 0 && a.bottom <= height, `Pond ${size} keeps the complete projected avatar inside the viewport`);
      pondLayouts.push({ size, ...layout });
      await page.screenshot({ path: path.join(output, `pond-default-${size}.png`) });
    }
    await page.setViewportSize({ width: 1366, height: 768 });

    await page.evaluate(() => e.setWeather('night'));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(output, 'pond-night-volume.png') });
    await page.evaluate(() => e.setWeather('golden'));
    await page.getByRole('button', { name: 'Leave activity', exact: true }).click();
    await page.waitForFunction(() => e.currentPlace === null);
    const openChat = page.getByRole('button', { name: 'Open Hearthwillow chat', exact: true });
    if (await openChat.isVisible()) await openChat.click();

    // Freeze one renderer and stage geometry only; this phase does not test shared ownership.
    await page.evaluate(() => {
      e.renderer.setAnimationLoop(null); e.clearKeys();
    });
    await page.waitForTimeout(180);
    const crowd = await page.evaluate(() => {
      const host = document.querySelector('.v-canvas'), width = host.clientWidth, height = host.clientHeight;
      // Stage and measure atomically; Worker snapshots continue while the renderer is paused.
      e.player.position.set(0, 0, 3); e.camera.position.set(0, 3, 9); e.camera.lookAt(0, 1.3, 0); e.camera.updateMatrixWorld();
      e.life.residents.forEach((resident, index) => resident.root.position.set(index < 2 ? -3 + index * .6 : 120, 0, 0));
      e.dialogue.setEnabled(true); e.dialogue.setKeybindings({ ...e.keybindings, talk: ' ', jump: 'f' }); e.dialogue.say(0, { en: 'Crowd layout check.', ja: '会話の配置確認。' }, 6);
      e.visitors.sync([{ id: 'audit-visitor-a', slot: 20, name: 'Visitor A', color: '#f4c77f', x: 1.8, y: 0, z: .2, heading: 0 },
        { id: 'audit-visitor-b', slot: 21, name: 'Visitor B', color: '#b3d29e', x: 2, y: 0, z: .2, heading: 0 }], e.character, e.world, e.elapsed, 0, false, () => 0);
      e.visitors.showChatBubble({ id: 'audit-visitor-a', message: 'Shared-space message.', name: 'Visitor A' }, e.sharedSelfId, 'self');
      window.auditCue = { id: 'audit-animal', text: { en: 'Animal response.', ja: '動物の反応。' }, position: e.player.position.clone().set(.3, 1.75, .2), visible: true, priority: 3 };
      e.dialogue.layout.beginFrame(); e.dialogue.update(.016, e.camera, e.player.position, e.weather);
      e.animalDialogue.update([auditCue], e.camera, e.player.position, .1, true, true, []);
      e.visitors.projectLabels(e.camera, e.player.position, false, []); e.renderer.render(e.scene, e.camera);
      const visible = element => !element.closest('[hidden]') && element.getClientRects().length;
      const rectangles = selector => [...document.querySelectorAll(selector)].filter(visible).map(element => {
        const r = element.getBoundingClientRect(); return { className: element.className, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      });
      const keycap = document.querySelector('.v-villager-bubble:not([hidden]) .v-villager-footer kbd');
      const capStyle = keycap && getComputedStyle(keycap);
      return { width, height, keycap: keycap && { label: keycap.textContent, wide: keycap.dataset.wide, padding: parseFloat(capStyle.paddingLeft) + parseFloat(capStyle.paddingRight), scroll: keycap.scrollWidth, client: keycap.clientWidth }, bubbles: rectangles('.v-villager-bubble,.v-animal-bubble,.v-visitor-chat,.v-visitor-name'), hud: rectangles('.v-header > button,.v-header nav > *,.v-shared-chat,.v-shared-toggle,.v-walk-hints') };
    });
    fs.writeFileSync(path.join(output, 'crowd-layout.json'), JSON.stringify(crowd, null, 2));
    check(crowd.keycap?.label === 'Space' && crowd.keycap.wide === 'true' && crowd.keycap.padding >= 8 && crowd.keycap.scroll <= crowd.keycap.client,
      'Imperative remapped NPC Space keycap retains visible padding without overflow');
    check(crowd.bubbles.some(rect => rect.className.includes('v-villager-bubble')), 'Nearby NPC control remains visible beside an open chat panel');
    check(crowd.bubbles.some(rect => rect.className.includes('v-animal-bubble')) && crowd.bubbles.some(rect => rect.className.includes('v-visitor-chat')), 'Staged animal response and visitor message retain readable screen space');
    const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    check(crowd.bubbles.every((rect, index) => crowd.bubbles.slice(index + 1).every(other => !overlaps(rect, other))), 'Staged NPC/animal/visitor bubbles and names do not overlap');
    check(crowd.bubbles.every(rect => crowd.hud.every(other => !overlaps(rect, other))), 'Speech and names avoid actual visible chat, minimap and controls');
    check(crowd.bubbles.every(rect => rect.left >= 0 && rect.top >= 0 && rect.right <= crowd.width && rect.bottom <= crowd.height), 'All staged labels remain within the laptop viewport');
    await page.screenshot({ path: path.join(output, 'crowd-chat-layout.png') });
    check(errors.length === 0, `No browser page errors: ${errors.join('; ')}`);
    fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ results, errors, mounted, pond, pondLayouts, arrivals, crowd, limitations: 'Crowd is explicitly staged visual geometry. Stable mount and short ride use the local Worker.' }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

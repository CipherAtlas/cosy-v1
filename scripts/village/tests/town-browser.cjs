// Rendered controls against the local exported game and its matching real Worker.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const output = process.env.OUTPUT_DIR || '/tmp/cosy-town-browser';
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: [
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'
  ] });
  const checks = [], errors = [], pages = [];
  const raceOnly = process.env.RACE_ONLY === '1' || process.env.HUD_ONLY === '1';
  const check = (ok, label) => { assert(ok, label); checks.push(label); console.log(label); };
  async function readyEngine(page, retry = false) {
    await page.waitForFunction(retry => {
      for (let el = document.querySelector('canvas'); el; el = el.parentElement) {
        for (let fiber = el[Object.keys(el).find(k => k.startsWith('__reactFiber'))]; fiber; fiber = fiber.return) {
          for (let hook = fiber.memoizedState; hook; hook = hook.next) {
            const engine = hook.memoizedState?.current;
            if (engine?.townAnimals && (!retry || engine !== window.retryEngine)) {
              window.e = engine;
              if (engine.sharedConnected && engine.sharedActors?.town) { engine.setQuality('low'); return true; }
            }
          }
        }
      }
    }, retry, { timeout: 120000 });
  }
  async function join() {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    pages.push(page); page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(localWorker => {
      localStorage.setItem('cosy-village-preferences', JSON.stringify({ weather: 'golden', weatherMode: 'manual', mix: { enabled: false } }));
      window.testSockets = []; window.testMessages = []; window.testSocketClosures = []; window.testInventoryUpdates = 0; const Native = window.WebSocket;
      window.WebSocket = class extends Native { constructor(...args) { super(localWorker || args[0], ...args.slice(1)); window.testSockets.push(this);
        this.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.type === 'interaction_result') window.testMessages.push(message); if (message.type === 'forageInventory') window.testInventoryUpdates++; });
        this.addEventListener('close', event => window.testSocketClosures.push({ code: event.code, reason: event.reason, at: Date.now() }));
      } };
    }, process.env.LOCAL_WORKER_URL || null);
    await page.goto(process.env.VILLAGE_URL || 'http://127.0.0.1:3051/?sharedTrial=1');
    await page.getByRole('button', { name: 'Enter Hearthwillow' }).click({ timeout: 120000 });
    await readyEngine(page);
    const close = page.getByRole('button', { name: 'Close Hearthwillow chat', exact: true });
    if (await close.count()) await close.click();
    return page;
  }
  async function move(page, point, yaw = 0, pitch = .35) {
    await page.bringToFront();
    await page.evaluate(([point, yaw, pitch]) => { e.movement.settle(point[0], point[1]); e.yaw = yaw; e.pitch = pitch; }, [point, yaw, pitch]);
    await page.waitForFunction(point => Math.hypot(e.player.position.x - point[0], e.player.position.z - point[1]) < .05, point);
    // Wait for the normal shared pose packet before requesting a position-validated action.
    await page.waitForTimeout(700);
  }
  async function approachAnimal(page, id, watching = false, preferredRadius) {
    const point = await page.evaluate(([id, watching, preferredRadius]) => {
      const a = e.sharedActors.town.animals.find(a => a.id === id);
      const radii = preferredRadius ? [preferredRadius, 2.8] : watching ? [2.5, 2.8, 1.55, 1.1] : [1.55, 2.2, 2.8, 1.1];
      const options = radii.flatMap(radius => Array.from({ length: 32 }, (_, i) => ({ x: a.x + Math.sin(i * Math.PI / 16) * radius, z: a.z + Math.cos(i * Math.PI / 16) * radius })));
      const p = options.find(p => e.movement.clear(p.x, p.z) && e.sharedActors.town.animals.every(other => other.id === id || Math.hypot(other.x - p.x, other.z - p.z) > Math.hypot(a.x - p.x, a.z - p.z) + .1)
        && (!watching || [...e.remoteVisitors.values()].every(other => Math.hypot(other.target.x - p.x, other.target.z - p.z) > .65)));
      if (!p) throw Error(`No clear pet approach for ${id}: ${JSON.stringify(e.sharedActors.town.animals.map(a=>({id:a.id,x:a.x,z:a.z})))}`);
      return [p.x, p.z];
    }, [id, watching, preferredRadius]);
    await move(page, point, .3, .25);
    await page.waitForFunction(id => e.townContext?.actions.some(a => a.request.id === id), id);
  }
  async function fit(page, label) {
    for (const size of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 1024, height: 640 }]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(250);
      const layout = await page.locator('.v-town-actions').evaluate(panel => {
        const b = panel.getBoundingClientRect();
        const buttons = [...panel.querySelectorAll('button')].map(button => ({
          height: button.getBoundingClientRect().height, key: button.querySelector('kbd')?.textContent,
          shortcut: button.getAttribute('aria-keyshortcuts')
        }));
        return { x: b.x, right: b.right, y: b.y, bottom: b.bottom, buttons,
          okay: b.x >= 0 && b.right <= innerWidth && b.y >= 0 && b.bottom <= innerHeight
            && buttons.every(button => button.height >= 44 && button.key && button.key === button.shortcut) };
      });
      if (!layout.okay) await page.screenshot({ path: `${output}/${label}-failed-${size.width}.png` });
      check(layout.okay, `${label} fits ${size.width}x${size.height} with 44px targets and real keycaps${layout.okay ? '' : `: ${JSON.stringify(layout)}`}`);
      const hud = await page.locator('.v-town-progress').count();
      if (hud) check(await page.locator('.v-town-progress').evaluate(panel => {
        const b = panel.getBoundingClientRect();
        const map = document.querySelector('.v-minimap')?.getBoundingClientRect();
        const separate = !map || b.bottom <= map.y || b.y >= map.bottom || b.right + 8 <= map.x || b.x >= map.right + 8;
        return b.x >= 0 && b.right <= innerWidth && b.y >= 0 && b.bottom < innerHeight / 2
          && Math.abs(b.x + b.width / 2 - innerWidth / 2) < 3 && separate;
      }), `${label} activity HUD remains centered, clear and separate from the map at ${size.width}x${size.height}`);
    }
    await page.screenshot({ path: `${output}/${label}-1024.png` });
    await page.setViewportSize({ width: 1366, height: 768 });
  }
  async function key(page, key) { await page.bringToFront(); await page.locator('canvas').focus(); await page.keyboard.press(key); }
  async function orchardAndTreats(visitor, observer) {
    const orchard = await visitor.evaluate(() => {
      const tree = e.world.authored.items.find(item => item.asset === 'apple-tree' && item.visible);
      const yaw = tree.rotation[1] * Math.PI / 180;
      const center = [tree.position[0] + Math.sin(yaw) * 1.8 * tree.scale[2], tree.position[2] + Math.cos(yaw) * 1.8 * tree.scale[2]];
      const candidates = [2.8, 3.2, 2.2, 1.6].flatMap(radius => Array.from({ length: 32 }, (_, i) => [center[0] + Math.sin(i * Math.PI / 16) * radius, center[1] + Math.cos(i * Math.PI / 16) * radius]));
      const point = candidates.find(([x, z]) => e.movement.clear(x, z)
        && e.townInteractions.context(e.sharedActors.town, e.sharedSelfId, x, z, null, null, false, Date.now(), e.forageInventory)?.kind === 'orchard');
      if (!point) throw Error('The actual orchard has no clear approach with apple-picking controls.');
      return { id: tree.id, point };
    });
    const before = await visitor.evaluate(() => e.forageInventory.apples);
    const observerApples = await observer.evaluate(() => e.forageInventory.apples);
    await move(visitor, orchard.point);
    await visitor.waitForFunction(id => {
      const town = e.sharedActors.town;
      return e.townContext?.kind === 'orchard' && e.townContext.actions.some(action => action.request.action === 'applePick' && !action.disabled)
        && !town.animals.some(animal => animal.mode === 'forage' && animal.forageSource === id);
    }, orchard.id, { timeout: 45000 });
    await key(visitor, 'e');
    await visitor.waitForFunction(before => e.forageInventory.apples === before + 1, before);
    await observer.waitForFunction(id => e.sharedActors.town.applePickedAt[id] > Date.now() - 10000, orchard.id);
    check(await observer.evaluate(before => e.forageInventory.apples === before, observerApples), 'Real E picks one naturally ripe orchard apple into the visitor’s private basket without granting one to the observer');
    await visitor.bringToFront();
    await visitor.waitForFunction(() => e.townContext?.kind === 'orchard' && e.townContext.actions.some(action => action.request.action === 'applePick' && action.disabled));
    await visitor.screenshot({ path: `${output}/orchard-apple-picking.png` });
    async function feed(food, shortcut) {
      await approachAnimal(visitor, 'cow-highland-1', false, 2.2); await approachAnimal(observer, 'cow-highland-1', true);
      const slot = food === 'apple' ? 'apples' : 'mushrooms';
      const before = await visitor.evaluate(slot => e.forageInventory[slot], slot), observerBefore = await observer.evaluate(slot => e.forageInventory[slot], slot);
      await visitor.bringToFront();
      await visitor.waitForFunction(([food, shortcut]) => e.townContext?.actions.some(action => action.request.action === (food === 'apple' ? 'animalApple' : 'animalMushroom') && action.key === shortcut && !action.disabled), [food, shortcut]);
      await key(visitor, shortcut);
      await visitor.waitForFunction(food => { const cow = e.sharedActors.town.animals.find(animal => animal.id === 'cow-highland-1'); return cow.mode === 'apple' && cow.mealFood === food; }, food);
      await observer.waitForFunction(food => { const cow = e.sharedActors.town.animals.find(animal => animal.id === 'cow-highland-1'); return cow.mode === 'apple' && cow.mealFood === food; }, food);
      check(await visitor.evaluate(([slot, before]) => e.forageInventory[slot] === before - 1, [slot, before])
        && await observer.evaluate(([slot, before]) => e.forageInventory[slot] === before, [slot, observerBefore]), `Real ${shortcut} feeds one private ${food}; the observer keeps its own basket`);
      await observer.bringToFront();
      check(await observer.getByRole('button', { name: food === 'apple' ? 'Enjoying an apple…' : 'Enjoying a mushroom…', exact: true }).isDisabled(), `${food} meal shows the correct occupied treat label`);
      await visitor.bringToFront(); await visitor.waitForTimeout(350);
      check(await visitor.evaluate(food => { const cow = e.townAnimals.animals.find(animal => animal.id === 'cow-highland-1'); return cow[food].visible && !cow[food === 'apple' ? 'mushroom' : 'apple'].visible && cow.speech.visible && cow.hearts.every(heart => heart.visible); }, food), `The accepted ${food} meal renders its matching treat, hearts and Mooo`);
      await visitor.screenshot({ path: `${output}/cow-${food}-private-basket.png` });
      await visitor.waitForFunction(() => e.sharedActors.town.animals.find(animal => animal.id === 'cow-highland-1').mode === 'graze', null, { timeout: 10000 });
    }
    await feed('apple', 'F');
    while (!await visitor.evaluate(() => e.forageInventory.mushrooms > 0)) {
      await visitor.bringToFront();
      await visitor.waitForFunction(() => { const hedge = e.sharedActors.town.animals.find(animal => animal.id === 'hedgehog-1'); return hedge.mode === 'gift' && hedge.carry; }, null, { timeout: 60000 });
      await approachAnimal(visitor, 'hedgehog-1');
      const gift = await visitor.evaluate(() => e.sharedActors.town.animals.find(animal => animal.id === 'hedgehog-1').carry);
      const slot = gift === 'apple' ? 'apples' : 'mushrooms', before = await visitor.evaluate(slot => e.forageInventory[slot], slot);
      await visitor.waitForFunction(() => e.townContext?.actions.some(action => action.request.action === 'animalGift' && !action.disabled));
      await key(visitor, 'e');
      await visitor.waitForFunction(([slot, before]) => e.forageInventory[slot] === before + 1, [slot, before]);
    }
    check(await observer.evaluate(() => !e.forageInventory.mushrooms), 'Natural hedgehog mushroom gifts stay private to the accepting visitor');
    await feed('mushroom', '3');
  }
  async function gifts(visitor, observer) {
    const evidence = { status: 'running', gifts: [], meals: [], identities: [await visitor.evaluate(() => e.sharedSelfId), await observer.evaluate(() => e.sharedSelfId)] };
    const persist = () => fs.writeFileSync(`${output}/forage-details.json`, JSON.stringify(evidence, null, 2));
    persist();
    async function stableIdentity() {
      const current = [await visitor.evaluate(() => e.sharedSelfId), await observer.evaluate(() => e.sharedSelfId)];
      if (current.some((id, index) => id !== evidence.identities[index])) {
        evidence.status = 'interrupted'; evidence.currentIdentities = current;
        evidence.socketClosures = [await visitor.evaluate(() => window.testSocketClosures), await observer.evaluate(() => window.testSocketClosures)]; persist();
        throw Error('Local Worker reconnected during the gift check; rerun against a stable Worker so session inventory is comparable.');
      }
    }
    check(await visitor.evaluate(() => e.forageInventory.apples === 0 && e.forageInventory.mushrooms === 0)
      && await observer.evaluate(() => e.forageInventory.apples === 0 && e.forageInventory.mushrooms === 0), 'Both new visitors start with empty private gift inventories');
    async function receive() {
      await visitor.bringToFront();
      await visitor.waitForFunction(() => { const a = e.sharedActors.town.animals.find(a => a.id === 'hedgehog-1'); return a?.mode === 'gift' && a.carry; }, null, { timeout: 60000 });
      const food = await visitor.evaluate(() => e.sharedActors.town.animals.find(a => a.id === 'hedgehog-1').carry);
      await approachAnimal(visitor, 'hedgehog-1'); await approachAnimal(observer, 'hedgehog-1', true);
      await observer.waitForFunction(food => { const a = e.sharedActors.town.animals.find(a => a.id === 'hedgehog-1'); return a?.mode === 'gift' && a.carry === food; }, food);
      for (const [label, page] of [['visitor', visitor], ['observer', observer]]) {
        check(await page.evaluate(food => { const a = e.townAnimals.animals.find(a => a.id === 'hedgehog-1'); return a[food].visible && !a[food === 'apple' ? 'mushroom' : 'apple'].visible; }, food), `${food}: ${label} renders exactly the accepted gift on the hedgehog's back`);
        await page.bringToFront();
        await page.evaluate(() => { const a = e.sharedActors.town.animals.find(a => a.id === 'hedgehog-1'); e.yaw = a.heading + .9; e.pitch = .5; e.distance = 2.8; });
        await page.waitForTimeout(350); await page.screenshot({ path: `${output}/hedgehog-${food}-${label}.png` });
      }
      const before = await visitor.evaluate(() => ({ ...e.forageInventory }));
      await visitor.waitForFunction(() => e.townContext?.actions.some(a => a.request.action === 'animalGift' && !a.disabled));
      await key(visitor, 'e');
      const slot = food === 'apple' ? 'apples' : 'mushrooms';
      await visitor.waitForFunction(([slot, count]) => e.forageInventory[slot] === count + 1, [slot, before[slot]]);
      await observer.waitForFunction(() => !e.sharedActors.town.animals.find(a => a.id === 'hedgehog-1').carry);
      check(await observer.evaluate(() => e.forageInventory.apples === 0 && e.forageInventory.mushrooms === 0), `${food}: real E grants one private gift only to the receiving visitor`);
      await stableIdentity();
      evidence.gifts.push({ food, before, after: await visitor.evaluate(() => ({ ...e.forageInventory })) }); persist();
      return food;
    }
    async function feed(reduced) {
      await visitor.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
      await observer.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
      await approachAnimal(visitor, 'cow-highland-1', false, 2.2); await approachAnimal(observer, 'cow-highland-1', true);
      check(await visitor.evaluate(() => Boolean(e.townAnimals.animals.find(a => a.id === 'cow-highland-1').root.getObjectByName('CowHighlandGirl'))), 'Honey uses the original flower girl-cow model');
      const apples = await visitor.evaluate(() => e.forageInventory.apples);
      await visitor.waitForFunction(() => e.townContext?.actions.some(a => a.request.action === 'animalApple' && a.key === 'F' && !a.disabled));
      await key(visitor, 'f');
      await visitor.waitForFunction(() => e.sharedActors.town.animals.find(a => a.id === 'cow-highland-1')?.mode === 'apple');
      await observer.waitForFunction(() => e.sharedActors.town.animals.find(a => a.id === 'cow-highland-1')?.mode === 'apple');
      check(await visitor.evaluate(apples => e.forageInventory.apples === apples - 1, apples), 'Real F feeds exactly one received apple');
      const clock = await visitor.evaluate(() => e.sharedActors.town.animals.find(a => a.id === 'cow-highland-1'));
      const positions = [await visitor.evaluate(() => e.getPlayerPose()), await observer.evaluate(() => e.getPlayerPose())];
      check(clock.until - clock.startedAt === 8000 && await observer.evaluate(clock => { const a = e.sharedActors.town.animals.find(a => a.id === clock.id); return a.startedAt === clock.startedAt && a.until === clock.until && a.owner === clock.owner; }, clock), 'Cow apple meal has the same accepted eight-second owner and clock in both clients');
      check(await observer.getByRole('button', { name: /Enjoying an apple/ }).isDisabled(), 'Observer sees the occupied cow and cannot restart the meal');
      await visitor.bringToFront(); await visitor.waitForTimeout(700);
      const poses = [];
      for (let i = 0; i < 4; i++) { poses.push(await visitor.evaluate(() => { const a = e.townAnimals.animals.find(a => a.id === 'cow-highland-1'); return { x: a.head.rotation.x, z: a.head.rotation.z }; })); await visitor.waitForTimeout(130); }
      check(reduced ? poses.every(p => p.x === 0 && p.z === 0) : poses.some(p => Math.abs(p.z) > .01) && Math.max(...poses.map(p => p.x)) - Math.min(...poses.map(p => p.x)) > .02, reduced ? 'Reduced-motion apple meal uses a still head pose' : 'Apple meal has a distinct visible munch/tilt head animation');
      for (const [label, page] of [['visitor', visitor], ['observer', observer]]) {
        await page.bringToFront();
        check(await page.evaluate(() => { const a = e.townAnimals.animals.find(a => a.id === 'cow-highland-1'); return a.apple.visible && a.hearts.every(heart => heart.visible) && a.speech.visible; }), `${label} sees the real apple, floating hearts and Mooo emote${reduced ? ' with reduced motion' : ''}`);
        await page.screenshot({ path: `${output}/cow-apple-${reduced ? 'reduced' : 'normal'}-${label}.png` });
      }
      await fit(visitor, reduced ? 'apple-reduced' : 'apple-meal');
      await stableIdentity(); evidence.meals.push({ reduced, clock, poses, visitorPoses: positions }); persist();
      await visitor.waitForFunction(() => !e.sharedActors.town.animals.find(a => a.id === 'cow-highland-1')?.owner, null, { timeout: 10000 });
      check(await visitor.evaluate(() => e.sharedActors.town.animals.find(a => a.id === 'cow-highland-1').mode === 'graze'), 'Eight-second apple meal ends and the cow resumes grazing');
    }
    const received = new Set();
    while (!await visitor.evaluate(() => e.forageInventory.apples > 0)) received.add(await receive());
    await feed(false);
    while (!received.has('mushroom')) received.add(await receive());
    while (!await visitor.evaluate(() => e.forageInventory.apples > 0)) received.add(await receive());
    await feed(true);
    check(received.has('apple') && received.has('mushroom'), 'The real hedgehog provides both an apple and a mushroom from the authored sources');
    await stableIdentity();
    evidence.finalInventories = [await visitor.evaluate(() => ({ ...e.forageInventory })), await observer.evaluate(() => ({ ...e.forageInventory }))]; persist();
    check(evidence.finalInventories[0].mushrooms > 0 && evidence.finalInventories[1].mushrooms === 0, 'Mushroom gifts remain private while apples are consumed');
    evidence.status = 'passed'; persist();
    await visitor.emulateMedia({ reducedMotion: 'no-preference' }); await observer.emulateMedia({ reducedMotion: 'no-preference' });
  }
  async function drive(page, point, radius = 1.5, stop = true) {
    await page.bringToFront(); await page.locator('canvas').focus();
    const course = typeof point === 'string', held = new Set(), until = Date.now() + (course ? 55000 : 25000);
    
    try {
      while (Date.now() < until) {
        const p = await page.evaluate(([point, course]) => {
          const h = e.horseRiding.actor;
          if (!h) throw Error('Ride ended while following course');
          const courseAngle = Math.atan2((h.z - 20) / 14, (h.x - 85) / 24);
          // Approach the ribbon in the race direction; reversing beside its post can block the horse's full body.
          const target = course ? [85 + 24 * Math.cos(courseAngle + .22), 20 + 14 * Math.sin(courseAngle + .22)] : point;
          const desired = Math.atan2(target[0] - h.x, target[1] - h.z);
          return { d: Math.hypot(target[0] - h.x, target[1] - h.z), courseAngle,
            ribbon: Math.hypot(85 - h.x, 34 - h.z), finished: e.sharedActors.town.race?.phase === 'finished',
            angle: Math.atan2(Math.sin(desired - h.heading), Math.cos(desired - h.heading)) };
        }, [point, course]);
        if (course) {

          if ((point === 'startRibbon' && p.ribbon < radius) || (point === 'finishLap' && p.finished)) return;
        } else if (p.d < radius) return;
        const want = new Set();
        if (Math.abs(p.angle) > .09) want.add(p.angle > 0 ? 'a' : 'd');
        if (Math.abs(p.angle) < 1.1) want.add('w');
        // Tight ends need the walk-speed turning radius; sprint through the gentler top and bottom curves.
        if ((course ? Math.abs(Math.sin(p.courseAngle)) > .65 : p.d > 7) && Math.abs(p.angle) < .2) want.add('Shift');
        for (const k of held) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
        for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
        await page.waitForTimeout(70);
      }
      throw Error(`Could not ride to ${point}: ${JSON.stringify(await page.evaluate(() => ({horse:e.horseRiding.actor,blocked:e.blocked,keys:[...e.keys]})))}`);
    } finally {
      for (const k of held) await page.keyboard.up(k);
      if (stop) {
        await page.keyboard.down(' ');
        await page.waitForFunction(() => !e.horseRiding.actor || e.horseRiding.actor.speed < .05, null, { timeout: 5000 });
        await page.keyboard.up(' ');
      }
    }
  }
  try {
    const visitor = await join(), observer = await join();
    check(await visitor.evaluate(() => e.sharedActors.town.animals.length === 7 && e.sharedActors.town.beds.length === 15
      && e.townScene.owls.length === 3), 'Seven farm/garden animals, fifteen farm rows and three Blender owls render from shared state');
    if (process.env.HORSE_DOG_ONLY === '1') {
      check(await visitor.evaluate(() => e.puppies.puppies.length === 4 && e.puppies.puppies.every(puppy => puppy.native
        && puppy.model.userData.animalRigSlug === `dog-${puppy.info.breed}` && puppy.head.isBone && Object.keys(puppy.animation.actions).length === 10)),
      'All four placed dogs use native skins, head contact bones and ten independent clips');
      check(await visitor.evaluate(() => e.horses.horses.length === 2 && e.horses.horses.every(horse => horse.model.userData.animalRigSlug?.startsWith('horse-')
        && horse.seat.isBone && !horse.model.name.startsWith('Horse-'))), 'Both shared horses use the native skin and exported saddle bone');
      const puppy = await visitor.evaluate(() => {
        for (const puppy of e.puppies.puppies) {
          const state = e.sharedActors.actors.find(actor => actor.id === puppy.info.id);
          if (!state || state.owner) continue;
          const points = [1.1, 1.3].flatMap(radius => Array.from({ length: 16 }, (_, i) => [state.x + Math.sin(i * Math.PI / 8) * radius, state.z + Math.cos(i * Math.PI / 8) * radius]));
          const point = points.find(([x, z]) => e.movement.clear(x, z) && puppy.movement.canWalkTo(x, z));
          const watching = Array.from({ length: 16 }, (_, i) => [state.x + Math.sin(i * Math.PI / 8) * 7, state.z + Math.cos(i * Math.PI / 8) * 7])
            .find(([x, z]) => e.movement.clear(x, z));
          if (point && watching) return { id: state.id, name: puppy.info.name, point, watching };
        }
        throw Error('No native dog has a clear pet approach.');
      });
      await move(visitor, puppy.point);
      await visitor.waitForFunction(id => e.nearPuppy?.id === id && e.movement.grounded && e.movement.speed < .1, puppy.id);
      await visitor.getByRole('button', { name: `Pet ${puppy.name}`, exact: true }).click();
      await visitor.waitForFunction(id => e.sharedActors.actors.find(actor => actor.id === id)?.mode === 'pet', puppy.id);
      await move(observer, puppy.watching);
      await observer.waitForFunction(id => e.sharedActors.actors.find(actor => actor.id === id)?.mode === 'pet', puppy.id);
      const clock = await visitor.evaluate(id => e.sharedActors.actors.find(actor => actor.id === id), puppy.id);
      check(await observer.evaluate(clock => { const state = e.sharedActors.actors.find(actor => actor.id === clock.id); return state.startedAt === clock.startedAt && state.owner === clock.owner; }, clock),
        'Native dog petting uses the same accepted owner and clock in both clients');
      await visitor.bringToFront();
      await visitor.waitForFunction(id => e.puppies.puppies.find(puppy => puppy.info.id === id).animation.actions.pet.getEffectiveWeight() > .85, puppy.id);
      check(await visitor.evaluate(() => e.puppies.petContact()?.toArray().every(Number.isFinite)), 'Pet contact follows the actual native head bone');
      await visitor.screenshot({ path: `${output}/native-dog-pet.png` });
      await visitor.locator('.v-puppy-tricks-toggle').click();
      await visitor.waitForTimeout(100);
      await visitor.getByRole('button', { name: /Wave/, exact: false }).click();
      await visitor.waitForFunction(id => e.sharedActors.actors.find(actor => actor.id === id)?.action === 'wave', puppy.id);
      await observer.waitForFunction(id => e.sharedActors.actors.find(actor => actor.id === id)?.action === 'wave', puppy.id);
      await visitor.bringToFront();
      await visitor.waitForFunction(id => e.puppies.puppies.find(puppy => puppy.info.id === id).animation.actions.wave.getEffectiveWeight() > .85, puppy.id);
      check(true, 'The real Wave button plays the accepted native wave clip for observers');
      await visitor.screenshot({ path: `${output}/native-dog-wave.png` });
      await key(visitor, 'Escape');
      await visitor.waitForFunction(id => !e.sharedActors.actors.find(actor => actor.id === id)?.owner, puppy.id);
      const horse = await visitor.evaluate(() => {
        for (const horse of e.horses.horses) {
          const state = e.sharedActors.actors.find(actor => actor.id === horse.id);
          if (!state || state.owner) continue;
          const point = Array.from({ length: 16 }, (_, i) => [state.x + Math.sin(i * Math.PI / 8) * 1.8, state.z + Math.cos(i * Math.PI / 8) * 1.8])
            .find(([x, z]) => e.movement.clear(x, z));
          if (point) return { id: state.id, point };
        }
        throw Error('No native horse has a clear mount approach.');
      });
      await move(visitor, horse.point);
      await visitor.waitForFunction(id => e.nearHorse?.id === id, horse.id);
      await visitor.getByRole('button', { name: 'Ride', exact: true }).click();
      await visitor.waitForFunction(id => e.horseRiding.actor?.id === id, horse.id);
      await move(observer, horse.point);
      await key(visitor, 'w'); await visitor.keyboard.down('w');
      await visitor.waitForFunction(() => e.horseRiding.actor.speed > .2);
      await visitor.waitForTimeout(550); await visitor.keyboard.up('w');
      await visitor.keyboard.down(' '); await visitor.waitForFunction(() => e.horseRiding.actor.speed < .05); await visitor.keyboard.up(' ');
      await observer.bringToFront();
      await observer.waitForFunction(id => {
        const actor = e.sharedActors.actors.find(actor => actor.id === id), remote = actor?.owner && e.remoteVisitors.get(actor.owner);
        if (!remote || !e.horses.seatPoint(id, e.temp)) return false;
        e.temp.y -= .62; return remote.group.position.distanceTo(e.temp) < .025;
      }, horse.id);
      check(true, 'Actual W movement retains the observer rider on the native saddle bone');
      await visitor.bringToFront(); await visitor.screenshot({ path: `${output}/native-horse-riding.png` });
      await key(visitor, 'Escape'); await visitor.waitForFunction(() => !e.horseRiding.actor);
      check(errors.length === 0, `No native horse/dog browser page errors (${errors.length})`);
      fs.writeFileSync(`${output}/native-horse-dog-checks.json`, JSON.stringify({ checks, errors }, null, 2));
      console.log(`${checks.length} native horse/dog shared browser checks passed.`); return;
    }
    if (process.env.RIG_ONLY === '1') {
      check(await visitor.evaluate(() => {
        const skinned = root => { let count = 0; root.traverse(node => { if (node.isSkinnedMesh && node.skeleton.bones.length) count++; }); return count === 2; };
        return e.townAnimals.animals.every(animal => animal.id === 'hedgehog-1' ? !animal.model.userData.animalRigSlug : skinned(animal.model))
          && e.townScene.owls.every(owl => skinned(owl.root)) && e.garden.birds.every(bird => skinned(bird.root));
      }), 'Active pasture animals, all owls and all pond birds use two-draw native skins while Bramble keeps the original model');
      const before = await visitor.evaluate(() => e.garden.birds.map(bird => {
        const pose = []; bird.root.traverse(node => { if (node.isBone) pose.push(...node.position.toArray(), ...node.quaternion.toArray(), ...node.scale.toArray()); }); return pose;
      }));
      await visitor.waitForTimeout(270);
      check(await visitor.evaluate(before => e.garden.birds.every((bird, index) => {
        const pose = []; bird.root.traverse(node => { if (node.isBone) pose.push(...node.position.toArray(), ...node.quaternion.toArray(), ...node.scale.toArray()); });
        return pose.length > 0 && pose.length === before[index].length && pose.every(Number.isFinite) && pose.some((value, axis) => Math.abs(value - before[index][axis]) > .00001);
      }), before), 'Native swim clips deform each actual duck, duckling and swan skin with finite bone poses');
      check(await visitor.evaluate(() => e.garden.birds.every((bird, index) => bird.immersion === (index < 3 ? .16 : index < 7 ? .1 : .06)
        && bird.root.position.y < e.garden.pondSpace.swim(index, e.garden.time, e.garden.feedAt)[1])), 'Native swans, ducks and ducklings float with the species immersion below the actual shared waterline');
      for (const [index, species, targetY] of [[0, 'swan', .65], [3, 'duck', .32]]) {
        await visitor.evaluate(([index, targetY]) => {
          window.rigCameraPose = { position: e.camera.position.clone(), quaternion: e.camera.quaternion.clone() };
          e.renderer.setAnimationLoop(null);
          const bird = e.garden.birds[index].root;
          e.camera.position.copy(bird.position).add({ x: 2.8, y: 1.25, z: 4.2 });
          e.camera.lookAt(bird.position.clone().add({ x: 0, y: targetY, z: 0 }));
          e.renderer.render(e.scene, e.camera);
        }, [index, targetY]);
        await visitor.screenshot({ path: `${output}/native-${species}-waterline.png` });
        await visitor.evaluate(() => {
          e.camera.position.copy(rigCameraPose.position); e.camera.quaternion.copy(rigCameraPose.quaternion);
          e.renderer.setAnimationLoop(time => e.frame(time)); delete window.rigCameraPose;
        });
      }
    }
    if (process.env.ANIMAL_ONLY === '1' && process.env.OWL_ONLY !== '1') {
      const before = await visitor.evaluate(() => ({ owls: e.townScene.owls.map(owl => owl.root.position.toArray()), birds: e.garden.birds.map(bird => bird.root.position.toArray()) }));
      await visitor.waitForTimeout(300);
      const after = await visitor.evaluate(() => ({ owls: e.townScene.owls.map(owl => owl.root.position.toArray()), birds: e.garden.birds.map(bird => ({ position: bird.root.position.toArray(), heading: bird.root.rotation.y })) }));
      check(after.owls.some((position, index) => Math.hypot(...position.map((value, axis) => value - before.owls[index][axis])) > .05), 'At least one owl is already following its ordinary woodland flight loop before feeding');
      check(after.birds.every((bird, index) => {
        const dx = bird.position[0] - before.birds[index][0], dz = bird.position[2] - before.birds[index][2], distance = Math.hypot(dx, dz);
        return distance < .002 || (Math.sin(bird.heading) * dx + Math.cos(bird.heading) * dz) / distance > .96;
      }), 'Every rendered duck, duckling and swan faces the direction it actually swims');
      check(await visitor.evaluate(() => !e.garden.group.getObjectByName('BreadPouch')), 'The unwanted white bread pouch is absent from the dock');
      await move(visitor, [-48, -26.4]); await visitor.screenshot({ path: `${output}/owl-flight-before-feeding.png` });
    }
    if (process.env.GIFT_ONLY === '1') {
      await gifts(visitor, observer);
      check(errors.length === 0, `No browser page errors (${errors.length})`);
      fs.writeFileSync(`${output}/browser-checks.json`, JSON.stringify({ scope: 'Shared forage gifts and apple meals only', checks, errors }, null, 2));
      console.log(`${checks.length} forage browser checks passed.`); return;
    }
    for (const id of process.env.OWL_ONLY === '1' || process.env.ACTIVITY_ONLY === '1' || raceOnly ? [] : ['cow-highland-1', 'sheep-1', 'lamb-1', 'hedgehog-1']) {
      await approachAnimal(visitor, id); await approachAnimal(observer, id, true);
      await visitor.waitForFunction(id => e.townContext?.actions.some(a => a.request.id === id && a.request.action === 'animalPet' && !a.disabled), id, { timeout: 60000 });
      const petKey = await visitor.evaluate(id => e.townContext.actions.find(a => a.request.id === id && a.request.action === 'animalPet').key, id);
      await key(visitor, petKey);
      await visitor.waitForFunction(id => e.sharedActors.town.animals.find(a => a.id === id)?.owner === e.sharedSelfId, id);
      await observer.waitForFunction(id => e.sharedActors.town.animals.find(a => a.id === id)?.mode === 'pet', id);
      await approachAnimal(observer, id, true);
      check(await observer.getByRole('button', { name: 'Being petted…' }).isDisabled(), `${id}: observer sees exclusive petting and cannot restart it`);
      await visitor.bringToFront();
      await visitor.waitForTimeout(350);
      if (process.env.ANIMAL_ONLY === '1') {
        check(await visitor.evaluate(id => { const animal = e.townAnimals.animals.find(animal => animal.id === id); return animal.hearts.every(heart => heart.visible) && animal.speech.visible && Math.abs(animal.head.rotation.x) > .01; }, id), `${id}: accepted petting has three floating hearts, species dialogue and a gentle head nuzzle`);
        check(await observer.evaluate(id => { const animal = e.townAnimals.animals.find(animal => animal.id === id); return animal.hearts.every(heart => heart.visible) && animal.speech.visible; }, id), `${id}: observer sees the same pet hearts and dialogue`);
        await visitor.emulateMedia({ reducedMotion: 'reduce' }); await visitor.waitForTimeout(180);
        const reducedPose = await visitor.evaluate(id => { const animal = e.townAnimals.animals.find(animal => animal.id === id); return [...animal.head.position.toArray(), ...animal.head.quaternion.toArray()]; }, id);
        await visitor.waitForTimeout(120);
        check(await visitor.evaluate(([id, pose]) => { const animal = e.townAnimals.animals.find(animal => animal.id === id); return [...animal.head.position.toArray(), ...animal.head.quaternion.toArray()].every((value, index) => Math.abs(value - pose[index]) < .000001) && animal.model.rotation.z === 0 && animal.hearts.every(heart => heart.visible); }, [id, reducedPose]), `${id}: reduced motion keeps still visible hearts and suppresses the pet gesture`);
        await visitor.emulateMedia({ reducedMotion: 'no-preference' });
      }
      if (id === 'cow-highland-1' || id === 'hedgehog-1') {
        const owner = await visitor.evaluate(() => e.sharedSelfId);
        check(await visitor.evaluate(() => e.character.rotation.x > .03), `${id}: petter visibly reaches toward the animal`);
        check(await observer.evaluate(owner => e.remoteVisitors.get(owner)?.spirit.rotation.x > .03, owner),
          `${id}: observer sees the same accepted reaching gesture`);
      }
      if (process.env.BUBBLES_ONLY === '1') {
        for (const client of [visitor, observer]) {
          await client.evaluate(id => {
            const animal = e.townAnimals.animals.find(animal => animal.id === id);
            const point = animal.speech.position.clone();
            e.renderer.setAnimationLoop(null); e.camera.position.copy(point).add(e.temp.set(4, 2, 6)); e.camera.lookAt(point);
            e.renderer.render(e.scene, e.camera); e.animalDialogue.update(e.animalDialogueCues, e.camera, e.player.position, 1, true, true);
          }, id);
          check(await client.locator('.v-animal-bubble').evaluate((bubble, id) => {
            const box = bubble.getBoundingClientRect(), style = getComputedStyle(bubble), bird = getComputedStyle(document.querySelector('.v-bird-bubble:not(.v-animal-bubble)'));
            return !bubble.hidden && bubble.dataset.animal === id && style.backgroundColor === bird.backgroundColor && style.borderRadius === bird.borderRadius && box.x >= 0 && box.right <= innerWidth && box.y >= 0 && box.bottom <= innerHeight;
          }, id), `${id}: both clients show the original bird-style cream speech bubble near the accepted animal`);
          if (client === visitor) await client.screenshot({ path: `${output}/bubble-${id}.png` });
          await client.evaluate(() => e.renderer.setAnimationLoop(time => e.frame(time)));
        }
      }
      await visitor.screenshot({ path: `${output}/pet-${id}.png` });
      if (id === 'cow-highland-1') await fit(visitor, 'petting');
      await visitor.waitForFunction(id => !e.sharedActors.town.animals.find(a => a.id === id)?.owner, id, { timeout: 10000 });
      await visitor.waitForFunction(() => e.character.rotation.x === 0);
      check(true, `${id}: accepted six-second pet completes and resumes grazing`);
    }
    if (process.env.BUBBLES_ONLY === '1') {
      check(errors.length === 0, `No browser page errors (${errors.length})`);
      fs.writeFileSync(`${output}/browser-checks.json`, JSON.stringify({ scope: 'Accepted shared animal cream bubbles', checks, errors }, null, 2));
      console.log(`${checks.length} animal bubble browser checks passed.`); return;
    }
    if (process.env.ANIMAL_ONLY === '1') {
      await move(visitor, [-48, -26.4]); await move(observer, [-46.8, -26.5]);
      await visitor.waitForFunction(() => e.townContext?.actions.some(action => action.request.action === 'owlFood' && !action.disabled));
      await key(visitor, 'e'); await visitor.waitForFunction(() => e.gardenState.crumbPouch);
      await visitor.waitForFunction(() => e.townContext?.actions.some(action => action.request.action === 'owlFeed' && !action.disabled));
      await key(visitor, 'e');
      await observer.waitForFunction(() => e.sharedActors.town.owlUntil > Date.now());
      check(await observer.getByRole('button', { name: 'Owls are eating…' }).isDisabled(), 'One accepted owl meal holds the shared roost and refuses competing feeding');
      await visitor.waitForFunction(() => e.townScene.hearts.visible, null, { timeout: 8000 });
      await observer.waitForFunction(() => e.townScene.hearts.visible, null, { timeout: 2000 });
      const observed = await observer.evaluate(() => e.townScene.owls.map(owl => owl.root.position.toArray()));
      check(await visitor.evaluate(observed => e.townScene.owls.filter(owl => owl.speech.visible).length === 1 && e.townScene.owls.every((owl, index) => owl.root.position.y < 1 && owl.root.position.distanceTo({ x: observed[index][0], y: observed[index][1], z: observed[index][2] }) < .15), observed), 'Both real clients see the same tray landing, happy owl hearts and one readable Hoot Hoot response');
      const firstSpeaker = await visitor.evaluate(() => e.townScene.owls.findIndex(owl => owl.speech.visible));
      await visitor.screenshot({ path: `${output}/owl-happy-hearts.png` });
      await visitor.emulateMedia({ reducedMotion: 'reduce' }); await visitor.waitForTimeout(180);
      const reducedOwlPose = await visitor.evaluate(() => e.townScene.owls.map(owl => [owl.head, ...owl.wings].flatMap(part => [...part.position.toArray(), ...part.quaternion.toArray()])));
      await visitor.waitForTimeout(120);
      check(await visitor.evaluate(poses => e.townScene.owls.every((owl, index) => owl.root.rotation.z === 0
        && [owl.head, ...owl.wings].flatMap(part => [...part.position.toArray(), ...part.quaternion.toArray()]).every((value, axis) => Math.abs(value - poses[index][axis]) < .000001)) && e.townScene.hearts.visible, reducedOwlPose), 'Reduced motion keeps owl meal hearts and suppresses flutter, bob and head gestures');
      await visitor.setViewportSize({ width: 1024, height: 640 }); await visitor.screenshot({ path: `${output}/owl-happy-small-window.png` });
      if (process.env.OWL_ONLY === '1') {
        const speakers = new Set([firstSpeaker]); let overlap = false;
        while (await visitor.evaluate(() => e.townScene.hearts.visible)) {
          const visible = await visitor.evaluate(() => e.townScene.owls.flatMap((owl, index) => owl.speech.visible ? [index] : []));
          overlap ||= visible.length > 1;
          visible.forEach(speaker => speakers.add(speaker));
          await visitor.waitForTimeout(180);
        }
        check(!overlap, 'Rendered owl responses stay readable with at most one speech sprite throughout the meal');
        check(speakers.size === 3, 'The real shared meal gives all three owls distinct speech turns');
      }
      check(errors.length === 0, `No animal browser page errors (${errors.length})`);
      fs.writeFileSync(`${output}/browser-checks.json`, JSON.stringify({ scope: 'Shared animal/pond/owl rendering and petting', checks, errors }, null, 2));
      console.log(`${checks.length} animal browser checks passed.`); return;
    }
    let empty;
    if (!raceOnly) {
      await orchardAndTreats(visitor, observer);
      empty = await visitor.evaluate(() => {
        const b = e.sharedActors.town.beds.find(b => b.crop === null), item = e.world.authored.items.find(i => i.id === b.id);
        return { id: b.id, point: [item.position[0] + 7.6, item.position[2] + 1.3] };
      });
      await move(visitor, empty.point); await move(observer, empty.point);
      await visitor.waitForFunction(id => e.townContext?.actions.some(a => a.request.id === id && a.request.action === 'gardenPlant'), empty.id);
      await fit(visitor, 'planting');
      await key(visitor, '2');
      await observer.waitForFunction(id => e.sharedActors.town.beds.find(b => b.id === id)?.crop === 'radish', empty.id);
      check(true, 'Real 2 key plants radishes at a row end; observer receives the same accepted row');
      await visitor.waitForTimeout(150);
      await visitor.getByRole('button', { name: 'Water', exact: true }).click();
      await observer.waitForFunction(id => e.sharedActors.town.beds.find(b => b.id === id)?.growAt !== null, empty.id);
      check(true, 'Water click starts the shared three-minute crop clock');
      await visitor.bringToFront();
      await visitor.waitForFunction(id => e.townContext?.growth?.readyAt === e.sharedActors.town.beds.find(b => b.id === id)?.growAt
        && e.townContext.growth.readyAt !== null, empty.id);
      await visitor.locator('.v-farm-progress [role="timer"]').waitFor();
      await visitor.waitForFunction(id => e.townScene.clocks.find(clock => clock.row.id === id)?.sprite.visible, empty.id);
      check(await visitor.evaluate(id => {
        const bed = e.sharedActors.town.beds.find(b => b.id === id), clock = e.townScene.clocks.find(clock => clock.row.id === id);
        const remaining = Math.max(0, Math.ceil((bed.growAt - Date.now()) / 1000));
        const text = document.querySelector('.v-farm-progress [role="timer"]')?.textContent;
        const shown = text?.split(':').map(Number);
        return clock?.sprite.visible && shown?.length === 2 && Math.abs(shown[0] * 60 + shown[1] - remaining) <= 1;
      }, empty.id), 'Farm progress has an accepted countdown in the top HUD and an in-world row timer');
      await visitor.screenshot({ path: `${output}/farm-growth.png` });
      await fit(visitor, 'farm-growth');
      const ripe = await visitor.evaluate(() => {
        const b = e.sharedActors.town.beds.find(b => b.growAt !== null && b.growAt <= Date.now());
        const item = e.world.authored.items.find(i => i.id === b.id);
        const inventoryKey = { carrot: 'carrots', radish: 'radishes', mint: 'mint' }[b.crop];
        return { id: b.id, point: [item.position[0] + 7.6, item.position[2] + 1.3], inventoryKey,
          count: e.forageInventory[inventoryKey] || 0, stores: Object.values(e.sharedActors.town.harvest).reduce((a,b)=>a+b,0) };
      });
      await move(visitor, ripe.point); await key(visitor, 'e');
      await visitor.waitForFunction(id => e.sharedActors.town.beds.find(b => b.id === id)?.crop === null, ripe.id);
      await observer.waitForFunction(stores => Object.values(e.sharedActors.town.harvest).reduce((a,b)=>a+b,0) === stores + 1, ripe.stores);
      check(await visitor.evaluate(([key, count]) => e.forageInventory[key] === count + 1, [ripe.inventoryKey, ripe.count])
        && await observer.evaluate(key => !e.forageInventory[key], ripe.inventoryKey), 'Harvest clears one shared row and grants its crop only to the accepting visitor’s private basket');
      await visitor.bringToFront();
      const retryState = await visitor.evaluate(() => {
        window.retryEngine = e;
        return { id: e.sharedSelfId, sockets: testSockets.length, inventory: { ...e.forageInventory }, updates: testInventoryUpdates };
      });
      check(await visitor.evaluate(() => {
        const extension = e.renderer.getContext().getExtension('WEBGL_lose_context');
        if (!extension) return false;
        extension.loseContext(); return true;
      }), 'The actual WebGL context can be interrupted for the village recovery check');
      await visitor.getByRole('button', { name: 'Retry the village', exact: true }).click();
      await readyEngine(visitor, true);
      check(await visitor.evaluate(previous => e !== window.retryEngine && e.sharedSelfId === previous.id && testSockets.length === previous.sockets
        && Object.keys(previous.inventory).length === 8 && Object.entries(previous.inventory).every(([key, count]) => e.forageInventory[key] === count)
        && testInventoryUpdates === previous.updates, retryState), 'Retry restores all eight accepted basket counters in a new engine using the same user/socket and no new inventory grant');
      await move(visitor, [-48,-26.4]); await move(observer, [-46.8,-26.5]);
      await key(visitor, 'e');
      await visitor.waitForFunction(() => e.gardenState.crumbPouch);
      await visitor.waitForFunction(() => e.townContext?.actions.some(a => a.request.action === 'owlFeed'));
      await visitor.waitForTimeout(100);
      await key(visitor, 'e');
      await observer.waitForFunction(() => e.sharedActors.town.owlUntil > Date.now());
      await observer.bringToFront();
      check(await observer.getByRole('button', { name: 'Owls are eating…' }).isDisabled(), 'E takes treats then starts one shared owl meal; competing control is disabled');
      await visitor.bringToFront(); await visitor.waitForTimeout(2400);
      check(await visitor.evaluate(() => e.townScene.owls.every(o => o.root.position.y < 1)), 'All three original Blender owls fly down to the actual feeding tray');
      await visitor.screenshot({ path: `${output}/owl-feeding.png` });
      const stableHorse = await visitor.evaluate(() => {
        const stable = e.world.authored.items.find(item => item.asset === 'horse-stable' && item.visible);
        const yaw = stable.rotation[1] * Math.PI / 180;
        const anchor = [stable.position[0] - Math.sin(yaw) * 2 * stable.scale[2], stable.position[2] - Math.cos(yaw) * 2 * stable.scale[2]];
        const h = e.sharedActors.actors.find(actor => actor.kind === 'horse' && !actor.owner && actor.mode === 'idle'
          && Math.hypot(actor.x + 1.5 - anchor[0], actor.z - .3 - anchor[1]) < 7);
        if (!h) throw Error('No idle horse is currently available at the actual stable hay approach.');
        return { id: h.id, point: [h.x + 1.5, h.z - .3] };
      });
      await move(visitor, stableHorse.point, Math.PI,.3); await move(observer, [stableHorse.point[0]-.6,stableHorse.point[1]-.3]);
      await visitor.waitForFunction(id => e.nearHorse?.id === id && e.townContext?.actions.some(a => a.request.action === 'hay'), stableHorse.id);
      await key(visitor, 'f');
      await observer.waitForFunction(id => e.sharedActors.town.hayFeeds.some(f => f.horseId === id && f.until > Date.now()), stableHorse.id);
      await observer.bringToFront();
      check(await observer.locator('.v-horse-controls > .v-interact').isDisabled(), 'F feeds stable hay; occupied meal refuses mounting');
      await visitor.bringToFront(); await visitor.screenshot({ path: `${output}/hay-feeding.png` });
      await fit(visitor, 'stable');
      await visitor.waitForFunction(id => e.sharedActors.actors.find(a => a.id === id)?.mode !== 'hold', stableHorse.id, { timeout: 16000 });
      await visitor.getByRole('button', { name: 'Ride', exact: true }).click();
      await visitor.waitForFunction(() => !!e.horseRiding.actor);
    } else {
      empty = await visitor.evaluate(() => {
        const b = e.sharedActors.town.beds.find(bed => bed.crop && bed.growAt !== null);
        const item = e.world.authored.items.find(item => item.id === b.id);
        return { id: b.id, point: [item.position[0] + 7.6, item.position[2] + 1.3] };
      });
      const horse = await visitor.evaluate(() => {
        const placements = e.world.authored.horses.map(horse => horse.id);
        const horses = e.sharedActors.actors.filter(actor => placements.includes(actor.id) && !actor.owner && actor.mode === 'idle')
          .sort((a, b) => Math.hypot(a.x - 85, a.z - 34) - Math.hypot(b.x - 85, b.z - 34));
        for (const horse of horses) {
          const options = [1.55, 2.2].flatMap(radius => Array.from({ length: 32 }, (_, i) => [horse.x + Math.sin(i * Math.PI / 16) * radius, horse.z + Math.cos(i * Math.PI / 16) * radius]));
          const point = options.find(([x, z]) => e.movement.clear(x, z) && horses.every(other => other.id === horse.id
            || Math.hypot(other.x - x, other.z - z) > Math.hypot(horse.x - x, horse.z - z) + .1));
          if (point) return { id: horse.id, point };
        }
        throw Error('No idle horse has a physically clear mounting approach.');
      });
      await move(visitor, horse.point, Math.PI, .3);
      await visitor.waitForFunction(id => e.nearHorse?.id === id, horse.id);
      await visitor.getByRole('button', { name: 'Ride', exact: true }).click();
      await visitor.waitForFunction(() => !!e.horseRiding.actor);
    }
    await move(observer,[116,27]);
    if (await visitor.evaluate(() => Math.hypot(e.horseRiding.actor.x - 85, e.horseRiding.actor.z - 34) >= 6)) {
      await drive(visitor, [85,38.8], .9);
      await drive(visitor, [85,34], 5.5);
    }
    await visitor.waitForFunction(() => e.townContext?.actions.some(a => a.request.action === 'raceStart'));
    await key(visitor,'f');
    await observer.waitForFunction(() => e.sharedActors.town.race?.phase === 'countdown');
    await visitor.waitForFunction(() => Math.hypot(e.horseRiding.actor.x - 85, e.horseRiding.actor.z - 34) < .05
      && Math.abs(Math.atan2(Math.sin(e.horseRiding.actor.heading + Math.PI / 2), Math.cos(e.horseRiding.actor.heading + Math.PI / 2))) < .02);
    check(true,'Real F accepts the mounted horse in the stable-side start zone and aligns it to the actual ribbon for Rowan’s countdown');
    await visitor.bringToFront();
    await visitor.locator('.v-race-progress [role="timer"]').waitFor();
    check(await visitor.evaluate(() => {
      const hud = document.querySelector('.v-race-progress'), b = hud?.getBoundingClientRect();
      return b && Math.abs((b.x + b.width / 2) - innerWidth / 2) < 3 && b.top < 120 && b.bottom < innerHeight / 2;
    }), 'Race countdown occupies the top center without obscuring the horse');
    check(await visitor.evaluate(() => e.raceGuide?.group.visible), 'The accepted next checkpoint has a visible course marker');
    await visitor.waitForFunction(() => e.sharedActors.town.race?.phase === 'racing');
    await visitor.keyboard.down(' ');
    await visitor.waitForFunction(() => e.horseRiding.actor.speed < .05);
    await visitor.locator('.v-race-clock').waitFor();
    await visitor.screenshot({path:`${output}/racing.png`});
    await fit(visitor,'racing');
    await key(visitor,'f');
    await observer.waitForFunction(() => e.sharedActors.town.race?.phase === 'cancelled');
    await visitor.waitForFunction(() => e.sharedActors.town.race?.phase === 'cancelled');
    await visitor.keyboard.up(' ');
    check(await visitor.evaluate(()=>!!e.horseRiding.actor),'F leaves the race while retaining the accepted horse ride');
    if (process.env.HUD_ONLY === '1') {
      await key(visitor, 'Escape');
      await visitor.waitForFunction(() => !e.horseRiding.actor);
      check(true, 'Escape safely dismounts after cancelling the HUD review lap');
      check(errors.length === 0, `No HUD browser page errors (${errors.length})`);
      fs.writeFileSync(`${output}/hud-checks.json`, JSON.stringify({ scope: 'Final race HUD layout and accepted controls', checks, errors }, null, 2));
      console.log(`${checks.length} race HUD browser checks passed.`); return;
    }
    if (await visitor.evaluate(() => Math.hypot(e.horseRiding.actor.x - 85, e.horseRiding.actor.z - 34) >= 4.5))
      await drive(visitor,'startRibbon',1.4);
    await observer.bringToFront(); await observer.waitForFunction(() => e.sharedConnected);
    await visitor.waitForFunction(() => e.townContext?.actions.some(a => a.request.action === 'raceStart'));
    // The shared Worker throttles separate requests from one visitor to 80ms.
    await visitor.waitForTimeout(150);
    await key(visitor,'f');
    await visitor.waitForFunction(() => e.sharedActors.town.race?.phase === 'racing');
    await drive(visitor,'finishLap');
    await visitor.waitForFunction(() => e.sharedActors.town.race?.phase === 'finished');
    await observer.waitForFunction(() => e.sharedActors.town.race?.phase === 'finished');
    check(await visitor.evaluate(() => e.sharedActors.town.race.nextCheckpoint === 9 && !!e.sharedActors.town.race.playerFinishAt),
      'Actual horse keys complete every ordered checkpoint and one full lap');
    const result = await visitor.evaluate(() => e.sharedActors.town.race.result);
    check(await observer.evaluate(result => e.sharedActors.town.race.result === result,result),
      'Rider and observer receive the same completed race result');
    await key(visitor,'Escape');
    await visitor.waitForFunction(()=>!e.horseRiding.actor);
    check(true,'Escape safely dismounts after a race');
    await move(visitor, empty.point);
    await visitor.locator('.v-farm-progress [role="timer"]').waitFor();
    check(await visitor.locator('.v-race-progress').count() === 0, 'A completed race yields to the current farm timer when the rider returns to the fields');
    await visitor.screenshot({ path: `${output}/farm-after-race.png` });
    await approachAnimal(visitor,'cow-highland-2'); await key(visitor,'e');
    await visitor.waitForFunction(()=>e.sharedActors.town.animals.find(a=>a.id==='cow-highland-2')?.owner===e.sharedSelfId);
    await visitor.evaluate(()=>testSockets.at(-1).close(1000));
    await visitor.waitForFunction(()=>testSockets.length>1&&e.sharedConnected);
    await observer.waitForFunction(()=>!e.sharedActors.town.animals.find(a=>a.id==='cow-highland-2')?.owner);
    check(true,'Disconnect releases petting; reconnect receives accepted town state');
    check(errors.length===0,`No browser page errors (${errors.length})`);
    fs.writeFileSync(`${output}/browser-checks.json`,JSON.stringify({scope: raceOnly ? 'Accepted race controls, lap and farm transition' : 'Shared town activities', checks,errors},null,2));
    console.log(`${checks.length} town browser checks passed.`);
  } catch (error) {
    for (const [index, page] of pages.entries()) {
      console.error('Town client failure state', index + 1, JSON.stringify(await page.evaluate(() => window.e && ({
        horse: e.horseRiding.actor, pose: e.getPlayerPose(), race: e.sharedActors?.town?.race,
        context: e.townContext, connected: e.sharedConnected, blocked: e.blocked, keys: [...e.keys],
        replies: window.testMessages.slice(-8), sockets: window.testSockets.map(socket => ({ state: socket.readyState, url: socket.url })), closures: window.testSocketClosures,
      })).catch(() => null)));
      await page.screenshot({ path: `${output}/failed-client-${index + 1}.png` }).catch(() => {});
    }
    fs.writeFileSync(`${output}/failed-checks.json`, JSON.stringify({ checks, errors }, null, 2));
    throw error;
  } finally { await browser.close(); }
})().catch(error=>{ console.error(error); process.exitCode=1; });

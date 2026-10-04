// Real accepted/contested animal actions with two visible local clients; no Worker bypass.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  const checks = [], errors = [], pages = [];
  const check = (ok, label) => { assert(ok, label); checks.push(label); };
  try {
    for (let index = 0; index < 2; index++) {
      const page = await browser.newPage({ viewport: { width: 1366, height: 768 } }); pages.push(page);
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(() => {
        localStorage.setItem('cosy-village-preferences', JSON.stringify({ weather: 'golden', weatherMode: 'manual', mix: { music: 0, ambience: 0 } }));
        window.sockets = []; const Native = WebSocket;
        window.WebSocket = class extends Native { constructor(...args) { super(...args); window.sockets.push(this); } };
      });
      await page.goto(process.env.VILLAGE_URL || 'http://127.0.0.1:3051/');
      await page.getByRole('button', { name: 'Enter Hearthwillow', exact: true }).click({ timeout: 120000 });
      console.log('Entered audio client', index + 1);
      await page.waitForFunction(() => {
        for (let el = document.querySelector('canvas'); el; el = el.parentElement)
          for (let fiber = el[Object.keys(el).find(k => k.startsWith('__reactFiber'))]; fiber; fiber = fiber.return)
            for (const branch of [fiber, fiber.alternate]) for (let hook = branch?.memoizedState; hook; hook = hook.next) {
              const ref = hook.memoizedState?.current;
              if (ref?.townAnimals && ref?.setSharedActors) window.e = ref;
              if (ref?.gardenEffect && ref?.setMix) window.audio = ref;
              if (ref?.interact && ref?.sendChat) window.connection = ref;
            }
        return window.e?.sharedConnected && window.audio?.townAnimals?.buffers.size === 16 && window.connection;
      }, null, { timeout: 30000 });
      await page.evaluate(() => {
        e.setQuality('low'); window.calls = [];
        const play = audio.townAnimals.play.bind(audio.townAnimals);
        audio.townAnimals.play = (event, clip) => { const accepted = play(event, clip); calls.push({ ...event, accepted, at: performance.now() }); return accepted; };
      });
      const close = page.getByRole('button', { name: 'Close Hearthwillow chat', exact: true });
      if (await close.count()) await close.click();
    }
    const [a, b] = pages;
    async function approach(page, kind, id, side) {
      await page.bringToFront();
      const point = await page.evaluate(({ kind, id, side }) => {
        const actor = kind === 'animal' ? e.sharedActors.town.animals.find(a => a.id === id) : e.sharedActors.actors.find(a => a.id === id);
        const angles = Array.from({ length: 32 }, (_, i) => (i + side * 16) * Math.PI / 16);
        const options = [1.8, 2.2, 2.7].flatMap(radius => angles.map(angle => [actor.x + Math.sin(angle) * radius, actor.z + Math.cos(angle) * radius]));
        const p = options.find(([x, z]) => e.movement.clear(x, z));
        if (!p) throw Error('No clear approach');
        e.movement.settle(...p); return p;
      }, { kind, id, side });
      await page.waitForFunction(([x, z]) => Math.hypot(e.player.position.x - x, e.player.position.z - z) < .05, point);
      await page.waitForTimeout(750);
      await page.evaluate(() => { audio.townAnimals.stop(); calls.length = 0; });
    }
    const cow = await a.evaluate(() => e.sharedActors.town.animals.find(a => a.species === 'cow').id);
    await approach(a, 'animal', cow, 0); await approach(b, 'animal', cow, 1);
    await a.bringToFront();
    const pet = await a.evaluate(id => connection.interact({ kind: 'town', action: 'animalPet', id }), cow);
    check(pet.ok, 'The Worker accepts one nearby cow pet');
    for (const page of pages) {
      await page.bringToFront();
      await page.waitForFunction(() => calls.some(c => c.species === 'cow' && c.happy && c.accepted));
      check(await page.evaluate(() => calls.filter(c => c.species === 'cow' && c.happy && c.accepted).length === 1), 'A real client hears exactly one accepted cow response');
    }
    const denied = await b.evaluate(id => connection.interact({ kind: 'town', action: 'animalPet', id }), cow);
    check(!denied.ok, 'A competing cow pet is rejected');
    await b.waitForTimeout(800);
    check(await b.evaluate(() => calls.filter(c => c.species === 'cow' && c.happy).length === 1), 'The rejected pet does not produce a second success call');
    const old = await a.evaluate(() => { const id = e.sharedSelfId; sockets.at(-1).close(); return id; });
    await b.waitForFunction(id => !e.sharedActors.town.animals.find(a => a.id === id).owner, cow);
    check(true, 'Disconnect releases the pet claim');
    await a.waitForFunction(old => e.sharedConnected && e.sharedSelfId !== old, old, { timeout: 20000 });
    check(await a.evaluate(() => !calls.some(c => c.species === 'cow' && c.happy && c.at > performance.now() - 500)), 'Reconnect does not replay the old cow response');
    const horse = 'horse-willow'; // The authored stable's nearby feeding bay.
    await approach(a, 'horse', horse, 0); await approach(b, 'horse', horse, 1);
    await a.bringToFront();
    const hay = await a.evaluate(id => connection.interact({ kind: 'town', action: 'hay', id }), horse);
    check(hay.ok, `The Worker accepts one stable hay meal (${hay.reason || 'accepted'})`);
    for (const page of pages) {
      await page.bringToFront(); await page.waitForFunction(() => calls.some(c => c.species === 'horse' && c.happy && c.accepted));
      check(await page.evaluate(() => calls.filter(c => c.species === 'horse' && c.happy).length === 1), 'A real client hears the horse hay response once');
    }
    const duplicate = await b.evaluate(id => connection.interact({ kind: 'town', action: 'hay', id }), horse);
    check(!duplicate.ok, 'A competing hay request cannot restart the meal or its response');
    for (const page of pages) {
      await page.bringToFront();
      await page.getByRole('button', { name: 'Expand village map', exact: true }).click();
      await page.getByRole('button', { name: 'Focus cottage', exact: true }).click();
      await page.waitForFunction(() => e.currentPlace === 'focus');
    }
    check(await a.evaluate(() => audio.townAnimals.voice?.source.buffer !== audio.townAnimals.buffers.get('horse')) && await b.evaluate(() => audio.townAnimals.voice?.source.buffer !== audio.townAnimals.buffers.get('horse')), 'Simultaneous private focus clears both outdoor animal channels');
    assert.deepEqual(errors, []);
    fs.writeFileSync(process.env.OUTPUT || '/tmp/cosy-animal-audio-shared.json', JSON.stringify({ checks, pageErrors: errors }, null, 2));
    console.log(`${checks.length} real two-client animal audio checks passed.`);
  } catch (error) {
    for (const page of pages) console.error(await page.evaluate(() => ({ engine: !!window.e, connected: window.e?.sharedConnected, audio: !!window.audio,
      audioKeys: window.audio && Object.keys(window.audio), sounds: window.audio?.townAnimals?.buffers?.size,
      context: window.audio?.context?.state, connection: !!window.connection, text: document.body.innerText.slice(-1200) })).catch(() => null));
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });

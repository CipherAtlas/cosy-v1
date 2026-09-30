// Run against preview_qa.py with an existing Playwright installation.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:3054/');
    const checks = await page.evaluate(async () => {
      const { VillageEngine } = await import('/modules/features/village/VillageEngine.js');
      const { gardenAction } = await import('/modules/features/village/garden.js');
      const near = [], seats = [], scatters = [];
      const engine = new VillageEngine(document.querySelector('#scene'), {
        progress: () => {}, ready: () => {}, near: id => near.push(id),
        nearBench: id => near.push(id), seat: id => seats.push(id),
        interact: () => {}, error: message => { throw Error(message); },
        stats: () => {}, movement: () => {}, contact: () => {}, environment: () => {},
        scatterBirds: fromBench => {
          scatters.push(fromBench);
          if (fromBench) engine.setGarden(gardenAction(engine.gardenState, { kind: 'birdCrumbs' }));
          engine.gardenAction({ kind: 'feedBirds' });
        },
      });
      try {
        await engine.load(); engine.setBlocked(false);
        const tick = () => engine.frame(performance.now());
        const benches = [];
        for (const bench of engine.world.benches) {
          const x = bench.x + Math.sin(bench.facing) * 1.35;
          const z = bench.z + Math.cos(bench.facing) * 1.35;
          engine.movement.settle(x, z); tick();
          if (engine.nearBench?.id !== bench.id) throw Error(`${bench.id}: Sit is not offered nearby`);
          const point = offset => ({ x: bench.x + Math.cos(bench.facing) * offset, z: bench.z - Math.sin(bench.facing) * offset });
          const left = point(-.68), right = point(.68);
          engine.setRemoteVisitors([{ id: 'other', name: 'Other', color: '#a4d5ae', slot: 1, ...right, heading: bench.facing }]);
          engine.sit(bench.id); tick();
          if (engine.seatedBench?.id !== bench.id || Math.hypot(engine.player.position.x - left.x, engine.player.position.z - left.z) > .01)
            throw Error(`${bench.id}: player did not take the empty left seat`);
          if (Math.hypot(engine.player.position.x - right.x, engine.player.position.z - right.z) < 1.3)
            throw Error(`${bench.id}: visitors overlap on the bench`);
          engine.onKeyDown(new KeyboardEvent('keydown', { key: 'e', bubbles: true })); tick();
          if (engine.seatedBench) throw Error(`${bench.id}: E did not stand up`);
          if (!engine.movement.clear(engine.movement.position.x, engine.movement.position.z))
            throw Error(`${bench.id}: standing exits into a collider`);
          engine.setRemoteVisitors([{ id: 'other', name: 'Other', color: '#a4d5ae', slot: 1, ...left, heading: bench.facing }]);
          engine.sit(bench.id); tick();
          if (Math.hypot(engine.player.position.x - right.x, engine.player.position.z - right.z) > .01)
            throw Error(`${bench.id}: player did not take the empty right seat`);
          engine.stand(); tick();
          engine.setRemoteVisitors([
            { id: 'other', name: 'Other', color: '#a4d5ae', slot: 1, ...left, heading: bench.facing },
            { id: 'third', name: 'Third', color: '#b0c8e3', slot: 2, ...right, heading: bench.facing },
          ]);
          engine.sit(bench.id); tick();
          const stacked = engine.sharedSlot !== null && engine.sharedSlot % 2 === 1 ? right : left;
          if (engine.seatedBench?.id !== bench.id || Math.hypot(engine.player.position.x - stacked.x, engine.player.position.z - stacked.z) > .01)
            throw Error(`${bench.id}: a third visitor could not share an occupied seat`);
          engine.stand(); tick();
          if (bench === engine.world.benches[0]) {
            engine.setRemoteVisitors([]);
            engine.setSharedIdentity(2, '#e6a5b0');
            engine.sit(bench.id); tick();
            engine.setRemoteVisitors([{ id: 'other', name: 'Other', color: '#a4d5ae', slot: 0, ...left, heading: bench.facing }]);
            tick();
            if (Math.hypot(engine.player.position.x - right.x, engine.player.position.z - right.z) > .01)
              throw Error('Simultaneous arrivals did not resolve to separate seats');
            engine.stand(); tick();
            engine.setRemoteVisitors([{ id: 'older-client', name: 'Older client', color: '#a4d5ae', slot: 3, x: bench.x, z: bench.z, heading: bench.facing }]);
            engine.sit(bench.id); tick();
            if (engine.seatedBench?.id !== bench.id) throw Error('A centered visitor prevented shared seating');
            engine.stand(); tick();
            engine.setRemoteVisitors([]);
            engine.sit(bench.id); tick();
            engine.setRemoteVisitors([{ id: 'older-client', name: 'Older client', color: '#a4d5ae', slot: 3, x: bench.x, z: bench.z, heading: bench.facing }]);
            tick();
            if (engine.seatedBench?.id !== bench.id) throw Error('A newly arrived centered visitor made the player stand');
            engine.stand(); tick();
          }
          engine.setRemoteVisitors([]);
          benches.push(bench.id);
        }
        engine.travel('focus'); tick();
        engine.setRemoteVisitors([{ id: 'focus-visitor', name: 'Focus visitor', color: '#a4d5ae', slot: 1, x: 108.65, z: -.65, heading: Math.PI }]);
        if (engine.remoteVisitors.get('focus-visitor')?.group.visible) throw Error('Another visitor appeared inside the private focus cottage');
        engine.setPlace(null); tick();
        if (!engine.remoteVisitors.get('focus-visitor')?.group.visible) throw Error('Visitor stayed hidden after leaving focus');
        engine.setRemoteVisitors([]);
        engine.travel('music'); tick();
        engine.setRemoteVisitors([{ id: 'music-visitor', name: 'Music visitor', color: '#a4d5ae', slot: 1, x: -5.8, z: -16.1, heading: Math.PI }]);
        if (!engine.remoteVisitors.get('music-visitor')?.group.visible) throw Error('Overlapping visitors were hidden at the hearth');
        engine.setRemoteVisitors([]); engine.setPlace(null); tick();
        engine.movement.settle(-37, 4); tick();
        if (engine.near !== 'birds') throw Error('Bird clearing does not offer nearby scattering');
        if (engine.gardenState.crumbPouch) throw Error('Test expected no crumb pouch');
        if (engine.gardenAction({ kind: 'feedBirds' })) throw Error('Scattering should wait for an NPC pouch');
        const birdBench = engine.world.benches.find(value => value.birdClearing);
        engine.movement.settle(birdBench.x, birdBench.z + 1.35); tick(); engine.sit(birdBench.id); tick();
        engine.onKeyDown(new KeyboardEvent('keydown', { key: 'f' }));
        if (scatters.length !== 1 || scatters[0] !== true || engine.birds.status !== 'crumbs' || !engine.sittingAtBirdBench)
          throw Error('Seated F should feed from the bench supply and keep the spirit seated');
        if (engine.gardenAction({ kind: 'feedBirds' })) throw Error('Repeat feeding should wait for the flock');
        engine.onKeyDown(new KeyboardEvent('keydown', { key: 'e' })); tick();
        if (engine.sittingAtBirdBench) throw Error('E should still stand up after scattering');
        engine.movement.settle(24.6, -2.7); tick();
        if (engine.near === 'garden') throw Error('Walking into the kitchen garden still offers a scene transition');
        return { benches, nearBirds: true, standingRequiresPouch: true, seatedFUsesSupply: true, noGardenTransition: true, simultaneousSeatResolved: true, overflowStacks: true, focusPrivate: true, sharedActivityVisible: true, seatEvents: seats.length, nearEvents: near.length };
      } finally { engine.dispose(); }
    });
    if (errors.length) throw Error(errors.join('\n'));
    console.log(JSON.stringify({ pass: true, ...checks }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

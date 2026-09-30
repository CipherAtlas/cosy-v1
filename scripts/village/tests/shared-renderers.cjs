const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:3067');
    const checks = await page.evaluate(async () => {
      const { VillageEngine } = await import('/modules/features/village/VillageEngine.js');
      const { GardenScene } = await import('/modules/features/village/gardenScene.js');
      const checks = [], check = (ok, label) => { if (!ok) throw Error(label); checks.push(label); };
      const engine = new VillageEngine(document.querySelector('#scene'), { progress() {}, ready() {}, near() {}, interact() {},
        error(message) { throw Error(message); }, stats() {}, movement() {}, contact() {}, environment() {} });
      await engine.load(); engine.setQuality('low');
      const gardens = [engine.garden, new GardenScene(engine.garden.source, [], () => {}, engine.world.gardenSurfaces)];
      const nativeNow = Date.now; let now = 150000; Date.now = () => now;
      try {
        for (const phase of [0, 1500, 6000, 11500, 16000, 30000]) {
          now = 150000 + phase;
          gardens.forEach(garden => garden.syncShared(now, 100000, 150000));
          gardens[0].update(.1, 1000, false); gardens[1].update(0, 0, false);
          check(gardens[0].birds.every((bird, index) => bird.root.position.distanceTo(gardens[1].birds[index].root.position) < 1e-8),
            `Late pond arrivals share the same duck positions at ${phase} ms`);
          const positions = gardens[0].birds.map(bird => bird.root.position.clone());
          gardens[1].update(.01, 0, true);
          check(gardens[1].birds.every((bird, index) => Math.hypot(bird.root.position.x - positions[index].x, bird.root.position.z - positions[index].z) < 1e-8),
            `Reduced motion preserves the shared duck path at ${phase} ms`);
        }
        const moment = engine.activities.moment;
        engine.gardenAction({ kind: 'drink' }, { x: 15, z: -10 }, false);
        check(engine.activities.moment === moment, 'Another visitor\'s tea does not overwrite the private focus timer');
        const id = engine.puppies.puppies[0].info.id;
        const dog = engine.puppies.puppies[0], origin = dog.actor.position.clone();
        const shared = { id, kind: 'puppy', x: origin.x, y: origin.y, z: origin.z, heading: 0, speed: 0,
          owner: 'owner', following: true, mode: 'hold', action: null, startedAt: now, until: now + 3000, speech: null };
        engine.puppies.applyShared([shared], 'observer', now);
        engine.puppies.setInteraction(id); engine.puppies.update(.1, 2000, origin.clone().addScalar(1), false, true);
        check(dog.actor.position.distanceTo(origin) < 1e-8 && !engine.puppies.followers.length, 'Observer input cannot move a held dog or take its walking pack');
        engine.puppies.applyShared([{ ...shared, mode: 'pet' }], 'observer', now);
        check(dog.petting && !engine.puppies.pettingPuppy, 'Shared petting animates the dog without taking over an observer\'s camera');
        engine.puppies.applyShared([{ ...shared, mode: 'follow' }], 'owner', now);
        check(engine.puppies.followers.some(dog => dog.id === id), 'Walking packs are derived from authoritative ownership');
        const resident = engine.life.residents[0], residentPose = resident.root.position.clone();
        engine.life.applyShared([{ ...shared, kind: 'resident', id: 'pip', x: residentPose.x, y: residentPose.y, z: residentPose.z,
          mode: 'talk', following: false, speech: { en: 'Hello', ja: 'こんにちは' } }], 'observer');
        engine.life.setCompanions(['pip']); engine.life.update(.1, 2000, residentPose.clone().addScalar(1), false, true);
        check(resident.root.position.distanceTo(residentPose) < 1e-8 && !resident.following, 'Local invitations cannot take or move another visitor\'s talking resident');
        check(!engine.life.available('pip'), 'Busy resident controls use shared ownership');
        const taskState = { ...shared, kind: 'resident', id: 'pip', x: residentPose.x, y: residentPose.y, z: residentPose.z,
          mode: 'activity', following: false, activity: 'mood', gesture: { kind: 'tea', at: now - 1000 } };
        engine.life.applyShared([taskState], 'observer', now); engine.life.update(.1, 2000, residentPose, false, true);
        check(resident.cup.visible && resident.cup.position.y > 1, 'Observers see the accepted companion tea gesture on the world clock');
        engine.life.applyShared([{ ...taskState, activity: 'garden', gesture: { kind: 'water', at: now - 1000 } }], 'observer', now);
        engine.life.update(.1, 2000, residentPose, false, true);
        check(resident.wateringCan?.visible, 'Observers see the accepted companion watering gesture');
        now += 3000; engine.life.update(.1, 2003, residentPose, false, true);
        check(!resident.wateringCan.visible, 'Shared companion task props clear when the accepted gesture ends');
        return checks;
      } finally { Date.now = nativeNow; gardens[1].dispose(); engine.dispose(); }
    });
    if (errors.length) throw Error(errors.join('\n'));
    if (process.env.OUTPUT_FILE) fs.writeFileSync(process.env.OUTPUT_FILE, JSON.stringify({ checks, errors }, null, 2) + '\n');
    console.log(`${checks.length} shared renderer checks passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

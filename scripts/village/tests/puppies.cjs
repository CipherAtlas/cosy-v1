// Focused local preview check for puppy patrols, companions, petting and recorded yips.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const output = process.env.OUTPUT_DIR || '/tmp/cosy-puppies';
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  try {
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:3051/');
    const result = await page.evaluate(async () => {
      const T = await import('three');
      const { VillageEngine } = await import('/modules/features/village/VillageEngine.js');
      const { VillageAudio } = await import('/modules/features/village/audio.js');
      const { DEFAULT_MIX } = await import('/modules/features/village/places.js');
      const checks = [], check = (valid, label) => { if (!valid) throw Error(label); checks.push(label); };
      const sounds = [], near = [], petted = [], following = [], noop = () => {};
      document.body.innerHTML = '<div class="village"><div id="scene" style="position:fixed;inset:0"></div></div>';
      const engine = window.engine = new VillageEngine(document.querySelector('#scene'), {
        progress: noop, ready: noop, near: noop, interact: noop, movement: noop, contact: noop,
        environment: noop, stats: noop, error: message => { throw Error(message); },
        nearPuppy: puppy => near.push(puppy?.id ?? null), puppyPetted: puppy => petted.push(puppy.id),
        puppyFollowing: puppy => following.push(puppy?.id ?? null),
        puppySound: (...args) => sounds.push(args),
      });
      await engine.load(); engine.setQuality('low'); engine.setBlocked(false); engine.renderer.setAnimationLoop(null);
      const pack = engine.puppies;
      check(pack.puppies.length === 4, 'Four Blender puppies load from the playable layout');
      for (const puppy of pack.puppies) {
        check(puppy.head && puppy.ears.length === 2 && puppy.legs.length === 4 && puppy.tail, `${puppy.info.name} has animated pivots`);
        check(puppy.movement.clear(puppy.actor.position.x, puppy.actor.position.z), `${puppy.info.name} begins on safe ground`);
        check(puppy.route.length > 1 && puppy.route.every(([x, z]) => puppy.movement.clear(x, z)), `${puppy.info.name} has a safe local patrol`);
        const bounds = new T.Box3().setFromObject(puppy.actor), size = bounds.getSize(new T.Vector3());
        check(size.x > .5 && size.x < 2 && size.y > .5 && size.y < 2, `${puppy.info.name} retains a readable scale`);
      }
      const initial = pack.puppies.map(p => p.actor.position.clone());
      const player = new T.Vector3(0, 0, 38);
      for (let frame = 0; frame < 60 * 35; frame++) {
        pack.update(1 / 60, frame / 60, player, false, true);
        if (frame % 30 === 0) for (const puppy of pack.puppies)
          check(puppy.movement.clear(puppy.actor.position.x, puppy.actor.position.z), `${puppy.info.name} stays on walkable ground at ${frame / 60}s`);
      }
      check(pack.puppies.some((puppy, index) => puppy.actor.position.distanceTo(initial[index]) > .5), 'Puppies wander after resting at their familiar spots');
      const mochi = pack.puppies.find(p => p.info.name === 'Mochi');
      engine.movement.settle(mochi.actor.position.x + 1.1, mochi.actor.position.z);
      engine.player.position.copy(engine.movement.position);
      check(pack.nearest(engine.player.position)?.id === mochi.info.id, 'Near puppy is discoverable');
      check(engine.petPuppy(mochi.info.id), 'Petting starts at close range');
      check(!engine.petPuppy(mochi.info.id), 'Petting cannot restart during its animation');
      check(petted.length === 1 && sounds.at(-1)[0] === 'corgi' && sounds.at(-1)[2] === 'happy', 'Petting announces and plays Mochi’s happy yips');
      pack.update(.5, 36, engine.player.position, false, true);
      check(mochi.tail.rotation.y !== 0 && mochi.hearts.some(h => h.visible), 'Happy puppy wags and shows affection');
      pack.update(.1, 36.1, engine.player.position, true, true);
      check(mochi.tail.rotation.y === 0 && mochi.hearts.every(h => !h.visible), 'Reduced motion calms wagging and floating hearts');
      pack.update(3, 39.1, engine.player.position, false, true);
      engine.movement.settle(mochi.actor.position.x + 1.1, mochi.actor.position.z);
      engine.player.position.copy(engine.movement.position);
      engine.player.rotation.y = Math.PI;
      check(engine.togglePuppyFollow(mochi.info.id), 'Mochi can be invited at close range');
      check(pack.follower?.id === mochi.info.id && following.at(-1) === mochi.info.id, 'Invitation identifies the single walking companion');
      const firstFollowerPoint = mochi.actor.position.clone();
      for (let frame = 0; frame < 300; frame++) {
        engine.player.position.z -= .018;
        pack.update(1 / 60, 40 + frame / 60, engine.player.position, false, true, undefined, Math.PI);
        if (frame % 30 === 0) check(mochi.movement.clear(mochi.actor.position.x, mochi.actor.position.z),
          `Mochi follows on safe ground at ${frame / 60}s`);
      }
      check(mochi.actor.position.distanceTo(firstFollowerPoint) > 2, 'Invited puppy leaves its familiar spot to follow');
      check(mochi.actor.position.distanceTo(engine.player.position) < 4, 'Mochi keeps up behind a walking spirit');
      const pausedPoint = mochi.actor.position.clone();
      pack.update(.5, 45, engine.player.position, false, false, undefined, Math.PI);
      check(mochi.actor.position.distanceTo(pausedPoint) < .01, 'Puppy waits while exploration is paused');
      engine.player.position.set(3, 0, -12);
      for (let frame = 0; frame < 300; frame++)
        pack.update(1 / 60, 46 + frame / 60, engine.player.position, false, true, undefined, Math.PI);
      check(mochi.actor.position.distanceTo(engine.player.position) < 4 &&
        mochi.movement.clear(mochi.actor.position.x, mochi.actor.position.z), 'Distant companion safely catches up after travel');
      const kiko = pack.puppies.find(p => p.info.name === 'Kiko');
      engine.player.position.set(kiko.actor.position.x + 1.1, 0, kiko.actor.position.z);
      check(engine.togglePuppyFollow(kiko.info.id), 'A nearby second puppy can take the companion role');
      check(pack.follower?.id === kiko.info.id && following.at(-1) === kiko.info.id, 'Switching releases the previous companion');
      engine.movement.settle(0, 30); engine.player.position.copy(engine.movement.position);
      for (let frame = 0; frame < 3600; frame++)
        pack.update(1 / 60, 51 + frame / 60, engine.player.position, false, true, undefined, Math.PI);
      const homeGap = Math.hypot(mochi.actor.position.x - mochi.route[0][0], mochi.actor.position.z - mochi.route[0][1]);
      check(homeGap < 5, 'Released puppy returns toward its familiar patrol');
      check(mochi.movement.clear(mochi.actor.position.x, mochi.actor.position.z), 'Returning puppy stays on walkable ground');
      check(!engine.petPuppy(mochi.info.id), 'Petting is rejected from a distance');
      engine.setPlace('focus'); check(!pack.group.visible, 'Puppies stay out of the private focus room');
      engine.setPlace(null); check(pack.group.visible, 'Puppies return with the outdoor world');
      check(pack.follower?.id === kiko.info.id, 'Companion invitation survives an activity visit');
      check(engine.sendPuppyHome() && !pack.follower && following.at(-1) === null, 'Send home dismisses the companion from anywhere');
      const audio = new VillageAudio();
      audio.setMix({ ...DEFAULT_MIX, music: 0 });
      await audio.start();
      check(audio.puppySounds.size === 4, 'All four short recorded yips decode after sound activation');
      audio.puppyEffect('corgi', [0, 1, 30], 'happy');
      check(audio.voices.size >= 2, 'Happy response schedules two bounded spatial yips');
      audio.setMix({ ...DEFAULT_MIX, music: 0, effects: 0 });
      const voices = audio.voices.size; audio.puppyEffect('beagle', [0, 1, 30], 'bark');
      check(audio.voices.size === voices, 'Effects mute suppresses barks');
      audio.dispose();
      engine.movement.settle(mochi.actor.position.x + 1.2, mochi.actor.position.z + 2.1);
      engine.player.position.copy(engine.movement.position);
      engine.camera.position.set(mochi.actor.position.x + 1.8, 1.8, mochi.actor.position.z + 3.7);
      engine.camera.lookAt(mochi.actor.position.x, .55, mochi.actor.position.z);
      engine.camera.updateMatrixWorld(); engine.renderer.render(engine.scene, engine.camera);
      return { checks, puppies: pack.puppies.map(p => ({ name: p.info.name, route: p.route, position: p.actor.position.toArray() })), sounds: sounds.length, near: near.length };
    });
    await page.screenshot({ path: path.join(output, 'mochi-in-village.png') });
    if (errors.length) throw Error(errors.join('\n'));
    fs.writeFileSync(path.join(output, 'puppy-checks.json'), JSON.stringify(result, null, 2));
    console.log(`${result.checks.length} puppy checks passed`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });

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
      const sounds = [], near = [], petted = [], following = [], commanded = [], noop = () => {};
      document.body.innerHTML = '<div class="village"><div id="scene" style="position:fixed;inset:0"></div></div>';
      const engine = window.engine = new VillageEngine(document.querySelector('#scene'), {
        progress: noop, ready: noop, near: noop, interact: noop, movement: noop, contact: noop,
        environment: noop, stats: noop, error: message => { throw Error(message); },
        nearPuppy: puppy => near.push(puppy?.id ?? null), puppyPetted: puppy => petted.push(puppy.id),
        puppyCommanded: (puppy, command) => commanded.push([puppy.id, command]),
        puppyFollowing: puppies => following.push(puppies.map(puppy => puppy.id)),
        puppySound: (...args) => sounds.push(args),
      });
      await engine.load(); engine.setQuality('low'); engine.setBlocked(false); engine.renderer.setAnimationLoop(null);
      const pack = engine.puppies;
      check(pack.puppies.length === 6, 'Six Blender puppies load from the playable layout');
      for (const puppy of pack.puppies) {
        check(puppy.body && puppy.head && puppy.ears.length === 2 && puppy.legs.length === 4 && puppy.tail, `${puppy.info.name} has animated pivots`);
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
      check(petted.length === 1 && !mochi.petting, 'Pet request waits for the dog to face the hand');
      for (let frame = 0; frame < 240 && !mochi.petting; frame++) pack.update(1 / 60, 36 + frame / 60, engine.player.position, false, true);
      check(mochi.petting && sounds.at(-1)[0] === 'corgi' && sounds.at(-1)[2] === 'happy', 'Contact starts Mochi’s happy response');
      for (let frame = 0; frame < 30; frame++) pack.update(1 / 60, 40 + frame / 60, engine.player.position, false, true);
      check(mochi.animation.actions.pet.getEffectiveWeight() > .9 && mochi.hearts.some(h => h.visible), 'Happy puppy plays its skinned pet response and shows affection');
      pack.update(.1, 36.1, engine.player.position, true, true);
      check(mochi.animation.actions.pet.paused && mochi.hearts.every(h => !h.visible), 'Reduced motion freezes the pet pose and hides floating hearts');
      pack.update(3, 39.1, engine.player.position, false, true);
      engine.movement.settle(mochi.actor.position.x + 1.1, mochi.actor.position.z);
      engine.player.position.copy(engine.movement.position);
      engine.player.rotation.y = Math.PI;
      check(engine.togglePuppyFollow(mochi.info.id), 'Mochi can be invited at close range');
      check(pack.followers.some(p => p.id === mochi.info.id) && following.at(-1).includes(mochi.info.id), 'Invitation identifies the walking dog');
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
      for (let frame = 0; frame < 900; frame++)
        pack.update(1 / 60, 46 + frame / 60, engine.player.position, false, true, undefined, Math.PI);
      check(mochi.actor.position.distanceTo(engine.player.position) < 4 &&
        mochi.movement.clear(mochi.actor.position.x, mochi.actor.position.z), 'Distant companion safely catches up after travel');
      const kiko = pack.puppies.find(p => p.info.name === 'Kiko');
      engine.player.position.set(kiko.actor.position.x + 1.1, 0, kiko.actor.position.z);
      check(engine.togglePuppyFollow(kiko.info.id), 'A nearby second puppy can join the walk');
      check(pack.followers.length === 2 && following.at(-1).includes(kiko.info.id), 'A second invitation keeps both dogs walking together');
      check(engine.togglePuppyFollow(mochi.info.id) && pack.followers.length === 1, 'One dog can go home without dismissing the other');
      engine.movement.settle(0, 30); engine.player.position.copy(engine.movement.position);
      for (let frame = 0; frame < 3600; frame++)
        pack.update(1 / 60, 51 + frame / 60, engine.player.position, false, true, undefined, Math.PI);
      const homeGap = Math.hypot(mochi.actor.position.x - mochi.route[0][0], mochi.actor.position.z - mochi.route[0][1]);
      check(homeGap < 5, 'Released puppy returns toward its familiar patrol');
      check(mochi.movement.clear(mochi.actor.position.x, mochi.actor.position.z), 'Returning puppy stays on walkable ground');
      check(!engine.petPuppy(mochi.info.id), 'Petting is rejected from a distance');
      engine.setPlace('focus'); check(!pack.group.visible, 'Puppies stay out of the private focus room');
      engine.setPlace(null); check(pack.group.visible, 'Puppies return with the outdoor world');
      check(pack.followers.some(p => p.id === kiko.info.id), 'Companion invitation survives an activity visit');
      check(engine.sendPuppyHome() && !pack.followers.length && following.at(-1).length === 0, 'Send home dismisses the companion from anywhere');
      engine.player.position.set(mochi.actor.position.x + 1.1, 0, mochi.actor.position.z);
      check(engine.commandPuppy(mochi.info.id, 'sit'), 'Nearby Sit command starts');
      for (let frame = 0; frame < 40; frame++) pack.update(1 / 60, 112 + frame / 60, engine.player.position, false, true);
      const paw = (label) => mochi.model.getObjectByName('MochiPaw' + label).getWorldPosition(new T.Vector3());
      const bodyHeight = () => mochi.body.getWorldPosition(new T.Vector3()).y - mochi.actor.position.y;
      const headHeight = () => mochi.head.getWorldPosition(new T.Vector3()).y - mochi.actor.position.y;
      check(mochi.command === 'sit' && bodyHeight() < .34, 'Sit lowers the haunches into a visible seated pose');
      check(engine.commandPuppy(mochi.info.id, 'dance'), 'Dance can replace Sit without blocking input');
      for (let frame = 0; frame < 40; frame++) pack.update(1 / 60, 113 + frame / 60, engine.player.position, false, true);
      check(paw('FrontLeft').y - paw('BackLeft').y > .35 && headHeight() > 1,
        'Dance stands on the back paws with both front paws raised');
      check(engine.commandPuppy(mochi.info.id, 'spin'), 'Spin command starts');
      for (let frame = 0; frame < 50; frame++) pack.update(1 / 60, 114 + frame / 60, engine.player.position, false, true);
      const motion = mochi.model.getObjectByName('MochiMotion');
      check(Math.abs(motion.quaternion.y) > .3 && mochi.movement.clear(mochi.actor.position.x, mochi.actor.position.z),
        'Authored Spin turns visually while staying on safe ground');
      const spinRotation = motion.quaternion.clone();
      check(engine.commandPuppy(mochi.info.id, 'bow'), 'Bow command starts');
      pack.update(1 / 60, 115, engine.player.position, false, true);
      check(motion.quaternion.angleTo(spinRotation) < .5, 'Interrupting Spin blends the current skeleton pose into Bow');
      for (let frame = 0; frame < 40; frame++) pack.update(1 / 60, 115 + frame / 60, engine.player.position, false, true);
      check(headHeight() < .6 && paw('FrontLeft').y - mochi.actor.position.y < .13,
        'Bow lowers the head while planting the front paws');
      pack.update(.1, 116, engine.player.position, true, true);
      const still = motion.quaternion.clone();
      pack.update(.1, 116.1, engine.player.position, true, true);
      check(mochi.animation.actions.bow.paused && motion.quaternion.angleTo(still) < .01,
        'Reduced motion freezes a readable authored bow pose');
      for (let frame = 0; frame < 300; frame++) pack.update(1 / 60, 117 + frame / 60, engine.player.position, false, true);
      check(mochi.command === null && mochi.animation.actions.idle.getEffectiveWeight() + mochi.animation.actions.walk.getEffectiveWeight() > .9,
        'Trick ends and blends back to resting or its safe patrol');
      check(engine.commandPuppy(mochi.info.id, 'wave'), 'Wave command starts');
      for (let frame = 0; frame < 60; frame++) pack.update(1 / 60, 123 + frame / 60, engine.player.position, false, true);
      check(paw('FrontLeft').y - paw('FrontRight').y > .14, 'Wave lifts just one front paw from the seated pose');
      check(engine.commandPuppy(mochi.info.id, 'roll'), 'Roll over command starts');
      for (let frame = 0; frame < 120; frame++) pack.update(1 / 60, 124 + frame / 60, engine.player.position, false, true);
      check(paw('FrontLeft').y - mochi.actor.position.y > headHeight() + .2, 'Roll over tucks and turns the body');
      check(engine.commandPuppy(mochi.info.id, 'spin'), 'Spin remains available with reduced motion');
      for (let frame = 0; frame < 30; frame++) pack.update(1 / 60, 126 + frame / 60, engine.player.position, true, true);
      const frozen = motion.quaternion.clone();
      pack.update(.5, 126.5, engine.player.position, true, true);
      check(mochi.animation.actions.spin.paused && motion.quaternion.angleTo(frozen) < .01,
        'Reduced-motion Spin holds its still response without turning');
      check(commanded.length === 7 && !engine.commandPuppy(kiko.info.id, 'dance'), 'Commands announce once and reject a distant puppy');
      engine.reducedMotion = false;
      engine.movement.settle(mochi.actor.position.x + 1.1, mochi.actor.position.z);
      engine.player.position.copy(engine.movement.position);
      engine.commandPuppy(mochi.info.id, 'dance');
      const frame = () => engine.frame((engine.lastTime || performance.now()) + 1000 / 60);
      frame();
      check(Math.abs(engine.lookGoal.y - engine.player.position.y - .86) < .01,
        'A stationary trick frames the puppy and spirit together');
      for (let count = 0; count < 50; count++) frame();
      let projected = mochi.head.getWorldPosition(new T.Vector3()).project(engine.camera);
      check(projected.x > -.9 && projected.x < -.25, 'Desktop trick view keeps the puppy clear of the central controls');
      const aspect = engine.camera.aspect;
      engine.camera.aspect = 390 / 844; engine.camera.updateProjectionMatrix();
      for (let count = 0; count < 50; count++) frame();
      projected = mochi.head.getWorldPosition(new T.Vector3()).project(engine.camera);
      check(projected.x > -.9 && projected.x < -.25, 'Portrait trick view keeps the puppy on the clear side of the controls');
      engine.camera.aspect = aspect; engine.camera.updateProjectionMatrix();
      engine.keys.add('w');
      for (let count = 0; count < 20; count++) frame();
      check(engine.movement.speed > .12 && engine.lookGoal.y > engine.player.position.y + 1,
        'Walking immediately restores the normal camera during a trick');
      engine.clearKeys(); engine.movement.pause();
      engine.reducedMotion = true; frame();
      check(engine.lookGoal.y > engine.player.position.y + 1, 'Reduced motion avoids automatic trick camera movement');
      engine.reducedMotion = false; pack.dismiss(); mochi.command = null; frame();
      check(engine.lookGoal.y > engine.player.position.y + 1, 'Ending the trick releases its camera framing');
      const audio = new VillageAudio();
      audio.setMix({ ...DEFAULT_MIX, music: 0 });
      await audio.start();
      check(audio.puppySounds.size === 4, 'All four short recorded yips decode after sound activation');
      audio.puppyEffect('corgi', [0, 1, 30], 'happy');
      check(audio.voices.size >= 2, 'Happy response schedules two bounded spatial yips');
      for (const breed of ['collie','shepherd']) { const before = audio.voices.size; audio.puppyEffect(breed,[0,1,30],'happy'); check(audio.voices.size >= before + 2, `${breed} reuses a decoded recording for its happy response`); }
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

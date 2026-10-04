// Native GLB skin and gameplay compatibility, using the existing local QA modules.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const output = process.env.OUTPUT_DIR || '/tmp/cosy-animal-rigs';
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const match = request.url().match(/animals-v2\/([^/]+)\.glb/);
    if (match) requests.push(match[1]);
  });
  const origin = process.env.QA_URL || 'http://127.0.0.1:3063';
  const dialogueOnly = process.env.DIALOGUE_ONLY === '1';
  await page.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>' }));
  try {
    await page.goto(`${origin}/`);
    const report = await page.evaluate(async dialogueOnly => {
      const T = await import('three');
      const rigs = await import('/modules/features/village/animalRig.js');
      const { loadPlacedPuppies, loadVillageLayout } = await import('/modules/features/village/villageAssets.js');
      const { PuppyAnimation } = await import('/modules/features/village/puppyAnimation.js');
      const { PUPPY_TRICK_SECONDS } = await import('/modules/features/village/sharedActors.js');
      const { makeHorseModel, animateHorseModel, disposeHorseModel } = await import('/modules/features/village/horseModel.js');
      const checks = [], nativeBounds = {}, check = (okay, label) => { if (!okay) throw Error(label); checks.push(label); };
      const layout = await loadVillageLayout();
      const placed = [...new Set(layout.puppies.map(puppy => `dog-${puppy.breed}`))];
      await loadPlacedPuppies(layout);
      check(rigs.ANIMAL_RIG_SLUGS.filter(rigs.hasAnimalRig).sort().join() === placed.sort().join(), 'Entry loads only authored dog breeds');
      await loadPlacedPuppies(layout);
      if (dialogueOnly) {
        const { setAuthoredWorld } = await import('/modules/features/village/environment.js');
        const { PuppyPack } = await import('/modules/features/village/puppies.js');
        const { VillageHorses } = await import('/modules/features/village/horses.js');
        setAuthoredWorld(layout);
        await rigs.loadAnimalRigs(layout.horses.map(horse => `horse-${horse.coat}`));
        const dogs = new PuppyPack(new T.Group(), [], layout.puppies, [], layout, () => {});
        const horses = new VillageHorses(layout.horses, () => {});
        const dog = dogs.puppies[0], horse = layout.horses[0];
        const cues = dogs.dialogueCues, horseCues = horses.dialogueCues;
        check(cues.length === layout.puppies.length && horseCues.length === layout.horses.length,
          'Each authored dog and horse exposes one cached dialogue cue');
        check(cues === dogs.dialogueCues && horseCues === horses.dialogueCues, 'Cue arrays retain identity between frames');
        const states = (kind, placement, mode, age = 1, owner = 'visitor') => {
          const time = Date.now();
          return { time, actor: { id: placement.id, kind, x: placement.x, y: placement.y, z: placement.z,
            heading: placement.yaw, speed: 0, owner, following: mode === 'follow', mode,
            action: mode === 'trick' ? 'wave' : null, startedAt: time - age * 1000, until: time + 10000, speech: null } };
        };
        const listener = new T.Vector3();
        const updateDog = (mode, age = 1, owner = 'visitor', enabled = true, far = false, reduced = false) => {
          const snapshot = states('puppy', layout.puppies[0], mode, age, owner);
          listener.set(snapshot.actor.x + (far ? 20 : 0), snapshot.actor.y, snapshot.actor.z);
          dogs.applyShared([snapshot.actor], 'observer', snapshot.time);
          dogs.update(.016, 1, listener, reduced, enabled);
          return cues[0];
        };
        for (const [mode, priority, words] of [['pet', 3, 'That feels lovely'], ['trick', 2, 'Look what I can do'],
          ['follow', 1, 'I’ll walk with you'], ['hold', 1, 'Shall we play']]) {
          const cue = updateDog(mode);
          check(cue.visible && cue.priority === priority && cue.text.en.includes(words) && cue.text.ja.includes('ワン'),
            `Dog accepted ${mode} response has localized polite copy and priority`);
        }
        const anchor = dog.head.getWorldPosition(new T.Vector3()); anchor.y += .18;
        check(anchor.distanceTo(cues[0].position) < .000001, 'Dog response follows its actual animated Head anchor');
        check(!updateDog('pet', 3.1).visible && !updateDog('trick', 3.3).visible && !updateDog('follow', 2.9).visible,
          'Dog response windows expire using accepted action age');
        check(!updateDog('pet', 1, null).visible && !updateDog('petApproach').visible && !updateDog('roam').visible,
          'Unowned and unaccepted dog action modes do not show a response');
        check(!updateDog('pet', 1, 'visitor', false).visible && !updateDog('pet', 1, 'visitor', true, true).visible,
          'Dog responses hide outside the current outdoor view and ten-metre range');
        check(updateDog('pet', 1, 'visitor', true, false, true).visible, 'Reduced motion retains still readable dog speech');
        dogs.group.visible = false;
        check(!updateDog('pet').visible, 'Hidden dog group hides its response');
        dogs.group.visible = true;
        dogs.applyShared([], 'observer', Date.now()); dogs.update(.016, 1, listener, false, true);
        check(!cues.some(cue => cue.visible), 'Missing shared dog state clears previous speech');
        const updateHorse = (mode, age = 1, owner = 'visitor', enabled = true, far = false, reduced = false) => {
          const snapshot = states('horse', horse, mode, age, owner);
          listener.set(horse.x + (far ? 20 : 0), horse.y, horse.z);
          horses.applyShared([snapshot.actor], 'observer', snapshot.time);
          horses.update(.016, 1, reduced, listener, enabled);
          return horseCues[0];
        };
        check(updateHorse('hold').visible && horseCues[0].priority === 3 && horseCues[0].text.en === 'Neigh~ (Thank you~)',
          'Accepted horse feeding/hold response uses the polite thank-you line');
        check(updateHorse('ride').visible && horseCues[0].priority === 1 && horseCues[0].text.ja.includes('ヒヒーン'),
          'Accepted ride starts a brief localized horse response');
        const horseHead = horses.group.children[0].getObjectByName('Head').getWorldPosition(new T.Vector3()); horseHead.y += .18;
        check(horseHead.distanceTo(horseCues[0].position) < .000001, 'Horse response follows its actual animated Head anchor');
        check(!updateHorse('ride', 3.1).visible && !updateHorse('hold', 3.1).visible, 'Horse responses expire after three accepted seconds');
        check(!updateHorse('hold', 1, null).visible && !updateHorse('idle').visible, 'Unowned and idle horses do not show a response');
        check(!updateHorse('hold', 1, 'visitor', false).visible && !updateHorse('hold', 1, 'visitor', true, true).visible,
          'Horse responses hide outside the current outdoor view and ten-metre range');
        check(updateHorse('hold', 1, 'visitor', true, false, true).visible, 'Reduced motion retains still readable horse speech');
        horses.group.visible = false;
        check(!updateHorse('hold').visible, 'Hidden horse group hides its response');
        horses.group.visible = true;
        horses.reset();
        check(!horseCues.some(cue => cue.visible), 'Horse reset clears previous speech');
        updateDog('pet'); updateHorse('hold'); dogs.dispose(); horses.dispose();
        check(!cues.some(cue => cue.visible) && !horseCues.some(cue => cue.visible), 'Disposing both controllers hides every cached response');
        return { checks, placed, dogs: placed, nativeBounds };
      }
      const point = new T.Vector3();
      const sameRotation = (a, b) => a.toArray().every((value, index) => Math.abs(value - b.toArray()[index]) < .000001);
      const skinBounds = model => {
        let low = Infinity, high = -Infinity, vertices = 0;
        const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
        model.updateMatrixWorld(true);
        model.traverse(mesh => {
          if (!mesh.isSkinnedMesh) return;
          mesh.skeleton.update();
          for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
            mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld);
            if (![point.x, point.y, point.z].every(Number.isFinite)) throw Error('A skin vertex is not finite');
            low = Math.min(low, point.y); high = Math.max(high, point.y); vertices++;
            point.toArray().forEach((value, axis) => { min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value); });
          }
        });
        return { low, high, min, max, vertices };
      };
      const allDogs = rigs.ANIMAL_RIG_SLUGS.filter(slug => slug.startsWith('dog-'));
      await rigs.loadAnimalRigs(allDogs);
      for (const slug of allDogs) {
        const model = rigs.makeAnimalRig(slug), copy = rigs.makeAnimalRig(slug);
        nativeBounds[slug] = skinBounds(model);
        const animation = new PuppyAnimation(model, model.animations, slug, .3);
        check(Object.keys(animation.actions).length === 10, `${slug}: ten native clips bind to the independent skin`);
        for (const [command, duration] of Object.entries(PUPPY_TRICK_SECONDS))
          check(Math.abs(animation.duration(command) - duration) < .04, `${slug}: ${command} preserves the accepted ${duration}s clock`);
        const untouched = copy.getObjectByName('Head').quaternion.clone();
        const bone = model.getObjectByName('LegFrontLeftLower'), rest = bone.quaternion.clone();
        for (let frame = 0; frame < 35; frame++) animation.update(1 / 60, 1.1, null, false, false, true);
        check(bone.quaternion.angleTo(rest) > .01 && skinBounds(model).vertices > 0, `${slug}: walking deforms finite real skin vertices`);
        animation.start('wave', 1.2); animation.update(0, 0, 'wave', false, false, true, .1);
        check(Math.abs(animation.actions.wave.time - 1.2) < .001, `${slug}: late arrival samples the accepted action age`);
        check(sameRotation(copy.getObjectByName('Head').quaternion, untouched), `${slug}: another placement retains its independent pose`);
        for (let frame = 0; frame < 80; frame++) animation.update(1 / 60, 4, 'wave', false, true, true);
        const still = model.getObjectByName('Head').quaternion.clone();
        animation.update(.5, 4, 'wave', false, true, true);
        check(sameRotation(model.getObjectByName('Head').quaternion, still) && animation.actions.idle.getEffectiveWeight() > .999,
          `${slug}: reduced motion rests the native skeleton`);
        animation.dispose(); rigs.disposeAnimalRig(model); rigs.disposeAnimalRig(copy);
      }
      await rigs.loadAnimalRigs(['horse-bay', 'horse-grey']);
      for (const coat of ['bay', 'grey']) {
        const model = makeHorseModel(coat), seat = model.getObjectByName('HorseSeat');
        model.updateMatrixWorld(true); seat.getWorldPosition(point);
        check(model.userData.animalRigSlug === `horse-${coat}` && Math.abs(point.y - 1.64) < .001 && Math.abs(point.z + .08) < .001,
          `${coat}: native horse exposes the correct rider saddle attachment`);
        check(model.animations.some(clip => clip.name === 'trot') && model.animations.some(clip => clip.name === 'canter'), `${coat}: trot and canter clips are available`);
        const bounds = skinBounds(model), original = model.getObjectByName('LegFrontLeft').quaternion.clone();
        nativeBounds[`horse-${coat}`] = bounds;
        animateHorseModel(model, 2, 4.2, .7);
        check(model.getObjectByName('LegFrontLeft').quaternion.angleTo(original) > .01 && skinBounds(model).vertices === bounds.vertices,
          `${coat}: accepted travel selects a real native gait`);
        check(model.position.length() === 0 && model.rotation.x === 0 && model.rotation.y === 0 && model.rotation.z === 0,
          `${coat}: native clips preserve the outer accepted world pose`);
        const head = model.getObjectByName('Head');
        animateHorseModel(model, 3, 0, .7, false, false);
        model.updateMatrixWorld(true); const standingHeight = head.getWorldPosition(point).y;
        animateHorseModel(model, 3, 0, .7, false, true, 2);
        model.updateMatrixWorld(true); const loweredHeight = head.getWorldPosition(point).y;
        check(loweredHeight < standingHeight - .3 && skinBounds(model).low > -.08,
          `${coat}: eating lowers the actual skinned head while hooves stay on the ground`);
        const chewing = head.quaternion.clone();
        animateHorseModel(model, 3, 0, .7, false, true, 2.24);
        check(head.quaternion.angleTo(chewing) > .01, `${coat}: eating visibly chews on the accepted meal clock`);
        const lateJoin = makeHorseModel(coat);
        animateHorseModel(lateJoin, 100, 0, 0, false, true, 2.24);
        check(sameRotation(head.quaternion, lateJoin.getObjectByName('Head').quaternion),
          `${coat}: late arrivals sample the same meal pose despite a different local clock`);
        animateHorseModel(model, 4, 0, .7, false, false);
        model.updateMatrixWorld(true);
        check(head.getWorldPosition(point).y > standingHeight - .08, `${coat}: the meal pose releases without accumulating bone rotations`);
        disposeHorseModel(lateJoin);
        animateHorseModel(model, 3, 0, .7, true, true, 1);
        const still = model.getObjectByName('Head').quaternion.clone();
        animateHorseModel(model, 4, 0, .7, true, true, 2);
        check(sameRotation(model.getObjectByName('Head').quaternion, still), `${coat}: reduced motion holds the resting skin`);
        let geometryDisposed = false;
        model.traverse(mesh => { if (mesh.isSkinnedMesh) mesh.geometry.addEventListener('dispose', () => { geometryDisposed = true; }); });
        disposeHorseModel(model);
        const replacement = makeHorseModel(coat);
        check(!geometryDisposed && skinBounds(replacement).vertices > 0, `${coat}: disposal preserves the cached skin for another rider`);
        disposeHorseModel(replacement);
      }
      await rigs.loadAnimalRigs(['highland-copper', 'owl']);
      for (const [slug, action, boneName] of [['highland-copper', 'pet', 'Head'], ['owl', 'fly', 'WingLeft']]) {
        const model = rigs.makeAnimalRig(slug), bone = model.getObjectByName(boneName), before = bone.quaternion.clone();
        nativeBounds[slug] = skinBounds(model);
        rigs.animateAnimalRig(model, { action, time: .67, reduced: false });
        check(bone.quaternion.angleTo(before) > .005 && skinBounds(model).vertices > 0, `${slug}: helper samples finite native ${action} deformation`);
        check(model.position.length() === 0 && model.rotation.x === 0 && model.rotation.y === 0 && model.rotation.z === 0,
          `${slug}: native deformation leaves outer placement unchanged`);
        rigs.disposeAnimalRig(model);
      }
      const scene = new T.Scene(); scene.background = new T.Color('#dce3cb');
      scene.add(new T.HemisphereLight('#fff9df', '#71866b', 2.5));
      const sun = new T.DirectionalLight('#fff2d6', 3); sun.position.set(-4, 7, 5); scene.add(sun);
      const floor = new T.Mesh(new T.PlaneGeometry(40, 40), new T.MeshStandardMaterial({ color: '#a8ba8a', roughness: 1 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -.02; scene.add(floor);
      const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(1366, 768); renderer.toneMapping = T.ACESFilmicToneMapping;
      document.body.style.margin = '0'; document.body.append(renderer.domElement);
      const camera = new T.PerspectiveCamera(38, 1366 / 768, .1, 80); camera.position.set(4.2, 3.6, 10); camera.lookAt(0, 1, 0);
      const dogs = allDogs.map((slug, index) => {
        const model = rigs.makeAnimalRig(slug), animation = new PuppyAnimation(model, model.animations, slug, index * .15);
        model.position.set((index - 2.5) * 1.3, 0, 2.2); scene.add(model); return { model, animation };
      });
      const horses = ['bay', 'grey'].map((coat, index) => {
        const model = makeHorseModel(coat); model.position.set(index ? 1.55 : -1.55, 0, -.6); scene.add(model); return model;
      });
      window.rigPreview = { renderer, scene, camera, dogs, horses,
        render(action) {
          for (const dog of dogs) {
            if (action === 'wave') dog.animation.start('wave', 1.2);
            for (let frame = 0; frame < 35; frame++) dog.animation.update(1 / 60, action === 'walk' ? 1.1 : 0, action === 'wave' ? 'wave' : null, false, false, true);
          }
          for (const horse of horses) animateHorseModel(horse, action === 'rest' ? 2 : action === 'walk' ? 3 : 4,
            action === 'walk' ? 4.2 : 0, action === 'walk' ? .7 : 0);
          scene.updateMatrixWorld(true); renderer.render(scene, camera);
        } };
      rigPreview.render('rest');
      return { checks, placed, dogs: allDogs, nativeBounds };
    }, dialogueOnly);
    if (dialogueOnly) {
      await page.addStyleTag({ url: `${origin}/village.css` });
      report.dom = [];
      for (const viewport of [{ width: 1366, height: 768 }, { width: 1024, height: 640 }]) {
        await page.setViewportSize(viewport);
        const result = await page.evaluate(async ({ width, height }) => {
          const T = await import('three');
          const { AnimalDialogue, createAnimalDialogueCue } = await import('/modules/features/village/animalDialogue.js');
          const checks = [], check = (okay, label) => { if (!okay) throw Error(label); checks.push(`${width}×${height}: ${label}`); };
          const host = document.createElement('div'); host.className = 'village'; document.body.append(host);
          const renderer = new AnimalDialogue(host), bubble = renderer.bubble;
          renderer.resize(width, height); renderer.setLanguage('en');
          const camera = new T.PerspectiveCamera(45, width / height, .1, 100);
          camera.position.set(0, 2, 6); camera.lookAt(0, 1, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
          const listener = new T.Vector3(0, 1, 0);
          const near = createAnimalDialogueCue('near-dog', 'Woof woof~ (That feels lovely~)', 'ワンワン〜（きもちいいな〜）');
          near.visible = true; near.position.set(0, 1, 0);
          const far = createAnimalDialogueCue('far-horse', 'Neigh~ (Thank you~)', 'ヒヒーン〜（ありがとう〜）');
          far.visible = true; far.position.set(2, 1, -2);
          check(host.querySelectorAll('.v-animal-bubble').length === 1 && bubble.hidden && bubble.getAttribute('role') === 'status'
            && bubble.getAttribute('aria-live') === 'polite', 'One initially hidden polite DOM status bubble is allocated');
          renderer.update([far, near], camera, listener, .016, true, true);
          check(bubble.dataset.animal === near.id && !bubble.hidden && bubble.textContent === near.text.en,
            'Equal-priority responses select the nearest visible animal');
          const css = getComputedStyle(bubble);
          const style = { background: css.backgroundColor, color: css.color, radius: css.borderRadius };
          check(bubble.classList.contains('v-bird-bubble') && css.backgroundColor === 'rgb(255, 248, 237)'
            && css.color === 'rgb(102, 80, 88)' && css.borderRadius === '20px' && css.borderTopColor === 'rgb(246, 214, 220)'
            && css.pointerEvents === 'none' && css.position === 'absolute', 'The actual stylesheet supplies the original cream rounded bird treatment');
          const projected = near.position.clone().project(camera), bounds = bubble.getBoundingClientRect();
          check(Math.abs(bounds.x + bounds.width / 2 - (projected.x * .5 + .5) * width) < 1
            && Math.abs(bounds.bottom - ((-projected.y * .5 + .5) * height - 14)) < 1,
            'The DOM bubble is positioned above the projected animal head');
          far.priority = 3;
          renderer.update([near, far], camera, listener, .016, true, true);
          check(bubble.dataset.animal === far.id && bubble.textContent === far.text.en, 'An accepted higher-priority response wins over a nearer ambient response');
          renderer.setLanguage('ja'); renderer.update([far], camera, listener, .016, true, true);
          check(bubble.lang === 'ja' && bubble.textContent === far.text.ja, 'Language changes update both spoken copy and DOM language');
          renderer.setLanguage('en');
          const edge = createAnimalDialogueCue('edge', 'Woof~ (Thank you for this lovely little walk through the village~)', 'ワン〜（おさんぽありがとう〜）');
          edge.visible = true; edge.position.set(.90, .90, 0).unproject(camera);
          renderer.update([edge], camera, listener, .016, true, true);
          const edgeBounds = bubble.getBoundingClientRect();
          check(!bubble.hidden && edgeBounds.left >= 11 && edgeBounds.right <= width - 11 && edgeBounds.top >= 11 && edgeBounds.bottom <= height - 23,
            'Long responses stay inside the laptop host near a screen edge');
          const culled = createAnimalDialogueCue('culled', 'Off screen', '画面外'); culled.visible = true;
          for (const [position, label] of [[new T.Vector3(.98, 0, 0).unproject(camera), 'horizontal camera edge'],
            [new T.Vector3(0, .98, 0).unproject(camera), 'vertical camera edge'], [new T.Vector3(0, 2, 7), 'behind-camera anchor'],
            [new T.Vector3(0, 1, -20), 'beyond-ten-metre anchor']]) {
            culled.position.copy(position); renderer.update([culled], camera, listener, .016, true, true);
            check(bubble.hidden, `${label} is culled`);
          }
          near.visible = false; renderer.update([near], camera, listener, .016, true, true);
          check(bubble.hidden, 'Invisible controller cues remain hidden');
          near.visible = true; renderer.update([near], camera, listener, .016, false, true);
          const incoming = Number(bubble.style.opacity);
          check(!bubble.hidden && incoming > 0 && incoming < 1, 'Normal motion softly fades in a response');
          renderer.update([], camera, listener, .016, false, true);
          check(!bubble.hidden && Number(bubble.style.opacity) < incoming, 'Normal motion softly fades out a response');
          for (let i = 0; i < 24; i++) renderer.update([], camera, listener, .016, false, true);
          check(bubble.hidden, 'A completed fade removes stale speech from view');
          renderer.update([near], camera, listener, .016, true, true);
          check(!bubble.hidden && bubble.style.opacity === '1', 'Reduced motion immediately shows still readable speech');
          renderer.update([], camera, listener, .016, true, true);
          check(bubble.hidden, 'Reduced motion immediately removes ended speech');
          renderer.update([near], camera, listener, .016, true, true);
          renderer.update([near], camera, listener, .016, false, false);
          check(bubble.hidden, 'Disabling the current view immediately hides the bubble');
          renderer.dispose();
          check(host.querySelectorAll('.v-animal-bubble').length === 0 && !bubble.isConnected, 'Dispose removes the shared DOM bubble');
          const capture = new AnimalDialogue(host); capture.resize(width, height); capture.setLanguage('en');
          capture.update([near], camera, listener, .016, true, true);
          window.dialogueCapture = { host, capture };
          return { checks, style, anchorBounds: bounds.toJSON(), edgeBounds: edgeBounds.toJSON() };
        }, viewport);
        report.checks.push(...result.checks); report.dom.push({ viewport, ...result });
        await page.screenshot({ path: `${output}/cream-bubble-${viewport.width}.png` });
        await page.evaluate(() => { dialogueCapture.capture.dispose(); dialogueCapture.host.remove(); delete window.dialogueCapture; });
      }
    }
    if (!dialogueOnly) {
      await page.screenshot({ path: `${output}/horses-dogs-native-rest.png` });
      for (const action of ['walk', 'wave']) {
        await page.evaluate(action => rigPreview.render(action), action);
        await page.screenshot({ path: `${output}/horses-dogs-native-${action}.png` });
      }
    }
    report.requests = requests;
    for (const slug of report.placed) if (requests.filter(value => value === slug).length !== 1) throw Error(`${slug} was not cached after selective preload`);
    report.checks.push('Repeated entry preload fetches each placed dog model only once');
    report.errors = errors;
    if (errors.length) throw Error(errors.join('\n'));
    fs.writeFileSync(`${output}/${dialogueOnly ? 'dialogue' : 'rig'}-checks.json`, JSON.stringify(report, null, 2));
    console.log(`${report.checks.length} ${dialogueOnly ? 'dog/horse dialogue' : 'native horse/dog rig'} checks passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

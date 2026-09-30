// Browser acceptance for the authored skeletons, blends, foot contacts and motion limits.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const output = process.env.OUTPUT_DIR || '/tmp/cosy-puppy-animation';
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  try {
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:3063/');
    const result = await page.evaluate(async () => {
      const T = await import('three');
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const { clone } = await import('three/addons/utils/SkeletonUtils.js');
      const { PuppyAnimation } = await import('/modules/features/village/puppyAnimation.js');
      const kit = await new GLTFLoader().loadAsync('/village/models/puppies.glb?v=4');
      const checks = [], check = (valid, label) => { if (!valid) throw Error(label); checks.push(label); };
      check(kit.animations.length === 60, 'Six puppies each have ten named Blender clips');
      document.body.innerHTML = '<div id="stage" style="width:100vw;height:100vh"></div><div id="caption" style="position:fixed;bottom:35px;left:0;right:0;text-align:center;color:#344c41;font:24px Georgia"></div>';
      const scene = new T.Scene(); scene.background = new T.Color('#dddacb');
      const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(1440, 810); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
      document.querySelector('#stage').append(renderer.domElement);
      scene.add(new T.HemisphereLight('#fbfcff', '#9c8263', 2.2));
      const sun = new T.DirectionalLight('#fff1d9', 2.7); sun.position.set(-3, 5, 4); sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -5; sun.shadow.camera.right = 5;
      sun.shadow.camera.top = 3; sun.shadow.camera.bottom = -3; sun.shadow.normalBias = .025; scene.add(sun);
      const fill = new T.DirectionalLight('#e3eeff', 1.2); fill.position.set(3, 3, -4); scene.add(fill);
      const floor = new T.Mesh(new T.PlaneGeometry(200, 200), new T.MeshStandardMaterial({ color: '#c8c3ae', roughness: 1 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -.017; floor.receiveShadow = true; scene.add(floor);
      const camera = new T.PerspectiveCamera(32, 1440 / 810, .1, 200);
      camera.position.set(3.1, 3.7, 12.7); camera.lookAt(0, .65, 0);
      const puppies = ['Mochi', 'Kiko', 'Biscuit', 'Cloud', 'Fern', 'Atlas'].map((name, index) => {
        const model = clone(kit.scene.getObjectByName(name)); model.position.x = (index - 2.5) * 1.3;
        model.traverse(node => { if (node.isMesh) node.castShadow = node.receiveShadow = true; if (node.isSkinnedMesh) node.frustumCulled = false; });
        scene.add(model);
        return { name, model, animation: new PuppyAnimation(model, kit.animations, name, index * .25) };
      });
      const paw = (puppy, label) => puppy.model.getObjectByName(puppy.name + 'Paw' + label).getWorldPosition(new T.Vector3());
      const step = (puppy, command, seconds, speed = 0, reduced = false) => {
        for (let frame = 0; frame < Math.round(seconds * 60); frame++) puppy.animation.update(1 / 60, speed, command, false, reduced, true);
        puppy.model.updateMatrixWorld(true);
      };
      const bounds = puppy => {
        let low = Infinity, high = -Infinity;
        puppy.model.updateMatrixWorld(true);
        puppy.model.traverse(mesh => {
          if (!mesh.isSkinnedMesh) return;
          mesh.skeleton.update();
          const point = new T.Vector3();
          for (let index = 0; index < mesh.geometry.attributes.position.count; index++) {
            mesh.getVertexPosition(index, point).applyMatrix4(mesh.matrixWorld);
            low = Math.min(low, point.y); high = Math.max(high, point.y);
          }
        });
        return { low, high };
      };
      for (const puppy of puppies) {
        check(Object.keys(puppy.animation.actions).length === 10, `${puppy.name} binds every authored clip`);
        for (const command of ['sit', 'dance', 'spin', 'bow', 'wave', 'roll']) {
          puppy.animation.start(command); step(puppy, command, command === 'roll' ? 2 : 1.2);
          const extent = bounds(puppy);
          check(Number.isFinite(extent.low) && extent.low > -.035 && extent.high < 2.1,
            `${puppy.name} ${command} has finite skin bounds and stays above the floor: ${JSON.stringify(extent)}`);
          if (command === 'dance') check(paw(puppy, 'FrontLeft').y > .55 && paw(puppy, 'BackLeft').y < .13, `${puppy.name} dances upright on grounded hind paws`);
          if (command === 'wave') check(paw(puppy, 'FrontLeft').y - paw(puppy, 'FrontRight').y > .14, `${puppy.name} waves one articulated paw`);
          if (command === 'bow') check(paw(puppy, 'FrontLeft').y < .13, `${puppy.name} plants its front paw for the play bow`);
        }
        puppy.animation.start('roll');
        for (let frame = 0; frame < 276; frame++) {
          puppy.animation.update(1 / 60, 0, 'roll', false, false, true);
          if (frame % 20 === 0) check(bounds(puppy).low > -.045, `${puppy.name} roll clears the floor at frame ${frame}`);
        }
        step(puppy, null, 1);
        const walkStart = puppy.animation.actions.walk.time;
        step(puppy, null, .5, .8);
        check(puppy.animation.actions.walk.getEffectiveWeight() > .9 && puppy.animation.actions.walk.time !== walkStart, `${puppy.name} walks at movement-driven cadence`);
        step(puppy, null, .5, 4);
        check(puppy.animation.actions.run.getEffectiveWeight() > .9, `${puppy.name} blends into running at higher speed`);
        for (const command of ['spin', 'dance', 'wave', 'roll', 'bow', 'sit']) {
          puppy.animation.start(command); step(puppy, command, .17);
        }
        const before = puppy.model.getObjectByName(puppy.name + 'Head').quaternion.clone();
        puppy.animation.start('dance'); step(puppy, 'dance', 1 / 60);
        check(before.angleTo(puppy.model.getObjectByName(puppy.name + 'Head').quaternion) < .4, `${puppy.name} rapid interruptions retain the current blended pose`);
        step(puppy, 'dance', 1, 0, true);
        const frozen = puppy.model.getObjectByName(puppy.name + 'Head').quaternion.clone();
        step(puppy, 'dance', .5, 0, true);
        check(frozen.angleTo(puppy.model.getObjectByName(puppy.name + 'Head').quaternion) < .001, `${puppy.name} reduced motion freezes its readable dance pose`);
        const time = puppy.animation.mixer.time;
        puppy.animation.update(.5, 4, 'dance', false, false, false);
        check(puppy.animation.mixer.time === time, `${puppy.name} pauses its animation when exploration is inactive`);
      }
      const first = puppies[0], duplicateModel = clone(kit.scene.getObjectByName('Mochi'));
      const duplicate = new PuppyAnimation(duplicateModel, kit.animations, 'Mochi', 0);
      step(first, null, 1);
      const original = first.model.getObjectByName('MochiHead').quaternion.clone();
      duplicate.start('dance');
      for (let frame = 0; frame < 90; frame++) duplicate.update(1 / 60, 0, 'dance', false, false, true);
      check(first.model.getObjectByName('MochiHead').quaternion.angleTo(original) < .001,
        'Two placed corgis have independent skeletons and animation poses');
      duplicate.dispose();
      window.puppyPreview = { scene, renderer, camera, puppies, render() { scene.updateMatrixWorld(true); renderer.render(scene, camera); },
        pose(command, seconds) { for (const puppy of puppies) { puppy.animation.start(command); step(puppy, command, seconds); } this.render(); } };
      puppyPreview.pose('dance', 1.2);
      return { checks, clips: kit.animations.map(clip => clip.name) };
    });
    await page.screenshot({ path: path.join(output, 'puppies-dance.png') });
    for (const command of ['sit', 'bow', 'wave', 'roll']) {
      await page.evaluate(command => puppyPreview.pose(command, command === 'roll' ? 2 : 1.2), command);
      await page.screenshot({ path: path.join(output, `puppies-${command}.png`) });
    }
    if (process.env.RECORD_MOTION) {
      const data = await page.evaluate(async () => {
        const { renderer, puppies } = puppyPreview;
        const canvas = document.createElement('canvas'); canvas.width = 1440; canvas.height = 810;
        const ctx = canvas.getContext('2d');
        const stream = canvas.captureStream(30);
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 1600000 });
        const chunks = []; recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        const stopped = new Promise(resolve => recorder.onstop = resolve); recorder.start();
        for (const [command, title, duration, speed] of [
          [null, 'A little rest', 1.5, 0], [null, 'Walk', 2, .8], [null, 'Run', 2, 3.6],
          ['sit', 'Sit', 2.5, 0], ['dance', 'Dance', 5.2, 0], ['spin', 'Spin', 3.2, 0],
          ['bow', 'Play bow', 2.5, 0], ['wave', 'Wave', 3.5, 0], ['roll', 'Roll over', 4.6, 0],
        ]) {
          if (command) for (const puppy of puppies) puppy.animation.start(command);
          let last = performance.now(), age = 0;
          while (age < duration) {
            const now = await new Promise(requestAnimationFrame), delta = Math.min(.05, (now - last) / 1000);
            last = now; age += delta;
            for (const puppy of puppies) puppy.animation.update(delta, speed, command, false, false, true);
            puppyPreview.render(); ctx.drawImage(renderer.domElement, 0, 0);
            ctx.font = '26px Georgia'; ctx.textAlign = 'center'; ctx.fillStyle = '#344c41'; ctx.fillText(title, 720, 755);
          }
        }
        recorder.stop(); await stopped; stream.getTracks().forEach(track => track.stop());
        return await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.readAsDataURL(new Blob(chunks, { type: 'video/webm' })); });
      });
      fs.writeFileSync(path.join(output, 'puppies-motion.webm'), Buffer.from(data, 'base64'));
    }
    if (errors.length) throw Error(errors.join('\n'));
    fs.writeFileSync(path.join(output, 'puppy-animation-checks.json'), JSON.stringify(result, null, 2));
    console.log(`${result.checks.length} puppy animation checks passed`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });

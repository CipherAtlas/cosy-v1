// Multi-dog route, separation, pause and tiny-arm pet-contact acceptance.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const output = process.env.OUTPUT_DIR || '/tmp/cosy-puppy-pack'; fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', error => errors.push(String(error)));
  try {
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:3072/');
    const result = await page.evaluate(async () => {
      const T = await import('three');
      const { VillageEngine } = await import('/modules/features/village/VillageEngine.js');
      const { PuppyPack, PUPPY_INFO } = await import('/modules/features/village/puppies.js');
      const { VillageNavigation } = await import('/modules/features/village/navigation.js');
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const { floorHeight } = await import('/modules/features/village/environment.js');
      const checks = [], metrics = [], check = (ok, label) => { if (!ok) throw Error(label); checks.push(label); };
      const pairGap = pack => Math.min(...pack.puppies.flatMap((a, i) => pack.puppies.slice(i + 1).map(b =>
        Math.hypot(a.actor.position.x - b.actor.position.x, a.actor.position.z - b.actor.position.z))));
      const noop = () => {};
      document.body.innerHTML = '<div class="village"><div id="scene" style="position:fixed;inset:0"></div></div>';
      const engine = window.engine = new VillageEngine(document.querySelector('#scene'), {
        progress: noop, ready: noop, near: noop, interact: noop, movement: noop, contact: noop, environment: noop, stats: noop,
        error: message => { throw Error(message); },
      });
      await engine.load(); engine.setQuality('low'); engine.setBlocked(false); engine.renderer.setAnimationLoop(null);
      let now = performance.now(); engine.lastTime = now;
      const tick = seconds => { for (let i = 0; i < seconds * 60; i++) { now += 1000 / 60; engine.frame(now); } };
      const pack = engine.puppies;
      check(pack.puppies.length === 6 && ['samoyed','collie','shepherd'].every(b => pack.puppies.some(p => p.info.breed === b)), 'All requested breeds are present in the playable village');
      const hand = engine.character.getObjectByName('SpiritFinR');
      check(hand?.isMesh && !engine.character.getObjectByName('SpiritElbowR') && !engine.character.getObjectByName('SpiritUpperArmR'), 'Blender blob keeps the original tiny fins with no long limb geometry');
      check(new T.Box3().setFromObject(hand).getSize(new T.Vector3()).length() < .46, 'Small arm silhouette stays compact');
      check(engine.life.residents.every(r => r.spirit.getObjectByName('SpiritFinL')?.isMesh && r.spirit.getObjectByName('SpiritFinR')?.isMesh), 'Residents share both movable hands');
      for (const [index, dog] of pack.puppies.entries()) {
        pack.cancelPet(); pack.dismiss();
        for (const [i, other] of pack.puppies.entries()) {
          other.movement.settle(5 + i * 1.5, 34); other.actor.position.copy(other.movement.position); other.pause = 100; other.command = null;
        }
        engine.movement.settle(1, 27); engine.player.position.copy(engine.movement.position); engine.player.rotation.y = 0;
        dog.movement.settle(1, 28.7); dog.actor.position.copy(dog.movement.position); dog.actor.rotation.y = Math.PI;
        check(engine.petPuppy(dog.info.id), `${dog.info.name} accepts a nearby pet`);
        check(!dog.petting && !pack.petContact(), `${dog.info.name} approaches before starting the contact clip`);
        let maxGap = 0, frames = 0, started = false, minHeight = Infinity;
        for (let f = 0; f < 260; f++) {
          tick(1 / 60);
          if (dog.petting) started = true;
          if (dog.petting && dog.petAge > .65 && dog.petAge < 2.35) {
            const contact = pack.petContact(engine.player.rotation.y, engine.puppyPetSide);
            engine.player.updateWorldMatrix(true, true);
            minHeight = Math.min(minHeight, engine.character.position.y);
            const touchingHand = engine.character.getObjectByName(engine.puppyPetSide < 0 ? "SpiritFinR" : "SpiritFinL");
            maxGap = Math.max(maxGap, touchingHand.getWorldPosition(new T.Vector3()).distanceTo(contact)); frames++;
          }
        }
        check(started && frames > 60 && maxGap < .13, `${dog.info.name} stays in contact with the moving hand (gap ${maxGap.toFixed(3)} m)`);
        check(!dog.petting && !dog.petTarget && !pack.petContact(), `${dog.info.name} releases the interaction after the stroke`);
        check(engine.spiritFins.every(arm => arm.scale.equals(new T.Vector3(1, 1, 1))), `${dog.info.name} petting keeps the tiny arms at their original scale`);
        check(minHeight < .55 && minHeight > .15, `${dog.info.name} makes the blob lower itself while staying above the ground (${minHeight.toFixed(3)} m)`);
        check(Math.abs(engine.character.position.x) < .001 && Math.abs(engine.character.position.z) < .001, `${dog.info.name} releases back to the normal hover position`);
        metrics.push({ breed: dog.info.breed, petHandGap: maxGap, contactFrames: frames, blobHeight: minHeight });
      }
      for (const [i, other] of pack.puppies.entries()) { other.movement.settle(5 + i * 1.5, 34); other.actor.position.copy(other.movement.position); other.pause = 100; }
      const dog = pack.puppies[0];
      dog.movement.settle(1, 28.5); dog.actor.position.copy(dog.movement.position); dog.actor.rotation.y = Math.PI;
      engine.movement.settle(1, 27); engine.player.position.copy(engine.movement.position); engine.player.rotation.y = 0;
      const sideWall = {x:1.79,z:27.71,w:.25,d:.9};
      engine.world.colliders.push(sideWall);
      check(engine.petPuppy(dog.info.id) && engine.puppyPetSide === 1, 'A blocked petting side uses the other small hand and clear stance');
      pack.cancelPet();
      engine.world.colliders.push({x:.21,z:27.71,w:.25,d:.9});
      check(!engine.petPuppy(dog.info.id) && !pack.pettingPuppy, 'Petting rejects a stance blocked on both sides');
      engine.world.colliders.splice(-2);
      check(engine.petPuppy(dog.info.id), 'Petting can be requested again after completion');
      tick(1); engine.keys.add('w'); tick(.4); engine.keys.clear();
      check(!dog.petting && !dog.petTarget, 'Walking away cancels the pet and frees the arms');
      engine.movement.settle(1, 27); engine.player.position.copy(engine.movement.position);
      dog.movement.settle(1, 28.14); dog.actor.position.copy(dog.movement.position); dog.actor.rotation.y = Math.PI;
      engine.reducedMotion = true; check(engine.petPuppy(dog.info.id), 'Reduced motion accepts petting'); tick(1);
      const held = hand.getWorldPosition(new T.Vector3()); tick(.5);
      check(dog.animation.actions.pet.paused && hand.getWorldPosition(new T.Vector3()).distanceTo(held) < .015, 'Reduced motion holds a still dog and hand pose');
      engine.reducedMotion = false; pack.cancelPet();
      const collect = (pack, heading) => {
        for (const p of pack.puppies) {
          const nearby = p.actor.position.clone(); nearby.z += .1;
          check(pack.invite(p.info.id, nearby, heading), `${p.info.name} joins when approached individually`);
        }
      };
      check(!pack.invite(pack.puppies[5].info.id, engine.player.position, 0), 'Distant dogs cannot join the walk');
      engine.nearPuppy = dog.info;
      document.dispatchEvent(new KeyboardEvent('keydown', {key:'l', bubbles:true})); engine.keys.clear();
      check(!pack.followers.length, 'L no longer summons any dogs');
      // Collect each dog at its authored home, then exercise the complete pack route.
      for (const puppy of pack.puppies) { puppy.movement.settle(...puppy.route[0]); puppy.actor.position.copy(puppy.movement.position); }
      engine.movement.settle(dog.actor.position.x + 1.1, dog.actor.position.z); engine.player.position.copy(engine.movement.position); engine.player.rotation.y = Math.PI; tick(.1);
      collect(pack, Math.PI); check(pack.followers.length === 6, 'Individual invitations keep all six collected dogs in the pack');
      engine.player.position.set(1, floorHeight(1,27), 27);
      let elapsed = 0, safe = true, separation = Infinity;
      const step = (player, seconds) => { for (let f = 0; f < seconds * 60; f++) {
        elapsed += 1 / 60; pack.update(1 / 60, elapsed, player, false, true, undefined, Math.PI);
        separation = Math.min(separation, pairGap(pack));
        if (f % 60 === 0) safe &&= pack.puppies.every(p => p.movement.clear(p.actor.position.x, p.actor.position.z));
      } };
      step(engine.player.position, 35);
      let distances = pack.puppies.map(p => p.actor.position.distanceTo(engine.player.position));
      check(distances.every(d => d < 8), `All six gather from their homes (${distances.map(d => d.toFixed(1)).join(', ')})`);
      const petId = pack.nearest(engine.player.position).id;
      const waiting = pack.puppies.filter(p => p.info.id !== petId).map(p=>({p,position:p.actor.position.clone()}));
      check(pack.pet(petId,engine.player.position), 'A dog can be petted during the six-dog walk'); step(engine.player.position,.6);
      check(waiting.every(({p,position})=>p.actor.position.distanceTo(position)<.01), 'The other five dogs wait during the pet instead of crowding the hand');
      pack.dismiss(petId);
      check(!pack.pettingPuppy && pack.followers.length===5, 'Sending the petted dog home releases the hand and keeps the other five');
      const dismissed = pack.puppies.find(p => p.info.id === petId);
      check(pack.invite(petId, dismissed.actor.position, Math.PI), 'The released dog rejoins only after being approached');
      const navigation = new VillageNavigation(engine.world.colliders);
      const route = navigation.path([1, 27], [-19, 0]); check(route.length > 0, 'Cross-village walking route exists');
      let waypoint = 0;
      for (let f = 0; f < 55 * 60; f++) {
        const next = route[waypoint];
        if (next) {
          const dx = next[0] - engine.player.position.x, dz = next[1] - engine.player.position.z, length = Math.hypot(dx, dz);
          if (length < .04) waypoint++; else { const stride = Math.min(length, 2.6 / 60); engine.player.position.x += dx / length * stride; engine.player.position.z += dz / length * stride; }
          engine.player.position.y = floorHeight(engine.player.position.x, engine.player.position.z);
        }
        step(engine.player.position, 1 / 60);
      }
      step(engine.player.position, 8);
      distances = pack.puppies.map(p => p.actor.position.distanceTo(engine.player.position));
      check(waypoint === route.length && distances.every(d => d < 9), `All six follow across the bridge to the west garden (${distances.map(d => d.toFixed(1)).join(', ')})`);
      check(safe && separation >= .67, `Pack stays on clear ground with separated bodies (${separation.toFixed(3)} m)`);
      const paused = pack.puppies.map(p => p.actor.position.clone());
      pack.update(.5, elapsed + .5, engine.player.position, false, false);
      check(pack.puppies.every((p,i) => p.actor.position.distanceTo(paused[i]) < .001), 'Activities pause the entire pack');
      check(pack.dismiss(dog.info.id).length === 1 && pack.followers.length === 5, 'One dog can leave while the remaining five keep their invitations');
      check(engine.sendPuppyHome() && !pack.followers.length, 'Send home releases the whole remaining pack');
      metrics.push({ gatherDistances: distances, separation });
      const focusedAction = document.createElement('button'); focusedAction.className = 'v-puppy-home'; focusedAction.textContent = 'Send dogs home'; document.body.append(focusedAction); focusedAction.focus();
      const start = engine.player.position.clone();
      focusedAction.dispatchEvent(new KeyboardEvent('keydown',{key:'w',bubbles:true})); tick(.5);
      focusedAction.dispatchEvent(new KeyboardEvent('keyup',{key:'w',bubbles:true}));
      check(engine.player.position.distanceTo(start) > .6, 'Walking keys work immediately with a dog-action button focused');
      focusedAction.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));
      check(!engine.keys.has(' '), 'Space retains native dog-button activation without also jumping');
      focusedAction.remove(); engine.clearKeys();
      const kit = await new GLTFLoader().loadAsync('/village/models/puppies.glb?v=4');
      const walls = [{x:18.9,z:21,w:.5,d:6},{x:21.1,z:21,w:.5,d:6}];
      for (const fps of [30, 60, 120]) {
        const placements = Object.entries(PUPPY_INFO).map(([breed, info], i) => ({ id:`test-${breed}`,name:info.name,breed,x:20,y:floorHeight(20, 28+i*1.2),z:28+i*1.2,yaw:Math.PI,scale:[1,1,1] }));
        const small = new PuppyPack(kit.scene,kit.animations,placements,walls,{walkable:[]},noop);
        const player = new T.Vector3(20, floorHeight(20,26), 26); collect(small,Math.PI);
        let narrow = false, safe = true, minGap = Infinity;
        for (let f = 0; f < 18 * fps; f++) {
          if (f < 7 * fps) player.z -= 2 / fps;
          player.y = floorHeight(player.x,player.z);
          small.update(1/fps,f/fps,player,false,true,undefined,Math.PI);
          narrow ||= small.singleFile; minGap = Math.min(minGap,pairGap(small));
          safe &&= small.puppies.every(p => p.movement.clear(p.actor.position.x,p.actor.position.z));
        }
        const gaps = small.puppies.map(p=>p.actor.position.distanceTo(player));
        check(narrow && !small.singleFile && gaps.every(g=>g<7), `Six dogs narrow into single file and regroup at ${fps} fps (${gaps.map(g=>g.toFixed(1)).join(', ')})`);
        check(safe && minGap >= .67, `Passage walls and dog separation hold at ${fps} fps (${minGap.toFixed(3)} m)`);
        metrics.push({fps, gaps, minGap}); small.dispose();
      }
      const acrossFence = new PuppyPack(kit.scene, kit.animations, [{id:'fence-corgi',name:'Mochi',breed:'corgi',x:20,y:floorHeight(20,28),z:28,yaw:Math.PI,scale:[1,1,1]}],
        [{x:20,z:27.1,w:4,d:.15}],{walkable:[]},noop);
      const fencedPlayer = new T.Vector3(20,floorHeight(20,26.5),26.5);
      check(!acrossFence.nearest(fencedPlayer) && !acrossFence.pet('fence-corgi',fencedPlayer), 'Petting and nearby actions reject a dog across a fence');
      acrossFence.dispose();
      window.capturePack = () => {
        engine.movement.settle(1,27);engine.player.position.copy(engine.movement.position);engine.player.rotation.y=Math.PI;
        const positions=[[-.8,28.7],[.8,28.7],[-.8,30.1],[.8,30.1],[-.8,31.5],[.8,31.5]];
        pack.puppies.forEach((p,i)=>{p.movement.settle(1+positions[i][0],positions[i][1]);p.actor.position.copy(p.movement.position);p.actor.rotation.y=Math.PI;p.pause=100;});
        engine.camera.position.set(-4.3,4.2,34);engine.camera.lookAt(1,1,29);engine.renderer.render(engine.scene,engine.camera);
      };
      capturePack(); collect(pack, Math.PI); engine.yaw = 0; engine.pitch = .15; tick(2);
      const inFrame = () => pack.puppies.every(puppy => ['Head','PawFrontLeft','PawBackRight'].every(part => {
        const point = puppy.model.getObjectByName(PUPPY_INFO[puppy.info.breed].model + part).getWorldPosition(new T.Vector3()).project(engine.camera);
        return Math.abs(point.x) < .98 && Math.abs(point.y) < .98 && point.z < 1;
      }));
      check(inFrame(), 'Desktop walking camera includes the heads and paws of all six dogs');
      const aspect = engine.camera.aspect; engine.camera.aspect = 390 / 844; engine.camera.updateProjectionMatrix(); tick(1);
      check(inFrame(), 'Portrait walking camera includes the heads and paws of all six individually collected dogs');
      engine.camera.aspect = aspect; engine.camera.updateProjectionMatrix(); capturePack();
      return {checks,metrics};
    });
    await page.screenshot({path:path.join(output,'pack.png')});
    if (process.env.RECORD_MOTION === '1') {
      const recording = await page.evaluate(async () => {
        const T = await import('three');
        const e = window.engine, pack = e.puppies;
        const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 800;
        const context = canvas.getContext('2d'), parts = [];
        const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 1800000 });
        recorder.ondataavailable = event => { if (event.data.size) parts.push(event.data); };
        const done = new Promise(resolve => { recorder.onstop = resolve; }); recorder.start();
        const clip = async (title, seconds, setup) => {
          setup(); e.lastTime = performance.now(); const started = performance.now();
          while (performance.now() - started < seconds * 1000) {
            await new Promise(requestAnimationFrame); e.frame(performance.now());
            context.drawImage(e.renderer.domElement, 0, 0, 1280, 800);
            context.fillStyle = '#233c31'; context.fillRect(0, 744, 1280, 56);
            context.fillStyle = '#fff5de'; context.font = '23px Georgia'; context.textAlign = 'center'; context.fillText(title, 640, 778);
          }
        };
        e.keys.clear(); e.setCompanions([]); e.reducedMotion = false; e.yaw = 0; e.pitch = .15;
        await clip('Together for a walk · six dogs, one pack', 6, () => {
          capturePack(); for (const dog of pack.puppies) pack.invite(dog.info.id, dog.actor.position, Math.PI); e.keys.add('w');
        });
        await clip('Turning together · room for every puppy', 3, () => { e.keys.clear(); e.keys.add('d'); });
        for (const breed of ['samoyed','collie','shepherd']) {
          await clip(`${breed === 'samoyed' ? 'Cloud · Samoyed' : breed === 'collie' ? 'Fern · Border Collie' : 'Atlas · German Shepherd'} · a gentle stroke`, 5, () => {
            e.keys.clear(); e.movement.pause(); pack.cancelPet(); pack.dismiss();
            pack.puppies.forEach((dog,i) => { dog.movement.settle(5+i*1.5,34);dog.actor.position.copy(dog.movement.position);dog.pause=100;dog.command=null; });
            e.movement.settle(1,27); e.player.position.copy(e.movement.position); e.player.rotation.y=0;
            const dog=pack.puppies.find(p=>p.info.breed===breed);dog.movement.settle(1,28.7);dog.actor.position.copy(dog.movement.position);dog.actor.rotation.y=Math.PI;
            e.camera.position.set(4,2.2,27.5);e.currentLook.set(1,.85,27.6); e.petPuppy(dog.info.id);
          });
        }
        recorder.stop(); await done;
        const bytes = new Uint8Array(await new Blob(parts,{type:'video/webm'}).arrayBuffer());
        let binary=''; for (let offset=0;offset<bytes.length;offset+=32768) binary+=String.fromCharCode(...bytes.subarray(offset,offset+32768));
        return btoa(binary);
      });
      fs.writeFileSync(path.join(output,'pack-motion.webm'),Buffer.from(recording,'base64'));
    }
    if(errors.length) throw Error(errors.join('\n'));
    fs.writeFileSync(path.join(output,'pack-checks.json'),JSON.stringify({...result,errors},null,2));
    console.log(`${result.checks.length} pack and hand-contact checks passed`);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exit(1);});

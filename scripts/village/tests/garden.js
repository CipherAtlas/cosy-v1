import * as T from 'three';
import { VillageLife } from './modules/features/village/life.js';
import { VillageNavigation } from './modules/features/village/navigation.js';
import { PLACES } from './modules/features/village/places.js';
import { POND, pondDistance, onPondDock } from './modules/features/village/environment.js';
import { freshGarden, readGarden, gardenAction, gardenActionAllowed, growGarden, growthProgress, growthTimeLeft, nearbyGardenAction, BEDS, GROWTH_MS, MINT_BED, DAISY_BED, CROP_INVENTORY, HARVEST_COMPLIMENTS, GARDEN_KEY } from './modules/features/village/garden.js';
import { VillageAudio } from './modules/features/village/audio.js';
import { DEFAULT_MIX } from './modules/features/village/places.js';

export async function checkNearbyInteractions(engine, save) {
  const results = [], calls = [], check = (ok, label) => { if (!ok) throw Error(label); results.push(label); };
  const original = { ...engine.callbacks }, state = engine.gardenState;
  const canvas = engine.renderer.domElement;
  const press = (options = {}) => {
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true, ...options }));
    canvas.dispatchEvent(new KeyboardEvent('keyup', { key: 'e', bubbles: true }));
  };
  const stand = (x, z) => {
    engine.setPlace(null); engine.setBlocked(false); engine.movement.settle(x, z);
    engine.frame(performance.now()); calls.length = 0;
  };
  engine.callbacks.interact = id => { calls.push(`place:${id}`); engine.travel(id); };
  engine.callbacks.gardenInteract = id => calls.push(`garden:${id}`);
  try {
    engine.setGarden(freshGarden());
    for (const [x, z, label] of [[12.1, -10, 'Behind the tea bench'], [14.7, -13.5, 'North pergola approach'], [17.7, -10, 'Table side'], [15.6, -6.8, 'Original tea arrival']]) {
      stand(x, z);
      check(engine.movement.clear(x, z), `${label}: interaction is reachable on clear ground`);
      check(engine.near === 'mood', `${label}: offers the tea activity without precise positioning`);
      press(); check(calls.join() === 'place:mood' && engine.place === 'mood', `${label}: E enters the tea activity`);
    }
    stand(9.5, -10); check(engine.near !== 'mood', 'Tea prompt stays local to the courtyard');
    engine.setGarden(freshGarden()); stand(15.2, -8.1);
    check(engine.near === 'mood' && engine.nearGarden === 'tea', 'Tea approach overlaps the activity and tea-drinking targets');
    press();
    check(calls.join() === 'place:mood' && engine.place === 'mood', 'E opens the tea activity when no mint tea is prepared');
    press(); check(calls.length === 1, 'A settled activity does not repeat the nearby interaction');

    stand(15.2, -8.1); engine.setGarden({ ...freshGarden(), mintTea: 1 }); press();
    check(calls.join() === 'garden:tea', 'Prepared mint tea keeps the same priority as the on-screen prompt');
    calls.length = 0; engine.setGarden(freshGarden()); press();
    check(calls.join() === 'place:mood', 'E falls back immediately when the last cup has been consumed');

    stand(23.8, -1.8); press();
    check(calls.join() === 'garden:bed-4', 'E waters unwatered mint beside the garden entrance');
    calls.length = 0; engine.setGarden(gardenAction(freshGarden(), { kind: 'water', bed: MINT_BED })); press();
    check(calls.join() === 'place:garden' && engine.place === 'garden', 'Growing mint cannot swallow the garden entry keypress');

    let growing = freshGarden();
    growing = gardenAction(growing, { kind: 'plant', bed: 2, crop: 'radish' });
    growing = gardenAction(growing, { kind: 'water', bed: 2 });
    engine.setGarden(growing); stand(23.8, -4.5); press();
    check(calls.join() === 'place:garden', 'Growing vegetables also fall back to the visible activity prompt');
    engine.setGarden(growGarden(growing, Date.now() + GROWTH_MS.radish)); stand(23.8, -4.5); press();
    check(calls.join() === 'garden:bed-2', 'Ripe vegetables regain harvest priority');

    engine.setGarden(freshGarden()); stand(27.2, .8); press();
    check(calls.join() === `garden:bed-${DAISY_BED}`, 'The daisy approach selects its harvest instead of decorative watering');
    let daisies = gardenAction(freshGarden(), { kind: 'harvest', bed: DAISY_BED });
    check(nearbyGardenAction(`bed-${DAISY_BED}`, daisies)?.kind === 'plant', 'An empty daisy bed offers replanting');
    daisies = gardenAction(daisies, { kind: 'plant', bed: DAISY_BED, crop: 'daisy' });
    check(nearbyGardenAction(`bed-${DAISY_BED}`, daisies)?.kind === 'water', 'Daisy sprouts offer watering');
    daisies = gardenAction(daisies, { kind: 'water', bed: DAISY_BED });
    check(nearbyGardenAction(`bed-${DAISY_BED}`, daisies) === null, 'Growing daisies cannot be repeatedly watered or harvested');

    stand(15.2, -8.1); engine.setBlocked(true); press();
    check(calls.length === 0, 'Menus block nearby keyboard interactions');
    engine.setBlocked(false); press({ repeat: true });
    check(calls.length === 0, 'Holding E does not repeat an interaction');
    stand(.3, 20); press(); check(calls.length === 0, 'E away from activities remains harmless');

    const time = engine.garden.time + 10;
    engine.garden.update(0, time, false);
    check(!engine.garden.group.getObjectByName('Basket') && !engine.garden.can.visible, 'Garden aisles have no parked basket or watering can');
    engine.gardenAction({ kind: 'flowers' }); engine.garden.update(.1, time + .1, false);
    check(engine.garden.can.visible && engine.garden.drops.visible, 'Watering still shows its temporary can and water');
    engine.garden.update(.1, time + 3, false);
    check(!engine.garden.can.visible && !engine.garden.drops.visible, 'Watering props disappear when the action ends');
    const result = { pass: true, count: results.length, results, browser: navigator.userAgent };
    await save('nearby-interactions.json', JSON.stringify(result, null, 2)); return result;
  } finally {
    Object.assign(engine.callbacks, original); engine.setGarden(state); engine.setPlace(null); engine.setBlocked(false);
    engine.garden.actionAt = -100; engine.garden.update(0, engine.elapsed, false);
  }
}

export async function checkGardenAudio(save) {
  const results = [], signal = [], check = (value, name) => { if (!value) throw Error(name); results.push(name); };
  const audio = new VillageAudio(), delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const kinds = ['plant', 'water', 'pluck', 'pour', 'crumbs', 'splash', 'duck'];
  try {
    audio.gardenEffect('duck', [0, 0, 0]); check(!audio.context, 'Garden sounds never create audio before explicit activation');
    audio.setMix({ ...DEFAULT_MIX, music: 0, ambience: 0, fire: 0, rain: 0, effects: 1 });
    await audio.start();
    audio.setEnvironment({ listener: [-25, .5, -8], forward: [0, 0, -1], wind: 0, weather: 'golden', sheltered: false });
    const analyser = audio.context.createAnalyser(); analyser.fftSize = 2048; audio.master.connect(analyser);
    const destination = audio.context.createMediaStreamDestination(); audio.master.connect(destination);
    const chunks = [], recorder = new MediaRecorder(destination.stream);
    recorder.ondataavailable = event => chunks.push(event.data); recorder.start();
    for (const kind of kinds) {
      audio.gardenEffect(kind, [-25, 0, -8]);
      await delay(100);
      const samples = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
      signal.push({ kind, rms }); check(rms > .00001, `${kind}: non-silent signal through the production effects and master buses`);
      await delay(1250);
    }
    const ended = new Promise(resolve => recorder.onstop = resolve); recorder.stop(); await ended;
    await save('garden-sounds.webm', new Blob(chunks, { type: recorder.mimeType }));
    audio.setMix({ ...DEFAULT_MIX, music: 0, ambience: 0, fire: 0, rain: 0, effects: 0 });
    const before = audio.voices.size; audio.gardenEffect('duck', [-25, 0, -8]);
    check(audio.voices.size === before, 'Effects mute does not schedule garden voices');
    audio.setMix({ ...DEFAULT_MIX, music: 0, ambience: 0, fire: 0, rain: 0, effects: 1 });
    for (let i = 0; i < 50; i++) audio.gardenEffect('water', [-25, 0, -8]);
    check([...audio.voices].filter(v => v.effect).length <= 16, 'Rapid repeated interactions respect the 16-voice effects budget');
    audio.stop(); const stopped = audio.voices.size; audio.gardenEffect('water', [-25, 0, -8]);
    check(audio.voices.size === stopped, 'Sound off prevents new garden effects');
    audio.dispose(); check(!audio.gardenSounds.size, 'Disposal releases cached garden sound buffers');
    const result = { pass: true, checks: results.length, results, signal, browser: navigator.userAgent, limits: 'Signal/lifecycle evidence and a preview recording; not a subjective listening or phone-audio review.' };
    await save('garden-audio.json', JSON.stringify(result, null, 2)); return result;
  } finally { audio.dispose(); }
}

export async function checkGarden(engine, capture, save) {
  const results = [], checks = (condition, label) => { if (!condition) throw Error(label); results.push(label); };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  let state = freshGarden();
  state = gardenAction(state, { kind: 'plant', bed: 2, crop: 'radish' });
  checks(state.beds[2].stage === 'sprout', 'Planting creates a sprout immediately');
  checks(!gardenActionAllowed(state, { kind: 'harvest', bed: 2 }), 'Sprouts cannot be harvested before watering');
  state = gardenAction(state, { kind: 'water', bed: 2 });
  checks(state.beds[2].stage === 'growing', 'Watering begins gentle growth');
  state = growGarden(state, Date.now() + GROWTH_MS.radish);
  state = gardenAction(state, { kind: 'harvest', bed: 2 });
  checks(state.radishes === 1 && state.beds[2].stage === 'empty', 'Harvest enters the basket and leaves soil available for replanting');
  for (let i = 0; i < 100; i++) {
    state = gardenAction(state, { kind: 'plant', bed: 2, crop: 'carrot' });
    state = gardenAction(state, { kind: 'water', bed: 2 });
    state = growGarden(state, Date.now() + GROWTH_MS.carrot);
    state = gardenAction(state, { kind: 'harvest', bed: 2 });
  }
  checks(state.carrots === 100, 'Seeds and water never run out across repeated growing cycles');
  checks(!gardenActionAllowed(state, { kind: 'gift', crop: 'mint' }), 'Mint tea requires a picked sprig');
  state = gardenAction(state, { kind: 'water', bed: MINT_BED });
  state = growGarden(state, Date.now() + GROWTH_MS.mint);
  state = gardenAction(state, { kind: 'harvest', bed: MINT_BED });
  checks(gardenActionAllowed(state, { kind: 'gift', crop: 'mint' }), 'Grown mint can be given to Luma');
  state = gardenAction(state, { kind: 'gift', crop: 'mint' });
  checks(state.mint === 0 && state.mintTea === 1, 'Luma makes one special mint tea from a sprig');
  checks(!gardenActionAllowed(state, { kind: 'feed' }), 'Feeding begins with Maple\'s gift');
  state = gardenAction(state, { kind: 'crumbs' });
  for (let i = 0; i < 100; i++) state = gardenAction(state, { kind: 'feed' });
  checks(state.crumbPouch, 'Maple\'s pouch remains available without a resupply chore');
  localStorage.setItem(GARDEN_KEY, JSON.stringify(state));
  checks(JSON.stringify(readGarden(localStorage.getItem(GARDEN_KEY))) === JSON.stringify(state), 'Garden inventory and beds round-trip through browser storage');
  for (const invalid of ['null', '{}', '[]', 'broken', '{"mint":-4,"carrots":1e99,"beds":[null]}']) {
    const restored = readGarden(invalid); checks(restored.beds.length === BEDS.length && restored.mint >= 0 && Number.isSafeInteger(restored.carrots), `Safe optional garden recovery: ${invalid}`);
  }
  checks(POND.rx * POND.rz > 2 * 7.7 * 7, 'Pond water area is more than twice the previous footprint');
  checks(!engine.world.colliders.some(c => c.x === -24 && c.z === -5), 'Pond-front cottage collision is removed');
  checks(engine.garden.birds.length === 6 && engine.garden.fish.length === 4, 'The pond has a swan, a duck, four ducklings and four fish');
  checks(engine.garden.birds[0].wings.length === 2 && engine.garden.fish[0].tail, 'Blender wing and tail pivots are loaded');
  const m = engine.movement;
  checks(!m.clear(POND.x, POND.z), 'Deep pond water remains blocked');
  checks(m.clear(-23.2, -5.5) && onPondDock(-23.2, -5.5), 'The feeding dock is walkable over water');
  for (const place of PLACES) {
    engine.travel(place.id); engine.setPlace(null);
    checks(m.clear(m.position.x, m.position.z), `${place.name}: activity exit lands on clear ground`);
    checks(!engine.keys.size && engine.player.visible && m.grounded, `${place.name}: exit restores visible grounded player and clears keys`);
  }
  const navigation = new VillageNavigation(engine.world.colliders);
  for (const [x, z, label] of [[24.7, -12.7, 'Sunflowers'], [27.2, -1, 'Daisies'], [30.1, -7.3, 'Irises']]) {
    checks(!m.clear(x, z), `${label}: planted bed is excluded from walking and navigation`);
  }
  m.settle(24.6, -3);
  checks(!m.canWalkTo(29.8, 1.2), 'Walking cannot cut directly through the daisy bed');
  checks(m.clear(29.8, 1.2), 'The path in front of the daisy bed remains walkable');
  for (const [from, to, label] of [
    [[-.6, 7], [-23.2, -5.5], 'Bridge and dock'],
    [[4, 11], [24.6, -3], 'Around cottages to the kitchen garden'],
    [[24.6, -3], [24.6, -11.6], 'Garden aisle'],
    [[24.6, -3], [29.8, 1.2], 'Around the daisy bed instead of through it'],
    [[-23.2, -5.5], [14, -9], 'Pond to tea courtyard'],
  ]) {
    const path = navigation.path(from, to); checks(path.length > 0, `${label}: a collision-safe route exists`);
    m.settle(...from);
    for (const point of path) { checks(m.canWalkTo(...point), `${label}: safe path segment ${point.map(v => v.toFixed(1)).join(',')}`); m.settle(...point); }
  }
  const followSamples = [];
  for (const fps of [30, 60, 120]) {
    const life = new VillageLife(new T.Group(), engine.world.colliders);
    life.setCompanions(['pip', 'maple', 'moss', 'luma', 'wren']);
    const player = new T.Vector3(-19, 0, 0);
    for (let frame = 0; frame < 75 * fps; frame++) life.update(1 / fps, frame / fps, player, false, false);
    const distances = life.residents.map(r => r.root.position.distanceTo(player));
    checks(distances.every(d => d < 4.3), `All five companions route across the village and bridge at ${fps} fps`);
    checks(life.residents.every(r => r.movement.clear(r.movement.position.x, r.movement.position.z)), `Companions finish on safe ground at ${fps} fps`);
    followSamples.push({ fps, distances });
    const walk = navigation.path([player.x, player.z], [24.6, -3]);
    let waypoint = 0, safe = true;
    for (let frame = 0; frame < 55 * fps; frame++) {
      const next = walk[waypoint];
      if (next) {
        const dx = next[0] - player.x, dz = next[1] - player.z, distance = Math.hypot(dx, dz), step = Math.min(distance, 4.2 / fps);
        if (distance < .05) waypoint++;
        else { player.x += dx / distance * step; player.z += dz / distance * step; }
      }
      life.update(1 / fps, 75 + frame / fps, player, false, false);
      if (frame % fps === 0) safe &&= life.residents.every(r => r.movement.clear(r.movement.position.x, r.movement.position.z));
    }
    checks(waypoint === walk.length && life.residents.every(r => r.root.position.distanceTo(player) < 4.3), `All five track a moving player across the bridge and around cottages at ${fps} fps`);
    checks(safe, `Moving companions respect collision and water bounds at ${fps} fps`);
    life.setCompanions([]);
    for (let frame = 0; frame < 90 * fps; frame++) life.update(1 / fps, 130 + frame / fps, player, false, false);
    checks(life.residents.every(r => !r.returning && !r.following), `Dismissed companions find their roaming routes at ${fps} fps`);
    life.dispose();
    const materials = new Set(), geometries = new Set();
    life.group.traverse(o => { if (o.isMesh) { geometries.add(o.geometry); materials.add(o.material); } });
    materials.forEach(m => m.dispose()); geometries.forEach(g => g.dispose());
  }
  engine.setCompanions(['pip', 'maple', 'moss', 'luma', 'wren']);
  for (const place of PLACES) {
    engine.travel(place.id); await delay(80);
    checks(engine.life.residents.every(r => r.root.visible && r.root.position.distanceTo(engine.player.position) < 7), `${place.name}: all companions join the activity`);
  }
  engine.travel('breathe'); engine.garden.act({ kind: 'feed' });
  for (let i = 0; i < 600; i++) engine.garden.update(1 / 60, engine.garden.time + 1 / 60, false);
  checks(engine.garden.birds.slice(1).every(b => Math.hypot(b.root.position.x + 25, b.root.position.z + 7.8) < 1.65), 'Ducks swim to the thrown crumbs');
  checks(engine.garden.birds.every(b => pondDistance(b.root.position.x, b.root.position.z) < 1), 'Feeding keeps all water birds inside the pond');
  const heights = [];
  for (let i = 0; i < 240; i++) { engine.garden.update(1 / 60, i / 60, false); heights.push(engine.garden.fish[0].root.position.y); }
  checks(Math.max(...heights) > POND.y + 1 && Math.min(...heights) < POND.y, 'Fish leap out and land back in the pond');
  engine.garden.update(.016, 50, true); const still = engine.garden.fish[0].root.position.clone();
  engine.garden.update(.016, 51, true);
  checks(still.distanceTo(engine.garden.fish[0].root.position) === 0 && !engine.garden.drops.visible, 'Reduced motion suppresses fish jumps and watering particles');
  engine.setGarden(freshGarden()); engine.setBlocked(true); engine.setWeather('golden');
  const view = async (name, position, look) => {
    const camera = engine.camera.clone(); camera.clearViewOffset(); camera.position.set(...position); camera.lookAt(...look); await capture(name, camera);
  };
  engine.travel('garden'); await delay(1000);
  await view('garden-overview.png', [31.8, 7, 2.2], [24.5, .8, -7]);
  engine.setGarden(gardenAction(freshGarden(), { kind: 'plant', bed: 2, crop: 'carrot' }));
  engine.gardenAction({ kind: 'water', bed: 2 }); await delay(600);
  await view('garden-watering.png', [25, 3.3, -1], [22.2, .7, -5.5]);
  engine.travel('breathe'); await delay(900);
  await view('pond-overview.png', [-15, 8, 2], [-27, .2, -13]);
  engine.gardenAction({ kind: 'feed' }); await delay(6000);
  await view('pond-ducks.png', [-29, 2.2, -5.1], [-25.5, .05, -8.5]);
  engine.travel('mood'); engine.gardenAction({ kind: 'drink' }); await delay(700);
  await capture('companions-tea.png');
  engine.travel('focus'); await delay(800); await capture('companions-focus.png');
  engine.setBlocked(false); engine.setPlace(null);
  const result = { pass: true, checks: results.length, results, followSamples, browser: navigator.userAgent, limits: 'Deterministic loaded-engine/browser-storage checks and renderer captures. Product DOM/mobile and listening require separate review.' };
  await save('garden-checks.json', JSON.stringify(result, null, 2)); return result;
}

export async function recordGarden(engine, save) {
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const chunks = [], stream = engine.renderer.domElement.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 2200000 });
  const stopped = new Promise(resolve => { recorder.ondataavailable = e => chunks.push(e.data); recorder.onstop = resolve; });
  const samples = [];
  engine.setCompanions(['pip', 'maple', 'moss', 'luma', 'wren']); engine.setBlocked(true); engine.setQuality('high');
  const measure = async (place, actions) => {
    engine.travel(place); await delay(1000);
    const times = []; let previous = performance.now(), active = true, frame;
    const sample = now => { times.push(now - previous); previous = now; if (active) frame = requestAnimationFrame(sample); };
    frame = requestAnimationFrame(sample);
    for (const [action, ms] of actions) { if (action) engine.gardenAction(action); await delay(ms); }
    active = false; cancelAnimationFrame(frame); times.sort((a, b) => a - b);
    samples.push({ place, frames: times.length, meanMs: times.reduce((a,b)=>a+b,0)/times.length, p95Ms: times[Math.floor(times.length*.95)], draws: engine.renderer.info.render.calls, triangles: engine.renderer.info.render.triangles, quality: engine.graphicsTier, drawingBuffer: [engine.renderer.domElement.width, engine.renderer.domElement.height] });
  };
  try {
    recorder.start();
    await measure('garden', [[{ kind: 'flowers' }, 3000], [{ kind: 'water', bed: 2 }, 3000], [{ kind: 'harvest', bed: MINT_BED }, 2000]]);
    await measure('mood', [[{ kind: 'drink' }, 4000]]);
    await measure('breathe', [[{ kind: 'feed' }, 12000]]);
    recorder.stop(); await stopped;
    await save('garden-motion.webm', new Blob(chunks, { type: recorder.mimeType }));
    const result = { samples, browser: navigator.userAgent, limits: 'Short local Chromium renderer preview with four companions, not target-device or sustained performance acceptance.' };
    await save('garden-profile.json', JSON.stringify(result, null, 2)); return result;
  } finally { stream.getTracks().forEach(track => track.stop()); engine.setBlocked(false); engine.setPlace(null); }
}

export async function checkCosyFeedback(engine, capture, save) {
  const results = [], check = (ok, label) => { if (!ok) throw Error(label); results.push(label); };
  const canvas = engine.renderer.domElement, originalCapture = canvas.setPointerCapture, originalRelease = canvas.releasePointerCapture, originalHas = canvas.hasPointerCapture;
  const captured = new Set();
  // Controller checks isolate capture bookkeeping; actual dragging is also reviewed in the exported app.
  canvas.setPointerCapture = id => captured.add(id); canvas.hasPointerCapture = id => captured.has(id); canvas.releasePointerCapture = id => captured.delete(id);
  const down = { button: 0, pointerId: 91, pointerType: 'mouse', clientX: 300, clientY: 300 };
  const move = { ...down, clientX: 455, clientY: 345 };
  try {
    engine.setCompanions([]); engine.setBlocked(false);
    for (const place of PLACES) {
      engine.travel(place.id); const walking = [engine.yaw, engine.pitch], player = { ...engine.movement.position };
      const before = engine.cameraGoal.clone(); engine.onDown(down); engine.onMove(move); engine.updateActivityCamera(place.id);
      check(captured.has(91) && engine.cameraGoal.distanceTo(before) > .2, `${place.name}: mouse dragging moves the activity camera`);
      check(JSON.stringify(engine.movement.position) === JSON.stringify(player) && engine.yaw === walking[0] && engine.pitch === walking[1], `${place.name}: dragging leaves the player seated and walking orientation unchanged`);
      engine.onUp(move); const yaw = engine.activityOrbit.yaw; engine.onMove({ ...move, clientX: 800 });
      check(!captured.size && engine.activityOrbit.yaw === yaw, `${place.name}: releasing the pointer stops orbiting`);
      engine.setPlace(null); engine.travel(place.id);
      check(engine.activityOrbit.yaw === 0 && engine.activityOrbit.pitch === 0, `${place.name}: a new visit restores the authored view`);
    }
    engine.travel('focus'); engine.onDown(down); engine.onMove({ ...move, clientX: 6000, clientY: -2000 }); engine.updateActivityCamera('focus');
    const c = engine.cameraGoal;
    check(c.x >= 105.9 && c.x <= 114.1 && c.y >= .45 && c.y <= 4.5 && c.z >= -4 && c.z <= 4.1, 'Cottage orbit stays inside walls and ceiling');
    engine.setBlocked(true); const angle = engine.activityOrbit.yaw; engine.onMove(move); engine.onDown(down);
    check(!engine.pointer && !captured.size && engine.activityOrbit.yaw === angle, 'Opening a menu cancels captured activity dragging');
    engine.setBlocked(false); engine.travel('breathe'); engine.onDown(down); engine.onBlur();
    check(!engine.pointer && !captured.size, 'Window blur cancels activity dragging');
    engine.onDown(down); engine.onUp({ ...down, type: 'pointercancel' });
    check(!engine.pointer && !captured.size, 'Pointer cancellation ends activity dragging');
    engine.onDown({ ...down, pointerType: 'touch' }); engine.onMove({ ...move, pointerType: 'touch' });
    check(engine.activityOrbit.yaw !== 0, 'Touch dragging uses the same settled orbit'); engine.onUp(move);
    const garden = engine.garden, start = engine.elapsed;
    garden.update(0, start, false, engine.camera.quaternion); garden.act({ kind: 'feed' });
    garden.update(.016, start + 6.9, false, engine.camera.quaternion);
    check(garden.crumbs.visible && !garden.hearts.visible, 'Happy reaction waits until the crumbs are eaten');
    garden.update(.016, start + 8.2, false, engine.camera.quaternion);
    check(!garden.crumbs.visible && garden.hearts.visible && garden.feedCelebrated, 'Eating ends with hearts and a single happy duck call');
    check(garden.birds.slice(1).every(b => b.root.rotation.z !== 0), 'Duck and ducklings wiggle and bob in celebration');
    garden.update(.016, start + 8.2, true, engine.camera.quaternion);
    check(garden.hearts.visible && garden.birds.slice(1).every(b => b.root.rotation.z === 0 && b.wings.every(w => w.rotation.z === 0)), 'Reduced motion keeps static hearts without bouncing or wing flutter');
    garden.update(.016, start + 11.2, false, engine.camera.quaternion);
    check(!garden.hearts.visible && garden.birds.slice(1).every(b => b.root.rotation.z === 0), 'Happy reaction settles back into ordinary swimming');
    garden.act({ kind: 'feed' }); garden.update(.016, start + 11.3, false, engine.camera.quaternion);
    check(!garden.hearts.visible && !garden.feedCelebrated, 'Feeding again starts a fresh sequence without piling up reactions');
    // Capture real elapsed-time feedback, preserving production camera-facing hearts.
    engine.setBlocked(true); engine.travel('breathe');
    garden.update(0, engine.elapsed, false, engine.camera.quaternion); garden.act({ kind: 'feed' });
    await new Promise(resolve => setTimeout(resolve, 8500));
    const camera = engine.camera.clone(); camera.clearViewOffset(); camera.position.set(-28.5, 2.7, -3.8); camera.lookAt(-25, .4, -8);
    garden.update(0, engine.elapsed, false, camera.quaternion); await capture('happy-ducks.png', camera);
    const result = { pass: true, checks: results.length, results, browser: navigator.userAgent, limits: 'Production controller and animation checks. Native pointer dragging and UI layout are reviewed separately in the exported app.' };
    await save('cosy-feedback.json', JSON.stringify(result, null, 2)); return result;
  } finally {
    canvas.setPointerCapture = originalCapture; canvas.releasePointerCapture = originalRelease; canvas.hasPointerCapture = originalHas;
    engine.setBlocked(false); engine.setPlace(null);
  }
}


export async function checkGentleGrowth(engine, capture, save) {
  const results = [], check = (ok, label) => { if (!ok) throw Error(label); results.push(label); };
  const start = 1_800_000_000_000, delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  for (const [crop, minutes, bed] of [['radish', 2, 2], ['mint', 3, MINT_BED], ['carrot', 5, 2], ['daisy', 3, DAISY_BED]]) {
    let state = freshGarden(); state.beds[bed] = { crop, stage: 'empty' };
    state = gardenAction(state, { kind: 'plant', crop, bed }, start);
    state = gardenAction(state, { kind: 'water', bed }, start);
    check(state.beds[bed].stage === 'growing' && state.beds[bed].wateredAt === start, `${crop}: watering starts a saved ${minutes}-minute growth period`);
    check(!gardenActionAllowed(state, { kind: 'harvest', bed }), `${crop}: cannot harvest early`);
    const halfway = growGarden(state, start + minutes * 30000);
    check(halfway.beds[bed].stage === 'growing' && growthProgress(halfway.beds[bed], start + minutes * 30000) === .5, `${crop}: visible growth progresses halfway`);
    check(gardenAction(state, { kind: 'water', bed }, start + 1000) === state, `${crop}: extra watering cannot reset or speed growth`);
    check(growGarden(state, start + minutes * 60000 - 1).beds[bed].stage === 'growing', `${crop}: waits for its complete growth period`);
    state = readGarden(JSON.stringify(state), start + minutes * 60000);
    check(state.beds[bed].stage === 'grown', `${crop}: becomes ready exactly on time, including after a reload`);
    check(growGarden(state, start + 30 * 86400000).beds[bed].stage === 'grown', `${crop}: stays ripe after a month away`);
    state = gardenAction(state, { kind: 'harvest', bed }, start + minutes * 60000);
    const key = CROP_INVENTORY[crop];
    check(state[key] === 1 && state.beds[bed].stage === 'empty', `${crop}: one harvest enters the basket and frees its bed`);
    const gifted = gardenAction(state, { kind: 'gift', crop });
    check(gifted[key] === 0 && HARVEST_COMPLIMENTS[crop].en && HARVEST_COMPLIMENTS[crop].ja, `${crop}: gifting consumes one item and has both compliment translations`);
    check(gardenAction(gifted, { kind: 'gift', crop }) === gifted, `${crop}: empty baskets cannot give duplicate gifts`);
    if (crop === 'mint') {
      check(gifted.mintTea === 1, 'Luma exchanges mint for special tea');
      const restored = readGarden(JSON.stringify(gifted));
      const drank = gardenAction(restored, { kind: 'drink' });
      check(drank.mintTea === 0 && gardenAction(drank, { kind: 'drink' }) === drank, 'Tea persists and can be drunk exactly once');
    }
  }
  const old = { beds: freshGarden().beds.slice(0, 4), mint: 7, carrots: 4, radishes: 3, crumbPouch: true };
  const preserved = readGarden(JSON.stringify(old));
  check(preserved.mint === 7 && preserved.carrots === 4 && preserved.radishes === 3 && preserved.crumbPouch && preserved.beds[4].stage === 'sprout', 'Existing saves retain harvests, pouch and beds, with a new mint sprout');
  const previous = { ...freshGarden(), beds: freshGarden().beds.slice(0, 5), carrots: 8, mintTea: 2, crumbPouch: true };
  delete previous.daisies;
  previous.beds[MINT_BED] = { crop: 'mint', stage: 'growing', wateredAt: start };
  const upgraded = readGarden(JSON.stringify(previous), start + 60000);
  check(JSON.stringify(upgraded.beds.slice(0, 5)) === JSON.stringify(previous.beds) && upgraded.carrots === 8 && upgraded.mintTea === 2 && upgraded.crumbPouch,
    'Five-bed saves preserve every existing bed, mint timer, inventory, prepared tea and pouch');
  check(upgraded.beds[DAISY_BED].crop === 'daisy' && upgraded.beds[DAISY_BED].stage === 'grown' && upgraded.daisies === 0,
    'Existing decorative daisies become a ready-to-pick bed on an older save');
  const empty = freshGarden(); empty.beds = empty.beds.map(bed => ({ ...bed, stage: 'empty' }));
  check(!gardenActionAllowed(empty, { kind: 'plant', bed: 0, crop: 'daisy' }) && !gardenActionAllowed(empty, { kind: 'plant', bed: DAISY_BED, crop: 'carrot' }),
    'Daisies keep their own bed without changing vegetable planting choices');
  const invalid = freshGarden(); invalid.beds[0] = { crop: 'carrot', stage: 'growing', wateredAt: 'bad' };
  check(readGarden(JSON.stringify(invalid)).beds[0].stage === 'sprout', 'Malformed growth timestamps recover as waterable sprouts');
  engine.setCompanions([]); engine.setGarden(freshGarden()); engine.setBlocked(false); engine.travel('mood');
  engine.life.update(.016, engine.elapsed, engine.player.position, false, false, engine.camera.quaternion);
  const luma = engine.life.residents[3];
  check(!luma.following && luma.root.position.distanceTo(engine.player.position) < 5, 'Luma hosts tea without changing the companion selection');
  const cameraStart = engine.cameraGoal.clone(); await delay(4600);
  check(engine.cameraGoal.distanceTo(cameraStart) > 3 && engine.player.position.x === 13.9, 'Tea camera gently pans to the garden-facing bench');
  await capture('tea-garden-view.png');
  engine.gardenAction({ kind: 'gift', crop: 'carrot' }); await delay(650);
  check(engine.life.giftHeart.visible && engine.life.giftProps.get('carrot').visible, 'Giving a harvest shows Luma holding it with a thank-you heart');
  check(Math.abs(luma.spirit.rotation.z) > .001, 'Luma wiggles and flutters to thank the gardener');
  await capture('luma-harvest.png');
  engine.life.update(.016, engine.elapsed, engine.player.position, true, false, engine.camera.quaternion);
  check(engine.life.giftHeart.visible && luma.spirit.rotation.z === 0 && luma.fins.every(fin => fin.rotation.z === 0), 'Reduced motion keeps the thank-you heart and gift without dancing');
  engine.gardenAction({ kind: 'drink' }); await delay(1000);
  check(engine.activities.cup.position.x < 15 && engine.activities.cup.position.y > 1.4, 'Drinking carries the cup from the table to the seated player');
  await capture('mint-tea-sip.png');
  engine.travel('garden'); const growing = freshGarden();
  growing.beds[2] = { crop: 'carrot', stage: 'growing', wateredAt: Date.now() - 150000 };
  growing.beds[MINT_BED] = { crop: 'mint', stage: 'growing', wateredAt: Date.now() - 90000 };
  growing.beds[DAISY_BED] = { crop: 'daisy', stage: 'growing', wateredAt: Date.now() - 90000 };
  engine.setGarden(growing); await delay(1200);
  check(engine.garden.beds[MINT_BED].mint.visible && engine.garden.beds[MINT_BED].root.scale.y > .5 && engine.garden.beds[MINT_BED].root.scale.y < .7, 'Mint visibly grows in its own bed');
  const daisy = engine.garden.beds[DAISY_BED];
  check(daisy.daisy.visible && daisy.root.scale.y > .5 && daisy.root.scale.y < .7 && engine.garden.clocks[DAISY_BED].sprite.visible,
    'Daisies visibly grow with a countdown in their raised bed');
  const harvested = gardenAction(growGarden(growing, Date.now() + GROWTH_MS.daisy), { kind: 'harvest', bed: DAISY_BED });
  engine.setGarden(harvested); engine.gardenAction({ kind: 'harvest', bed: DAISY_BED });
  engine.garden.update(.016, engine.garden.time + .1, false);
  check(!daisy.daisy.visible && !daisy.sprout.visible && engine.garden.harvest.name === 'Daisy', 'Picking daisies clears the flowers and animates a daisy harvest');
  const replanted = gardenAction(harvested, { kind: 'plant', bed: DAISY_BED, crop: 'daisy' }); engine.setGarden(replanted);
  check(daisy.sprout.visible && !daisy.daisy.visible, 'Replanting restores sprouts instead of full-size daisies');
  engine.setGarden(growing);
  const soil = []; engine.garden.group.traverse(o => { if (o.material?.name === 'Painted garden soil') soil.push(o); });
  check(soil.length > 0 && soil.every(o => o.material.map === engine.world.gardenSurfaces.ground.map), 'Garden soil uses the painted world ground texture');
  check(engine.garden.group.children.some(o => o.material === engine.world.gardenSurfaces.paving), 'Flower borders reuse the exact footpath material');
  await capture('growing-garden.png');
  engine.setPlace(null);
  const result = { pass: true, checks: results.length, results, browser: navigator.userAgent, limits: 'Boundary-time tests use an injected wall clock. Native UI waiting, persistence, layout and camera checks are recorded separately.' };
  await save('gentle-growth.json', JSON.stringify(result, null, 2)); return result;
}


export async function checkGardenDetails(engine, capture, save) {
  const results = [], check = (ok, label) => { if (!ok) throw Error(label); results.push(label); };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const start = 1800000000000;
  for (const crop of ['carrot', 'radish', 'mint', 'daisy']) {
    const bed = { crop, stage: 'growing', wateredAt: start };
    check(growthTimeLeft(bed, start) === `${GROWTH_MS[crop] / 60000}:00`, `${crop}: countdown starts at its full growth duration`);
    check(growthTimeLeft(bed, start + GROWTH_MS[crop] - 1) === '0:01', `${crop}: partial seconds round up until ready`);
    check(growthTimeLeft(bed, start + GROWTH_MS[crop] + 10000) === '0:00', `${crop}: countdown never becomes negative`);
  }
  const garden = engine.garden;
  check(garden.labels.length === 8 && garden.labels.every(label => label.text), 'All seven growing beds and the iris border have named wooden labels');
  engine.setLanguage('ja');
  check(garden.labels[MINT_BED].text === 'ミント・お茶の葉' && garden.labels.some(label => label.text === 'ひまわり'), 'Mint and flower labels follow the Japanese setting');
  engine.setLanguage('en');
  const state = freshGarden(); state.beds[2] = { crop: 'radish', stage: 'growing', wateredAt: Date.now() - 60000 };
  state.beds[3] = { crop: 'carrot', stage: 'growing', wateredAt: Date.now() - 80000 };
  state.beds[MINT_BED] = { crop: 'mint', stage: 'growing', wateredAt: Date.now() - 90000 };
  engine.setGarden(state); engine.travel('garden'); engine.setCompanions([]);
  await delay(1200);
  check(garden.labels[2].text === 'Radishes', 'A bed label follows the chosen crop');
  check(garden.clocks.filter(clock => clock.sprite.visible).length === 3, 'Only growing beds show a world countdown');
  const first = garden.clocks[2].text; await delay(1100);
  check(garden.clocks[2].text !== first, 'World countdown visibly advances with real elapsed time');
  check(BEDS[MINT_BED].x === BEDS[0].x && BEDS[MINT_BED].z - BEDS[2].z === BEDS[2].z - BEDS[0].z, 'Mint aligns with the left column and equal row spacing');
  const m = engine.movement; let samples = 0;
  for (let z = -11.4; z <= .6; z += .15) { if (!m.clear(24.7, z)) throw Error(`Central aisle obstructed at ${z.toFixed(2)}`); samples++; }
  for (const z of [-7.75, -3.25, .75]) for (let x = 19.7; x <= 29.2; x += .2) {
    if (!m.clear(x, z)) throw Error(`Cross aisle obstructed at ${x.toFixed(2)},${z}`); samples++;
  }
  check(samples > 200, 'More than 200 walking samples keep labels and bed borders out of garden aisles');
  engine.world.group.updateMatrixWorld(true);
  const ray = new T.Raycaster(), flat = []; ray.camera = engine.camera;
  for (const [x,z] of [[24.7,-10],[24.7,-5.5],[24.7,-1],[22.2,-7.75],[27.2,-3.25],[22.2,.75]]) {
    ray.set(new T.Vector3(x,5,z),new T.Vector3(0,-1,0));
    const hits = ray.intersectObject(engine.world.group,true).filter(hit => hit.object.isMesh && hit.object.material?.customProgramCacheKey?.().startsWith('village-path-shoulder'));
    flat.push(hits[0]?.point.y);
  }
  check(flat.every(y => Math.abs(y - .095) < .001), 'All garden aisles share one level continuous paving surface: ' + JSON.stringify(flat));
  const mint = garden.source.getObjectByName('Mint'), bounds = new T.Box3().setFromObject(mint);
  check(bounds.max.y - bounds.min.y > .7, 'New mint has full upright leafy stems');
  await capture('garden-labels-countdown.png');
  const camera = engine.camera.clone(); camera.clearViewOffset();
  camera.position.set(24.7,4.2,5.2); camera.lookAt(24.7,.35,-5.8);
  await capture('garden-front-alignment.png', camera);
  camera.position.set(21.5,2.3,1.6); camera.lookAt(22.2,.6,-1);
  await capture('mint-leaf-detail.png', camera);
  engine.setGarden(growGarden(state, Date.now() + GROWTH_MS.carrot)); await delay(100);
  check(garden.clocks.every(clock => !clock.sprite.visible), 'Countdowns disappear when crops become ready');
  engine.setPlace(null);
  const result = { pass:true, checks:results.length, results, walkingSamples:samples, browser:navigator.userAgent, limits:'Production-renderer and desktop browser evidence; no physical-device claim.' };
  await save('garden-details.json',JSON.stringify(result,null,2)); return result;
}

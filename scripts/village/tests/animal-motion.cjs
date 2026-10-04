// Animal routes, accepted-pose playback, reduced-motion reactions and bounded spatial calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText.replace('require("@/lib/basePath")', 'require("../../lib/basePath.ts")'), filename);
const { PondLifeSpace, POND_BIRDS } = require('../../../features/village/pondLife.ts');
const { owlPosition, owlFlightPosition } = require('../../../features/village/owlFlight.ts');
const { TownAnimalAudio } = require('../../../features/village/townAnimalAudio.ts');
const T = require('three');
const checks = [];
const check = (condition, label) => { assert(condition, label); checks.push(label); };
const length = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
const space = new PondLifeSpace();
for (let index = 0; index < POND_BIRDS.length; index++) {
  for (let time = 32; time < 65; time += .13) {
    const before = space.swim(index, time - .01, 39.8), after = space.swim(index, time + .01, 39.8);
    const heading = space.heading(index, time, 39.8), dx = after[0] - before[0], dz = after[2] - before[2];
    if (Math.hypot(dx, dz) > .00001) assert((Math.sin(heading) * dx + Math.cos(heading) * dz) / Math.hypot(dx, dz) > .999, `${index}: the +Z beak must point in the actual swimming direction`);
  }
  check(true, `${POND_BIRDS[index]} ${index}: swimming and feeding headings follow travel even below 1 cm/frame`);
  for (const boundary of [39.8, 43.8, 50.8, 56.8]) assert(length(space.swim(index, boundary - .00001, 39.8), space.swim(index, boundary + .00001, 39.8)) < .0002);
}
const transformed = new PondLifeSpace({ sceneVersion: 1, items: [{ id: 'pond', asset: 'pond', visible: true, position: [12, .5, 23], rotation: [0, 73, 0], scale: [2, 1, 1.4] }] });
check(Math.abs(transformed.swim(0, 41, -100)[1] - .2) < .00001 && Number.isFinite(transformed.heading(0, 41, -100)), 'Authored pond height, rotation and scale reach the swimming path and heading');
const home = { id: 'owl', asset: 'owl-brown', visible: true, position: [12, 2.4, 23], rotation: [0, 65, 0], scale: [1.3, 1.1, .8] };
const perch = { ...home, asset: 'owl-feeding-perch', position: [12, 0, 23] };
for (let index = 0; index < 3; index++) {
  let travelled = 0, previous = owlFlightPosition(home, index, 0), top = 0;
  for (let time = .02; time <= 46; time += .02) {
    const position = owlFlightPosition(home, index, time), step = length(position, previous);
    assert(step < .18, 'A routine owl flight cannot teleport between frames');
    top = Math.max(top, position[1]); travelled += step; previous = position;
  }
  check(travelled > 20 && top > 4.5, `Owl ${index}: continuous authored woodland loop takes off, glides and returns to the roost`);
  const feedAt = 108.3;
  for (const boundary of [feedAt, feedAt + 2.2, feedAt + 9.2, feedAt + 12]) assert(length(owlPosition(home, perch, index, boundary - .00001, feedAt), owlPosition(home, perch, index, boundary + .00001, feedAt)) < .001);
  check(true, `Owl ${index}: feeding intercepts an airborne loop and rejoins it without a teleport`);
  check(JSON.stringify(owlPosition(home, perch, index, feedAt + 5, feedAt)) === JSON.stringify(owlPosition(home, perch, index, feedAt + 5, feedAt)), `Owl ${index}: observers and late arrivals use the same accepted meal clock`);
}

class Node {
  constructor() { this.gain = { value: 0 }; this.playbackRate = { value: 1 }; this.positionX = { value: 0 }; this.positionY = { value: 0 }; this.positionZ = { value: 0 }; }
  connect(node) { this.connected = node; return node; }
  disconnect() { this.disconnected = true; }
  start() { this.started = true; }
  stop() { this.stopped = true; }
}
const context = { currentTime: 0, state: 'suspended', sources: [],
  createBufferSource() { const node = new Node(); this.sources.push(node); return node; }, createGain: () => new Node(), createPanner: () => new Node() };
const audio = new TownAnimalAudio(context, new Node());
for (const species of ['cow', 'sheep', 'lamb', 'hedgehog', 'owl']) audio.buffers.set(species, { duration: 1 });
audio.play({ species: 'owl', position: [1, 2, 3], happy: true });
check(context.sources.length === 0, 'Animal calls remain silent before explicit village audio activation');
context.state = 'running';
for (const species of ['cow', 'sheep', 'lamb', 'hedgehog', 'owl']) {
  context.currentTime += 3; audio.stop();
  audio.play({ species, position: [1, 2, 3], happy: true });
  const source = context.sources.at(-1), pan = source.connected.connected;
  check(source.started && pan.positionX.value === 1 && pan.positionY.value === 2 && pan.positionZ.value === 3 && pan.maxDistance === 12,
    `${species}: recorded call is spatial at the actual animal position`);
}
const before = context.sources.length;
for (let index = 0; index < 20; index++) audio.play({ species: 'cow', position: [0, 0, 0], happy: false });
check(context.sources.length === before, 'A busy animal channel drops a chorus of new calls');
audio.stop(); check(context.sources.every(source => source.stopped && source.disconnected), 'Stopping audio disconnects every animal call');
context.currentTime += 20;
const herd = [{ id: 'cow-a', species: 'cow', position: [2, 0, 0] }, { id: 'cow-b', species: 'cow', position: [3, 0, 0] }];
audio.nearby(herd, [0, 0, 0], false); check(context.sources.length === before, 'Standing near animals does not start walk-by greetings');
audio.nearby(herd, [0, 0, 0], true); const greeting = context.sources.at(-1);
check(context.sources.length === before + 1 && audio.heard.size === 2, 'A herd gives one greeting on approach');
context.currentTime += 1;
check(audio.play({ species: 'sheep', position: [2, 0, 0], happy: true }) && greeting.stopped, 'Petting interrupts a lower-priority greeting');
audio.voice.source.onended(); context.currentTime += 20;
audio.nearby(herd, [0, 0, 0], true); check(context.sources.length === before + 2, 'Remaining in the herd does not cycle through every animal');
audio.nearby(herd, [20, 0, 0], true); context.currentTime += 45;
audio.nearby(herd, [0, 0, 0], true); check(context.sources.length === before + 3, 'Leaving and returning after the cooldown allows a fresh greeting');
audio.dispose();

const nativeDocument = global.document, nativeNow = Date.now, nativePerformance = performance.now;
let now = 500000;
global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ strokeText() {}, fillText() {}, clearRect() {}, beginPath() {}, arc() {}, roundRect() {}, fill() {}, stroke() {} }) }) };
Date.now = () => now; performance.now = () => now;
try {
  const { TownAnimals } = require('../../../features/village/townAnimals.ts');
  const source = new T.Group(), assets = [['cow-highland', 'CowHighland', 'cow'], ['sheep', 'Sheep', 'sheep'], ['lamb', 'Lamb', 'lamb'], ['hedgehog', 'Hedgehog', 'hedgehog']];
  const items = assets.map(([asset, name], index) => {
    const template = new T.Group(); template.name = name; source.add(template);
    const body = new T.Group(); body.name = name + 'Body'; body.position.y = .4; template.add(body);
    const head = new T.Group(); head.name = name + 'Head'; body.add(head);
    for (const legName of ['FrontLeft', 'FrontRight', 'BackLeft', 'BackRight']) { const leg = new T.Group(); leg.name = name + 'Leg' + legName; template.add(leg); }
    const tail = new T.Group(); tail.name = name + 'Tail'; template.add(tail);
    return { id: asset, asset, visible: true, position: [index * 4, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
  });
  for (const name of ['ForageApple', 'ForageMushroom']) { const template = new T.Group(); template.name = name; source.add(template); }
  const calls = [], animals = new TownAnimals({ items }, source, new T.Group(), event => calls.push(event));
  let states = items.map((item, index) => ({ id: item.id, species: assets[index][2], x: item.position[0], y: 0, z: 0, heading: Math.PI / 2, owner: null, mode: 'graze', startedAt: now, until: 0, carry: null, forageSource: null, nextForageAt: 0 }));
  animals.applyShared({ animals: states }, now);
  const previous = animals.animals[0].root.position.x, speeds = [];
  let lastX = previous;
  for (let frame = 1; frame <= 120 * 2; frame++) {
    now = 500000 + frame * 1000 / 120;
    if (frame % 15 === 0) { states = states.map((state, index) => ({ ...state, x: items[index].position[0] + (now - 500000) / 1000 * .7 })); animals.applyShared({ animals: states }, now); }
    animals.update(1 / 120, false, new T.Quaternion());
    const x = animals.animals[0].root.position.x;
    if (frame > 60) speeds.push((x - lastX) * 120);
    lastX = x;
  }
  check(Math.max(...speeds) - Math.min(...speeds) < .001, 'Accepted 120 ms animal snapshots swim through 120 fps without bursty position easing');
  check(animals.animals.every(animal => Number.isFinite(animal.distance) && animal.distance > 1 && animal.speed > .65), 'Every species keeps a distance-driven gait at the accepted movement speed');
  now += 300; states = states.map(state => ({ ...state, mode: 'pet', owner: 'visitor', startedAt: now, until: now + 6000 }));
  animals.applyShared({ animals: states }, now); animals.update(1 / 60, false, new T.Quaternion());
  check(calls.filter(call => call.happy).length === 4, 'One accepted pet clock triggers one species call for each animal');
  now += 500; animals.update(1 / 60, false, new T.Quaternion());
  check(calls.filter(call => call.happy).length === 4 && animals.animals.every(animal => animal.hearts.every(heart => heart.visible) && animal.speech.visible), 'Rendering a held pet cannot repeat its voice, and all species display hearts and dialogue');
  animals.update(1 / 60, true, new T.Quaternion());
  check(animals.animals.every(animal => animal.model.rotation.z === 0 && animal.head.rotation.x === 0 && animal.head.rotation.y === 0 && animal.head.rotation.z === 0 && animal.legs.every(leg => leg.rotation.x === 0)), 'Reduced motion preserves the shared position and still heart/dialogue treatment while suppressing body, head and leg gestures');
  animals.reset(); check(animals.animals.every(animal => !animal.root.visible && !animal.speech.visible && animal.hearts.every(heart => !heart.visible)), 'Shared disconnect hides animal poses and all associated emotes');
  animals.dispose();
  const { TownScene } = require('../../../features/village/townScene.ts');
  const cropKit = new T.Group(), material = new T.MeshStandardMaterial();
  for (const name of ['Carrot', 'Radish', 'Mint', 'Sprout']) { const crop = new T.Group(); crop.name = name; crop.add(new T.Mesh(new T.BoxGeometry(.1, .4, .1), material)); cropKit.add(crop); }
  const owlKit = new T.Group(), owl = new T.Group(); owl.name = 'OwlBrown';
  const body = new T.Group(); body.name = 'OwlBody'; body.position.y = .34; owl.add(body);
  for (const name of ['OwlHead', 'OwlWingLeft', 'OwlWingRight']) { const part = new T.Group(); part.name = name; body.add(part); }
  owlKit.add(owl);
  const row = { ...home, id: 'row', asset: 'farm-row', position: [0, .04, 0] };
  const owlHomes = [-1, 0, 1].map((side, index) => ({ ...home, id: `owl-${index}`, position: [home.position[0] + side * .69, home.position[1], home.position[2]] }));
  const townScene = new TownScene({ items: [row, ...owlHomes, perch] }, cropKit, owlKit, event => calls.push(event));
  const serverNow = now + 8000, bed = { id: 'row', crop: 'mint', plantedAt: serverNow, wateredAt: serverNow, growAt: serverNow + 120000 };
  townScene.applyShared({ beds: [bed], owlFeedAt: serverNow - 6000, owlUntil: serverNow + 6000 }, serverNow);
  townScene.update(false, new T.Quaternion());
  check(townScene.clocks[0].sprite.visible && townScene.clocks[0].text === '2:00', 'Farm floating timer uses accepted growAt and the server clock even with an eight-second client-clock difference');
  check(townScene.hearts.visible && townScene.owls.filter(owl => owl.speech.visible).length === 1, 'Accepted owl supper displays every heart pool and one readable Hoot Hoot response at a time');
  townScene.update(true, new T.Quaternion());
  check(townScene.owls.every(owl => owl.head.rotation.x === 0 && owl.wings.every(wing => wing.rotation.z === 0)) && townScene.hearts.visible, 'Reduced-motion owl supper keeps still readable feedback');
  townScene.applyShared({ beds: [bed], owlFeedAt: serverNow - 6000, owlUntil: serverNow + 6000 }, serverNow + 20);
  check(townScene.owls.every(owl => owl.head.rotation.x === 0 && owl.wings.every(wing => wing.rotation.z === 0)) && townScene.hearts.visible, 'Accepted Worker snapshots preserve the current reduced-motion owl pose');
  const firstOwlCalls = calls.filter(call => call.species === 'owl' && call.happy).length;
  for (const turn of [1, 2]) {
    now += 1400; townScene.update(false, new T.Quaternion());
    check(townScene.owls[turn].speech.visible && townScene.owls.filter(owl => owl.speech.visible).length === 1, `Owl ${turn}: the accepted clock gives each owl its own non-overlapping speech turn`);
  }
  check(calls.filter(call => call.species === 'owl' && call.happy).length === firstOwlCalls, 'An accepted group owl meal gives one short audible response while all three birds keep their speech turns');
  townScene.applyShared({ beds: [{ ...bed, wateredAt: null, growAt: null }], owlFeedAt: null }, serverNow);
  check(!townScene.clocks[0].sprite.visible && !townScene.hearts.visible, 'An unwatered farm row and absent accepted owl meal cannot gain a timer or happy hearts');
  townScene.applyShared(undefined, serverNow);
  check(townScene.owls.every(owl => !owl.root.visible && !owl.speech.visible) && !townScene.clocks[0].sprite.visible, 'Shared reset hides the farm timers and owl effects');
  townScene.dispose(); material.dispose(); audio.dispose();
} finally { global.document = nativeDocument; Date.now = nativeNow; performance.now = nativePerformance; }
console.log(`${checks.length} focused animal motion/audio checks passed.\n${checks.join('\n')}`);

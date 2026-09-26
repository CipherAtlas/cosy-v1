import * as T from 'three';
import { VillageLife } from './modules/features/village/life.js';
import { VillageMovement } from './modules/features/village/movement.js';
import { BRIDGE, HEARTH } from './modules/features/village/environment.js';

export function checkResidents() {
  const results = [];
  const check = (condition, name) => { if (!condition) throw Error(name); results.push(name); };
  const create = (colliders = []) => {
    const life = new VillageLife(new T.Group(), colliders);
    life.residents.forEach((r, i) => {
      r.movement.settle(25 + i * 3, 25); r.root.position.set(25 + i * 3, 0, 25);
      r.route = [[25 + i * 3, 25]]; r.waypoint = 0; r.pause = 0;
    });
    return life;
  };
  const tick = (life, player, seconds, fps = 60, allowed = true) => {
    for (let i = 0; i < seconds * fps; i++) life.update(1 / fps, i / fps, player, false, allowed);
  };
  const dispose = life => {
    life.dispose();
    life.group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  };
  const distances = [];
  for (const fps of [30, 60, 120]) {
    const life = create(), player = new T.Vector3(25, 0, 30), r = life.residents[0];
    try {
      tick(life, player, 5, fps);
      const distance = r.root.position.distanceTo(player);
      check(distance > 2 && distance < 2.3 && r.encounter.state === 'visit', `Approach stops with personal space at ${fps} fps`);
      check(life.residents.filter(r => ['approach', 'visit'].includes(r.encounter.state)).length === 1, `One resident approaches at a time at ${fps} fps`);
      distances.push(distance);
      if (fps === 60) {
        const atRest = r.root.position.clone(); tick(life, player, 2);
        check(atRest.distanceTo(r.root.position) < .01, 'Resident settles without orbiting or shuffling');
        tick(life, player, 40);
        check(r.root.position.distanceTo(new T.Vector3(25, 0, 25)) < .25 && r.encounter.state === 'roam', 'Resident returns to their original routine');
        check(r.encounter.noticed, 'Staying nearby does not repeatedly summon the same resident');
        tick(life, new T.Vector3(0, 0, 20), 16); tick(life, player, 1);
        check(r.encounter.state === 'approach', 'Leaving and returning allows a new greeting');
        tick(life, player, 8, 60, false);
        check(r.encounter.state === 'roam' && r.root.position.z < 25.25, 'Opening a menu cancels the approach and returns the resident');
      }
    } finally { dispose(life); }
  }
  check(Math.max(...distances) - Math.min(...distances) < .06, 'Approach distance stays consistent across frame rates');
  for (const index of [1, 2, 3]) {
    const life = create(), r = life.residents[index];
    try {
      life.residents.forEach((other, i) => { other.encounter.noticed = i !== index; });
      tick(life, new T.Vector3(r.root.position.x, 0, 30), 6);
      check(r.encounter.state === 'visit' && r.root.position.z > 27, `${r.root.name} also walks over to greet the player`);
    } finally { dispose(life); }
  }
  const walled = create([{ x: 25, z: 27, w: 8, d: 1, top: 3 }]);
  try {
    tick(walled, new T.Vector3(25, 0, 30), 4);
    check(walled.residents[0].encounter.state === 'roam', 'Residents do not approach through a wall');
  } finally { dispose(walled); }
  const water = new VillageMovement([], () => {});
  water.settle(BRIDGE.x + 4, 8);
  check(!water.canWalkTo(BRIDGE.x - 4, 8), 'Approach planning rejects a river shortcut');
  water.settle(BRIDGE.x + 4, BRIDGE.z);
  check(water.canWalkTo(BRIDGE.x - 4, BRIDGE.z), 'Approach planning accepts the real bridge');
  const runaway = create();
  try {
    tick(runaway, new T.Vector3(25, 0, 30), 1);
    tick(runaway, new T.Vector3(25, 0, 40), 8);
    check(runaway.residents[0].root.position.z < 25.25 && runaway.residents[0].encounter.state === 'roam', 'Walking away ends pursuit and returns the resident');
  } finally { dispose(runaway); }
  const paused = create();
  try {
    tick(paused, new T.Vector3(25, 0, 30), 5, 60, false);
    check(paused.residents.every(r => r.encounter.state === 'roam'), 'Arrival and activities do not attract villagers');
  } finally { dispose(paused); }
  return { pass: true, checks: results.length, results, browser: navigator.userAgent };
}

// Exercise the authored circuits against the loaded world's real colliders and paving.
export function checkRoaming(engine) {
  const results = [], samples = [];
  const check = (condition, name) => { if (!condition) throw Error(name); results.push(name); };
  const dispose = life => {
    const geometries = new Set(), materials = new Set();
    life.group.traverse(o => { if (o.isMesh) { geometries.add(o.geometry); materials.add(o.material); } });
    life.dispose(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
  };
  for (const fps of [30, 60, 120]) {
    const life = new VillageLife(new T.Group(), engine.world.colliders);
    try {
      for (const r of life.residents) {
        if (fps === 30) {
          const blocked = r.route.filter((point, i) => {
            r.movement.settle(...point);
            return !r.movement.canWalkTo(...r.route[(i + 1) % r.route.length]);
          });
          check(!blocked.length, `${r.root.name}: every route segment clears buildings, furniture and water`);
        }
        r.movement.settle(...r.route[0]);
      }
      const journeys = life.residents.map(r => ({ name: r.root.name, reached: new Set([0]), last: r.waypoint, laps: 0,
        minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }));
      const player = new T.Vector3(38, 0, 40);
      for (let frame = 0; frame < 240 * fps; frame++) {
        life.update(1 / fps, frame / fps, player, false, false);
        life.residents.forEach((r, i) => {
          const journey = journeys[i], p = r.root.position;
          journey.minX = Math.min(journey.minX, p.x); journey.maxX = Math.max(journey.maxX, p.x);
          journey.minZ = Math.min(journey.minZ, p.z); journey.maxZ = Math.max(journey.maxZ, p.z);
          if (journey.last !== r.waypoint) {
            journey.reached.add(journey.last); if (r.waypoint === 0) journey.laps++;
            journey.last = r.waypoint;
          }
        });
      }
      journeys.forEach((journey, i) => {
        check(journey.reached.size === life.residents[i].route.length && journey.laps >= 2,
          `${journey.name}: completes every waypoint and repeats the circuit at ${fps} fps`);
        check(journey.maxX - journey.minX > 4 && journey.maxZ - journey.minZ > 12,
          `${journey.name}: explores a wider area in both directions at ${fps} fps`);
      });
      samples.push({ fps, residents: journeys.map(j => ({ name: j.name, laps: j.laps, waypoints: j.reached.size,
        width: j.maxX - j.minX, depth: j.maxZ - j.minZ })) });
    } finally { dispose(life); }
  }
  const navigation = engine.world.group.getObjectByName('Village wayfinding');
  const posts = navigation.children.filter(o => o.userData.signpost);
  check(posts.length === 3, 'Wayfinding is limited to three useful junctions');
  const obstacles = posts.map(post => ({ name: post.name,
    collider: engine.world.colliders.find(c => Math.hypot(c.x - post.position.x, c.z - post.position.z) < .01) }));
  engine.world.colliders.filter(c => c.top === 1.4 && Math.hypot(c.x - HEARTH.x, c.z - HEARTH.z) < 4)
    .forEach((collider, i) => obstacles.push({ name: `Hearth bench ${i + 1}`, collider }));
  check(obstacles.length === 6, 'All three hearth benches and sign footprints are checked');
  const paving = [];
  engine.world.group.traverse(o => {
    if (o.isMesh && o.material.customProgramCacheKey().startsWith('village-path-shoulder')) paving.push(o);
  });
  check(paving.length > 0, 'Clearance checks use the rendered streets including their shoulders');
  engine.world.group.updateMatrixWorld(true);
  const ray = new T.Raycaster(), down = new T.Vector3(0, -1, 0), margin = .35;
  for (const { name, collider: c } of obstacles) {
    check(!!c, `${name}: physical footprint exists`);
    let overlaps = false;
    const width = c.w + margin * 2, depth = c.d + margin * 2;
    const nx = Math.ceil(width / .1), nz = Math.ceil(depth / .1);
    for (let ix = 0; ix <= nx; ix++) for (let iz = 0; iz <= nz; iz++) {
      ray.set(new T.Vector3(c.x - width / 2 + width * ix / nx, 8, c.z - depth / 2 + depth * iz / nz), down);
      if (ray.intersectObjects(paving, false).length) overlaps = true;
    }
    check(!overlaps, `${name}: entire footprint stays at least 35 cm off the street`);
  }
  return { pass: true, checks: results.length, results, samples, browser: navigator.userAgent };
}

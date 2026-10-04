// Real collider/water routes plus a blocked endpoint regression for both patrol renderers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText, file);
const { VillageNavigation } = require('../../../features/village/navigation.ts');
const { VillageMovement } = require('../../../features/village/movement.ts');
const { projectWorldLayout } = require('../../../features/village/worldLayout.ts');
const { setAuthoredWorld } = require('../../../features/village/environment.ts');
const { PUPPY_PATROLS, RESIDENT_ROUTES } = require('../../../features/village/sharedActors.ts');
const { VILLAGERS } = require('../../../features/village/villagers.ts');
let checks = 0;
const check = (condition, name) => { assert(condition, name); checks++; };
const blank = { sceneVersion: 1, openWorld: true, paths: [], fences: [], structures: {}, grass: [], clearings: [], walkable: [],
  trees: [], benches: [], swings: [], crumbPouches: [], puppies: [], routes: {}, items: [], terrain: { base: 0, samples: [] } };
setAuthoredWorld(blank);
const blocked = [{ x: 0, z: 0, w: 2, d: 2 }];
const probe = new VillageMovement(blocked, () => {}), navigation = new VillageNavigation(blocked, blank);
const route = navigation.safeRoute([[0, 0], [0, 5]]);
check(route.length === 2 && route.every(point => probe.clear(...point)), 'A prop on an authored waypoint resolves to clear patrol endpoints');
probe.settle(...route[1]);
const path = navigation.path(route[1], route[0]);
check(path.length && Math.hypot(...path.at(-1).map((value, i) => value - route[0][i])) < .01,
  'A normalized blocked waypoint is reached, allowing the patrol to advance');
check(path.every(point => { const clear = probe.canWalkTo(...point); probe.settle(...point); return clear; }),
  'The detour around a blocked waypoint has walkable swept segments');
const world = projectWorldLayout(require('../../../public/village/world-layout.json'));
const physics = require('../../../worker/world-physics.json');
setAuthoredWorld(world);
const actual = new VillageNavigation(physics.colliders, world), movement = new VillageMovement(physics.colliders, () => {});
for (const placement of world.puppies) {
  const points = actual.safeRoute(PUPPY_PATROLS[placement.breed].map(([dx, dz]) => [
    placement.x + dx * Math.cos(placement.yaw) + dz * Math.sin(placement.yaw),
    placement.z - dx * Math.sin(placement.yaw) + dz * Math.cos(placement.yaw),
  ]));
  check(points.length > 1 && points.every(point => movement.clear(...point)), `${placement.id} has clear patrol waypoints`);
  for (let i = 0; i < points.length; i++) {
    const from = points[i], to = points[(i + 1) % points.length];
    const planned = actual.path(from, to);
    movement.settle(...from);
    check(planned.length && planned.every(point => { const clear = movement.canWalkTo(...point); movement.settle(...point); return clear; })
      && Math.hypot(movement.position.x - to[0], movement.position.z - to[1]) < .05,
    `${placement.id} patrol leg ${i + 1} follows clear ground and reaches its waypoint`);
  }
}
for (const [index, profile] of VILLAGERS.entries()) {
  const points = actual.safeRoute(world.routes[profile.id]?.points ?? RESIDENT_ROUTES[index]);
  check(points.length > 1 && points.every(point => movement.clear(...point)), `${profile.id} has clear resident waypoints`);
  for (let i = 0; i < points.length; i++) {
    const from = points[i], to = points[(i + 1) % points.length];
    const planned = actual.path(from, to);
    movement.settle(...from);
    check(planned.length && planned.every(point => { const clear = movement.canWalkTo(...point); movement.settle(...point); return clear; })
      && Math.hypot(movement.position.x - to[0], movement.position.z - to[1]) < .05,
    `${profile.id} resident leg ${i + 1} follows clear ground and reaches its waypoint`);
  }
}
console.log(`${checks} patrol navigation checks passed.`);

import * as T from 'three';
import { VillageLife } from './modules/features/village/life.js';
import { VillageMovement } from './modules/features/village/movement.js';
import { BRIDGE } from './modules/features/village/environment.js';

export function checkResidents() {
  const results = [], clips = ['Walk', 'Idle'].map(name => new T.AnimationClip(name, 1, []));
  const check = (condition, name) => { if (!condition) throw Error(name); results.push(name); };
  const create = (colliders = []) => {
    const life = new VillageLife(new T.Group(), clips, colliders);
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

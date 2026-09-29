import * as T from "three";
import { floorHeight, type Collider } from "./environment";
import { VillageMovement } from "./movement";
import { VillageNavigation } from "./navigation";
import type { AuthoredWorld, PuppyBreed, PuppyPlacement } from "./worldLayout";

export const PUPPY_INFO: Record<PuppyBreed, { model: string; name: string; breed: string; japanese: string }> = {
  corgi: { model: "Mochi", name: "Mochi", breed: "corgi", japanese: "モチ" },
  shiba: { model: "Kiko", name: "Kiko", breed: "Shiba Inu", japanese: "キコ" },
  beagle: { model: "Biscuit", name: "Biscuit", breed: "beagle", japanese: "ビスケット" },
  samoyed: { model: "Cloud", name: "Cloud", breed: "Samoyed", japanese: "クラウド" },
};
export type NearbyPuppy = { id: string; name: string; breed: PuppyBreed };
type Puppy = {
  info: NearbyPuppy; actor: T.Group; model: T.Object3D; head: T.Object3D; ears: T.Object3D[];
  legs: T.Object3D[]; tail: T.Object3D; movement: VillageMovement; route: [number, number][];
  waypoint: number; path: [number, number][]; pause: number; petAge: number; petting: boolean;
  heading: number; phase: number; hearts: T.Mesh[]; heightOffset: number;
  nextFollowPath: number; followGoal: [number, number] | null; lostAge: number; stuckAge: number;
};

const PATROLS: Record<PuppyBreed, [number, number][]> = {
  corgi: [[0, 0], [1.6, -1.6], [2.5, -3.2], [.5, -3.8]],
  shiba: [[0, 0], [1.3, -2], [2.5, -3.5], [.2, -3.8]],
  beagle: [[0, 0], [-1.3, .8], [-2, 2.3], [-.4, 3.1]],
  samoyed: [[0, 0], [1, -2], [1.4, -4.5], [-.8, -3.7]],
};
const FOLLOW_DISTANCE = 1.2;
const FOLLOW_SIDE = .65;

function heartGeometry() {
  const shape = new T.Shape();
  shape.moveTo(0, -.12); shape.bezierCurveTo(-.17, .01, -.18, .19, 0, .1);
  shape.bezierCurveTo(.18, .19, .17, .01, 0, -.12);
  return new T.ShapeGeometry(shape, 12);
}

/** Small residents who use the same collision and route rules as the village spirits. */
export class PuppyPack {
  readonly group = new T.Group();
  readonly puppies: Puppy[] = [];
  private navigation: VillageNavigation;
  private nextBark = 5;
  private followingId: string | null = null;
  private playerTrail: [number, number][] = [];

  constructor(source: T.Object3D, placements: PuppyPlacement[], colliders: Collider[], authored: AuthoredWorld,
    private onSound: (breed: PuppyBreed, position: [number, number, number], kind: "bark" | "happy") => void) {
    this.navigation = new VillageNavigation(colliders, authored);
    for (const [index, placement] of placements.entries()) {
      const prototype = source.getObjectByName(PUPPY_INFO[placement.breed].model);
      if (!prototype) continue;
      const model = prototype.clone(true), actor = new T.Group();
      model.position.set(0, 0, 0); model.rotation.set(0, 0, 0);
      model.traverse(node => { if (node instanceof T.Mesh) { node.castShadow = true; node.receiveShadow = true; } });
      const movement = new VillageMovement(colliders, () => {});
      movement.settle(placement.x, placement.z);
      const heightOffset = placement.y - floorHeight(placement.x, placement.z);
      actor.position.set(placement.x, placement.y, placement.z);
      actor.rotation.y = placement.yaw;
      actor.scale.fromArray(placement.scale);
      actor.add(model); this.group.add(actor);
      const point = ([dx, dz]: [number, number]): [number, number] => [
        placement.x + dx * Math.cos(placement.yaw) + dz * Math.sin(placement.yaw),
        placement.z - dx * Math.sin(placement.yaw) + dz * Math.cos(placement.yaw),
      ];
      const route = PATROLS[placement.breed].map(point).filter(([x, z]) => movement.clear(x, z));
      if (!route.length) route.push([placement.x, placement.z]);
      const hearts = [0, 1].map(i => {
        const mesh = new T.Mesh(heartGeometry(), new T.MeshBasicMaterial({ color: i ? "#ffd9a4" : "#f2a9b3", transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false }));
        mesh.visible = false; actor.add(mesh); return mesh;
      });
      const name = placement.name || PUPPY_INFO[placement.breed].name;
      this.puppies.push({ info: { id: placement.id, name, breed: placement.breed }, actor, model,
        head: model.getObjectByName(PUPPY_INFO[placement.breed].model + "Head")!,
        ears: ["EarLeft", "EarRight"].map(part => model.getObjectByName(PUPPY_INFO[placement.breed].model + part)!),
        legs: ["FrontLeft", "FrontRight", "BackLeft", "BackRight"].map(part => model.getObjectByName(PUPPY_INFO[placement.breed].model + "Leg" + part)!),
        tail: model.getObjectByName(PUPPY_INFO[placement.breed].model + "Tail")!, movement, route,
        waypoint: route.length > 1 ? 1 : 0, path: [], pause: 2 + index * 1.5,
        petAge: 100, petting: false, heading: placement.yaw, phase: index * 1.9, hearts, heightOffset,
        nextFollowPath: 0, followGoal: null, lostAge: 0, stuckAge: 0 });
    }
  }

  get follower(): NearbyPuppy | null {
    return this.puppies.find(puppy => puppy.info.id === this.followingId)?.info ?? null;
  }

  invite(id: string, player: T.Vector3, heading: number): NearbyPuppy | null {
    const puppy = this.puppies.find(value => value.info.id === id);
    if (!puppy || this.nearest(player)?.id !== id || puppy.petting) return null;
    this.dismiss();
    this.followingId = id;
    this.playerTrail = [
      [player.x - Math.sin(heading) * FOLLOW_DISTANCE, player.z - Math.cos(heading) * FOLLOW_DISTANCE],
      [player.x, player.z],
    ];
    puppy.path = []; puppy.followGoal = null; puppy.nextFollowPath = 0; puppy.lostAge = puppy.stuckAge = 0;
    puppy.pause = 0;
    return puppy.info;
  }

  dismiss(): NearbyPuppy | null {
    const puppy = this.puppies.find(value => value.info.id === this.followingId);
    if (!puppy) return null;
    this.followingId = null;
    this.playerTrail = [];
    puppy.path = []; puppy.followGoal = null; puppy.nextFollowPath = 0; puppy.lostAge = puppy.stuckAge = 0;
    puppy.waypoint = 0; puppy.pause = 0;
    return puppy.info;
  }

  private trailingPoint(): [number, number] {
    let remaining = FOLLOW_DISTANCE;
    for (let index = this.playerTrail.length - 1; index > 0; index--) {
      const end = this.playerTrail[index], start = this.playerTrail[index - 1];
      const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
      if (remaining <= length) return [end[0] + (start[0] - end[0]) * remaining / length,
        end[1] + (start[1] - end[1]) * remaining / length];
      remaining -= length;
    }
    return this.playerTrail[0];
  }

  nearest(player: T.Vector3): NearbyPuppy | null {
    const closest = this.puppies.filter(p => !p.petting).map(p => ({ p, distance: Math.hypot(player.x - p.actor.position.x, player.z - p.actor.position.z) }))
      .filter(value => value.distance < 2.35).sort((a, b) => a.distance - b.distance)[0];
    return closest?.p.info ?? null;
  }

  pet(id: string, player: T.Vector3): boolean {
    const puppy = this.puppies.find(p => p.info.id === id);
    if (!puppy || this.nearest(player)?.id !== id || puppy.petting) return false;
    puppy.petting = true; puppy.petAge = 0; puppy.pause = 4.2; puppy.path = []; puppy.stuckAge = 0;
    puppy.movement.pause();
    this.onSound(puppy.info.breed, [puppy.actor.position.x, puppy.actor.position.y + .6, puppy.actor.position.z], "happy");
    return true;
  }

  update(delta: number, elapsed: number, player: T.Vector3, reduced: boolean, active: boolean,
    cameraRotation?: T.Quaternion, playerHeading = 0) {
    if (active && this.followingId) {
      const last = this.playerTrail.at(-1)!;
      const travel = Math.hypot(player.x - last[0], player.z - last[1]);
      if (travel > 5) {
        this.playerTrail = [
          [player.x - Math.sin(playerHeading) * FOLLOW_DISTANCE, player.z - Math.cos(playerHeading) * FOLLOW_DISTANCE],
          [player.x, player.z],
        ];
      } else if (travel > .25) {
        this.playerTrail.push([player.x, player.z]);
        if (this.playerTrail.length > 120) this.playerTrail.shift();
      }
    }
    if (active && elapsed >= this.nextBark) {
      this.nextBark = elapsed + 18 + Math.random() * 20;
      const nearby = this.puppies.filter(p => !p.petting && Math.hypot(player.x - p.actor.position.x, player.z - p.actor.position.z) < 13);
      if (nearby.length) {
        const puppy = nearby[Math.floor(Math.random() * nearby.length)];
        this.onSound(puppy.info.breed, [puppy.actor.position.x, puppy.actor.position.y + .6, puppy.actor.position.z], "bark");
      }
    }
    for (const puppy of this.puppies) {
      const { actor, model, movement } = puppy;
      puppy.petAge += delta;
      if (puppy.petting && puppy.petAge > 2.9) puppy.petting = false;
      let walking = false;
      if (active && puppy.petting && puppy.petAge < .85) {
        const dx = player.x - movement.position.x, dz = player.z - movement.position.z, distance = Math.hypot(dx, dz);
        const approach = Math.max(0, distance - 1.25);
        if (approach > .08 && movement.canWalkTo(player.x - dx / distance * 1.25, player.z - dz / distance * 1.25)) {
          movement.update(delta, { x: dx / distance * .55, z: dz / distance * .55, run: false, sprint: false, blocked: false });
          walking = movement.speed > .08;
        } else movement.pause();
      } else if (active && !puppy.petting && puppy.info.id === this.followingId) {
        const baseTarget = this.trailingPoint();
        let target = baseTarget;
        const last = this.playerTrail.at(-1)!, previous = this.playerTrail.at(-2)!;
        const forwardX = last[0] - previous[0], forwardZ = last[1] - previous[1];
        const forwardLength = Math.hypot(forwardX, forwardZ) || 1;
        const sideTarget: [number, number] = [target[0] - forwardZ / forwardLength * FOLLOW_SIDE,
          target[1] + forwardX / forwardLength * FOLLOW_SIDE];
        if (movement.clear(...sideTarget)) target = sideTarget;
        const distance = Math.hypot(player.x - movement.position.x, player.z - movement.position.z);
        puppy.lostAge = distance > 18 ? puppy.lostAge + delta : 0;
        if (puppy.lostAge > 4 && movement.clear(...target)) {
          movement.settle(...target);
          puppy.path = []; puppy.followGoal = null; puppy.lostAge = 0;
        }
        const gap = Math.hypot(target[0] - movement.position.x, target[1] - movement.position.z);
        if (gap > .45) {
          if (elapsed >= puppy.nextFollowPath && (!puppy.followGoal ||
            Math.hypot(target[0] - puppy.followGoal[0], target[1] - puppy.followGoal[1]) > .6 || !puppy.path.length)) {
            puppy.path = this.navigation.path([movement.position.x, movement.position.z], target);
            if (!puppy.path.length && target !== baseTarget) {
              target = baseTarget;
              puppy.path = this.navigation.path([movement.position.x, movement.position.z], target);
            }
            puppy.followGoal = target;
            puppy.nextFollowPath = elapsed + (distance > 8 ? 1.2 : .55);
          }
          while (puppy.path.length && Math.hypot(puppy.path[0][0] - movement.position.x,
            puppy.path[0][1] - movement.position.z) < .35) puppy.path.shift();
          const next = puppy.path[0];
          if (next) {
            const dx = next[0] - movement.position.x, dz = next[1] - movement.position.z;
            const length = Math.hypot(dx, dz);
            movement.update(delta, { x: dx / length, z: dz / length,
              run: distance > 1.8, sprint: distance > 4.5, blocked: false });
            walking = movement.speed > .08;
            puppy.heading = Math.atan2(dx, dz);
          } else movement.pause();
          puppy.stuckAge = walking ? 0 : puppy.stuckAge + delta;
          if (puppy.stuckAge > .8) {
            puppy.path = []; puppy.nextFollowPath = elapsed; puppy.stuckAge = 0;
          }
        } else {
          movement.pause(); puppy.stuckAge = 0;
          puppy.heading = Math.atan2(player.x - movement.position.x, player.z - movement.position.z);
        }
      } else if (active && !puppy.petting) {
        puppy.pause = Math.max(0, puppy.pause - delta);
        const target = puppy.route[puppy.waypoint];
        if (puppy.pause <= 0 && puppy.route.length > 1) {
          if (!puppy.path.length) puppy.path = this.navigation.path([movement.position.x, movement.position.z], target);
          const next = puppy.path[0];
          if (next && Math.hypot(next[0] - movement.position.x, next[1] - movement.position.z) < .25) puppy.path.shift();
          const waypoint = puppy.path[0];
          if (waypoint) {
            const dx = waypoint[0] - movement.position.x, dz = waypoint[1] - movement.position.z, length = Math.hypot(dx, dz);
            movement.update(delta, { x: dx / length * .48, z: dz / length * .48, run: false, sprint: false, blocked: false });
            walking = movement.speed > .08;
            puppy.heading = Math.atan2(dx, dz);
          } else movement.pause();
          puppy.stuckAge = walking ? 0 : puppy.stuckAge + delta;
          if (puppy.stuckAge > .8) {
            puppy.path = this.navigation.path([movement.position.x, movement.position.z], target);
            puppy.stuckAge = 0;
          }
          if (Math.hypot(target[0] - movement.position.x, target[1] - movement.position.z) < .35) {
            puppy.waypoint = (puppy.waypoint + 1) % puppy.route.length;
            puppy.path = []; puppy.pause = puppy.waypoint === 0 ? 5 : 2.3; puppy.stuckAge = 0;
          }
        } else movement.pause();
      } else movement.pause();
      actor.position.set(movement.position.x, movement.position.y + puppy.heightOffset, movement.position.z);
      const desiredHeading = puppy.petting ? Math.atan2(player.x - actor.position.x, player.z - actor.position.z) : puppy.heading;
      const turn = T.MathUtils.euclideanModulo(desiredHeading - actor.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
      actor.rotation.y += turn * (1 - Math.exp(-delta * 6));
      const happy = puppy.petting || puppy.petAge < 4.2 || puppy.info.id === this.followingId;
      const hop = reduced ? 0 : puppy.petting ? Math.max(0, Math.sin(puppy.petAge * 11)) * .085 : walking ? Math.abs(Math.sin(elapsed * 8 + puppy.phase)) * .035 : 0;
      model.position.y = hop;
      model.rotation.x = reduced ? 0 : puppy.petting ? Math.sin(Math.min(1, puppy.petAge / 2.9) * Math.PI) * .09 : 0;
      model.rotation.z = reduced ? 0 : happy ? Math.sin(elapsed * 10 + puppy.phase) * .07 : walking ? Math.sin(elapsed * 7 + puppy.phase) * .025 : 0;
      puppy.head.rotation.z = reduced ? 0 : puppy.petting ? Math.sin(puppy.petAge * 4) * .18 : Math.sin(elapsed * 1.7 + puppy.phase) * .035;
      puppy.head.rotation.x = reduced ? 0 : puppy.petting ? .10 + Math.sin(puppy.petAge * 7) * .08 : 0;
      puppy.tail.rotation.y = reduced ? 0 : Math.sin(elapsed * (happy ? 14 : walking ? 8 : 3) + puppy.phase) * (happy ? .68 : .28);
      puppy.ears.forEach((ear, i) => { ear.rotation.z = reduced ? 0 : Math.sin(elapsed * (happy ? 11 : 4) + i * Math.PI + puppy.phase) * (happy ? .13 : .04); });
      puppy.legs.forEach((leg, i) => { leg.rotation.x = reduced ? 0 : walking ? Math.sin(elapsed * 9 + (i === 0 || i === 3 ? 0 : Math.PI)) * .27 : puppy.petting && i < 2 ? Math.sin(puppy.petAge * 8 + i) * .14 : 0; });
      puppy.hearts.forEach((heart, i) => {
        const age = puppy.petAge - .35 - i * .28;
        heart.visible = !reduced && age > 0 && age < 1.45;
        if (!heart.visible) return;
        heart.position.set((i ? .25 : -.23) + Math.sin(age * 4 + i) * .05, .95 + age * .28, .65);
        if (cameraRotation) heart.quaternion.copy(cameraRotation);
        (heart.material as T.MeshBasicMaterial).opacity = Math.min(1, age * 5) * Math.min(1, (1.45 - age) * 3);
      });
    }
  }
}

import * as T from "three";
import { PUPPY_PATROLS, type SharedActor } from "./sharedActors";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { PuppyAnimation } from "./puppyAnimation";
import { floorHeight, type Collider } from "./environment";
import { VillageMovement } from "./movement";
import { VillageNavigation } from "./navigation";
import type { AuthoredWorld, PuppyBreed, PuppyPlacement } from "./worldLayout";
import type { SharedPuppyTrick } from "./sharedWorld";

export const PUPPY_INFO: Record<PuppyBreed, { model: string; name: string; breed: string; japanese: string }> = {
  corgi: { model: "Mochi", name: "Mochi", breed: "corgi", japanese: "モチ" },
  shiba: { model: "Kiko", name: "Kiko", breed: "Shiba Inu", japanese: "キコ" },
  beagle: { model: "Biscuit", name: "Biscuit", breed: "beagle", japanese: "ビスケット" },
  samoyed: { model: "Cloud", name: "Cloud", breed: "Samoyed", japanese: "クラウド" },
  collie: { model: "Fern", name: "Fern", breed: "Border Collie", japanese: "ファーン" },
  shepherd: { model: "Atlas", name: "Atlas", breed: "German Shepherd", japanese: "アトラス" },
};
export type NearbyPuppy = { id: string; name: string; breed: PuppyBreed; owner?: string | null };
export type PuppyCommand = "sit" | "dance" | "spin" | "bow" | "wave" | "roll";
export const PUPPY_TRICKS: { command: PuppyCommand; key: string; english: string; japanese: string }[] = [
  { command: "sit", key: "Z", english: "Sit", japanese: "おすわり" },
  { command: "dance", key: "X", english: "Dance", japanese: "ダンス" },
  { command: "spin", key: "V", english: "Spin", japanese: "まわって" },
  { command: "bow", key: "Q", english: "Bow", japanese: "おじぎ" },
  { command: "wave", key: "J", english: "Wave", japanese: "おてて" },
  { command: "roll", key: "K", english: "Roll over", japanese: "ごろん" },
];
export const puppyCommandForKey = (key: string) => PUPPY_TRICKS.find(trick => trick.key.toLowerCase() === key.toLowerCase())?.command;
type Puppy = {
  info: NearbyPuppy; actor: T.Group; model: T.Object3D; body: T.Object3D; head: T.Object3D; ears: T.Object3D[];
  legs: T.Object3D[]; tail: T.Object3D; movement: VillageMovement; route: [number, number][];
  waypoint: number; path: [number, number][]; pause: number; petAge: number; petting: boolean;
  heading: number; hearts: T.Mesh[]; heightOffset: number;
  nextFollowPath: number; followGoal: [number, number] | null; stuckAge: number;
  command: PuppyCommand | null; commandAge: number; animation: PuppyAnimation;
  petTarget: [number, number] | null; petApproachAge: number;
  sharedStartedAt: number | null;
};

const FOLLOW_DISTANCE = 1.55;
const FOLLOW_SIDE = .8;

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
  private probe: VillageMovement;
  private nextBark = 5;
  private followingIds: string[] = [];
  private playerTrail: [number, number][] = [];
  singleFile = false;
  private openAge = 0;
  private followHeading = 0;
  private previousPlayer = new T.Vector3();
  private interactionId: string | null = null;
  private sharedStates: Map<string, SharedActor> | null = null;
  private selfId = "";
  private sharedClock = 0;

  applyShared(states: SharedActor[], selfId: string, time: number) {
    this.selfId = selfId; this.sharedClock = time - Date.now();
    const initial = !this.sharedStates;
    this.sharedStates = new Map(states.filter(state => state.kind === "puppy").map(state => [state.id, state]));
    this.followingIds = states.filter(state => state.kind === "puppy" && state.following && state.owner === selfId).map(state => state.id);
    for (const puppy of this.puppies) {
      const state = this.sharedStates.get(puppy.info.id);
      if (!state) continue;
      if (initial || puppy.actor.position.distanceTo(new T.Vector3(state.x, state.y, state.z)) > 4) puppy.actor.position.set(state.x, state.y, state.z);
      const newAction = puppy.sharedStartedAt !== state.startedAt || puppy.command !== state.action;
      if (!initial && newAction && (state.mode === "pet" || state.mode === "trick" && ["dance", "spin"].includes(state.action ?? "")))
        this.onSound(puppy.info.breed, [state.x, state.y + .6, state.z], "happy");
      if (state.mode === "trick" && state.action && newAction)
        puppy.animation.start(state.action, Math.max(0, (time - state.startedAt) / 1000));
      if (state.mode === "pet" && (!puppy.petting || puppy.sharedStartedAt !== state.startedAt)) puppy.animation.start("pet", Math.max(0, (time - state.startedAt) / 1000));
      puppy.petting = state.mode === "pet";
      puppy.petTarget = state.mode === "petApproach" ? [state.x, state.z] : null;
      puppy.command = state.mode === "trick" ? state.action : null;
      puppy.sharedStartedAt = state.startedAt;
    }
  }
  get sharedFollowers() { return this.followers; }

  constructor(source: T.Object3D, clips: T.AnimationClip[], placements: PuppyPlacement[], colliders: Collider[], authored: AuthoredWorld,
    private onSound: (breed: PuppyBreed, position: [number, number, number], kind: "bark" | "happy") => void) {
    this.navigation = new VillageNavigation(colliders, authored);
    this.probe = new VillageMovement(colliders, () => {});
    for (const [index, placement] of placements.entries()) {
      const prototype = source.getObjectByName(PUPPY_INFO[placement.breed].model);
      if (!prototype) continue;
      const model = cloneSkeleton(prototype), actor = new T.Group();
      model.position.set(0, 0, 0); model.rotation.set(0, 0, 0);
      model.traverse(node => {
        if (node instanceof T.Mesh) { node.castShadow = true; node.receiveShadow = true; }
        // The bind-pose bounds cannot contain a standing dance or a lifted paw.
        if (node instanceof T.SkinnedMesh) node.frustumCulled = false;
      });
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
      const route = PUPPY_PATROLS[placement.breed].map(point).filter(([x, z]) => movement.clear(x, z));
      if (!route.length) route.push([placement.x, placement.z]);
      const hearts = [0, 1].map(i => {
        const mesh = new T.Mesh(heartGeometry(), new T.MeshBasicMaterial({ color: i ? "#ffd9a4" : "#f2a9b3", transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false }));
        mesh.visible = false; actor.add(mesh); return mesh;
      });
      const name = placement.name || PUPPY_INFO[placement.breed].name;
      this.puppies.push({ info: { id: placement.id, name, breed: placement.breed }, actor, model,
        body: model.getObjectByName(PUPPY_INFO[placement.breed].model + "Body")!,
        head: model.getObjectByName(PUPPY_INFO[placement.breed].model + "Head")!,
        ears: ["EarLeft", "EarRight"].map(part => model.getObjectByName(PUPPY_INFO[placement.breed].model + part)!),
        legs: ["FrontLeft", "FrontRight", "BackLeft", "BackRight"].map(part => model.getObjectByName(PUPPY_INFO[placement.breed].model + "Leg" + part)!),
        tail: model.getObjectByName(PUPPY_INFO[placement.breed].model + "Tail")!, movement, route,
        waypoint: route.length > 1 ? 1 : 0, path: [], pause: 2 + index * 1.5,
        petAge: 100, petting: false, heading: placement.yaw, hearts, heightOffset,
        nextFollowPath: 0, followGoal: null, stuckAge: 0,
        command: null, commandAge: 0, petTarget: null, petApproachAge: 0, sharedStartedAt: null,
        animation: new PuppyAnimation(model, clips, PUPPY_INFO[placement.breed].model, index * 1.9) });
    }
  }

  get followers(): NearbyPuppy[] {
    return this.followingIds.map(id => this.puppies.find(puppy => puppy.info.id === id)!.info);
  }

  private beginWalk(player: T.Vector3, heading: number) {
    if (this.followingIds.length) return;
    this.followHeading = heading;
    this.previousPlayer.copy(player);
    this.playerTrail = [[player.x - Math.sin(heading) * 10, player.z - Math.cos(heading) * 10], [player.x, player.z]];
  }

  private join(puppy: Puppy) {
    if (!this.followingIds.includes(puppy.info.id)) this.followingIds.push(puppy.info.id);
    puppy.path = []; puppy.followGoal = null; puppy.nextFollowPath = 0; puppy.stuckAge = 0;
    puppy.pause = 0; puppy.command = null;
  }

  invite(id: string, player: T.Vector3, heading: number): NearbyPuppy | null {
    const puppy = this.puppies.find(value => value.info.id === id);
    if (!puppy || this.nearest(player)?.id !== id || puppy.petting) return null;
    this.beginWalk(player, heading);
    this.join(puppy);
    return puppy.info;
  }

  dismiss(id?: string): NearbyPuppy[] {
    const leaving = this.puppies.filter(puppy => this.followingIds.includes(puppy.info.id) && (!id || puppy.info.id === id));
    this.followingIds = this.followingIds.filter(value => !leaving.some(puppy => puppy.info.id === value));
    if (!this.followingIds.length) this.playerTrail = [];
    for (const puppy of leaving) {
      puppy.path = []; puppy.followGoal = null; puppy.nextFollowPath = 0; puppy.stuckAge = 0;
      puppy.waypoint = 0; puppy.pause = 0; puppy.command = null;
      puppy.petting = false; puppy.petTarget = null; puppy.petAge = 100;
    }
    return leaving.map(puppy => puppy.info);
  }

  private trailingPoint(remaining: number): [number, number] {
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
    if (this.pettingPuppy) return null;
    const held = this.puppies.find(puppy => puppy.info.id === this.interactionId);
    if (held && Math.hypot(player.x - held.actor.position.x, player.z - held.actor.position.z) < 2.65
      && held.movement.canWalkTo(player.x, player.z)) return { ...held.info, owner: this.sharedStates?.get(held.info.id)?.owner };
    this.interactionId = null;
    const closest = this.puppies.filter(p => this.sharedStates || !p.petting && !p.petTarget).map(p => ({ p, distance: Math.hypot(player.x - p.actor.position.x, player.z - p.actor.position.z) }))
      .filter(value => value.distance < 2.35 && value.p.movement.canWalkTo(player.x, player.z)).sort((a, b) => a.distance - b.distance)[0];
    return closest ? { ...closest.p.info, owner: this.sharedStates?.get(closest.p.info.id)?.owner } : null;
  }

  setInteraction(id: string | null) { this.interactionId = id; }

  pet(id: string, player: T.Vector3): boolean {
    const puppy = this.puppies.find(p => p.info.id === id);
    if (!puppy || this.nearest(player)?.id !== id || this.puppies.some(p => p.petting || p.petTarget)) return false;
    const dx = puppy.actor.position.x - player.x, dz = puppy.actor.position.z - player.z;
    const length = Math.hypot(dx, dz) || 1;
    const target: [number, number] = [player.x + dx / length * 1.14, player.z + dz / length * 1.14];
    if (!puppy.movement.clear(...target)) return false;
    puppy.petTarget = target; puppy.petApproachAge = 0; puppy.petAge = 100;
    puppy.pause = 4.2; puppy.path = this.navigation.path([puppy.movement.position.x, puppy.movement.position.z], target); puppy.stuckAge = 0;
    puppy.command = null;
    puppy.movement.pause();
    return true;
  }

  cancelPet() {
    for (const puppy of this.puppies) if (puppy.petting || puppy.petTarget) {
      puppy.petting = false; puppy.petTarget = null; puppy.path = []; puppy.petAge = 100;
    }
  }

  get pettingPuppy() { return this.puppies.find(puppy => (puppy.petting || puppy.petTarget) && (!this.sharedStates || this.sharedStates.get(puppy.info.id)?.owner === this.selfId)) ?? null; }

  petContact(heading = 0, side = -1): T.Vector3 | null {
    const puppy = this.pettingPuppy;
    if (!puppy?.petting) return null;
    puppy.actor.updateWorldMatrix(true, true);
    // Put the tiny paddle just outside the near cheek; the blob moves to meet it.
    const size = puppy.actor.scale.y;
    return puppy.head.getWorldPosition(new T.Vector3()).add(new T.Vector3(
      Math.cos(heading) * side * .38 * size, -.07 * size, -Math.sin(heading) * side * .38 * size));
  }

  private walkToward(puppy: Puppy, delta: number, target: [number, number], speed: number, player: T.Vector3) {
    const position = puppy.movement.position;
    let dx = target[0] - position.x, dz = target[1] - position.z;
    const gap = Math.hypot(dx, dz);
    if (gap < .04) { puppy.movement.pause(); return; }
    dx /= gap; dz /= gap;
    // Yield to nearby dogs and the player; fixed slots prevent crowding at a stop.
    for (const other of this.puppies) {
      if (other === puppy) continue;
      const ox = position.x - other.movement.position.x, oz = position.z - other.movement.position.z;
      const distance = Math.hypot(ox, oz);
      if (distance > .001 && distance < .98) {
        const push = (.98 - distance) * 3;
        dx += ox / distance * push; dz += oz / distance * push;
      }
    }
    const px = position.x - player.x, pz = position.z - player.z, distance = Math.hypot(px, pz);
    if (distance < 1 && distance > .001) {
      dx += px / distance * (1 - distance) * 4;
      dz += pz / distance * (1 - distance) * 4;
    }
    const length = Math.hypot(dx, dz) || 1;
    puppy.heading = Math.atan2(dx, dz);
    const turn = T.MathUtils.euclideanModulo(puppy.heading - puppy.actor.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
    const throttle = Math.min(speed, gap * 3) * Math.max(.18, Math.cos(turn));
    const oldX = position.x, oldZ = position.z;
    puppy.movement.update(delta, { x: dx / length * throttle / 2.6, z: dz / length * throttle / 2.6,
      run: false, sprint: false, blocked: false });
    // Reject penetrations instead of shoving a neighbour through a wall or water.
    if (this.puppies.some(other => other !== puppy &&
      Math.hypot(position.x - other.movement.position.x, position.z - other.movement.position.z) < .68 &&
      Math.hypot(oldX - other.movement.position.x, oldZ - other.movement.position.z) >= .68)) {
      puppy.movement.settle(oldX, oldZ);
    }
  }

  command(id: string, action: PuppyCommand, player: T.Vector3): NearbyPuppy | null {
    const puppy = this.puppies.find(value => value.info.id === id);
    if (!puppy || this.nearest(player)?.id !== id || puppy.petting) return null;
    puppy.command = action;
    puppy.sharedStartedAt = null;
    puppy.commandAge = 0;
    puppy.animation.start(action);
    puppy.pause = 1.1;
    puppy.path = [];
    puppy.stuckAge = 0;
    puppy.heading = Math.atan2(player.x - puppy.actor.position.x, player.z - puppy.actor.position.z);
    puppy.movement.pause();
    if (action === "dance" || action === "spin") {
      puppy.petAge = 0;
      this.onSound(puppy.info.breed, [puppy.actor.position.x, puppy.actor.position.y + .6, puppy.actor.position.z], "happy");
    }
    return puppy.info;
  }

  sharedTrick(trick: SharedPuppyTrick) {
    const puppy = this.puppies.find(value => value.info.id === trick.id);
    const age = Math.max(0, (Date.now() - trick.startedAt) / 1000);
    if (!puppy || !PUPPY_TRICKS.some(value => value.command === trick.command)
      || ![trick.x, trick.z, trick.heading, trick.startedAt].every(Number.isFinite)
      || age >= puppy.animation.duration(trick.command) || !puppy.movement.clear(trick.x, trick.z)) return false;
    puppy.petting = false; puppy.petTarget = null; puppy.path = []; puppy.stuckAge = 0;
    puppy.movement.settle(trick.x, trick.z);
    puppy.actor.position.set(trick.x, puppy.movement.position.y + puppy.heightOffset, trick.z);
    puppy.actor.rotation.y = puppy.heading = trick.heading;
    puppy.command = trick.command; puppy.commandAge = age; puppy.sharedStartedAt = trick.startedAt;
    puppy.animation.start(trick.command, age);
    return true;
  }

  update(delta: number, elapsed: number, player: T.Vector3, reduced: boolean, active: boolean,
    cameraRotation?: T.Quaternion, playerHeading = 0) {
    if (this.sharedStates) {
      const now = Date.now() + this.sharedClock;
      for (const puppy of this.puppies) {
        const state = this.sharedStates.get(puppy.info.id);
        if (!state) continue;
        const blend = 1 - Math.exp(-delta * 18);
        puppy.actor.position.lerp(new T.Vector3(state.x, state.y, state.z), blend);
        puppy.movement.position = { x: puppy.actor.position.x, y: floorHeight(puppy.actor.position.x, puppy.actor.position.z), z: puppy.actor.position.z };
        puppy.heading = state.heading;
        puppy.actor.rotation.y += Math.atan2(Math.sin(state.heading - puppy.actor.rotation.y), Math.cos(state.heading - puppy.actor.rotation.y)) * blend;
        const age = Math.max(0, (now - state.startedAt) / 1000);
        puppy.commandAge = age; puppy.petAge = state.mode === "pet" ? age : 100;
        const action = puppy.command ?? (puppy.petting ? "pet" : null);
        if (action) puppy.animation.actions[action].time = age;
        puppy.animation.update(action ? 0 : delta, state.speed, puppy.command, puppy.petting, reduced, true, delta);
        puppy.hearts.forEach((heart, index) => {
          const heartAge = age - .35 - index * .28;
          heart.visible = puppy.petting && !reduced && heartAge > 0 && heartAge < 1.45;
          if (!heart.visible) return;
          heart.position.set(index ? .25 : -.23, .95 + heartAge * .28, .65);
          if (cameraRotation) heart.quaternion.copy(cameraRotation);
          (heart.material as T.MeshBasicMaterial).opacity = Math.min(1, heartAge * 5, (1.45 - heartAge) * 3);
        });
      }
      return;
    }
    if (active && this.followingIds.length) {
      const last = this.playerTrail.at(-1)!;
      const travel = Math.hypot(player.x - last[0], player.z - last[1]);
      const dx = player.x - this.previousPlayer.x, dz = player.z - this.previousPlayer.z;
      if (Math.hypot(dx, dz) > .01 && travel < 5) {
        const heading = Math.atan2(dx, dz);
        const turn = T.MathUtils.euclideanModulo(heading - this.followHeading + Math.PI, Math.PI * 2) - Math.PI;
        this.followHeading += turn * (1 - Math.exp(-delta * 8));
      }
      this.previousPlayer.copy(player);
      if (travel > 5) {
        this.followHeading = playerHeading;
        this.playerTrail = [[player.x - Math.sin(playerHeading) * 10, player.z - Math.cos(playerHeading) * 10], [player.x, player.z]];
      } else if (travel > .12) {
        this.playerTrail.push([player.x, player.z]);
        if (this.playerTrail.length > 180) this.playerTrail.shift();
      }
      let open = true;
      for (let row = 0; row < Math.ceil(this.followingIds.length / 2); row++) {
        const point = this.trailingPoint(FOLLOW_DISTANCE + row * 1.35);
        this.probe.settle(...point);
        for (const side of [-1, 1]) if (!this.probe.canWalkTo(point[0] + Math.cos(this.followHeading) * FOLLOW_SIDE * side,
          point[1] - Math.sin(this.followHeading) * FOLLOW_SIDE * side)) open = false;
      }
      if (!open) { this.singleFile = true; this.openAge = 0; }
      else if (this.singleFile) { this.openAge += delta; if (this.openAge > .8) this.singleFile = false; }
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
      const { actor, movement } = puppy;
      if (active && puppy.petting) puppy.petAge += delta;
      if (puppy.petting && puppy.petAge >= 3) { puppy.petting = false; puppy.petTarget = null; }
      if (puppy.command && (active || puppy.sharedStartedAt !== null)) {
        puppy.commandAge = puppy.sharedStartedAt === null ? puppy.commandAge + delta : Math.max(0, (Date.now() - puppy.sharedStartedAt) / 1000);
        if (puppy.commandAge >= puppy.animation.duration(puppy.command)) puppy.command = null;
      }
      let walking = false;
      const slot = this.followingIds.indexOf(puppy.info.id);
      if (!active || puppy.command || puppy.petting) movement.pause();
      else if (puppy.petTarget) {
        puppy.petApproachAge += delta;
        const gap = Math.hypot(puppy.petTarget[0] - movement.position.x, puppy.petTarget[1] - movement.position.z);
        const facing = Math.atan2(player.x - movement.position.x, player.z - movement.position.z);
        const turn = T.MathUtils.euclideanModulo(facing - actor.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
        if (gap < .12) {
          movement.pause(); puppy.heading = facing;
          if (Math.abs(turn) < .15) {
            puppy.petting = true; puppy.petAge = 0; puppy.animation.start("pet");
            this.onSound(puppy.info.breed, [actor.position.x, actor.position.y + .6, actor.position.z], "happy");
          }
        } else {
          while (puppy.path.length > 1 && Math.hypot(puppy.path[0][0] - movement.position.x, puppy.path[0][1] - movement.position.z) < .18) puppy.path.shift();
          const next = puppy.path[0];
          if (next) this.walkToward(puppy, delta, next, 1.15, player); else movement.pause();
        }
        if (puppy.petApproachAge > 5 || Math.hypot(player.x - puppy.petTarget[0], player.z - puppy.petTarget[1]) > 1.6) this.cancelPet();
      } else if (puppy.info.id === this.interactionId) movement.pause();
      else if (slot >= 0) {
        const baseTarget = this.trailingPoint(FOLLOW_DISTANCE + (this.singleFile ? slot * 1.15 : Math.floor(slot / 2) * 1.35));
        const side = this.singleFile ? 0 : (slot % 2 ? 1 : -1) * FOLLOW_SIDE;
        const target: [number, number] = [baseTarget[0] + Math.cos(this.followHeading) * side, baseTarget[1] - Math.sin(this.followHeading) * side];
        const distance = Math.hypot(player.x - movement.position.x, player.z - movement.position.z);
        const gap = Math.hypot(target[0] - movement.position.x, target[1] - movement.position.z);
        const waitingForPet = !!this.pettingPuppy && distance < 5;
        if (gap > .18 && !waitingForPet) {
          const direct = gap < 3 && movement.canWalkTo(...target);
          if (direct) { puppy.path = [target]; puppy.followGoal = target; }
          else if (elapsed >= puppy.nextFollowPath && (!puppy.followGoal ||
            Math.hypot(target[0] - puppy.followGoal[0], target[1] - puppy.followGoal[1]) > .35 || !puppy.path.length)) {
            puppy.path = this.navigation.path([movement.position.x, movement.position.z], target);
            puppy.followGoal = target;
            puppy.nextFollowPath = elapsed + .55 + slot * .045;
          }
          while (puppy.path.length > 1 && Math.hypot(puppy.path[0][0] - movement.position.x,
            puppy.path[0][1] - movement.position.z) < .23) puppy.path.shift();
          const next = puppy.path[0];
          if (next) this.walkToward(puppy, delta, next, distance > 5 ? 5.8 : distance > 2.5 ? 4.3 : 2.6, player);
          else movement.pause();
          walking = movement.speed > .08;
          puppy.stuckAge = walking ? 0 : puppy.stuckAge + delta;
          if (puppy.stuckAge > .8) { puppy.path = []; puppy.nextFollowPath = elapsed; puppy.stuckAge = 0; }
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
            this.walkToward(puppy, delta, waypoint, 1.25, player);
            walking = movement.speed > .08;
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
      if (active) actor.rotation.y += turn * (1 - Math.exp(-delta * 6));
      if (puppy.sharedStartedAt !== null && puppy.command) puppy.animation.actions[puppy.command].time = puppy.commandAge;
      puppy.animation.update(puppy.sharedStartedAt !== null && puppy.command ? 0 : delta,
        movement.speed, puppy.command, puppy.petting, reduced, active, delta);
      puppy.hearts.forEach((heart, i) => {
        const age = puppy.petAge - .35 - i * .28;
        heart.visible = active && puppy.petting && !reduced && age > 0 && age < 1.45;
        if (!heart.visible) return;
        heart.position.set((i ? .25 : -.23) + Math.sin(age * 4 + i) * .05, .95 + age * .28, .65);
        if (cameraRotation) heart.quaternion.copy(cameraRotation);
        (heart.material as T.MeshBasicMaterial).opacity = Math.min(1, age * 5) * Math.min(1, (1.45 - age) * 3);
      });
    }
  }

  dispose() { this.puppies.forEach(puppy => puppy.animation.dispose()); }
}

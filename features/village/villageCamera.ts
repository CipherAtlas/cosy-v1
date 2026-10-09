import * as T from "three";
import { ACTIVITY_STAGES } from "./sharedActors";
import { BIRD_CLEARING, floorHeight, type Collider } from "./environment";
import type { PlaceId } from "./places";
import type { PuppyPack } from "./puppies";
import type { VillageSwingSet } from "./swings";
import type { TownAnimal } from "./townShared";
import type { WorldItem } from "./worldLayout";
import { SceneSight } from "./sceneSight";

const NO_ITEMS: WorldItem[] = [];

/** Reuses scratch vectors while calculating activity, walking and swing viewpoints. */
export class VillageCamera {
  readonly goal = new T.Vector3();
  readonly look = new T.Vector3();
  private temp = new T.Vector3();
  private orbit = new T.Spherical();
  private collisionBox = new T.Box3();
  private cameraRay = new T.Ray();
  private cameraHit = new T.Vector3();
  private sight = new SceneSight();
  private preferred = new T.Vector3();
  private candidate = new T.Vector3();
  private foliageSource?: WorldItem[];
  private solidSource?: Collider[];
  private viewSolids: Collider[] = [];
  private dockScale = new T.Vector3(1, 1, 1);

  private viewObstacles(colliders: Collider[], items: WorldItem[]) {
    if (this.foliageSource !== items || this.solidSource !== colliders) {
      this.foliageSource = items; this.solidSource = colliders;
      this.viewSolids = [...colliders]; this.dockScale.set(1, 1, 1);
      for (const item of items) {
        if (!item.visible) continue;
        if (item.asset === "dock") this.dockScale.fromArray(item.scale);
        if (item.asset.startsWith("willow-")) this.viewSolids.push({
          x: item.position[0], z: item.position[2], w: 8 * item.scale[0], d: 8 * item.scale[2],
          bottom: item.position[1] + .9 * item.scale[1], top: item.position[1] + 8 * item.scale[1],
        });
        if (item.asset === "horse-stable") {
          // Roofs are deliberately absent from walking physics; they still obstruct a camera.
          const yaw = T.MathUtils.degToRad(item.rotation[1]), cosine = Math.abs(Math.cos(yaw)), sine = Math.abs(Math.sin(yaw));
          this.viewSolids.push({ x: item.position[0], z: item.position[2],
            w: cosine * 9.6 * item.scale[0] + sine * 6.4 * item.scale[2],
            d: sine * 9.6 * item.scale[0] + cosine * 6.4 * item.scale[2],
            bottom: item.position[1] + 3.28 * item.scale[1], top: item.position[1] + 4.9 * item.scale[1] });
        }
      }
    }
    return this.viewSolids;
  }

  private avoidSolids(colliders: Collider[], minimumDistance: number) {
    this.sight.setColliders(colliders, .28);
    this.preferred.subVectors(this.goal, this.look);
    const full = this.preferred.length();
    const clear = this.sight.clearance(this.look, this.goal);
    if (clear >= full - .01) return;
    if (clear >= minimumDistance + .2) {
      this.goal.copy(this.look).addScaledVector(this.preferred, (clear - .2) / full); return;
    }
    // Keep a readable visitor size near rails/roofs instead of zooming into their body.
    let best = clear - .2, bestScore = -Infinity;
    this.goal.copy(this.look).addScaledVector(this.preferred, Math.max(.55, best) / full);
    const yaw = Math.atan2(this.preferred.x, this.preferred.z), horizontal = Math.hypot(this.preferred.x, this.preferred.z);
    for (const lift of [this.preferred.y, Math.min(this.preferred.y, .55), this.preferred.y + 2.4]) {
      for (const turn of [0, Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2, Math.PI]) {
        this.candidate.set(this.look.x + Math.sin(yaw + turn) * horizontal, this.look.y + lift,
          this.look.z + Math.cos(yaw + turn) * horizontal);
        const length = this.candidate.distanceTo(this.look), clearance = this.sight.clearance(this.look, this.candidate);
        const usable = clearance >= length - .01 ? length : Math.max(.55, clearance - .2);
        const score = Math.min(usable, minimumDistance + 1) - Math.abs(turn) * .16 - Math.abs(lift - this.preferred.y) * .04;
        if (score > bestScore && usable > best) {
          best = usable; bestScore = score;
          this.goal.copy(this.candidate).sub(this.look).multiplyScalar(usable / length).add(this.look);
        }
        if (usable >= minimumDistance && clearance >= length - .01) return;
      }
    }
  }
  titleScreen(time: number) {
    // Frame the existing village from above the entrance, without moving the visitor.
    this.look.set(-4, 2, -13);
    this.goal.set(27 + Math.sin(time * .055) * 4, 19 + Math.sin(time * .07) * .6, 42 + Math.cos(time * .055) * 2);
  }
  animal(state: TownAnimal, player: T.Vector3, position: T.Vector3, colliders: Collider[], items: WorldItem[] = []) {
    const cow = state.species === "cow", distance = cow ? 4.1 : 3.4;
    const dx = position.x - player.x, dz = position.z - player.z, length = Math.hypot(dx, dz) || 1;
    this.look.copy(player).lerp(position, .5); this.look.y = player.y + (cow ? 1.45 : .75);
    const angle = Math.atan2(-dz, dx);
    const obstacles = state.species === "hedgehog" ? [...colliders, ...items.filter(item => item.visible && item.asset === "apple-tree").map(item => ({
      x: item.position[0], z: item.position[2], w: 3.8 * item.scale[0], d: 3.8 * item.scale[2],
      bottom: item.position[1] + 1.7 * item.scale[1], top: item.position[1] + 5 * item.scale[1],
    }))] : colliders;
    let best = -1;
    // Try both sides and the diagonals so an orchard or cottage cannot hide a tiny friend.
    for (const offset of [0, Math.PI, Math.PI / 4, -Math.PI / 4, Math.PI * .75, -Math.PI * .75, Math.PI / 2, -Math.PI / 2]) {
      this.temp.set(this.look.x - dx / length * .4 + Math.sin(angle + offset) * distance,
        player.y + (cow ? 2.7 : 2.05), this.look.z - dz / length * .4 + Math.cos(angle + offset) * distance);
      this.cameraRay.origin.copy(this.look); this.cameraRay.direction.subVectors(this.temp, this.look).normalize();
      const full = this.temp.distanceTo(this.look); let clear = full;
      for (const collider of obstacles) {
        this.collisionBox.min.set(collider.x - collider.w / 2 - .2, collider.bottom ?? 0, collider.z - collider.d / 2 - .2);
        this.collisionBox.max.set(collider.x + collider.w / 2 + .2, collider.top ?? 8, collider.z + collider.d / 2 + .2);
        if (this.collisionBox.containsPoint(this.look)) continue;
        if (this.cameraRay.intersectBox(this.collisionBox, this.cameraHit)) clear = Math.min(clear, Math.max(.55, this.cameraHit.distanceTo(this.look) - .2));
      }
      if (clear > best) { best = clear; this.goal.copy(this.look).addScaledVector(this.cameraRay.direction, clear); }
      if (clear >= full - .01) break;
    }
    this.goal.y = Math.max(this.goal.y, floorHeight(this.goal.x, this.goal.z) + .3);
  }
  swing(swing: VillageSwingSet, yaw: number, pitch: number, compactView: boolean, colliders?: Collider[]) {
    swing.root.localToWorld(this.look.set(0, compactView ? 2 : 1.6, 0));
    const distance = (compactView ? 10.5 : 7.3) * swing.placement.scale[0];
    this.goal.copy(this.look).add(this.temp.set(Math.sin(yaw) * Math.cos(pitch) * distance,
      Math.sin(pitch) * distance + .7, Math.cos(yaw) * Math.cos(pitch) * distance));
    if (colliders) this.avoidSolids(colliders, 3.8);
    this.goal.y = Math.max(this.goal.y, floorHeight(this.goal.x, this.goal.z) + .4);
  }
  activity(place: PlaceId, { teaPan, companionCount, compactView, activityOrbit, colliders, items = NO_ITEMS }: {
    teaPan: number; companionCount: number; compactView: boolean;
    activityOrbit: { yaw: number; pitch: number }; colliders: Collider[]; items?: WorldItem[];
  }) {
    const stage=ACTIVITY_STAGES[place], obstacles = this.viewObstacles(colliders, items);
    this.goal.fromArray(stage.camera);
    this.look.fromArray(stage.look);
    if (place === "breathe") {
      // Approach the pond from its open bank rather than from inside the willow canopy.
      const yaw = stage.yaw - Math.PI, x = -4.9 * this.dockScale.x, z = 2.5 * this.dockScale.z;
      this.goal.x += Math.cos(yaw) * x + Math.sin(yaw) * z;
      this.goal.y += .7 * this.dockScale.y;
      this.goal.z += -Math.sin(yaw) * x + Math.cos(yaw) * z;
      // Aim farther along the dock's open bank so the visitor sits left of the
      // right-hand activity panel even in an iPad portrait viewport.
      this.look.x += Math.cos(yaw) * 4.5 * this.dockScale.x;
      this.look.z -= Math.sin(yaw) * 4.5 * this.dockScale.x;
    }
    if (place === "focus") {
      this.goal.set(110.3, 2.9, 3.45);
      this.look.set(109.85, 1.2, -1.65);
    }
    if (place === "mood") {
      this.goal.lerp(this.temp.set(11.6, 2.6, -8.3), 1 - teaPan);
    }
    if (companionCount) {
      this.goal.sub(this.look).multiplyScalar(place === "focus" ? 1.28 : 1.15).add(this.look);
      this.goal.y += .2;
    }
    if (compactView && place === "mood") {
      // Keep both the gardener and Luma above the activity controls.
      this.look.set(15.2, 1.35, -10.7);
      this.goal.x = this.look.x + (this.goal.x - this.look.x) * 1.8;
      this.goal.z = this.look.z + (this.goal.z - this.look.z) * 1.8;
    } else if (compactView && place === "birds") {
      this.look.set(BIRD_CLEARING.x, .3, BIRD_CLEARING.z);
      this.goal.set(BIRD_CLEARING.x + 7, 7.3, BIRD_CLEARING.z + 10.5);
    } else if(compactView) {
      this.temp.fromArray(stage.actor).y+=1.1;
      this.look.lerp(this.temp,.7);
    }
    if (activityOrbit.yaw !== 0 || activityOrbit.pitch !== 0) {
      this.orbit.setFromVector3(this.temp.subVectors(this.goal, this.look));
      this.orbit.theta += activityOrbit.yaw;
      this.orbit.phi = T.MathUtils.clamp(this.orbit.phi - activityOrbit.pitch, .2, Math.PI / 2 - .04);
      this.goal.copy(this.look).add(this.temp.setFromSpherical(this.orbit));
    }
    if (place === "focus") {
      // Keep the orbit inside the cottage walls and below its ceiling.
      this.goal.set(T.MathUtils.clamp(this.goal.x, 106.5, 113.5),
        T.MathUtils.clamp(this.goal.y, .6, 3.9), T.MathUtils.clamp(this.goal.z, -3.45, 3.5));
    } else {
      this.avoidSolids(obstacles, 3.2);
      this.goal.y = Math.max(this.goal.y, floorHeight(this.goal.x, this.goal.z) + .35);
    }
  }

  walking({ player, yaw, pitch, distance: walkingDistance, seated, puppies, colliders, mounted = false, items = NO_ITEMS }: {
    player: T.Group; yaw: number; pitch: number; distance: number;
    seated: boolean; puppies?: PuppyPack; colliders: Collider[]; mounted?: boolean; items?: WorldItem[];
  }) {
    this.look.copy(player.position).add(this.temp.set(0, mounted ? 1 : 1.35, 0));
    this.look.y += Math.max(0, -Math.sin(pitch)) * (mounted ? .4 : 2.4);
    const followers = puppies?.followers ?? [];
    const dogs = seated ? 0 : followers.length;
    const packBack = Math.max(0, Math.min(1.8, (dogs - 1) * .3));
    this.look.y -= packBack * .4;
    if (dogs && puppies) {
      let minX = player.position.x, maxX = minX, minZ = player.position.z, maxZ = minZ;
      for (const puppy of puppies.puppies) {
        if (!followers.some(value => value.id === puppy.info.id) || puppy.actor.position.distanceTo(player.position) > 9) continue;
        minX = Math.min(minX, puppy.actor.position.x); maxX = Math.max(maxX, puppy.actor.position.x);
        minZ = Math.min(minZ, puppy.actor.position.z); maxZ = Math.max(maxZ, puppy.actor.position.z);
      }
      const offsetX = (minX + maxX) * .5 - player.position.x;
      const offsetZ = (minZ + maxZ) * .5 - player.position.z;
      // Keep the player as the anchor when a dog falls behind or rounds a corner.
      const weight = Math.min(1, 1.2 / Math.max(.001, Math.hypot(offsetX, offsetZ)));
      this.look.x += offsetX * weight;
      this.look.z += offsetZ * weight;
    }
    const distance = seated ? 3 : walkingDistance + (dogs ? Math.min(2.8, 1.6 + (dogs - 1) * .24) : 0);
    this.goal.copy(player.position).add(this.temp.set(
      this.look.x - player.position.x + Math.sin(yaw) * Math.cos(pitch) * distance,
      1.35 + Math.sin(pitch) * distance + packBack * .4,
      this.look.z - player.position.z + Math.cos(yaw) * Math.cos(pitch) * distance,
    ));
    this.avoidSolids(this.viewObstacles(colliders, items), mounted ? 3.8 : seated ? 2.2 : 2.8);
    this.goal.y = Math.max(this.goal.y, floorHeight(this.goal.x, this.goal.z) + .3);
  }
}

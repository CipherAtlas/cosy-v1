import * as T from "three";
import { floorHeight, type Collider } from "./environment";
import { VillageMovement } from "./movement";

/** Side-by-side walking opens into single file before a constrained passage. */
export class CompanionWalk {
  heading = Math.PI;
  singleFile = false;
  readonly velocity = new T.Vector2();
  private previous?: T.Vector3;
  private trail: T.Vector2[] = [];
  private openTime = 0;
  private probe: VillageMovement;
  private player = new T.Vector3();

  constructor(colliders: Collider[]) { this.probe = new VillageMovement(colliders, () => {}); }

  update(delta: number, player: T.Vector3, count: number, heading?: number) {
    const dx = this.previous ? player.x - this.previous.x : 0;
    const dz = this.previous ? player.z - this.previous.z : 0;
    const moved = Math.hypot(dx, dz), teleported = moved > 2;
    this.velocity.set(dx, dz).multiplyScalar(delta > 0 && !teleported ? 1 / delta : 0).clampLength(0, 6);
    if (heading !== undefined) this.heading = heading;
    else if (moved > .001 && !teleported) this.heading = Math.atan2(dx, dz);
    this.previous = player.clone(); this.player.copy(player);
    if (teleported || !count) { this.trail = []; this.singleFile = false; this.openTime = 0; }
    const newest = this.trail[0];
    if (!newest || newest.distanceTo(new T.Vector2(player.x, player.z)) > .1) {
      this.trail.unshift(new T.Vector2(player.x, player.z));
      this.trail.length = Math.min(this.trail.length, 90);
    }
    if (!count) return;
    // Probe the whole hand-to-hand span, including the next step, using actor clearance.
    let open = true;
    for (let slot = 0; slot < Math.min(2, count); slot++) {
      const side = slot === 0 ? -1 : 1;
      for (const ahead of [0, .5, 1]) {
        const x = player.x + Math.sin(this.heading) * ahead;
        const z = player.z + Math.cos(this.heading) * ahead;
        this.probe.position = { x, y: floorHeight(x, z), z };
        if (!this.probe.clear(x, z) || !this.probe.canWalkTo(x + Math.cos(this.heading) * side * 1.12, z - Math.sin(this.heading) * side * 1.12)) open = false;
      }
    }
    if (!open) { this.singleFile = true; this.openTime = 0; }
    else if (this.singleFile) {
      this.openTime += delta;
      if (this.openTime > .8) this.singleFile = false;
    }
  }

  target(slot: number): [number, number] {
    if (this.singleFile) {
      let remaining = .85 * (slot + 1), x = this.player.x, z = this.player.z;
      for (const p of this.trail) {
        const length = Math.hypot(p.x - x, p.y - z);
        if (length >= remaining) return [x + (p.x - x) * remaining / length, z + (p.y - z) * remaining / length];
        remaining -= length; x = p.x; z = p.y;
      }
      const behind: [number, number] = [x - Math.sin(this.heading) * remaining, z - Math.cos(this.heading) * remaining];
      this.probe.position = { x, y: floorHeight(x, z), z };
      return this.probe.canWalkTo(...behind) ? behind : [x, z];
    }
    const side = slot < 4 ? (slot % 2 ? 1 : -1) * 1.05 : 0;
    const back = Math.floor(slot / 2) * 1.25;
    return [this.player.x + Math.cos(this.heading) * side - Math.sin(this.heading) * back,
      this.player.z - Math.sin(this.heading) * side - Math.cos(this.heading) * back];
  }

  avoidPlayer(from: { x: number; z: number }, target: [number, number]): [number, number] {
    const x = from.x - this.player.x, z = from.z - this.player.z;
    if (Math.hypot(x, z) > 2.5) return target;
    const dx = target[0] - from.x, dz = target[1] - from.z, lengthSq = dx * dx + dz * dz;
    const along = lengthSq ? T.MathUtils.clamp(-(x * dx + z * dz) / lengthSq, 0, 1) : 0;
    if (Math.hypot(x + along * dx, z + along * dz) >= .82) return target;
    // A sharp reversal moves the hand-holding slot to the other side. Walk an arc,
    // rather than taking the straight shortcut through the player's body.
    const angle = Math.atan2(x, z), goal = Math.atan2(target[0] - this.player.x, target[1] - this.player.z);
    const turn = T.MathUtils.euclideanModulo(goal - angle + Math.PI, Math.PI * 2) - Math.PI;
    const next = angle + T.MathUtils.clamp(turn, -.45, .45);
    return [this.player.x + Math.sin(next) * 1.05, this.player.z + Math.cos(next) * 1.05];
  }
}

/** Pose the existing soft fins so their tips meet; no extra world geometry. */
export class CompanionHands {
  private posed: { fin: T.Object3D; position: T.Vector3; scale: T.Vector3; rotation: T.Quaternion }[] = [];
  private reach = [0, 0];
  private xAxis = new T.Vector3(1, 0, 0);

  reset() {
    for (const p of this.posed) { p.fin.position.copy(p.position); p.fin.scale.copy(p.scale); p.fin.quaternion.copy(p.rotation); }
    this.posed = [];
  }

  update(delta: number, player: T.Object3D, fins: T.Object3D[], companions: { root: T.Object3D; fins: T.Object3D[] }[], allowed: boolean) {
    player.updateWorldMatrix(true, true);
    for (let slot = 0; slot < 2; slot++) {
      const resident = companions[slot], side = slot === 0 ? -1 : 1;
      const a = fins.find(f => f.name === (side < 0 ? "SpiritFinL" : "SpiritFinR"));
      const b = resident?.fins.find(f => f.name === (side < 0 ? "SpiritFinR" : "SpiritFinL"));
      const offset = resident ? player.worldToLocal(resident.root.getWorldPosition(new T.Vector3())) : new T.Vector3();
      const facing = resident && Math.cos(resident.root.rotation.y - player.rotation.y) > .94;
      const ready = allowed && a && b && facing && Math.abs(offset.x - side * 1.05) < .14 && Math.abs(offset.z) < .16 && Math.abs(offset.y) < .2;
      this.reach[slot] = ready ? Math.min(1, this.reach[slot] + delta * 5) : 0;
      if (!ready) continue;
      resident.root.updateWorldMatrix(true, true);
      const hand = a.getWorldPosition(new T.Vector3()).add(b.getWorldPosition(new T.Vector3())).multiplyScalar(.5);
      hand.y += .025;
      for (const [fin, sign] of [[a, side], [b, -side]] as const) {
        const saved = { fin, position: fin.position.clone(), scale: fin.scale.clone(), rotation: fin.quaternion.clone() };
        const end = fin.parent!.worldToLocal(hand.clone());
        const shoulder = fin.position.clone(); shoulder.x -= sign * .1;
        const arm = end.clone().sub(shoulder), length = arm.length();
        if (length > .39) continue;
        const amount = this.reach[slot];
        this.posed.push(saved);
        fin.position.lerpVectors(saved.position, shoulder.add(end).multiplyScalar(.5), amount);
        fin.scale.x *= T.MathUtils.lerp(1, length / .27, amount);
        fin.quaternion.slerp(new T.Quaternion().setFromUnitVectors(this.xAxis, arm.normalize().multiplyScalar(sign)), amount);
      }
    }
  }
}

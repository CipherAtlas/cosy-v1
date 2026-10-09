import { bridgeBarriers, floorHeight, hasEditedTerrain, inWalkableWorld, inRiver, onBridge, onPondDock, pondDistance, riverX, surfaceAt } from "./environment";
import type { Collider, MovementStatus, WorldContact } from "./environment";
import { collisionLookup, nearbyColliders } from "./collisionLookup";

const STEP = 1 / 120;
export const MOVEMENT = { walk: 2.6, run: 4.5, sprint: 6, gravity: 12, jump: 5, radius: 0.32, height: 1.8 };

/** Fixed-step movement; rendered frames may vary without changing speed or jump height. */
export class VillageMovement {
  position = { x: 0.3, y: floorHeight(0.3, 20), z: 20 };
  velocity = { x: 0, y: 0, z: 0 };
  grounded = true;
  speed = 0;
  phase = 0;
  gait: MovementStatus["gait"] = "idle";
  landing = 0;
  takeoff = 0;
  private accumulator = 0;
  private jumpBuffer = 0;
  private coyote = 0;
  private contactIndex = 0;

  constructor(private colliders: Collider[], private contact: (event: WorldContact) => void) {}

  jump() { this.jumpBuffer = 0.12; }
  settle(x = this.position.x, z = this.position.z) {
    this.position = { x, y: floorHeight(x, z), z };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.grounded = true;
    this.speed = this.accumulator = this.jumpBuffer = this.landing = this.takeoff = 0;
    this.gait = "idle";
  }
  pause() {
    this.velocity.x = this.velocity.z = 0;
    this.speed = this.accumulator = this.jumpBuffer = 0;
    this.gait = this.grounded ? "idle" : "air";
  }
  canWalkTo(x: number, z: number) {
    // Use the same footprint and terrain rules for resident invitations as for actual walking.
    const start = this.position;
    const steps = Math.max(1, Math.ceil(Math.hypot(x - start.x, z - start.z) / .2));
    let previousFloor = start.y;
    for (let i = 1; i <= steps; i++) {
      const px = start.x + (x - start.x) * i / steps;
      const pz = start.z + (z - start.z) * i / steps;
      const floor = floorHeight(px, pz);
      if (Math.abs(floor - previousFloor) > .2 || !this.clear(px, pz, floor)) return false;
      previousFloor = floor;
    }
    return true;
  }
  nearby(x: number, z: number, radius: number) {
    return new VillageMovement(nearbyColliders(collisionLookup(this.colliders, MOVEMENT.radius), x, z, radius), () => {});
  }
  clear(x: number, z: number, y = floorHeight(x, z), height = MOVEMENT.height) {
    if (!inWalkableWorld(x, z)) return false;
    if (inRiver(x, z) && !onBridge(x, z)) return false;
    if (pondDistance(x, z) < 1.035 && !onPondDock(x, z)) return false;
    // Rails stay solid during jumps; one rounded footprint also covers every stone seam.
    if (bridgeBarriers().some(c => this.overlaps(c, x, z))) return false;
    return !nearbyColliders(collisionLookup(this.colliders, MOVEMENT.radius), x, z).some(c => {
      if (c.bridgeRail) return false; // The continuous oriented rails above own walking collision.
      if (y >= (c.top ?? 8) || y + height <= (c.bottom ?? -1)) return false;
      return this.overlaps(c, x, z);
    });
  }
  private overlaps(c: Collider & { yaw?: number }, x: number, z: number) {
    let px = x - c.x, pz = z - c.z;
    if (c.yaw) {
      const cosine = Math.cos(c.yaw), sine = Math.sin(c.yaw);
      [px, pz] = [px * cosine - pz * sine, px * sine + pz * cosine];
    }
    const dx = Math.max(Math.abs(px) - c.w / 2, 0);
    const dz = Math.max(Math.abs(pz) - c.d / 2, 0);
    return dx * dx + dz * dz < MOVEMENT.radius ** 2;
  }
  private resolveBridgeOverlap() {
    const { x, z } = this.position;
    const barrier = bridgeBarriers().find(c => this.overlaps(c, x, z));
    if (!barrier) return;
    const radius = MOVEMENT.radius + .001;
    const c = Math.cos(barrier.yaw), s = Math.sin(barrier.yaw);
    const px = (x - barrier.x) * c - (z - barrier.z) * s, pz = (x - barrier.x) * s + (z - barrier.z) * c;
    const minX = -barrier.w / 2, maxX = barrier.w / 2;
    const minZ = -barrier.d / 2, maxZ = barrier.d / 2;
    const dx = px - Math.max(minX, Math.min(maxX, px));
    const dz = pz - Math.max(minZ, Math.min(maxZ, pz));
    const distance = Math.hypot(dx, dz);
    const candidates = [
      { x: minX - radius, z: pz }, { x: maxX + radius, z: pz },
      { x: px, z: minZ - radius }, { x: px, z: maxZ + radius },
    ];
    if (distance > 0) candidates.push({ x: px + dx * (radius / distance - 1), z: pz + dz * (radius / distance - 1) });
    // A stale or edge-landing position must be able to leave. Choose the nearest
    // clear bank/deck surface, never the water on the other side of a parapet.
    const target = candidates.map(p => ({ x: barrier.x + p.x * c + p.z * s, z: barrier.z - p.x * s + p.z * c }))
      .filter(p => Math.hypot(p.x - x, p.z - z) <= 1 && this.clear(p.x, p.z))
      .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
    if (!target) return;
    this.position = { x: target.x, y: floorHeight(target.x, target.z), z: target.z };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.grounded = true;
  }
  recoverySpot() {
    const origin = this.position;
    const awayFromRiver = origin.x < riverX(origin.z) ? Math.PI : 0;
    for (let radius = 1.5; radius <= 12; radius += .75) {
      for (let step = 0; step < 16; step++) {
        const angle = awayFromRiver + step * Math.PI / 8;
        const x = origin.x + Math.cos(angle) * radius;
        const z = origin.z + Math.sin(angle) * radius;
        if (onBridge(x, z) || onPondDock(x, z) || Math.abs(x - riverX(z)) < 4.2 || pondDistance(x, z) < 1.1) continue;
        const floor = floorHeight(x, z);
        if (!this.clear(x, z, floor)) continue;
        // Leave room for the whole spirit and reject sharp edges beside the landing point.
        const margin = .55;
        if ([[margin, 0], [-margin, 0], [0, margin], [0, -margin]].some(([dx, dz]) =>
          !this.clear(x + dx, z + dz) || Math.abs(floorHeight(x + dx, z + dz) - floor) > .25)) continue;
        return { x, z };
      }
    }
    return null;
  }
  private emit(kind: WorldContact["kind"], impact = 0) {
    const { x, y, z } = this.position;
    this.contact({ kind, position: [x, y, z], surface: surfaceAt(x, z), speed: this.speed, impact, foot: this.contactIndex++ % 2 ? "right" : "left" });
  }
  private terrainAllows(x: number, z: number) {
    if (!hasEditedTerrain(this.position.x, this.position.z) && !hasEditedTerrain(x, z)) return true;
    const floor = floorHeight(x, z);
    if (!this.grounded) return floor <= this.position.y + .18;
    const distance = Math.hypot(x - this.position.x, z - this.position.z);
    return floor - floorHeight(this.position.x, this.position.z) <= distance * .85 + .000001;
  }
  update(delta: number, input: { x: number; z: number; run: boolean; sprint: boolean; blocked: boolean }) {
    if (input.blocked) { this.pause(); return; }
    this.accumulator += Math.min(delta, 0.1);
    while (this.accumulator >= STEP) {
      this.step(input);
      this.accumulator -= STEP;
    }
  }
  private step(input: { x: number; z: number; run: boolean; sprint: boolean }) {
    const dt = STEP;
    this.resolveBridgeOverlap();
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.landing = Math.max(0, this.landing - dt);
    this.takeoff = Math.max(0, this.takeoff - dt);
    this.coyote = this.grounded ? 0.1 : Math.max(0, this.coyote - dt);
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.velocity.y = MOVEMENT.jump;
      this.grounded = false;
      this.coyote = this.jumpBuffer = 0;
      this.takeoff = 0.13;
      this.emit("takeoff");
    }
    const requested = Math.hypot(input.x, input.z) > 0.01;
    const sprint = input.sprint && requested;
    const target = sprint ? MOVEMENT.sprint : input.run || input.sprint ? MOVEMENT.run : MOVEMENT.walk;
    const damping = 1 - Math.exp(-dt * (requested ? this.grounded ? 10 : 3 : 15));
    this.velocity.x += (input.x * target - this.velocity.x) * damping;
    this.velocity.z += (input.z * target - this.velocity.z) * damping;
    const { x: oldX, z: oldZ } = this.position;
    const nx = oldX + this.velocity.x * dt;
    const nz = oldZ + this.velocity.z * dt;
    const rail = bridgeBarriers().find(c => this.overlaps(c, nx, nz));
    if (rail) {
      // Project rail contact along its continuous tangent instead of stopping each
      // world axis independently on a rotated bridge.
      const c = Math.cos(rail.yaw), s = Math.sin(rail.yaw);
      const along = this.velocity.x * c - this.velocity.z * s;
      const sx = oldX + along * c * dt, sz = oldZ - along * s * dt;
      if (this.terrainAllows(sx, sz) && this.clear(sx, sz, this.position.y)) {
        this.position.x = sx; this.position.z = sz;
        this.velocity.x = along * c; this.velocity.z = -along * s;
      } else this.velocity.x = this.velocity.z = 0;
    } else if ((onBridge(oldX, oldZ) || onBridge(nx, nz)) && this.terrainAllows(nx, nz) && this.clear(nx, nz, this.position.y)) {
      this.position.x = nx; this.position.z = nz;
    } else {
      if (this.terrainAllows(nx, oldZ) && this.clear(nx, oldZ, this.position.y)) this.position.x = nx;
      else this.velocity.x = 0;
      if (this.terrainAllows(this.position.x, nz) && this.clear(this.position.x, nz, this.position.y)) this.position.z = nz;
      else this.velocity.z = 0;
    }
    const travelled = Math.hypot(this.position.x - oldX, this.position.z - oldZ);
    this.speed = travelled / dt;
    let floor = floorHeight(this.position.x, this.position.z);
    const solids = nearbyColliders(collisionLookup(this.colliders, MOVEMENT.radius), this.position.x, this.position.z);
    for (const c of solids) {
      if (!c.bridgeRail && c.top !== undefined && this.position.y >= c.top - .025 && Math.abs(this.position.x - c.x) < c.w / 2 && Math.abs(this.position.z - c.z) < c.d / 2)
        floor = Math.max(floor, c.top);
    }
    if (this.grounded && floor < this.position.y - 0.2) this.grounded = false;
    if (!this.grounded) {
      const previousY = this.position.y;
      this.velocity.y -= MOVEMENT.gravity * dt;
      this.position.y += this.velocity.y * dt;
      // Undersides stop ascent. Building sides stay solid at every jump height.
      if (this.velocity.y > 0) for (const c of solids) {
        if (c.bridgeRail) continue;
        if (c.bottom === undefined || c.bottom <= previousY) continue;
        if (Math.abs(this.position.x - c.x) < c.w / 2 + MOVEMENT.radius && Math.abs(this.position.z - c.z) < c.d / 2 + MOVEMENT.radius && this.position.y + MOVEMENT.height >= c.bottom) {
          this.position.y = c.bottom - MOVEMENT.height;
          this.velocity.y = 0;
        }
      }
      if (this.position.y <= floor && this.velocity.y <= 0) {
        const impact = -this.velocity.y;
        this.position.y = floor;
        this.velocity.y = 0;
        this.grounded = true;
        this.landing = this.speed > 0.5 ? 0.16 : 0.24;
        this.emit("landing", impact);
      }
    } else this.position.y = floor;
    this.gait = !this.grounded ? "air" : this.speed < 0.12 ? "idle" : this.speed > 4.7 ? "sprint" : this.speed > 3.05 ? "run" : "walk";
    if (this.grounded && this.speed > 0.2 && this.landing === 0) {
      const oldPhase = this.phase;
      const stride = this.gait === "sprint" ? 3.5 : this.gait === "run" ? 2.8 : 1.65;
      this.phase += travelled / stride;
      if (Math.floor(oldPhase * 2) !== Math.floor(this.phase * 2)) this.emit("footstep");
    }
  }
}

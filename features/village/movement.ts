import { BRIDGE, floorHeight, inWalkableWorld, onBridge, onPondDock, pondDistance, riverX, surfaceAt } from "./environment";
import type { Collider, MovementStatus, WorldContact } from "./environment";

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
  clear(x: number, z: number, y = floorHeight(x, z)) {
    const r = MOVEMENT.radius;
    if (!inWalkableWorld(x, z)) return false;
    if (Math.abs(x - riverX(z)) < 3.6 && !onBridge(x, z)) return false;
    if (pondDistance(x, z) < 1.035 && !onPondDock(x, z)) return false;
    // Keep the rails solid in the air while leaving the visible east-bank opening walkable.
    const railDistance = Math.abs(z - BRIDGE.z);
    if (Math.abs(x - BRIDGE.x) < BRIDGE.length / 2 &&
      railDistance > BRIDGE.width / 2 - r && railDistance < BRIDGE.width / 2 + .4 &&
      (z < BRIDGE.z || x < BRIDGE.x + BRIDGE.length / 2 - BRIDGE.northEastOpening)) return false;
    return !this.colliders.some(c => {
      if (y >= (c.top ?? 8) || y + MOVEMENT.height <= (c.bottom ?? -1)) return false;
      const dx = Math.max(Math.abs(x - c.x) - c.w / 2, 0);
      const dz = Math.max(Math.abs(z - c.z) - c.d / 2, 0);
      return dx * dx + dz * dz < r * r;
    });
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
    if (this.clear(nx, oldZ, this.position.y)) this.position.x = nx;
    else this.velocity.x = 0;
    const nz = oldZ + this.velocity.z * dt;
    if (this.clear(this.position.x, nz, this.position.y)) this.position.z = nz;
    else this.velocity.z = 0;
    const travelled = Math.hypot(this.position.x - oldX, this.position.z - oldZ);
    this.speed = travelled / dt;
    let floor = floorHeight(this.position.x, this.position.z);
    for (const c of this.colliders) {
      if (c.top !== undefined && this.position.y >= c.top - .025 && Math.abs(this.position.x - c.x) < c.w / 2 && Math.abs(this.position.z - c.z) < c.d / 2)
        floor = Math.max(floor, c.top);
    }
    if (this.grounded && floor < this.position.y - 0.2) this.grounded = false;
    if (!this.grounded) {
      const previousY = this.position.y;
      this.velocity.y -= MOVEMENT.gravity * dt;
      this.position.y += this.velocity.y * dt;
      // Undersides stop ascent. Building sides stay solid at every jump height.
      if (this.velocity.y > 0) for (const c of this.colliders) {
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

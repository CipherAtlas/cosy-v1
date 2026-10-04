import { floorHeight, landscapeHeight } from "../features/village/environment";
import type { VillageMovement } from "../features/village/movement";
import type { SharedActor, SharedHorseInput } from "../features/village/sharedActors";

type Horse = { state: SharedActor; movement: VillageMovement };

/** Inputs are deliberately ephemeral: a restored Worker never resumes an old held key. */
export class HorseRiding {
  private inputs = new Map<string, SharedHorseInput & { at: number }>();
  private velocities = new Map<string, number>();

  input(horse: Horse, input: SharedHorseInput, now: number) {
    if (![input.forward, input.turn].every(Number.isFinite)
      || Math.abs(input.forward) > 1 || Math.abs(input.turn) > 1
      || typeof input.brake !== "boolean" || typeof input.sprint !== "boolean") return false;
    const previous = this.inputs.get(horse.state.id);
    // Always accept a stop, including a blur arriving immediately after a movement packet.
    if (previous && now - previous.at < 50 && !input.brake && (input.forward || input.turn)) return false;
    this.inputs.set(horse.state.id, { ...input, at: now });
    return true;
  }

  stop(horse: Horse) {
    this.inputs.delete(horse.state.id); this.velocities.delete(horse.state.id);
    horse.state.speed = 0;
  }

  clear(horse: Horse, x: number, z: number, heading: number, scale: number) {
    const ground = floorHeight(x, z);
    // The spirit collision probe covers three overlapping discs along the horse's body.
    for (const along of [-.65, 0, .65]) for (const side of [-.25, .25]) {
      const px = x + (Math.sin(heading) * along + Math.cos(heading) * side) * scale;
      const pz = z + (Math.cos(heading) * along - Math.sin(heading) * side) * scale;
      if (!horse.movement.clear(px, pz) || !horse.movement.clear(px, pz, ground + scale)
        || Math.abs(floorHeight(px, pz) - ground) > .55 * scale) return false;
    }
    return true;
  }

  step(horse: Horse, scale: number, delta: number, now: number, occupied: (x: number, z: number) => boolean) {
    if (delta <= 0) return;
    const input = this.inputs.get(horse.state.id);
    const braking = !input || now - input.at > 400 || input.brake;
    const target = braking ? 0 : input.forward * (input.forward < 0 ? 1.8 : input.sprint ? 9 : 4.5);
    const count = Math.max(1, Math.ceil(delta * 60)), dt = delta / count;
    const start = { x: horse.state.x, z: horse.state.z };
    let velocity = !input || now - input.at > 400 ? 0 : this.velocities.get(horse.state.id) ?? 0;
    for (let index = 0; index < count; index++) {
      const acceleration = braking ? 14 : target === 0 ? 7 : 5.5;
      velocity += Math.max(-acceleration * dt, Math.min(acceleration * dt, target - velocity));
      const turn = braking ? 0 : input.turn * (1.8 - Math.min(1, Math.abs(velocity) / 9) * .9) * dt;
      const heading = Math.atan2(Math.sin(horse.state.heading + turn), Math.cos(horse.state.heading + turn));
      if (this.clear(horse, horse.state.x, horse.state.z, heading, scale)) horse.state.heading = heading;
      const x = horse.state.x + Math.sin(horse.state.heading) * velocity * dt;
      const z = horse.state.z + Math.cos(horse.state.heading) * velocity * dt;
      const distance = Math.hypot(x - horse.state.x, z - horse.state.z);
      const rise = Math.abs(floorHeight(x, z) - floorHeight(horse.state.x, horse.state.z));
      const slopeLimit = distance * .65 + .003;
      const terrainRise = Math.abs(landscapeHeight(x, z) - landscapeHeight(horse.state.x, horse.state.z));
      // Limestone paving has a 5 cm edge. Small kerbs may step up; steep terrain still uses the slope limit.
      const gentleStep = rise <= .08 * scale && terrainRise <= slopeLimit;
      if ((rise <= slopeLimit || gentleStep) && this.clear(horse, x, z, horse.state.heading, scale) && !occupied(x, z)) {
        horse.state.x = x; horse.state.z = z;
      } else if (rise <= slopeLimit || gentleStep) {
        // Keep motion along a fence or prop edge while steering away instead of pinning the horse.
        const candidates = [[x, horse.state.z], [horse.state.x, z]] as const;
        const slide = candidates.find(([sx, sz]) => Math.hypot(sx - horse.state.x, sz - horse.state.z) > distance * .15
          && this.clear(horse, sx, sz, horse.state.heading, scale) && !occupied(sx, sz)
          && Math.abs(floorHeight(sx, sz) - floorHeight(horse.state.x, horse.state.z)) <= .08 * scale);
        if (slide) { horse.state.x = slide[0]; horse.state.z = slide[1]; velocity *= .92; }
        else velocity = 0;
      } else velocity = 0;
    }
    horse.state.y = floorHeight(horse.state.x, horse.state.z);
    horse.state.speed = delta ? Math.hypot(horse.state.x - start.x, horse.state.z - start.z) / delta : 0;
    horse.movement.position = { x: horse.state.x, y: horse.state.y, z: horse.state.z };
    this.velocities.set(horse.state.id, velocity);
  }

  dismount(horse: Horse, scale: number, occupied: (x: number, z: number) => boolean): [number, number, number] | null {
    horse.movement.position = { x: horse.state.x, y: floorHeight(horse.state.x, horse.state.z), z: horse.state.z };
    for (const distance of [1.45, 2, 2.6, 3.2]) for (const offset of [Math.PI / 2, -Math.PI / 2, Math.PI, 0]) {
      const x = horse.state.x + Math.sin(horse.state.heading + offset) * distance * scale;
      const z = horse.state.z + Math.cos(horse.state.heading + offset) * distance * scale;
      if (!occupied(x, z) && horse.movement.canWalkTo(x, z)
        && Math.abs(floorHeight(x, z) - horse.movement.position.y) < .65 * scale)
        return [x, floorHeight(x, z), z];
    }
    return null;
  }
}

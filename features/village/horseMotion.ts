import { floorHeight, landscapeHeight } from "./environment";
import type { VillageMovement } from "./movement";
import type { SharedActor, SharedHorseInput } from "./sharedActors";

export function horseClear(movement: VillageMovement, x: number, z: number, heading: number, scale: number) {
  const ground = floorHeight(x, z);
  // The spirit collision probe covers three overlapping discs along the horse's body.
  for (const along of [-.65, 0, .65]) for (const side of [-.25, .25]) {
    const px = x + (Math.sin(heading) * along + Math.cos(heading) * side) * scale;
    const pz = z + (Math.cos(heading) * along - Math.sin(heading) * side) * scale;
    if (!movement.clear(px, pz) || !movement.clear(px, pz, ground + scale)
      || Math.abs(floorHeight(px, pz) - ground) > .55 * scale) return false;
  }
  return true;
}

/** Identical footprint, slope and acceleration rules for authority and provisional rendering. */
export function stepHorse(pose: Pick<SharedActor, "x" | "y" | "z" | "heading" | "speed">,
  velocity: number, input: SharedHorseInput, scale: number, delta: number,
  movement: VillageMovement, occupied: (x: number, z: number) => boolean) {
  const braking = input.brake;
  const target = braking ? 0 : input.forward * (input.forward < 0 ? 1.8 : input.sprint ? 9 : 4.5);
  const count = Math.max(1, Math.ceil(delta * 60)), dt = delta / count;
  const start = { x: pose.x, z: pose.z };
  for (let index = 0; index < count; index++) {
    const acceleration = braking ? 14 : target === 0 ? 7 : 5.5;
    velocity += Math.max(-acceleration * dt, Math.min(acceleration * dt, target - velocity));
    const turn = braking ? 0 : input.turn * (1.8 - Math.min(1, Math.abs(velocity) / 9) * .9) * dt;
    const heading = Math.atan2(Math.sin(pose.heading + turn), Math.cos(pose.heading + turn));
    if (horseClear(movement, pose.x, pose.z, heading, scale)) pose.heading = heading;
    const x = pose.x + Math.sin(pose.heading) * velocity * dt;
    const z = pose.z + Math.cos(pose.heading) * velocity * dt;
    const distance = Math.hypot(x - pose.x, z - pose.z);
    const rise = Math.abs(floorHeight(x, z) - floorHeight(pose.x, pose.z));
    const slopeLimit = distance * .65 + .003;
    const terrainRise = Math.abs(landscapeHeight(x, z) - landscapeHeight(pose.x, pose.z));
    // Limestone paving has a 5 cm edge. Small kerbs may step up; steep terrain still uses the slope limit.
    const gentleStep = rise <= .08 * scale && terrainRise <= slopeLimit;
    if ((rise <= slopeLimit || gentleStep) && horseClear(movement, x, z, pose.heading, scale) && !occupied(x, z)) {
      pose.x = x; pose.z = z;
    } else if (rise <= slopeLimit || gentleStep) {
      // Keep motion along a fence or prop edge while steering away instead of pinning the horse.
      const candidates = [[x, pose.z], [pose.x, z]] as const;
      const slide = candidates.find(([sx, sz]) => Math.hypot(sx - pose.x, sz - pose.z) > distance * .15
        && horseClear(movement, sx, sz, pose.heading, scale) && !occupied(sx, sz)
        && Math.abs(floorHeight(sx, sz) - floorHeight(pose.x, pose.z)) <= .08 * scale);
      if (slide) { pose.x = slide[0]; pose.z = slide[1]; velocity *= .92; }
      else velocity = 0;
    } else velocity = 0;
  }
  pose.y = floorHeight(pose.x, pose.z);
  pose.speed = delta ? Math.hypot(pose.x - start.x, pose.z - start.z) / delta : 0;
  return velocity;
}

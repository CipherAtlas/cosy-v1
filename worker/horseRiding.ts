import { floorHeight } from "../features/village/environment";
import type { VillageMovement } from "../features/village/movement";
import type { SharedActor, SharedHorseInput } from "../features/village/sharedActors";
import { horseClear, stepHorse } from "../features/village/horseMotion";

type Horse = { state: SharedActor; movement: VillageMovement };

/** Inputs are deliberately ephemeral: a restored Worker never resumes an old held key. */
export class HorseRiding {
  private inputs = new Map<string, SharedHorseInput & { at: number }>();
  private velocities = new Map<string, number>();

  input(horse: Horse, input: SharedHorseInput, now: number) {
    if (![input.forward, input.turn].every(Number.isFinite)
      || Math.abs(input.forward) > 1 || Math.abs(input.turn) > 1
      || typeof input.brake !== "boolean" || typeof input.sprint !== "boolean"
      || input.sequence !== undefined && (!Number.isSafeInteger(input.sequence) || input.sequence <= 0)) return false;
    const previous = this.inputs.get(horse.state.id);
    // WebSocket messages are ordered. Never discard a changed key just because it arrived quickly.
    if (input.sequence !== undefined && previous?.sequence !== undefined && input.sequence <= previous.sequence) return false;
    this.inputs.set(horse.state.id, { forward: input.forward, turn: input.turn, sprint: input.sprint, brake: input.brake, sequence: input.sequence, at: now });
    return true;
  }

  stop(horse: Horse) {
    this.inputs.delete(horse.state.id); this.velocities.delete(horse.state.id);
    horse.state.speed = 0;
  }

  snapshot(horse: Horse, now: number, blocked: boolean) {
    const input = this.inputs.get(horse.state.id);
    const fresh = input && now - input.at <= 400;
    return { velocity: fresh ? this.velocities.get(horse.state.id) ?? 0 : 0,
      input: fresh ? input : null, at: input?.at ?? now, sequence: input?.sequence ?? 0, blocked };
  }

  clear(horse: Horse, x: number, z: number, heading: number, scale: number) {
    return horseClear(horse.movement, x, z, heading, scale);
  }

  step(horse: Horse, scale: number, delta: number, now: number, occupied: (x: number, z: number) => boolean) {
    if (delta <= 0) return;
    const input = this.inputs.get(horse.state.id);
    const fresh = input && now - input.at <= 400;
    // Include the full swept body; distant scenery cannot affect this step.
    const probe = horse.movement.nearby(horse.state.x, horse.state.z, 9 * delta + 2 * scale + 1);
    const velocity = stepHorse(horse.state, fresh ? this.velocities.get(horse.state.id) ?? 0 : 0,
      fresh ? input : { forward: 0, turn: 0, sprint: false, brake: true }, scale, delta, probe, occupied);
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

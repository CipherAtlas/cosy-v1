import type { SharedActor, SharedHorseInput } from "./sharedActors";
import { VillageMovement } from "./movement";
import type { Collider } from "./environment";
import { horseClear, stepHorse } from "./horseMotion";

const STOP: SharedHorseInput = { forward: 0, turn: 0, sprint: false, brake: true };

export class HorseRiding {
  actor: SharedActor | null = null;
  private sentAt = -Infinity;
  private lastInput = "";
  private send: ((input: SharedHorseInput) => void) | null = null;
  private sequence = 0;
  private pending: { input: SharedHorseInput; at: number }[] = [];
  private receivedAt = -Infinity;
  private baseAt = 0;
  private predicted: SharedActor | null = null;
  private acknowledged: { sequence: number; at: number } | null = null;
  private reconcile = false;
  private correction = { x: 0, y: 0, z: 0 };
  private colliders: Collider[] | null = null;
  private probe: VillageMovement | null = null;
  private simulation: { pose: SharedActor; at: number; velocity: number; input: SharedHorseInput } | null = null;

  connect(send: (input: SharedHorseInput) => void) { this.send = send; }
  setColliders(colliders: Collider[]) { this.colliders = colliders; this.probe = null; }

  sync(actors: SharedActor[], selfId: string, time = 0, now = performance.now()) {
    const previous = this.actor?.id;
    this.actor = actors.find(actor => actor.kind === "horse" && actor.owner === selfId && actor.mode === "ride") ?? null;
    const changed = previous !== this.actor?.id;
    if (changed) {
      this.sentAt = -Infinity; this.lastInput = ""; this.pending = []; this.predicted = null;
      this.acknowledged = null; this.correction = { x: 0, y: 0, z: 0 };
      this.simulation = null;
    }
    const ride = this.actor?.ride;
    const ack = this.pending.find(packet => packet.input.sequence === ride?.sequence);
    if (ack && ride) this.acknowledged = { sequence: ride.sequence, at: ack.at };
    this.baseAt = ride && this.acknowledged?.sequence === ride.sequence
      ? Math.min(now, this.acknowledged.at + Math.max(0, time - ride.at)) : now;
    if (ride) this.pending = this.pending.filter(packet => (packet.input.sequence ?? 0) > ride.sequence);
    this.receivedAt = now;
    this.reconcile = true;
    return previous !== this.actor?.id;
  }

  update(keys: Set<string>, enabled: boolean, time: number, touch = { forward: 0, turn: 0, sprint: false, brake: false }) {
    if (!this.actor || !this.send) return;
    const input: SharedHorseInput = {
      forward: enabled ? Math.max(-1, Math.min(1, Number(keys.has("w") || keys.has("arrowup")) - Number(keys.has("s") || keys.has("arrowdown")) + touch.forward)) : 0,
      turn: enabled ? Math.max(-1, Math.min(1, Number(keys.has("a") || keys.has("arrowleft")) - Number(keys.has("d") || keys.has("arrowright")) + touch.turn)) : 0,
      sprint: enabled && (keys.has("shift") || touch.sprint),
      brake: !enabled || keys.has(" ") || touch.brake,
    };
    const signature = JSON.stringify(input);
    if (signature !== this.lastInput || time - this.sentAt >= .1) {
      this.transmit(input, time * 1000); this.lastInput = signature; this.sentAt = time;
    }
  }

  private transmit(input: SharedHorseInput, at: number) {
    const packet = { ...input, sequence: ++this.sequence };
    this.send?.(packet);
    this.pending.push({ input: packet, at });
    if (this.pending.length > 64) this.pending.shift();
  }

  /** Only the accepted rider predicts a bounded display pose; the Worker still owns every outcome. */
  sample(dt: number, scale: number, movement: VillageMovement, occupied: (x: number, z: number) => boolean,
    now: number): SharedActor | null {
    const actor = this.actor, ride = actor?.ride;
    if (!actor) return null;
    if (!ride) return null;
    if (!ride || ride.blocked || now - this.receivedAt > 400) {
      this.predicted = null; this.correction = { x: 0, y: 0, z: 0 };
      this.simulation = null;
      return actor;
    }
    if (this.colliders && (this.reconcile || !this.probe)) {
      // A conservative broad phase covers maximum projection, body probes and correction easing.
      const radius = 9 * .35 + 2 * scale + 2;
      this.probe = new VillageMovement(this.colliders.filter(collider =>
        Math.hypot(collider.x - actor.x, collider.z - actor.z) <= radius + Math.hypot(collider.w, collider.d) / 2), () => {});
    }
    const probe = this.probe ?? movement;
    const previous = !this.reconcile && this.simulation;
    const pose = { ...(previous ? previous.pose : actor) };
    let cursor = previous ? previous.at : Math.max(this.baseAt, now - 350);
    let velocity = previous ? previous.velocity : ride.velocity, input = previous ? previous.input : ride.input ?? STOP;
    const until = Math.min(now, this.baseAt + 350);
    for (const packet of this.pending) {
      if ((packet.input.sequence ?? 0) <= (input.sequence ?? 0)) continue;
      const at = Math.max(cursor, Math.min(until, packet.at));
      if (at > cursor) velocity = stepHorse(pose, velocity, input, scale, (at - cursor) / 1000, probe, occupied);
      input = packet.input; cursor = at;
    }
    if (until > cursor) velocity = stepHorse(pose, velocity, input, scale, (until - cursor) / 1000, probe, occupied);
    this.simulation = { pose: { ...pose }, at: until, velocity, input };
    if (this.reconcile) {
      this.correction = this.predicted && Math.hypot(this.predicted.x - pose.x, this.predicted.z - pose.z) < 2
        ? { x: this.predicted.x - pose.x, y: this.predicted.y - pose.y, z: this.predicted.z - pose.z }
        : { x: 0, y: 0, z: 0 };
      this.reconcile = false;
    }
    // Ease only positional corrections; steering must respond on this frame.
    const decay = Math.exp(-dt * 18);
    for (const key of ["x", "y", "z"] as const) this.correction[key] *= decay;
    // Do not smooth through a newly accepted collision correction.
    const x = pose.x + this.correction.x, z = pose.z + this.correction.z;
    if (horseClear(probe, x, z, pose.heading, scale) && !occupied(x, z)) {
      pose.x = x; pose.y += this.correction.y; pose.z = z;
    }
    this.predicted = pose;
    return pose;
  }

  stop() {
    if (this.actor) this.transmit(STOP, performance.now());
    this.lastInput = "";
  }

  clear() { this.stop(); this.actor = null; this.pending = []; this.predicted = null; this.simulation = null; }
}

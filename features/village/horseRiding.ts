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
  private horizon = 350;
  private controls: SharedHorseInput | null = null;
  private acknowledged: { sequence: number; at: number } | null = null;
  private reconcile = false;
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
      this.sentAt = -Infinity; this.lastInput = ""; this.pending = [];
      this.acknowledged = null; this.controls = null; this.horizon = 350;
      this.simulation = null;
    }
    const ride = this.actor?.ride;
    const ack = this.pending.find(packet => packet.input.sequence === ride?.sequence);
    if (ack && ride) {
      this.acknowledged = { sequence: ride.sequence, at: ack.at };
      // The acknowledged pose is anchored to the original send clock. Its age
      // includes both network legs; a fixed 350ms budget stalls on slower routes.
      const delay = Math.max(0, now - ack.at - Math.max(0, time - ride.at));
      this.horizon = Math.max(this.horizon, Math.min(1000, delay + 200));
    }
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
    this.controls = input;
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

  /** The accepted rider runs continuously; snapshots correct the display, never drive its clock. */
  sample(dt: number, scale: number, movement: VillageMovement, occupied: (x: number, z: number) => boolean,
    now: number): SharedActor | null {
    const actor = this.actor, ride = actor?.ride;
    if (!actor) return null;
    if (!ride) return null;
    if (ride.blocked || now - this.receivedAt > 400) {
      this.simulation = null;
      return actor;
    }
    if (this.colliders && (this.reconcile || !this.probe)) {
      // A conservative broad phase covers maximum projection, body probes and correction easing.
      const radius = 9 * this.horizon / 1000 + 2 * scale + 2;
      const center = this.simulation?.pose ?? actor;
      this.probe = new VillageMovement(this.colliders.filter(collider =>
        Math.min(Math.hypot(collider.x - actor.x, collider.z - actor.z),
          Math.hypot(collider.x - center.x, collider.z - center.z)) <= radius + Math.hypot(collider.w, collider.d) / 2), () => {});
    }
    const probe = this.probe ?? movement;
    let reference: { pose: SharedActor; velocity: number; input: SharedHorseInput; at: number } | null = null;
    if (this.reconcile || !this.simulation) {
      const pose = { ...actor };
      let cursor = Math.max(this.baseAt, now - this.horizon);
      let velocity = ride.velocity, input = ride.input ?? STOP;
      const until = Math.min(now, this.baseAt + this.horizon);
      for (const packet of this.pending) {
        if ((packet.input.sequence ?? 0) <= (input.sequence ?? 0)) continue;
        const at = Math.max(cursor, Math.min(until, packet.at));
        if (at > cursor) velocity = stepHorse(pose, velocity, input, scale, (at - cursor) / 1000, probe, occupied);
        input = packet.input; cursor = at;
      }
      if (until > cursor) velocity = stepHorse(pose, velocity, input, scale, (until - cursor) / 1000, probe, occupied);
      reference = { pose, velocity, input, at: until };
      this.reconcile = false;
    }
    const previous = this.simulation;
    const pose = { ...(previous?.pose ?? reference!.pose) };
    const input = this.controls ?? previous?.input ?? reference!.input;
    let velocity = previous?.velocity ?? reference!.velocity;
    if (previous) velocity = stepHorse(pose, velocity, input, scale,
      Math.max(0, Math.min(.4, (now - previous.at) / 1000)), probe, occupied);
    // Compare the accepted replay at the same display time. An exhausted replay
    // budget cannot freeze the local simulation or pull it towards an old pose.
    if (previous && reference && reference.at === now) {
      const gap = Math.hypot(reference.pose.x - pose.x, reference.pose.z - pose.z);
      if (gap >= 2) { Object.assign(pose, reference.pose); velocity = reference.velocity; }
      else {
        const blend = 1 - Math.exp(-dt * 6);
        const x = pose.x + (reference.pose.x - pose.x) * blend;
        const z = pose.z + (reference.pose.z - pose.z) * blend;
        const turn = Math.atan2(Math.sin(reference.pose.heading - pose.heading), Math.cos(reference.pose.heading - pose.heading));
        const heading = pose.heading + turn * blend;
        if (horseClear(probe, x, z, heading, scale) && !occupied(x, z)) {
          pose.x = x; pose.z = z; pose.y += (reference.pose.y - pose.y) * blend; pose.heading = heading;
          velocity += (reference.velocity - velocity) * blend;
        }
      }
    }
    this.simulation = { pose: { ...pose }, at: now, velocity, input };
    return pose;
  }

  stop() {
    this.controls = STOP;
    if (this.actor) this.transmit(STOP, performance.now());
    this.lastInput = "";
  }

  clear() { this.stop(); this.actor = null; this.pending = []; this.simulation = null; }
}

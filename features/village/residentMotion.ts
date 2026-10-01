import type { SharedActor } from "./sharedActors";

/** Render the Worker's path between snapshots without repeatedly easing to a stationary target. */
export class ResidentMotion {
  private tracks = new Map<string, { time: number; state: SharedActor }[]>();
  private clockOffset = 0;
  private receivedAt = -Infinity;
  // Heartbeats publish about every 120 ms; leave room for modest delivery jitter.
  private readonly delay = 180;

  receive(states: SharedActor[], time: number, initial: boolean) {
    const now = performance.now();
    if (initial || now - this.receivedAt > 1000) {
      this.tracks.clear();
      this.clockOffset = time - now;
    }
    this.receivedAt = now;
    for (const state of states) {
      const samples = this.tracks.get(state.id) ?? [];
      const latest = samples.at(-1);
      if (latest && time < latest.time) continue;
      if (latest?.time === time) samples[samples.length - 1] = { time, state };
      else samples.push({ time, state });
      // Keep only the recent path; no client navigation or position prediction.
      while (samples.length > 2 && samples[1].time < time - 1000) samples.shift();
      this.tracks.set(state.id, samples);
    }
  }

  reset(state: SharedActor, time: number) {
    this.tracks.set(state.id, [{ time, state }]);
  }

  sample(state: SharedActor) {
    const samples = this.tracks.get(state.id);
    if (!samples?.length) return state;
    const time = performance.now() + this.clockOffset - this.delay;
    while (samples.length > 2 && samples[1].time <= time) samples.shift();
    const start = samples[0], end = samples[1];
    if (!end || time <= start.time) return start.state;
    if (time >= end.time) return end.state;
    const blend = (time - start.time) / (end.time - start.time);
    const turn = Math.atan2(Math.sin(end.state.heading - start.state.heading), Math.cos(end.state.heading - start.state.heading));
    return {
      x: start.state.x + (end.state.x - start.state.x) * blend,
      y: start.state.y + (end.state.y - start.state.y) * blend,
      z: start.state.z + (end.state.z - start.state.z) * blend,
      heading: start.state.heading + turn * blend,
      speed: start.state.speed + (end.state.speed - start.state.speed) * blend,
    };
  }
}

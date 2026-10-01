import type { SharedActor } from "./sharedActors";

/** Render the Worker's path between snapshots without repeatedly easing to a stationary target. */
export class ResidentMotion {
  private tracks = new Map<string, { time: number; state: SharedActor }[]>();
  private playbackTime = 0;
  private sampledAt = 0;
  private latestTime = 0;
  private receivedAt = -Infinity;
  // Heartbeats publish about every 120 ms; leave room for modest delivery jitter.
  private readonly delay = 180;

  receive(states: SharedActor[], time: number, initial: boolean) {
    const now = performance.now();
    if (initial || now - this.receivedAt > 5000) {
      this.tracks.clear();
      this.playbackTime = time - this.delay;
      this.sampledAt = now;
      this.latestTime = time;
    } else this.advance(now);
    this.receivedAt = now;
    this.latestTime = Math.max(this.latestTime, time);
    for (const state of states) {
      const samples = this.tracks.get(state.id) ?? [];
      const latest = samples.at(-1);
      if (latest && time < latest.time) continue;
      if (latest?.time === time) samples[samples.length - 1] = { time, state };
      else samples.push({ time, state });
      // Keep only the recent path; no client navigation or position prediction.
      while (samples.length > 2 && samples[1].time < Math.min(time - 1000, this.playbackTime)) samples.shift();
      this.tracks.set(state.id, samples);
    }
  }

  reset(state: SharedActor, time: number) {
    this.tracks.set(state.id, [{ time, state }]);
  }

  sample(state: SharedActor) {
    const samples = this.tracks.get(state.id);
    if (!samples?.length) return state;
    const time = this.advance(performance.now());
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

  private advance(now: number) {
    // Clamp before new packets extend the path, including while rendering is paused.
    // Recover excess delay gradually after a stall, without skipping accepted poses.
    const rate = this.latestTime - this.playbackTime > 300 ? 1.1 : 1;
    this.playbackTime = Math.min(this.latestTime, this.playbackTime + Math.max(0, now - this.sampledAt) * rate);
    this.sampledAt = now;
    return this.playbackTime;
  }
}

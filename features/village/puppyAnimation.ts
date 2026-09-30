import * as T from "three";
import type { PuppyCommand } from "./puppies";

const LOOPS = new Set(["idle", "walk", "run"]);
const STILL_TIME: Record<PuppyCommand | "pet", number> = {
  sit: 1.2, dance: 1.1, spin: .75, bow: 1.2, wave: 1.25, roll: 1.8, pet: 1.2,
};

/** Independent skeleton playback, including interruption of an already blended pose. */
export class PuppyAnimation {
  readonly mixer: T.AnimationMixer;
  readonly actions: Record<string, T.AnimationAction> = {};
  private weights: Record<string, number> = {};
  private performance: PuppyCommand | "pet" | null = null;
  private reduced = false;

  constructor(model: T.Object3D, clips: T.AnimationClip[], name: string, phase: number) {
    this.mixer = new T.AnimationMixer(model);
    for (const clip of clips.filter(value => value.name.startsWith(name + "_"))) {
      const key = clip.name.slice(name.length + 1);
      const action = this.mixer.clipAction(clip);
      action.setLoop(LOOPS.has(key) ? T.LoopRepeat : T.LoopOnce, Infinity);
      action.clampWhenFinished = !LOOPS.has(key);
      action.setEffectiveWeight(0).play();
      if (LOOPS.has(key)) action.time = (phase % 1) * clip.duration;
      this.actions[key] = action;
      this.weights[key] = key === "idle" ? 1 : 0;
    }
    for (const key of ["idle", "walk", "run", "pet", "sit", "dance", "spin", "bow", "wave", "roll"])
      if (!this.actions[key]) throw Error(`Missing ${name} puppy animation: ${key}`);
    this.actions.idle.setEffectiveWeight(1);
    this.mixer.update(0);
  }

  start(command: PuppyCommand | "pet") {
    this.performance = command;
    this.actions[command].reset().setEffectiveWeight(this.weights[command]).play();
  }

  duration(command: PuppyCommand) { return this.actions[command].getClip().duration; }

  update(delta: number, speed: number, command: PuppyCommand | null, petting: boolean,
    reduced: boolean, active: boolean) {
    if (!active) return;
    const performance = command ?? (petting ? "pet" : null);
    if (performance && performance !== this.performance) this.start(performance);
    this.performance = performance;
    const run = T.MathUtils.smoothstep(speed, 1.9, 3.3);
    const moving = T.MathUtils.smoothstep(speed, .05, .55);
    const cycleDistance = T.MathUtils.lerp(.46, .76, run);
    this.actions.run.time = this.actions.walk.time * this.actions.run.getClip().duration;
    const targets: Record<string, number> = reduced
      ? { [performance ?? "idle"]: 1 }
      : performance ? { [performance]: 1 }
      : { idle: 1 - moving, walk: moving * (1 - run), run: moving * run };
    // All outgoing actions keep their present weights: rapid commands cannot snap
    // back to the beginning of a previous crossfade.
    const blend = 1 - Math.exp(-delta * 10);
    for (const [key, action] of Object.entries(this.actions)) {
      this.weights[key] = T.MathUtils.lerp(this.weights[key], targets[key] ?? 0, blend);
      if (this.weights[key] < .0001) this.weights[key] = 0;
      action.enabled = LOOPS.has(key) || key === performance || this.weights[key] > 0;
      action.setEffectiveWeight(this.weights[key]);
      if (reduced) {
        action.paused = true;
        action.time = key === performance ? STILL_TIME[performance] : 0;
      } else {
        if (this.reduced && key === performance) {
          action.reset().play();
          action.time = STILL_TIME[performance];
        }
        action.paused = !LOOPS.has(key) && action.time >= action.getClip().duration;
        // Authored foot stance is driven by travelled metres, including slow starts.
        action.timeScale = key === "walk" || key === "run"
          ? speed * action.getClip().duration / cycleDistance : 1;
      }
    }
    this.reduced = reduced;
    this.mixer.update(reduced ? 0 : delta);
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }
}

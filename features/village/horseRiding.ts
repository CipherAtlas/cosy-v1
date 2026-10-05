import type { SharedActor, SharedHorseInput } from "./sharedActors";

export class HorseRiding {
  actor: SharedActor | null = null;
  private sentAt = -Infinity;
  private lastInput = "";
  private send: ((input: SharedHorseInput) => void) | null = null;

  connect(send: (input: SharedHorseInput) => void) { this.send = send; }

  sync(actors: SharedActor[], selfId: string) {
    const previous = this.actor?.id;
    this.actor = actors.find(actor => actor.kind === "horse" && actor.owner === selfId && actor.mode === "ride") ?? null;
    if (previous !== this.actor?.id) { this.sentAt = -Infinity; this.lastInput = ""; }
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
      this.send(input); this.lastInput = signature; this.sentAt = time;
    }
  }

  stop() {
    if (this.actor) this.send?.({ forward: 0, turn: 0, sprint: false, brake: true });
    this.lastInput = "";
  }

  clear() { this.stop(); this.actor = null; }
}

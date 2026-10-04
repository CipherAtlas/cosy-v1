import * as T from "three";

export type AnimalDialogueCue = {
  id: string;
  text: { en: string; ja: string };
  position: T.Vector3;
  visible: boolean;
  priority: number;
};

export function createAnimalDialogueCue(id: string, en: string, ja: string): AnimalDialogueCue {
  return { id, text: { en, ja }, position: new T.Vector3(), visible: false, priority: 1 };
}

/** The flock's speech treatment, projected beside the nearest responding animal. */
export class AnimalDialogue {
  readonly bubble = document.createElement("div");
  private projected = new T.Vector3();
  private width = 1;
  private height = 1;
  private language: "en" | "ja" = "en";
  private opacity = 0;
  private bubbleWidth = 270;
  private bubbleHeight = 65;

  constructor(host: HTMLElement) {
    this.bubble.className = "v-bird-bubble v-animal-bubble";
    this.bubble.hidden = true;
    this.bubble.setAttribute("role", "status");
    this.bubble.setAttribute("aria-live", "polite");
    host.append(this.bubble);
  }

  resize(width: number, height: number) { this.width = width; this.height = height; this.bubble.style.maxWidth = `${Math.min(270, Math.max(1, width - 24))}px`; }
  setLanguage(language: "en" | "ja") { this.language = language; this.bubble.lang = language; }

  update(cues: readonly AnimalDialogueCue[], camera: T.Camera, listener: T.Vector3, dt: number, reduced: boolean, enabled: boolean) {
    let selected: AnimalDialogueCue | undefined, distance = Infinity;
    camera.updateWorldMatrix(true, false);
    if (enabled) for (const cue of cues) {
      if (!cue.visible) continue;
      const next = listener.distanceToSquared(cue.position);
      if (next > 10 ** 2) continue;
      this.projected.copy(cue.position).project(camera);
      if (this.projected.z < -1 || this.projected.z > 1 || Math.abs(this.projected.x) > .94 || Math.abs(this.projected.y) > .94) continue;
      if (!selected || cue.priority > selected.priority || cue.priority === selected.priority && next < distance) {
        selected = cue; distance = next;
      }
    }
    this.opacity = reduced ? Number(Boolean(selected)) : T.MathUtils.damp(this.opacity, Number(Boolean(selected)), 16, dt);
    if (!enabled || !selected && this.opacity < .03) { this.bubble.hidden = true; this.opacity = 0; return; }
    if (selected) {
      const text = selected.text[this.language];
      const changed = this.bubble.textContent !== text || this.bubble.hidden;
      this.bubble.hidden = false;
      this.bubble.dataset.animal = selected.id;
      if (changed) {
        this.bubble.textContent = text;
        this.bubbleWidth = this.bubble.offsetWidth; this.bubbleHeight = this.bubble.offsetHeight;
      }
      this.projected.copy(selected.position).project(camera);
      const margin = this.bubbleWidth / 2 + 12;
      this.bubble.style.left = `${T.MathUtils.clamp((this.projected.x * .5 + .5) * this.width, margin, Math.max(margin, this.width - margin))}px`;
      this.bubble.style.top = `${T.MathUtils.clamp((-this.projected.y * .5 + .5) * this.height - 14, this.bubbleHeight + 12, this.height - 24)}px`;
    }
    this.bubble.style.opacity = String(this.opacity);
  }

  dispose() { this.bubble.remove(); }
}

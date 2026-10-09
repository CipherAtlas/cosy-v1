import * as T from "three";
import type { Collider } from "./environment";
import { bubbleLayout } from "./bubbleLayout";
import { SceneSight } from "./sceneSight";

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
  private layout;
  private sight = new SceneSight();
  private width = 1;
  private height = 1;
  private language: "en" | "ja" = "en";
  private opacity = 0;
  private bubbleWidth = 270;
  private bubbleHeight = 65;

  constructor(host: HTMLElement) {
    this.layout = bubbleLayout(host);
    this.bubble.className = "v-bird-bubble v-animal-bubble";
    this.bubble.hidden = true;
    this.bubble.setAttribute("role", "status");
    this.bubble.setAttribute("aria-live", "polite");
    host.append(this.bubble);
  }

  resize(width: number, height: number) { this.bubbleWidth = 0; this.width = width; this.height = height; this.bubble.style.maxWidth = `${Math.min(270, Math.max(1, width - 24))}px`; }
  setLanguage(language: "en" | "ja") { this.language = language; this.bubble.lang = language; }

  update(cues: readonly AnimalDialogueCue[], camera: T.Camera, listener: T.Vector3, dt: number, reduced: boolean, enabled: boolean, colliders?: Collider[]) {
    this.layout.begin(this);
    if (colliders) this.sight.setColliders(colliders);
    let selected: AnimalDialogueCue | undefined, distance = Infinity;
    camera.updateWorldMatrix(true, false);
    if (enabled) for (const cue of cues) {
      if (!cue.visible) continue;
      const next = listener.distanceToSquared(cue.position);
      if (next > 10 ** 2) continue;
      this.projected.copy(cue.position).project(camera);
      if (this.projected.z < -1 || this.projected.z > 1 || Math.abs(this.projected.x) > .94 || Math.abs(this.projected.y) > .94) continue;
      if (!this.sight.visible(camera.position, cue.position)) continue;
      if (!selected || cue.priority > selected.priority || cue.priority === selected.priority && next < distance) {
        selected = cue; distance = next;
      }
    }
    this.opacity = reduced ? Number(Boolean(selected)) : T.MathUtils.damp(this.opacity, Number(Boolean(selected)), 16, dt);
    if (!enabled || !selected) { this.bubble.hidden = true; this.opacity = 0; return; }
    if (selected) {
      const text = selected.text[this.language];
      const changed = this.bubble.textContent !== text || this.bubble.hidden;
      this.bubble.hidden = false;
      this.bubble.dataset.animal = selected.id;
      if (changed || !this.bubbleWidth) {
        this.bubble.textContent = text;
        this.bubbleWidth = this.bubble.offsetWidth; this.bubbleHeight = this.bubble.offsetHeight;
      }
      this.projected.copy(selected.position).project(camera);
      const x = (this.projected.x * .5 + .5) * this.width, y = (-this.projected.y * .5 + .5) * this.height;
      const rect = this.layout.place(x, y, this.bubbleWidth, this.bubbleHeight, this.width, this.height);
      if (!rect) { this.bubble.hidden = true; this.opacity = 0; return; }
      this.bubble.style.left = `${rect.left + this.bubbleWidth / 2}px`;
      this.bubble.style.top = `${rect.top + this.bubbleHeight}px`;
    }
    this.bubble.style.opacity = String(this.opacity);
  }

  dispose() { this.bubble.remove(); }
}

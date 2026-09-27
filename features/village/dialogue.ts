import * as T from "three";
import type { VillageLife } from "./life";
import type { Collider } from "./environment";
import type { Weather } from "./places";

import { VILLAGERS, type Line } from "./villagers";
export { VILLAGERS } from "./villagers";
const line = (en: string, ja: string): Line => ({ en, ja });

/** DOM bubbles follow world anchors without sending frame updates through React. */
export class VillagerDialogue {
  private layer = document.createElement("div");
  private announcement = document.createElement("span");
  private language: "en" | "ja" = "en";
  private enabled = false;
  private nearest = -1;
  private clock = 0;
  private width = 0;
  private height = 0;
  private anchor = new T.Vector3();
  private projected = new T.Vector3();
  private ray = new T.Ray();
  private hit = new T.Vector3();
  private boxes: T.Box3[];
  private bubbles;

  constructor(host: HTMLElement, life: VillageLife, colliders: Collider[], private onTalk: () => void,
    private actions?: { companion: (id: string) => void; crumbs: () => void; visitTea?: () => void }) {
    this.layer.className = "v-villager-dialogue";
    this.layer.hidden = true;
    this.layer.setAttribute("role", "group");
    this.announcement.className = "sr-only";
    this.announcement.setAttribute("aria-live", "polite");
    this.announcement.setAttribute("aria-atomic", "true");
    this.bubbles = life.residents.map((resident, index) => {
      const profile = VILLAGERS[index];
      const element = document.createElement("div");
      element.className = "v-villager-bubble";
      element.dataset.villager = profile.id;
      element.style.setProperty("--villager-color", profile.color);
      element.hidden = true;
      const text = document.createElement("p");
      const footer = document.createElement("div");
      footer.className = "v-villager-footer";
      const name = document.createElement("span");
      const button = document.createElement("button");
      button.type = "button";
      const buttonLabel = document.createElement("span");
      const shortcut = document.createElement("kbd");
      shortcut.textContent = "F";
      shortcut.setAttribute("aria-hidden", "true");
      button.append(buttonLabel, shortcut);
      button.addEventListener("click", () => this.talk(index));
      button.addEventListener("keydown", event => {
        if (event.key.toLowerCase() === "f" && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault(); event.stopPropagation(); this.talk(index);
        }
      });
      footer.append(name, button);
      const actions = document.createElement("div"); actions.className = "v-villager-actions";
      const companion = document.createElement("button"); companion.type = "button";
      companion.addEventListener("click", () => this.invite(index));
      companion.setAttribute("aria-keyshortcuts", "C"); actions.append(companion);
      const crumbs = document.createElement("button"); crumbs.type = "button";
      crumbs.addEventListener("click", () => this.bread(index));
      crumbs.setAttribute("aria-keyshortcuts", "B");
      if (profile.id === "maple") actions.append(crumbs);
      if (profile.id === "luma") {
        const tea = document.createElement("button"); tea.type = "button"; tea.dataset.tea = "true";
        tea.addEventListener("click", () => { this.onTalk(); this.actions?.visitTea?.(); }); actions.append(tea);
      }
      element.append(text, footer, actions);
      this.layer.append(element);
      return { resident, profile, element, text, name, button, buttonLabel, companion, crumbs, actions, line: profile.greeting,
        greetingSeen: false, nextAmbient: index * 2, ambient: 0, chat: 0, until: 0, talkingUntil: 0,
        visible: false, distance: Infinity, x: 0, y: 0, width: 0, height: 0, measured: "", actionState: "" };
    });
    this.layer.append(this.announcement);
    host.append(this.layer);
    this.boxes = colliders.map(c => new T.Box3(
      new T.Vector3(c.x - c.w / 2, c.bottom ?? 0, c.z - c.d / 2),
      new T.Vector3(c.x + c.w / 2, c.top ?? 8, c.z + c.d / 2),
    ));
    this.setLanguage("en");
  }

  resize(width: number, height: number) { this.width = width; this.height = height; this.bubbles.forEach(b => { b.measured = ""; }); }

  setLanguage(language: "en" | "ja") {
    this.language = language;
    this.layer.lang = language;
    this.layer.setAttribute("aria-label", language === "ja" ? "村人との会話" : "Villager conversations");
    this.bubbles.forEach(b => {
      b.name.textContent = b.profile.name[language];
      b.text.textContent = b.line[language];
      b.buttonLabel.textContent = language === "ja" ? "話す" : "Chat";
      b.button.setAttribute("aria-label", language === "ja" ? `${b.profile.name.ja}と話す` : `Chat with ${b.profile.name.en}`);
      b.button.setAttribute("aria-keyshortcuts", "F");
      this.actionLabels(b);
    });
  }
  private actionLabels(b: typeof this.bubbles[number]) {
    const state = `${this.language}:${b.resident.following}`;
    if (b.actionState === state) return;
    b.actionState = state;
    const ja = this.language === "ja";
    b.companion.textContent = b.resident.following ? (ja ? "またね · C" : "See you later · C") : (ja ? "一緒に歩く · C" : "Walk with me · C");
    b.companion.setAttribute("aria-label", b.resident.following ? (ja ? `${b.profile.name.ja}と別れる` : `Let ${b.profile.name.en} wander`) : (ja ? `${b.profile.name.ja}を誘う` : `Invite ${b.profile.name.en} to walk with you`));
    b.companion.setAttribute("aria-pressed", String(b.resident.following));
    const tea = b.actions.querySelector("[data-tea]");
    if (tea) tea.textContent = ja ? "収穫を持ってお茶をしよう" : "Share your harvest over tea";
    b.crumbs.textContent = ja ? "パンくずをもらう · B" : "Ask for bread crumbs · B";
  }
  invite(index = this.nearest) {
    const b = this.bubbles[index];
    if (!this.enabled || !b?.visible || b.distance > 4.5 || !this.actions) return;
    this.onTalk(); this.actions.companion(b.profile.id); this.actionLabels(b); b.measured = "";
    this.say(index, b.resident.following ? line("A little company? I'd love that.", "一緒にお散歩？うれしいな。") : line("See you around. I'll be right here in the village.", "またね。村でのんびりしてるね。"), 5);
  }
  bread(index = this.nearest) {
    const b = this.bubbles[index];
    if (!this.enabled || !b?.visible || b.distance > 4.5 || b.profile.id !== "maple" || !this.actions) return;
    this.onTalk(); this.actions.crumbs();
    this.say(index, line("For the little duckies! This little pouch always has a few more.", "小さなアヒルたちにどうぞ！この袋には、いつでもパンくずがあるよ。"), 10);
    this.announcement.textContent = b.line[this.language];
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.layer.hidden = !enabled;
    if (!enabled) {
      this.nearest = -1;
      this.announcement.textContent = "";
      this.bubbles.forEach(b => {
        b.element.hidden = true; b.visible = false; b.talkingUntil = 0; b.resident.chatting = false;
      });
    }
  }

  private say(index: number, text: Line, seconds: number) {
    const b = this.bubbles[index];
    b.line = text;
    b.text.textContent = text[this.language];
    b.until = this.clock + seconds;
    b.nextAmbient = b.until + 5 + index * 1.3;
  }

  talk(index = this.nearest) {
    const b = this.bubbles[index];
    if (!this.enabled || !b?.visible || b.distance > 4.5 || index !== this.nearest) return;
    this.onTalk();
    this.say(index, b.profile.chat[b.chat++ % b.profile.chat.length], 10);
    b.talkingUntil = this.clock + 10;
    b.resident.chatting = true;
    this.announcement.textContent = `${b.profile.name[this.language]}: ${b.line[this.language]}`;
  }

  update(delta: number, camera: T.Camera, player: T.Vector3, weather: Weather) {
    if (!this.enabled || !this.width || !this.height) return;
    this.clock += delta;
    this.nearest = -1;
    const candidates: number[] = [];
    this.bubbles.forEach((b, index) => {
      b.distance = b.resident.root.position.distanceTo(player);
      b.resident.chatting = b.distance <= 5.5 && this.clock < b.talkingUntil;
      if (b.distance > 7) b.greetingSeen = false;
      this.anchor.copy(b.resident.root.position);
      this.anchor.y += 2.12 * b.resident.root.scale.y;
      this.projected.copy(this.anchor).project(camera);
      const distanceToCamera = this.anchor.distanceTo(camera.position);
      this.ray.origin.copy(camera.position);
      this.ray.direction.subVectors(this.anchor, camera.position).normalize();
      b.visible = b.distance < 15 && this.projected.z > -1 && this.projected.z < 1
        && Math.abs(this.projected.x) < 1 && Math.abs(this.projected.y) < 1
        && !this.boxes.some(box => this.ray.intersectBox(box, this.hit) && this.hit.distanceTo(camera.position) < distanceToCamera - .2);
      if (!b.visible) { b.element.hidden = true; b.button.hidden = true; return; }
      if (b.distance < 4.5 && (this.nearest < 0 || b.distance < this.bubbles[this.nearest].distance)) this.nearest = index;
      if (!b.greetingSeen && b.distance < 2.5) {
        b.greetingSeen = true;
        this.say(index, b.profile.greeting, 8);
        b.talkingUntil = this.clock + 5;
        b.resident.chatting = true;
      } else if (this.clock >= b.nextAmbient && this.clock >= b.talkingUntil) {
        const turn = b.ambient++;
        const text = weather !== "golden" && turn % 2 === 0 ? b.profile[weather]
          : b.profile.ambient[turn % b.profile.ambient.length];
        this.say(index, text, 8);
      }
      b.x = (this.projected.x * .5 + .5) * this.width;
      b.y = (-this.projected.y * .5 + .5) * this.height;
      candidates.push(index);
    });
    // Keep at most two bubbles, preferring the nearest speaker; hide overlapping or clipped ones.
    const placed: { left: number; right: number; top: number; bottom: number }[] = [];
    candidates.sort((a, b) => this.bubbles[a].distance - this.bubbles[b].distance).forEach(index => {
      const b = this.bubbles[index];
      const canChat = index === this.nearest;
      b.button.hidden = !canChat;
      b.actions.hidden = !canChat || !this.actions;
      this.actionLabels(b);
      b.element.hidden = false;
      const measureKey = `${this.language}:${b.line.en}:${canChat}:${b.resident.following}`;
      if (b.measured !== measureKey) {
        b.width = b.element.offsetWidth; b.height = b.element.offsetHeight; b.measured = measureKey;
      }
      const left = T.MathUtils.clamp(b.x - b.width / 2, 12, this.width - b.width - 12);
      const top = Math.max(76, b.y - b.height - 14);
      const rect = { left, right: left + b.width, top, bottom: Math.max(b.y, top + b.height + 8) };
      const overlaps = placed.some(p => rect.left < p.right + 12 && rect.right > p.left - 12 && rect.top < p.bottom + 12 && rect.bottom > p.top - 12);
      b.visible = placed.length < 2 && !overlaps && b.y > 90 && b.y < this.height - 100
        && (canChat || this.clock < b.until);
      b.element.hidden = !b.visible;
      if (!b.visible) {
        if (canChat) this.nearest = -1;
        return;
      }
      b.element.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`;
      b.element.style.setProperty("--tail-x", `${T.MathUtils.clamp(b.x - left, 16, b.width - 16)}px`);
      placed.push(rect);
    });
  }

  dispose() { this.setEnabled(false); this.layer.remove(); }
}

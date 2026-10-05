import { DEFAULT_KEYBINDINGS, gameKey, shortcutKeys, type Keybindings } from "./keybindings";
import * as T from "three";
import type { VillageLife } from "./life";
import type { Collider } from "./environment";
import type { Weather } from "./places";

import { VILLAGERS, TOWN_RESIDENT_IDS, type Line } from "./villagers";
export { VILLAGERS } from "./villagers";
const line = (en: string, ja: string): Line => ({ en, ja });

/** DOM bubbles follow world anchors without sending frame updates through React. */
export class VillagerDialogue {
  private layer = document.createElement("div");
  private announcement = document.createElement("span");
  private keybindings: Keybindings = DEFAULT_KEYBINDINGS;
  private language: "en" | "ja" = "en";
  private enabled = false;
  private nearest = -1;
  private clock = 0;
  private teaSpeechUntil = 0;
  private mintAvailable = false;
  private width = 0;
  private height = 0;
  private anchor = new T.Vector3();
  private projected = new T.Vector3();
  private attentionProjected = new T.Vector3();
  private ray = new T.Ray();
  private hit = new T.Vector3();
  private boxes: T.Box3[];
  private bubbles;

  constructor(host: HTMLElement, private life: VillageLife, colliders: Collider[], private onTalk: () => void,
    private actions?: { companion: (id: string) => void; crumbs: (id: string) => void; visitTea?: () => void; talk?: (id: string) => void; race?: () => void }) {
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
        if (gameKey(this.keybindings, event.key) === "f" && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault(); event.stopPropagation(); this.talk(index);
        }
      });
      footer.append(name, button);
      const actions = document.createElement("div"); actions.className = "v-villager-actions";
      const companion = document.createElement("button"); companion.type = "button";
      companion.addEventListener("click", () => this.invite(index));
      const companionLabel = document.createElement("span");
      const companionKey = document.createElement("kbd"); companionKey.textContent = "C"; companionKey.setAttribute("aria-hidden", "true");
      companion.append(companionLabel, companionKey);
      companion.addEventListener("keydown", event => {
        if (gameKey(this.keybindings, event.key) === "c" && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault(); event.stopPropagation(); this.invite(index);
        }
      });
      companion.setAttribute("aria-keyshortcuts", "C"); actions.append(companion);
      const crumbs = document.createElement("button"); crumbs.type = "button";
      crumbs.addEventListener("click", () => this.bread(index));
      const crumbsLabel = document.createElement("span");
      const crumbsKey = document.createElement("kbd"); crumbsKey.textContent = "B"; crumbsKey.setAttribute("aria-hidden", "true");
      crumbs.append(crumbsLabel, crumbsKey);
      crumbs.addEventListener("keydown", event => {
        if (gameKey(this.keybindings, event.key) === "b" && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault(); event.stopPropagation(); this.bread(index);
        }
      });
      crumbs.setAttribute("aria-keyshortcuts", "B");
      if (profile.id === "maple" || profile.id === "wren") actions.append(crumbs);
      let tea: HTMLButtonElement | undefined;
      let teaLabel: HTMLSpanElement | undefined;
      let attention: HTMLSpanElement | undefined;
      if (profile.id === "luma") {
        tea = document.createElement("button"); tea.type = "button"; tea.dataset.tea = "true";
        teaLabel = document.createElement("span");
        const teaKey = document.createElement("kbd"); teaKey.textContent = "E"; teaKey.setAttribute("aria-hidden", "true");
        tea.append(teaLabel, teaKey);
        tea.setAttribute("aria-keyshortcuts", "E");
        tea.addEventListener("click", () => this.visitTea()); actions.append(tea);
        tea.addEventListener("keydown", event => {
          if (gameKey(this.keybindings, event.key) === "e" && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey) {
            event.preventDefault(); event.stopPropagation(); this.visitTea();
          }
        });
        attention = document.createElement("span");
        attention.className = "v-luma-attention";
        attention.textContent = "!";
        attention.setAttribute("aria-hidden", "true");
        attention.hidden = true;
        this.layer.append(attention);
      }
      element.append(text, footer, actions);
      this.layer.append(element);
      return { resident, profile, element, text, name, button, buttonLabel, companion, companionLabel, crumbs, crumbsLabel, tea, teaLabel, attention, actions, line: profile.greeting,
        greetingSeen: false, nextAmbient: index * 2, ambient: 0, chat: 0, until: 0, talkingUntil: 0, sharedSpeech: "",
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

  setMintAvailable(available: boolean) {
    if (this.mintAvailable === available) return;
    this.mintAvailable = available;
    const luma = this.bubbles[3];
    luma.tea?.classList.toggle("has-harvest", available);
    this.actionLabels(luma);
    luma.measured = "";
  }

  setKeybindings(bindings: Keybindings) {
    this.keybindings = bindings;
    this.bubbles.forEach(b => {
      ([ [b.button, "F"], [b.companion, "C"], [b.crumbs, "B"], [b.tea, "E"] ] as const).forEach(([button, key]) => {
        if (!button) return;
        button.setAttribute("aria-keyshortcuts", shortcutKeys(bindings, key));
        const cap = button.querySelector("kbd"); if (cap) cap.textContent = shortcutKeys(bindings, key);
      });
      b.measured = "";
    });
  }

  setLanguage(language: "en" | "ja") {
    this.language = language;
    this.layer.lang = language;
    this.layer.setAttribute("aria-label", language === "ja" ? "村人との会話" : "Villager conversations");
    this.bubbles.forEach(b => {
      b.name.textContent = b.profile.name[language];
      b.text.textContent = b.line[language];
      b.buttonLabel.textContent = language === "ja" ? "話す" : "Chat";
      b.button.setAttribute("aria-label", language === "ja" ? `${b.profile.name.ja}と話す` : `Chat with ${b.profile.name.en}`);
      b.button.setAttribute("aria-keyshortcuts", shortcutKeys(this.keybindings, "F"));
      this.actionLabels(b);
    });
    if (this.clock < this.teaSpeechUntil) {
      const luma = this.bubbles[3];
      this.announcement.textContent = `${luma.profile.name[language]}: ${luma.line[language]}`;
    }
  }
  private actionLabels(b: typeof this.bubbles[number]) {
    const shared = this.life.sharedState(b.profile.id);
    const raceInvitation = b.profile.id === "rowan" && shared?.mode === "talk" && !!shared.owner && this.life.available("rowan");
    const state = `${this.language}:${b.resident.following}:${b.tea ? this.mintAvailable : ""}:${raceInvitation}`;
    if (b.actionState === state) return;
    b.actionState = state;
    const ja = this.language === "ja";
    b.companionLabel.textContent = b.resident.following ? (ja ? "またね" : "See you later") : (ja ? "一緒に歩く" : "Walk with me");
    b.companion.setAttribute("aria-label", b.resident.following ? (ja ? `${b.profile.name.ja}と別れる` : `Let ${b.profile.name.en} wander`) : (ja ? `${b.profile.name.ja}を誘う` : `Invite ${b.profile.name.en} to walk with you`));
    b.companion.setAttribute("aria-pressed", String(b.resident.following));
    b.companion.hidden = TOWN_RESIDENT_IDS.includes(b.profile.id) && !raceInvitation;
    if (b.profile.id === "rowan") {
      b.companionLabel.textContent = ja ? "一緒に競走する" : "Race together";
      b.companion.setAttribute("aria-label", ja ? "ローワンを競走に誘う" : "Invite Rowan to race");
      b.companion.removeAttribute("aria-pressed");
    }
    if (b.teaLabel) b.teaLabel.textContent = ja ? "収穫を持ってお茶をしよう" : "Share your harvest over tea";
    if (b.tea) b.tea.setAttribute("aria-label", this.mintAvailable
      ? ja ? "ミントの収穫があります。収穫を持ってお茶をしよう" : "Mint ready. Share your harvest over tea"
      : b.teaLabel!.textContent);
    b.crumbsLabel.textContent = b.profile.id === "wren" ? (ja ? "サワードウのパンくずをもらう" : "Ask for sourdough crumbs") : ja ? "パンくずをもらう" : "Ask for bread crumbs";
    b.crumbs.setAttribute("aria-label", b.crumbsLabel.textContent);
  }
  invite(index = this.nearest) {
    const b = this.bubbles[index];
    if (!this.enabled || !b?.visible || b.distance > 4.5 || !this.actions) return;
    if (!this.life.available(b.profile.id)) return;
    if (b.profile.id === "rowan") {
      if (b.companion.hidden) return;
      this.onTalk(); this.actions.race?.(); return;
    }
    if (TOWN_RESIDENT_IDS.includes(b.profile.id)) return;
    this.onTalk(); this.actions.companion(b.profile.id); this.actionLabels(b); b.measured = "";
    if (this.life.shared) return;
    this.say(index, b.resident.following ? line("A little company? I'd love that.", "一緒にお散歩？うれしいな。") : line("See you around. I'll be right here in the village.", "またね。村でのんびりしてるね。"), 4);
  }
  bread(index = this.nearest) {
    const b = this.bubbles[index];
    if (!this.enabled || !b?.visible || b.distance > 4.5 || !["maple", "wren"].includes(b.profile.id) || !this.actions) return;
    if (!this.life.available(b.profile.id)) return;
    this.onTalk(); this.actions.crumbs(b.profile.id);
    if (this.life.shared) return;
    this.say(index, b.profile.id === "wren" ? b.profile.chat[0] : line("For the little duckies! This little pouch always has a few more.", "小さなアヒルたちにどうぞ！この袋には、いつでもパンくずがあるよ。"), 6);
    this.announcement.textContent = b.line[this.language];
  }

  visitTea() {
    const b = this.bubbles[3];
    if (!this.enabled || this.nearest !== 3 || !b.visible || b.distance > 4.5
      || b.element.classList.contains("is-compact") || !this.actions?.visitTea) return false;
    if (!this.life.available(b.profile.id)) return false;
    this.onTalk(); this.actions.visitTea();
    return true;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.layer.hidden = !enabled && this.clock >= this.teaSpeechUntil;
    if (!enabled) {
      this.nearest = -1;
      this.announcement.textContent = "";
      this.bubbles.forEach(b => {
        b.element.hidden = true; if (b.attention) b.attention.hidden = true;
        b.visible = false; b.talkingUntil = 0; b.resident.chatting = false;
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

  sayAtTea(text: Line) {
    this.say(3, text, 6);
    this.teaSpeechUntil = this.clock + 6;
    this.layer.hidden = false;
    this.announcement.textContent = `${this.bubbles[3].profile.name[this.language]}: ${text[this.language]}`;
  }

  clearTeaSpeech() {
    this.teaSpeechUntil = 0;
    if (!this.enabled) this.layer.hidden = true;
    this.bubbles[3].element.hidden = true;
    this.announcement.textContent = "";
  }

  talk(index = this.nearest) {
    const b = this.bubbles[index];
    if (!this.enabled || !b?.visible || b.distance > 4.5 || index !== this.nearest) return false;
    if (!this.life.available(b.profile.id)) return false;
    if (this.life.shared) {
      this.onTalk();
      if (b.profile.id === "wren") this.actions?.crumbs(b.profile.id);
      else this.actions?.talk?.(b.profile.id);
      return true;
    }
    if (b.profile.id === "wren" && this.actions) { this.bread(index); b.talkingUntil = this.clock + 6; b.resident.chatting = true; return true; }
    this.onTalk();
    this.say(index, b.profile.chat[b.chat++ % b.profile.chat.length], 6);
    b.talkingUntil = this.clock + 6;
    b.resident.chatting = true;
    this.announcement.textContent = `${b.profile.name[this.language]}: ${b.line[this.language]}`;
    return true;
  }

  update(delta: number, camera: T.Camera, player: T.Vector3, weather: Weather) {
    if (!this.width || !this.height || !this.enabled && this.clock >= this.teaSpeechUntil) return;
    this.clock += delta;
    if (!this.enabled) {
      if (this.clock >= this.teaSpeechUntil) { this.clearTeaSpeech(); return; }
      const b = this.bubbles[3];
      this.anchor.copy(b.resident.root.position);
      this.anchor.y += 2.12 * b.resident.root.scale.y;
      this.projected.copy(this.anchor).project(camera);
      b.element.hidden = this.projected.z < -1 || this.projected.z > 1;
      if (b.element.hidden) return;
      b.element.classList.remove("is-compact");
      b.button.hidden = true;
      b.actions.hidden = true;
      const width = b.element.offsetWidth, height = b.element.offsetHeight;
      const x = T.MathUtils.clamp((this.projected.x * .5 + .5) * this.width, 24, this.width - 24);
      const y = (-this.projected.y * .5 + .5) * this.height;
      const left = T.MathUtils.clamp(x - width / 2, 12, this.width - width - 12);
      const top = T.MathUtils.clamp(y - height - 14, 76, Math.max(76, this.height * (this.width < 700 ? .44 : .85) - height));
      b.element.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`;
      b.element.style.setProperty("--tail-x", `${T.MathUtils.clamp(x - left, 16, width - 16)}px`);
      return;
    }
    this.nearest = -1;
    const candidates: number[] = [];
    this.bubbles.forEach((b, index) => {
      b.distance = b.resident.root.position.distanceTo(player);
      if (!this.life.shared) b.resident.chatting = b.distance <= 5.5 && this.clock < b.talkingUntil;
      const shared = this.life.sharedState(b.profile.id);
      const speechKey = `${shared?.startedAt}:${shared?.speech?.en}`;
      if (shared?.speech && b.sharedSpeech !== speechKey) { b.sharedSpeech = speechKey; this.say(index, shared.speech, 6); }
      const available = this.life.available(b.profile.id);
      [b.button, b.companion, b.crumbs, b.tea].forEach(button => { if (button) button.disabled = !available; });
      if (b.distance > 7) b.greetingSeen = false;
      this.anchor.copy(b.resident.root.position);
      this.anchor.y += 2.12 * b.resident.root.scale.y;
      this.projected.copy(this.anchor).project(camera);
      const distanceToCamera = this.anchor.distanceTo(camera.position);
      this.ray.origin.copy(camera.position);
      this.ray.direction.subVectors(this.anchor, camera.position).normalize();
      const unobstructed = !this.boxes.some(box => this.ray.intersectBox(box, this.hit) && this.hit.distanceTo(camera.position) < distanceToCamera - .2);
      b.visible = b.distance < 15 && unobstructed && this.projected.z > -1 && this.projected.z < 1
        && Math.abs(this.projected.x) < 1 && Math.abs(this.projected.y) < 1;
      if (b.attention) {
        this.attentionProjected.copy(b.resident.root.position);
        this.attentionProjected.y += 1.25 * b.resident.root.scale.y;
        this.attentionProjected.project(camera);
        b.attention.hidden = !this.mintAvailable || b.distance >= 35 || !unobstructed
          || this.attentionProjected.z < -1 || this.attentionProjected.z > 1
          || Math.abs(this.attentionProjected.x) >= 1 || Math.abs(this.attentionProjected.y) >= 1;
        if (!b.attention.hidden) b.attention.style.transform = `translate3d(${(this.attentionProjected.x * .5 + .5) * this.width - 15}px, ${(-this.attentionProjected.y * .5 + .5) * this.height - 38}px, 0)`;
      }
      if (!b.visible) { b.element.hidden = true; b.button.hidden = true; return; }
      if (b.distance < 4.5 && (this.nearest < 0 || b.distance < this.bubbles[this.nearest].distance)) this.nearest = index;
      if (!this.life.shared && !b.resident.following && !b.greetingSeen && b.distance < 2.5) {
        b.greetingSeen = true;
        this.say(index, b.profile.greeting, 5);
        b.talkingUntil = this.clock + 4;
        b.resident.chatting = true;
      } else if (!b.resident.following && this.clock >= b.nextAmbient && this.clock >= b.talkingUntil) {
        const turn = b.ambient++;
        const text = weather !== "golden" && turn % 2 === 0 ? b.profile[weather === "night" ? "dusk" : weather]
          : b.profile.ambient[turn % b.profile.ambient.length];
        this.say(index, text, 5);
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
      if (b.resident.following && !canChat && this.clock >= b.until) {
        b.visible = false; b.element.hidden = true; return;
      }
      b.button.hidden = !canChat;
      b.actions.hidden = !canChat || !this.actions;
      this.actionLabels(b);
      if (TOWN_RESIDENT_IDS.includes(b.profile.id) && b.companion.hidden) b.actions.hidden = true;
      const compact = canChat && this.clock >= b.until && !(b.tea && this.mintAvailable);
      b.element.classList.toggle("is-compact", compact);
      b.element.hidden = false;
      const measureKey = `${this.language}:${b.line.en}:${canChat}:${b.resident.following}:${compact}:${b.attention && this.mintAvailable}:${b.companion.hidden}`;
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

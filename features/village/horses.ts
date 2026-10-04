import * as T from "three";
import { animateHorseModel, disposeHorseModel, horseStrideLength, makeHorseModel } from "./horseModel";
import { floorHeight, surfaceAt } from "./environment";
import { ResidentMotion } from "./residentMotion";
import type { SharedActor } from "./sharedActors";
import type { SharedTown } from "./townShared";
import type { AuthoredWorld } from "./worldLayout";
import type { HorseSoundEvent } from "./horseAudio";
import type { AnimalSoundSource, TownAnimalSoundEvent } from "./townAnimalAudio";
import { createAnimalDialogueCue, type AnimalDialogueCue } from "./animalDialogue";

export type NearbyHorse = { id: string; name: string; owner: string | null; mode?: SharedActor["mode"] };

/** Horses render accepted server poses only; losing delivery stops them in place. */
export class VillageHorses {
  readonly group = new T.Group();
  private readonly motion = new ResidentMotion();
  private readonly horses: { id: string; name: string; model: T.Group; actor: T.Group; seat: T.Object3D; head: T.Object3D; dialogue: AnimalDialogueCue; distance: number; hoof: number; vocalAt: number; heard: string }[];
  get soundSources(): AnimalSoundSource[] {
    return this.group.visible ? this.horses.filter(horse => horse.actor.visible && !this.states.get(horse.id)?.owner)
      .map(horse => ({ id: horse.id, species: "horse", position: [horse.actor.position.x, horse.actor.position.y + 1.8, horse.actor.position.z] })) : [];
  }
  private readonly cues: AnimalDialogueCue[] = [];
  private states = new Map<string, SharedActor>();
  private received = false;
  private selfId = "";
  private clockOffset = 0;
  private enabled = true;
  private hayFeeds: SharedTown["hayFeeds"] = [];

  constructor(placements: AuthoredWorld["horses"], private onSound: (event: HorseSoundEvent) => void,
    private onCall: (event: TownAnimalSoundEvent) => void = () => {}) {
    this.group.name = "Shared village horses";
    this.horses = (placements ?? []).map((placement, i) => {
      const model = makeHorseModel(placement.coat), actor = new T.Group(); actor.add(model);
      actor.position.set(placement.x, placement.y, placement.z); actor.rotation.y = placement.yaw; actor.scale.fromArray(placement.scale);
      actor.visible = false; actor.name = placement.id; this.group.add(actor);
      const dialogue = createAnimalDialogueCue(placement.id, "Neigh~ (Thank you~)", "ヒヒーン〜（ありがとう〜）");
      this.cues.push(dialogue);
      return { id: placement.id, name: placement.name || (placement.coat === "grey" ? "Willow" : "Hazel"), model, actor,
        seat: model.getObjectByName("HorseSeat")!, head: model.getObjectByName("Head") ?? model, dialogue, distance: 0, hoof: 0, vocalAt: 12 + i * 13, heard: "" };
    });
  }

  applyShared(actors: SharedActor[], selfId: string, time: number, hayFeeds: SharedTown["hayFeeds"] = []) {
    this.hayFeeds = hayFeeds;
    const initial = !this.received || selfId !== this.selfId;
    this.selfId = selfId; this.clockOffset = time - Date.now();
    const horses = actors.filter(actor => actor.kind === "horse");
    this.motion.receive(horses, time, initial); this.received = true;
    this.states = new Map(horses.map(actor => [actor.id, actor]));
    for (const horse of this.horses) {
      const state = this.states.get(horse.id); horse.actor.visible = Boolean(state);
      if (initial) horse.heard = `${hayFeeds.find(feed => feed.horseId === horse.id)?.startedAt ?? state?.startedAt}`;
      if (!state) horse.dialogue.visible = false;
      if (!state) continue;
      if (horse.actor.position.distanceToSquared(new T.Vector3(state.x, state.y, state.z)) > 100) {
        this.motion.reset(state, time); horse.actor.position.set(state.x, state.y, state.z);
      }
    }
  }

  update(dt: number, elapsed: number, reducedMotion: boolean, listener: T.Vector3, enabled: boolean) {
    this.enabled = enabled;
    for (const horse of this.horses) {
      const state = this.states.get(horse.id); horse.dialogue.visible = false; if (!state) continue;
      const pose = this.motion.sample(state), travel = Math.hypot(pose.x - horse.actor.position.x, pose.z - horse.actor.position.z);
      const speed = dt > 0 && dt < .25 && travel < 2 ? travel / dt : 0;
      const step = travel < 2 ? travel / Math.max(.2, horse.actor.scale.z) : 0;
      horse.distance += step;
      horse.actor.position.set(pose.x, pose.y, pose.z);
      const sin = Math.sin(pose.heading), cos = Math.cos(pose.heading);
      const length = .75 * horse.actor.scale.z, width = .3 * horse.actor.scale.x;
      const forwardSlope = (floorHeight(pose.x + sin * length, pose.z + cos * length)
        - floorHeight(pose.x - sin * length, pose.z - cos * length)) / (length * 2);
      const sideSlope = (floorHeight(pose.x + cos * width, pose.z - sin * width)
        - floorHeight(pose.x - cos * width, pose.z + sin * width)) / (width * 2);
      const pitch = T.MathUtils.clamp(-Math.atan(forwardSlope), -.55, .55);
      // Tilt in the horse's heading frame without changing its accepted position.
      horse.actor.rotation.set(pitch, pose.heading, T.MathUtils.clamp(Math.atan(sideSlope * Math.cos(pitch)), -.55, .55), "YXZ");
      const meal = this.hayFeeds.find(feed => feed.horseId === horse.id && feed.until > Date.now() + this.clockOffset);
      const response = `${meal?.startedAt ?? state.startedAt}`;
      if (horse.heard !== response) {
        horse.heard = response;
        const responseAge = (Date.now() + this.clockOffset - (meal?.startedAt ?? state.startedAt)) / 1000;
        if (enabled && (meal || state.mode === "hold") && responseAge >= 0 && responseAge < 1.2)
          this.onCall({ species: "horse", position: [pose.x, pose.y + 1.8, pose.z], happy: true });
      }
      animateHorseModel(horse.model, elapsed, speed, horse.distance, reducedMotion, !!meal || state.mode === "hold",
        Math.max(0, (Date.now() + this.clockOffset - (meal?.startedAt ?? state.startedAt)) / 1000));
      horse.head.getWorldPosition(horse.dialogue.position); horse.dialogue.position.y += .18;
      const age = Math.max(0, (Date.now() + this.clockOffset - state.startedAt) / 1000);
      horse.dialogue.visible = this.group.visible && horse.actor.visible && enabled && Boolean(state.owner)
        && ["hold", "ride"].includes(state.mode) && age < 3 && horse.dialogue.position.distanceToSquared(listener) < 100;
      horse.dialogue.priority = state.mode === "hold" ? 3 : 1;
      horse.dialogue.text.en = state.mode === "hold" ? "Neigh~ (Thank you~)" : "Neigh~ (Let’s go for a gentle ride~)";
      horse.dialogue.text.ja = state.mode === "hold" ? "ヒヒーン〜（ありがとう〜）" : "ヒヒーン〜（のんびりおさんぽしよう〜）";
      const stride = horseStrideLength(speed), hoof = horse.hoof + step / stride * (speed < 3.2 ? 4 : 2);
      const audible = enabled && listener.distanceToSquared(horse.actor.position) < 24 ** 2;
      if (Math.floor(hoof) !== Math.floor(horse.hoof) && speed > .2 && audible) this.onSound({ kind: "hoof", position: [pose.x, pose.y + .12, pose.z], surface: surfaceAt(pose.x, pose.z), speed });
      horse.hoof = hoof;
      if (elapsed >= horse.vocalAt) {
        horse.vocalAt = elapsed + 24 + this.horses.indexOf(horse) * 9;
        if (audible && speed < .2 && listener.distanceToSquared(horse.actor.position) < 9 ** 2)
          this.onSound({ kind: "breath", position: [pose.x, pose.y + 1.8, pose.z], surface: "grass", speed });
      }
    }
  }

  nearest(position: T.Vector3): NearbyHorse | null {
    if (!this.group.visible || !this.enabled) return null;
    let distance = 2.8, nearest: NearbyHorse | null = null;
    for (const horse of this.horses) {
      const state = this.states.get(horse.id); if (!state || !horse.actor.visible || state.owner === this.selfId && state.mode === "ride") continue;
      const next = position.distanceTo(horse.actor.position);
      if (next < distance) { distance = next; nearest = { id: horse.id, name: horse.name, owner: state.owner, mode: this.hayFeeds.some(feed => feed.horseId === horse.id && feed.until > Date.now() + this.clockOffset) ? "hold" : state.mode }; }
    }
    return nearest;
  }

  seatPoint(id: string, target: T.Vector3): boolean {
    const horse = this.horses.find(value => value.id === id);
    if (!horse || !this.states.has(id)) return false;
    horse.actor.updateWorldMatrix(true, true); horse.seat.getWorldPosition(target); return true;
  }

  heading(id: string) { return this.horses.find(horse => horse.id === id)?.actor.rotation.y ?? 0; }
  get dialogueCues(): readonly AnimalDialogueCue[] { return this.cues; }
  get riders() { return [...this.states.values()].filter(state => state.owner && state.mode === "ride").map(state => ({ id: state.id, owner: state.owner! })); }
  reset() { this.hayFeeds = []; this.received = false; this.states.clear(); this.horses.forEach(horse => { horse.actor.visible = false; horse.dialogue.visible = false; }); }
  dispose() { this.horses.forEach(horse => { horse.dialogue.visible = false; disposeHorseModel(horse.model); }); this.states.clear(); this.group.clear(); }
}

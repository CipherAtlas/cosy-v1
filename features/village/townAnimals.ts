import * as T from "three";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { animateHorseModel, disposeHorseModel, makeHorseModel } from "./horseModel";
import { ResidentMotion } from "./residentMotion";
import { tintSpirit } from "./villageVisitors";
import type { AuthoredWorld } from "./worldLayout";
import type { SharedActor } from "./sharedActors";
import type { SharedTown, TownAnimal } from "./townShared";
import { animalHeartGeometry } from "./animalEmotes";
import { createAnimalDialogueCue, type AnimalDialogueCue } from "./animalDialogue";
import type { AnimalSoundSource, TownAnimalSoundEvent } from "./townAnimalAudio";
import { animateAnimalRig, disposeAnimalRig, isAnimalRigLoaded, makeAnimalRig, ANIMAL_RIG_ASSETS } from "./animalRig";

const speciesModels = { "cow-highland": "CowHighland", "cow-highland-girl": "CowHighlandGirl", sheep: "Sheep", lamb: "Lamb", hedgehog: "Hedgehog" };

const ANIMAL_LINES = {
  cow: {
    idle: { en: "Moo moo~", ja: "モーモー〜" },
    pet: { en: "Moo moo~ (That feels lovely~)", ja: "モーモー〜（気持ちいいな〜）" },
    thanks: { en: "Moo moo~ (Thank you~)", ja: "モーモー〜（ありがとう〜）" },
    gift: { en: "Moo moo~", ja: "モーモー〜" },
  },
  sheep: {
    idle: { en: "Meeeh mee~", ja: "メェメェ〜" },
    pet: { en: "Meeeh mee~ (That feels lovely~)", ja: "メェメェ〜（気持ちいいな〜）" },
    thanks: { en: "Meeeh mee~ (Thank you~)", ja: "メェメェ〜（ありがとう〜）" },
    gift: { en: "Meeeh mee~", ja: "メェメェ〜" },
  },
  lamb: {
    idle: { en: "Baa baa~", ja: "メェメェ〜" },
    pet: { en: "Baa baa~ (More cuddles~)", ja: "メェメェ〜（もっとなでて〜）" },
    thanks: { en: "Baa baa~ (Thank you~)", ja: "メェメェ〜（ありがとう〜）" },
    gift: { en: "Baa baa~", ja: "メェメェ〜" },
  },
  hedgehog: {
    idle: { en: "Snuffle snuffle~", ja: "くんくん〜" },
    pet: { en: "Snuffle snuffle~ (A little cuddle~)", ja: "くんくん〜（なでてくれてうれしいな〜）" },
    thanks: { en: "Snuffle~ (Thank you~)", ja: "くんくん〜（ありがとう〜）" },
    gift: { en: "Snuffle~ (For you~)", ja: "くんくん〜（あなたにどうぞ〜）" },
  },
};

/** Animals move only through accepted poses; pet gestures share the server's action clock. */
export class TownAnimals {
  readonly group = new T.Group();
  private motion = new ResidentMotion();
  private animals: { id: string; root: T.Group; model: T.Object3D; body?: T.Object3D; bodyBase: T.Vector3; head?: T.Object3D; legs: T.Object3D[]; tail?: T.Object3D; hearts: T.Mesh[]; apple: T.Object3D; mushroom: T.Object3D; speech: AnimalDialogueCue; state?: TownAnimal; distance: number; speed: number; lastCall: string }[] = [];
  readonly dialogueCues: AnimalDialogueCue[] = [];
  get soundSources(): AnimalSoundSource[] {
    return this.group.visible ? this.animals.filter(animal => animal.state && animal.root.visible && !animal.state.owner)
      .map(animal => ({ id: animal.id, species: animal.state!.species, position: [animal.root.position.x, animal.root.position.y + .8, animal.root.position.z] })) : [];
  }
  private rival = new T.Group();
  private rivalHorse = makeHorseModel("grey");
  private rivalState: SharedActor | null = null;
  private rivalDistance = 0;
  private received = false;
  private timeOffset = 0;
  private petVisitors = new WeakSet<T.Object3D>();

  constructor(layout: AuthoredWorld, source: T.Object3D, spirit: T.Object3D, private sound: (event: TownAnimalSoundEvent) => void = () => {}, rider?: T.Object3D) {
    this.group.name = "Shared pasture animals and Rowan";
    const heartGeometry = animalHeartGeometry();
    const heartMaterial = new T.MeshBasicMaterial({ color: "#ffb8c0", transparent: true, side: T.DoubleSide, depthWrite: false });
    for (const item of layout.items ?? []) {
      if (!item.visible || !(item.asset in speciesModels)) continue;
      const modelName = speciesModels[item.asset as keyof typeof speciesModels], template = source.getObjectByName(modelName);
      if (!template) throw Error(`Animal model missing: ${modelName}`);
      const slug = ANIMAL_RIG_ASSETS[item.asset];
      const root = new T.Group(), model = slug && isAnimalRigLoaded(slug) ? makeAnimalRig(slug) : cloneSkeleton(template); root.add(model); root.scale.fromArray(item.scale);
      root.position.fromArray(item.position); root.rotation.y = item.rotation[1] * Math.PI / 180;
      root.name = item.name || item.id; root.visible = false;
      let head: T.Object3D | undefined, tail: T.Object3D | undefined, body: T.Object3D | undefined; const legs: T.Object3D[] = [];
      model.traverse(node => {
        if (!(node instanceof T.Mesh)) {
          if (/Head(?:[._]|$)/.test(node.name)) head ??= node;
          if (/Tail(?:[._]|$)/.test(node.name)) tail ??= node;
          if (/Body(?:[._]|$)/.test(node.name)) body ??= node;
          if (/Leg(?:Front|Back)(?:Left|Right)/.test(node.name)) legs.push(node);
        }
        if (node instanceof T.Mesh) node.castShadow = node.receiveShadow = true;
      });
      const hearts = Array.from({ length: 3 }, () => { const heart = new T.Mesh(heartGeometry, heartMaterial); heart.visible = false; return heart; });
      const apple = cloneSkeleton(source.getObjectByName("ForageApple")!), mushroom = cloneSkeleton(source.getObjectByName("ForageMushroom")!);
      apple.visible = mushroom.visible = false;
      if (item.asset === "hedgehog") {
        apple.position.set(0, .47, -.06); mushroom.position.set(0, .45, -.06); root.add(apple, mushroom);
      } else if (model.userData.animalRigSlug && head) {
        model.updateMatrixWorld(true);
        const bounds = new T.Box3(), inverse = model.matrixWorld.clone().invert();
        model.traverse(node => {
          if (!(node instanceof T.Mesh)) return;
          node.geometry.computeBoundingBox();
          bounds.union(node.geometry.boundingBox!.clone().applyMatrix4(inverse.clone().multiply(node.matrixWorld)));
        });
        const muzzle = new T.Vector3(0, bounds.min.y + (bounds.max.y - bounds.min.y) * .65, bounds.max.z + .04);
        head.worldToLocal(model.localToWorld(muzzle)); apple.position.copy(muzzle); mushroom.position.copy(muzzle); head.add(apple, mushroom);
      } else { apple.position.set(0, -.12, .68); mushroom.position.set(0, -.23, .67); head?.add(apple, mushroom); }
      const species = item.asset.startsWith("cow-highland") ? "cow" : item.asset as "sheep" | "lamb" | "hedgehog";
      const text = ANIMAL_LINES[species].idle;
      const speech = createAnimalDialogueCue(item.id, text.en, text.ja);
      this.dialogueCues.push(speech);
      this.group.add(root, ...hearts); this.animals.push({ id: item.id, root, model, body, bodyBase: body?.position.clone() ?? new T.Vector3(), head, legs, tail, hearts, apple, mushroom, speech, distance: 0, speed: 0, lastCall: "" });
    }
    this.rival.add(this.rivalHorse);
    const jockey = cloneSkeleton(rider ?? spirit); jockey.position.set(0, 0, 0); jockey.rotation.set(0, 0, 0);
    if (!rider) tintSpirit(jockey, "#adc8a0", true);
    this.rivalHorse.getObjectByName("HorseSeat")!.add(jockey);
    this.rival.name = "Rowan and Bramble"; this.rival.visible = false; this.group.add(this.rival);
  }

  applyShared(town: SharedTown | undefined, time: number) {
    this.timeOffset = time - Date.now();
    if (!town) { this.reset(); return; }
    const states: SharedActor[] = [];
    for (const animal of this.animals) {
      animal.state = town.animals.find(state => state.id === animal.id);
      animal.root.visible = !!animal.state;
      if (animal.state) {
        if (!this.received) { animal.root.position.set(animal.state.x, animal.state.y, animal.state.z); animal.root.rotation.y = animal.state.heading; }
        states.push(this.pose(animal.state));
      }
    }
    this.rivalState = town.rival; this.rival.visible = !!town.rival;
    if (town.rival) states.push(town.rival);
    this.motion.receive(states, time, !this.received); this.received = true;
  }

  private pose(animal: TownAnimal): SharedActor {
    return { ...animal, kind: "resident", speed: 0, following: false, mode: animal.mode === "pet" ? "pet" : "roam", action: null, speech: null };
  }

  interactionPosition(owner: string, nearby: T.Vector3, target: T.Vector3) {
    const animal = this.animals.find(animal => animal.state?.owner === owner && ["pet", "apple"].includes(animal.state.mode)
      && animal.state.until > Date.now() + this.timeOffset)
      ?? this.animals.find(animal => animal.state?.mode === "gift" && animal.state.carry && animal.root.position.distanceTo(nearby) < 3.2);
    if (!animal) return undefined;
    target.copy(animal.root.position); return animal.state;
  }

  /** The same accepted pet clock gives the visitor and observers a gentle reaching pose. */
  posePetting(owner: string, visitor: T.Group, spirit: T.Object3D, fins: T.Object3D[], dt: number, reduced: boolean, enabled = true) {
    const animal = this.animals.find(animal => animal.state?.owner === owner && ["pet", "apple"].includes(animal.state.mode)
      && animal.state.until > Date.now() + this.timeOffset);
    if (!enabled || !animal || visitor.position.distanceTo(animal.root.position) > 4) {
      if (this.petVisitors.has(spirit)) {
        spirit.position.y = .62; spirit.position.z = 0; spirit.rotation.x = 0;
        fins.forEach(fin => { fin.rotation.x = 0; });
        this.petVisitors.delete(spirit);
      }
      return;
    }
    this.petVisitors.add(spirit);
    const age = (Date.now() + this.timeOffset - animal.state!.startedAt) / 1000;
    const duration = animal.state!.mode === "apple" ? 8 : 6;
    const amount = reduced ? 1 : T.MathUtils.smoothstep(age, 0, .65) * (1 - T.MathUtils.smoothstep(age, duration - .8, duration));
    const heading = Math.atan2(animal.root.position.x - visitor.position.x, animal.root.position.z - visitor.position.z);
    const turn = Math.atan2(Math.sin(heading - visitor.rotation.y), Math.cos(heading - visitor.rotation.y));
    visitor.rotation.y += turn * (reduced ? 1 : 1 - Math.exp(-dt * 8));
    const lower = animal.state!.species === "hedgehog" ? .3 : animal.state!.species === "cow" ? 0 : .08;
    const stroke = reduced ? 0 : Math.sin(age * 4.5) * .045;
    spirit.position.y = .62 - lower * amount; spirit.position.z = (.13 + stroke) * amount; spirit.rotation.x = .18 * amount;
    fins.forEach(fin => {
      fin.rotation.x = (-.38 + stroke) * amount;
      fin.rotation.z = (fin.name.endsWith("L") ? 1 : -1) * amount * (.3 + (reduced ? 0 : Math.sin(age * 4.5) * .09));
    });
  }

  update(dt: number, reduced: boolean, camera: T.Quaternion) {
    const now = Date.now() + this.timeOffset;
    for (const [index, animal] of this.animals.entries()) {
      const state = animal.state; if (!state) continue;
      const pose = this.motion.sample(this.pose(state)), distance = Math.hypot(pose.x - animal.root.position.x, pose.z - animal.root.position.z);
      const step = distance < 1 ? distance : 0;
      animal.distance += step;
      animal.speed = T.MathUtils.damp(animal.speed, dt > 0 ? step / dt : 0, 8, dt);
      animal.root.position.set(pose.x, pose.y, pose.z); animal.root.rotation.y = pose.heading;
      const pet = state.mode === "pet" && state.until > now, age = (now - state.startedAt) / 1000;
      const eating = state.mode === "apple" && state.until > now;
      const t = now / 1000, phase = t + index * 1.7, happy = pet || eating;
      const duration = eating ? 8 : 6, affection = happy ? T.MathUtils.smoothstep(age, 0, .6) * (1 - T.MathUtils.smoothstep(age, duration - .8, duration)) : 0;
      const stride = state.species === "cow" ? 1.35 : state.species === "sheep" ? .8 : state.species === "lamb" ? .58 : .29;
      const gait = animal.distance / stride * Math.PI * 2, walking = T.MathUtils.clamp(animal.speed / .65, 0, 1);
      const native = animateAnimalRig(animal.model, { action: happy ? "pet" : walking > .12 ? "walk" : "idle", time: t, reduced,
        phase: happy ? T.MathUtils.clamp(age / duration, 0, 1) : walking > .12 ? (animal.distance / stride) % 1 : undefined });
      if (!native) {
        animal.model.position.y = reduced ? 0 : Math.sin(gait * 2) * walking * (state.species === "cow" ? .013 : .02);
        animal.model.rotation.z = reduced ? 0 : Math.sin(gait) * walking * .016 + Math.sin(age * 2.2 + index) * affection * (state.species === "hedgehog" ? .065 : .035);
        if (animal.body) animal.body.position.copy(animal.bodyBase).y += reduced ? 0 : affection * Math.sin(age * 3.2) * (state.species === "hedgehog" ? .018 : .026);
        if (animal.head) {
          animal.head.rotation.x = reduced ? 0 : eating ? -.16 + Math.sin(age * 8) * .045 : pet ? affection * (-.16 + Math.sin(age * 3.2) * .06) : .06 + Math.sin(phase * .8) * .055;
          animal.head.rotation.y = reduced ? 0 : pet ? Math.sin(age * 2.2) * .13 * affection : state.species === "hedgehog" ? Math.sin(t * 3.1) * .06 : Math.sin(phase * .4) * .035;
          animal.head.rotation.z = reduced ? 0 : happy ? Math.sin(age * 2.6 + index) * .11 * affection : 0;
        }
        animal.legs.forEach(leg => {
          const diagonal = leg.name.includes("FrontLeft") || leg.name.includes("BackRight") ? 0 : Math.PI;
          leg.rotation.x = reduced ? 0 : Math.sin(gait + diagonal) * walking * (state.species === "hedgehog" ? .28 : .32)
            + (pet && leg.name.includes("Front") ? Math.sin(age * 3.2) * .05 * affection : 0);
        });
        if (animal.tail) animal.tail.rotation.z = reduced ? 0 : Math.sin(phase * (happy ? 6.5 : 1.3)) * (happy ? .28 * affection : .07);
      }
      animal.apple.visible = state.species === "hedgehog" ? state.carry === "apple" : eating && age < 6 && state.mealFood !== "mushroom";
      animal.mushroom.visible = state.species === "hedgehog" ? state.carry === "mushroom" : eating && age < 6 && state.mealFood === "mushroom";
      if (state.species === "cow") { const scale = eating && !reduced ? Math.max(.15, 1 - age / 6) : 1; animal.apple.scale.setScalar(scale); animal.mushroom.scale.setScalar(scale); }
      const gift = state.species === "hedgehog" && state.mode === "gift", showHearts = happy || gift && age < 4;
      const height = state.species === "cow" ? 2.15 : state.species === "hedgehog" ? .66 : 1.35;
      animal.hearts.forEach((heart, heartIndex) => {
        heart.visible = showHearts;
        const rise = ((Math.max(0, age) + heartIndex * .63) % 2.3) / 2.3;
        heart.position.set(pose.x + (heartIndex - 1) * .23, pose.y + height + (reduced ? heartIndex * .16 : rise * .58), pose.z);
        heart.quaternion.copy(camera); heart.scale.setScalar(reduced ? .17 : Math.sin(rise * Math.PI) * (heartIndex === 1 ? .26 : .18));
      });
      const idleAge = (t + index * 6.1) % 31;
      animal.speech.visible = happy || gift && age < 4 || idleAge < 2.3;
      animal.speech.text = ANIMAL_LINES[state.species][eating ? "thanks" : pet ? "pet" : gift ? "gift" : "idle"];
      animal.speech.priority = happy ? 3 : gift ? 2 : 1;
      (animal.head ?? animal.root).getWorldPosition(animal.speech.position);
      animal.speech.position.y += state.species === "cow" ? .4 : .2;
      const call = `${state.mode}:${state.startedAt}`;
      if ((happy || gift) && animal.lastCall !== call) {
        animal.lastCall = call;
        if (age >= 0 && age < 1.2 && this.group.visible) this.sound({ species: state.species, position: [pose.x, pose.y + height * .5, pose.z], happy: true });
      }
    }
    if (this.rivalState) {
      const pose = this.motion.sample(this.rivalState), travel = Math.hypot(pose.x - this.rival.position.x, pose.z - this.rival.position.z);
      const step = travel < 2 ? travel : 0; this.rivalDistance += step;
      this.rival.position.set(pose.x, pose.y, pose.z); this.rival.rotation.y = pose.heading;
      animateHorseModel(this.rivalHorse, now / 1000, dt ? step / dt : 0, this.rivalDistance, reduced);
    }
  }

  reset() {
    this.received = false; this.rivalState = null; this.rival.visible = false;
    this.animals.forEach(animal => { animal.state = undefined; animal.root.visible = animal.speech.visible = false; animal.hearts.forEach(heart => { heart.visible = false; }); animal.speed = 0; animal.lastCall = ""; });
  }
  dispose() {
    disposeHorseModel(this.rivalHorse);
    this.animals[0]?.hearts[0].geometry.dispose();
    const heartMaterial = this.animals[0]?.hearts[0].material; if (heartMaterial instanceof T.Material) heartMaterial.dispose();
    this.animals.forEach(animal => { disposeAnimalRig(animal.model); animal.speech.visible = false; });
    this.animals = [];
  }
}

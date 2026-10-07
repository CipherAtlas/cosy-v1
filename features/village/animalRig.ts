import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { withBasePath } from "../../lib/basePath";
import type { AuthoredWorld } from "./worldLayout";

export const ANIMAL_RIG_SLUGS = ["horse-bay", "horse-grey", "highland-copper", "highland-flower", "dog-corgi", "dog-shiba", "dog-beagle", "dog-samoyed", "dog-collie", "dog-shepherd", "sheep", "lamb", "cat", "swan", "owl", "duck", "duckling"] as const;
export type AnimalRigSlug = typeof ANIMAL_RIG_SLUGS[number];
export const ANIMAL_RIG_ASSETS: Readonly<Record<string, AnimalRigSlug>> = {
  ...Object.fromEntries(ANIMAL_RIG_SLUGS.map(slug => [`animal-${slug}`, slug])) as Record<string, AnimalRigSlug>,
  "cow-highland": "highland-copper", "cow-highland-girl": "highland-flower", sheep: "sheep", lamb: "lamb", "owl-brown": "owl",
  "garden-swan": "swan", "garden-duck": "duck", "garden-duckling": "duckling", "cottage-cat": "cat",
};

export function animalRigSlugsForLayout(authored: AuthoredWorld): Set<AnimalRigSlug> {
  const slugs = new Set<AnimalRigSlug>();
  for (const item of authored.items ?? []) {
    if (!item.visible || item.scale.some(value => value <= 0)) continue;
    const slug = ANIMAL_RIG_ASSETS[item.asset]; if (slug) slugs.add(slug);
    if (item.asset === "pond") { slugs.add("swan"); slugs.add("duck"); slugs.add("duckling"); }
    if (item.asset === "horse-racetrack") slugs.add("horse-grey");
  }
  for (const horse of authored.horses ?? []) slugs.add(horse.coat === "grey" ? "horse-grey" : "horse-bay");
  for (const puppy of authored.puppies ?? []) slugs.add(`dog-${puppy.breed}`);
  return slugs;
}

const templates = new Map<AnimalRigSlug, { scene: T.Group; clips: T.AnimationClip[] }>();
const loading = new Map<AnimalRigSlug, Promise<void>>();
const rigs = new WeakMap<T.Object3D, { mixer: T.AnimationMixer; actions: Map<string, T.AnimationAction>; clips: T.AnimationClip[]; action: string; time: number }>();

/** Load only the authored animals; the same templates serve gameplay and the local editor. */
export async function loadAnimalRigs(slugs: Iterable<AnimalRigSlug>) {
  await Promise.all([...new Set(slugs)].map(slug => {
    if (templates.has(slug)) return Promise.resolve();
    const pending = loading.get(slug); if (pending) return pending;
    const promise = new GLTFLoader().loadAsync(withBasePath(`/village/models/animals-v2/${slug}.glb?v=${slug === "owl" ? "owl2" : "rig1"}`)).then(kit => {
      let skinned = false;
      kit.scene.traverse(object => {
        if (object instanceof T.Mesh) object.castShadow = object.receiveShadow = true;
        if (object instanceof T.SkinnedMesh) skinned = true;
      });
      if (!skinned || !kit.animations.some(clip => clip.name === "idle")) throw Error(`Animal rig is missing its skin or idle clip: ${slug}`);
      templates.set(slug, { scene: kit.scene, clips: kit.animations });
    }).finally(() => loading.delete(slug));
    loading.set(slug, promise); return promise;
  }));
}

export function isAnimalRigLoaded(slug: AnimalRigSlug) { return templates.has(slug); }
export const hasAnimalRig = isAnimalRigLoaded;

function stateFor(model: T.Object3D) {
  const current = rigs.get(model); if (current) return current;
  const template = templates.get(model.userData.animalRigSlug as AnimalRigSlug); if (!template) return undefined;
  const mixer = new T.AnimationMixer(model), actions = new Map<string, T.AnimationAction>();
  for (const clip of template.clips) {
    const action = mixer.clipAction(clip); action.play(); action.setEffectiveWeight(0); actions.set(clip.name, action);
  }
  const state = { mixer, actions, clips: template.clips, action: "", time: NaN }; rigs.set(model, state); return state;
}

export function makeAnimalRig(slug: AnimalRigSlug): T.Group {
  const template = templates.get(slug); if (!template) throw Error(`Animal rig must be loaded before construction: ${slug}`);
  const model = cloneSkeleton(template.scene) as T.Group; model.userData.animalRigSlug = slug; model.animations = template.clips;
  return model;
}

export function animalRigClips(model: T.Object3D): readonly T.AnimationClip[] | undefined { return stateFor(model)?.clips; }

/** Native deformation never changes the accepted outer world pose or its action clocks. */
export function animateAnimalRig(model: T.Object3D, options: { action: string; time: number; reduced: boolean; phase?: number; stillAction?: string }): boolean {
  const state = stateFor(model); if (!state) return false;
  const requested = options.reduced ? options.stillAction ?? "idle" : options.action;
  const name = state.actions.has(requested) ? requested : "idle";
  const delta = Number.isFinite(state.time) ? Math.max(0, Math.min(.1, options.time - state.time)) : 1;
  const blend = options.reduced || !state.action || options.time < state.time ? 1 : 1 - Math.exp(-delta * 14);
  for (const [key, action] of state.actions) {
    const target = key === name ? 1 : 0;
    action.setEffectiveWeight(T.MathUtils.lerp(action.getEffectiveWeight(), target, blend));
    const duration = action.getClip().duration;
    action.time = options.reduced ? 0 : key === name && options.phase !== undefined
      ? T.MathUtils.clamp(options.phase, 0, 1) * duration
      : duration > 0 ? ((options.time % duration) + duration) % duration : 0;
  }
  state.mixer.update(0); state.action = name; state.time = options.time; return true;
}

export function disposeAnimalRig(model: T.Object3D) {
  const state = rigs.get(model);
  if (state) { state.mixer.stopAllAction(); state.mixer.uncacheRoot(model); rigs.delete(model); }
  const skeletons = new Set<T.Skeleton>();
  model.traverse(object => { if (object instanceof T.SkinnedMesh) skeletons.add(object.skeleton); });
  for (const skeleton of skeletons) skeleton.dispose();
}

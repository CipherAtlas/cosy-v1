import * as T from "three";
import { withBasePath } from "@/lib/basePath";
import { projectWorldLayout, type AuthoredWorld } from "./worldLayout";
import { loadAnimalRigs, type AnimalRigSlug } from "./animalRig";

export async function loadVillageLayout(): Promise<AuthoredWorld> {
  const response = await fetch(withBasePath("/village/world-layout.json"));
  if (!response.ok) throw Error("The playable village layout could not be loaded.");
  return projectWorldLayout(await response.json());
}

/** Only placed breeds join the entry barrier; the editor retains the complete source kit. */
export async function loadPlacedPuppies(layout: AuthoredWorld) {
  const breeds = [...new Set(layout.puppies.map(puppy => puppy.breed))];
  await loadAnimalRigs(breeds.map(breed => `dog-${breed}` as AnimalRigSlug));
  // PuppyPack creates independent cached skeletons per placement. Keep the
  // existing kit shape for source-only previews that supply their own models.
  return { scene: new T.Group(), animations: [] as T.AnimationClip[] };
}

export function disposeModel(root: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>();
  root.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
}

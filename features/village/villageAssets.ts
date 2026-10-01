import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { withBasePath } from "@/lib/basePath";
import { projectWorldLayout, type AuthoredWorld } from "./worldLayout";

export async function loadVillageLayout(): Promise<AuthoredWorld> {
  const response = await fetch(withBasePath("/village/world-layout.json"));
  if (!response.ok) throw Error("The playable village layout could not be loaded.");
  return projectWorldLayout(await response.json());
}

/** Only placed breeds join the entry barrier; the editor retains the complete source kit. */
export async function loadPlacedPuppies(layout: AuthoredWorld) {
  const breeds = [...new Set(layout.puppies.map(puppy => puppy.breed))];
  const kits = await Promise.all(breeds.map(breed => new GLTFLoader().loadAsync(
    withBasePath(`/village/models/puppies/${breed}.glb?v=1`),
  )));
  const scene = new T.Group();
  for (const kit of kits) scene.add(...kit.scene.children);
  return { scene, animations: kits.flatMap(kit => kit.animations) };
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

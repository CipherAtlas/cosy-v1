import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Collider } from "./environment";
import type { WorldItem } from "./worldLayout";
import { withBasePath } from "@/lib/basePath";
import { fantasyTreeGeometry } from "./fantasyTrees";
import { isAnimalRigLoaded, makeAnimalRig, type AnimalRigSlug } from "./animalRig";

export type TownAsset = { id: string; name: string; category: string; template: T.Object3D; shelf: boolean; solid: boolean; localColliders: Collider[] };
export const TOWN_ASSET_IDS = ["horse-racetrack", "horse-stable", "farm-row", "owl-feeding-perch", "owl-brown", "hay-bale", "cow-highland", "cow-highland-girl", "sheep", "lamb", "hedgehog", "forage-apple", "forage-mushroom", "apple-tree", "mushroom-patch"];
export const TOWN_ANIMAL_ASSETS = ["cow-highland", "cow-highland-girl", "sheep", "lamb", "hedgehog"];
let kitPromise: Promise<T.Group> | undefined;

/** One original Blender kit shared by game life and rendered studio previews. */
export function loadTownAssetKit(): Promise<T.Group> {
  if (!kitPromise) {
    const nativeAnimals = ["highland-copper", "highland-flower", "sheep", "lamb", "owl"] as const;
    const farmFile = nativeAnimals.every(isAnimalRigLoaded) ? "farm-props" : "farm-animals";
    kitPromise = Promise.all([
      new GLTFLoader().loadAsync(withBasePath("/village/models/town-kit.glb?v=2")),
      new GLTFLoader().loadAsync(withBasePath(`/village/models/${farmFile}.glb?v=2`)),
    ]).then(([town, life]) => {
      const root = new T.Group(); root.name = "Original Blender town kit"; root.add(town.scene, life.scene);
      for (const [slug, name] of [["highland-copper", "CowHighland"], ["highland-flower", "CowHighlandGirl"], ["sheep", "Sheep"], ["lamb", "Lamb"], ["owl", "OwlBrown"]] as const) {
        if (!isAnimalRigLoaded(slug)) continue;
        root.getObjectByName(name)?.removeFromParent();
        const model = makeAnimalRig(slug); model.name = name; root.add(model);
      }
      root.traverse(object => { if (object instanceof T.Mesh) object.castShadow = object.receiveShadow = true; });
      return root;
    }).catch(error => { kitPromise = undefined; throw error; });
  }
  return kitPromise;
}

export function townAssets(source: T.Object3D): Map<string, TownAsset> {
  const assets = new Map<string, TownAsset>();
  for (const [id, name, category, model] of [
    ["horse-racetrack", "Willow circuit · horse racetrack", "Town", "HorseRacetrack"],
    ["horse-stable", "Horse stable · two feeding bays", "Town", "HorseStable"],
    ["farm-row", "Farm planting row · 16 m", "Town", "FarmRow"],
    ["owl-feeding-perch", "Owl roost & feeding tray", "Town", "OwlFeedingPerch"],
    ["hay-bale", "Golden hay bale", "Furnishings", "HayBale"],
    ["owl-brown", "Tawny woodland owl", "Animals", "OwlBrown"],
    ["cow-highland", "Soft Highland cow", "Animals", "CowHighland"],
    ["cow-highland-girl", "Flower Highland cow", "Animals", "CowHighlandGirl"],
    ["sheep", "Cloud-soft sheep", "Animals", "Sheep"],
    ["lamb", "Little meadow lamb", "Animals", "Lamb"],
    ["hedgehog", "Little garden hedgehog", "Animals", "Hedgehog"],
    ["forage-apple", "Rosy forage apple", "Nature", "ForageApple"],
    ["forage-mushroom", "Chestnut forage mushroom", "Nature", "ForageMushroom"],
  ]) {
    const original = source.getObjectByName(model);
    if (!original) throw Error(`Town asset missing from Blender kit: ${model}.`);
    const slug = original.userData.animalRigSlug as AnimalRigSlug | undefined;
    const sculpture = slug ? makeAnimalRig(slug) : original.clone(true); sculpture.position.set(0, 0, 0); sculpture.rotation.set(0, 0, 0);
    // Preserve authored proportions such as the smaller lamb inside the editable pivot.
    const template = new T.Group(); template.name = name; template.add(sculpture);
    // Blender exports these separately from the visual mesh so doors and gates stay open.
    const values = original.userData.townColliders;
    const localColliders: Collider[] = typeof values === "string" ? JSON.parse(values) : Array.isArray(values) ? values : [];
    assets.set(id, { id, name, category, template, shelf: true, solid: false, localColliders });
  }
  const tree = new T.Group(); tree.name = "Fruitful apple tree";
  const treeMesh = new T.Mesh(fantasyTreeGeometry(true), new T.MeshStandardMaterial({ vertexColors: true, roughness: .94 }));
  treeMesh.scale.setScalar(.55); treeMesh.castShadow = treeMesh.receiveShadow = true; tree.add(treeMesh);
  placeForageInstances(tree, assets.get("forage-apple")!.template, [
    [-1.25, 2.52, .72, 1.1], [-.66, 2.23, 1.18, 1.05], [.15, 2.29, 1.4, 1.1], [.94, 2.25, .99, 1.0],
    [1.48, 2.73, .22, 1.0], [1.1, 3.08, -.88, .95], [.3, 2.52, -1.4, 1.05], [-.78, 2.55, -1.05, 1.0],
    [-1.5, 2.96, -.25, .95], [-.42, 3.81, .61, 1.0], [.9, 3.6, .76, 1.0], [.58, 3.97, -.39, .95],
  ]);
  assets.set("apple-tree", { id: "apple-tree", name: tree.name, category: "Nature", template: tree, shelf: true, solid: false,
    localColliders: [{ x: 0, z: 0, w: .42, d: .42, bottom: 0, top: 2.95 }] });
  const patch = new T.Group(); patch.name = "Little mushroom patch";
  const moss = new T.Mesh(new T.IcosahedronGeometry(1, 2), new T.MeshStandardMaterial({ color: "#8fa878", roughness: 1 }));
  moss.scale.set(.78, .042, .68); moss.position.y = .014; moss.receiveShadow = true; patch.add(moss);
  placeForageInstances(patch, assets.get("forage-mushroom")!.template, [
    [-.38, .035, -.12, 1.25], [.03, .045, -.28, 1.5], [.4, .025, -.06, .92], [-.12, .042, .27, .78], [.25, .03, .3, .62], [-.51, .03, .28, .58],
  ]);
  assets.set("mushroom-patch", { id: "mushroom-patch", name: patch.name, category: "Nature", template: patch, shelf: true, solid: false, localColliders: [] });
  return assets;
}

/** Reuse the original Blender sculpture with one draw per material across a small grove. */
function placeForageInstances(root: T.Group, template: T.Object3D, positions: [number, number, number, number][]) {
  template.updateMatrixWorld(true);
  const inverse = template.matrixWorld.clone().invert(), transform = new T.Matrix4();
  template.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    const local = inverse.clone().multiply(object.matrixWorld);
    const mesh = new T.InstancedMesh(object.geometry, object.material, positions.length);
    positions.forEach(([x, y, z, scale], index) => {
      transform.compose(new T.Vector3(x, y, z), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), index * 2.399963), new T.Vector3(scale, scale, scale));
      mesh.setMatrixAt(index, transform.multiply(local));
    });
    mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
  });
}

export function transformTownColliders(colliders: Collider[], item: WorldItem): Collider[] {
  const matrix = new T.Matrix4().compose(new T.Vector3(...item.position), new T.Quaternion().setFromEuler(new T.Euler(...item.rotation.map(T.MathUtils.degToRad) as [number, number, number])), new T.Vector3(...item.scale));
  return colliders.map(collider => {
    const box = new T.Box3(new T.Vector3(collider.x - collider.w / 2, collider.bottom ?? 0, collider.z - collider.d / 2), new T.Vector3(collider.x + collider.w / 2, collider.top ?? 4, collider.z + collider.d / 2)).applyMatrix4(matrix);
    const size = box.getSize(new T.Vector3()), center = box.getCenter(new T.Vector3());
    return { x: center.x, z: center.z, w: size.x, d: size.z, bottom: box.min.y, top: box.max.y };
  });
}

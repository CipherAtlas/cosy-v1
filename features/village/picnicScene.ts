import * as T from "three";
import { applySceneTransform } from "./sceneLayout";
import { dishPoint, picnicItems, type SharedPicnic, type RecipeId } from "./picnic";
import type { AuthoredWorld } from "./worldLayout";
import { batchStaticProp } from "./spatialRendering";
import { makeGardenKitchen, KitchenCookingVisual } from "./gardenKitchenScene";

export function makePicnicAssets() {
  const wood = new T.MeshStandardMaterial({ color: "#9a6549", roughness: .9 });
  const cream = new T.MeshStandardMaterial({ color: "#f8e8c6", roughness: .9 });
  const green = new T.MeshStandardMaterial({ color: "#658868", roughness: .8 });
  const rose = new T.MeshStandardMaterial({ color: "#d78183", roughness: .9 });
  const gold = new T.MeshStandardMaterial({ color: "#dca051", roughness: .7 });
  const part = (root: T.Group, mat: T.Material, size: [number, number, number], at: [number, number, number]) => {
    const mesh = new T.Mesh(new T.BoxGeometry(...size), mat); mesh.position.set(...at); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return mesh;
  };
  const kitchen = makeGardenKitchen();
  const mat = new T.Group();
  part(mat, cream, [5.6, .055, 4.2], [0, .035, 0]);
  for (let x = 0; x < 14; x++) for (let z = 0; z < 11; z++) if ((x + z) % 2 === 0) part(mat, rose, [.39, .008, .37], [-2.6 + x * .4, .067, -1.9 + z * .38]);
  for (const x of [-1.8, -.9, 0, .9, 1.8]) { part(mat, green, [.8, .12, .7], [x, .13, 1.35]); part(mat, cream, [.65, .025, .55], [x, .2, 1.35]); }
  const basket = new T.Group();
  part(basket, wood, [.9, .5, .6], [0, .25, 0]);
  for (let i = 0; i < 7; i++) part(basket, gold, [.925, .022, .62], [0, .04 + i * .065, 0]);
  part(basket, cream, [.93, .025, .63], [0, .51, 0]);
  const handle = new T.Mesh(new T.TorusGeometry(.3, .035, 6, 18, Math.PI), wood); handle.position.y = .51; basket.add(handle);
  const assets = [
    { id: "garden-kitchen", name: "Garden kitchen", category: "Furnishings", template: kitchen, shelf: true,
      localColliders: [{ x: 0, z: -.62, w: 4.6, d: .92, bottom: 0, top: 1.23 }, { x: 0, z: -1.32, w: 4.8, d: .1, bottom: 1.18, top: 2.82 }, ...[-2.35, 2.35].flatMap(x => [-1.35, 1.35].map(z => ({ x, z, w: .21, d: .21, bottom: .16, top: 3.12 })))] },
    { id: "picnic-mat", name: "Rose gingham picnic mat · five seats", category: "Furnishings", template: mat, shelf: true },
    { id: "picnic-basket", name: "Woven picnic basket", category: "Furnishings", template: basket, shelf: true },
  ];
  return assets;
}

export function makePicnicDish(recipe: RecipeId) {
  const group = new T.Group();
  const plate = new T.Mesh(new T.CylinderGeometry(.48, .4, .07, 20), new T.MeshStandardMaterial({ color: "#f5ebd8", roughness: .8 })); plate.position.y = .06; group.add(plate);
  const colors = recipe === "gardenSoup" ? ["#dfa654", "#ed8e47", "#a99368"] : recipe === "crispSalad" ? ["#81a05c", "#d56c85", "#efe5bd"] : recipe === "bakedApples" ? ["#ce6d52", "#e5b86c", "#875d3c"] : ["#ec9b4a", "#c77b7e", "#829852"];
  if (recipe === "gardenSoup") {
    const bowl = new T.Mesh(new T.CylinderGeometry(.42, .28, .28, 20), new T.MeshStandardMaterial({ color: "#7e9f8c" })); bowl.position.y = .21; group.add(bowl);
    const soup = new T.Mesh(new T.CylinderGeometry(.38, .38, .025, 20), new T.MeshStandardMaterial({ color: colors[0] })); soup.position.y = .355; group.add(soup);
  }
  for (let i = 0; i < 9; i++) {
    const food = new T.Mesh(new T.SphereGeometry(recipe === "bakedApples" ? .13 : .09, 8, 6), new T.MeshStandardMaterial({ color: colors[i % 3] }));
    const angle = i * 2.4, r = .12 + (i % 3) * .07;
    food.position.set(Math.sin(angle) * r, recipe === "gardenSoup" ? .37 : .16, Math.cos(angle) * r); food.scale.y = .7; group.add(food);
  }
  return group;
}

export class PicnicScene {
  group = new T.Group();
  private food = new Map<string, T.Group>();
  private kitchens = new Map<string, KitchenCookingVisual>();
  private state?: SharedPicnic;
  constructor(private world: AuthoredWorld) {
    for (const item of picnicItems(world).filter(item => item.asset === "garden-kitchen")) {
      const visual = new KitchenCookingVisual(makePicnicDish); applySceneTransform(visual.root, item);
      this.kitchens.set(item.id, visual); this.group.add(visual.root);
    }
  }
  sync(state?: SharedPicnic) {
    this.state = state;
    const ids = new Set(state?.dishes.map(dish => dish.id));
    for (const [id, root] of this.food) if (!ids.has(id)) { this.group.remove(root); this.disposeRoot(root); this.food.delete(id); }
    for (const dish of state?.dishes ?? []) if (!this.food.has(dish.id)) {
      const item = picnicItems(this.world).find(item => item.id === dish.mat); if (!item) continue;
      const root = makePicnicDish(dish.recipe); const [x, z] = dishPoint(item, dish.slot);
      root.position.set(x, item.position[1] + .08 * item.scale[1], z); root.scale.fromArray(item.scale); root.rotation.y = item.rotation[1] * Math.PI / 180;
      root.userData.dishId = dish.id; root.userData.matId = dish.mat;
      batchStaticProp(root); this.food.set(dish.id, root); this.group.add(root);
    }
  }
  update(now: number, reduced: boolean) {
    for (const [id, visual] of this.kitchens) {
      const jobs = this.state?.cooking.filter(job => job.kitchen === id) ?? [];
      visual.update(jobs.find(job => job.readyAt > now) ?? jobs.at(-1), now, reduced);
    }
  }
  pickDish(raycaster: T.Raycaster): { id: string; mat: string } | null {
    const hit = raycaster.intersectObjects([...this.food.values()], true)[0];
    if (!hit) return null;
    let root: T.Object3D | null = hit.object;
    while (root && !root.userData.dishId) root = root.parent;
    return root ? { id: root.userData.dishId as string, mat: root.userData.matId as string } : null;
  }

  private disposeRoot(root: T.Object3D) { root.traverse(object => { if (object instanceof T.Mesh) { object.geometry.dispose(); for (const mat of Array.isArray(object.material) ? object.material : [object.material]) mat.dispose(); } }); }
  dispose() { this.disposeRoot(this.group); this.group.clear(); }
}

import * as T from "three";
import type { PicnicCooking, RecipeId } from "./picnic";

const palette = () => ({
  oak: new T.MeshStandardMaterial({ color: "#ad7851", roughness: .85 }),
  darkOak: new T.MeshStandardMaterial({ color: "#765338", roughness: .9 }),
  cream: new T.MeshStandardMaterial({ color: "#f3e5c8", roughness: .85 }),
  sage: new T.MeshStandardMaterial({ color: "#5e8269", roughness: .9 }),
  copper: new T.MeshStandardMaterial({ color: "#b57950", metalness: .35, roughness: .5 }),
  iron: new T.MeshStandardMaterial({ color: "#374b48", metalness: .25, roughness: .65 }),
});
function box(root: T.Group, material: T.Material, size: [number, number, number], at: [number, number, number]) {
  const mesh = new T.Mesh(new T.BoxGeometry(...size), material);
  mesh.position.set(...at); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return mesh;
}
function cylinder(root: T.Group, material: T.Material, radius: number, bottom: number, height: number, at: [number, number, number]) {
  const mesh = new T.Mesh(new T.CylinderGeometry(radius, bottom, height, 16), material);
  mesh.position.set(...at); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return mesh;
}

export function makeGardenKitchen() {
  const root = new T.Group(), p = palette();
  root.name = "GardenKitchen";
  for (let i = 0; i < 12; i++) box(root, i % 3 ? p.oak : p.darkOak, [.442, .16, 3.6], [-2.475 + i * .45, .08, 0]);
  for (const x of [-2.35, 2.35]) for (const z of [-1.35, 1.35]) {
    box(root, p.oak, [.21, 2.95, .21], [x, 1.635, z]);
    box(root, p.darkOak, [.29, .12, .29], [x, .22, z]);
    const brace = box(root, p.oak, [.12, .7, .12], [x - Math.sign(x) * .22, 2.84, z]);
    brace.rotation.z = Math.sign(x) * .7;
  }
  for (const z of [-1.35, 1.35]) box(root, p.darkOak, [5.05, .19, .21], [0, 3.06, z]);
  for (const x of [-2.35, 2.35]) box(root, p.oak, [.21, .16, 3], [x, 3.08, 0]);
  // The canvas follows a shallow pitched frame; its open sides preserve the view.
  for (let i = 0; i < 14; i++) for (const side of [-1, 1]) {
    const roof = box(root, i % 2 ? p.cream : p.sage, [.405, .07, 2.05], [-2.6325 + i * .405, 3.24, side * .985]);
    roof.rotation.x = side * .19;
  }
  box(root, p.oak, [5.85, .09, .12], [0, 3.47, 0]);
  for (const z of [-1.99, 1.99]) {
    for (let i = 0; i < 14; i++) {
      box(root, i % 2 ? p.cream : p.sage, [.405, .2, .06], [-2.6325 + i * .405, 2.99, z]);
      const hem = new T.Shape(); hem.moveTo(-.2025, 0); hem.absarc(0, 0, .2025, Math.PI, Math.PI * 2, false); hem.closePath();
      const hemGeometry = new T.ExtrudeGeometry(hem, { depth: .06, bevelEnabled: false, curveSegments: 6 }); hemGeometry.translate(0, 0, -.03);
      const scallop = new T.Mesh(hemGeometry, i % 2 ? p.cream : p.sage);
      scallop.position.set(-2.6325 + i * .405, 2.9, z); root.add(scallop);
    }
  }
  box(root, p.sage, [4.6, .88, .92], [0, .6, -.62]);
  box(root, p.darkOak, [4.66, .08, .97], [0, .22, -.62]);
  box(root, p.cream, [4.8, .16, 1.12], [0, 1.12, -.62]);
  for (const x of [-1.5, -.5, .5, 1.5]) {
    box(root, p.oak, [.89, .66, .035], [x, .63, -.137]);
    box(root, p.sage, [.79, .56, .045], [x, .63, -.109]);
    box(root, p.copper, [.15, .04, .075], [x, .84, -.07]);
  }
  // The shelf and utensil rail are fixed to continuous timber backing.
  for (let i = 0; i < 16; i++) box(root, i % 3 ? p.oak : p.darkOak, [.29, 1.64, .1], [-2.25 + i * .3, 2, -1.32]);
  for (const y of [1.24, 2.73]) box(root, p.darkOak, [4.84, .1, .15], [0, y, -1.3]);
  box(root, p.oak, [2.7, .09, .42], [.3, 2.22, -1.1]);
  for (const x of [-.85, 1.45]) {
    box(root, p.iron, [.06, .28, .07], [x, 2.07, -1.22]);
    const bracket = box(root, p.iron, [.06, .34, .06], [x, 2.07, -1.1]); bracket.rotation.x = -.65;
  }
  for (const [i, x] of [-.55, -.03, .49].entries()) {
    cylinder(root, i === 1 ? p.sage : p.cream, .16, .145, .32, [x, 2.425, -1.09]);
    cylinder(root, p.darkOak, .17, .17, .035, [x, 2.603, -1.09]);
  }
  cylinder(root, p.cream, .15, .12, .22, [1.11, 2.375, -1.09]);
  for (let i = 0; i < 5; i++) {
    const leaf = new T.Mesh(new T.SphereGeometry(.075, 7, 5), p.sage); leaf.scale.set(.7, 1.8, 1);
    leaf.position.set(1.11 + Math.sin(i * 2.4) * .08, 2.56 + (i % 2) * .06, -1.09 + Math.cos(i * 2.4) * .07); root.add(leaf);
  }
  box(root, p.iron, [1.13, .09, .8], [-1.2, 1.245, -.55]);
  cylinder(root, p.copper, .42, .34, .34, [-1.2, 1.47, -.55]);
  cylinder(root, p.iron, .39, .39, .03, [-1.2, 1.65, -.55]);
  for (const x of [-1.73, -.67]) box(root, p.iron, [.2, .055, .13], [x, 1.57, -.55]);
  for (const x of [-1.55, -1.18, -.81]) cylinder(root, p.copper, .055, .055, .06, [x, 1.245, -.12]).rotation.x = Math.PI / 2;
  const board = box(root, p.oak, [.98, .055, .65], [.13, 1.245, -.52]); board.name = "PreparationBoard";
  box(root, p.darkOak, [.12, .055, .2], [.68, 1.245, -.52]);
  cylinder(root, p.sage, .34, .25, .19, [1.23, 1.31, -.51]);
  cylinder(root, p.cream, .3, .3, .018, [1.23, 1.415, -.51]);
  box(root, p.cream, [.32, .02, .55], [1.8, 1.22, -.49]);
  for (let i = 0; i < 4; i++) box(root, p.sage, [.025, .005, .52], [1.69 + i * .07, 1.233, -.49]);
  cylinder(root, p.copper, .16, .13, .25, [1.91, 1.355, -.9]);
  for (let i = 0; i < 3; i++) {
    const utensil = box(root, p.darkOak, [.035, .4, .035], [1.88 + i * .04, 1.6, -.9]); utensil.rotation.z = (i - 1) * .13;
  }
  box(root, p.iron, [.88, .045, .06], [1.7, 1.92, -1.22]);
  for (const x of [1.46, 1.9]) {
    const pan = new T.Mesh(new T.TorusGeometry(.14, .035, 8, 16), p.copper); pan.position.set(x, 1.67, -1.17); root.add(pan);
    const panBase = cylinder(root, p.copper, .132, .132, .025, [x, 1.67, -1.17]); panBase.rotation.x = Math.PI / 2;
    box(root, p.darkOak, [.045, .22, .055], [x, 1.87, -1.17]);
  }
  return root;
}

export class KitchenCookingVisual {
  readonly root = new T.Group();
  private recipe?: RecipeId;
  private result?: T.Group;
  private ingredients = new T.Group();
  private puffs = new T.Group();
  private spoon = new T.Group();
  private knife = new T.Group();
  private glow: T.Mesh;
  private liquid: T.Mesh;
  constructor(private dishFactory: (recipe: RecipeId) => T.Group) {
    const p = palette();
    this.root.name = "KitchenCookingVisual";
    this.root.add(this.ingredients, this.puffs, this.spoon, this.knife);
    box(this.spoon, p.darkOak, [.045, .56, .045], [0, .15, 0]);
    const spoonEnd = new T.Mesh(new T.SphereGeometry(.09, 8, 6), p.oak); spoonEnd.scale.set(.6, 1, .45); spoonEnd.position.y = -.15; this.spoon.add(spoonEnd);
    box(this.knife, p.iron, [.28, .14, .025], [.11, 0, 0]); box(this.knife, p.darkOak, [.17, .05, .05], [-.12, .04, 0]);
    this.glow = new T.Mesh(new T.CylinderGeometry(.42, .42, .025, 16), new T.MeshBasicMaterial({ color: "#f5b554", transparent: true, opacity: .85 }));
    this.glow.position.set(-1.2, 1.303, -.55); this.root.add(this.glow);
    this.liquid = new T.Mesh(new T.CircleGeometry(.373, 20), new T.MeshStandardMaterial({ color: "#d6a35d", roughness: .75 }));
    this.liquid.rotation.x = -Math.PI / 2; this.liquid.position.set(-1.2, 1.668, -.55); this.root.add(this.liquid);
    for (let i = 0; i < 6; i++) {
      const puff = new T.Mesh(new T.SphereGeometry(.095, 6, 4), new T.MeshBasicMaterial({ color: "#fff4df", transparent: true, opacity: .35, depthWrite: false })); this.puffs.add(puff);
    }
    this.root.visible = false;
  }
  update(job: PicnicCooking | undefined, now: number, reduced: boolean) {
    this.root.visible = !!job; if (!job) return;
    if (job.recipe !== this.recipe) {
      this.recipe = job.recipe;
      disposeKitchenObject(this.ingredients); this.ingredients.clear();
      if (this.result) { this.root.remove(this.result); disposeKitchenObject(this.result); }
      this.result = this.dishFactory(job.recipe); this.result.name = "KitchenFinishedDish"; this.result.position.set(.16, 1.275, -.51); this.result.scale.setScalar(.9); this.root.add(this.result);
      const colors = job.recipe === "crispSalad" ? ["#93b36a", "#d37885", "#6c985b"] : job.recipe === "bakedApples" ? ["#ca6651", "#e3b25c", "#c66b50"] : ["#e49b4d", "#bd826d", "#9aa76a"];
      for (let i = 0; i < 7; i++) {
        const food = new T.Mesh(new T.SphereGeometry(job.recipe === "bakedApples" ? .105 : .075, 8, 6), new T.MeshStandardMaterial({ color: colors[i % 3], roughness: .9 }));
        food.scale.set(1, .75, 1); this.ingredients.add(food);
      }
      (this.liquid.material as T.MeshStandardMaterial).color.set(colors[0]);
    }
    const duration = Math.max(1, job.readyAt - job.startedAt), elapsed = Math.max(0, now - job.startedAt), progress = Math.min(1, elapsed / duration);
    const chopping = progress < .3, heating = progress >= .3 && progress < .82, plating = progress >= .82;
    const salad = job.recipe === "crispSalad";
    this.root.userData.phase = progress >= 1 ? "ready" : chopping ? "prepare" : heating ? salad ? "toss" : "cook" : "plate";
    this.knife.visible = chopping; this.spoon.visible = heating; this.glow.visible = heating && !salad; this.liquid.visible = !salad && progress < .82;
    this.result!.visible = plating;
    if (plating) { const settle = reduced ? 1 : Math.min(1, (progress - .82) / .18); this.result!.position.y = 1.275 + Math.sin(settle * Math.PI) * .22; }
    this.knife.position.set(.04, 1.43 + (reduced ? 0 : Math.abs(Math.sin(elapsed / 65)) * .16), -.51); this.knife.rotation.z = reduced ? -.15 : -.15 + Math.sin(elapsed / 65) * .12;
    const angle = reduced ? 0 : elapsed / 165;
    this.spoon.position.set((salad ? 1.23 : -1.2) + Math.sin(angle) * .16, salad ? 1.61 : 1.82, -.51 + Math.cos(angle) * .14); this.spoon.rotation.z = -.25;
    this.ingredients.visible = progress < .82;
    this.ingredients.children.forEach((food, i) => {
      const spreadX = .12 + Math.sin(i * 2.4) * .25, spreadZ = -.51 + Math.cos(i * 2.4) * .17;
      const transfer = reduced ? (progress >= .3 ? 1 : 0) : Math.max(0, Math.min(1, (progress - .22 - i * .012) / .15));
      const targetX = salad ? 1.23 + Math.sin(i * 2.4) * .17 : -1.2 + Math.sin(i * 2.4) * .21;
      food.position.set(spreadX + (targetX - spreadX) * transfer, 1.32 + (salad ? .1 : .37) * transfer + (reduced ? 0 : Math.sin(transfer * Math.PI) * .55), spreadZ);
      if (salad && heating && !reduced) food.position.y += Math.max(0, Math.sin(elapsed / 160 + i)) * .15;
    });
    this.puffs.visible = heating && !salad;
    this.puffs.children.forEach((puff, i) => {
      const phase = reduced ? i / 6 : (elapsed / 1400 + i / 6) % 1;
      puff.position.set(-1.2 + Math.sin(i * 2.4 + phase) * .14, 1.72 + phase * .7, -.55 + Math.cos(i * 2.4) * .13); puff.scale.setScalar(.65 + phase * .75);
      ((puff as T.Mesh).material as T.MeshBasicMaterial).opacity = reduced ? .22 : (1 - phase) * .4;
    });
  }
}
function disposeKitchenObject(root: T.Object3D) {
  root.traverse(object => { if (object instanceof T.Mesh) { object.geometry.dispose(); for (const mat of Array.isArray(object.material) ? object.material : [object.material]) mat.dispose(); } });
}

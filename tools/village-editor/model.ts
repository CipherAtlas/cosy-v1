import * as T from "three";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { buildWorld, type WorldLayoutCapture, type World } from "../../features/village/world";
import { BIRD_CLEARING } from "../../features/village/environment";
import { BIRD_LANDING_SPOTS } from "../../features/village/birds";
import { VillageLife } from "../../features/village/life";
import { GardenScene } from "../../features/village/gardenScene";
import { makeBridgeWindow, makeCoffeeCup, makeDeskInkwell, makeDeskJournal, makeDeskQuill, makeFocusHourglass, cottageMaterials, makeCottageCouch, makeCottageLamp, makeCottageFern, makeCottagePrint, makeCatCushion, makeCottageChair, makeCottageBooks, makeCottagePottery, makeCottageWallShelf } from "../../features/village/focusCottageProps";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RESIDENT_IDS, type ResidentRoute, type ResidentId } from "../../features/village/worldLayout";
import { fenceGeometry } from "../../features/village/fenceGeometry";
import { PUPPY_INFO } from "../../features/village/puppies";
import { VillageSwingSet } from "../../features/village/swings";

export type LayoutItem = {
  id: string; asset: string; name: string; position: [number, number, number];
  rotation: [number, number, number]; scale: [number, number, number]; visible: boolean; locked: boolean;
  path?: { points: [number, number][]; width: number };
};
export type Layout = { version: 1; base: "cosy-village-2026-09-27"; name: string; objects: LayoutItem[]; routes?: Partial<Record<ResidentId, ResidentRoute>> };
export type Asset = { id: string; name: string; category: string; template: T.Object3D; thumbnail?: string; shelf: boolean; surface?: boolean; solid?: boolean; path?: LayoutItem["path"] };
export const PATH_ASSETS = ["custom-path", "path-straight", "path-curved", "fence-line"];
export function pathCurve(path: NonNullable<LayoutItem["path"]>, straight = false): T.Curve<T.Vector3> {
  const points = path.points.map(([x, z]) => new T.Vector3(x, .09, z));
  if (!straight) return new T.CatmullRomCurve3(points);
  const curve = new T.CurvePath<T.Vector3>();
  for (let i = 1; i < points.length; i++) curve.add(new T.LineCurve3(points[i - 1], points[i]));
  return curve;
}
const tuple = (v: T.Vector3): [number, number, number] => v.toArray().map(n => Math.round(n * 1e6) / 1e6) as [number, number, number];
export function readTransform(object: T.Object3D) {
  return { position: tuple(object.position), rotation: [object.rotation.x, object.rotation.y, object.rotation.z].map(n => Math.round(T.MathUtils.radToDeg(n) * 1e6) / 1e6) as [number, number, number], scale: tuple(object.scale) };
}
export function applyTransform(object: T.Object3D, item: LayoutItem) {
  object.position.fromArray(item.position); object.rotation.set(...item.rotation.map(T.MathUtils.degToRad) as [number, number, number]);
  object.scale.fromArray(item.scale); object.visible = item.visible; object.updateMatrixWorld(true);
}
export function validateLayout(value: unknown, assets?: Map<string, Asset>): Layout {
  if (!value || typeof value !== "object") throw Error("Choose a Cosy layout JSON file.");
  const doc = value as Layout;
  if (doc.version !== 1 || doc.base !== "cosy-village-2026-09-27") throw Error("This layout uses a different village or file version.");
  if (typeof doc.name !== "string" || !doc.name.trim() || doc.name.length > 100 || !Array.isArray(doc.objects) || doc.objects.length > 2000) throw Error("Invalid layout name or object count (maximum 2,000).");
  const ids = new Set<string>();
  for (const item of doc.objects) {
    if (!item || typeof item.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(item.id) || ids.has(item.id)) throw Error("Every object needs a unique, valid ID.");
    ids.add(item.id);
    if (typeof item.asset !== "string" || (assets && !assets.has(item.asset))) throw Error(`Unknown asset: ${String(item.asset).slice(0,100)}. Keep the original village asset kit with this layout.`);
    if (typeof item.name !== "string" || item.name.length > 100 || typeof item.visible !== "boolean" || typeof item.locked !== "boolean") throw Error("Invalid object properties.");
    for (const key of ["position", "rotation", "scale"] as const) {
      const a = item[key];
      if (!Array.isArray(a) || a.length !== 3 || a.some(n => !Number.isFinite(n) || Math.abs(n) > (key === "position" ? 2000 : key === "rotation" ? 36000 : 100) || (key === "scale" && n < .01))) throw Error(`Invalid ${key} on ${item.name}.`);
    }
    if (item.path && (!PATH_ASSETS.includes(item.asset) || !Number.isFinite(item.path.width) || item.path.width < .3 || item.path.width > (item.asset === "fence-line" ? 3 : 20) || !Array.isArray(item.path.points) || item.path.points.length < 2 || item.path.points.length > 100 || item.path.points.some(p => !Array.isArray(p) || p.length !== 2 || p.some(n => !Number.isFinite(n) || Math.abs(n) > 2000)))) throw Error("Invalid path or fence: use 2–100 points and a valid width or height.");
    if (item.path && item.path.points.every(point => Math.hypot(point[0] - item.path!.points[0][0], point[1] - item.path!.points[0][1]) < .01)) throw Error("A path needs two distinct points.");
    if (item.asset === "fence-line" && item.path && item.path.points.slice(1).reduce((length, point, index) => length + Math.hypot(point[0] - item.path!.points[index][0], point[1] - item.path!.points[index][1]), 0) > 300) throw Error("A fence line can be up to 300 metres long.");
    if (PATH_ASSETS.includes(item.asset) && !item.path) throw Error("A custom path needs its control points.");
  }
  if (doc.routes !== undefined) {
    if (!doc.routes || typeof doc.routes !== "object" || Array.isArray(doc.routes) || Object.keys(doc.routes).some(id => !RESIDENT_IDS.includes(id as ResidentId))) throw Error("Invalid resident routes.");
    for (const route of Object.values(doc.routes)) {
      if (!route || !Array.isArray(route.points) || route.points.length < 2 || route.points.length > 100 || route.points.some(p => !Array.isArray(p) || p.length !== 2 || p.some(n => !Number.isFinite(n) || Math.abs(n) > 2000))) throw Error("Resident routes need 2–100 valid points.");
      if (route.pauses && (!Array.isArray(route.pauses) || route.pauses.length !== route.points.length || route.pauses.some(n => !Number.isFinite(n) || n < 0 || n > 30))) throw Error("Resident route pauses must match its points and stay within 0–30 seconds.");
    }
  }
  return structuredClone(doc);
}

/** Merge within each editable prop, preserving separate instances and animated materials. */
function batchProp(root: T.Object3D) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const batches = new Map<T.Material, T.Mesh[]>();
  root.traverse(o => {
    if (o instanceof T.Mesh && !(o instanceof T.InstancedMesh) && !Array.isArray(o.material) && o.material instanceof T.MeshStandardMaterial && !o.material.transparent) {
      const list = batches.get(o.material) ?? []; list.push(o); batches.set(o.material, list);
    }
  });
  for (const [material, meshes] of batches) {
    if (meshes.length < 2) continue;
    const parts = meshes.map(mesh => {
      const g = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
      if (!g.attributes.uv) g.setAttribute("uv", new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.color) g.setAttribute("color", new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
      return g;
    });
    const geometry = mergeGeometries(parts); parts.forEach(p => p.dispose());
    if (!geometry) throw Error("Could not prepare an editable village asset.");
    const merged = new T.Mesh(geometry, material); merged.castShadow = meshes.some(m => m.castShadow); merged.receiveShadow = meshes.some(m => m.receiveShadow);
    meshes.forEach(m => m.removeFromParent()); root.add(merged);
  }
}

export class LayoutScene {
  readonly assets = new Map<string, Asset>();
  readonly roots = new Map<string, T.Object3D>();
  readonly group = new T.Group();
  original!: Layout;
  world!: World;
  private pathMaterial!: T.Material;
  readonly defaultRoutes: Partial<Record<ResidentId, ResidentRoute>> = {};
  private generated = new Set<T.BufferGeometry>();

  async load(renderer: T.WebGLRenderer, progress: (n: number) => void) {
    const captures: Parameters<WorldLayoutCapture>[] = [];
    this.world = await buildWorld(progress, renderer, (...args) => captures.push(args));
    this.world.group.updateMatrixWorld(true);
    const originals: LayoutItem[] = [];
    const register = (id: string, name: string, category: string, root: T.Object3D, shelf = true, locked = false) => {
      root.name = name; batchProp(root);
      const item: LayoutItem = { id, asset: id, name, ...readTransform(root), visible: root.visible, locked };
      const template = root.clone(true); template.position.set(0, 0, 0); template.rotation.set(0, 0, 0); template.scale.set(1, 1, 1); template.visible = true;
      this.assets.set(id, { id, name, category, template, shelf }); originals.push(item);
      root.removeFromParent();
    };
    for (const [id, name, category, objects, pivot] of captures) {
      if (["tree", "willow", "bushes"].includes(id)) {
        const meshes = objects as T.InstancedMesh[];
        for (let i = 0; i < meshes[0].count; i++) {
          const root = new T.Group(), matrix = new T.Matrix4(); meshes[0].getMatrixAt(i, matrix);
          matrix.decompose(root.position, root.quaternion, root.scale);
          for (const source of meshes) {
            const mesh = new T.InstancedMesh(source.geometry, source.material, 1);
            mesh.setMatrixAt(0, new T.Matrix4());
            if (source.instanceColor) { const color = new T.Color(); source.getColorAt(i, color); mesh.setColorAt(0, color); }
            mesh.customDepthMaterial = source.customDepthMaterial; mesh.castShadow = source.castShadow; mesh.receiveShadow = source.receiveShadow;
            root.add(mesh);
          }
          register(`${id}-${i + 1}`, `${name} ${i + 1}`, category, root, i === 0);
        }
        objects.forEach(o => o.removeFromParent());
      } else {
        let root: T.Object3D;
        if (objects.length === 1 && objects[0] instanceof T.Group && pivot && objects[0].position.distanceTo(new T.Vector3(...pivot)) < .001) root = objects[0];
        else {
          root = new T.Group(); root.position.fromArray(pivot ?? [0, 0, 0]); root.updateMatrixWorld(true);
          for (const object of objects) root.attach(object);
        }
        const locked = category === "Landscape" && !id.startsWith("island") || ["wayfinding", "ivy"].includes(id);
        const shelf = !["terrain", "shore", "river", "river-stones", "meadow-grass", "wildflowers", "forest", "ivy", "wayfinding"].includes(id) && !this.world.authored.benches.some(bench => bench.id === id) && !this.world.authored.swings.some(swing => swing.id === id) && !this.world.authored.fences.some(fence => fence.id === id) && !id.startsWith("mountain") && (!id.startsWith("bench-") || id === "bench-1") && (!id.startsWith("fence-") || id === "fence--1-180") && (!id.startsWith("lamp-") || id === "lamp-20" || id === "lamp-moon-bridge") && (!id.startsWith("edge-lantern-") || id === "edge-lantern-garden-1") && (!id.startsWith("path-") || id === "path-2" || name === "Bird clearing approach");
        register(id, name, category, root, shelf, locked);
      }
    }
    this.assets.set("oak-bench", { id: "oak-bench", name: "Oak meadow bench", category: "Furnishings", template: this.assets.get("bench-1")!.template.clone(true), shelf: true, solid: true });
    this.assets.set("meadow-swings", { id: "meadow-swings", name: "Meadow swing set · two seats", category: "Furnishings",
      template: new VillageSwingSet({ id: "meadow-swings", x: 0, y: 0, z: 0, yaw: 0, scale: [1, 1, 1] }).root, shelf: true, solid: true });
    const kit = await new GLTFLoader().loadAsync("/village/models/garden-pond.glb");
    const garden = new GardenScene(kit.scene, [], () => {}, this.world.gardenSurfaces);
    // Preserve the authored garden as one assembly; planting state remains outside layout files.
    garden.group.updateMatrixWorld(true);
    const gardenRoot = new T.Group(); gardenRoot.position.set(24, 0, -6); gardenRoot.updateMatrixWorld(true); gardenRoot.attach(garden.group);
    register("kitchen-garden", "Kitchen garden & pond life", "Furnishings", gardenRoot, false, true);
    for (const name of ["Sunflower", "Daisy", "Iris", "Mint", "Reeds", "Lily", "Carrot", "Radish", "Basket", "WateringCan", "Swan", "Duck", "Duckling"]) {
      const model = kit.scene.getObjectByName(name); if (!model) continue;
      const root = model.clone(true); root.position.set(0, 0, 0); root.updateMatrixWorld(true);
      const id = `garden-${name.toLowerCase()}`;
      this.assets.set(id, { id, name: name === "WateringCan" ? "Watering can" : name, category: ["WateringCan", "Basket"].includes(name) ? "Furnishings" : "Nature", template: root, shelf: true });
    }
    const [doveKit, spiritKit, puppyKit, catKit] = await Promise.all([
      new GLTFLoader().loadAsync("/village/models/dove.glb?v=1"),
      new GLTFLoader().loadAsync("/village/models/spirit.glb?v=3"),
      new GLTFLoader().loadAsync("/village/models/puppies.glb?v=4"),
      new GLTFLoader().loadAsync("/village/models/cottage-cat.glb?v=1"),
    ]);
    for (const [breed, info] of Object.entries(PUPPY_INFO)) {
      const model = puppyKit.scene.getObjectByName(info.model);
      if (!model) throw Error(`Missing ${info.model} puppy model.`);
      const template = cloneSkeleton(model);
      template.traverse(node => { if (node instanceof T.Mesh) node.castShadow = node.receiveShadow = true; });
      this.assets.set(`puppy-${breed}`, { id: `puppy-${breed}`, name: `${info.name} · ${info.breed}`, category: "Puppies", template, shelf: true });
    }
    const dove = doveKit.scene.getObjectByName("Dove")!;
    dove.getObjectByName("DoveWingLeft")!.rotation.z = 1.12;
    dove.getObjectByName("DoveWingRight")!.rotation.z = -1.12;
    dove.traverse(node => { if (node instanceof T.Mesh) node.castShadow = node.receiveShadow = true; });
    this.assets.set("white-dove", { id: "white-dove", name: "White dove", category: "Nature", template: dove, shelf: true });
    const spirit = spiritKit.scene;
    spirit.scale.setScalar(.95 / new T.Box3().setFromObject(spirit.getObjectByName("SpiritBody") ?? spirit).getSize(new T.Vector3()).y);
    // Reuse her runtime appearance so the editor cannot drift from the village's caretaker.
    const residents = new VillageLife(spirit, []);
    residents.residents.forEach((resident, index) => { this.defaultRoutes[RESIDENT_IDS[index]] = { points: structuredClone(resident.route) }; });
    residents.residents.forEach((resident, index) => {
      const actor = resident.root, name = actor.name, position = tuple(actor.position);
      const id = index === 4 ? "wren-caretaker" : `villager-${name.toLowerCase()}`;
      actor.removeFromParent(); actor.position.set(0, 0, 0); actor.rotation.y = 0;
      const template = new T.Group(); template.add(actor);
      this.assets.set(id, { id, name: index === 4 ? "Wren · bird caretaker" : name, category: "Villagers", template, shelf: true });
      originals.push({ id: `resident-${name.toLowerCase()}`, asset: id, name, position, rotation: [0, 0, 0], scale: [1, 1, 1], visible: true, locked: false });
    });
    for (let i = 0; i < 12; i++) {
      const [x, z] = BIRD_LANDING_SPOTS[i];
      originals.push({ id: `dove-${i + 1}`, asset: "white-dove", name: `White dove ${i + 1}`,
        position: [x, .13, z],
        rotation: [0, T.MathUtils.radToDeg(Math.atan2(BIRD_CLEARING.x - x, BIRD_CLEARING.z - z)), 0], scale: [1, 1, 1], visible: true, locked: false });
    }
    residents.dispose();
    const raisedBed = new T.Group();
    const bedWood = this.world.gardenSurfaces.wood, soil = new T.MeshStandardMaterial({ color: "#80634b", roughness: 1 });
    const bedPart = (material: T.Material, position: [number, number, number], size: [number, number, number]) => {
      const mesh = new T.Mesh(new T.BoxGeometry(...size), material); mesh.position.fromArray(position); mesh.castShadow = mesh.receiveShadow = true; raisedBed.add(mesh);
    };
    bedPart(soil, [0, .13, 0], [3.2, .25, 2.5]);
    for (const z of [-1.28, 1.28]) bedPart(bedWood, [0, .2, z], [3.45, .38, .14]);
    for (const x of [-1.65, 1.65]) bedPart(bedWood, [x, .2, 0], [.14, .38, 2.7]);
    this.assets.set("raised-bed", { id: "raised-bed", name: "Raised garden bed", category: "Furnishings", template: raisedBed, shelf: true });
    this.assets.set("coffee-cup", { id: "coffee-cup", name: "Coffee cup", category: "Furnishings", template: makeCoffeeCup(), shelf: true });
    this.assets.set("writing-journal", { id: "writing-journal", name: "Open writing journal", category: "Furnishings", template: makeDeskJournal(), shelf: true });
    this.assets.set("desk-inkwell", { id: "desk-inkwell", name: "Desk inkwell", category: "Furnishings", template: makeDeskInkwell(), shelf: true });
    this.assets.set("desk-quill", { id: "desk-quill", name: "Desk quill", category: "Furnishings", template: makeDeskQuill(), shelf: true });
    this.assets.set("focus-hourglass", { id: "focus-hourglass", name: "Focus hourglass", category: "Furnishings", template: makeFocusHourglass().hourglass, shelf: true });
    this.assets.set("village-window-vista", { id: "village-window-vista", name: "Bridge-view cottage window", category: "Buildings", template: makeBridgeWindow(), shelf: true });
    const cottageSurfaces = cottageMaterials();
    for (const [id, name, template, category] of [
      ["cottage-cat", "Cream & caramel cottage cat", catKit.scene, "Animals"],
      ["cottage-couch", "Sage linen couch", makeCottageCouch(cottageSurfaces), "Furnishings"],
      ["cottage-reading-lamp", "Pleated reading lamp", makeCottageLamp(), "Furnishings"],
      ["cottage-fern", "Fern in ceramic pot", makeCottageFern(), "Nature"],
      ["cottage-botanical-print", "Framed botanical print", makeCottagePrint(), "Furnishings"],
      ["cottage-cat-cushion", "Cat’s woven nap cushion", makeCatCushion(cottageSurfaces), "Furnishings"],
      ["cottage-writing-chair", "Cushioned oak writing chair", makeCottageChair(cottageSurfaces), "Furnishings"],
      ["cottage-books", "Clothbound cottage books", makeCottageBooks(), "Furnishings"],
      ["cottage-pottery", "Hand-thrown glazed pottery", makeCottagePottery(), "Furnishings"],
      ["cottage-book-shelf", "Oak cottage book shelf", makeCottageWallShelf(cottageSurfaces), "Furnishings"],
      ["cottage-pottery-shelf", "Oak cottage pottery shelf", makeCottageWallShelf(cottageSurfaces, "pottery"), "Furnishings"],
    ] as [string, string, T.Object3D, string][]) {
      this.assets.set(id, { id, name, category, template, shelf: true });
    }
    this.pathMaterial = this.world.gardenSurfaces.paving;
    this.assets.set("custom-path", { id: "custom-path", name: "Curved limestone path", category: "Paths", template: new T.Group(), shelf: false });
    const fencePath = { points: [[0, 0], [0, -8]] as [number, number][], width: 1.4 };
    this.assets.set("fence-line", { id: "fence-line", name: "Oak fence line", category: "Furnishings", template: this.makeFence(fencePath), shelf: true, solid: true, path: fencePath });
    const meadow = new T.Mesh(new T.CylinderGeometry(12, 13, 1.2, 48), new T.MeshStandardMaterial({ color: "#98b760", roughness: 1 }));
    meadow.position.y = -.6; meadow.receiveShadow = true; const tile = new T.Group(); tile.add(meadow);
    this.assets.set("meadow-island", { id: "meadow-island", name: "Meadow platform", category: "Landscape", template: tile, shelf: true });
    for (const [id, name, points] of [
      ["path-straight", "Straight limestone path", [[0, 0], [0, -8]]],
      ["path-curved", "Curved limestone path", [[0, 0], [0, -4], [2, -6], [6, -6]]],
    ] as [string, string, [number, number][]][]) {
      const path = { points, width: 2.4 };
      this.assets.set(id, { id, name, category: "Paths", template: this.makePath(path, id === "path-straight"), shelf: true, path });
    }
    const clearing = new T.Group();
    const clearingFill = new T.Mesh(new T.CircleGeometry(1, 40), new T.MeshBasicMaterial({ color: "#f7d6a4", transparent: true, opacity: .12, depthWrite: false, side: T.DoubleSide }));
    const clearingEdge = new T.Mesh(new T.RingGeometry(.96, 1, 40), new T.MeshBasicMaterial({ color: "#b66f40", transparent: true, opacity: .75, depthWrite: false, side: T.DoubleSide }));
    for (const mesh of [clearingFill, clearingEdge]) { mesh.rotation.x = -Math.PI / 2; mesh.position.y = .2; clearing.add(mesh); }
    this.assets.set("planting-clearance", { id: "planting-clearance", name: "Erased planting area", category: "Landscape", template: clearing, shelf: false });
    // Reuse the village's blades, wind material and shadows in small editable patches.
    let grassSource: T.InstancedMesh | undefined;
    this.assets.get("meadow-grass")!.template.traverse(o => { if (o instanceof T.InstancedMesh) grassSource = o; });
    for (const [id, name, width, count] of [
      ["grass-tuft", "Grass tuft", 1, 18], ["grass-patch", "Meadow grass patch", 6, 520], ["grass-wide", "Wide meadow grass", 14, 2400],
    ] as [string, string, number, number][]) {
      const blades = new T.InstancedMesh(grassSource!.geometry, grassSource!.material, count), dummy = new T.Object3D();
      let seed = 71; const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      for (let i = 0; i < count; i++) {
        const angle = random() * Math.PI * 2, radius = Math.sqrt(random()) * width / 2;
        const falloff = Math.min(1, (1 - radius / (width / 2)) * 4);
        dummy.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        dummy.rotation.y = random() * Math.PI * 2; dummy.scale.setScalar(random() > falloff ? 0 : (.65 + random() * .8) * (.55 + .45 * falloff)); dummy.updateMatrix(); blades.setMatrixAt(i, dummy.matrix);
        blades.setColorAt(i, new T.Color().setHSL(.22 + random() * .055, .55, .48 + random() * .15));
      }
      blades.customDepthMaterial = grassSource!.customDepthMaterial; blades.receiveShadow = true;
      const root = new T.Group(); root.add(blades); this.assets.set(id, { id, name, category: "Nature", template: root, shelf: true });
    }
    let sourceGround!: T.MeshStandardMaterial;
    this.assets.get("terrain")!.template.traverse(o => { if (o instanceof T.Mesh) sourceGround = o.material as T.MeshStandardMaterial; });
    const landMaterial = sourceGround.clone(); landMaterial.vertexColors = false; landMaterial.color.setHSL(.248, .54, .625);
    landMaterial.onBeforeCompile = sourceGround.onBeforeCompile;
    const groundUV = (geometry: T.BufferGeometry) => {
      const p = geometry.attributes.position, uv = geometry.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 650, p.getZ(i) / 650);
      return geometry;
    };
    const landSide = new T.MeshStandardMaterial({ color: "#85865f", roughness: 1 });
    for (const size of [20, 40]) {
      const mesh = new T.Mesh(groundUV(new T.BoxGeometry(size, 2, size)), [landSide, landSide, landMaterial, landSide, landSide, landSide]);
      mesh.position.y = -1; mesh.receiveShadow = true;
      const root = new T.Group(); root.add(mesh); const id = `land-tile-${size}`;
      this.assets.set(id, { id, name: `Meadow ground · ${size} m`, category: "Landscape", template: root, shelf: true, surface: true });
    }
    const region = new T.Group();
    const fill = new T.Mesh(new T.CircleGeometry(12, 64), new T.MeshBasicMaterial({ color: "#7bbda0", transparent: true, opacity: .18, depthWrite: false, side: T.DoubleSide }));
    fill.rotation.x = -Math.PI / 2; fill.position.y = .16; region.add(fill);
    const rim = new T.Mesh(new T.RingGeometry(11.82, 12, 64), new T.MeshBasicMaterial({ color: "#317660", transparent: true, opacity: .7, depthWrite: false, side: T.DoubleSide }));
    rim.rotation.x = -Math.PI / 2; rim.position.y = .17; region.add(rim);
    this.assets.set("walkable-region", { id: "walkable-region", name: "Walkable meadow area", category: "Landscape", template: region, shelf: true });
    const hillGeometry = new T.PlaneGeometry(24, 24, 24, 24); hillGeometry.rotateX(-Math.PI / 2);
    const vertices = hillGeometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const radius = Math.min(1, Math.hypot(vertices.getX(i), vertices.getZ(i)) / 12);
      vertices.setY(i, Math.pow(Math.cos(radius * Math.PI / 2), 2) * 4);
    }
    hillGeometry.computeVertexNormals(); const hill = new T.Mesh(groundUV(hillGeometry), landMaterial); hill.receiveShadow = true;
    const hillRoot = new T.Group(); hillRoot.add(hill);
    this.assets.set("land-hill", { id: "land-hill", name: "Gentle grassy hill", category: "Landscape", template: hillRoot, shelf: true, surface: true });
    const boulder = new T.Mesh(new T.IcosahedronGeometry(1.5, 1), new T.MeshStandardMaterial({ color: "#b6bea1", roughness: 1 }));
    boulder.scale.set(1.6, .75, 1); boulder.position.y = .6; boulder.castShadow = boulder.receiveShadow = true;
    const rock = new T.Group(); rock.add(boulder); this.assets.set("boulder", { id: "boulder", name: "Mossy boulder", category: "Nature", template: rock, shelf: true });
    for (const asset of this.assets.values()) {
      asset.surface ||= ["terrain", "shore", "meadow-island", "bridge", "dock"].includes(asset.id) || asset.id.startsWith("island-");
      asset.solid = asset.category === "Buildings" || asset.category === "Bridges" || /^(bench-|fence-|lamp-|edge-lantern-|tree-|willow-)/.test(asset.id) || ["oak-bench", "postbox", "raised-bed", "boulder", "bird-clearing-bench", "bird-feeding-dish"].includes(asset.id);
    }
    this.original = { version: 1, base: "cosy-village-2026-09-27", name: "Current village", objects: originals };
    this.apply(this.original); progress(100);
  }

  apply(layout: Layout) {
    const active = new Set(layout.objects.map(o => o.id));
    for (const [id, root] of this.roots) if (!active.has(id)) { root.removeFromParent(); this.releasePath(root); this.roots.delete(id); }
    for (const item of layout.objects) {
      let root = this.roots.get(item.id);
      if (root && (root.userData.asset !== item.asset || JSON.stringify(root.userData.path) !== JSON.stringify(item.path))) {
        root.removeFromParent(); this.releasePath(root); this.roots.delete(item.id); root = undefined;
      }
      if (!root) {
        root = item.asset === "fence-line" && item.path ? this.makeFence(item.path) : item.path ? this.makePath(item.path, item.asset === "path-straight") : cloneSkeleton(this.assets.get(item.asset)!.template);
        root.userData = { layoutId: item.id, asset: item.asset, path: structuredClone(item.path) };
        this.roots.set(item.id, root); this.group.add(root);
      }
      root.name = item.name; applyTransform(root, item);
    }
  }
  conformPaths(height: (x: number, z: number) => number) {
    for (const root of this.roots.values()) {
      if (!root.userData.path) continue;
      root.updateMatrixWorld(true);
      const anchor = height(root.position.x, root.position.z);
      root.traverse(object => {
        if (!(object instanceof T.Mesh) || !object.geometry.userData.flatPositions) return;
        const base = object.geometry.userData.flatPositions as number[], attribute = object.geometry.attributes.position;
        for (let i = 0; i < attribute.count; i++) {
          const point = new T.Vector3(base[i * 3], 0, base[i * 3 + 2]).applyMatrix4(object.matrixWorld);
          const lift = height(point.x, point.z) - anchor + base[i * 3 + 1];
          attribute.setY(i, Math.abs(object.matrixWorld.elements[5]) > .1 ? lift / object.matrixWorld.elements[5] : .09);
        }
        attribute.needsUpdate = true; object.geometry.computeVertexNormals(); object.geometry.computeBoundingBox(); object.geometry.computeBoundingSphere();
      });
    }
  }
  conformGrass(height: (x: number, z: number) => number, blocked: (point: T.Vector3) => boolean, cleared: (x: number, z: number) => boolean) {
    const paths: { bounds: T.Box3; points: T.Vector3[]; width: number }[] = [];
    for (const root of this.roots.values()) {
      if (!root.visible || !root.userData.path || root.userData.asset === "fence-line") continue;
      const mesh = root.children[0] as T.Mesh, positions = mesh.geometry.attributes.position, points: T.Vector3[] = [];
      for (let i = 0; i < positions.count; i += 2) points.push(new T.Vector3().fromBufferAttribute(positions, i).add(new T.Vector3().fromBufferAttribute(positions, i + 1)).multiplyScalar(.5).applyMatrix4(root.matrixWorld));
      paths.push({ bounds: new T.Box3().setFromObject(root).expandByScalar(.3), points, width: root.userData.path.width * Math.max(root.scale.x, root.scale.z) / 2 + .2 });
    }
    for (const root of this.roots.values()) {
      const asset = root.userData.asset as string;
      if (!root.visible || !(asset === "meadow-grass" || asset.startsWith("grass-"))) continue;
      let source: T.InstancedMesh | undefined, blades: T.InstancedMesh | undefined;
      this.assets.get(asset)!.template.traverse(o => { if (o instanceof T.InstancedMesh) source = o; });
      root.traverse(o => { if (o instanceof T.InstancedMesh) blades = o; });
      if (!source || !blades) continue;
      const anchor = height(root.position.x, root.position.z), dummy = new T.Object3D(), matrix = new T.Matrix4();
      for (let i = 0; i < source.count; i++) {
        source.getMatrixAt(i, matrix); matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
        const point = dummy.position.clone().applyMatrix4(root.matrixWorld);
        if (asset !== "meadow-grass" && Math.abs(root.matrixWorld.elements[5]) > .1) dummy.position.y += (height(point.x, point.z) - anchor) / root.matrixWorld.elements[5];
        point.copy(dummy.position).applyMatrix4(root.matrixWorld); point.y += .15;
        const covered = paths.some(path => {
          if (point.x < path.bounds.min.x || point.x > path.bounds.max.x || point.z < path.bounds.min.z || point.z > path.bounds.max.z) return false;
          for (let n = 1; n < path.points.length; n++) {
            const closest = new T.Line3(path.points[n - 1], path.points[n]).closestPointToPoint(point, true, new T.Vector3());
            if (Math.abs(point.y - closest.y) < .6 && Math.hypot(point.x - closest.x, point.z - closest.z) < path.width) return true;
          }
          return false;
        });
        if (covered || blocked(point) || cleared(point.x, point.z)) dummy.scale.setScalar(0);
        dummy.updateMatrix(); blades.setMatrixAt(i, dummy.matrix);
      }
      blades.instanceMatrix.needsUpdate = true; blades.computeBoundingBox(); blades.computeBoundingSphere();
    }
  }
  conformWildflowers(cleared: (x: number, z: number) => boolean) {
    for (const root of this.roots.values()) {
      if (!root.visible || root.userData.asset !== "wildflowers") continue;
      const source: T.InstancedMesh[] = [], shown: T.InstancedMesh[] = [];
      this.assets.get("wildflowers")!.template.traverse(o => { if (o instanceof T.InstancedMesh) source.push(o); });
      root.traverse(o => { if (o instanceof T.InstancedMesh) shown.push(o); });
      const matrix = new T.Matrix4(), position = new T.Vector3(), rotation = new T.Quaternion(), scale = new T.Vector3();
      root.updateMatrixWorld(true);
      for (let i = 0; i < source[0].count; i++) {
        source[0].getMatrixAt(i, matrix); matrix.decompose(position, rotation, scale);
        const worldPoint = position.clone().applyMatrix4(root.matrixWorld);
        const hidden = cleared(worldPoint.x, worldPoint.z);
        for (let part = 0; part < source.length; part++) {
          source[part].getMatrixAt(i, matrix);
          if (hidden) { matrix.decompose(position, rotation, scale); scale.setScalar(0); matrix.compose(position, rotation, scale); }
          shown[part].setMatrixAt(i, matrix);
        }
      }
      for (const mesh of shown) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere(); }
    }
  }
  private releasePath(root: T.Object3D) {
    if (!root.userData.path) return;
    root.traverse(o => { if (o instanceof T.Mesh && this.generated.delete(o.geometry)) o.geometry.dispose(); });
  }
  private makePath(path: NonNullable<LayoutItem["path"]>, straight = false) {
    const curve = pathCurve(path, straight);
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    for (let i = 0; i <= 120; i++) {
      const p = curve.getPoint(i / 120), tangent = curve.getTangent(i / 120);
      for (const side of [-1, 1]) { const x = p.x + tangent.z * path.width * side / 2, z = p.z - tangent.x * path.width * side / 2; positions.push(x, p.y, z); uvs.push(x / 2, z / 2); }
      if (i < 120) { const n = i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
    }
    const geo = new T.BufferGeometry(); geo.setAttribute("position", new T.Float32BufferAttribute(positions, 3)); geo.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2)); geo.setIndex(indices); geo.computeVertexNormals(); this.generated.add(geo); geo.userData.flatPositions = positions.slice();
    const mesh = new T.Mesh(geo, this.pathMaterial); mesh.receiveShadow = true; const group = new T.Group(); group.add(mesh); return group;
  }
  private makeFence(path: NonNullable<LayoutItem["path"]>) {
    const geo = fenceGeometry(path.points, path.width); this.generated.add(geo);
    const mesh = new T.Mesh(geo, this.world.gardenSurfaces.wood); mesh.castShadow = mesh.receiveShadow = true;
    const group = new T.Group(); group.add(mesh); return group;
  }
}

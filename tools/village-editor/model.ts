import { supplementalAssets } from "../../features/village/placeableAssets";
import { INSTANCE_LAYERS } from "../../features/village/sceneLayout";
import * as T from "three";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { buildWorld, type WorldLayoutCapture, type World } from "../../features/village/world";
import { BIRD_CLEARING } from "../../features/village/environment";
import { BIRD_LANDING_SPOTS } from "../../features/village/birds";
import { VillageLife } from "../../features/village/life";
import { GardenScene } from "../../features/village/gardenScene";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RESIDENT_IDS, type ResidentRoute, type ResidentId } from "../../features/village/worldLayout";
import { fenceGeometry, fenceWoodMaterial, conformFenceGeometry } from "../../features/village/fenceGeometry";
import { PUPPY_INFO } from "../../features/village/puppies";
import { VillageSwingSet } from "../../features/village/swings";
import { VillageActivities } from "../../features/village/activityScene";
import { sampleTerrainHeight, validateTerrain, type TerrainElevation } from "../../features/village/terrain";
import { landscapeHeight, pondDistance, setAuthoredWorld } from "../../features/village/environment";
import { projectWorldLayout } from "../../features/village/worldLayout";
import { makeHorseModel } from "../../features/village/horseModel";
import { conformRiverBank, joinRiverToPonds, makeRiverChannelHeight, riverGeometry } from "../../features/village/riverGeometry";
import { buildRiverbankStones, disposeRiverbankStones } from "../../features/village/riverbankStones";
import type { Collider } from "../../features/village/environment";
import { loadTownAssetKit } from "../../features/village/townAssets";
import { meadowFlowers, MEADOW_WIDTH, MEADOW_GRASS_COUNT } from "../../features/village/meadowVegetation";
import { plantingRadius } from "../../features/village/plantingClearance";
import { PondLifeSpace } from "../../features/village/pondLife";
import { loadAnimalArt } from "../../features/village/animalArt";
import { ANIMAL_RIG_SLUGS, loadAnimalRigs, makeAnimalRig, type AnimalRigSlug } from "../../features/village/animalRig";

export type LayoutItem = {
  id: string; asset: string; name: string; position: [number, number, number];
  rotation: [number, number, number]; scale: [number, number, number]; visible: boolean; locked: boolean;
  path?: { points: [number, number][]; width: number };
};
export type Layout = { version: 1; base: "cosy-village-2026-09-27"; name: string; objects: LayoutItem[]; routes?: Partial<Record<ResidentId, ResidentRoute>>; terrain?: TerrainElevation; sceneVersion?: 1; openWorld?: boolean };
export type Asset = { id: string; name: string; category: string; template: T.Object3D; thumbnail?: string; shelf: boolean; surface?: boolean; solid?: boolean; localColliders?: Collider[]; path?: LayoutItem["path"] };
export const PATH_ASSETS = ["custom-path", "path-straight", "path-curved", "fence-line", "custom-river"];
export function pathCurve(path: NonNullable<LayoutItem["path"]>, straight = false): T.Curve<T.Vector3> {
  const points = path.points.map(([x, z]) => new T.Vector3(x, .09, z));
  if (!straight) return new T.CatmullRomCurve3(points);
  const curve = new T.CurvePath<T.Vector3>();
  for (let i = 1; i < points.length; i++) curve.add(new T.LineCurve3(points[i - 1], points[i]));
  return curve;
}
const tuple = (v: T.Vector3): [number, number, number] => v.toArray().map(n => (Math.round(n * 1e6) / 1e6) || 0) as [number, number, number];
export function readTransform(object: T.Object3D) {
  return { position: tuple(object.position), rotation: [object.rotation.x, object.rotation.y, object.rotation.z].map(n => (Math.round(T.MathUtils.radToDeg(n) * 1e6) / 1e6) || 0) as [number, number, number], scale: tuple(object.scale) };
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
  if (doc.sceneVersion !== undefined && doc.sceneVersion !== 1) throw Error("Unknown scene layout version.");
  if (doc.openWorld !== undefined && typeof doc.openWorld !== "boolean") throw Error("Invalid world access setting.");
  const ids = new Set<string>();
  if (doc.terrain !== undefined) validateTerrain(doc.terrain);
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
    if (["horse-bay", "horse-grey"].includes(item.asset) && (item.scale.some(n => n < .5 || n > 2 || Math.abs(n - item.scale[0]) > .001) || Math.abs(item.rotation[0]) > .001 || Math.abs(item.rotation[2]) > .001)) throw Error("Horses need upright rotation and uniform scale between 0.5 and 2.");
    if (["garden-kitchen", "picnic-mat", "horse-racetrack", "horse-stable", "farm-row", "owl-feeding-perch", "owl-brown", "cow-highland", "cow-highland-girl", "sheep", "lamb", "hedgehog", "apple-tree", "mushroom-patch"].includes(item.asset) && (Math.abs(item.rotation[0]) > .001 || Math.abs(item.rotation[2]) > .001)) throw Error("Keep town activity objects upright. Turn them with Y rotation.");
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
  const border = root.children.filter(child => child.userData.pavingBorder);
  if (border.length) { border.forEach(child => batchProp(child)); return; }
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const batches = new Map<T.Material, T.Mesh[]>();
  root.traverse(o => {
    if (o instanceof T.Mesh && !(o instanceof T.InstancedMesh) && !(o instanceof T.SkinnedMesh) && !Array.isArray(o.material) && o.material instanceof T.MeshStandardMaterial && !o.material.transparent) {
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
  private currentWorld?: World["authored"];
  readonly assets = new Map<string, Asset>();
  readonly roots = new Map<string, T.Object3D>();
  readonly group = new T.Group();
  original!: Layout;
  world!: World;
  private pathMaterial!: T.Material;
  readonly defaultRoutes: Partial<Record<ResidentId, ResidentRoute>> = {};
  private generated = new Set<T.BufferGeometry>();
  private riverStones = new T.Group();

  async load(renderer: T.WebGLRenderer, progress: (n: number) => void) {
    await loadAnimalRigs(ANIMAL_RIG_SLUGS);
    const captures: Parameters<WorldLayoutCapture>[] = [];
    this.world = await buildWorld(progress, renderer, (...args) => captures.push(args));
    this.world.group.updateMatrixWorld(true);
    const originals: LayoutItem[] = [];
    const register = (id: string, name: string, category: string, root: T.Object3D, shelf = true, locked = false) => {
      root.name = name; batchProp(root);
      const item: LayoutItem = { id, asset: id, name, ...readTransform(root), visible: root.visible, locked };
      const template = cloneSkeleton(root); template.position.set(0, 0, 0); template.rotation.set(0, 0, 0); template.scale.set(1, 1, 1); template.visible = true;
      this.assets.set(id, { id, name, category, template, shelf }); originals.push(item);
      root.removeFromParent();
    };
    for (const [id, name, category, objects, pivot] of captures) {
      if (id === "forest") {
        const legacy = new T.Group(); objects.forEach(object => legacy.add(object.clone(true)));
        this.assets.set("forest", { id: "forest", name: "Distant forest (legacy assembly)", category: "Nature", template: legacy, shelf: false });
      }
      if (INSTANCE_LAYERS.includes(id)) {
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
          register(`${id}-${i + 1}`, `${id === "forest" ? "Distant tree" : name} ${i + 1}`, id === "forest" ? "Nature" : category, root, i === 0);
        }
        objects.forEach(o => o.removeFromParent());
      } else {
        let root: T.Object3D;
        if (objects.length === 1 && objects[0] instanceof T.Group && pivot && objects[0].position.distanceTo(new T.Vector3(...pivot)) < .001) root = objects[0];
        else {
          root = new T.Group(); root.position.fromArray(pivot ?? [0, 0, 0]); root.updateMatrixWorld(true);
          for (const object of objects) root.attach(object);
        }
        const locked = false;
        const shelf = !["terrain", "shore", "river", "river-stones", "meadow-grass", "authored-grass", "wildflowers", "forest", "ivy", "wayfinding"].includes(id) && !this.world.authored.benches.some(bench => bench.id === id) && !this.world.authored.swings.some(swing => swing.id === id) && !this.world.authored.fences.some(fence => fence.id === id) && !id.startsWith("mountain") && (!id.startsWith("bench-") || id === "bench-1") && (!id.startsWith("fence-") || id === "fence--1-180") && (!id.startsWith("lamp-") || id === "lamp-20" || id === "lamp-moon-bridge") && (!id.startsWith("edge-lantern-") || id === "edge-lantern-garden-1") && (!id.startsWith("path-") || id === "path-2" || name === "Bird clearing approach");
        register(id, name, category, root, shelf, locked);
      }
    }
    // Keep previews independent of active instance counts and object deletion.
    this.assets.set("oak-bench", { id: "oak-bench", name: "Oak meadow bench", category: "Furnishings", template: this.assets.get("bench-1")!.template.clone(true), shelf: true, solid: true });
    for (const coat of ["bay", "grey"] as const) this.assets.set(`horse-${coat}`, { id: `horse-${coat}`, name: coat === "bay" ? "Bay riding horse" : "Dapple grey riding horse", category: "Animals", template: makeHorseModel(coat), shelf: true });
    this.assets.set("meadow-swings", { id: "meadow-swings", name: "Meadow swing set · two seats", category: "Furnishings",
      template: new VillageSwingSet({ id: "meadow-swings", x: 0, y: 0, z: 0, yaw: 0, scale: [1, 1, 1] }).root, shelf: true, solid: true });
    const kit = await new GLTFLoader().loadAsync("/village/models/garden-pond.glb");
    const garden = new GardenScene(kit.scene, [], () => {}, this.world.gardenSurfaces);
    // Preserve the authored garden as one assembly; planting state remains outside layout files.
    garden.group.updateMatrixWorld(true);
    const gardenRoot = new T.Group(); gardenRoot.position.set(24, 0, -6); gardenRoot.updateMatrixWorld(true); gardenRoot.attach(garden.group);
    register("kitchen-garden", "Kitchen garden & pond life", "Furnishings", gardenRoot, false, false);
    const activities = new VillageActivities([]);
    register("activity-furnishings", "Writing desk & activity furnishings", "Furnishings", activities.outdoor, false, false);
    for (const name of ["Sunflower", "Daisy", "Iris", "Mint", "Reeds", "Lily", "Carrot", "Radish", "Basket", "WateringCan", "Swan", "Duck", "Duckling", "Fish"]) {
      const model = kit.scene.getObjectByName(name); if (!model) continue;
      const root = ["Swan", "Duck", "Duckling"].includes(name) ? makeAnimalRig(name.toLowerCase() as "swan" | "duck" | "duckling") : model.clone(true);
      root.position.set(0, 0, 0); root.updateMatrixWorld(true);
      const id = `garden-${name.toLowerCase()}`;
      this.assets.set(id, { id, name: name === "WateringCan" ? "Watering can" : name, category: ["WateringCan", "Basket"].includes(name) ? "Furnishings" : "Nature", template: root, shelf: true });
    }
    const [doveKit, spiritKit] = await Promise.all([
      new GLTFLoader().loadAsync("/village/models/dove.glb?v=1"),
      new GLTFLoader().loadAsync("/village/models/spirit.glb?v=3"),
    ]);
    for (const [breed, info] of Object.entries(PUPPY_INFO)) {
      const template = makeAnimalRig(`dog-${breed}` as AnimalRigSlug);
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
      this.assets.set(id, { id, name: index === 4 ? "Wren · bird caretaker" : ({ Rusk: "Rusk · carrot farmer", Poppy: "Poppy · radish farmer", Cress: "Cress · mint farmer", Rowan: "Rowan · horse caretaker" } as Record<string, string>)[name] ?? name, category: "Villagers", template, shelf: true });
      originals.push({ id: `resident-${name.toLowerCase()}`, asset: id, name, position, rotation: [0, 0, 0], scale: [1, 1, 1], visible: true, locked: false });
    });
    for (let i = 0; i < 12; i++) {
      const [x, z] = BIRD_LANDING_SPOTS[i];
      originals.push({ id: `dove-${i + 1}`, asset: "white-dove", name: `White dove ${i + 1}`,
        position: [x, .13, z],
        rotation: [0, T.MathUtils.radToDeg(Math.atan2(BIRD_CLEARING.x - x, BIRD_CLEARING.z - z)), 0], scale: [1, 1, 1], visible: true, locked: false });
    }
    residents.dispose();
    const townKit = await loadTownAssetKit();
    for (const [id, asset] of supplementalAssets(this.world.gardenSurfaces, makeAnimalRig("cat"), townKit, this.world.water.userData.time)) this.assets.set(id, asset);
    for (const [id, asset] of await loadAnimalArt()) this.assets.set(id, asset);
    this.pathMaterial = this.world.gardenSurfaces.paving;
    const riverPath = { points: [[0, 0], [0, -5], [2, -10], [0, -16]] as [number, number][], width: 6 };
    this.assets.set("custom-river", { id: "custom-river", name: "Flowing river curve", category: "Landscape", template: this.makeRiver(riverPath), shelf: true, path: riverPath });
    this.assets.set("custom-path", { id: "custom-path", name: "Curved limestone path", category: "Paths", template: new T.Group(), shelf: false });
    const fencePath = { points: [[0, 0], [0, -8]] as [number, number][], width: 1.4 };
    this.assets.set("fence-line", { id: "fence-line", name: "Oak fence line", category: "Furnishings", template: this.makeFence(fencePath), shelf: true, solid: true, path: fencePath });
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
      ["grass-meadow", "Meadow grass", MEADOW_WIDTH, MEADOW_GRASS_COUNT],
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
    this.assets.set("flower-meadow", { id: "flower-meadow", name: "Meadow wildflowers", category: "Nature", shelf: true,
      template: meadowFlowers([{ id: "flower-meadow", asset: "flower-meadow", position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], visible: true }], () => 0) });
    const region = new T.Group();
    const fill = new T.Mesh(new T.CircleGeometry(12, 64), new T.MeshBasicMaterial({ color: "#7bbda0", transparent: true, opacity: .18, depthWrite: false, side: T.DoubleSide }));
    fill.rotation.x = -Math.PI / 2; fill.position.y = .16; region.add(fill);
    const rim = new T.Mesh(new T.RingGeometry(11.82, 12, 64), new T.MeshBasicMaterial({ color: "#317660", transparent: true, opacity: .7, depthWrite: false, side: T.DoubleSide }));
    rim.rotation.x = -Math.PI / 2; rim.position.y = .17; region.add(rim);
    this.assets.set("walkable-region", { id: "walkable-region", name: "Walkable meadow area", category: "Landscape", template: region, shelf: true });
    for (const asset of this.assets.values()) {
      asset.surface ||= ["terrain", "shore", "meadow-island", "bridge", "dock"].includes(asset.id) || asset.id.startsWith("island-");
      if (!asset.localColliders) asset.solid = asset.category === "Buildings" || asset.category === "Bridges" || /^(bench-|fence-|lamp-|edge-lantern-|tree-|willow-)/.test(asset.id) || ["oak-bench", "postbox", "raised-bed", "boulder", "bird-clearing-bench", "bird-feeding-dish"].includes(asset.id);
    }
    this.original = { version: 1, base: "cosy-village-2026-09-27", name: "Current village", objects: originals };
    this.apply(this.original); progress(100);
  }

  editableLayout(layout: Layout): Layout {
    const copy = structuredClone(layout);
    if (copy.sceneVersion === 1) return copy;
    const forest = copy.objects.find(item => item.asset === "forest");
    if (forest) {
      const matrix = new T.Matrix4().compose(new T.Vector3(...forest.position),
        new T.Quaternion().setFromEuler(new T.Euler(...forest.rotation.map(T.MathUtils.degToRad) as [number, number, number])), new T.Vector3(...forest.scale));
      for (const tree of this.original.objects.filter(item => /^forest-\d+$/.test(item.asset))) {
        const next = structuredClone(tree), root = new T.Object3D(); applyTransform(root, next);
        root.applyMatrix4(matrix); Object.assign(next, readTransform(root)); next.visible = forest.visible; next.locked = false;
        copy.objects.push(next);
      }
      copy.objects = copy.objects.filter(item => item.asset !== "forest");
    }
    // Earlier background locks were imposed by the renderer, not chosen by the author.
    for (const item of copy.objects) if (["terrain", "shore", "river", "pond", "river-stones", "meadow-grass", "wildflowers", "ivy", "wayfinding", "kitchen-garden"].includes(item.asset) || item.asset.startsWith("mountain-")) item.locked = false;
    if (!copy.objects.some(item => item.asset === "activity-furnishings")) {
      const activities = this.original.objects.find(item => item.asset === "activity-furnishings");
      if (activities) copy.objects.push(structuredClone(activities));
    }
    copy.sceneVersion = 1;
    return copy;
  }

  apply(layout: Layout) {
    const authored = projectWorldLayout(layout);
    this.currentWorld = authored;
    setAuthoredWorld(authored);
    const active = new Set(layout.objects.map(o => o.id));
    for (const [id, root] of this.roots) if (!active.has(id)) { root.removeFromParent(); this.releasePath(root); this.roots.delete(id); }
    for (const item of layout.objects) {
      let root = this.roots.get(item.id);
      if (root && (root.userData.asset !== item.asset || JSON.stringify(root.userData.path) !== JSON.stringify(item.path))) {
        root.removeFromParent(); this.releasePath(root); this.roots.delete(item.id); root = undefined;
      }
      if (!root) {
        root = item.asset === "custom-river" && item.path ? this.makeRiver(item.path) : item.asset === "fence-line" && item.path ? this.makeFence(item.path) : item.path ? this.makePath(item.path, item.asset === "path-straight") : cloneSkeleton(this.assets.get(item.asset)!.template);
        root.userData = { layoutId: item.id, asset: item.asset, path: structuredClone(item.path) };
        this.roots.set(item.id, root); this.group.add(root);
      }
      root.name = item.name; applyTransform(root, item);
    }
    this.group.updateMatrixWorld(true);
    for (const root of this.roots.values()) if (root.userData.asset === "shore") root.traverse(object => {
      if (!(object instanceof T.Mesh)) return;
      if (!object.userData.editableRiverBank) {
        object.geometry = object.geometry.clone(); this.generated.add(object.geometry); object.userData.editableRiverBank = true;
      }
      conformRiverBank(object.geometry, object.matrixWorld, authored);
    });
    this.refreshTerrain(layout.terrain);
  }
  refreshTerrain(terrain?: TerrainElevation) {
    const world = this.currentWorld && { ...this.currentWorld, terrain };
    const key = JSON.stringify({ terrain, rivers: world?.rivers, streams: world?.items?.filter(item => item.asset === "custom-river") });
    const channelHeight = world && makeRiverChannelHeight(world, landscapeHeight);
    const point = new T.Vector3();
    for (const root of this.roots.values()) {
      if (root.userData.asset !== "terrain") continue;
      root.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        const elevationKey = key + JSON.stringify(object.matrixWorld.elements);
        if (object.userData.elevationKey === elevationKey) return;
        if (!object.userData.editableTerrain) { object.geometry = object.geometry.clone(); this.generated.add(object.geometry); object.userData.editableTerrain = true; }
        object.userData.elevationKey = elevationKey;
        const positions = object.geometry.attributes.position;
        const base: number[] = object.userData.terrainBasePositions ?? Array.from(positions.array);
        object.userData.terrainBasePositions = base;
        const inverse = object.matrixWorld.clone().invert();
        for (let i = 0; i < positions.count; i++) {
          const x = base[i * 3], z = base[i * 3 + 2];
          const height = sampleTerrainHeight(terrain, x, z);
          point.set(x, pondDistance(x, z) < 1.35 ? Math.min(-.85, height) : height, z).applyMatrix4(object.matrixWorld);
          if (channelHeight) point.y = channelHeight(point.x, point.z, point.y);
          point.applyMatrix4(inverse); positions.setXYZ(i, point.x, point.y, point.z);
        }
        positions.needsUpdate = true; object.geometry.computeVertexNormals(); object.geometry.computeBoundingSphere(); object.geometry.computeBoundingBox();
      });
    }
  }
  conformPaths(height: (x: number, z: number) => number) {
    disposeRiverbankStones(this.riverStones);
    for (const root of this.roots.values()) {
      if (root.userData.asset === "fence-line" || /^fence-/.test(root.userData.asset)) {
        root.updateMatrixWorld(true);
        const lift = Math.max(0, root.position.y - height(root.position.x, root.position.z));
        root.traverse(object => {
          if (!(object instanceof T.Mesh) || !object.geometry.userData.fencePath) return;
          const geometry = conformFenceGeometry(object.geometry, object.matrixWorld, (x, z) => height(x, z) + lift);
          if (this.generated.delete(object.geometry)) object.geometry.dispose();
          object.geometry = geometry; this.generated.add(geometry);
        });
        continue;
      }
      if (!root.userData.path) {
        if (this.assets.get(root.userData.asset)?.category !== "Paths") continue;
        root.updateMatrixWorld(true);
        root.traverse(object => {
          if (!(object instanceof T.Mesh)) return;
          if (!object.userData.capturedPathPositions) {
            object.geometry = object.geometry.clone();
            this.generated.add(object.geometry);
            object.userData.capturedPathPositions = Array.from(object.geometry.attributes.position.array);
          }
          const base = object.userData.capturedPathPositions as number[], attribute = object.geometry.attributes.position;
          for (let i = 0; i < attribute.count; i++) {
            const point = new T.Vector3(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]).applyMatrix4(object.matrixWorld);
            const previous = Math.max(0, sampleTerrainHeight(this.world.authored.terrain, point.x, point.z));
            const lift = height(point.x, point.z) - previous;
            attribute.setY(i, base[i * 3 + 1] + lift / object.matrixWorld.elements[5]);
          }
          attribute.needsUpdate = true; object.geometry.computeVertexNormals(); object.geometry.computeBoundingBox(); object.geometry.computeBoundingSphere();
        });
        continue;
      }
      root.updateMatrixWorld(true);
      const anchor = height(root.position.x, root.position.z);
      root.traverse(object => {
        if (!(object instanceof T.Mesh) || !object.geometry.userData.flatPositions) return;
        if (root.userData.asset === "custom-river") {
          const path = root.userData.path;
          this.generated.delete(object.geometry); object.geometry.dispose();
          object.geometry = riverGeometry(path.points, path.width);
        }
        const base = object.geometry.userData.flatPositions as number[], attribute = object.geometry.attributes.position;
        for (let i = 0; i < attribute.count; i++) {
          const sample = root.userData.asset === "custom-river" ? i - i % 2 : i;
          const localX = root.userData.asset === "custom-river" ? (base[sample * 3] + base[(sample + 1) * 3]) / 2 : base[i * 3];
          const localZ = root.userData.asset === "custom-river" ? (base[sample * 3 + 2] + base[(sample + 1) * 3 + 2]) / 2 : base[i * 3 + 2];
          const point = new T.Vector3(localX, 0, localZ).applyMatrix4(object.matrixWorld);
          const lift = height(point.x, point.z) - anchor + base[i * 3 + 1];
          attribute.setY(i, Math.abs(object.matrixWorld.elements[5]) > .1 ? lift / object.matrixWorld.elements[5] : .09);
        }
        attribute.needsUpdate = true; object.geometry.computeVertexNormals(); object.geometry.computeBoundingBox(); object.geometry.computeBoundingSphere();
        if (root.userData.asset === "custom-river" && this.currentWorld) {
          object.geometry = joinRiverToPonds(object.geometry, object.matrixWorld, this.currentWorld);
          this.generated.add(object.geometry);
        }
      });
    }
    this.riverStones = buildRiverbankStones(this.group, this.world.gardenSurfaces.stone, height);
    this.group.add(this.riverStones);
  }
  conformGrass(height: (x: number, z: number) => number, blocked: (point: T.Vector3) => boolean, cleared: (x: number, z: number, radius: number) => boolean) {
    for (const root of this.roots.values()) {
      const asset = root.userData.asset as string;
      if (!root.visible || !(asset === "meadow-grass" || asset.startsWith("grass-") || asset === "flower-meadow")) continue;
      const sources: T.InstancedMesh[] = [], shown: T.InstancedMesh[] = [];
      this.assets.get(asset)!.template.traverse(o => { if (o instanceof T.InstancedMesh) sources.push(o); });
      root.traverse(o => { if (o instanceof T.InstancedMesh) shown.push(o); });
      const source = sources[0]; if (!source || !shown.length) continue;
      const anchor = height(root.position.x, root.position.z), dummy = new T.Object3D(), matrix = new T.Matrix4(), world = new T.Matrix4();
      for (let i = 0; i < source.count; i++) {
        source.getMatrixAt(i, matrix); matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
        const point = dummy.position.clone().applyMatrix4(root.matrixWorld);
        if (Math.abs(root.matrixWorld.elements[5]) > .1) dummy.position.y += (height(point.x, point.z) - (asset === "meadow-grass" ? sampleTerrainHeight(this.world.authored.terrain, point.x, point.z) : anchor)) / root.matrixWorld.elements[5];
        point.copy(dummy.position).applyMatrix4(root.matrixWorld); point.y += .15;
        world.multiplyMatrices(shown[0].matrixWorld, matrix);
        const radius = Math.max(...sources.map(part => plantingRadius(part.geometry, world)));
        const hidden = blocked(point) || cleared(point.x, point.z, radius);
        const lift = dummy.position.y;
        for (let part = 0; part < sources.length; part++) {
          sources[part].getMatrixAt(i, matrix); matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
          dummy.position.y += lift - matrix.elements[13];
          if (asset === "flower-meadow" && part > 0) dummy.position.y += matrix.elements[13];
          if (hidden) dummy.scale.setScalar(0);
          dummy.updateMatrix(); shown[part].setMatrixAt(i, dummy.matrix);
        }
      }
      for (const blades of shown) { blades.instanceMatrix.needsUpdate = true; blades.computeBoundingBox(); blades.computeBoundingSphere(); }
    }
  }
  conformWildflowers(cleared: (x: number, z: number, radius: number) => boolean, height?: (x: number, z: number) => number) {
    for (const root of this.roots.values()) {
      if (!root.visible || root.userData.asset !== "wildflowers") continue;
      const source: T.InstancedMesh[] = [], shown: T.InstancedMesh[] = [];
      this.assets.get("wildflowers")!.template.traverse(o => { if (o instanceof T.InstancedMesh) source.push(o); });
      root.traverse(o => { if (o instanceof T.InstancedMesh) shown.push(o); });
      const matrix = new T.Matrix4(), world = new T.Matrix4(), position = new T.Vector3(), rotation = new T.Quaternion(), scale = new T.Vector3();
      root.updateMatrixWorld(true);
      for (let i = 0; i < source[0].count; i++) {
        source[0].getMatrixAt(i, matrix); matrix.decompose(position, rotation, scale);
        const worldPoint = position.clone().applyMatrix4(root.matrixWorld);
        world.multiplyMatrices(shown[0].matrixWorld, matrix);
        const hidden = cleared(worldPoint.x, worldPoint.z, Math.max(...source.map(part => plantingRadius(part.geometry, world))));
        for (let part = 0; part < source.length; part++) {
          source[part].getMatrixAt(i, matrix);
          if (height) matrix.elements[13] += height(worldPoint.x, worldPoint.z) - sampleTerrainHeight(this.world.authored.terrain, worldPoint.x, worldPoint.z);
          if (hidden) { matrix.decompose(position, rotation, scale); scale.setScalar(0); matrix.compose(position, rotation, scale); }
          shown[part].setMatrixAt(i, matrix);
        }
      }
      for (const mesh of shown) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere(); }
    }
  }
  conformBorderPlants(cleared: (x: number, z: number, radius: number) => boolean, paved: (x: number, z: number, radius: number) => boolean, layout?: Layout) {
    const local = new T.Matrix4(), world = new T.Matrix4(), zero = new T.Vector3(0, 0, 0);
    const pond = new PondLifeSpace(layout ? projectWorldLayout(layout) : undefined);
    for (const root of this.roots.values()) {
      const asset = root.userData.asset as string;
      if (!root.visible || !(/^(bushes-|pond-rest-shrub-)/.test(asset) || asset === "kitchen-garden")) continue;
      const sources: T.InstancedMesh[] = [], shown: T.InstancedMesh[] = [];
      this.assets.get(asset)!.template.traverse(object => { if (object instanceof T.InstancedMesh) sources.push(object); });
      root.traverse(object => { if (object instanceof T.InstancedMesh) shown.push(object); });
      for (let part = 0; part < sources.length; part++) {
        const mesh = shown[part], source = sources[part];
        if (!source.geometry.userData.groundPlant && !source.userData.bankPlant && !source.userData.pondPlant) continue;
        for (let i = 0; i < source.count; i++) {
          source.getMatrixAt(i, local);
          if (source.userData.pondPlant) {
            const point = pond.point(local.elements[12], local.elements[13], local.elements[14]);
            local.setPosition(...point);
          }
          world.multiplyMatrices(mesh.matrixWorld, local);
          if ((source.userData.bankPlant || source.userData.pondPlant ? paved : cleared)(world.elements[12], world.elements[14], plantingRadius(source.geometry, world))) local.scale(zero);
          mesh.setMatrixAt(i, local);
        }
        mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere();
      }
    }
  }
  private releasePath(root: T.Object3D) {
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
    geo.userData.plantingSurface = "paving";
    const mesh = new T.Mesh(geo, this.pathMaterial); mesh.receiveShadow = true; const group = new T.Group(); group.add(mesh); return group;
  }
  private makeFence(path: NonNullable<LayoutItem["path"]>) {
    const geo = fenceGeometry(path.points, path.width); this.generated.add(geo);
    const mesh = new T.Mesh(geo, fenceWoodMaterial(this.world.gardenSurfaces.wood)); mesh.castShadow = mesh.receiveShadow = true;
    const group = new T.Group(); group.add(mesh); return group;
  }
  private makeRiver(path: NonNullable<LayoutItem["path"]>) {
    const geometry = riverGeometry(path.points, path.width); this.generated.add(geometry);
    const mesh = new T.Mesh(geometry, this.world.water.material); mesh.receiveShadow = true;
    const group = new T.Group(); group.add(mesh); return group;
  }
}

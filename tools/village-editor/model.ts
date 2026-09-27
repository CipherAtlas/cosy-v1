import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { buildWorld, type WorldLayoutCapture, type World } from "../../features/village/world";
import { BIRD_CLEARING } from "../../features/village/environment";
import { VillageLife } from "../../features/village/life";
import { GardenScene } from "../../features/village/gardenScene";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export type LayoutItem = {
  id: string; asset: string; name: string; position: [number, number, number];
  rotation: [number, number, number]; scale: [number, number, number]; visible: boolean; locked: boolean;
  path?: { points: [number, number][]; width: number };
};
export type Layout = { version: 1; base: "cosy-village-2026-09-27"; name: string; objects: LayoutItem[] };
export type Asset = { id: string; name: string; category: string; template: T.Object3D; thumbnail?: string; shelf: boolean };
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
    if (item.path && (item.asset !== "custom-path" || !Number.isFinite(item.path.width) || item.path.width < .3 || item.path.width > 20 || !Array.isArray(item.path.points) || item.path.points.length < 2 || item.path.points.length > 100 || item.path.points.some(p => !Array.isArray(p) || p.length !== 2 || p.some(n => !Number.isFinite(n) || Math.abs(n) > 2000)))) throw Error("Invalid path: use 2–100 points and a width of 0.3–20 metres.");
    if (item.asset === "custom-path" && !item.path) throw Error("A custom path needs its control points.");
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
        const shelf = !["terrain", "shore", "river", "river-stones", "meadow-grass", "wildflowers", "forest", "ivy", "wayfinding"].includes(id) && !id.startsWith("mountain") && (!id.startsWith("bench-") || id === "bench-1") && (!id.startsWith("fence-") || id === "fence--1-180") && (!id.startsWith("lamp-") || id === "lamp-20") && (!id.startsWith("path-") || id === "path-2" || name === "Bird clearing approach");
        register(id, name, category, root, shelf, locked);
      }
    }
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
    const [doveKit, spiritKit] = await Promise.all([
      new GLTFLoader().loadAsync("/village/models/dove.glb?v=1"),
      new GLTFLoader().loadAsync("/village/models/spirit.glb?v=1"),
    ]);
    const dove = doveKit.scene.getObjectByName("Dove")!;
    dove.getObjectByName("DoveWingLeft")!.rotation.z = 1.12;
    dove.getObjectByName("DoveWingRight")!.rotation.z = -1.12;
    dove.traverse(node => { if (node instanceof T.Mesh) node.castShadow = node.receiveShadow = true; });
    this.assets.set("white-dove", { id: "white-dove", name: "White dove", category: "Nature", template: dove, shelf: true });
    const spirit = spiritKit.scene;
    spirit.scale.setScalar(.95 / new T.Box3().setFromObject(spirit).getSize(new T.Vector3()).y);
    // Reuse her runtime appearance so the editor cannot drift from the village's caretaker.
    const residents = new VillageLife(spirit, []);
    residents.residents.forEach((resident, index) => {
      const actor = resident.root, name = actor.name, position = tuple(actor.position);
      const id = index === 4 ? "wren-caretaker" : `villager-${name.toLowerCase()}`;
      actor.removeFromParent(); actor.position.set(0, 0, 0); actor.rotation.y = 0;
      const template = new T.Group(); template.add(actor);
      this.assets.set(id, { id, name: index === 4 ? "Wren · bird caretaker" : name, category: "Villagers", template, shelf: true });
      originals.push({ id: `resident-${name.toLowerCase()}`, asset: id, name, position, rotation: [0, 0, 0], scale: [1, 1, 1], visible: true, locked: false });
    });
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI * 2 / 12, radius = i % 2 ? 1.8 : 1.05;
      originals.push({ id: `dove-${i + 1}`, asset: "white-dove", name: `White dove ${i + 1}`,
        position: [BIRD_CLEARING.x + Math.cos(angle) * radius, .13, BIRD_CLEARING.z + Math.sin(angle) * radius],
        rotation: [0, -T.MathUtils.radToDeg(angle), 0], scale: [1, 1, 1], visible: true, locked: false });
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
    this.pathMaterial = this.world.gardenSurfaces.paving;
    this.assets.set("custom-path", { id: "custom-path", name: "Curved limestone path", category: "Paths", template: new T.Group(), shelf: false });
    const meadow = new T.Mesh(new T.CylinderGeometry(12, 13, 1.2, 48), new T.MeshStandardMaterial({ color: "#98b760", roughness: 1 }));
    meadow.position.y = -.6; meadow.receiveShadow = true; const tile = new T.Group(); tile.add(meadow);
    this.assets.set("meadow-island", { id: "meadow-island", name: "Meadow platform", category: "Landscape", template: tile, shelf: true });
    const boulder = new T.Mesh(new T.IcosahedronGeometry(1.5, 1), new T.MeshStandardMaterial({ color: "#b6bea1", roughness: 1 }));
    boulder.scale.set(1.6, .75, 1); boulder.position.y = .6; boulder.castShadow = boulder.receiveShadow = true;
    const rock = new T.Group(); rock.add(boulder); this.assets.set("boulder", { id: "boulder", name: "Mossy boulder", category: "Nature", template: rock, shelf: true });
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
        root = item.path ? this.makePath(item.path) : this.assets.get(item.asset)!.template.clone(true);
        root.userData = { layoutId: item.id, asset: item.asset, path: structuredClone(item.path) };
        this.roots.set(item.id, root); this.group.add(root);
      }
      root.name = item.name; applyTransform(root, item);
    }
  }
  private releasePath(root: T.Object3D) {
    if (!root.userData.path) return;
    root.traverse(o => { if (o instanceof T.Mesh && this.generated.delete(o.geometry)) o.geometry.dispose(); });
  }
  private makePath(path: NonNullable<LayoutItem["path"]>) {
    const curve = new T.CatmullRomCurve3(path.points.map(([x, z]) => new T.Vector3(x, .09, z)));
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    for (let i = 0; i <= 120; i++) {
      const p = curve.getPoint(i / 120), tangent = curve.getTangent(i / 120);
      for (const side of [-1, 1]) { const x = p.x + tangent.z * path.width * side / 2, z = p.z - tangent.x * path.width * side / 2; positions.push(x, p.y, z); uvs.push(x / 2, z / 2); }
      if (i < 120) { const n = i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
    }
    const geo = new T.BufferGeometry(); geo.setAttribute("position", new T.Float32BufferAttribute(positions, 3)); geo.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2)); geo.setIndex(indices); geo.computeVertexNormals(); this.generated.add(geo);
    const mesh = new T.Mesh(geo, this.pathMaterial); mesh.receiveShadow = true; const group = new T.Group(); group.add(mesh); return group;
  }
}

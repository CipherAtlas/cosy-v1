import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import * as T from "three";
import { makeBridgeWindow, makeCoffeeCup, makeDeskInkwell, makeDeskJournal, makeDeskQuill, makeFocusHourglass, cottageMaterials, makeCottageCouch, makeCottageLamp, makeCottageFern, makeCottagePrint, makeCatCushion, makeCottageChair, makeCottageBooks, makeCottagePottery, makeCottageWallShelf } from "./focusCottageProps";
import { makeKindNote } from "./activityScene";
import { applySceneTransform } from "./sceneLayout";
import type { World } from "./world";
import { townAssets, TOWN_ASSET_IDS, TOWN_ANIMAL_ASSETS, transformTownColliders, loadTownAssetKit } from "./townAssets";
import type { Collider } from "./environment";
import { loadAnimalArt } from "./animalArt";
import { ANIMAL_RIG_ASSETS, makeAnimalRig } from "./animalRig";
import { batchStaticProp } from "./spatialRendering";
import { makeRiverbankStone } from "./riverbankStones";

export type PlaceableAsset = { id: string; name: string; category: string; template: T.Object3D; shelf: boolean; surface?: boolean; solid?: boolean; localColliders?: Collider[] };

/** One catalog for supplemental studio props and their playable counterparts. */
export function supplementalAssets(surfaces: World["gardenSurfaces"], catSource: T.Object3D = new T.Group(), townSource?: T.Object3D) {
  const assets = new Map<string, PlaceableAsset>();
  const sourceGround = surfaces.ground;
  assets.set("riverbank-stone", { id: "riverbank-stone", name: "Small riverbank stone", category: "Nature", template: makeRiverbankStone(surfaces.stone), shelf: true });
    const raisedBed = new T.Group();
    const bedWood = surfaces.wood, soil = new T.MeshStandardMaterial({ color: "#80634b", roughness: 1 });
    const bedPart = (material: T.Material, position: [number, number, number], size: [number, number, number]) => {
      const mesh = new T.Mesh(new T.BoxGeometry(...size), material); mesh.position.fromArray(position); mesh.castShadow = mesh.receiveShadow = true; raisedBed.add(mesh);
    };
    bedPart(soil, [0, .13, 0], [3.2, .25, 2.5]);
    for (const z of [-1.28, 1.28]) bedPart(bedWood, [0, .2, z], [3.45, .38, .14]);
    for (const x of [-1.65, 1.65]) bedPart(bedWood, [x, .2, 0], [.14, .38, 2.7]);
    assets.set("raised-bed", { id: "raised-bed", name: "Raised garden bed", category: "Furnishings", template: raisedBed, shelf: true });
    assets.set("coffee-cup", { id: "coffee-cup", name: "Coffee cup", category: "Furnishings", template: makeCoffeeCup(), shelf: true });
    assets.set("writing-journal", { id: "writing-journal", name: "Open writing journal", category: "Furnishings", template: makeDeskJournal(), shelf: true });
    assets.set("kind-note", { id: "kind-note", name: "Kind note and envelope", category: "Furnishings", template: makeKindNote().root, shelf: true });
    assets.set("desk-inkwell", { id: "desk-inkwell", name: "Desk inkwell", category: "Furnishings", template: makeDeskInkwell(), shelf: true });
    assets.set("desk-quill", { id: "desk-quill", name: "Desk quill", category: "Furnishings", template: makeDeskQuill(), shelf: true });
    assets.set("focus-hourglass", { id: "focus-hourglass", name: "Focus hourglass", category: "Furnishings", template: makeFocusHourglass().hourglass, shelf: true });
    assets.set("village-window-vista", { id: "village-window-vista", name: "Bridge-view cottage window", category: "Buildings", template: makeBridgeWindow(), shelf: true });
    const cottageSurfaces = cottageMaterials();
    for (const [id, name, template, category] of [
      ["cottage-cat", "Cream & caramel cottage cat", catSource, "Animals"],
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
      assets.set(id, { id, name, category, template, shelf: true });
    }
    const meadow = new T.Mesh(new T.CylinderGeometry(12, 13, 1.2, 48), new T.MeshStandardMaterial({ color: "#98b760", roughness: 1 }));
    meadow.position.y = -.6; meadow.receiveShadow = true; const tile = new T.Group(); tile.add(meadow);
    assets.set("meadow-island", { id: "meadow-island", name: "Meadow platform", category: "Landscape", template: tile, shelf: true });
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
      assets.set(id, { id, name: `Meadow ground · ${size} m`, category: "Landscape", template: root, shelf: true, surface: true });
    }
    const hillGeometry = new T.PlaneGeometry(24, 24, 24, 24); hillGeometry.rotateX(-Math.PI / 2);
    const vertices = hillGeometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const radius = Math.min(1, Math.hypot(vertices.getX(i), vertices.getZ(i)) / 12);
      vertices.setY(i, Math.pow(Math.cos(radius * Math.PI / 2), 2) * 4);
    }
    hillGeometry.computeVertexNormals(); const hill = new T.Mesh(groundUV(hillGeometry), landMaterial); hill.receiveShadow = true;
    const hillRoot = new T.Group(); hillRoot.add(hill);
    assets.set("land-hill", { id: "land-hill", name: "Gentle grassy hill", category: "Landscape", template: hillRoot, shelf: true, surface: true });
    const boulder = new T.Mesh(new T.IcosahedronGeometry(1.5, 1), new T.MeshStandardMaterial({ color: "#b6bea1", roughness: 1 }));
    boulder.scale.set(1.6, .75, 1); boulder.position.y = .6; boulder.castShadow = boulder.receiveShadow = true;
    const rock = new T.Group(); rock.add(boulder); assets.set("boulder", { id: "boulder", name: "Mossy boulder", category: "Nature", template: rock, shelf: true });
  for (const asset of assets.values()) asset.solid = asset.category === "Buildings" || ["raised-bed", "boulder"].includes(asset.id);
  if (townSource) for (const [id, asset] of townAssets(townSource)) assets.set(id, asset);
  return assets;
}

export async function addSupplementalLayout(world: World, models: T.Object3D, cat?: T.Object3D, townSource?: T.Object3D) {
  if (world.authored.sceneVersion !== 1) return;
  const requested = new Set((world.authored.items ?? []).filter(item => item.visible).map(item => item.asset));
  if (![...requested].some(id => TOWN_ASSET_IDS.includes(id) || /^(animal-|land-|cottage-(cat|couch|reading|fern|botanical|writing|books|pottery|book))/.test(id) || /^garden-(sunflower|daisy|iris|mint|reeds|lily|carrot|radish|basket|wateringcan|swan|duck|duckling|fish)$/.test(id) || ["riverbank-stone", "meadow-island", "boulder", "raised-bed", "coffee-cup", "writing-journal", "kind-note", "desk-inkwell", "desk-quill", "focus-hourglass", "village-window-vista"].includes(id))) return;
  if (!townSource && [...requested].some(id => TOWN_ASSET_IDS.includes(id))) townSource = await loadTownAssetKit();
  const assets = supplementalAssets(world.gardenSurfaces, cat, townSource);
  const animalIds = new Set((world.authored.items ?? []).filter(item => item.visible && item.asset.startsWith("animal-")).map(item => item.asset));
  if (animalIds.size) for (const [id, asset] of await loadAnimalArt(animalIds)) assets.set(id, asset);
  const retainedGeometry = new Set<T.BufferGeometry>();
  const retainedMaterials = new Set<T.Material>([...Object.values(world.gardenSurfaces)]);
  townSource?.traverse(object => { if (object instanceof T.Mesh) {
    retainedGeometry.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => retainedMaterials.add(material));
  } });
  const names: Record<string, string> = { sunflower: "Sunflower", daisy: "Daisy", iris: "Iris", mint: "Mint", reeds: "Reeds", lily: "Lily", carrot: "Carrot", radish: "Radish", basket: "Basket", wateringcan: "WateringCan", swan: "Swan", duck: "Duck", duckling: "Duckling", fish: "Fish" };
  for (const item of world.authored.items ?? []) {
    // TownScene owns the three animated, shared owls; the studio still previews them.
    if (!item.visible || item.asset === "owl-brown" || TOWN_ANIMAL_ASSETS.includes(item.asset)) continue;
    let template = assets.get(item.asset)?.template;
    if (!template && item.asset.startsWith("garden-")) template = ANIMAL_RIG_ASSETS[item.asset]
      ? makeAnimalRig(ANIMAL_RIG_ASSETS[item.asset]) : models.getObjectByName(names[item.asset.slice(7)])?.clone(true);
    if (!template) continue;
    const root = cloneSkeleton(template);
    root.traverse(object => { if (object instanceof T.Mesh) {
      retainedGeometry.add(object.geometry);
      (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => retainedMaterials.add(material));
    } });
    applySceneTransform(root, item); world.group.add(root); root.updateMatrixWorld(true);
    const asset = assets.get(item.asset);
    if (asset?.localColliders) world.colliders.push(...transformTownColliders(asset.localColliders, item));
    else if (asset?.solid) {
      const box = new T.Box3().setFromObject(root), center = box.getCenter(new T.Vector3()), size = box.getSize(new T.Vector3());
      world.colliders.push({ x: center.x, z: center.z, w: size.x, d: size.z, bottom: box.min.y, top: box.max.y });
    }
    if (["farm-row", "horse-stable", "horse-racetrack", "hay-bale", "owl-feeding-perch"].includes(item.asset)) batchStaticProp(root);
  }
  for (const asset of assets.values()) asset.template.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    if (!retainedGeometry.has(object.geometry)) object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (!retainedMaterials.has(material)) material.dispose();
  });
}

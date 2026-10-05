import * as T from "three";
import { validateTerrain, type TerrainElevation } from "./terrain";

export type WorldPoint = [number, number];
export type ResidentId = "pip" | "maple" | "moss" | "luma" | "wren" | "rusk" | "poppy" | "cress" | "rowan";
export const RESIDENT_IDS: ResidentId[] = ["pip", "maple", "moss", "luma", "wren", "rusk", "poppy", "cress", "rowan"];
export type ResidentRoute = { points: WorldPoint[]; pauses?: number[] };
export type PuppyBreed = "corgi" | "shiba" | "beagle" | "samoyed" | "collie" | "shepherd";
export type PuppyPlacement = { id: string; name: string; breed: PuppyBreed; x: number; y: number; z: number; yaw: number; scale: [number, number, number] };
export type HorsePlacement = { id: string; name: string; coat: "bay" | "grey"; x: number; y: number; z: number; yaw: number; scale: [number, number, number] };
export type AuthoredWorld = {
  items?: WorldItem[];
  sceneVersion?: 1;
  openWorld?: boolean;
  terrain?: TerrainElevation;
  horses?: HorsePlacement[];
  paths: { id: string; points: WorldPoint[]; spine: WorldPoint[]; bounds: [number, number, number, number]; width: number; straight: boolean }[];
  rivers?: AuthoredWorld["paths"];
  fences: { id: string; points: WorldPoint[]; height: number }[];
  structures: Record<string, { x: number; y: number; z: number; yaw: number }>;
  grass: { id: string; x: number; z: number; radiusX: number; radiusZ: number; yaw: number; heightScale: number; count: number }[];
  clearings: { x: number; z: number; radiusX: number; radiusZ: number; yaw: number }[];
  walkable: { id: string; x: number; z: number; radiusX: number; radiusZ: number; yaw: number }[];
  trees: { id: string; x: number; z: number; y: number; rotation: [number, number, number]; scale: [number, number, number] }[];
  benches: { id: string; x: number; y: number; z: number; yaw: number; scale: [number, number, number] }[];
  swings: AuthoredWorld["benches"];
  crumbPouches: { id: string; x: number; y: number; z: number; rotation: [number, number, number]; scale: [number, number, number] }[];
  puppies: PuppyPlacement[];
  routes: Partial<Record<ResidentId, ResidentRoute>>;
};

export type WorldItem = {
  id: string; asset: string; name?: string; position: [number, number, number]; rotation: [number, number, number];
  scale: [number, number, number]; visible: boolean; path?: { points: WorldPoint[]; width: number };
};
export const MEADOW_WIDTH = 48;
export const MEADOW_GRASS_COUNT = 2400;
export const MEADOW_FLOWER_COUNT = 120;

export function townPlantingClearance(x: number, z: number, items: WorldItem[] = []) {
  return items.some(item => {
    if (!item.visible || !["horse-racetrack", "farm-row", "horse-stable", "hay-bale"].includes(item.asset)) return false;
    const yaw = item.rotation[1] * Math.PI / 180, dx = x - item.position[0], dz = z - item.position[2];
    const lx = (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / item.scale[0], lz = (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / item.scale[2];
    if (item.asset === "horse-racetrack") return Math.hypot(lx / 26.8, lz / 16.8) < 1 && Math.hypot(lx / 21.2, lz / 11.2) > 1;
    const [w, d] = item.asset === "farm-row" ? [8.35, .8] : item.asset === "horse-stable" ? [4.7, 3.1] : [1.15, .8];
    return Math.abs(lx) < w && Math.abs(lz) < d;
  });
}

type WorldLayout = { version: number; base: string; objects: WorldItem[]; routes?: Partial<Record<ResidentId, ResidentRoute>>; terrain?: TerrainElevation; sceneVersion?: 1; openWorld?: boolean };

const finite = (value: number) => Number.isFinite(value) && Math.abs(value) <= 2000;
export function projectWorldLayout(source: unknown): AuthoredWorld {
  const layout = source as WorldLayout;
  if (!layout || layout.version !== 1 || layout.base !== "cosy-village-2026-09-27" || !Array.isArray(layout.objects))
    throw Error("The playable world layout has an unsupported format.");
  const result: AuthoredWorld = { paths: [], fences: [], structures: {}, grass: [], clearings: [], walkable: [], trees: [], benches: [], swings: [], crumbPouches: [], puppies: [], routes: {} };
  if (layout.sceneVersion !== undefined && layout.sceneVersion !== 1) throw Error("Unknown scene layout version.");
  if (layout.openWorld !== undefined && typeof layout.openWorld !== "boolean") throw Error("Invalid world access setting.");
  result.items = layout.objects; result.sceneVersion = layout.sceneVersion; result.openWorld = layout.openWorld;
  if (layout.terrain !== undefined) result.terrain = validateTerrain(layout.terrain);
  result.horses = [];
  result.rivers = [];
  for (const item of layout.objects) {
    if (!item?.visible || !Array.isArray(item.position) || !Array.isArray(item.rotation) || !Array.isArray(item.scale)) continue;
    const [x, y, z] = item.position;
    if (![x, y, z, ...item.rotation, ...item.scale].every(finite)) throw Error(`Invalid transform in ${item.id}.`);
    if (item.path && ["custom-path", "path-straight", "path-curved", "custom-river"].includes(item.asset)) {
      const angle = item.rotation[1] * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
      const points = item.path.points.map(([px, pz]): WorldPoint => [x + px * item.scale[0] * c + pz * item.scale[2] * s, z - px * item.scale[0] * s + pz * item.scale[2] * c]);
      if (points.some(point => !point.every(finite))) throw Error(`Invalid path points in ${item.id}.`);
      const straight = item.asset === "path-straight";
      const spine: WorldPoint[] = straight ? points : new T.CatmullRomCurve3(points.map(([px, pz]) => new T.Vector3(px, 0, pz)))
        .getPoints(Math.max(32, (points.length - 1) * 16)).map(p => [p.x, p.z]);
      const width = item.path.width * Math.max(item.scale[0], item.scale[2]);
      const xs = spine.map(p => p[0]), zs = spine.map(p => p[1]);
      (item.asset === "custom-river" ? result.rivers : result.paths).push({ id: item.id, points, spine, bounds: [Math.min(...xs) - width, Math.min(...zs) - width, Math.max(...xs) + width, Math.max(...zs) + width], width, straight });
    }
    if (item.asset === "fence-line" && item.path) {
      const angle = item.rotation[1] * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
      const points = item.path.points.map(([px, pz]): WorldPoint => [x + px * item.scale[0] * c + pz * item.scale[2] * s, z - px * item.scale[0] * s + pz * item.scale[2] * c]);
      if (points.some(point => !point.every(finite))) throw Error(`Invalid fence points in ${item.id}.`);
      result.fences.push({ id: item.id, points, height: item.path.width * item.scale[1] });
    }
    if ((["cottage-1", "cottage-2", "cottage-3", "cottage-4", "cottage-7", "cottage-8", "cottage-9", "tower"] as string[]).includes(item.asset))
      result.structures[item.asset] = { x, y, z, yaw: item.rotation[1] * Math.PI / 180 };
    if (["grass-tuft", "grass-patch", "grass-wide", "grass-meadow"].includes(item.asset)) {
      const size = item.asset === "grass-meadow" ? MEADOW_WIDTH : item.asset === "grass-tuft" ? 1 : item.asset === "grass-patch" ? 6 : 14;
      const count = item.asset === "grass-meadow" ? MEADOW_GRASS_COUNT : item.asset === "grass-tuft" ? 18 : item.asset === "grass-patch" ? 520 : 2400;
      result.grass.push({ id: item.id, x, z, radiusX: size * item.scale[0] / 2, radiusZ: size * item.scale[2] / 2, yaw: item.rotation[1] * Math.PI / 180, heightScale: item.scale[1], count });
    }
    if (item.asset === "planting-clearance") result.clearings.push({ x, z, radiusX: item.scale[0], radiusZ: item.scale[2], yaw: item.rotation[1] * Math.PI / 180 });
    if (item.asset === "walkable-region") result.walkable.push({ id: item.id, x, z, radiusX: 12 * item.scale[0], radiusZ: 12 * item.scale[2], yaw: item.rotation[1] * Math.PI / 180 });
    if (/^tree-\d+$/.test(item.asset)) result.trees.push({ id: item.id, x, y, z, rotation: item.rotation.map(value => value * Math.PI / 180) as [number, number, number], scale: item.scale });
    if (item.asset === "oak-bench") result.benches.push({ id: item.id, x, y, z, yaw: item.rotation[1] * Math.PI / 180, scale: item.scale });
    if (item.asset === "meadow-swings") {
      if (item.scale.some(value => value <= 0 || Math.abs(value - item.scale[0]) > .001) || Math.abs(item.rotation[0]) > .001 || Math.abs(item.rotation[2]) > .001)
        throw Error("Swing sets need upright rotation and uniform scale for their pendulum physics.");
      result.swings.push({ id: item.id, x, y, z, yaw: item.rotation[1] * Math.PI / 180, scale: item.scale });
    }
    if (item.asset === "bird-crumb-pouch") result.crumbPouches.push({ id: item.id, x, y, z,
      rotation: item.rotation.map(value => value * Math.PI / 180) as [number, number, number], scale: item.scale });
    if (item.asset.startsWith("puppy-")) {
      const breed = item.asset.slice(6);
      if (["corgi", "shiba", "beagle", "samoyed", "collie", "shepherd"].includes(breed))
        result.puppies.push({ id: item.id, name: item.name?.slice(0, 100) || breed, breed: breed as PuppyBreed, x, y, z,
          yaw: item.rotation[1] * Math.PI / 180, scale: item.scale });
    }
    if (item.asset === "horse-bay" || item.asset === "horse-grey") {
      if (item.scale.some(value => value < .5 || value > 2 || Math.abs(value - item.scale[0]) > .001) || Math.abs(item.rotation[0]) > .001 || Math.abs(item.rotation[2]) > .001)
        throw Error("Horses need upright rotation and uniform scale between 0.5 and 2.");
      result.horses.push({ id: item.id, name: item.name?.slice(0, 100) || "Horse", coat: item.asset === "horse-grey" ? "grey" : "bay", x, y, z, yaw: item.rotation[1] * Math.PI / 180, scale: item.scale });
    }
  }
  if (layout.routes) for (const id of RESIDENT_IDS) {
    const route = layout.routes[id]; if (!route) continue;
    if (!Array.isArray(route.points) || route.points.length < 2 || route.points.length > 100 || route.points.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(finite))) throw Error(`Invalid ${id} route.`);
    if (route.pauses && (route.pauses.length !== route.points.length || route.pauses.some(p => !Number.isFinite(p) || p < 0 || p > 30))) throw Error(`Invalid ${id} route pauses.`);
    result.routes[id] = { points: route.points.map(p => [...p]), pauses: route.pauses?.slice() };
  }
  return result;
}

export function insidePlantingClearance(x: number, z: number, clearings: AuthoredWorld["clearings"]) {
  return clearings.some(clearing => {
    const dx = x - clearing.x, dz = z - clearing.z;
    const localX = dx * Math.cos(clearing.yaw) - dz * Math.sin(clearing.yaw);
    const localZ = dx * Math.sin(clearing.yaw) + dz * Math.cos(clearing.yaw);
    return (localX / clearing.radiusX) ** 2 + (localZ / clearing.radiusZ) ** 2 <= 1;
  });
}

export function distanceToPath(x: number, z: number, path: AuthoredWorld["paths"][number]) {
  if (x < path.bounds[0] || z < path.bounds[1] || x > path.bounds[2] || z > path.bounds[3]) return Infinity;
  let best = Infinity;
  for (let i = 1; i < path.spine.length; i++) {
    const [ax, az] = path.spine[i - 1], [bx, bz] = path.spine[i];
    const dx = bx - ax, dz = bz - az, lengthSq = dx * dx + dz * dz;
    const t = lengthSq ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengthSq)) : 0;
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

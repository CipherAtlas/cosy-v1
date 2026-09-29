import * as T from "three";

export type WorldPoint = [number, number];
export type ResidentId = "pip" | "maple" | "moss" | "luma" | "wren";
export const RESIDENT_IDS: ResidentId[] = ["pip", "maple", "moss", "luma", "wren"];
export type ResidentRoute = { points: WorldPoint[]; pauses?: number[] };
export type PuppyBreed = "corgi" | "shiba" | "beagle" | "samoyed";
export type PuppyPlacement = { id: string; name: string; breed: PuppyBreed; x: number; y: number; z: number; yaw: number; scale: [number, number, number] };
export type AuthoredWorld = {
  paths: { id: string; points: WorldPoint[]; spine: WorldPoint[]; bounds: [number, number, number, number]; width: number; straight: boolean }[];
  fences: { id: string; points: WorldPoint[]; height: number }[];
  structures: Record<string, { x: number; y: number; z: number; yaw: number }>;
  grass: { id: string; x: number; z: number; radiusX: number; radiusZ: number; yaw: number; heightScale: number; count: number }[];
  clearings: { x: number; z: number; radiusX: number; radiusZ: number; yaw: number }[];
  walkable: { id: string; x: number; z: number; radiusX: number; radiusZ: number; yaw: number }[];
  trees: { id: string; x: number; z: number; y: number; rotation: [number, number, number]; scale: [number, number, number] }[];
  benches: { id: string; x: number; y: number; z: number; yaw: number; scale: [number, number, number] }[];
  puppies: PuppyPlacement[];
  routes: Partial<Record<ResidentId, ResidentRoute>>;
};

type WorldItem = {
  id: string; asset: string; name?: string; position: [number, number, number]; rotation: [number, number, number];
  scale: [number, number, number]; visible: boolean; path?: { points: WorldPoint[]; width: number };
};
type WorldLayout = { version: number; base: string; objects: WorldItem[]; routes?: Partial<Record<ResidentId, ResidentRoute>> };

const finite = (value: number) => Number.isFinite(value) && Math.abs(value) <= 2000;
export function projectWorldLayout(source: unknown): AuthoredWorld {
  const layout = source as WorldLayout;
  if (!layout || layout.version !== 1 || layout.base !== "cosy-village-2026-09-27" || !Array.isArray(layout.objects))
    throw Error("The playable world layout has an unsupported format.");
  const result: AuthoredWorld = { paths: [], fences: [], structures: {}, grass: [], clearings: [], walkable: [], trees: [], benches: [], puppies: [], routes: {} };
  for (const item of layout.objects) {
    if (!item?.visible || !Array.isArray(item.position) || !Array.isArray(item.rotation) || !Array.isArray(item.scale)) continue;
    const [x, y, z] = item.position;
    if (![x, y, z, ...item.rotation, ...item.scale].every(finite)) throw Error(`Invalid transform in ${item.id}.`);
    if (item.path && ["custom-path", "path-straight", "path-curved"].includes(item.asset)) {
      const angle = item.rotation[1] * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
      const points = item.path.points.map(([px, pz]): WorldPoint => [x + px * item.scale[0] * c + pz * item.scale[2] * s, z - px * item.scale[0] * s + pz * item.scale[2] * c]);
      if (points.some(point => !point.every(finite))) throw Error(`Invalid path points in ${item.id}.`);
      const straight = item.asset === "path-straight";
      const spine: WorldPoint[] = straight ? points : new T.CatmullRomCurve3(points.map(([px, pz]) => new T.Vector3(px, 0, pz)))
        .getPoints(Math.max(32, (points.length - 1) * 16)).map(p => [p.x, p.z]);
      const width = item.path.width * Math.max(item.scale[0], item.scale[2]);
      const xs = spine.map(p => p[0]), zs = spine.map(p => p[1]);
      result.paths.push({ id: item.id, points, spine, bounds: [Math.min(...xs) - width, Math.min(...zs) - width, Math.max(...xs) + width, Math.max(...zs) + width], width, straight });
    }
    if (item.asset === "fence-line" && item.path) {
      const angle = item.rotation[1] * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
      const points = item.path.points.map(([px, pz]): WorldPoint => [x + px * item.scale[0] * c + pz * item.scale[2] * s, z - px * item.scale[0] * s + pz * item.scale[2] * c]);
      if (points.some(point => !point.every(finite))) throw Error(`Invalid fence points in ${item.id}.`);
      result.fences.push({ id: item.id, points, height: item.path.width * item.scale[1] });
    }
    if ((["cottage-1", "cottage-2", "cottage-3", "cottage-4", "cottage-7", "cottage-8", "cottage-9", "tower"] as string[]).includes(item.asset))
      result.structures[item.asset] = { x, y, z, yaw: item.rotation[1] * Math.PI / 180 };
    if (["grass-tuft", "grass-patch", "grass-wide"].includes(item.asset)) {
      const size = item.asset === "grass-tuft" ? 1 : item.asset === "grass-patch" ? 6 : 14;
      const count = item.asset === "grass-tuft" ? 18 : item.asset === "grass-patch" ? 520 : 2400;
      result.grass.push({ id: item.id, x, z, radiusX: size * item.scale[0] / 2, radiusZ: size * item.scale[2] / 2, yaw: item.rotation[1] * Math.PI / 180, heightScale: item.scale[1], count });
    }
    if (item.asset === "planting-clearance") result.clearings.push({ x, z, radiusX: item.scale[0], radiusZ: item.scale[2], yaw: item.rotation[1] * Math.PI / 180 });
    if (item.asset === "walkable-region") result.walkable.push({ id: item.id, x, z, radiusX: 12 * item.scale[0], radiusZ: 12 * item.scale[2], yaw: item.rotation[1] * Math.PI / 180 });
    if (/^tree-\d+$/.test(item.asset)) result.trees.push({ id: item.id, x, y, z, rotation: item.rotation.map(value => value * Math.PI / 180) as [number, number, number], scale: item.scale });
    if (item.asset === "oak-bench") result.benches.push({ id: item.id, x, y, z, yaw: item.rotation[1] * Math.PI / 180, scale: item.scale });
    if (item.asset.startsWith("puppy-")) {
      const breed = item.asset.slice(6);
      if (["corgi", "shiba", "beagle", "samoyed"].includes(breed))
        result.puppies.push({ id: item.id, name: item.name?.slice(0, 100) || breed, breed: breed as PuppyBreed, x, y, z,
          yaw: item.rotation[1] * Math.PI / 180, scale: item.scale });
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

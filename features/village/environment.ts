import { layoutLocalPoint, layoutWorldPoint } from "./layoutTransforms";
import type { Weather } from "./places";
import { distanceToPath, type AuthoredWorld } from "./worldLayout";
import { baseGroundHeight, hasTerrainEditsAt, sampleTerrainHeight, TERRAIN_LIMIT } from "./terrain";

export type ActivityMoment =
  | { kind: "focus"; running: boolean; progress: number }
  | { kind: "music"; playing: boolean }
  | { kind: "breathe"; active: boolean; amount: number }
  | { kind: "tea" | "write" | "save" | "letter" | "keep" };

export type Surface = "stone" | "wood" | "soil" | "grass";
export type WorldContact = {
  kind: "footstep" | "takeoff" | "landing";
  position: [number, number, number];
  surface: Surface;
  speed: number;
  impact: number;
  foot: "left" | "right";
};
export type MovementStatus = {
  gait: "idle" | "walk" | "run" | "sprint" | "air";
  running: boolean;
};
export type EnvironmentFrame = {
  listener: [number, number, number];
  forward: [number, number, number];
  wind: number;
  weather: Weather;
  sheltered: boolean;
};
export type Collider = {
  x: number;
  z: number;
  w: number;
  d: number;
  bottom?: number;
  top?: number;
};

export const riverX = (z: number) => -11 + Math.sin(z * 0.052) * 3;
export const roadX = (z: number) => Math.sin(z * 0.048) * 2;
export const HEARTH = { x: -5.8, z: -19, radius: 1, pavingRadius: 3.6, pavingHeight: .14 };
export const BRIDGE = { x: riverX(3), z: 3, length: 12, width: 3.3, approachOpening: 1.8, collisionMargin: .08 };
// Continuous footprints include the coping, end posts and a little body clearance.
export const BRIDGE_BARRIERS: Collider[] = [-1, 1].map(side => ({
  x: BRIDGE.x, z: BRIDGE.z + side * (BRIDGE.width / 2 + .22),
  w: BRIDGE.length - BRIDGE.approachOpening * 2 + .16 + BRIDGE.collisionMargin * 2,
  d: .64 + BRIDGE.collisionMargin * 2,
}));
export const POND = { x: -27, z: -14, rx: 9, rz: 12, y: -.3 };
export const POND_DOCK = { x: -21.65, z: -5.5, w: 5.5, d: 2.2 };
export const BIRD_CLEARING = { x: -37, z: 4, radius: 3.8, benchZ: 6.5, feedingPerimeter: 7 };
let authoredWorld: AuthoredWorld = { paths: [], fences: [], structures: {}, grass: [], clearings: [], walkable: [], trees: [], benches: [], swings: [], crumbPouches: [], puppies: [], routes: {} };
let sceneItems = new Map<string, NonNullable<AuthoredWorld["items"]>>();
let sceneBridgeBarriers = BRIDGE_BARRIERS;
export function setAuthoredWorld(world: AuthoredWorld) {
  authoredWorld = world; sceneItems = new Map();
  if (world.sceneVersion === 1) for (const item of world.items ?? []) {
    if (!item.visible) continue;
    const entries = sceneItems.get(item.asset) ?? []; entries.push(item); sceneItems.set(item.asset, entries);
  }
  sceneBridgeBarriers = world.sceneVersion !== 1 ? BRIDGE_BARRIERS : (sceneItems.get("bridge") ?? []).flatMap(item => BRIDGE_BARRIERS.map(barrier => {
    const corners = [-1, 1].flatMap(sx => [-1, 1].map(sz => layoutWorldPoint(item,
      [barrier.x + sx * barrier.w / 2, 0, barrier.z + sz * barrier.d / 2], [BRIDGE.x, 0, BRIDGE.z])));
    const xs = corners.map(point => point[0]), zs = corners.map(point => point[2]);
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2,
      w: Math.max(...xs) - Math.min(...xs), d: Math.max(...zs) - Math.min(...zs) };
  }));
}
export function bridgeBarriers() { return sceneBridgeBarriers; }
function placements(asset: string, pivot: readonly number[]) {
  if (authoredWorld.sceneVersion === 1) return sceneItems.get(asset) ?? [];
  return [{ id: asset, asset, visible: true, position: [...pivot] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] }];
}
export function hasEditedTerrain(x: number, z: number) { return hasTerrainEditsAt(authoredWorld.terrain, x, z); }
export function inWalkableWorld(x: number, z: number) {
  if (Math.abs(x) > TERRAIN_LIMIT || Math.abs(z) > TERRAIN_LIMIT) return false;
  if (authoredWorld.openWorld) return true;
  if (Math.abs(x) <= 40 && z >= -48 && z <= 42) return true;
  return authoredWorld.walkable.some(area => {
    const dx = x - area.x, dz = z - area.z, c = Math.cos(area.yaw), s = Math.sin(area.yaw);
    return Math.hypot((dx * c - dz * s) / area.radiusX, (dx * s + dz * c) / area.radiusZ) <= 1;
  });
}

export function inRiver(x: number, z: number) {
  return (authoredWorld.rivers ?? []).some(river => distanceToPath(x, z, river) < river.width / 2 + .32) || placements("river", [0, 0, 0]).some(item => {
    const [px, pz] = layoutLocalPoint(item, x, z, [0, 0, 0]);
    return (!authoredWorld.openWorld || Math.abs(pz) <= 110) && Math.abs(px - riverX(pz)) < 3.6;
  });
}
export function pondDistance(x: number, z: number) {
  return Math.min(...placements("pond", [POND.x, 0, POND.z]).map(item => {
    const [px, pz] = layoutLocalPoint(item, x, z, [POND.x, 0, POND.z]);
    return Math.hypot((px - POND.x) / POND.rx, (pz - POND.z) / POND.rz);
  }));
}
export function onPondDock(x: number, z: number) {
  return placements("dock", [POND_DOCK.x, 0, POND_DOCK.z]).some(item => {
    const [px, pz] = layoutLocalPoint(item, x, z, [POND_DOCK.x, 0, POND_DOCK.z]);
    return Math.abs(px - POND_DOCK.x) <= POND_DOCK.w / 2 && Math.abs(pz - POND_DOCK.z) <= POND_DOCK.d / 2;
  });
}
export function dockHeight(x: number) {
  return .24 * Math.max(0, Math.min(1, (POND_DOCK.x + POND_DOCK.w / 2 - x) / .7));
}
export function bridgeHeight(x: number) {
  const t = Math.max(0, Math.min(1, (x - BRIDGE.x) / BRIDGE.length + 0.5));
  return 0.08 + Math.sin(t * Math.PI) ** 2 * 1.1;
}
export function groundY(x: number, z: number) {
  return baseGroundHeight(x, z);
}
export function landscapeHeight(x: number, z: number) {
  if (authoredWorld.sceneVersion !== 1) return sampleTerrainHeight(authoredWorld.terrain, x, z);
  const ground = (sceneItems.get("terrain") ?? []).map(item => {
    const [px, pz] = layoutLocalPoint(item, x, z, [0, 0, 0]);
    return item.position[1] + sampleTerrainHeight(authoredWorld.terrain, px, pz) * item.scale[1];
  });
  for (const asset of ["land-tile-20", "land-tile-40", "meadow-island", "land-hill"]) for (const item of sceneItems.get(asset) ?? []) {
    const [px, pz] = layoutLocalPoint(item, x, z, [0, 0, 0]);
    if (asset.startsWith("land-tile-") && Math.max(Math.abs(px), Math.abs(pz)) <= Number(asset.split("-").at(-1)) / 2) ground.push(item.position[1]);
    if (asset === "meadow-island" && Math.hypot(px, pz) <= 12) ground.push(item.position[1]);
    if (asset === "land-hill" && Math.max(Math.abs(px), Math.abs(pz)) <= 12) ground.push(item.position[1] + Math.cos(Math.min(1, Math.hypot(px, pz) / 12) * Math.PI / 2) ** 2 * 4 * item.scale[1]);
  }
  return Math.max(0, ...ground);
}
export function onBridge(x: number, z: number) {
  return placements("bridge", [BRIDGE.x, 0, BRIDGE.z]).some(item => {
    const [px, pz] = layoutLocalPoint(item, x, z, [BRIDGE.x, 0, BRIDGE.z]);
    return Math.abs(px - BRIDGE.x) <= BRIDGE.length / 2 && Math.abs(pz - BRIDGE.z) <= BRIDGE.width / 2;
  });
}
export function surfaceAt(x: number, z: number): Surface {
  if (Math.hypot(x - BIRD_CLEARING.x, z - BIRD_CLEARING.z) < BIRD_CLEARING.radius) return "stone";
  if (Math.hypot((x + 24) / 3.8, (z + 29.5) / 3.2) < 1) return "stone";
  if (Math.hypot(x - HEARTH.x, z - HEARTH.z) < HEARTH.pavingRadius) return "stone";
  if (onPondDock(x, z)) return "wood";
  if (onBridge(x, z) || Math.abs(x - roadX(z)) < 1.75 || (Math.abs(z - 3) < 1.25 && x < 1)) return "stone";
  if (authoredWorld.paths.some(path => distanceToPath(x, z, path) < path.width / 2)) return "stone";
  if (Math.abs(x - roadX(z)) < 2.4) return "soil";
  return "grass";
}
export function floorHeight(x: number, z: number) {
  if (Math.hypot(x - BIRD_CLEARING.x, z - BIRD_CLEARING.z) < BIRD_CLEARING.radius) return .1;
  if (Math.hypot((x + 24) / 3.8, (z + 29.5) / 3.2) < 1)
    return Math.max(landscapeHeight(x + 39.5, z + 19.1), 0) + .10067727470825035;
  if (Math.hypot(x - HEARTH.x, z - HEARTH.z) < HEARTH.pavingRadius) return HEARTH.pavingHeight;
  if (onBridge(x, z)) return Math.max(...placements("bridge", [BRIDGE.x, 0, BRIDGE.z]).map(item => {
    const [px, pz] = layoutLocalPoint(item, x, z, [BRIDGE.x, 0, BRIDGE.z]);
    return Math.abs(px - BRIDGE.x) <= BRIDGE.length / 2 && Math.abs(pz - BRIDGE.z) <= BRIDGE.width / 2 ? item.position[1] + bridgeHeight(px) * item.scale[1] : -Infinity;
  }));
  if (surfaceAt(x, z) === "wood") return Math.max(...placements("dock", [POND_DOCK.x, 0, POND_DOCK.z]).map(item => {
    const [px] = layoutLocalPoint(item, x, z, [POND_DOCK.x, 0, POND_DOCK.z]);
    return item.position[1] + dockHeight(px) * item.scale[1];
  }));
  return Math.max(landscapeHeight(x, z), surfaceAt(x, z) === "stone" ? 0.05 : 0);
}
export function windAt(time: number, weather: Weather) {
  const slow = Math.sin(time * 0.23) * 0.5 + 0.5;
  const gust = Math.max(0, Math.sin(time * 0.61 - 0.7)) ** 3;
  return (weather === "rain" ? 0.5 : 0.22) + slow * 0.18 + gust * 0.34;
}

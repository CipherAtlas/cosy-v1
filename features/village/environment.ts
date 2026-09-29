import type { Weather } from "./places";
import { distanceToPath, type AuthoredWorld } from "./worldLayout";

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
export const BRIDGE = { x: riverX(3), z: 3, length: 12, width: 3.3, northEastOpening: 1.8 };
export const POND = { x: -27, z: -14, rx: 9, rz: 12, y: -.3 };
export const POND_DOCK = { x: -21.65, z: -5.5, w: 5.5, d: 2.2 };
export const BIRD_CLEARING = { x: -37, z: 4, radius: 3.8, benchZ: 6.5 };
let authoredWorld: AuthoredWorld = { paths: [], fences: [], structures: {}, grass: [], clearings: [], walkable: [], trees: [], benches: [], puppies: [], routes: {} };
export function setAuthoredWorld(world: AuthoredWorld) { authoredWorld = world; }
export function inWalkableWorld(x: number, z: number) {
  if (Math.abs(x) <= 40 && z >= -48 && z <= 42) return true;
  return authoredWorld.walkable.some(area => {
    const dx = x - area.x, dz = z - area.z, c = Math.cos(area.yaw), s = Math.sin(area.yaw);
    return Math.hypot((dx * c - dz * s) / area.radiusX, (dx * s + dz * c) / area.radiusZ) <= 1;
  });
}

export function pondDistance(x: number, z: number) {
  return Math.hypot((x - POND.x) / POND.rx, (z - POND.z) / POND.rz);
}
export function onPondDock(x: number, z: number) {
  return Math.abs(x - POND_DOCK.x) <= POND_DOCK.w / 2 && Math.abs(z - POND_DOCK.z) <= POND_DOCK.d / 2;
}
export function dockHeight(x: number) {
  return .24 * Math.max(0, Math.min(1, (POND_DOCK.x + POND_DOCK.w / 2 - x) / .7));
}
export function bridgeHeight(x: number) {
  const t = Math.max(0, Math.min(1, (x - BRIDGE.x) / BRIDGE.length + 0.5));
  return 0.08 + Math.sin(t * Math.PI) ** 2 * 1.1;
}
export function groundY(x: number, z: number) {
  const river = Math.abs(x - riverX(z));
  const pond = pondDistance(x, z);
  return Math.min(river < 4 ? -0.85 + river * 0.15 : 0, pond < 1 ? -.72 : 0)
    + Math.sin(x * 0.18) * Math.sin(z * 0.12) * 0.08;
}
export function landscapeHeight(x: number, z: number) {
  const distance = Math.hypot(x, z);
  const rise = Math.max(0, Math.min(1, (distance - 43) / 48));
  return groundY(x, z) + rise * (5 + Math.sin(x * .038) * Math.cos(z * .032) * 5
    + Math.sin(x * .073 + z * .041) * 2.2 + Math.sin(z * .019 - x * .012) * 4);
}
export function onBridge(x: number, z: number) {
  return Math.abs(x - BRIDGE.x) <= BRIDGE.length / 2 && Math.abs(z - BRIDGE.z) <= BRIDGE.width / 2;
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
  if (onBridge(x, z)) return bridgeHeight(x);
  if (surfaceAt(x, z) === "wood") return dockHeight(x);
  return Math.max(landscapeHeight(x, z), surfaceAt(x, z) === "stone" ? 0.05 : 0);
}
export function windAt(time: number, weather: Weather) {
  const slow = Math.sin(time * 0.23) * 0.5 + 0.5;
  const gust = Math.max(0, Math.sin(time * 0.61 - 0.7)) ** 3;
  return (weather === "rain" ? 0.5 : 0.22) + slow * 0.18 + gust * 0.34;
}

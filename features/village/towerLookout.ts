import type { AuthoredWorld } from "./worldLayout";

export const LOOKOUT_HEIGHT = 11.4;
export const LOOKOUT_CAPACITY = 8;
export const LOOKOUT_RADIUS = 2.7;
export const LOOKOUT_WALK_RADIUS = 3.05;

export function towerLookout(layout: AuthoredWorld) {
  const tower = layout.structures.tower;
  if (!tower) return null;
  const point = (x: number, y: number, z: number): [number, number, number] => [
    tower.x + x * Math.cos(tower.yaw) + z * Math.sin(tower.yaw), tower.y + y,
    tower.z - x * Math.sin(tower.yaw) + z * Math.cos(tower.yaw),
  ];
  return {
    entrance: point(0, 0, 3.5),
    constrain: (x: number, z: number): [number, number, number] => {
      const dx = x - tower.x, dz = z - tower.z;
      const scale = Math.min(1, LOOKOUT_WALK_RADIUS / Math.max(Math.hypot(dx, dz), .00001));
      return [tower.x + dx * scale, tower.y + LOOKOUT_HEIGHT, tower.z + dz * scale];
    },
    position: (index: number) => {
      const angle = index * Math.PI * 2 / LOOKOUT_CAPACITY;
      return point(Math.sin(angle) * LOOKOUT_RADIUS, LOOKOUT_HEIGHT, Math.cos(angle) * LOOKOUT_RADIUS);
    },
  };
}

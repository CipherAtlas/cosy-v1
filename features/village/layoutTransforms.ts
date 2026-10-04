import type { WorldItem } from "./worldLayout";

export function layoutLocalPoint(item: WorldItem, x: number, z: number, pivot: readonly number[]) {
  const yaw = item.rotation[1] * Math.PI / 180, c = Math.cos(yaw), s = Math.sin(yaw);
  const dx = x - item.position[0], dz = z - item.position[2];
  return [pivot[0] + (dx * c - dz * s) / item.scale[0], pivot[2] + (dx * s + dz * c) / item.scale[2]];
}

export function layoutWorldPoint(item: WorldItem, point: readonly number[], pivot: readonly number[]): [number, number, number] {
  const yaw = item.rotation[1] * Math.PI / 180, c = Math.cos(yaw), s = Math.sin(yaw);
  const x = (point[0] - pivot[0]) * item.scale[0], z = (point[2] - pivot[2]) * item.scale[2];
  return [item.position[0] + x * c + z * s, item.position[1] + (point[1] - pivot[1]) * item.scale[1], item.position[2] - x * s + z * c];
}

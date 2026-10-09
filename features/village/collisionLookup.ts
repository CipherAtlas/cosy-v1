import type { Collider } from "./environment";

const CELL = 8;
const lookups = new WeakMap<Collider[], { count: number; radius: number; cells: Map<string, Collider[]> }>();

/** Layout solids are fixed for the lifetime of a movement controller. Share their broad phase. */
export function collisionLookup(colliders: Collider[], radius: number) {
  let lookup = lookups.get(colliders);
  if (!lookup || lookup.count !== colliders.length || lookup.radius !== radius) {
    const cells = new Map<string, Collider[]>();
    for (const collider of colliders) {
      const yaw = (collider as Collider & { yaw?: number }).yaw ?? 0;
      const cosine = Math.abs(Math.cos(yaw)), sine = Math.abs(Math.sin(yaw));
      const width = Math.max(collider.w / 2, cosine * collider.w / 2 + sine * collider.d / 2) + radius;
      const depth = Math.max(collider.d / 2, sine * collider.w / 2 + cosine * collider.d / 2) + radius;
      for (let x = Math.floor((collider.x - width) / CELL); x <= Math.floor((collider.x + width) / CELL); x++) {
        for (let z = Math.floor((collider.z - depth) / CELL); z <= Math.floor((collider.z + depth) / CELL); z++) {
          const key = `${x},${z}`, items = cells.get(key);
          if (items) items.push(collider);
          else cells.set(key, [collider]);
        }
      }
    }
    lookup = { count: colliders.length, radius, cells }; lookups.set(colliders, lookup);
  }
  return lookup.cells;
}

export function nearbyColliders(cells: Map<string, Collider[]>, x: number, z: number, radius = 0) {
  if (radius === 0) return cells.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? [];
  const nearby = new Set<Collider>();
  for (let gx = Math.floor((x - radius) / CELL); gx <= Math.floor((x + radius) / CELL); gx++)
    for (let gz = Math.floor((z - radius) / CELL); gz <= Math.floor((z + radius) / CELL); gz++)
      for (const collider of cells.get(`${gx},${gz}`) ?? []) nearby.add(collider);
  return [...nearby];
}

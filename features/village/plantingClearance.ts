import * as T from "three";

/** Actual transformed paving and water, including captured native paths and moved courtyards. */
export class PlantingSurfaceMask {
  private readonly cells = new Map<string, number[][]>();
  private readonly cellSize = 2;

  constructor(group: T.Object3D, surface?: "paving" | "water", coreOnly = false) {
    group.updateMatrixWorld(true);
    const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
    group.traverseVisible(object => {
      if (!(object instanceof T.Mesh) || !object.geometry.userData.plantingSurface || (surface && object.geometry.userData.plantingSurface !== surface)) return;
      const positions = object.geometry.getAttribute("position"), indices = object.geometry.index;
      const count = indices?.count ?? positions.count;
      for (let i = 0; i < count; i += 3) {
        const colors = object.geometry.attributes.color;
        if (coreOnly && colors && [0, 1, 2].some(offset => colors.getX(indices ? indices.getX(i + offset) : i + offset) < .6)) continue;
        a.fromBufferAttribute(positions, indices ? indices.getX(i) : i).applyMatrix4(object.matrixWorld);
        b.fromBufferAttribute(positions, indices ? indices.getX(i + 1) : i + 1).applyMatrix4(object.matrixWorld);
        c.fromBufferAttribute(positions, indices ? indices.getX(i + 2) : i + 2).applyMatrix4(object.matrixWorld);
        if (Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) < 1e-9) continue;
        const triangle = [a.x, a.z, b.x, b.z, c.x, c.z];
        for (let x = Math.floor(Math.min(a.x, b.x, c.x) / this.cellSize); x <= Math.floor(Math.max(a.x, b.x, c.x) / this.cellSize); x++) {
          for (let z = Math.floor(Math.min(a.z, b.z, c.z) / this.cellSize); z <= Math.floor(Math.max(a.z, b.z, c.z) / this.cellSize); z++) {
            const key = `${x},${z}`;
            const cell = this.cells.get(key);
            if (cell) cell.push(triangle); else this.cells.set(key, [triangle]);
          }
        }
      }
    });
  }

  covers(x: number, z: number, radius = 0) {
    const edgeDistance = (ax: number, az: number, bx: number, bz: number) => {
      const dx = bx - ax, dz = bz - az, length = dx * dx + dz * dz;
      const t = length ? T.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / length, 0, 1) : 0;
      return (x - ax - t * dx) ** 2 + (z - az - t * dz) ** 2;
    };
    for (let cx = Math.floor((x - radius) / this.cellSize); cx <= Math.floor((x + radius) / this.cellSize); cx++) {
      for (let cz = Math.floor((z - radius) / this.cellSize); cz <= Math.floor((z + radius) / this.cellSize); cz++) {
        for (const [ax, az, bx, bz, dx, dz] of this.cells.get(`${cx},${cz}`) ?? []) {
          const ab = (bx - ax) * (z - az) - (bz - az) * (x - ax);
          const bc = (dx - bx) * (z - bz) - (dz - bz) * (x - bx);
          const ca = (ax - dx) * (z - dz) - (az - dz) * (x - dx);
          if ((ab >= 0 && bc >= 0 && ca >= 0) || (ab <= 0 && bc <= 0 && ca <= 0)) return true;
          if (radius > 0 && Math.min(edgeDistance(ax, az, bx, bz), edgeDistance(bx, bz, dx, dz), edgeDistance(dx, dz, ax, az)) <= radius * radius) return true;
        }
      }
    }
    return false;
  }
}

/** Keep grass-coloured shoulders from covering the paving at overlapping path junctions. */
export function blendPavingJunctions(group: T.Object3D) {
  group.traverse(object => {
    if (!(object instanceof T.Mesh) || object.geometry.userData.plantingSurface !== "paving" || !object.geometry.attributes.color) return;
    const colors = object.geometry.attributes.color;
    const base = object.geometry.userData.pavingBaseColors ?? Array.from(colors.array);
    object.geometry.userData.pavingBaseColors = base;
    colors.array.set(base);
  });
  const paving = new PlantingSurfaceMask(group, "paving", true), point = new T.Vector3();
  group.traverse(object => {
    if (!(object instanceof T.Mesh) || object.geometry.userData.plantingSurface !== "paving" || !object.geometry.attributes.color) return;
    const colors = object.geometry.attributes.color, positions = object.geometry.attributes.position;
    for (let i = 0; i < colors.count; i++) {
      if (colors.getX(i) >= 1) continue;
      point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
      if (paving.covers(point.x, point.z)) colors.setX(i, 1);
    }
    colors.needsUpdate = true;
  });
}

/** Includes the whole blade/leaf silhouette and wind, rather than checking its root alone. */
export function plantingRadius(geometry: T.BufferGeometry, transform: T.Matrix4) {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!, m = transform.elements;
  let radius = 0;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    radius = Math.max(radius, Math.hypot(m[0] * x + m[4] * y + m[8] * z, m[2] * x + m[6] * y + m[10] * z));
  }
  const scale = Math.max(Math.hypot(m[0], m[2]), Math.hypot(m[8], m[10]));
  // Paired flower stems and heads use the same footprint so neither is left floating.
  return Math.max(radius, (geometry.userData.plantingRadius ?? 0) * scale) + (geometry.userData.plantingSway ?? 0) * scale;
}

export function clearSurfacePlanting(group: T.Object3D, plants: T.InstancedMesh[]) {
  const surfaces = new PlantingSurfaceMask(group), local = new T.Matrix4(), world = new T.Matrix4();
  const paving = plants.some(mesh => mesh.userData.bankPlant) ? new PlantingSurfaceMask(group, "paving") : surfaces;
  const zero = new T.Vector3(0, 0, 0);
  for (const mesh of plants) {
    if (!mesh.geometry.userData.groundPlant && !mesh.userData.bankPlant) continue;
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, local);
      world.multiplyMatrices(mesh.matrixWorld, local);
      if ((mesh.userData.bankPlant ? paving : surfaces).covers(world.elements[12], world.elements[14], plantingRadius(mesh.geometry, world))) mesh.setMatrixAt(i, local.scale(zero));
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  }
}

/** Keep complete decorative flowers together, restoring them when editor paving moves away. */
export function clearPavingBorders(group: T.Object3D, paving = new PlantingSurfaceMask(group, "paving")) {
  group.updateMatrixWorld(true);
  group.traverse(object => {
    if (!object.userData.pavingBorder) return;
    const m = object.matrixWorld.elements;
    const radius = object.userData.pavingBorderRadius * Math.max(Math.hypot(m[0], m[2]), Math.hypot(m[8], m[10]));
    object.visible = !paving.covers(m[12], m[14], radius);
  });
}

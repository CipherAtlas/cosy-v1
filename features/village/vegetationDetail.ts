import * as T from "three";
import { optimizeGeometry } from "./geometryOptimization";

const distantGeometry = new WeakMap<T.BufferGeometry, T.BufferGeometry>();

export async function registerPlantDetail(meshes: T.InstancedMesh[]) {
  const geometries = new Set(meshes.map(mesh => mesh.geometry));
  await Promise.all([...geometries].map(async geometry => {
    if (distantGeometry.has(geometry) || (geometry.index?.count ?? 0) < 600) return;
    const distant = geometry.clone();
    await optimizeGeometry(distant, .02);
    if (distant.index!.count < geometry.index!.count) distantGeometry.set(geometry, distant);
    else distant.dispose();
  }));
}

/** The same blade tips, colors and wind; distant blades need only their outer contour. */
export function registerGrassDetail(geometry: T.BufferGeometry) {
  const distant = geometry.clone(), indices: number[] = [];
  for (let blade = 0; blade < 3; blade++) {
    const base = blade * 8;
    indices.push(base, base + 6, base + 1, base + 1, base + 6, base + 7);
  }
  distant.setIndex(indices); distantGeometry.set(geometry, distant);
}

export class VegetationDetail {
  private readonly entries: { mesh: T.InstancedMesh; detailed: T.BufferGeometry; distant: T.BufferGeometry }[] = [];
  private readonly center = new T.Vector3();

  constructor(meshes: T.InstancedMesh[]) {
    for (const mesh of meshes) {
      const distant = distantGeometry.get(mesh.geometry);
      if (distant) this.entries.push({ mesh, detailed: mesh.geometry, distant });
    }
  }

  update(camera: T.Camera) {
    for (const { mesh, detailed, distant } of this.entries) {
      const sphere = mesh.boundingSphere;
      if (!sphere) continue;
      this.center.copy(sphere.center).applyMatrix4(mesh.matrixWorld);
      const distance = this.center.distanceTo(camera.position) - sphere.radius * mesh.matrixWorld.getMaxScaleOnAxis();
      // Hysteresis keeps a cell from changing geometry repeatedly at the boundary.
      mesh.geometry = distance > (mesh.geometry === distant ? 14 : 18) ? distant : detailed;
    }
  }

  dispose() {
    const distant = new Set<T.BufferGeometry>();
    for (const entry of this.entries) { entry.mesh.geometry = entry.detailed; distant.add(entry.distant); }
    distant.forEach(geometry => geometry.dispose());
  }
}

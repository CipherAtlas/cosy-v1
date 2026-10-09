import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { optimizeGeometry } from "./geometryOptimization";
import { registerPlantDetail, VegetationDetail } from "./vegetationDetail";
import { TOWN_GROW_MS, townPoint, type TownBed, type TownCrop } from "./townShared";
import type { WorldItem } from "./worldLayout";

/** Row-sized bounds keep distant farms out of both the view and shadow submissions. */
export class TownCropRendering {
  readonly group = new T.Group();
  private readonly geometry = new Set<T.BufferGeometry>();
  private readonly plants: { row: WorldItem; crop: TownCrop | "sprout"; mesh: T.InstancedMesh }[] = [];
  private readonly dummy = new T.Object3D();
  private detail?: VegetationDetail;
  private readonly cropsPerRow = 28;

  constructor(rows: WorldItem[], source: T.Object3D) {
    this.group.name = "Shared farm crops"; source.updateMatrixWorld(true);
    let material: T.Material | undefined;
    source.getObjectByName("Carrot")?.traverse(object => { if (object instanceof T.Mesh) material = Array.isArray(object.material) ? object.material[0] : object.material; });
    if (!material) throw Error("The original garden crop kit is missing.");
    for (const [crop, model] of [["carrot", "Carrot"], ["radish", "Radish"], ["mint", "Mint"], ["sprout", "Sprout"]] as const) {
      const template = source.getObjectByName(model);
      if (!template) throw Error(`Farm crop missing from the garden kit: ${model}.`);
      const parts: T.BufferGeometry[] = [];
      template.traverse(object => { if (object instanceof T.Mesh) parts.push(object.geometry.clone().applyMatrix4(object.matrixWorld)); });
      const geometry = mergeGeometries(parts, false); parts.forEach(part => part.dispose());
      if (!geometry) throw Error(`The ${crop} farm crop could not be prepared.`);
      this.geometry.add(geometry);
      for (const row of rows) {
        const mesh = new T.InstancedMesh(geometry, material, this.cropsPerRow);
        mesh.name = `${row.id} ${crop}`; mesh.userData.gardenPlant = true;
        mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.castShadow = mesh.receiveShadow = true; mesh.visible = false;
        this.plants.push({ row, crop, mesh }); this.group.add(mesh);
      }
    }
  }

  async prepare(signal?: AbortSignal) {
    await Promise.all([...this.geometry].map(geometry => optimizeGeometry(geometry, .002, signal)));
    const meshes = this.plants.map(plant => plant.mesh);
    await registerPlantDetail(meshes, signal);
    if (signal?.aborted) throw signal.reason;
    meshes.forEach(mesh => mesh.computeBoundingSphere());
    this.detail = new VegetationDetail(meshes);
  }

  update(beds: TownBed[], time: number) {
    const states = new Map(beds.map(bed => [bed.id, bed]));
    for (const { row, crop, mesh } of this.plants) {
      const state = states.get(row.id), sprouting = Boolean(state?.crop) && state?.wateredAt === null;
      mesh.visible = crop === "sprout" ? sprouting : state?.crop === crop && !sprouting;
      if (!mesh.visible) continue;
      const progress = state?.growAt === null || state?.growAt === undefined || state.wateredAt === null ? 0 : T.MathUtils.clamp(1 - (state.growAt - time) / TOWN_GROW_MS, 0, 1);
      const growth = crop === "sprout" ? 1 : .18 + .82 * progress;
      for (let i = 0; i < this.cropsPerRow; i++) {
        const x = -7.25 + Math.floor(i / 2) * (14.5 / (this.cropsPerRow / 2 - 1)), z = (i % 2 - .5) * .57;
        const point = townPoint(row, x, z); this.dummy.position.set(point[0], row.position[1] + .19 * row.scale[1], point[1]);
        this.dummy.rotation.set(0, row.rotation[1] * Math.PI / 180 + Math.sin(i * 7.3) * .3, 0);
        this.dummy.scale.set(row.scale[0], row.scale[1] * growth, row.scale[2]); this.dummy.updateMatrix(); mesh.setMatrixAt(i, this.dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
    }
  }

  updateDetail(camera: T.Camera) { this.detail?.update(camera); }
  hide() { this.plants.forEach(({ mesh }) => { mesh.visible = false; }); }
  dispose() {
    this.detail?.dispose(); this.geometry.forEach(geometry => geometry.dispose());
    this.plants.forEach(({ mesh }) => mesh.dispose());
  }
}

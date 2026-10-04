import * as T from "three";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { landscapeHeight, type Collider } from "./environment";
import { conformFenceGeometry, fenceCollisionBoxes } from "./fenceGeometry";
import type { AuthoredWorld, WorldItem } from "./worldLayout";
import type { VillageBench, WorldLayoutCapture } from "./world";

export const INSTANCE_LAYERS = ["tree", "forest", "willow", "bushes"];

/** Applies the same captured asset pivots used by the local studio before renderer batching. */
export class SceneLayout {
  private records: { args: Parameters<WorldLayoutCapture>; colliders: Collider[] }[] = [];
  private knownColliders = new Set<Collider>();
  constructor(private authored: AuthoredWorld, private group: T.Group, private colliders: Collider[], private benches: VillageBench[]) { this.colliders.forEach(collider => this.knownColliders.add(collider)); }

  capture: WorldLayoutCapture = (...args) => {
    const added = this.colliders.filter(collider => !this.knownColliders.has(collider));
    this.colliders.forEach(collider => this.knownColliders.add(collider));
    this.records.push({ args, colliders: added });
  };

  apply() {
    if (this.authored.sceneVersion !== 1) { this.records = []; return; }
    for (const { args: [id, name, , objects, pivot], colliders } of this.records) {
      // These layers already use projected layout placements, including accepted seat physics.
      if (id === "tree" || id === "authored-grass" || name.startsWith("Authored path ") || this.authored.benches.some(item => item.id === id)
        || this.authored.swings.some(item => item.id === id) || this.authored.fences.some(item => item.id === id)) continue;
      if (INSTANCE_LAYERS.includes(id)) {
        this.applyInstances(id, objects as T.InstancedMesh[]);
        continue;
      }
      const placements = this.authored.items?.filter(item => item.visible && item.asset === id) ?? [];
      const root = objects.length === 1 && objects[0] instanceof T.Group && pivot
        && objects[0].position.distanceTo(new T.Vector3(...pivot)) < .001 ? objects[0] : new T.Group();
      if (!objects.includes(root)) {
        root.position.fromArray(pivot ?? [0, 0, 0]); this.group.add(root); root.updateMatrixWorld(true);
        objects.forEach(object => root.attach(object));
      }
      root.updateMatrixWorld(true);
      const inverse = root.matrixWorld.clone().invert();
      const originalColliders = colliders.filter(collider => this.colliders.includes(collider)).map(collider => ({ ...collider }));
      colliders.forEach(collider => { const index = this.colliders.indexOf(collider); if (index >= 0) this.colliders.splice(index, 1); });
      const template = cloneSkeleton(root);
      root.removeFromParent();
      if (!placements.length) root.traverse(object => { if (object instanceof T.InstancedMesh) object.count = 0; });
      const sourceBench = this.benches.find(bench => bench.id === id);
      if (sourceBench) this.benches.splice(this.benches.indexOf(sourceBench), 1);
      const fence = /^fence-/.test(id), replacedFenceGeometry = new Set<T.BufferGeometry>();
      for (const [placementIndex, item] of placements.entries()) {
        const placed = placementIndex === 0 ? root : cloneSkeleton(template); applySceneTransform(placed, item); this.group.add(placed); placed.updateMatrixWorld(true);
        const delta = placed.matrixWorld.clone().multiply(inverse);
        const benchForward = sourceBench && new T.Vector3(Math.sin(sourceBench.facing), 0, Math.cos(sourceBench.facing)).transformDirection(delta);
        if (sourceBench) this.benches.push({ ...sourceBench, id: item.id, x: item.position[0], z: item.position[2],
          facing: Math.atan2(benchForward!.x, benchForward!.z),
          seatHeight: item.position[1] + (sourceBench.seatHeight - template.position.y) * item.scale[1],
          hitBox: sourceBench.hitBox.clone().applyMatrix4(new T.Matrix4().makeScale(...item.scale)) });
        if (fence) {
          const lift = Math.max(0, item.position[1] - landscapeHeight(item.position[0], item.position[2]));
          placed.traverse(object => {
            if (!(object instanceof T.Mesh) || !object.geometry.userData.fencePath) return;
            const source = object.geometry; replacedFenceGeometry.add(source);
            object.geometry = conformFenceGeometry(source, object.matrixWorld, (x, z) => landscapeHeight(x, z) + lift);
            for (const bounds of fenceCollisionBoxes(object.geometry, object.matrixWorld)) {
              const center = bounds.getCenter(new T.Vector3()), size = bounds.getSize(new T.Vector3());
              this.colliders.push({ x: center.x, z: center.z, w: size.x, d: size.z, bottom: bounds.min.y, top: bounds.max.y });
            }
          });
          continue;
        }
        for (const collider of originalColliders) {
          const box = new T.Box3(new T.Vector3(collider.x - collider.w / 2, collider.bottom ?? 0, collider.z - collider.d / 2),
            new T.Vector3(collider.x + collider.w / 2, collider.top ?? 6, collider.z + collider.d / 2)).applyMatrix4(delta);
          const center = box.getCenter(new T.Vector3()), size = box.getSize(new T.Vector3());
          this.colliders.push({ x: center.x, z: center.z, w: size.x, d: size.z, bottom: box.min.y, top: box.max.y });
        }
      }
      replacedFenceGeometry.forEach(geometry => geometry.dispose());
    }
    this.records = [];
    this.knownColliders = new Set(this.colliders);
  }

  private applyInstances(id: string, meshes: T.InstancedMesh[]) {
    const placements = this.authored.items?.filter(item => item.visible && new RegExp(`^${id}-\\d+$`).test(item.asset)) ?? [];
    for (const mesh of meshes) {
      const replacement = new T.InstancedMesh(mesh.geometry, mesh.material, placements.length);
      replacement.castShadow = mesh.castShadow; replacement.receiveShadow = mesh.receiveShadow;
      replacement.customDepthMaterial = mesh.customDepthMaterial;
      const dummy = new T.Object3D(), color = new T.Color();
      placements.forEach((item, index) => {
        applySceneTransform(dummy, item); dummy.updateMatrix(); replacement.setMatrixAt(index, dummy.matrix);
        const source = Math.max(0, Math.min(mesh.count - 1, Number(item.asset.split("-").at(-1)) - 1));
        if (mesh.instanceColor && mesh.count) { mesh.getColorAt(source, color); replacement.setColorAt(index, color); }
      });
      // Keep references used by the foliage culling/wind code valid.
      mesh.instanceMatrix = replacement.instanceMatrix; mesh.instanceColor = replacement.instanceColor;
      mesh.count = placements.length; mesh.computeBoundingSphere(); mesh.computeBoundingBox();
    }
  }
}

export function applySceneTransform(root: T.Object3D, item: WorldItem) {
  root.position.fromArray(item.position);
  root.rotation.set(...item.rotation.map(T.MathUtils.degToRad) as [number, number, number]);
  root.scale.fromArray(item.scale); root.visible = item.visible;
}

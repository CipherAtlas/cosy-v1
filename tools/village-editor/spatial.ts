import * as T from "three";
import { OBB } from "three/addons/math/OBB.js";
import { landscapeHeight } from "../../features/village/environment";
import { type Layout, type LayoutItem, type LayoutScene } from "./model";

/** Editor-only support surfaces and solid volumes; never changes the playable map. */
export class StudioCollision {
  private localBounds = new Map<string, T.Box3>();
  private surfaces: { id: string; root: T.Object3D; bounds: T.Box3 }[] = [];
  private solids: OBB[] = [];
  private ray = new T.Raycaster();
  private defaultTerrain = true;

  constructor(private model: LayoutScene) {}

  refresh(layout: Layout) {
    this.surfaces = []; this.solids = []; this.defaultTerrain = false;
    for (const item of layout.objects) {
      if (!item.visible) continue;
      const asset = this.model.assets.get(item.asset)!, root = this.model.roots.get(item.id)!;
      if (asset.surface) {
        if (item.asset === "terrain" && item.position.every(n => n === 0) && item.rotation.every(n => n === 0) && item.scale.every(n => n === 1)) this.defaultTerrain = true;
        else this.surfaces.push({ id: item.id, root, bounds: new T.Box3().setFromObject(root) });
      }
      const solid = this.solid(item); if (solid) this.solids.push(solid);
    }
  }
  private bounds(asset: string) {
    let box = this.localBounds.get(asset);
    if (!box) { box = new T.Box3().setFromObject(this.model.assets.get(asset)!.template); this.localBounds.set(asset, box); }
    return box;
  }
  private matrix(item: LayoutItem) {
    return new T.Matrix4().compose(new T.Vector3(...item.position), new T.Quaternion().setFromEuler(new T.Euler(...item.rotation.map(T.MathUtils.degToRad) as [number, number, number])), new T.Vector3(...item.scale));
  }
  solid(item: LayoutItem) {
    if (!item.visible || !this.model.assets.get(item.asset)?.solid) return null;
    const bounds = this.bounds(item.asset).clone(), matrix = this.matrix(item);
    if (/^(tree-|willow-)/.test(item.asset)) {
      bounds.min.set(-.35, 0, -.35); bounds.max.set(.35, Math.min(bounds.max.y * .65, 6), .35);
    }
    const obb = new OBB().fromBox3(bounds).applyMatrix4(matrix);
    // OBB.applyMatrix4 scales/rotates the axes but only translates its centre.
    obb.center.copy(bounds.getCenter(new T.Vector3()).applyMatrix4(matrix));
    obb.halfSize.subScalar(.06).max(new T.Vector3(.01, .01, .01));
    return obb;
  }
  height(x: number, z: number, exclude?: string) {
    let height = this.defaultTerrain && Math.abs(x) <= 325 && Math.abs(z) <= 325 ? Math.max(0, landscapeHeight(x, z)) : 0;
    this.ray.set(new T.Vector3(x, 10000, z), new T.Vector3(0, -1, 0));
    for (const surface of this.surfaces) {
      if (surface.id === exclude || x < surface.bounds.min.x || x > surface.bounds.max.x || z < surface.bounds.min.z || z > surface.bounds.max.z) continue;
      const hit = this.ray.intersectObject(surface.root, true)[0];
      if (hit) height = Math.max(height, hit.point.y);
    }
    return height;
  }
  pickGround(ray: T.Ray) {
    let closest = ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), 0), new T.Vector3());
    if (closest && this.defaultTerrain) {
      for (let i = 0; i < 5; i++) {
        const y = Math.abs(closest.x) <= 325 && Math.abs(closest.z) <= 325 ? Math.max(0, landscapeHeight(closest.x, closest.z)) : 0;
        if (!ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), -y), closest)) { closest = null; break; }
      }
    }
    this.ray.ray.copy(ray);
    for (const surface of this.surfaces) {
      const hit = this.ray.intersectObject(surface.root, true)[0];
      if (hit && (!closest || hit.distance < ray.origin.distanceTo(closest))) closest = hit.point;
    }
    return closest;
  }
  ground(item: LayoutItem, force = false) {
    if (this.model.assets.get(item.asset)?.surface) {
      if (force) item.position[1] = this.height(item.position[0], item.position[2], item.id);
      return;
    }
    let base = this.height(item.position[0], item.position[2], item.id);
    const box = item.path ? null : this.bounds(item.asset).clone().applyMatrix4(this.matrix(item));
    if (box && this.model.assets.get(item.asset)?.solid) {
      for (const x of [box.min.x, box.max.x]) for (const z of [box.min.z, box.max.z]) base = Math.max(base, this.height(x, z, item.id));
    }
    const bottom = box ? box.min.y : item.position[1];
    if (force || bottom < base) item.position[1] += base - bottom;
  }
  overlap(item: LayoutItem, layout: Layout) {
    const own = this.solid(item); if (!own) return null;
    return layout.objects.find(other => other.id !== item.id && this.solid(other)?.intersectsOBB(own)) ?? null;
  }
  validateEdits(next: Layout, previous: Layout) {
    const old = new Map(previous.objects.map(item => [item.id, item]));
    const changed = next.objects.filter(item => {
      const before = old.get(item.id);
      return !before || JSON.stringify([item.position, item.rotation, item.scale, item.visible]) !== JSON.stringify([before.position, before.rotation, before.scale, before.visible]);
    });
    for (const item of changed) if (item.visible) this.ground(item);
    const solids = next.objects.map(item => ({ item, box: this.solid(item) })).filter(entry => entry.box);
    for (const item of changed) {
      const own = this.solid(item); if (!own) continue;
      for (const other of solids) {
        if (other.item.id === item.id || !own.intersectsOBB(other.box!)) continue;
        const a = old.get(item.id), b = old.get(other.item.id), oldA = a && this.solid(a), oldB = b && this.solid(b);
        // Let pre-existing intersections be moved apart without trapping an older layout.
        if (oldA && oldB && oldA.intersectsOBB(oldB) && own.center.distanceTo(other.box!.center) > oldA.center.distanceTo(oldB.center) + .01) continue;
        throw Error(`${item.name} overlaps ${other.item.name}. Choose a clear spot, or turn off “Avoid solid overlaps” for intentional layering.`);
      }
    }
  }
  blocksGrass(point: T.Vector3) { return this.solids.some(box => box.containsPoint(point)); }
  moveCamera(from: T.Vector3, desired: T.Vector3) {
    const result = desired.clone(), delta = desired.clone().sub(from), distance = delta.length();
    if (distance > .0001) {
      const ray = new T.Ray(from, delta.normalize()); let nearest = distance;
      for (const solid of this.solids) {
        const padded = solid.clone(); padded.halfSize.addScalar(.35);
        if (padded.containsPoint(from)) continue;
        const hit = padded.intersectRay(ray, new T.Vector3());
        if (hit) nearest = Math.min(nearest, Math.max(0, from.distanceTo(hit) - .02));
      }
      result.copy(from).addScaledVector(ray.direction, nearest);
    }
    // Resolve a newly placed prop or camera framing that starts inside a solid.
    for (const solid of this.solids) {
      const padded = solid.clone(); padded.halfSize.addScalar(.35);
      if (!padded.containsPoint(result)) continue;
      const local = result.clone().sub(padded.center).applyMatrix3(padded.rotation.clone().transpose());
      const gaps = [padded.halfSize.x - Math.abs(local.x), padded.halfSize.y - Math.abs(local.y), padded.halfSize.z - Math.abs(local.z)];
      const axis = gaps.indexOf(Math.min(...gaps)); local.setComponent(axis, (Math.sign(local.getComponent(axis)) || 1) * (padded.halfSize.getComponent(axis) + .02));
      result.copy(local.applyMatrix3(padded.rotation).add(padded.center));
    }
    result.y = Math.max(result.y, this.height(result.x, result.z) + 1.5);
    return result;
  }
}

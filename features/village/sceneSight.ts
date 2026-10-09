import * as T from "three";
import type { Collider } from "./environment";

/** Fixed layout solids indexed for short camera and label sight lines. */
export class SceneSight {
  private source?: Collider[];
  private cells = new Map<string, T.Box3[]>();
  private candidates = new Set<T.Box3>();
  private ray = new T.Ray();
  private hit = new T.Vector3();
  private cellSize = 8;

  setColliders(colliders: Collider[], padding = 0) {
    if (this.source === colliders) return;
    this.source = colliders; this.cells.clear();
    for (const c of colliders) {
      const box = new T.Box3(new T.Vector3(c.x - c.w / 2 - padding, c.bottom ?? 0, c.z - c.d / 2 - padding),
        new T.Vector3(c.x + c.w / 2 + padding, c.top ?? 8, c.z + c.d / 2 + padding));
      for (let x = Math.floor(box.min.x / this.cellSize); x <= Math.floor(box.max.x / this.cellSize); x++)
        for (let z = Math.floor(box.min.z / this.cellSize); z <= Math.floor(box.max.z / this.cellSize); z++) {
          const key = `${x},${z}`, boxes = this.cells.get(key);
          if (boxes) boxes.push(box); else this.cells.set(key, [box]);
        }
    }
  }

  clearance(origin: T.Vector3, target: T.Vector3, ignoreTarget = false) {
    const distance = origin.distanceTo(target);
    if (distance < .001) return distance;
    this.ray.origin.copy(origin); this.ray.direction.subVectors(target, origin).divideScalar(distance);
    this.candidates.clear();
    // Visit every crossed grid cell, including simultaneous crossings at cell corners.
    let x = Math.floor(origin.x / this.cellSize), z = Math.floor(origin.z / this.cellSize);
    const endX = Math.floor(target.x / this.cellSize), endZ = Math.floor(target.z / this.cellSize);
    const dx = target.x - origin.x, dz = target.z - origin.z, sx = Math.sign(dx), sz = Math.sign(dz);
    const stepX = dx ? this.cellSize / Math.abs(dx) : Infinity, stepZ = dz ? this.cellSize / Math.abs(dz) : Infinity;
    let nextX = dx ? ((sx > 0 ? x + 1 : x) * this.cellSize - origin.x) / dx : Infinity;
    let nextZ = dz ? ((sz > 0 ? z + 1 : z) * this.cellSize - origin.z) / dz : Infinity;
    const visit = (gx: number, gz: number) => { for (const box of this.cells.get(`${gx},${gz}`) ?? []) this.candidates.add(box); };
    visit(x, z);
    while (x !== endX || z !== endZ) {
      // A negative endpoint on a grid line belongs to the reached cell; do not cross
      // that axis again while the other axis finishes at the same segment endpoint.
      if (x === endX) nextX = Infinity;
      if (z === endZ) nextZ = Infinity;
      if (Math.abs(nextX - nextZ) < 1e-9) {
        visit(x + sx, z); visit(x, z + sz);
        x += sx; z += sz; nextX += stepX; nextZ += stepZ;
      } else if (nextX < nextZ) { x += sx; nextX += stepX; }
      else { z += sz; nextZ += stepZ; }
      visit(x, z);
    }
    let clear = distance;
    for (const box of this.candidates) {
      // The look anchor can sit within a bench, gate or activity prop.
      const smallProp = box.max.y - box.min.y < 1.8 || (box.max.x - box.min.x) * (box.max.z - box.min.z) < .5;
      if (box.containsPoint(origin) || ignoreTarget && smallProp && box.containsPoint(target)) continue;
      if (this.ray.intersectBox(box, this.hit)) clear = Math.min(clear, this.hit.distanceTo(origin));
    }
    return clear;
  }

  visible(camera: T.Vector3, anchor: T.Vector3) {
    return this.clearance(camera, anchor, true) >= camera.distanceTo(anchor) - .2;
  }
}

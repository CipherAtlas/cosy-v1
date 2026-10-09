import * as T from "three";
import type { World } from "./world";

/** Static tree matrices only need uploading when their camera/player classification changes. */
export class TreeVisibility {
  private position = new T.Vector3(Infinity, Infinity, Infinity);
  private rotation = new T.Quaternion();
  private projection = new T.Matrix4();
  private frustum = new T.Frustum();
  private viewProjection = new T.Matrix4();
  private playerX = Infinity;
  private playerZ = Infinity;
  private distance = -1;
  private near: number[] = [];
  private far: number[] = [];
  uploads = 0;

  update(world: World, camera: T.Camera, player: T.Vector3, distance: number) {
    if (this.distance === distance && this.position.distanceToSquared(camera.position) < .0001
      && this.rotation.angleTo(camera.quaternion) < .0001 && this.projection.equals(camera.projectionMatrix)
      && Math.abs(this.playerX - player.x) < .01 && Math.abs(this.playerZ - player.z) < .01) return;
    this.distance = distance;
    this.position.copy(camera.position); this.rotation.copy(camera.quaternion);
    this.projection.copy(camera.projectionMatrix); this.playerX = player.x; this.playerZ = player.z;
    this.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.viewProjection);
    this.near.length = this.far.length = 0;
    const source = world.trees[0];
    source?.bounds.forEach((bounds, index) => {
      if (Math.hypot(bounds.center.x - player.x, bounds.center.z - player.z) < distance) this.near.push(index);
      else if (this.frustum.intersectsSphere(bounds)) this.far.push(index);
    });
    for (const batch of world.trees) {
      this.near.forEach((index, i) => batch.mesh.setMatrixAt(i, batch.transforms[index]));
      batch.mesh.count = this.near.length;
      batch.mesh.instanceMatrix.needsUpdate = true;
    }
    if (source) {
      this.far.forEach((index, i) => world.treeLod.setMatrixAt(i, source.transforms[index]));
      world.treeLod.count = this.far.length;
      world.treeLod.instanceMatrix.needsUpdate = true;
    }
    this.uploads++;
  }
}

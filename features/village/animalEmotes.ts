import * as T from "three";

/** Reusable, bounded visual effects; animal meshes and authored placements stay untouched. */
export function animalHeartGeometry() {
  const shape = new T.Shape();
  shape.moveTo(0, -.4); shape.bezierCurveTo(-.9, .05, -.45, .65, 0, .25);
  shape.bezierCurveTo(.45, .65, .9, .05, 0, -.4);
  return new T.ShapeGeometry(shape, 8);
}

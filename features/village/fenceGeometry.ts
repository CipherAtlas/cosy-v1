import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** A rail-and-post run in the XZ plane. Width is fence height in metres. */
export function fenceGeometry(points: [number, number][], height: number) {
  const parts: T.BufferGeometry[] = [];
  const box = (x: number, y: number, z: number, width: number, tall: number, depth: number, yaw = 0) => {
    const geometry = new T.BoxGeometry(width, tall, depth);
    geometry.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), yaw), new T.Vector3(1, 1, 1)));
    parts.push(geometry);
  };
  const post = (x: number, z: number) => {
    box(x, height / 2, z, .14, height, .14);
    box(x, height + .06, z, .22, .12, .22);
  };
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i];
    const length = Math.hypot(bx - ax, bz - az);
    if (length < .01) continue;
    const count = Math.max(1, Math.ceil(length / 2.4)), yaw = Math.atan2(bz - az, bx - ax);
    for (let step = 0; step <= count; step++) {
      if (i > 1 && step === 0) continue;
      const t = step / count; post(ax + (bx - ax) * t, az + (bz - az) * t);
    }
    for (let step = 0; step < count; step++) {
      const t = (step + .5) / count;
      for (const level of [.34, .7]) box(ax + (bx - ax) * t, height * level, az + (bz - az) * t, length / count + .08, .11, .095, yaw);
    }
  }
  const geometry = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  if (!geometry) throw Error("A fence needs two distinct points.");
  geometry.userData.flatPositions = Array.from(geometry.attributes.position.array);
  return geometry;
}

import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Physical wood, independent of the rounded mesh's vertex count. */
export type FencePiece = {
  kind: "post" | "cap" | "rail";
  center: [number, number, number];
  size: [number, number, number];
  rotation: [number, number, number, number];
};
const materials = new WeakMap<T.MeshStandardMaterial, T.MeshStandardMaterial>();
export function fenceWoodMaterial(wood: T.MeshStandardMaterial) {
  let material = materials.get(wood);
  if (!material) {
    material = wood.clone(); material.color.set("#cdb48b"); material.vertexColors = true; material.roughness = 1;
    materials.set(wood, material);
  }
  return material;
}
const variation = (x: number, z: number) => {
  const value = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return value - Math.floor(value);
};

/** Upright posts follow the ground; the rails slope between their actual attachment points. */
export function fenceGeometry(points: [number, number][], height: number, ground: (x: number, z: number) => number = () => 0) {
  const parts: T.BufferGeometry[] = [], pieces: FencePiece[] = [];
  const wood = (kind: FencePiece["kind"], center: T.Vector3, size: [number, number, number], rotation = new T.Quaternion()) => {
    const geometry = new RoundedBoxGeometry(...size, 1, Math.min(...size) * .19);
    const positions = geometry.attributes.position, colors = new Float32Array(positions.count * 3);
    const tone = .87 + variation(center.x, center.z + center.y) * .13;
    for (let i = 0; i < positions.count; i++) {
      const grain = .965 + .035 * Math.sin(positions.getX(i) * 37 + positions.getY(i) * 5);
      colors.set([tone * grain, tone * grain, tone * grain * .97], i * 3);
    }
    geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    geometry.applyMatrix4(new T.Matrix4().compose(center, rotation, new T.Vector3(1, 1, 1)));
    pieces.push({ kind, center: center.toArray(), size, rotation: rotation.toArray() }); parts.push(geometry);
  };
  const posts = new Set<string>();
  const post = (x: number, z: number) => {
    const key = `${x.toFixed(5)},${z.toFixed(5)}`;
    if (posts.has(key)) return; posts.add(key);
    const base = ground(x, z), tall = height + (variation(x, z) - .5) * .05;
    const rotation = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), (variation(z, x) - .5) * .08);
    wood("post", new T.Vector3(x, base + tall / 2, z), [.19, tall, .19], rotation);
    wood("cap", new T.Vector3(x, base + tall + .035, z), [.25, .10, .25], rotation);
  };
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i], length = Math.hypot(bx - ax, bz - az);
    if (length < .01) continue;
    const count = Math.max(1, Math.ceil(length / 2.4));
    for (let step = 0; step <= count; step++) post(ax + (bx - ax) * step / count, az + (bz - az) * step / count);
    for (let step = 0; step < count; step++) {
      const x0 = ax + (bx - ax) * step / count, z0 = az + (bz - az) * step / count;
      const x1 = ax + (bx - ax) * (step + 1) / count, z1 = az + (bz - az) * (step + 1) / count;
      for (const level of [.34, .72]) {
        const start = new T.Vector3(x0, ground(x0, z0) + height * level, z0);
        const end = new T.Vector3(x1, ground(x1, z1) + height * level, z1), direction = end.clone().sub(start);
        // A quaternion avoids mirroring diagonal runs under Three's Y rotation convention.
        const rotation = new T.Quaternion().setFromUnitVectors(new T.Vector3(1, 0, 0), direction.clone().normalize());
        wood("rail", start.add(end).multiplyScalar(.5), [direction.length() + .10, .145, .12], rotation);
      }
    }
  }
  const geometry = mergeGeometries(parts); parts.forEach(part => part.dispose());
  if (!geometry) throw Error("A fence needs two distinct points.");
  geometry.userData.fencePieces = pieces;
  geometry.userData.fencePath = { points: points.map(point => [...point]), height };
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

/** Rebuild wood on a transformed terrain base instead of shearing individual vertices. */
export function conformFenceGeometry(geometry: T.BufferGeometry, transform: T.Matrix4, ground: (x: number, z: number) => number) {
  const path = geometry.userData.fencePath as { points: [number, number][]; height: number };
  const up = transform.elements[5];
  return fenceGeometry(path.points, path.height, (x, z) => {
    const point = new T.Vector3(x, 0, z).applyMatrix4(transform);
    return Math.abs(up) > .001 ? (ground(point.x, point.z) - point.y) / up : 0;
  });
}

/** Short rail bounds keep diagonal bends and open entrances clear in both collision engines. */
export function fenceCollisionBoxes(geometry: T.BufferGeometry, transform = new T.Matrix4()) {
  const boxes: T.Box3[] = [];
  for (const piece of (geometry.userData.fencePieces ?? []) as FencePiece[]) {
    const [width, height, depth] = piece.size;
    const count = piece.kind === "rail" ? Math.max(1, Math.ceil(width / .45)) : 1;
    const matrix = new T.Matrix4().compose(new T.Vector3(...piece.center), new T.Quaternion(...piece.rotation), new T.Vector3(1, 1, 1));
    matrix.premultiply(transform);
    for (let i = 0; i < count; i++) {
      const left = -width / 2 + width * i / count, right = -width / 2 + width * (i + 1) / count;
      boxes.push(new T.Box3(new T.Vector3(left, -height / 2, -depth / 2), new T.Vector3(right, height / 2, depth / 2)).applyMatrix4(matrix).expandByScalar(.012));
    }
  }
  return boxes;
}

import * as T from "three";
import type { AuthoredWorld } from "./worldLayout";
import { layoutLocalPoint } from "./layoutTransforms";

/** Keep transformed pond banks below any original river channel they overlap. */
export function conformRiverBank(geometry: T.BufferGeometry, matrix: T.Matrix4, world: AuthoredWorld) {
  const positions = geometry.attributes.position;
  const base = geometry.userData.riverBankPositions ?? Array.from(positions.array);
  geometry.userData.riverBankPositions = base;
  const rivers = world.sceneVersion === 1 ? world.items?.filter(item => item.visible && item.asset === "river") ?? []
    : [{ position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } as NonNullable<AuthoredWorld["items"]>[number]];
  const inverse = matrix.clone().invert(), point = new T.Vector3();
  for (let i = 0; i < positions.count; i++) {
    point.set(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]).applyMatrix4(matrix);
    for (const river of rivers) {
      const [x, z] = layoutLocalPoint(river, point.x, point.z, [0, 0, 0]);
      const distance = Math.abs(x - (-11 + Math.sin(z * .052) * 3));
      if (distance < 4 && Math.abs(z) <= 110) point.y = Math.min(point.y, river.position[1] + (-.85 + distance * .15) * river.scale[1]);
    }
    point.applyMatrix4(inverse); positions.setXYZ(i, point.x, point.y, point.z);
  }
  positions.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
}

/** Terrain-following water ribbon; cross-stream UVs feed the village shoreline shader. */
export function riverGeometry(points: [number, number][], width: number, height: (x: number, z: number) => number = () => 0) {
  const curve = new T.CatmullRomCurve3(points.map(([x, z]) => new T.Vector3(x, 0, z)));
  const segments = Math.min(2000, Math.max(64, Math.ceil(curve.getLength() * 2)));
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const p = curve.getPoint(i / segments), tangent = curve.getTangent(i / segments);
    for (const side of [-1, 1]) {
      const x = p.x + tangent.z * width * side / 2, z = p.z - tangent.x * width * side / 2;
      positions.push(x, height(x, z) + .07, z); uvs.push((side + 1) / 2, i / segments);
    }
    if (i < segments) { const n = i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  geometry.userData.flatPositions = positions.slice();
  geometry.userData.plantingSurface = "water";
  geometry.userData.riverSurface = true;
  return geometry;
}

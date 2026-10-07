import * as T from "three";
import { distanceToPath, type AuthoredWorld } from "./worldLayout";
import { landscapeHeight, POND } from "./environment";
import { layoutLocalPoint, layoutWorldPoint } from "./layoutTransforms";

/** Refine only stream corridors so coarse ground triangles cannot protrude through curved water. */
export function refineRiverTerrain(geometry: T.BufferGeometry, world: AuthoredWorld, matrix: T.Matrix4) {
  if (!world.rivers?.length) return geometry.clone();
  const attributes = Object.entries(geometry.attributes).filter(([name]) => name !== "normal");
  const output = attributes.map(() => [] as number[]), indices = geometry.index;
  const vertexIds = new Map<string, number>(), refinedIndices: number[] = [];
  const emit = (v: number[][]) => {
    const key = v.map(values => values.map(value => value.toFixed(6)).join(",")).join("|");
    let id = vertexIds.get(key);
    if (id === undefined) { id = vertexIds.size; vertexIds.set(key, id); v.forEach((values, i) => output[i].push(...values)); }
    refinedIndices.push(id);
  };
  const vertex = (i: number) => attributes.map(([, attribute]) => Array.from({ length: attribute.itemSize }, (_, c) => attribute.array[i * attribute.itemSize + c]));
  const midpoint = (a: number[][], b: number[][]) => a.map((values, i) => values.map((value, c) => (value + b[i][c]) / 2));
  const positionIndex = attributes.findIndex(([name]) => name === "position");
  const triangle = (a: number[][], b: number[][], c: number[][], depth: number) => {
    if (depth === 2) { [a, b, c].forEach(emit); return; }
    const points = [a, b, c].map(v => new T.Vector3(...v[positionIndex] as [number, number, number]).applyMatrix4(matrix));
    const center = points[0].clone().add(points[1]).add(points[2]).multiplyScalar(1 / 3);
    const radius = Math.max(...points.map(p => Math.hypot(p.x - center.x, p.z - center.z)));
    const near = depth < 2 && world.rivers!.some(river => center.x >= river.bounds[0] - radius - 1 && center.x <= river.bounds[2] + radius + 1
      && center.z >= river.bounds[1] - radius - 1 && center.z <= river.bounds[3] + radius + 1
      && distanceToPath(center.x, center.z, river) < river.width / 2 + 1 + radius);
    if (near) {
      const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
      triangle(a, ab, ca, depth + 1); triangle(ab, b, bc, depth + 1);
      triangle(ca, bc, c, depth + 1); triangle(ab, bc, ca, depth + 1);
    } else [a, b, c].forEach(emit);
  };
  for (let i = 0; i < (indices?.count ?? geometry.attributes.position.count); i += 3)
    triangle(vertex(indices ? indices.getX(i) : i), vertex(indices ? indices.getX(i + 1) : i + 1), vertex(indices ? indices.getX(i + 2) : i + 2), 0);
  const refined = new T.BufferGeometry();
  attributes.forEach(([name, attribute], i) => refined.setAttribute(name, new T.Float32BufferAttribute(output[i], attribute.itemSize)));
  refined.setIndex(refinedIndices);
  refined.userData = { ...geometry.userData };
  return refined;
}

/** Cut only authored stream and waterfall outlet footprints; the source terrain remains the water-height reference. */
export function makeRiverChannelHeight(world: AuthoredWorld, waterBaseHeight: (x: number, z: number) => number) {
  const channels = (world.rivers ?? []).flatMap(river => {
    const item = world.items?.find(item => item.id === river.id && item.visible);
    if (!item) return [];
    const halfWidth = river.width / 2, reach = halfWidth + 1;
    const extra = Math.max(0, reach - river.width);
    const bounds: [number, number, number, number] = [river.bounds[0] - extra, river.bounds[1] - extra, river.bounds[2] + extra, river.bounds[3] + extra];
    return [{ level: undefined as number | undefined, path: { ...river, bounds }, halfWidth, reach, offset: item.position[1] - waterBaseHeight(item.position[0], item.position[2]) }];
  });
  // Placeable waterfall outlets need the same shallow bed in runtime and editor terrain.
  for (const item of world.items ?? []) {
    if (!item.visible || item.asset !== "hill-waterfall") continue;
    const points = [.8, 3.25].map(z => {
      const point = layoutWorldPoint(item, [0, 0, z], [0, 0, 0]);
      return [point[0], point[2]] as [number, number];
    });
    const halfWidth = 1.3 * Math.abs(item.scale[0]), reach = halfWidth + 1;
    const bounds: [number, number, number, number] = [Math.min(...points.map(p => p[0])) - reach,
      Math.min(...points.map(p => p[1])) - reach, Math.max(...points.map(p => p[0])) + reach,
      Math.max(...points.map(p => p[1])) + reach];
    channels.push({ path: { points, spine: points, width: halfWidth * 2, bounds, id: item.id, straight: true }, halfWidth, reach,
      offset: 0, level: item.position[1] - .105 * item.scale[1] });
  }
  return (x: number, z: number, uncarvedGround = waterBaseHeight(x, z)) => {
    let result = uncarvedGround;
    for (const channel of channels) {
      const distance = distanceToPath(x, z, channel.path);
      if (distance >= channel.reach) continue;
      const blend = 1 - T.MathUtils.smoothstep(distance, channel.halfWidth, channel.reach);
      let nearestX = x, nearestZ = z, nearestDistanceSq = Infinity;
      for (let i = 1; i < channel.path.spine.length; i++) {
        const [ax, az] = channel.path.spine[i - 1], [bx, bz] = channel.path.spine[i];
        const dx = bx - ax, dz = bz - az, lengthSq = dx * dx + dz * dz;
        const t = lengthSq ? T.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / lengthSq, 0, 1) : 0;
        const px = ax + dx * t, pz = az + dz * t, distanceSq = (x - px) ** 2 + (z - pz) ** 2;
        if (distanceSq < nearestDistanceSq) { nearestDistanceSq = distanceSq; nearestX = px; nearestZ = pz; }
      }
      const bed = Math.min(uncarvedGround, (channel.level ?? (waterBaseHeight(nearestX, nearestZ) + channel.offset + .07)) - .7);
      result = Math.min(result, T.MathUtils.lerp(uncarvedGround, bed, blend));
    }
    return result;
  };
}

/** Keep transformed pond banks below any original river channel they overlap. */
export function conformRiverBank(geometry: T.BufferGeometry, matrix: T.Matrix4, world: AuthoredWorld, waterBaseHeight: (x: number, z: number) => number = landscapeHeight) {
  const positions = geometry.attributes.position;
  const base = geometry.userData.riverBankPositions ?? Array.from(positions.array);
  geometry.userData.riverBankPositions = base;
  const rivers = world.sceneVersion === 1 ? world.items?.filter(item => item.visible && item.asset === "river") ?? []
    : [{ position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } as NonNullable<AuthoredWorld["items"]>[number]];
  const inverse = matrix.clone().invert(), point = new T.Vector3(), channelHeight = makeRiverChannelHeight(world, waterBaseHeight);
  for (let i = 0; i < positions.count; i++) {
    point.set(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]).applyMatrix4(matrix);
    for (const river of rivers) {
      const [x, z] = layoutLocalPoint(river, point.x, point.z, [0, 0, 0]);
      const distance = Math.abs(x - (-11 + Math.sin(z * .052) * 3));
      if (distance < 4 && Math.abs(z) <= 110) point.y = Math.min(point.y, river.position[1] + (-.85 + distance * .15) * river.scale[1]);
    }
    point.y = channelHeight(point.x, point.z, point.y);
    point.applyMatrix4(inverse); positions.setXYZ(i, point.x, point.y, point.z);
  }
  positions.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
}

/** Terrain-following water ribbon; UVs store bank position and downstream distance in metres. */
export function riverGeometry(points: [number, number][], width: number, height: (x: number, z: number) => number = () => 0) {
  const curve = new T.CatmullRomCurve3(points.map(([x, z]) => new T.Vector3(x, 0, z)));
  const segments = Math.min(2000, Math.max(64, Math.ceil(curve.getLength() * 2)));
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  let distance = 0;
  const previous = curve.getPoint(0);
  for (let i = 0; i <= segments; i++) {
    const p = curve.getPoint(i / segments), tangent = curve.getTangent(i / segments);
    distance += p.distanceTo(previous); previous.copy(p);
    const waterY = height(p.x, p.z) + .07;
    for (const side of [-1, 1]) {
      const x = p.x + tangent.z * width * side / 2, z = p.z - tangent.x * width * side / 2;
      positions.push(x, waterY, z); uvs.push((side + 1) / 2, distance);
    }
    if (i < segments) { const n = i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  geometry.setAttribute("waterJoin", new T.Float32BufferAttribute(new Float32Array(positions.length / 3), 1));
  geometry.setAttribute("waterPondUV", new T.Float32BufferAttribute(new Float32Array(positions.length / 3 * 2), 2));
  geometry.userData.flatPositions = positions.slice();
  geometry.userData.plantingSurface = "water";
  geometry.userData.riverSurface = true;
  return geometry;
}

/** Cut stream triangles at the actual 96-sided pond rim, avoiding coplanar water overlap. */
export function joinRiverToPonds(geometry: T.BufferGeometry, matrix: T.Matrix4, world: AuthoredWorld) {
  const ponds = (world.items ?? []).filter(item => item.visible && item.asset === "pond").map(item => {
    const transform = new T.Matrix4().compose(new T.Vector3(...item.position),
      new T.Quaternion().setFromEuler(new T.Euler(...item.rotation.map(T.MathUtils.degToRad) as [number, number, number])), new T.Vector3(...item.scale));
    return { transform, inverse: transform.clone().invert(), radius: Math.min(POND.rx * item.scale[0], POND.rz * item.scale[2]) };
  });
  if (!ponds.length) return geometry;
  type Vertex = { point: T.Vector3; uv: T.Vector2 };
  const positions = geometry.attributes.position, uv = geometry.attributes.uv;
  const vertices = Array.from({ length: positions.count }, (_, i) => ({ point: new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(matrix), uv: new T.Vector2(uv.getX(i), uv.getY(i)) }));
  const indices = geometry.index?.array ?? vertices.map((_, i) => i);
  let triangles: Vertex[][] = [];
  for (let i = 0; i < indices.length; i += 3) triangles.push([vertices[indices[i]], vertices[indices[i + 1]], vertices[indices[i + 2]]]);
  const local = (vertex: Vertex, inverse: T.Matrix4) => vertex.point.clone().applyMatrix4(inverse);
  const normalized = (vertex: Vertex, inverse: T.Matrix4) => { const p = local(vertex, inverse); return new T.Vector2(p.x / POND.rx, p.z / POND.rz); };
  for (const pond of ponds) {
    const outside: Vertex[][] = [];
    for (const triangle of triangles) {
      const points = triangle.map(vertex => normalized(vertex, pond.inverse));
      if (Math.min(...points.map(p => p.x)) > 1 || Math.max(...points.map(p => p.x)) < -1
        || Math.min(...points.map(p => p.y)) > 1 || Math.max(...points.map(p => p.y)) < -1) { outside.push(triangle); continue; }
      let remaining = triangle;
      for (let edge = 0; edge < 96 && remaining.length; edge++) {
        const a = new T.Vector2(Math.cos(edge * Math.PI / 48), Math.sin(edge * Math.PI / 48));
        const b = new T.Vector2(Math.cos((edge + 1) * Math.PI / 48), Math.sin((edge + 1) * Math.PI / 48));
        const direction = b.clone().sub(a);
        const distance = (vertex: Vertex) => { const p = normalized(vertex, pond.inverse).sub(a); return direction.x * p.y - direction.y * p.x; };
        const inside: Vertex[] = [], piece: Vertex[] = [];
        for (let i = 0; i < remaining.length; i++) {
          const current = remaining[i], next = remaining[(i + 1) % remaining.length], d = distance(current), n = distance(next);
          (d >= 0 ? inside : piece).push(current);
          if ((d >= 0) !== (n >= 0)) {
            const t = d / (d - n), cut = { point: current.point.clone().lerp(next.point, t), uv: current.uv.clone().lerp(next.uv, t) };
            inside.push(cut); piece.push(cut);
          }
        }
        for (let i = 1; i + 1 < piece.length; i++) outside.push([piece[0], piece[i], piece[i + 1]]);
        remaining = inside;
      }
    }
    triangles = outside;
  }
  const output: number[] = [], uvs: number[] = [], blend: number[] = [], pondUV: number[] = [], inverse = matrix.clone().invert();
  for (const triangle of triangles) for (const vertex of triangle) {
    const point = vertex.point.clone(); let weight = 0, joinUV = new T.Vector2();
    for (const pond of ponds) {
      const p = local(vertex, pond.inverse), distance = (Math.hypot(p.x / POND.rx, p.z / POND.rz) - 1) * pond.radius;
      const influence = 1 - T.MathUtils.smoothstep(distance, 0, 2);
      if (influence <= weight) continue;
      weight = influence; joinUV = new T.Vector2(p.x / POND.rx * .5 + .5, .5 - p.z / POND.rz * .5);
      const surface = new T.Vector3(p.x, POND.y, p.z).applyMatrix4(pond.transform);
      point.y = T.MathUtils.lerp(vertex.point.y, surface.y, weight);
    }
    point.applyMatrix4(inverse); output.push(...point.toArray()); uvs.push(...vertex.uv.toArray()); blend.push(weight); pondUV.push(...joinUV.toArray());
  }
  const joined = new T.BufferGeometry();
  joined.setAttribute("position", new T.Float32BufferAttribute(output, 3)); joined.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  joined.setAttribute("waterJoin", new T.Float32BufferAttribute(blend, 1)); joined.setAttribute("waterPondUV", new T.Float32BufferAttribute(pondUV, 2));
  joined.setIndex(Array.from({ length: output.length / 3 }, (_, i) => i)); joined.computeVertexNormals();
  joined.userData = { ...geometry.userData, flatPositions: output.slice(),
    riverBankRibbon: { positions: Array.from(positions.array), uvs: Array.from(uv.array) } };
  geometry.dispose(); return joined;
}

import * as T from "three";
import { PlantingSurfaceMask } from "./plantingClearance";
import { instanceCells } from "./spatialRendering";
import type { Collider } from "./environment";

function stoneGeometry() {
  const geometry = new T.IcosahedronGeometry(1, 1);
  // Limestone also serves vertex-tinted architecture; instances need a white base tint.
  const colors = new Float32Array(geometry.getAttribute("position").count * 3).fill(1);
  geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
  return geometry;
}

export function makeRiverbankStone(material: T.Material = new T.MeshStandardMaterial({ color: "#c7c5a5", roughness: 1 })) {
  const root = new T.Group(), stone = new T.Mesh(stoneGeometry(), material);
  stone.scale.set(.43, .28, .37); stone.position.y = .18;
  stone.castShadow = stone.receiveShadow = true; root.add(stone);
  return root;
}

/** Retain paired bank samples when a water join cuts the rendered ribbon into triangles. */
export function riverBanks(mesh: T.Mesh) {
  const ribbon = mesh.geometry.userData.riverBankRibbon;
  const position = ribbon ? new T.Float32BufferAttribute(ribbon.positions, 3) : mesh.geometry.getAttribute("position");
  const uv = ribbon ? new T.Float32BufferAttribute(ribbon.uvs, 2) : mesh.geometry.getAttribute("uv");
  const sides: { along: number; point: T.Vector3 }[][] = [[], []];
  for (let i = 0; i < position.count; i++) {
    const across = uv.getX(i);
    if (across > .0001 && across < .9999) continue;
    sides[across < .5 ? 0 : 1].push({ along: uv.getY(i), point: new T.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld) });
  }
  // A clipped water join can leave different sample counts on its two banks.
  return sides.map((side, index) => {
    const ordered = side.sort((a, b) => a.along - b.along).filter((sample, i, samples) => !i || sample.point.distanceToSquared(samples[i - 1].point) > 1e-12);
    return ordered.map((sample, i) => {
      const before = ordered[Math.max(0, i - 1)].point, after = ordered[Math.min(ordered.length - 1, i + 1)].point;
      const tangent = after.clone().sub(before).setY(0);
      return { point: sample.point, outward: new T.Vector3(index ? tangent.z : -tangent.z, 0, index ? -tangent.x : tangent.x).normalize() };
    });
  });
}

/** Sample the visible bank triangles, rather than the uncarved terrain/water height. */
function bankHeight(group: T.Object3D, fallback: (x: number, z: number) => number) {
  const cells = new Map<string, number[][]>(), cellSize = 4;
  const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
  group.traverseVisible(object => {
    if (!(object instanceof T.Mesh) || object instanceof T.InstancedMesh) return;
    let ground = Boolean(object.geometry.userData.riverBank);
    for (let parent: T.Object3D | null = object; parent && !ground; parent = parent.parent)
      ground = parent.name === "Valley ground" || parent.userData.asset === "terrain" || parent.userData.asset === "shore";
    if (!ground) return;
    const position = object.geometry.attributes.position, index = object.geometry.index;
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      a.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(object.matrixWorld);
      b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1).applyMatrix4(object.matrixWorld);
      c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2).applyMatrix4(object.matrixWorld);
      const denominator = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
      if (Math.abs(denominator) < 1e-9) continue;
      const triangle = [a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, denominator];
      for (let x = Math.floor(Math.min(a.x, b.x, c.x) / cellSize); x <= Math.floor(Math.max(a.x, b.x, c.x) / cellSize); x++)
        for (let z = Math.floor(Math.min(a.z, b.z, c.z) / cellSize); z <= Math.floor(Math.max(a.z, b.z, c.z) / cellSize); z++) {
          const key = `${x},${z}`, cell = cells.get(key);
          if (cell) cell.push(triangle); else cells.set(key, [triangle]);
        }
    }
  });
  return (x: number, z: number) => {
    let height = -Infinity;
    for (const [ax, ay, az, bx, by, bz, cx, cy, cz, denominator] of cells.get(`${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`) ?? []) {
      const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / denominator;
      const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / denominator;
      if (u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6) height = Math.max(height, u * ay + v * by + (1 - u - v) * cy);
    }
    return height === -Infinity ? fallback(x, z) : height;
  };
}

/** Solid stones spaced by bank length, with clear paths and open confluences. */
export function buildRiverbankStones(group: T.Object3D, material: T.Material, height: (x: number, z: number) => number, colliders: Collider[] = []) {
  const root = new T.Group(); root.name = "Automatic riverbank stones";
  group.updateMatrixWorld(true);
  const paving = new PlantingSurfaceMask(group, "paving"), water = new PlantingSurfaceMask(group, "water");
  const bridgeDecks: T.Box3[] = [];
  group.traverseVisible(object => {
    if (object instanceof T.Mesh && object.name === "Continuous paved crossing") bridgeDecks.push(new T.Box3().setFromObject(object));
  });
  const geometry = stoneGeometry(), dummy = new T.Object3D();
  geometry.computeBoundingBox();
  const ground = bankHeight(group, height), vertex = new T.Vector3();
  const support = new Map<string, T.Vector3>();
  for (let i = 0; i < geometry.attributes.position.count; i++) {
    vertex.fromBufferAttribute(geometry.attributes.position, i); support.set(vertex.toArray().join(","), vertex.clone());
  }
  const occupied = new Map<string, T.Vector3[]>();
  group.traverseVisible(object => {
    if (!(object instanceof T.Mesh) || !object.geometry.userData.riverSurface) return;
    const matrices: T.Matrix4[] = [], colors: T.Color[] = [];
    let seed = 62025;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
    for (const bank of riverBanks(object)) {
      let next = .2;
      for (let i = 1; i < bank.length; i++) {
        const a = bank[i - 1], b = bank[i], length = Math.hypot(b.point.x - a.point.x, b.point.z - a.point.z);
        while (next <= length && length > .0001) {
          const point = a.point.clone().lerp(b.point, next / length);
          const outward = a.outward.clone().lerp(b.outward, next / length).normalize();
          const size = .82 + random() * .32, radius = .43 * size;
          const waterHeight = point.y;
          const bankOffset = radius + .12 + random() * .22;
          point.addScaledVector(outward, bankOffset);
          // A narrow paved verge still needs edging: let the stone straddle the waterline.
          for (let step = 0; step < 4 && paving.covers(point.x, point.z, radius); step++) point.addScaledVector(outward, -.1);
          const key = `${Math.floor(point.x)},${Math.floor(point.z)}`;
          let overlaps = false;
          for (let x = Math.floor(point.x) - 1; x <= Math.floor(point.x) + 1; x++) for (let z = Math.floor(point.z) - 1; z <= Math.floor(point.z) + 1; z++) {
            if (occupied.get(`${x},${z}`)?.some(p => Math.hypot(point.x - p.x, point.z - p.z) < .6)) overlaps = true;
          }
          const bridgeAccess = bridgeDecks.some(bounds => point.x >= bounds.min.x - radius - .4 && point.x <= bounds.max.x + radius + .4
            && point.z >= bounds.min.z - radius - 1.8 && point.z <= bounds.max.z + radius + 1.8);
          if (!overlaps && !bridgeAccess && !paving.covers(point.x, point.z, radius) && !water.covers(point.x, point.z)) {
            dummy.position.set(point.x, 0, point.z);
            dummy.rotation.set((random() - .5) * .3, random() * Math.PI * 2, (random() - .5) * .3);
            dummy.scale.set(radius, (.23 + random() * .1) * size, (.32 + random() * .09) * size);
            dummy.updateMatrix();
            let seat = -Infinity;
            for (const sample of support.values()) {
              vertex.copy(sample).applyMatrix4(dummy.matrix);
              if (vertex.y <= 0) seat = Math.max(seat, ground(vertex.x, vertex.z) - vertex.y);
            }
            dummy.position.y = seat - (.055 + random() * .045);
            dummy.updateMatrix(); matrices.push(dummy.matrix.clone());
            const bounds = geometry.boundingBox!.clone().applyMatrix4(dummy.matrix);
            const center = bounds.getCenter(new T.Vector3()), boundsSize = bounds.getSize(new T.Vector3());
            // Never grant collision to a stone completely below the visible water surface.
            if (bounds.max.y > waterHeight) colliders.push({ x: center.x, z: center.z, w: boundsSize.x, d: boundsSize.z, bottom: bounds.min.y, top: bounds.max.y });
            colors.push(new T.Color().setScalar(.92 + random() * .12));
            const cell = occupied.get(key) ?? []; cell.push(point); occupied.set(key, cell);
          }
          next += .72 + random() * .32;
        }
        next -= length;
      }
    }
    if (!matrices.length) return;
    const mesh = new T.InstancedMesh(geometry, material, matrices.length);
    mesh.castShadow = mesh.receiveShadow = true;
    let source: T.Object3D | null = object;
    while (source && !source.userData.layoutId) source = source.parent;
    mesh.userData.layoutId = source?.userData.layoutId;
    mesh.userData.riverSource = source?.userData.layoutId ?? object.name;
    mesh.userData.riverbankStones = true;
    matrices.forEach((matrix, i) => { mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, colors[i]); });
    root.add(mesh); instanceCells(mesh, 24, "Riverbank stones", 0);
  });
  if (!root.children.length) geometry.dispose();
  return root;
}

export function disposeRiverbankStones(root: T.Group) {
  const geometries = new Set<T.BufferGeometry>();
  root.traverse(object => { if (object instanceof T.InstancedMesh) { geometries.add(object.geometry); object.dispose(); } });
  geometries.forEach(geometry => geometry.dispose()); root.removeFromParent();
}

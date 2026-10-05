import * as T from "three";
import { PlantingSurfaceMask } from "./plantingClearance";
import { instanceCells } from "./spatialRendering";

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

/** Read the two banks from the rendered ribbon, including saved transforms and terrain lift. */
export function riverBanks(mesh: T.Mesh) {
  const position = mesh.geometry.getAttribute("position"), uv = mesh.geometry.getAttribute("uv");
  const sides: { along: number; point: T.Vector3 }[][] = [[], []];
  for (let i = 0; i < position.count; i++) {
    const across = uv.getX(i);
    if (across > .0001 && across < .9999) continue;
    sides[across < .5 ? 0 : 1].push({ along: uv.getY(i), point: new T.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld) });
  }
  sides.forEach(side => side.sort((a, b) => a.along - b.along));
  return sides.map((side, index) => side.map((sample, i) => ({
    point: sample.point,
    outward: sample.point.clone().sub(sides[1 - index][i].point).setY(0).normalize(),
  })));
}

/** Small, non-blocking stones spaced by bank length, with clear paths and open confluences. */
export function buildRiverbankStones(group: T.Object3D, material: T.Material, height: (x: number, z: number) => number) {
  const root = new T.Group(); root.name = "Automatic riverbank stones";
  group.updateMatrixWorld(true);
  const paving = new PlantingSurfaceMask(group, "paving"), water = new PlantingSurfaceMask(group, "water");
  const geometry = stoneGeometry(), dummy = new T.Object3D();
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
          point.addScaledVector(outward, .19 + random() * .12);
          const key = `${Math.floor(point.x)},${Math.floor(point.z)}`;
          let overlaps = false;
          for (let x = Math.floor(point.x) - 1; x <= Math.floor(point.x) + 1; x++) for (let z = Math.floor(point.z) - 1; z <= Math.floor(point.z) + 1; z++) {
            if (occupied.get(`${x},${z}`)?.some(p => Math.hypot(point.x - p.x, point.z - p.z) < .6)) overlaps = true;
          }
          if (!overlaps && !paving.covers(point.x, point.z, radius + .12) && !water.covers(point.x, point.z)) {
            dummy.position.set(point.x, Math.max(height(point.x, point.z), point.y) + .12, point.z);
            dummy.rotation.set((random() - .5) * .3, random() * Math.PI * 2, (random() - .5) * .3);
            dummy.scale.set(radius, (.23 + random() * .1) * size, (.32 + random() * .09) * size);
            dummy.updateMatrix(); matrices.push(dummy.matrix.clone());
            colors.push(new T.Color().setScalar(.92 + random() * .12));
            const cell = occupied.get(key) ?? []; cell.push(point); occupied.set(key, cell);
          }
          next += .76 + random() * .16;
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

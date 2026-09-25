import * as T from "three";
import { BRIDGE, bridgeHeight, type Collider } from "./environment";

/** Solid masonry arch, continuous paving and parapets, using the movement deck profile. */
export function buildBridge(stone: T.MeshStandardMaterial, paving: T.Material, colliders: Collider[]) {
  const bridge = new T.Group(); bridge.name = "Stone arch bridge";
  const masonry = stone.clone(); masonry.name = "Bridge limestone"; masonry.color.set("#c2c4b4");
  const { x: center, z, length, width } = BRIDGE;
  const start = center - length / 2, divisions = 64;
  function archStrip(low: number, high: number, depth: number, offsetZ: number) {
    const shape = new T.Shape();
    for (let i = 0; i <= divisions; i++) {
      const x = start + i * length / divisions;
      if (i === 0) shape.moveTo(x, bridgeHeight(x) + high);
      else shape.lineTo(x, bridgeHeight(x) + high);
    }
    for (let i = divisions; i >= 0; i--) {
      const x = start + i * length / divisions; shape.lineTo(x, bridgeHeight(x) + low);
    }
    shape.closePath();
    const geometry = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 });
    geometry.translate(0, 0, offsetZ);
    const mesh = new T.Mesh(geometry, masonry); mesh.castShadow = mesh.receiveShadow = true;
    bridge.add(mesh); return mesh;
  }
  // The underside follows the arch and leaves an actual opening over the stream.
  archStrip(-.34, 0, width + .88, z - width / 2 - .44).name = "Solid vaulted deck";
  const vertices: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let i = 0; i <= divisions; i++) {
    const x = start + i * length / divisions;
    vertices.push(x, bridgeHeight(x) + .012, z - width / 2, x, bridgeHeight(x) + .012, z + width / 2);
    uv.push(i / divisions * length / 2, 0, i / divisions * length / 2, width / 2);
    if (i < divisions) {
      const n = i * 2;
      // +Y normals: the former deck was wound downward and invisible from above.
      indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const surface = new T.Mesh(geometry, paving); surface.name = "Continuous paved crossing";
  surface.receiveShadow = true; bridge.add(surface);
  const blockGeometry = new T.BoxGeometry(1, 1, 1);
  const block = (x: number, y: number, blockZ: number, w: number, h: number, d: number) => {
    const mesh = new T.Mesh(blockGeometry, masonry); mesh.position.set(x, y, blockZ); mesh.scale.set(w, h, d);
    mesh.castShadow = mesh.receiveShadow = true; bridge.add(mesh); return mesh;
  };
  for (const side of [-1, 1]) {
    const wallZ = z + side * (width / 2 + .22);
    archStrip(0, .72, .44, wallZ - .22).name = "Continuous stone parapet";
    for (let i = 0; i < 26; i++) {
      const x = start + (i + .5) * length / 26;
      const cap = block(x, bridgeHeight(x) + .81, wallZ, length / 26 - .014, .18, .54);
      cap.rotation.z = Math.atan2(bridgeHeight(x + .01) - bridgeHeight(x - .01), .02);
    }
    for (let i = 0; i < 24; i++) {
      const x = start + (i + .5) * length / 24;
      colliders.push({ x, z: wallZ, w: length / 24, d: .44, bottom: bridgeHeight(x), top: bridgeHeight(x) + .91 });
    }
    // Bank-bound abutments and larger end stones make the crossing visibly supported.
    for (const end of [-1, 1]) {
      const x = center + end * (length / 2 - .45);
      block(x, -.24, wallZ, 1.35, .7, .72);
      const postX = center + end * (length / 2 - .17), postFloor = bridgeHeight(postX);
      block(postX, postFloor + .47, wallZ, .5, .94, .64);
      colliders.push({ x: postX, z: wallZ, w: .5, d: .64, bottom: postFloor, top: postFloor + .94 });
    }
  }
  return bridge;
}

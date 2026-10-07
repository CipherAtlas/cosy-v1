import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Static kit parts share materials but retain a prop-sized bound and authored pivot. */
export function batchStaticProp(root: T.Object3D) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert(), batches = new Map<T.Material, T.Mesh[]>();
  root.traverseVisible(object => {
    if (!(object instanceof T.Mesh) || object instanceof T.InstancedMesh || object instanceof T.SkinnedMesh || Array.isArray(object.material)) return;
    const batch = batches.get(object.material) ?? [];
    batch.push(object); batches.set(object.material, batch);
  });
  for (const [material, meshes] of batches) {
    if (meshes.length < 2) continue;
    const parts = meshes.map(mesh => {
      const part = mesh.geometry.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
      if (!part.index) part.setIndex(Array.from({ length: part.attributes.position.count }, (_, index) => index));
      return part;
    });
    const geometry = mergeGeometries(parts); parts.forEach(part => part.dispose());
    if (!geometry) continue;
    const mesh = new T.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true;
    meshes.forEach(part => part.removeFromParent()); root.add(mesh);
  }
}

/** Only explicitly static props: retain geometry, materials and transforms in cullable cells. */
export function instanceStaticProps(roots: T.Object3D[], parent: T.Object3D, cellSize = 32) {
  parent.updateMatrixWorld(true);
  const inverse = parent.matrixWorld.clone().invert(), matrix = new T.Matrix4();
  const batches = new Map<T.BufferGeometry, Map<T.Material | T.Material[], Map<string, {
    source: T.Mesh; transforms: T.Matrix4[]; colors: T.Color[];
  }>>>();
  const remove: T.Mesh[] = [];
  const retain = new Set<T.Mesh>();
  for (const root of roots) root.traverseVisible(object => {
    if (!(object instanceof T.Mesh) || object instanceof T.SkinnedMesh || object instanceof T.BatchedMesh || object.morphTargetInfluences?.length) return;
    if ((Array.isArray(object.material) ? object.material : [object.material]).some(material => material.transparent)
      || object.matrixWorld.determinant() < 0) return;
    let materials = batches.get(object.geometry);
    if (!materials) { materials = new Map(); batches.set(object.geometry, materials); }
    let cells = materials.get(object.material);
    if (!cells) { cells = new Map(); materials.set(object.material, cells); }
    const local = inverse.clone().multiply(object.matrixWorld);
    const instanced = object instanceof T.InstancedMesh;
    for (let i = 0; i < (instanced ? object.count : 1); i++) {
      if (instanced) { object.getMatrixAt(i, matrix); matrix.premultiply(local); }
      else matrix.copy(local);
      const key = `${Math.floor(matrix.elements[12] / cellSize)},${Math.floor(matrix.elements[14] / cellSize)},${object.castShadow},${object.receiveShadow},${object.renderOrder},${object.customDepthMaterial?.uuid ?? ""},${object.layers.mask}`;
      let cell = cells.get(key);
      if (!cell) { cell = { source: object, transforms: [], colors: [] }; cells.set(key, cell); }
      cell.transforms.push(matrix.clone());
      const color = new T.Color();
      if (instanced && object.instanceColor) object.getColorAt(i, color);
      cell.colors.push(color);
    }
    remove.push(object);
  });
  for (const materials of batches.values()) for (const cells of materials.values()) for (const cell of cells.values()) {
    const { source, transforms, colors } = cell;
    if (transforms.length === 1 && !(source instanceof T.InstancedMesh)) { retain.add(source); continue; }
    const mesh = new T.InstancedMesh(source.geometry, source.material, transforms.length);
    mesh.name = `Static props ${source.parent?.name || source.name || "cell"}`;
    mesh.castShadow = source.castShadow; mesh.receiveShadow = source.receiveShadow;
    mesh.customDepthMaterial = source.customDepthMaterial; mesh.renderOrder = source.renderOrder; mesh.layers.mask = source.layers.mask;
    mesh.userData = { ...source.userData };
    transforms.forEach((transform, i) => { mesh.setMatrixAt(i, transform); mesh.setColorAt(i, colors[i]); });
    mesh.computeBoundingSphere(); parent.add(mesh);
  }
  for (const mesh of remove) if (!retain.has(mesh)) { mesh.removeFromParent(); if (mesh instanceof T.InstancedMesh) mesh.dispose(); }
}

export function spatialMesh(geometry: T.BufferGeometry, material: T.Material, cellSize: number) {
  const cells = geometryCells(geometry, cellSize);
  const root = new T.Group();
  for (const cell of cells) { const mesh = new T.Mesh(cell, material); mesh.receiveShadow = true; root.add(mesh); }
  return root;
}

export function spatialBatch(geometry: T.BufferGeometry, material: T.Material, cellSize: number) {
  const cells = geometryCells(geometry, cellSize);
  const mesh = new T.BatchedMesh(cells.length,
    cells.reduce((sum, cell) => sum + cell.getAttribute("position").count, 0),
    cells.reduce((sum, cell) => sum + cell.index!.count, 0), material);
  mesh.geometry.userData = { ...geometry.userData };
  for (const cell of cells) { mesh.addInstance(mesh.addGeometry(cell)); cell.dispose(); }
  mesh.computeBoundingSphere(); return mesh;
}

/** Keep the original triangles, UVs and normals; give each region its own culling bounds. */
export function geometryCells(geometry: T.BufferGeometry, cellSize: number) {
  const position = geometry.getAttribute("position"), index = geometry.index;
  const cells = new Map<string, number[]>();
  const count = index?.count ?? position.count;
  for (let i = 0; i < count; i += 3) {
    const a = index ? index.getX(i) : i, b = index ? index.getX(i + 1) : i + 1, c = index ? index.getX(i + 2) : i + 2;
    const x = (position.getX(a) + position.getX(b) + position.getX(c)) / 3;
    const z = (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3;
    const key = `${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`;
    let vertices = cells.get(key);
    if (!vertices) { vertices = []; cells.set(key, vertices); }
    vertices.push(a, b, c);
  }
  const result: T.BufferGeometry[] = [];
  for (const [key, vertices] of cells) {
    const remap = new Map<number, number>(), originals: number[] = [], indices: number[] = [];
    for (const vertex of vertices) {
      let mapped = remap.get(vertex);
      if (mapped === undefined) { mapped = originals.length; originals.push(vertex); remap.set(vertex, mapped); }
      indices.push(mapped);
    }
    const cell = new T.BufferGeometry();
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      const data = attribute.array.slice(0, originals.length * attribute.itemSize);
      originals.forEach((vertex, i) => {
        for (let component = 0; component < attribute.itemSize; component++)
          data[i * attribute.itemSize + component] = attribute.array[vertex * attribute.itemSize + component];
      });
      cell.setAttribute(name, new T.BufferAttribute(data, attribute.itemSize, attribute.normalized));
    }
    cell.setIndex(indices); cell.userData = { ...geometry.userData };
    cell.name = key; cell.computeBoundingSphere(); result.push(cell);
  }
  return result;
}

/** Static plants keep their local transforms and wind shader, including shadow-pass culling. */
export function instanceCells(mesh: T.InstancedMesh, cellSize: number, name: string, windMargin = .5) {
  const cells = new Map<string, number[]>(), matrix = new T.Matrix4(), color = new T.Color();
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix);
    // Planting masks encode cleared instances with zero scale; never submit those vertices.
    if (matrix.elements[0] === 0 && matrix.elements[1] === 0 && matrix.elements[2] === 0) continue;
    const key = `${Math.floor(matrix.elements[12] / cellSize)},${Math.floor(matrix.elements[14] / cellSize)}`;
    let indices = cells.get(key);
    if (!indices) { indices = []; cells.set(key, indices); }
    indices.push(i);
  }
  const result: T.InstancedMesh[] = [];
  for (const [key, indices] of cells) {
    const cell = new T.InstancedMesh(mesh.geometry, mesh.material, indices.length);
    cell.name = `${name} ${key}`; cell.userData = { ...mesh.userData };
    cell.position.copy(mesh.position); cell.quaternion.copy(mesh.quaternion); cell.scale.copy(mesh.scale);
    cell.castShadow = mesh.castShadow; cell.receiveShadow = mesh.receiveShadow;
    cell.customDepthMaterial = mesh.customDepthMaterial;
    indices.forEach((index, i) => {
      mesh.getMatrixAt(index, matrix); cell.setMatrixAt(i, matrix);
      if (mesh.instanceColor) { mesh.getColorAt(index, color); cell.setColorAt(i, color); }
    });
    cell.computeBoundingSphere();
    if (cell.boundingSphere) cell.boundingSphere.radius += windMargin;
    mesh.parent!.add(cell); result.push(cell);
  }
  mesh.removeFromParent(); mesh.dispose();
  return result;
}

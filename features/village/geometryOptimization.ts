/// <reference path="./meshoptSimplifier.d.ts" />
import * as T from "three";
import { MeshoptSimplifier } from "three/addons/libs/meshopt_simplifier.module.js";
import { waitForVillageLoad } from "./assetLoading";

/** Collapse redundant static edges with bounded error; retain every original vertex attribute. */
export async function optimizeGeometry(geometry: T.BufferGeometry, error = .0001, signal?: AbortSignal) {
  if (signal?.aborted) throw signal.reason;
  if (!MeshoptSimplifier.supported || !geometry.index || geometry.index.count < 600) return;
  await waitForVillageLoad(MeshoptSimplifier.ready, signal);
  if (signal?.aborted) throw signal.reason;
  const position = geometry.getAttribute("position");
  const positions = Float32Array.from(position.array);
  const fields = ["normal", "uv", "color"].flatMap(name => {
    const attribute = geometry.getAttribute(name);
    return attribute ? [attribute] : [];
  });
  const stride = fields.reduce((sum, attribute) => sum + attribute.itemSize, 0);
  const attributes = new Float32Array(position.count * stride);
  const weights = fields.flatMap(attribute => Array(attribute.itemSize).fill(.5));
  for (let i = 0; i < position.count; i++) {
    let offset = i * stride;
    for (const attribute of fields) for (let component = 0; component < attribute.itemSize; component++)
      attributes[offset++] = attribute.getComponent(i, component);
  }
  const [indices] = MeshoptSimplifier.simplifyWithAttributes(Uint32Array.from(geometry.index.array), positions, 3,
    attributes, stride, weights, null, Math.floor(geometry.index.count * .35 / 3) * 3, error, ["LockBorder"]);
  geometry.setIndex(new T.BufferAttribute(indices, 1));
}

export async function optimizeGardenGeometry(root: T.Object3D, signal?: AbortSignal) {
  const geometries = new Set<T.BufferGeometry>();
  root.traverse(object => { if (object instanceof T.InstancedMesh) geometries.add(object.geometry); });
  await Promise.all([...geometries].map(geometry => optimizeGeometry(geometry, .002, signal)));
}

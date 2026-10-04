import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { WorldItem } from "./worldLayout";

import { MEADOW_WIDTH, MEADOW_FLOWER_COUNT } from "./worldLayout";
export { MEADOW_WIDTH, MEADOW_GRASS_COUNT, MEADOW_FLOWER_COUNT, townPlantingClearance } from "./worldLayout";

/** Native meadow footprints keep small plants small as the town grows. */
export function meadowFlowers(zones: WorldItem[], height: (x: number, z: number) => number,
  clear: (x: number, z: number) => boolean = () => false) {
  const stem = new T.CylinderGeometry(.009, .015, .46, 4); stem.translate(0, .23, 0);
  const leaves: T.BufferGeometry[] = [stem];
  for (const side of [-1, 1]) {
    const leaf = new T.PlaneGeometry(.13, .055); leaf.rotateX(-.6); leaf.rotateZ(side * .45); leaf.translate(side * .045, .15, 0); leaves.push(leaf);
  }
  const stemGeometry = mergeGeometries(leaves)!; leaves.forEach(part => part.dispose());
  const parts: T.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const petal = new T.CircleGeometry(.045, 6); petal.scale(.7, 1.35, 1); petal.rotateX(-Math.PI / 2);
    petal.translate(0, 0, .055); petal.rotateY(i * Math.PI / 3); parts.push(petal);
  }
  const geometry = mergeGeometries(parts)!; parts.forEach(part => part.dispose());
  const count = zones.length * MEADOW_FLOWER_COUNT;
  const stems = new T.InstancedMesh(stemGeometry, new T.MeshStandardMaterial({ color: "#597848", side: T.DoubleSide, roughness: 1 }), count);
  const flowers = new T.InstancedMesh(geometry, new T.MeshStandardMaterial({ color: "#fff2d1", side: T.DoubleSide, roughness: .95 }), count);
  for (const mesh of [stems, flowers]) { mesh.geometry.userData.groundPlant = true; mesh.geometry.userData.plantingRadius = .16; }
  const dummy = new T.Object3D(); let filled = 0;
  for (const zone of zones) {
    let seed = [...zone.id].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const yaw = zone.rotation[1] * Math.PI / 180;
    for (let i = 0; i < MEADOW_FLOWER_COUNT; i++) {
      const angle = random() * Math.PI * 2, radius = Math.sqrt(random()) * MEADOW_WIDTH / 2;
      const lx = Math.cos(angle) * radius * zone.scale[0], lz = Math.sin(angle) * radius * zone.scale[2];
      const x = zone.position[0] + lx * Math.cos(yaw) + lz * Math.sin(yaw), z = zone.position[2] - lx * Math.sin(yaw) + lz * Math.cos(yaw);
      if (clear(x, z)) continue;
      const scale = .65 + random() * .65;
      dummy.position.set(x, height(x, z), z); dummy.rotation.set(0, random() * Math.PI * 2, 0);
      dummy.scale.setScalar(scale); dummy.scale.y *= zone.scale[1]; dummy.updateMatrix(); stems.setMatrixAt(filled, dummy.matrix);
      dummy.position.y += .46 * dummy.scale.y; dummy.updateMatrix(); flowers.setMatrixAt(filled, dummy.matrix);
      flowers.setColorAt(filled++, new T.Color(["#fff2d1", "#e9bbaa", "#d2bce3", "#f5d784"][i % 4]));
    }
  }
  stems.count = flowers.count = filled; stems.receiveShadow = flowers.receiveShadow = true;
  const root = new T.Group(); root.name = "Meadow wildflowers"; root.add(stems, flowers); return root;
}

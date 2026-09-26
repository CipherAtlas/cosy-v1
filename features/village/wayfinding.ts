import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { floorHeight, type Collider } from "./environment";
import { JAPANESE_PLACE_NAMES, PLACES } from "./places";

/** Small timber fingerposts at the entrance and the two real route choices. */
export function buildWayfinding(colliders: Collider[]) {
  const group = new T.Group(); group.name = "Village wayfinding";
  const wood = new T.MeshStandardMaterial({ color: "#795139", roughness: .95 });
  const labels: { canvas: HTMLCanvasElement; texture: T.CanvasTexture; index: number; arrow: string }[] = [];
  const add = (parent: T.Group, geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z: number) => {
    const mesh = new T.Mesh(geometry, material); mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const board = (parent: T.Group, index: number, arrow: string, y: number) => {
    const width = 2.1, height = .36;
    const outline = new T.Shape();
    outline.moveTo(-width / 2 + .08, -height / 2);
    outline.lineTo(width / 2 - .06, -height / 2);
    outline.lineTo(width / 2, -height / 2 + .06);
    outline.lineTo(width / 2 - .015, height / 2 - .045);
    outline.lineTo(width / 2 - .07, height / 2);
    outline.lineTo(-width / 2 + .02, height / 2 - .015);
    outline.lineTo(-width / 2, -height / 2 + .07); outline.closePath();
    add(parent, new T.ExtrudeGeometry(outline, { depth: .18, bevelEnabled: false }), wood, 0, y, -.09);
    for (const side of [1, -1]) {
      const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = 176;
      const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 8;
      const material = new T.MeshStandardMaterial({ map: texture, transparent: true, roughness: 1 });
      const face = add(parent, new T.PlaneGeometry(width - .18, height - .025), material, 0, y, side * .094);
      face.rotation.y = side < 0 ? Math.PI : 0; face.castShadow = false;
      const opposite: Record<string, string> = { "←": "→", "→": "←", "↑": "↓", "↓": "↑", "↗": "↙" };
      labels.push({ canvas, texture, index, arrow: side > 0 ? arrow : opposite[arrow] ?? arrow });
    }
  };
  const post = (name: string, x: number, z: number, rotation: number, indices: number[], arrows: string[]) => {
    const root = new T.Group(); root.name = name;
    root.position.set(x, floorHeight(x, z), z); root.rotation.y = rotation;
    root.userData.signpost = true; group.add(root);
    const height = 1.35 + (indices.length - 1) * .43;
    add(root, new T.CylinderGeometry(.06, .095, height, 7), wood, 0, height / 2, 0);
    indices.forEach((index, row) => board(root, index, arrows[row], height - .13 - row * .43));
    root.updateMatrixWorld(true);
    // Include the planks, not just the pole, in collision and camera occlusion.
    const bounds = new T.Box3().setFromObject(root), size = bounds.getSize(new T.Vector3()), center = bounds.getCenter(new T.Vector3());
    colliders.push({ x: center.x, z: center.z, w: size.x, d: size.z, top: bounds.max.y });
  };
  post("Entrance fingerpost", -2.9, 16, .12, [0, 1], ["↗", "↑"]);
  post("Bridge and garden fingerpost", 4.3, 6.2, -.12, [4, 2, 3], ["←", "←", "↗"]);
  post("Waterside fingerpost", -23.2, -.3, .12, [2, 4], ["↑", "↓"]);

  // Keep translated faces separate, and batch all of the shared timber.
  group.updateMatrixWorld(true);
  const meshes: T.Mesh[] = [];
  group.traverse(object => { if (object instanceof T.Mesh && object.material === wood) meshes.push(object); });
  const parts = meshes.map(mesh => (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(mesh.matrixWorld));
  const geometry = mergeGeometries(parts, false)!;
  parts.forEach(part => part.dispose());
  meshes.forEach(mesh => { mesh.removeFromParent(); mesh.geometry.dispose(); });
  add(group, geometry, wood, 0, 0, 0);

  const setLanguage = (language: "en" | "ja") => {
    labels.forEach(({ canvas, texture, index, arrow }) => {
      const c = canvas.getContext("2d")!, w = canvas.width, h = canvas.height;
      c.clearRect(0, 0, w, h);
      c.strokeStyle = "#d6ac7638"; c.lineWidth = 2;
      for (let line = 0; line < 4; line++) {
        c.beginPath(); c.moveTo(12, 14 + line * 48);
        c.bezierCurveTo(w * .3, 8 + line * 48, w * .7, 23 + line * 48, w - 12, 15 + line * 48); c.stroke();
      }
      c.fillStyle = "#fff0c9"; c.textBaseline = "middle"; c.textAlign = "center";
      c.font = "76px Georgia, serif"; c.fillText(arrow, 66, h / 2);
      c.textAlign = "left"; c.font = `${language === "ja" ? 65 : 73}px Georgia, serif`;
      c.fillText(language === "ja" ? JAPANESE_PLACE_NAMES[index] : PLACES[index].name, 132, h / 2, w - 155);
      texture.needsUpdate = true;
    });
  };
  setLanguage("en"); return { group, setLanguage };
}

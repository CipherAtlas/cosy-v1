import * as T from "three";
import { LOOKOUT_HEIGHT } from "./towerLookout";

/** The runtime and editor capture the same complete tower, including its open gallery. */
export function buildTower(materials: { plaster: T.Material; trim: T.Material; wood: T.Material; darkWood: T.Material; roof: T.Material; glass: T.Material }) {
  const root = new T.Group();
  const mesh = (geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z: number) => {
    const object = new T.Mesh(geometry, material);
    object.position.set(x, y, z); object.castShadow = object.receiveShadow = true;
    root.add(object); return object;
  };
  mesh(new T.CylinderGeometry(2.3, 2.6, LOOKOUT_HEIGHT - .15, 24), materials.plaster, 0, (LOOKOUT_HEIGHT - .15) / 2, 0);
  mesh(new T.CylinderGeometry(3.6, 3.35, .25, 32), materials.trim, 0, LOOKOUT_HEIGHT - .205, 0);
  mesh(new T.CylinderGeometry(3.48, 3.48, .08, 32), materials.wood, 0, LOOKOUT_HEIGHT - .04, 0);
  for (const y of [1, 7.5]) mesh(new T.CylinderGeometry(2.48, 2.48, .16, 24), materials.trim, 0, y, 0);
  // Low open rails keep the town visible beneath the horizon, including steep downward views.
  for (let i = 0; i < 32; i++) {
    const a = i * Math.PI / 16, b = (i + 1) * Math.PI / 16;
    const x = Math.sin(a) * 3.4, z = Math.cos(a) * 3.4;
    mesh(new T.CylinderGeometry(.035, .045, .78, 6), materials.trim, x, LOOKOUT_HEIGHT + .39, z);
    for (const y of [.18, .8]) {
      const rail = mesh(new T.BoxGeometry(Math.sin(Math.PI / 32) * 6.8, .07, .08), materials.wood,
        (x + Math.sin(b) * 3.4) / 2, LOOKOUT_HEIGHT + y, (z + Math.cos(b) * 3.4) / 2);
      rail.rotation.y = (a + b) / 2;
    }
    if (i % 4 === 2) {
      mesh(new T.CylinderGeometry(.07, .1, 2.8, 8), materials.darkWood, x, LOOKOUT_HEIGHT + 1.4, z);
      const bracket = mesh(new T.BoxGeometry(.1, .7, .1), materials.wood, x * .96, LOOKOUT_HEIGHT + 2.35, z * .96);
      bracket.rotation.z = .5;
    }
  }
  mesh(new T.LatheGeometry([new T.Vector2(3.85,14.1),new T.Vector2(3.5,14.4),new T.Vector2(1.8,16.2),new T.Vector2(.7,18.6),new T.Vector2(.05,20.5)],32), materials.roof, 0, 0, 0);
  mesh(new T.SphereGeometry(.2, 8, 6), materials.trim, 0, 20.6, 0);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const window = mesh(new T.BoxGeometry(.6, 1.5, .1), materials.glass, Math.sin(a) * 2.38, 8.9, Math.cos(a) * 2.38);
    window.rotation.y = a;
  }
  // A warm timber door and stone lintel make the approach legible from the lane.
  mesh(new T.BoxGeometry(1.05, 2.15, .12), materials.darkWood, 0, 1.08, 2.61);
  for (const x of [-.61, .61]) mesh(new T.BoxGeometry(.16, 2.3, .22), materials.trim, x, 1.15, 2.63);
  mesh(new T.BoxGeometry(1.38, .18, .22), materials.trim, 0, 2.3, 2.63);
  mesh(new T.SphereGeometry(.055, 8, 6), materials.trim, .32, 1.03, 2.72);
  return root;
}

import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { makeFlame } from "./flame";
import { cottageMaterials, makeBridgeWindow, makeCoffeeCup, makeDeskInkwell, makeDeskJournal, makeCottageCouch, makeCottageLamp, makeCottageFern, makeCottagePrint, makeCatCushion, makeCottageChair, makeCottageBooks, makeCottagePottery, makeCottageWallShelf } from "./focusCottageProps";

export function buildFocusCottage(scene: T.Scene, indoorLight: T.PointLight, flames: T.Mesh[]) {
    // Indoor surfaces use their own subtle textures and metre-scaled UVs.
    const g = new T.Group();
    g.position.set(110, 0, 0);
    scene.add(g);
    const coffeeSteam: T.Mesh[] = [];
    g.visible = false;
    const surfaces = cottageMaterials();
    const wooden = surfaces.wood, stone = surfaces.stone, plaster = surfaces.plaster;
    const cube = (
      m: T.Material,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
    ) => {
      const geometry = new T.BoxGeometry(w, h, d), p = geometry.attributes.position, n = geometry.attributes.normal, uv = geometry.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        if (Math.abs(n.getY(i)) > .5) uv.setXY(i, (p.getX(i) + x) / 2, (p.getZ(i) + z) / 2);
        else if (Math.abs(n.getZ(i)) > .5) uv.setXY(i, (p.getX(i) + x) / 2, (p.getY(i) + y) / 2);
        else uv.setXY(i, (p.getZ(i) + z) / 2, (p.getY(i) + y) / 2);
      }
      const o = new T.Mesh(geometry, m);
      o.position.set(x, y, z);
      o.receiveShadow = true;
      o.castShadow = true;
      g.add(o);
      return o;
    };
    cube(surfaces.floor, 0, -0.13, 0, 9, 0.2, 9);
    cube(wooden, 0, 4.9, 0, 9, 0.15, 9);
    cube(plaster, 0, 2.5, -4.5, 9, 5, 0.25);
    cube(plaster, 0, 2.5, 4.5, 9, 5, 0.25);
    cube(plaster, 4.5, 2.5, 0, 0.25, 5, 9);
    cube(plaster, -4.5, 2.5, 0, 0.25, 5, 9);
    const panel = surfaces.plaster.clone(); panel.color.set("#788679");
    // The room remains enclosed when the focus camera is dragged around the desk.
    for (const z of [-4.31, 4.31]) {
      cube(panel, 0, .58, z, 8.8, 1.16, .085);
      cube(wooden, 0, 1.2, z + (z > 0 ? -.07 : .07), 8.8, .11, .15);
      for (let x = -4.25; x <= 4.25; x += .85) cube(wooden, x, .55, z + (z > 0 ? -.07 : .07), .055, 1.05, .11);
    }
    for (const x of [-4.31, 4.31]) {
      cube(panel, x, .58, 0, .085, 1.16, 8.8);
      cube(wooden, x + (x > 0 ? -.07 : .07), 1.2, 0, .15, .11, 8.8);
      for (let z = -4.25; z <= 4.25; z += .85) cube(wooden, x + (x > 0 ? -.07 : .07), .55, z, .11, 1.05, .055);
    }
    for (const x of [-4, -2, 0, 2, 4]) {
      cube(wooden, x, 4.5, 0, 0.2, 0.2, 9);
    }
    for (const x of [-4, 0, 2, 4]) cube(wooden, x, 2.2, -4.3, 0.18, 4.5, 0.18);
    const bridgeWindow = new T.WebGLRenderTarget(400, 345, { depthBuffer: true });
    bridgeWindow.texture.colorSpace = T.SRGBColorSpace;
    const window = makeBridgeWindow(bridgeWindow.texture);
    window.position.set(-2.1, 1.23, -4.12);
    g.add(window);
    cube(wooden, -1.6, 1, -2, 3.4, 0.16, 1.4);
    for (const x of [-2.85, -0.35])
      for (const z of [-2.5, -1.5]) cube(wooden, x, 0.45, z, 0.12, 0.95, 0.12);
    const journal = makeDeskJournal();
    journal.position.set(-1.55, 1.08, -1.95);
    journal.rotation.y = .12;
    g.add(journal);
    const inkwell = makeDeskInkwell();
    inkwell.position.set(-1.15, 1.08, -2.36);
    g.add(inkwell);
    const coffeeCup = makeCoffeeCup();
    coffeeCup.position.set(-.72, 1.08, -2.43);
    coffeeCup.traverse(object => {
      if (object instanceof T.Mesh && object.name.startsWith("Coffee steam")) coffeeSteam.push(object);
    });
    g.add(coffeeCup);
    cube(stone, 2.7, 1.35, -4.05, 2.5, 2.7, 0.65);
    cube(
      new T.MeshBasicMaterial({ color: "#271b12" }),
      2.7,
      0.75,
      -3.7,
      1.65,
      1.45,
      0.02,
    );
    const embers=new T.MeshStandardMaterial({color:"#6b2b12",emissive:"#f27b23",emissiveIntensity:1.1,roughness:1});
    const charred=wooden.clone();charred.color.set("#3a2117");charred.roughness=1;
    for(let i=0;i<5;i++) {
      const log=new T.Mesh(new T.CylinderGeometry(.095,.13,1.05,10),charred);
      log.position.set(2.7+Math.sin(i*2.3)*.22,.38+(i%2)*.12,-3.38+Math.cos(i*2.3)*.14);
      log.rotation.set(Math.PI/2,i*.9,.14);log.castShadow=log.receiveShadow=true;g.add(log);
    }
    for(let i=0;i<16;i++) {
      const ember=new T.Mesh(new T.IcosahedronGeometry(.075+(i%3)*.016,0),embers);
      ember.position.set(2.7+Math.sin(i*2.4)*.57,.32,-3.42+Math.cos(i*2.4)*.24);ember.scale.y=.45;g.add(ember);
    }
    const hearthGlow = new T.Mesh(new T.PlaneGeometry(1.55, 1.3), new T.MeshBasicMaterial({ color: "#ff9f4c", transparent: true, opacity: .28, depthWrite: false }));
    hearthGlow.position.set(2.7, .87, -3.67); g.add(hearthGlow);
    const firelight = new T.Mesh(new T.CircleGeometry(1.5, 32), new T.MeshBasicMaterial({ color: "#ffb663", transparent: true, opacity: .14, depthWrite: false }));
    firelight.rotation.x = -Math.PI / 2; firelight.scale.y = .55; firelight.position.set(2.4, .025, -2.25); g.add(firelight);
    cube(wooden, 2.7, 2.75, -3.9, 2.8, 0.18, 0.9);
    const f = makeFlame(1.2, 1.1);
    f.position.set(112.7, .82, -3.38);scene.add(f);
    f.visible=false;f.userData.interior=true;f.userData.light=indoorLight;f.userData.coal=embers;
    flames.push(f);
    const cloth = surfaces.rug, linen = surfaces.linen;
    cube(cloth, -.6, .006, .1, 4.8, .018, 3.2);
    for (const z of [-1.37, -1.25, 1.42, 1.54]) cube(linen, -.6, .021, z, 4.6, .012, .025);
    for (const x of [-2.85, 1.65]) cube(linen, x, .021, .1, .025, .012, 2.85);
    for (const x of [-2.95, 1.75]) for (let i = 0; i < 36; i++) cube(linen, x, .019, -1.35 + i * .083, .12, .012, .015);
    const chair = makeCottageChair(surfaces); chair.position.set(-1.4, 0, -.7); g.add(chair);
    for (const side of [-1, 1]) for (let row = 0; row < 5; row++) cube(stone, 2.7 + side * 1.02, .23 + row * .44, -3.53, .35, .39, .42);
    for (let i = 0; i < 7; i++) cube(stone, 1.84 + i * .285, 2.4, -3.48, .26, .3, .48);
    cube(wooden, 1.5, 3.45, -4.04, 3.4, .12, .55);
    const pottery = makeCottagePottery(); pottery.position.set(2.35, 3.51, -4.02); g.add(pottery);
    const mantelBooks = makeCottageBooks(); mantelBooks.position.set(.45, 3.51, -4.02); g.add(mantelBooks);
    const bookShelf = makeCottageWallShelf(surfaces); bookShelf.position.set(.65, 2.16, -4.02); g.add(bookShelf);
    const upperShelf = makeCottageWallShelf(surfaces, "pottery"); upperShelf.position.set(.65, 2.94, -4.02); g.add(upperShelf);
    const cushion = makeCatCushion(surfaces); cushion.position.set(.5, 0, -.3); g.add(cushion);
    const couch = makeCottageCouch(surfaces); couch.position.set(3.5, 0, -.4); couch.rotation.y = -Math.PI / 2; g.add(couch);
    const lamp = makeCottageLamp(); lamp.position.set(3.5, 0, -2.2); g.add(lamp);
    const fern = makeCottageFern(); fern.position.set(3.65, 0, 1.55); g.add(fern);
    const print = makeCottagePrint(); print.position.set(4.15, 1.75, -.5); print.rotation.y = -Math.PI / 2; g.add(print);
    const windowBounce = new T.PointLight("#ffe1b5", 5, 8, 2);
    windowBounce.position.set(-2.1, 2.7, -3.3); g.add(windowBounce);
    const lampGlow = new T.PointLight("#ffd4a0", 2.3, 4, 2); lampGlow.position.set(3.5, 1.6, -2.2); g.add(lampGlow);
    // Batch static furniture while retaining light and flame objects independently.
    g.updateMatrixWorld(true);
    const interiorInverse = g.matrixWorld.clone().invert();
    const batches = new Map<T.Material, T.BufferGeometry[]>();
    const pieces: T.Mesh[] = [];
    g.traverse(o => {
      if (!(o instanceof T.Mesh) || Array.isArray(o.material) || o.material.transparent) return;
      const geometry = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(interiorInverse.clone().multiply(o.matrixWorld));
      const list = batches.get(o.material) ?? []; list.push(geometry); batches.set(o.material, list); pieces.push(o);
    });
    pieces.forEach(o => { o.removeFromParent(); o.geometry.dispose(); });
    batches.forEach((parts, material) => {
      const geometry = mergeGeometries(parts); parts.forEach(p => p.dispose());
      if (geometry) { const mesh = new T.Mesh(geometry, material); mesh.receiveShadow = mesh.castShadow = true; g.add(mesh); }
    });
    indoorLight.position.set(112.7, 2, -2.8);
    return { group: g, bridgeWindow, coffeeSteam };
}

import * as T from "three";

export function makeCoffeeCup() {
  const cup = new T.Group();
  cup.name = "Coffee cup";
  const ceramic = new T.MeshPhysicalMaterial({ color: "#e9d9bd", roughness: .26, clearcoat: .3, clearcoatRoughness: .35 });
  const rim = new T.MeshStandardMaterial({ color: "#a56f4f", roughness: .5 });
  const coffee = new T.MeshStandardMaterial({ color: "#3c2419", roughness: .18 });
  const saucer = new T.Mesh(new T.LatheGeometry([
    new T.Vector2(0, .012), new T.Vector2(.14, .012), new T.Vector2(.18, .018),
    new T.Vector2(.215, .028), new T.Vector2(.225, .04), new T.Vector2(.21, .047),
  ], 32), ceramic);
  cup.add(saucer);
  const saucerLine = new T.Mesh(new T.TorusGeometry(.172, .003, 5, 32), rim);
  saucerLine.rotation.x = Math.PI / 2; saucerLine.position.y = .033; cup.add(saucerLine);
  const body = new T.Mesh(new T.LatheGeometry([
    new T.Vector2(.085, .035), new T.Vector2(.115, .05), new T.Vector2(.13, .09),
    new T.Vector2(.15, .225), new T.Vector2(.148, .248), new T.Vector2(.134, .257),
    new T.Vector2(.124, .235), new T.Vector2(.105, .09), new T.Vector2(.07, .065),
  ], 32), ceramic);
  cup.add(body);
  const lip = new T.Mesh(new T.TorusGeometry(.141, .005, 6, 32), rim);
  lip.rotation.x = Math.PI / 2; lip.position.y = .251; cup.add(lip);
  const drink = new T.Mesh(new T.CircleGeometry(.12, 32), coffee);
  drink.rotation.x = -Math.PI / 2; drink.position.y = .222; cup.add(drink);
  const crema = new T.Mesh(new T.TorusGeometry(.113, .002, 5, 32), rim);
  crema.rotation.x = Math.PI / 2; crema.position.y = .224; cup.add(crema);
  const handle = new T.Mesh(new T.TorusGeometry(.086, .019, 10, 28), ceramic);
  handle.position.set(.169, .15, 0); handle.scale.x = .82; cup.add(handle);
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * .055;
    const path = new T.CatmullRomCurve3([
      new T.Vector3(0, 0, 0), new T.Vector3(.018, .09, .005),
      new T.Vector3(-.018, .19, -.008), new T.Vector3(.025, .32, 0),
    ]);
    const material = new T.MeshBasicMaterial({ color: "#796c60", transparent: true, opacity: .35, depthWrite: false });
    const steam = new T.Mesh(new T.TubeGeometry(path, 18, .016, 6, false), material);
    steam.name = `Coffee steam ${i + 1}`;
    steam.userData.baseX = x;
    steam.position.set(x, .265, (i - 1) * .018);
    cup.add(steam);
  }
  return cup;
}

export function makeDeskJournal() {
  const journal = new T.Group();
  journal.name = "Open writing journal";
  const cover = new T.MeshStandardMaterial({ color: "#6d7663", roughness: .94 });
  const page = new T.MeshStandardMaterial({ color: "#efe5ce", roughness: 1 });
  const pageEdge = new T.MeshStandardMaterial({ color: "#d3c4a8", roughness: 1 });
  const writing = new T.MeshStandardMaterial({ color: "#8f806c", roughness: 1 });
  const box = (material: T.Material, x: number, y: number, z: number, w: number, h: number, d: number) => {
    const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); journal.add(mesh);
  };
  box(cover, 0, .018, 0, .94, .035, .65);
  for (const x of [-.23, .23]) {
    box(pageEdge, x, .047, 0, .445, .025, .585);
    box(page, x, .063, 0, .435, .008, .575);
  }
  box(cover, 0, .073, 0, .018, .01, .58);
  for (const x of [-.23, .23]) {
    for (let line = 0; line < 5; line++) {
      const width = line === 4 ? .22 : .31 - (line % 2) * .035;
      box(writing, x - (.31 - width) / 2, .07, -.19 + line * .087, width, .002, .005);
    }
  }
  box(cover, -.36, .069, .305, .055, .004, .12);
  return journal;
}

export function makeDeskInkwell() {
  const inkwell = new T.Group();
  inkwell.name = "Desk inkwell";
  const ceramic = new T.MeshPhysicalMaterial({ color: "#425c59", roughness: .28, clearcoat: .25 });
  const brass = new T.MeshStandardMaterial({ color: "#ab8554", metalness: .45, roughness: .42 });
  const bottle = new T.Mesh(new T.LatheGeometry([
    new T.Vector2(.075, .015), new T.Vector2(.105, .03), new T.Vector2(.105, .1),
    new T.Vector2(.072, .145), new T.Vector2(.058, .16),
  ], 20), ceramic);
  inkwell.add(bottle);
  const neck = new T.Mesh(new T.TorusGeometry(.06, .008, 6, 20), brass);
  neck.rotation.x = Math.PI / 2; neck.position.y = .155; inkwell.add(neck);
  const ink = new T.Mesh(new T.CircleGeometry(.052, 20), new T.MeshStandardMaterial({ color: "#1b302d", roughness: .18 }));
  ink.rotation.x = -Math.PI / 2; ink.position.y = .143; inkwell.add(ink);
  return inkwell;
}

export function makeDeskQuill() {
  const quill = new T.Group();
  quill.name = "Desk quill";
  const shaft = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([
    new T.Vector3(0, 0, 0), new T.Vector3(.012, .17, 0),
    new T.Vector3(-.025, .38, 0), new T.Vector3(-.045, .53, 0),
  ]), 20, .007, 6, false), new T.MeshStandardMaterial({ color: "#d7c4a0", roughness: .9 }));
  quill.add(shaft);
  const outline = new T.Shape();
  outline.moveTo(.005, .16);
  outline.bezierCurveTo(-.09, .23, -.125, .37, -.045, .53);
  outline.bezierCurveTo(.04, .48, .1, .34, .005, .16);
  const vane = new T.Mesh(new T.ShapeGeometry(outline, 18), new T.MeshStandardMaterial({ color: "#648d87", roughness: .95, side: T.DoubleSide }));
  vane.position.z = -.003; quill.add(vane);
  return quill;
}

export function makeFocusHourglass() {
  const hourglass = new T.Group();
  hourglass.name = "Focus hourglass";
  const brass = new T.MeshStandardMaterial({ color: "#ba9159", metalness: .45, roughness: .43 });
  const sand = new T.MeshStandardMaterial({ color: "#d9bb76", roughness: 1 });
  const glass = new T.MeshPhysicalMaterial({ color: "#d4e7dc", transparent: true, opacity: .2, roughness: .12, depthWrite: false, side: T.DoubleSide });
  const add = (geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z: number) => {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(x, y, z); hourglass.add(mesh); return mesh;
  };
  for (const y of [0, .58]) add(new T.CylinderGeometry(.175, .175, .045, 24), brass, 0, y, 0);
  for (const x of [-.13, .13]) for (const z of [-.13, .13])
    add(new T.CylinderGeometry(.011, .011, .55, 8), brass, x, .29, z);
  add(new T.LatheGeometry([
    new T.Vector2(.1, .03), new T.Vector2(.135, .11), new T.Vector2(.095, .2),
    new T.Vector2(.025, .29), new T.Vector2(.095, .38), new T.Vector2(.135, .47),
    new T.Vector2(.1, .55),
  ], 24), glass, 0, 0, 0);
  const topSand = add(new T.ConeGeometry(.095, .17, 20), sand, 0, .44, 0);
  topSand.rotation.z = Math.PI;
  const bottomSand = add(new T.ConeGeometry(.095, .17, 20), sand, 0, .12, 0);
  const stream = add(new T.CylinderGeometry(.004, .005, .27, 6), sand, 0, .29, 0);
  return { hourglass, topSand, bottomSand, stream };
}

export function makeBridgeWindow(view?: T.Texture) {
  const window = new T.Group();
  window.name = "Bridge-view cottage window";
  const oak = new T.MeshStandardMaterial({ color: "#bd9464", roughness: .8 });
  const edge = new T.MeshStandardMaterial({ color: "#e1b980", roughness: .72 });
  const glass = new T.MeshBasicMaterial(view
    ? { map: view, color: "#ffe6c6", toneMapped: false }
    : { color: "#91aeb4", transparent: true, opacity: .72, side: T.DoubleSide });
  const timber = (x: number, y: number, z: number, w: number, h: number, d: number, material = oak) => {
    const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true;
    window.add(mesh);
  };
  const pane = new T.Mesh(new T.PlaneGeometry(2.91, 2.54), glass);
  pane.position.set(0, 1.28, -.1);
  window.add(pane);
  for (const x of [-1.58, 1.58]) timber(x, 1.28, .055, .15, 2.94, .27);
  timber(0, 2.75, .055, 3.28, .15, .27);
  timber(0, -.19, .1, 3.38, .16, .38);
  timber(0, 2.39, .1, 3.02, .075, .13, edge);
  timber(0, -.06, .25, 3.48, .075, .56, edge);
  return window;
}

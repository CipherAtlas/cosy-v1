import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export function cottageMaterials() {
  let seed = 421;
  const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const surface = (kind: "oak" | "plaster" | "linen" | "stone") => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = kind === "oak" ? "#b9a18b" : kind === "stone" ? "#e2d9c7" : "#eee8da";
    ctx.fillRect(0, 0, 512, 512);
    if (kind === "oak") {
      for (let board = 0; board < 8; board++) {
        ctx.fillStyle = `hsl(29 22% ${66 + random() * 4}%)`; ctx.fillRect(board * 64, 0, 63, 512);
        ctx.fillStyle = "#51453730"; ctx.fillRect(board * 64 + 63, 0, 1, 512);
        for (let line = 0; line < 12; line++) {
          const x = board * 64 + 4 + line * 4.9;
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 2, 150, x - 2, 360, x, 512);
          ctx.strokeStyle = line % 3 ? "#5d473411" : "#fff8e818"; ctx.lineWidth = .7; ctx.stroke();
        }
      }
    } else if (kind === "linen") {
      for (let n = 0; n < 512; n += 3) {
        ctx.fillStyle = "#93897d19"; ctx.fillRect(n, 0, 1, 512); ctx.fillRect(0, n, 512, 1);
        ctx.fillStyle = "#ffffff40"; ctx.fillRect(n + 1, 0, 1, 512);
      }
    }
    for (let i = 0; i < 18000; i++) {
      ctx.fillStyle = i % 2 ? "#fffaf20c" : "#584c3c08";
      ctx.fillRect(random() * 512, random() * 512, 1 + random() * 2, 1 + random() * 2);
    }
    const texture = new T.CanvasTexture(canvas); texture.name = `Cottage ${kind}`;
    texture.colorSpace = T.SRGBColorSpace; texture.wrapS = texture.wrapT = T.RepeatWrapping; texture.anisotropy = 8;
    return texture;
  };
  const oak = surface("oak"), plaster = surface("plaster"), linen = surface("linen"), stone = surface("stone");
  return {
    wood: new T.MeshStandardMaterial({ map: oak, color: "#baa58f", roughness: .72 }),
    floor: new T.MeshStandardMaterial({ map: oak, color: "#e2ccaf", roughness: .86 }),
    plaster: new T.MeshStandardMaterial({ map: plaster, color: "#e9dfcb", roughness: 1 }),
    stone: new T.MeshStandardMaterial({ map: stone, color: "#d8cbb5", roughness: .93 }),
    linen: new T.MeshStandardMaterial({ map: linen, color: "#e6d9bd", roughness: 1, side: T.DoubleSide }),
    upholstery: new T.MeshStandardMaterial({ map: linen, color: "#708775", roughness: 1 }),
    rug: new T.MeshStandardMaterial({ map: linen, color: "#ad7661", roughness: 1 }),
  };
}

function rounded(root: T.Group, material: T.Material, position: number[], size: number[], radius = .08) {
  const mesh = new T.Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], 3, radius), material);
  mesh.position.fromArray(position); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return mesh;
}

export function makeCottageCouch(surfaces = cottageMaterials()) {
  const root = new T.Group(); root.name = "Sage linen couch";
  const walnut = surfaces.wood, fabric = surfaces.upholstery;
  const pillow = surfaces.linen.clone(); pillow.color.set("#d1af85");
  const rose = surfaces.linen.clone(); rose.color.set("#aa6d5d");
  const brass = new T.MeshStandardMaterial({ color: "#bb9868", roughness: .45, metalness: .5 });
  for (const x of [-1.08, 1.08]) for (const z of [-.38, .38]) {
    rounded(root, walnut, [x, .18, z], [.09, .36, .09], .025);
    rounded(root, brass, [x, .055, z], [.095, .08, .095], .015);
  }
  rounded(root, walnut, [0, .36, 0], [2.55, .15, 1.1], .05);
  rounded(root, fabric, [0, .5, 0], [2.5, .22, 1.05], .1);
  rounded(root, fabric, [0, .97, -.43], [2.5, .94, .28], .13);
  for (const x of [-1.23, 1.23]) rounded(root, fabric, [x, .76, 0], [.24, .55, 1.1], .11);
  for (const x of [-.57, .57]) {
    rounded(root, fabric, [x, .68, .07], [1.08, .21, .85], .09);
    rounded(root, fabric, [x, 1.03, -.255], [1.08, .6, .18], .08);
    for (const dx of [-.17, .17]) rounded(root, fabric, [x + dx, 1.06, -.148], [.04, .04, .015], .012);
  }
  const left = rounded(root, pillow, [-.86, .96, .035], [.42, .45, .17], .08); left.rotation.set(-.17, .1, -.21);
  const right = rounded(root, rose, [.82, .95, .04], [.43, .42, .17], .08); right.rotation.set(-.14, -.14, .19);
  const blanket = surfaces.linen.clone(); blanket.color.set("#ddcfad");
  rounded(root, blanket, [.39, .797, .16], [.58, .027, .66], .012);
  rounded(root, blanket, [.39, .55, .535], [.58, .45, .028], .012);
  for (let i = 0; i < 12; i++) rounded(root, blanket, [.12 + i * .049, .3, .535], [.012, .08 + Math.sin(i) * .015, .015], .004);
  return root;
}

export function makeCottageLamp() {
  const root = new T.Group(); root.name = "Pleated reading lamp";
  const brass = new T.MeshStandardMaterial({ color: "#ba9563", metalness: .55, roughness: .4 });
  const shade = new T.MeshStandardMaterial({ color: "#f2dfb5", roughness: 1, side: T.DoubleSide, emissive: "#ffca7b", emissiveIntensity: .16 });
  const add = (geometry: T.BufferGeometry, material: T.Material, y: number) => {
    const mesh = new T.Mesh(geometry, material); mesh.position.y = y; root.add(mesh); return mesh;
  };
  add(new T.CylinderGeometry(.23, .26, .06, 32), brass, .03);
  add(new T.CylinderGeometry(.022, .026, 1.5, 12), brass, .79);
  const geometry = new T.CylinderGeometry(.24, .41, .46, 64, 1, true), p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), r = 1 + Math.cos(a * 32) * .035; p.setX(i, p.getX(i) * r); p.setZ(i, p.getZ(i) * r); }
  geometry.computeVertexNormals(); add(geometry, shade, 1.65);
  for (const [y, radius] of [[1.42,.41],[1.88,.24]]) { const rim = add(new T.TorusGeometry(radius, .009, 6, 64), brass, y); rim.rotation.x = Math.PI / 2; }
  const bulb = add(new T.SphereGeometry(.065, 12, 8), new T.MeshBasicMaterial({ color: "#ffe2a6" }), 1.64);
  bulb.scale.y = 1.35;
  return root;
}

export function makeCottageFern() {
  const root = new T.Group(); root.name = "Fern in ceramic pot";
  const pot = new T.MeshStandardMaterial({ color: "#b6775d", roughness: .68 });
  const green = new T.MeshStandardMaterial({ color: "#52715a", roughness: .9, side: T.DoubleSide });
  const container = new T.Mesh(new T.CylinderGeometry(.23,.16,.35,28), pot); container.position.y=.175; root.add(container);
  const soil = new T.Mesh(new T.CircleGeometry(.207,24), new T.MeshStandardMaterial({ color:"#443c2b",roughness:1 })); soil.rotation.x=-Math.PI/2; soil.position.y=.353; root.add(soil);
  for (let frond=0;frond<9;frond++) {
    const a=frond*2.4, length=.48+(frond%3)*.13;
    const direction=new T.Vector3(Math.cos(a),0,Math.sin(a));
    const curve=new T.QuadraticBezierCurve3(new T.Vector3(0,.35,0),direction.clone().multiplyScalar(.25).setY(.35+length),direction.clone().multiplyScalar(.52).setY(.45+length*.3));
    root.add(new T.Mesh(new T.TubeGeometry(curve,12,.009,5,false),green));
    for(let i=1;i<9;i++) for(const side of [-1,1]) {
      const point=curve.getPoint(i/10), leaf=new T.Mesh(new T.SphereGeometry(1,10,6),green);
      leaf.position.copy(point).add(new T.Vector3(-direction.z,0,direction.x).multiplyScalar(side*.065));
      leaf.scale.set(.035,.009,.13*(1-i/11)); leaf.rotation.set(.2,a+side*.8,side*.2);root.add(leaf);
    }
  }
  return root;
}

export function makeCottagePrint() {
  const root=new T.Group();root.name="Framed botanical print";
  const frame=new T.MeshStandardMaterial({color:"#705641",roughness:.75});
  const paper=new T.MeshStandardMaterial({color:"#ede1c8",roughness:1});
  rounded(root,frame,[0,.65,0],[1.03,1.3,.055],.025);
  rounded(root,paper,[0,.65,.031],[.91,1.18,.012],.005);
  const ink=new T.MeshStandardMaterial({color:"#638171",roughness:1});
  const stem=new T.Mesh(new T.CylinderGeometry(.006,.007,.74,6),ink);stem.position.set(0,.63,.043);root.add(stem);
  for(let i=0;i<6;i++) for(const side of [-1,1]) {
    const leaf=new T.Mesh(new T.SphereGeometry(1,12,8),ink);leaf.scale.set(.08,.145,.006);
    leaf.position.set(side*.085,.32+i*.117,.045);leaf.rotation.z=-side*.7;root.add(leaf);
  }
  return root;
}

export function makeCatCushion(surfaces = cottageMaterials()) {
  const root = new T.Group(); root.name = "Cat's woven cushion";
  const fabric = surfaces.linen.clone(); fabric.color.set("#caa173");
  const cushion = new T.Mesh(new T.SphereGeometry(1, 40, 16), fabric);
  cushion.scale.set(.62, .1, .49); cushion.position.y = .09; cushion.receiveShadow = true; root.add(cushion);
  const piping = new T.Mesh(new T.TorusGeometry(.51,.009,6,48), surfaces.linen);
  piping.rotation.x = Math.PI / 2; piping.scale.set(1.18,.94,1); piping.position.y=.09; root.add(piping);
  return root;
}

export function makeCottageChair(surfaces = cottageMaterials()) {
  const root = new T.Group(); root.name = "Cushioned oak writing chair";
  const fabric = surfaces.linen.clone(); fabric.color.set("#caa88a");
  const piping = surfaces.linen.clone(); piping.color.set("#e7d7b9");
  for (const x of [-.31, .31]) for (const z of [-.29, .29]) {
    const leg = rounded(root, surfaces.wood, [x, .28, z], [.075, .56, .075], .018);
    leg.rotation.z = -Math.sign(x) * .065;
  }
  rounded(root, surfaces.wood, [0, .54, 0], [.78, .12, .79], .045);
  rounded(root, piping, [0, .64, -.015], [.77, .17, .75], .075);
  rounded(root, fabric, [0, .68, -.015], [.75, .19, .73], .085);
  for (const x of [-.33, .33]) rounded(root, surfaces.wood, [x, .99, .31], [.07, .89, .08], .025);
  const back = rounded(root, fabric, [0, 1.13, .335], [.82, .69, .2], .09); back.rotation.x = .09;
  const backEdge = rounded(root, piping, [0, 1.13, .447], [.78, .65, .035], .016); backEdge.rotation.x = .09;
  for (const x of [-.14, .14]) rounded(root, piping, [x, 1.16, .455], [.035, .035, .018], .012);
  for (const x of [-.43, .43]) {
    rounded(root, surfaces.wood, [x, .73, -.21], [.055, .35, .055], .016);
    rounded(root, fabric, [x, .93, .03], [.12, .13, .6], .055);
  }
  return root;
}

export function makeCottageBooks() {
  const root = new T.Group(); root.name = "Clothbound cottage books";
  const pages = new T.MeshStandardMaterial({ color: "#e8d9b9", roughness: 1 });
  const gilt = new T.MeshStandardMaterial({ color: "#d3b780", roughness: .6, metalness: .12 });
  const colors = ["#627f76", "#b18c59", "#a66e60", "#536b78", "#877464"];
  for (let i = 0; i < 4; i++) {
    const book = new T.Group(), width = .095 + (i % 2) * .018, height = [.43, .5, .39, .46][i];
    const cover = new T.MeshStandardMaterial({ color: colors[i], roughness: .85 });
    rounded(book, pages, [0, height / 2, 0], [width - .015, height - .025, .24], .003);
    for (const x of [-width / 2, width / 2]) rounded(book, cover, [x, height / 2, 0], [.012, height, .27], .004);
    rounded(book, cover, [0, height / 2, .13], [width, height, .028], .008);
    for (const y of [.055, height - .065]) rounded(book, gilt, [0, y, .147], [width * .74, .008, .003], .001);
    book.position.set(-.37 + i * .125, .01, 0);
    if (i === 3) { book.rotation.z = -.12; book.position.x += .016; }
    root.add(book);
  }
  for (let i = 0; i < 2; i++) {
    const cover = new T.MeshStandardMaterial({ color: colors[4 - i], roughness: .85 });
    const y = .041 + i * .081, x = .33 + i * .015;
    rounded(root, pages, [x, y, 0], [.34, .057, .25], .004);
    for (const dy of [-.035, .035]) rounded(root, cover, [x, y + dy, 0], [.37, .013, .28], .004);
    rounded(root, cover, [x, y, -.129], [.37, .075, .015], .005);
  }
  return root;
}

export function makeCottagePottery() {
  const root = new T.Group(); root.name = "Hand-thrown glazed pottery";
  const sage = new T.MeshPhysicalMaterial({ color: "#7d9b8b", roughness: .35, clearcoat: .3, clearcoatRoughness: .45 });
  const cream = new T.MeshPhysicalMaterial({ color: "#e3cba5", roughness: .45, clearcoat: .2 });
  const clay = new T.MeshStandardMaterial({ color: "#bb7f60", roughness: .72 });
  const profiles = [
    [[0, .018], [.1, .018], [.145, .065], [.16, .19], [.14, .29], [.083, .35], [.086, .395], [.07, .401], [.067, .35], [.12, .28], [.14, .18], [.12, .07], [0, .05]],
    [[0, .016], [.105, .016], [.16, .06], [.185, .16], [.16, .24], [.135, .28], [.12, .278], [.135, .235], [.162, .16], [.14, .07], [0, .045]],
    [[0, .012], [.075, .012], [.105, .07], [.108, .16], [.07, .26], [.035, .3], [.035, .45], [.045, .46], [.031, .469], [.023, .45], [.024, .3], [.052, .25], [.09, .16], [.085, .08], [0, .039]],
  ];
  const materials = [sage, cream, clay];
  for (let i = 0; i < profiles.length; i++) {
    const pot = new T.Mesh(new T.LatheGeometry(profiles[i].map(([r, y]) => new T.Vector2(r, y)), 40), materials[i]);
    pot.position.x = (i - 1) * .38; pot.castShadow = pot.receiveShadow = true; root.add(pot);
  }
  const handle = new T.Mesh(new T.TorusGeometry(.092, .018, 10, 28), sage);
  handle.position.set(-.225, .26, 0); handle.scale.set(.75, 1, 1); root.add(handle);
  for (const [x, y, radius, material] of [[-.38, .397, .078, cream], [0, .281, .129, clay], [.38, .465, .038, cream]] as const) {
    const lip = new T.Mesh(new T.TorusGeometry(radius, .006, 6, 40), material);
    lip.rotation.x = Math.PI / 2; lip.position.set(x, y, 0); root.add(lip);
  }
  return root;
}

export function makeCottageWallShelf(surfaces = cottageMaterials(), contents: "books" | "pottery" = "books") {
  const root = new T.Group(); root.name = contents === "books" ? "Oak cottage book shelf" : "Oak cottage pottery shelf";
  rounded(root, surfaces.wood, [0, -.055, 0], [1.22, .11, .42], .022);
  const brass = new T.MeshStandardMaterial({ color: "#9c7d51", roughness: .55, metalness: .4 });
  for (const x of [-.43, .43]) {
    rounded(root, brass, [x, -.2, -.17], [.025, .32, .035], .009);
    const brace = rounded(root, brass, [x, -.2, -.02], [.025, .36, .025], .008); brace.rotation.x = -.85;
  }
  const objects = contents === "books" ? makeCottageBooks() : makeCottagePottery();
  if (contents === "pottery") objects.scale.setScalar(.8);
  objects.position.z = -.015; root.add(objects);
  return root;
}

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
  const oak = new T.MeshStandardMaterial({ color: "#a77f55", roughness: .76 });
  const beading = new T.MeshStandardMaterial({ color: "#dbc09b", roughness: .8 });
  const reveal = new T.MeshStandardMaterial({ color: "#6b5741", roughness: .9 });
  const glass = new T.MeshBasicMaterial(view
    ? { map: view, color: "#ffffff", toneMapped: false }
    : { color: "#91aeb4" });
  // The opaque village view sits inside a single closed rectangular surround.
  const pane = new T.Mesh(new T.PlaneGeometry(3.2, 2.76), glass);
  pane.position.set(0, 1.36, -.075); window.add(pane);
  for (const x of [-1.66, 1.66]) {
    rounded(window, reveal, [x, 1.36, -.055], [.14, 2.9, .22], .01);
    rounded(window, oak, [x, 1.36, .065], [.16, 2.9, .19], .018);
    rounded(window, beading, [x + (x < 0 ? .073 : -.073), 1.36, .095], [.025, 2.76, .05], .004);
  }
  for (const y of [-.09, 2.81]) {
    rounded(window, oak, [0, y, .065], [3.48, .16, .19], .018);
    rounded(window, beading, [0, y + (y < 0 ? .073 : -.073), .095], [3.2, .025, .05], .004);
  }
  rounded(window, oak, [0, -.22, .19], [3.7, .12, .5], .025);
  // Slender real mullions divide four panes without obscuring the outdoor view.
  rounded(window, beading, [0, 1.36, .04], [.055, 2.76, .105], .006);
  rounded(window, beading, [0, 1.36, .05], [3.2, .055, .105], .006);
  return window;
}

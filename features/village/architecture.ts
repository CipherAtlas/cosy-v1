import * as T from "three";

/** The village's original cottage kit: swept roofs, limestone arches and painted joinery. */
export function buildCottage(
  m: Record<"plaster" | "wood" | "darkWood" | "stone" | "roof" | "glass" | "trim" | "teal" | "rose" | "paper" | "green", T.Material>,
  w: number, d: number, h: number, variant: number,
) {
  const group = new T.Group();
  const cube = new T.BoxGeometry(1, 1, 1);
  const ball = new T.SphereGeometry(1, 12, 8);
  const accent = variant % 3 === 0 ? m.teal : variant % 3 === 1 ? m.rose : m.roof;
  const mesh = (geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
    const object = new T.Mesh(geometry, material);
    object.position.set(x, y, z); object.scale.set(sx, sy, sz);
    object.castShadow = object.receiveShadow = true; group.add(object); return object;
  };
  const box = (material: T.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) => mesh(cube, material, x, y, z, sx, sy, sz);
  const line = (points: T.Vector3[], radius: number, material: T.Material) =>
    mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points), points.length * 3, radius, 6, false), material, 0, 0, 0);
  const arch = (width: number, height: number) => {
    const shape = new T.Shape(), radius = width / 2;
    shape.moveTo(-radius, 0); shape.lineTo(radius, 0); shape.lineTo(radius, height - radius);
    shape.absarc(0, height - radius, radius, 0, Math.PI, false);
    shape.lineTo(-radius, 0); shape.closePath();
    const geometry = new T.ExtrudeGeometry(shape, { depth: .06, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 2, curveSegments: 16 });
    const positions = geometry.attributes.position, uv = geometry.attributes.uv;
    for(let i=0;i<positions.count;i++) uv.setXY(i,positions.getX(i)/width+.5,positions.getY(i)/height);
    return geometry;
  };
  const window = (x: number, y: number, z: number, width = 1.15, height = 1.55) => {
    mesh(arch(width + .24, height + .18), m.trim, x, y - .09, z);
    mesh(arch(width, height), m.darkWood, x, y, z + .045);
    mesh(arch(width - .12, height - .1), m.glass, x, y + .035, z + .085);
    box(m.trim, x, y + height * .46, z + .21, .055, height * .87, .055);
    box(m.trim, x, y + height * .45, z + .21, width - .08, .055, .055);
    box(m.stone, x, y - .1, z + .19, width + .4, .13, .35);
    for (const side of [-1, 1]) {
      const shutter = box(accent, x + side * (width / 2 + .27), y + height * .4, z + .08, .3, height * .77, .085);
      shutter.rotation.y = side * -.2;
      for (let slat = 0; slat < 4; slat++) box(m.trim, x + side * (width / 2 + .27), y + .22 + slat * .21, z + .15, .22, .025, .035);
    }
  };
  const flowers = (x: number, y: number, z: number) => {
    box(accent, x, y, z, 1.32, .3, .43);
    box(m.trim, x, y + .13, z, 1.43, .075, .49);
    for (let i = 0; i < 7; i++) {
      const xx = x - .5 + i / 6;
      mesh(ball, m.green, xx, y + .26, z, .18, .12, .17);
      for (let petal = 0; petal < 5; petal++) {
        const a = petal * Math.PI * 2 / 5;
        mesh(ball, i % 2 ? m.paper : m.rose, xx + Math.cos(a) * .065, y + .36 + Math.sin(a) * .055, z + .1, .05, .05, .025);
      }
      mesh(ball, m.trim, xx, y + .36, z + .125, .027, .027, .02);
    }
  };

  box(m.stone, 0, .35, 0, w + .16, .7, d + .16);
  box(m.plaster, 0, h / 2 + .45, 0, w, h, d);
  const half = w / 2 + .6;
  const roofY = (t: number) => h + .5 + 2.8 * Math.pow(1 - t, 1.45) + .24 * Math.pow(t, 8);
  const gable = new T.Shape();
  gable.moveTo(-w / 2, h + .4); gable.lineTo(w / 2, h + .4);
  for (let i = 12; i >= 0; i--) gable.lineTo(half * i / 12, roofY(i / 12) - .13);
  for (let i = 1; i <= 12; i++) gable.lineTo(-half * i / 12, roofY(i / 12) - .13);
  gable.closePath();
  mesh(new T.ExtrudeGeometry(gable, { depth: d, bevelEnabled: false }), m.plaster, 0, 0, -d / 2);
  for (const side of [-1, 1]) {
    const shape = new T.Shape();
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      if (i === 0) shape.moveTo(0, roofY(0)); else shape.lineTo(side * half * t, roofY(t));
    }
    for (let i = 16; i >= 0; i--) shape.lineTo(side * half * i / 16, roofY(i / 16) - .15);
    shape.closePath();
    const geometry = new T.ExtrudeGeometry(shape, { depth: d + 1.3, bevelEnabled: false });
    const positions = geometry.attributes.position, uv = geometry.attributes.uv;
    for (let i = 0; i < positions.count; i++) uv.setXY(i, positions.getZ(i) / 4, (roofY(0) - positions.getY(i)) / 3.2);
    mesh(geometry, m.roof, 0, 0, -d / 2 - .65);
    for (const end of [-1, 1]) {
      const points = Array.from({ length: 13 }, (_, i) => new T.Vector3(side * half * i / 12, roofY(i / 12) - .045, end * (d / 2 + .69)));
      line(points, .105, m.darkWood);
      line(points.map(p => p.clone().add(new T.Vector3(0, .035, end * .07))), .033, m.trim);
    }
    line([new T.Vector3(side * half, roofY(1), -d / 2 - .7), new T.Vector3(side * half, roofY(1), d / 2 + .7)], .11, m.trim);
  }
  box(m.trim, 0, roofY(0) + .015, 0, .16, .14, d + 1.45);
  for (const end of [-1, 1]) mesh(ball, m.trim, 0, roofY(0) + .13, end * (d / 2 + .67), .115, .16, .115);

  // Broad plaster panels and slim warm joinery keep the facade airy.
  for (const z of [-d / 2 - .035, d / 2 + .035]) {
    for (const x of [-w / 2 + .12, w / 2 - .12]) box(m.wood, x, h / 2 + .5, z, .2, h, .15);
    for (const y of [.7, h * .5 + .5, h + .46]) box(m.wood, 0, y, z, w, .16, .16);
    for (const side of [-1, 1]) line([
      new T.Vector3(side * w * .47, h * .5 + .63, z + .02),
      new T.Vector3(side * w * .33, h * .73 + .48, z + .02),
      new T.Vector3(side * w * .27, h + .4, z + .02),
    ], .065, m.wood);
  }
  for (const side of [-1, 1]) {
    box(m.wood, side * (w / 2 + .04), h * .5 + .5, 0, .14, .16, d);
    // Side glazing prevents blank walls when walking around a cottage.
    const pane = mesh(arch(1.1, 1.5), m.trim, side * (w / 2 + .08), 1.5, 0);
    pane.rotation.y = side * Math.PI / 2;
    const glass = mesh(arch(.89, 1.29), m.glass, side * (w / 2 + .15), 1.6, 0);
    glass.rotation.y = side * Math.PI / 2;
    for (let row = 0; row < 4; row++) box(m.stone, side * (w / 2 - .06), .82 + row * .38, d / 2 + .075, row % 2 ? .4 : .27, .28, .17);
  }

  const front = d / 2 + .075;
  mesh(arch(1.7, 2.6), m.stone, 0, .14, front);
  mesh(arch(1.34, 2.29), m.darkWood, 0, .2, front + .08);
  mesh(arch(1.19, 2.15), accent, 0, .23, front + .16);
  for (const side of [-1, 1]) box(m.trim, side * .24, 1.07, front + .25, .03, 1.45, .03);
  mesh(new T.TorusGeometry(.065, .016, 6, 16), m.trim, .35, 1.16, front + .28);
  box(m.stone, 0, .14, front + .39, 1.95, .22, .9);
  for (const x of [-w * .31, w * .31]) {
    window(x, 1.2, front, .92, 1.3);
    flowers(x, .96, front + .31);
    if (h > 3.7) window(x, h * .57 + .5, front, .96, 1.45);
  }
  const oculusY = h + 1.12;
  mesh(new T.CircleGeometry(.51, 32), m.glass, 0, oculusY, front + .08);
  mesh(new T.TorusGeometry(.56, .09, 8, 32), m.trim, 0, oculusY, front + .14);
  box(m.trim, 0, oculusY, front + .18, .045, .96, .055);
  box(m.trim, 0, oculusY, front + .18, .96, .045, .055);

  // A small curved canopy leaves the doorway and collision approach unobstructed.
  for (const side of [-1, 1]) {
    line([new T.Vector3(side * .95, 2.2, front), new T.Vector3(side * .95, 2.75, front + .6), new T.Vector3(side * .95, 2.83, front + 1)], .07, m.trim);
    const awning = box(m.roof, side * .54, 2.93, front + .58, 1.2, .1, 1.33);
    awning.rotation.z = -side * .2;
  }
  if (variant % 3 !== 1) {
    const x = w * .31, z = -d * .24;
    mesh(new T.CylinderGeometry(.66, .74, 2.5, 16), m.plaster, x, h + 1.5, z);
    mesh(new T.CylinderGeometry(.79, .79, .15, 16), m.trim, x, h + 2.66, z);
    mesh(new T.ConeGeometry(1.06, 2.1, 24), m.roof, x, h + 3.72, z);
    mesh(ball, m.trim, x, h + 4.83, z, .12, .19, .12);
    const aperture = mesh(arch(.37, .75), m.glass, x, h + 1.75, z + .69);
    aperture.name = "Turret window";
  } else {
    box(m.stone, -w * .3, h + 1.9, -d * .25, .65, 2.5, .7);
    box(m.trim, -w * .3, h + 3.13, -d * .25, .85, .18, .9);
  }
  return group;
}

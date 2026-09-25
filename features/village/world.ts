import * as T from "three";
import { makeFlame } from "./flame";
import { buildBridge } from "./bridge";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { withBasePath } from "@/lib/basePath";
import { BRIDGE, HEARTH, groundY, landscapeHeight, riverX, roadX, type Collider } from "./environment";
export { groundY, riverX } from "./environment";

export type World = {
  group: T.Group;
  trees: {
    mesh: T.InstancedMesh;
    transforms: T.Matrix4[];
    bounds: T.Sphere[];
  }[];
  colliders: Collider[];
  flames: T.Mesh[];
  lanterns: T.Mesh[];
  water: T.Mesh;
  wind: { time: { value: number }; strength: { value: number } };
  vegetation: T.InstancedMesh[];
  dispose: () => void;
};
const assets = (s: string) => withBasePath(`/village/${s}`);
let seed = 62025;
function rnd() {
  seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
  return (seed >>> 0) / 4294967296;
}
const boxGeo = new T.BoxGeometry(1, 1, 1);
const sphereGeo = new T.IcosahedronGeometry(1, 1);
const cylGeo = new T.CylinderGeometry(1, 1, 1, 8);
const dummy = new T.Object3D();
export async function buildWorld(
  onProgress: (v: number) => void,
  renderer: T.WebGLRenderer,
): Promise<World> {
  seed = 62025;
  const group = new T.Group();
  const colliders: World["colliders"] = [],
    flames: T.Mesh[] = [],
    lanterns: T.Mesh[] = [];
  const wind = { time: { value: 0 }, strength: { value: 0.3 } };
  const vegetation: T.InstancedMesh[] = [];
  const clearPlanting = (x: number, z: number) =>
    (Math.abs(x - BRIDGE.x) < BRIDGE.length / 2 + 2 && Math.abs(z - BRIDGE.z) < BRIDGE.width / 2 + 1.1)
    || Math.hypot(x - HEARTH.x, z - HEARTH.z) < 3.9;
  const textureLoader = new T.TextureLoader();
  const textures: T.Texture[] = [];
  const renderTargets: T.WebGLRenderTarget[] = [];
  async function tex(name: string, repeat: number) {
    const t = await textureLoader.loadAsync(assets(`textures/${name}`));
    t.name = name;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 4;
    textures.push(t);
    return t;
  }
  const [
    woodMap,
    roofMap,
    plasterMap,
    stoneMap,
    groundMap,
    pathMap,
    woodN,
    stoneN,
    roofN,
  ] = await Promise.all([
    tex("wood-color.jpg", 1),
    tex("roof-color.jpg", 2),
    tex("plaster-color.jpg", 1),
    tex("stone-color.jpg", 2),
    tex("ground-color.jpg", 125),
    tex("path.png", 1),
    tex("wood-normal.jpg", 1),
    tex("stone-normal.jpg", 2),
    tex("roof-normal.jpg", 2),
  ]);
  [woodMap, roofMap, plasterMap, stoneMap, groundMap, pathMap].forEach(
    (t) => (t.colorSpace = T.SRGBColorSpace),
  );
  const mat = {
    wood: new T.MeshStandardMaterial({
      map: woodMap,
      normalMap: woodN,
      color: "#c6ac87",
      roughness: 0.95,
    }),
    darkWood: new T.MeshStandardMaterial({
      map: woodMap,
      color: "#806849",
      roughness: 0.94,
    }),
    plaster: new T.MeshStandardMaterial({
      color: "#d3bd96",
      bumpMap: plasterMap,
      bumpScale: 0.045,
      roughness: 1,
    }),
    roof: new T.MeshStandardMaterial({
      map: roofMap,
      normalMap: roofN,
      color: "#636e72",
      roughness: 0.91,
      side: T.DoubleSide,
    }),
    terra: new T.MeshStandardMaterial({
      map: roofMap,
      normalMap: roofN,
      color: "#94674c",
      roughness: 0.91,
      side: T.DoubleSide,
    }),
    stone: new T.MeshStandardMaterial({
      map: stoneMap,
      normalMap: stoneN,
      color: "#a8a38b",
      roughness: 1,
    }),
    ground: new T.MeshStandardMaterial({
      map: groundMap,
      color: "#a0b88c",
      vertexColors: true,
      roughness: 1,
    }),
    path: new T.MeshStandardMaterial({
      map: pathMap,
      color: "#e0d2b4",
      roughness: 0.94,
    }),
    glass: new T.MeshStandardMaterial({
      color: "#473320",
      emissive: "#ff942f",
      emissiveIntensity: 0.85,
      roughness: 0.3,
    }),
    metal: new T.MeshStandardMaterial({
      color: "#292720",
      metalness: 0.55,
      roughness: 0.6,
    }),
    fabric: new T.MeshStandardMaterial({
      color: "#ab8c68",
      roughness: 1,
      side: T.DoubleSide,
    }),
    green: new T.MeshStandardMaterial({ color: "#506435", roughness: 1 }),
    paper: new T.MeshStandardMaterial({ color: "#e4d5ae", roughness: 1 }),
  };
  mat.plaster.onBeforeCompile = shader => {
    shader.uniforms.plasterDetail = { value: plasterMap };
    shader.fragmentShader = "uniform sampler2D plasterDetail;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb *= .82 + texture2D(plasterDetail, vBumpMapUv).r * .45;");
  };
  const add = (
    geo: T.BufferGeometry,
    m: T.Material,
    x: number,
    y: number,
    z: number,
    sx = 1,
    sy = 1,
    sz = 1,
    parent: T.Object3D = group,
  ) => {
    const o = new T.Mesh(geo, m);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  const box = (
    m: T.Material,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    parent: T.Object3D = group,
  ) => add(boxGeo, m, x, y, z, sx, sy, sz, parent);
  const beam = (
    a: T.Vector3,
    b: T.Vector3,
    width: number,
    parent: T.Object3D,
    m: T.Material = mat.wood,
  ) => {
    const o = add(boxGeo, m, 0, 0, 0, width, a.distanceTo(b), width, parent);
    o.position.copy(a).add(b).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      b.clone().sub(a).normalize(),
    );
    return o;
  };
  const terrain = new T.PlaneGeometry(650, 650, 210, 210);
  terrain.rotateX(-Math.PI / 2);
  const pos = terrain.attributes.position;
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      z = pos.getZ(i);
    pos.setY(i, landscapeHeight(x, z));
    const patch = .5 + .5 * Math.sin(x * .12) * Math.sin(z * .09);
    const c = new T.Color().setHSL(.24 + patch * .045, .26, .47 + patch * .18);
    colors.push(c.r, c.g, c.b);
  }
  terrain.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  terrain.computeVertexNormals();
  const terrainMesh = add(terrain, mat.ground, 0, 0, 0);
  terrainMesh.castShadow = false;
  // Narrow, curved paths are geometry so their paving follows the village layout.
  function path(points: T.Vector3[], width: number) {
    const c = new T.CatmullRomCurve3(points);
    const vs: number[] = [],
      uv: number[] = [],
      indices: number[] = [];
    for (let i = 0; i <= 100; i++) {
      let p = c.getPoint(i / 100),
        t = c.getTangent(i / 100);
      for (const s of [-1, 1]) {
        const shoulder = 1 + Math.sin(i * 0.71) * 0.055 + Math.sin(i * 1.37) * 0.025;
        let x = p.x + (t.z * width * s * shoulder) / 2,
          z = p.z - (t.x * width * s * shoulder) / 2;
        vs.push(x, Math.max(landscapeHeight(x, z), 0) + 0.045, z);
        uv.push(s === -1 ? 0 : width / 2, ((i / 100) * c.getLength()) / 2);
      }
      if (i < 100) {
        let a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(vs, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    add(g, mat.path, 0, 0, 0).castShadow = false;
  }
  path(
    [
      new T.Vector3(0, 0, 42),
      new T.Vector3(1.5, 0, 18),
      new T.Vector3(0, 0, 0),
      new T.Vector3(-1, 0, -20),
      new T.Vector3(2, 0, -49),
    ],
    3.4,
  );
  path([new T.Vector3(-34, 0, 4), new T.Vector3(-23, 0, 3),
    new T.Vector3(BRIDGE.x - BRIDGE.length / 2, 0, BRIDGE.z)], 2.8);
  path([new T.Vector3(BRIDGE.x + BRIDGE.length / 2, 0, BRIDGE.z),
    new T.Vector3(-2, 0, 3), new T.Vector3(0, 0, 2), new T.Vector3(17, 0, -9)], 2.8);
  path(
    [
      new T.Vector3(-21, 0, 5),
      new T.Vector3(-20, 0, -3),
      new T.Vector3(-20, 0, -10),
    ],
    2,
  );
  path(
    [
      new T.Vector3(0, 0, 13),
      new T.Vector3(5, 0, 11),
      new T.Vector3(10, 0, 11),
    ],
    2.5,
  );
  // Water occupies a shallow channel, with shader normals moving independently of the banks.
  const waterUniform = { time: { value: 0 } };
  const waterMat = new T.MeshStandardMaterial({
    color: "#326d62",
    metalness: 0,
    roughness: 0.78,
    transparent: true,
    opacity: 0.83,
  });
  waterMat.onBeforeCompile = (s) => {
    s.uniforms.uTime = waterUniform.time;
    s.uniforms.uGust = wind.strength;
    s.vertexShader =
      "uniform float uTime; uniform float uGust;\nvarying vec3 vWorld;\n" + s.vertexShader;
    s.vertexShader = s.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvWorld = position;\ntransformed.y += sin(position.x*2.4+uTime*.6)*.028 + cos(position.z*2.1+uTime*.8)*.024;",
    );
    s.fragmentShader =
      "uniform float uTime; uniform float uGust;\nvarying vec3 vWorld;\n" + s.fragmentShader;
    s.fragmentShader = s.fragmentShader.replace(
      "#include <normal_fragment_begin>",
      "#include <normal_fragment_begin>\nnormal.x += sin(vWorld.x*4.0+uTime*.75)*(.08+uGust*.12);\nnormal.z += cos(vWorld.z*3.5+uTime*.6)*.14;\nnormal=normalize(normal);",
    );
  };
  const wg = new T.PlaneGeometry(1, 1, 1, 220);
  wg.rotateX(-Math.PI / 2);
  const wp = wg.attributes.position;
  for (let i = 0; i < wp.count; i++) {
    const z = wp.getZ(i) * 220;
    wp.setXYZ(i, riverX(z) + wp.getX(i) * 6.4, -0.32, z);
  }
  wg.computeVertexNormals();
  const water = add(wg, waterMat, 0, 0, 0);
  water.castShadow = false;
  water.userData.time = waterUniform.time;
  const pondGeo = new T.CircleGeometry(7, 64);
  pondGeo.rotateX(-Math.PI / 2);
  const pond = add(pondGeo, waterMat, -25, -0.3, -17, 1.1, 1, 1);
  pond.castShadow = false;
  // River stones, a shallow arch bridge, and rustic railings.
  for (let i = 0; i < 240; i++) {
    let z = -65 + rnd() * 125,
      s = rnd() > 0.5 ? 1 : -1,
      x = riverX(z) + s * (3.4 + rnd() * 0.6);
    if (Math.abs(z - BRIDGE.z) < BRIDGE.width / 2 + 1 && Math.abs(x - BRIDGE.x) < BRIDGE.length / 2 + 1) continue;
    const o = add(
      sphereGeo,
      mat.stone,
      x,
      -0.02 + rnd() * 0.13,
      z,
      0.3 + rnd() * 0.5,
      0.2 + rnd() * 0.35,
      0.4 + rnd() * 0.4,
    );
    o.rotation.set(rnd(), rnd(), rnd());
  }
  group.add(buildBridge(mat.stone, mat.path, colliders));
  function lantern(
    x: number,
    y: number,
    z: number,
    parent: T.Object3D = group,
  ) {
    box(mat.metal, x, y, z, 0.32, 0.06, 0.32, parent);
    box(mat.metal, x, y + 0.5, z, 0.38, 0.07, 0.38, parent);
    const glass = box(mat.glass, x, y + 0.26, z, 0.22, 0.44, 0.22, parent);
    lanterns.push(glass);
    for (const dx of [-0.14, 0.14])
      for (const dz of [-0.14, 0.14])
        box(mat.metal, x + dx, y + 0.25, z + dz, 0.035, 0.52, 0.035, parent);
    add(
      new T.ConeGeometry(0.3, 0.22, 4),
      mat.metal,
      x,
      y + 0.65,
      z,
      1,
      1,
      1,
      parent,
    ).rotation.y = Math.PI / 4;
  }
  function gable(
    w: number,
    h: number,
    d: number,
    m: T.Material,
    parent: T.Object3D,
    y: number,
  ) {
    const shape = new T.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(w / 2, 0);
    shape.lineTo(0, h);
    shape.closePath();
    const g = new T.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
    const mesh = add(g, m, 0, y, -d / 2, 1, 1, 1, parent);
    return mesh;
  }
  function house(
    x: number,
    z: number,
    w: number,
    d: number,
    h: number,
    rot: number,
    roofMat = mat.roof,
  ) {
    const house = new T.Group();
    house.position.set(x, 0, z);
    house.rotation.y = rot;
    group.add(house);
    colliders.push({
      x,
      z,
      w: Math.abs(Math.cos(rot)) * w + Math.abs(Math.sin(rot)) * d,
      d: Math.abs(Math.cos(rot)) * d + Math.abs(Math.sin(rot)) * w,
    });
    box(mat.stone, 0, 0.4, 0, w + 0.2, 0.8, d + 0.2, house);
    box(mat.plaster, 0, h / 2 + 0.5, 0, w, h, d, house);
    gable(w, 2.6, d, mat.plaster, house, h + 0.5);
    const slope = Math.atan2(2.8, w / 2 + 0.5),
      length = Math.hypot(w / 2 + 0.5, 2.8);
    for (const s of [-1, 1]) {
      const roof = box(
        roofMat,
        s * (w / 4 + 0.25),
        h + 1.9,
        0,
        length,
        0.16,
        d + 1.15,
        house,
      );
      roof.rotation.z = -s * slope;
      for (const end of [-1, 1]) {
        const b = box(
          mat.darkWood,
          s * (w / 4 + 0.25),
          h + 1.8,
          end * (d / 2 + 0.53),
          length,
          0.2,
          0.16,
          house,
        );
        b.rotation.z = -s * slope;
      }
    }
    if (z > -15) {
      const rows = Math.ceil(length / 0.27), columns = Math.ceil((d + 1.15) / 0.34);
      for (const side of [-1, 1]) for (let row = 0; row < rows; row++) {
        const along = (row + 0.5) / rows * length;
        for (let col = 0; col < columns; col++) {
          const tile = box(roofMat,
            side * ((w / 2 + 0.5) - along * Math.cos(slope)),
            h + 0.55 + along * Math.sin(slope) + 0.055,
            -d / 2 - 0.42 + (col + (row % 2) * 0.5) * (d + 0.85) / columns,
            length / rows + 0.045, 0.065, (d + 1.15) / columns - 0.012, house);
          tile.rotation.z = -side * slope;
        }
      }
    }
    box(mat.darkWood, 0, h + 3.34, 0, 0.2, 0.2, d + 1.3, house);
    for (const xx of [-w / 2 + 0.08, 0, w / 2 - 0.08])
      for (const zz of [-d / 2 - 0.01, d / 2 + 0.01])
        box(mat.darkWood, xx, h / 2 + 0.5, zz, 0.17, h + 0.1, 0.16, house);
    for (const yy of [0.85, h * 0.52 + 0.5, h + 0.48]) {
      for (const zz of [-d / 2 - 0.03, d / 2 + 0.03])
        box(mat.darkWood, 0, yy, zz, w, 0.18, 0.17, house);
      for (const xx of [-w / 2 - 0.02, w / 2 + 0.02])
        box(mat.darkWood, xx, yy, 0, 0.17, 0.18, d, house);
    }
    for (const s of [-1, 1])
      beam(
        new T.Vector3(s * (w / 2 - 0.1), h + 0.6, d / 2 + 0.1),
        new T.Vector3(0, h + 2.9, d / 2 + 0.1),
        0.16,
        house,
        mat.darkWood,
      );
    for (const zz of [-d / 2 - 0.09, d / 2 + 0.09]) {
      for (const side of [-1, 1]) beam(
        new T.Vector3(side * (w * 0.48), h * 0.52 + 0.6, zz),
        new T.Vector3(side * (w * 0.27), h + 0.45, zz), 0.14, house, mat.darkWood);
      for (let row = 0; row < 3; row++) for (let j = 0; j < Math.ceil(w / 0.5); j++) {
        const rock = box(mat.stone, -w / 2 + (j + 0.5) * w / Math.ceil(w / 0.5),
          0.13 + row * 0.24, zz, 0.46 + rnd() * 0.04, 0.2, 0.15 + rnd() * 0.06, house);
        rock.rotation.z = (rnd() - 0.5) * 0.08;
      }
    }
    // Working cottage entrance and framed warm windows.
    box(mat.darkWood, 0, 1.12, d / 2 + 0.055, 1.25, 2.2, 0.16, house);
    for (let i = 0; i < 6; i++)
      box(
        mat.wood,
        -0.51 + i * 0.2,
        1.08,
        d / 2 + 0.16,
        0.17,
        2.06,
        0.07,
        house,
      );
    add(
      sphereGeo,
      mat.metal,
      0.4,
      1.1,
      d / 2 + 0.24,
      0.065,
      0.065,
      0.065,
      house,
    );
    box(mat.stone, 0, 0.14, d / 2 + 0.42, 1.8, 0.25, 0.8, house);
    for (const xx of [-w * 0.31, w * 0.31]) {
      for (const yy of [1.85, h * 0.72 + 0.5]) {
        box(mat.darkWood, xx, yy, d / 2 + 0.08, 1.23, 1.45, 0.16, house);
        box(mat.glass, xx, yy, d / 2 + 0.18, 1.03, 1.22, 0.07, house);
        box(mat.wood, xx, yy, d / 2 + 0.24, 0.055, 1.3, 0.06, house);
        box(mat.wood, xx, yy, d / 2 + 0.24, 1.1, 0.07, 0.06, house);
        box(mat.wood, xx, yy - 0.79, d / 2 + 0.35, 1.35, 0.16, 0.55, house);
        for (const s of [-1, 1])
          box(mat.wood, xx + s * 0.78, yy, d / 2 + 0.1, 0.25, 1.4, 0.08, house);
      }
    }
    for (const s of [-1, 1]) {
      box(mat.darkWood, s * (w / 2 + 0.08), 2.1, 0, 0.13, 1.6, 1.5, house);
      box(mat.glass, s * (w / 2 + 0.16), 2.1, 0, 0.04, 1.35, 1.25, house);
      box(mat.wood, s * (w / 2 + 0.2), 2.1, 0, 0.04, 1.4, 0.06, house);
    }
    box(mat.stone, w * 0.25, h + 2.6, -d * 0.25, 0.8, 2.8, 0.8, house);
    box(mat.stone, w * 0.25, h + 4.08, -d * 0.25, 1, 0.2, 1, house);
    if (z === 11) {
      for (let i = 0; i <= 14; i++) {
        const angle = i / 14 * Math.PI;
        const voussoir = box(mat.stone, Math.cos(angle) * 0.83, 1.74 + Math.sin(angle) * 0.83,
          d / 2 + 0.27, 0.21, 0.3, 0.3, house);
        voussoir.rotation.z = angle - Math.PI / 2;
      }
      for (const side of [-1, 1]) for (let row = 0; row < 6; row++)
        box(mat.stone, side * 0.83, 0.17 + row * 0.28, d / 2 + 0.24, 0.25, 0.25, 0.31, house);
      // Substantial eave brackets and a slatted window box.
      for (const side of [-1, 1]) {
        beam(new T.Vector3(side * 1.6, 2.1, d / 2 + 0.2), new T.Vector3(side * 1.6, 2.95, d / 2 + 1.15), 0.13, house);
        for (let j = 0; j < 9; j++) box(mat.wood, side * w * 0.31 - 0.61 + j * 0.15, 1.05,
          d / 2 + 0.52, 0.12, 0.34, 0.09, house);
      }
      const lampLight = new T.PointLight("#ffbf72", 4, 5, 2);
      lampLight.position.set(1.1, 2.1, d / 2 + 0.8); house.add(lampLight);
    }
    lantern(1.1, 1.6, d / 2 + 0.4, house);
    // Porches add silhouette, depth, and a recognisable place to approach.
    for (const s of [-1, 1])
      box(mat.wood, s * 1.6, 1.45, d / 2 + 1.2, 0.15, 2.9, 0.15, house);
    const porch = box(roofMat, 0, 3, d / 2 + 0.7, 3.7, 0.15, 1.8, house);
    porch.rotation.x = 0.12;
    return house;
  }
  house(10, 11, 6, 5.4, 4.2, -Math.PI / 2);
  house(10, -4, 5.8, 5.3, 3.8, -Math.PI / 2, mat.terra);
  house(9, -27, 6.4, 6, 4.3, 0.3);
  house(-23, 8, 5.4, 5.5, 3.5, Math.PI / 2, mat.terra);
  house(-24, -5, 5.2, 5, 3.4, Math.PI / 2);
  house(-23, -31, 5.7, 5.2, 4.3, 0.25);
  house(1, -38, 6.5, 6, 4.6, 0, mat.terra);
  house(21, -24, 6.5, 6, 4.4, 0.25);
  house(-31, 25, 5.5, 5.2, 4.3, -0.3);
  // A tall village landmark.
  const tower = new T.Group();
  tower.position.set(4, 0, -57);
  group.add(tower);
  add(
    new T.CylinderGeometry(2.3, 2.6, 14, 8),
    mat.stone,
    0,
    7,
    0,
    1,
    1,
    1,
    tower,
  );
  add(new T.ConeGeometry(3.2, 7, 8), mat.roof, 0, 17, 0, 1, 1, 1, tower);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    box(
      mat.glass,
      Math.sin(a) * 2.33,
      11,
      Math.cos(a) * 2.33,
      0.6,
      1.8,
      0.1,
      tower,
    ).rotation.y = a;
  }
  function bench(x: number, z: number, rot: number) {
    const b = new T.Group();
    b.position.set(x, 0, z);
    b.rotation.y = rot;
    group.add(b);
    colliders.push({ x, z, w: Math.abs(Math.cos(rot)) * 2.2 + Math.abs(Math.sin(rot)) * .7,
      d: Math.abs(Math.sin(rot)) * 2.2 + Math.abs(Math.cos(rot)) * .7, top: 1.4 });
    for (const s of [-1, 1]) {
      box(mat.darkWood, s * 0.88, 0.36, 0, 0.13, 0.72, 0.65, b);
      box(mat.wood, s * 0.88, 0.9, -0.3, 0.1, 1.1, 0.1, b);
    }
    for (let i = 0; i < 3; i++)
      box(mat.wood, 0, 0.65, -0.22 + i * 0.22, 2.2, 0.1, 0.18, b);
    for (let i = 0; i < 2; i++)
      box(mat.wood, 0, 1.05 + i * 0.23, -0.32, 2.2, 0.18, 0.1, b);
  }
  // Seats face the fire; the main village path stays unobstructed.
  bench(HEARTH.x, HEARTH.z + 2.9, Math.PI);
  bench(HEARTH.x + 2.7, HEARTH.z, -Math.PI / 2);
  bench(HEARTH.x - 2.7, HEARTH.z, Math.PI / 2);
  bench(16, -10, Math.PI / 4);
  bench(-20, -9, Math.PI / 2);
  // Hearth with glowing embers and gently animated flame geometry.
  for (let i = 0; i < 16; i++) {
    let a = (i / 16) * Math.PI * 2;
    add(
      sphereGeo,
      mat.stone,
      HEARTH.x + Math.sin(a) * HEARTH.radius,
      0.22,
      HEARTH.z + Math.cos(a) * HEARTH.radius,
      0.35,
      0.3,
      0.4,
    );
  }
  const coal = new T.MeshStandardMaterial({
    color: "#4d2520",
    emissive: "#f05a15",
    emissiveIntensity: 0.3,
  });
  add(new T.CylinderGeometry(.8, .8, 0.12, 24), coal, HEARTH.x, 0.15, HEARTH.z);
  add(new T.CylinderGeometry(3.6, 3.6, .06, 48), mat.path, HEARTH.x, .01, HEARTH.z).castShadow = false;
  for (let i = 0; i < 7; i++) {
    let a = i * 0.8;
    const log = add(
      cylGeo,
      mat.darkWood,
      HEARTH.x + Math.sin(a) * 0.3,
      0.32,
      HEARTH.z + Math.cos(a) * 0.3,
      0.14,
      1.65,
      0.14,
    );
    log.rotation.set(1.25, a, 0.3);
  }
  for (let i = 0; i < 4; i++) {
    const f = makeFlame(0.65, 1.1);
    f.position.set(HEARTH.x + (rnd() - 0.5) * 0.5, 0.8, HEARTH.z + (rnd() - 0.5) * 0.5);
    f.rotation.y = (i * Math.PI) / 4;
    group.add(f);
    flames.push(f);
  }
  colliders.push({ x: HEARTH.x, z: HEARTH.z, w: 2.3, d: 2.3, top: .7 });
  lantern(HEARTH.x - 2.5, .25, HEARTH.z - 2.2);
  const hearthLight = new T.PointLight("#ffad54", 9, 8, 2);
  hearthLight.position.set(HEARTH.x, 1, HEARTH.z); group.add(hearthLight);
  // Pond dock.
  for (let i = 0; i < 18; i++)
    box(mat.wood, -20.8 - i * 0.2, 0.15, -10.5, 0.18, 0.18, 3.3);
  for (const x of [-21, -24])
    for (const z of [-9, -12])
      add(cylGeo, mat.darkWood, x, 0.05, z, 0.13, 1.2, 0.13);
  lantern(-23.7, 0.3, -9.2);
  // Tea garden pergola.
  for (const x of [13, 18])
    for (const z of [-8, -13]) box(mat.wood, x, 1.75, z, 0.18, 3.5, 0.18);
  for (let i = 0; i < 8; i++)
    box(mat.wood, 12.8 + i * 0.78, 3.45, -10.5, 0.14, 0.16, 5.6);
  box(mat.wood, 15.5, 3.3, -8, 5.7, 0.2, 0.2);
  box(mat.wood, 15.5, 3.3, -13, 5.7, 0.2, 0.2);
  add(cylGeo, mat.wood, 15.2, 0.6, -10, 0.12, 1.2, 0.12);
  add(cylGeo, mat.wood, 15.2, 1.2, -10, 0.8, 0.12, 0.8);
  // Postbox and hand-lettered sign geometry use readable DOM labels on approach.
  box(mat.wood, 3, 0.7, -1, 0.16, 1.4, 0.16);
  box(mat.wood, 3, 1.6, -1, 0.6, 0.7, 0.45);
  box(mat.metal, 3, 1.7, -0.765, 0.38, 0.06, 0.02);
  add(new T.ConeGeometry(0.49, 0.3, 4), mat.terra, 3, 2.1, -1).rotation.y =
    Math.PI / 4;
  // Fences and lamps guide movement without a HUD full of markers.
  for (const side of [-1, 1])
    for (let z = 18; z < 39; z += 2.4) {
      const x = roadX(z) + side * 3.2;
      box(mat.wood, x, 0.7, z, 0.13, 1.4, 0.13);
      for (const y of [0.45, 0.95])
        box(mat.wood, x, y, z + 1.2, 0.09, 0.11, 2.5);
    }
  for (const z of [20, 0, -27]) {
    box(mat.darkWood, -3.1, 1.7, z, 0.13, 3.4, 0.13);
    box(mat.darkWood, -2.8, 3.35, z, 0.75, 0.1, 0.1);
    lantern(-2.5, 2.55, z);
  }
  onProgress(45);
  // Static architectural geometry is merged per material into a handful of draw calls.
  group.updateMatrixWorld(true);
  const batches = new Map<T.Material, T.BufferGeometry[]>();
  const keep = new Set<T.Object3D>([...flames, water, pond, terrainMesh]);
  const remove: T.Object3D[] = [];
  group.traverse((o) => {
    if (o instanceof T.Mesh && !keep.has(o)) {
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      if (!g.index)
        g.setIndex(
          Array.from({ length: g.attributes.position.count }, (_, i) => i),
        );
      if (!g.attributes.uv)
        g.setAttribute(
          "uv",
          new T.Float32BufferAttribute(
            new Float32Array(g.attributes.position.count * 2),
            2,
          ),
        );
      if (g.attributes.color) g.deleteAttribute("color");
      const m = o.material as T.Material;
      if (!batches.has(m)) batches.set(m, []);
      batches.get(m)!.push(g);
      remove.push(o);
    }
  });
  remove.forEach((o) => o.removeFromParent());
  batches.forEach((gs, m) => {
    const g = mergeGeometries(gs);
    gs.forEach((g) => g.dispose());
    if (g) {
      const mesh = add(g, m, 0, 0, 0);
      mesh.castShadow = m !== mat.ground && m !== mat.path;
    }
  });
  // Wind-deformed instanced meadow: one geometry and one material for thousands of blades.
  function windMaterial(material: T.MeshStandardMaterial, scale: number, tree = false) {
    const deform = (shader: { uniforms: Record<string, unknown>; vertexShader: string }) => {
      shader.uniforms.uWindTime = wind.time; shader.uniforms.uWindStrength = wind.strength;
      shader.vertexShader = "uniform float uWindTime; uniform float uWindStrength;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
        vec3 origin = instanceMatrix[3].xyz;
        float weight = ${tree ? "pow(clamp(position.y / 8.0, 0.0, 1.0), 2.0)" : "pow(max(0.0, position.y), 2.0)"};
        float wave = sin(uWindTime * 1.2 + origin.x * .31 + origin.z * .24 + position.y * 1.8);
        transformed.x += weight * wave * uWindStrength * ${scale.toFixed(3)};
        transformed.z += weight * sin(uWindTime*.83 + origin.x*.19 + position.y) * uWindStrength * ${(scale * .36).toFixed(3)};
      `);
    };
    material.onBeforeCompile = deform;
    material.customProgramCacheKey = () => `village-wind-${scale}-${tree}`;
    const depth = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, map: material.map, alphaTest: material.alphaTest, side: material.side });
    depth.onBeforeCompile = deform;
    depth.customProgramCacheKey = material.customProgramCacheKey;
    return depth;
  }
  const grassMat = new T.MeshStandardMaterial({
    color: "#81914a",
    side: T.DoubleSide,
    roughness: 1,
  });
  const grassGeo = new T.BufferGeometry();
  grassGeo.setAttribute(
    "position",
    new T.Float32BufferAttribute(
      [
        -0.055, 0, 0, 0.055, 0, 0, 0.025, 0.55, 0, -0.04, 0, 0, 0.025, 0.55, 0,
        0.045, 0.86, 0, 0, 0, -0.055, 0, 0, 0.055, 0.025, 0.6, 0,
      ],
      3,
    ),
  );
  grassGeo.computeVertexNormals();
  const grassCount = 30000;
  const grass = new T.InstancedMesh(grassGeo, grassMat, grassCount);
  let gi = 0;
  for (let attempt = 0; gi < grassCount && attempt < 450000; attempt++) {
    let x = (rnd() - 0.5) * 75,
      z = (rnd() - 0.5) * 90;
    const river = Math.abs(x - riverX(z));
    if (
      river < 4 ||
      Math.abs(x - roadX(z)) < 2.7 ||
      (Math.abs(z - 3) < 1.6 && x < 15) ||
      Math.hypot(x + 25, z + 17) < 8 ||
      colliders.some(
        (c) =>
          Math.abs(x - c.x) < c.w / 2 + 1 && Math.abs(z - c.z) < c.d / 2 + 1,
      ) ||
      clearPlanting(x, z)
    )
      continue;
    dummy.position.set(x, landscapeHeight(x, z), z);
    dummy.rotation.set(0, rnd() * 6.28, 0);
    dummy.scale.set(0.6 + rnd() * 0.7, 0.2 + rnd() * 0.6, 0.6 + rnd() * 0.7);
    dummy.updateMatrix();
    grass.setMatrixAt(gi, dummy.matrix);
    grass.setColorAt(
      gi,
      new T.Color().setHSL(
        0.19 + rnd() * 0.09,
        0.28 + rnd() * 0.25,
        0.25 + rnd() * 0.16,
      ),
    );
    gi++;
  }
  grass.count = gi;
  grass.customDepthMaterial = windMaterial(grassMat, 0.42);
  vegetation.push(grass);
  grass.receiveShadow = true;
  group.add(grass);
  // Bushes use a shared, irregular leaf canopy rather than solid green volumes.
  const leafGeo = new T.BufferGeometry();
  leafGeo.setAttribute(
    "position",
    new T.Float32BufferAttribute(
      [
        0, 0.015, -0.19, -0.07, 0, -0.03, 0, 0.025, 0, 0.07, 0, -0.03, 0, 0.005,
        0.19,
      ],
      3,
    ),
  );
  leafGeo.setIndex([0, 1, 2, 0, 2, 3, 1, 4, 2, 2, 4, 3]);
  leafGeo.computeVertexNormals();
  const foliageParts: T.BufferGeometry[] = [];
  for (let i = 0; i < 110; i++) {
    const a = rnd() * Math.PI * 2,
      r = Math.sqrt(rnd()),
      y = rnd();
    dummy.position.set(
      Math.cos(a) * r * 0.95,
      y * 0.95,
      Math.sin(a) * r * 0.75,
    );
    dummy.rotation.set(rnd() * 0.9, rnd() * 6.28, rnd() * 0.5);
    dummy.scale.setScalar(0.6 + rnd() * 0.9);
    dummy.updateMatrix();
    foliageParts.push(leafGeo.clone().applyMatrix4(dummy.matrix));
  }
  const bushGeo = mergeGeometries(foliageParts)!;
  foliageParts.forEach((g) => g.dispose());
  leafGeo.dispose();
  const bushes = new T.InstancedMesh(
    bushGeo,
    new T.MeshStandardMaterial({
      color: "#6a8044",
      roughness: 1,
      side: T.DoubleSide,
    }),
    150,
  );
  let bushCount = 0;
  for (let i = 0; i < 150; i++) {
    let x: number, z: number;
    if (i < 90) {
      z = -38 + rnd() * 76;
      x = riverX(z) + (i % 2 ? 1 : -1) * (4 + rnd() * 1.6);
    } else if (i < 150) {
      z = 17 + rnd() * 22;
      x = roadX(z) + (i % 2 ? 1 : -1) * (3.7 + rnd() * 2);
    } else {
      const c = colliders[i % colliders.length];
      x = c.x + (i % 2 ? 1 : -1) * (c.w / 2 + 0.3);
      z = c.z + (rnd() - 0.5) * (c.d + 1);
    }
    if (clearPlanting(x, z)) continue;
    dummy.position.set(x, landscapeHeight(x, z) - 0.08, z);
    dummy.rotation.set(0, rnd() * 6.28, 0);
    dummy.scale.set(0.6 + rnd() * 0.6, 0.5 + rnd() * 0.65, 0.6 + rnd() * 0.6);
    dummy.updateMatrix();
    bushes.setMatrixAt(bushCount, dummy.matrix);
    bushes.setColorAt(
      bushCount++,
      new T.Color().setHSL(0.21 + rnd() * 0.05, 0.35, 0.32 + rnd() * 0.15),
    );
  }
  bushes.count = bushCount;
  bushes.customDepthMaterial = windMaterial(bushes.material as T.MeshStandardMaterial, 0.17);
  vegetation.push(bushes);
  bushes.receiveShadow = true;
  bushes.castShadow = true;
  group.add(bushes);
  // Daisies and lavender have stems, leaves, and petal silhouettes at walking distance.
  const plantParts: T.BufferGeometry[] = [];
  const stem = new T.CylinderGeometry(0.012, 0.016, 0.68, 4);
  stem.translate(0, 0.34, 0);
  plantParts.push(stem);
  for (let i = 0; i < 5; i++) {
    const leaf = new T.SphereGeometry(1, 5, 3);
    leaf.scale(0.035, 0.01, 0.16);
    leaf.rotateZ(0.45);
    leaf.rotateY(i * 2.4);
    leaf.translate(
      Math.sin(i * 2.4) * 0.09,
      0.12 + i * 0.085,
      Math.cos(i * 2.4) * 0.09,
    );
    plantParts.push(leaf);
  }
  const plantGeo = mergeGeometries(plantParts)!;
  plantParts.forEach((g) => g.dispose());
  const plantCount = 620,
    stems = new T.InstancedMesh(
      plantGeo,
      new T.MeshStandardMaterial({ color: "#5e7536", roughness: 1 }),
      plantCount,
    );
  const petals: T.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const p = new T.SphereGeometry(1, 5, 3);
    p.scale(0.034, 0.012, 0.085);
    p.translate(0, 0, 0.055);
    p.rotateY((i / 7) * Math.PI * 2);
    petals.push(p);
  }
  const blossomGeo = mergeGeometries(petals)!;
  petals.forEach((p) => p.dispose());
  const blossoms = new T.InstancedMesh(
    blossomGeo,
    new T.MeshStandardMaterial({ color: "#fff3d7", roughness: 0.9 }),
    plantCount,
  );
  let flowerCount = 0;
  for (let i = 0; i < plantCount; i++) {
    const z = -32 + rnd() * 69,
      x = roadX(z) + (i % 2 ? 1 : -1) * (2.6 + rnd() * 4.2),
      s = 0.4 + rnd() * 0.8;
    if (clearPlanting(x, z)) continue;
    dummy.position.set(x, landscapeHeight(x, z), z);
    dummy.scale.setScalar(s);
    dummy.rotation.set(0, rnd() * 6.28, 0);
    dummy.updateMatrix();
    stems.setMatrixAt(flowerCount, dummy.matrix);
    dummy.position.y += 0.68 * s;
    dummy.updateMatrix();
    blossoms.setMatrixAt(flowerCount, dummy.matrix);
    blossoms.setColorAt(
      flowerCount++,
      new T.Color(["#fff0c9", "#d6b05d", "#9298cc"][i % 3]),
    );
  }
  stems.count = blossoms.count = flowerCount;
  vegetation.push(stems, blossoms);
  stems.receiveShadow = true;
  blossoms.receiveShadow = true;
  group.add(stems, blossoms);
  // A complete valley surrounds the playable space, including side and rear views.
  for (let band = 0; band < 3; band++) {
    const ring = new T.PlaneGeometry(1, 1, 220, 18);
    const positions = ring.attributes.position, uv = ring.attributes.uv;
    for (let i = 0; i < positions.count; i++) {
      const angle = uv.getX(i) * Math.PI * 2;
      const across = uv.getY(i);
      const radius = 170 + band * 68 + across * 94;
      const x = Math.sin(angle) * radius, z = Math.cos(angle) * radius;
      const silhouette = 42 + band * 11 + Math.sin(angle * 5 + band) * 18
        + Math.abs(Math.sin(angle * 9 - band * 2)) ** 3 * 24 + Math.sin(angle * 23) * 4;
      const envelope = Math.sin(across * Math.PI);
      const ridges = Math.sin(x * .11 + z * .045) * 2.6 + Math.cos(z * .16 - x * .09) * 1.8;
      positions.setXYZ(i, x, Math.max(-3, envelope * (silhouette + ridges)) - 3, z);
      uv.setXY(i, x / 16, z / 16);
    }
    ring.computeVertexNormals();
    const material = new T.MeshStandardMaterial({ map: stoneMap,
      color: ["#63796b", "#718794", "#899aa8"][band], roughness: 1, side: T.DoubleSide });
    add(ring, material, 0, 0, 0).castShadow = false;
  }
  const forestPlacements: { matrix: T.Matrix4; color: T.Color }[] = [];
  for (let i = 0; i < 640; i++) {
    const angle = i * 2.39996, radius = 54 + Math.sqrt(rnd()) * 125;
    const x = Math.sin(angle) * radius, z = Math.cos(angle) * radius;
    const scale = .65 + rnd() * .8;
    dummy.position.set(x, landscapeHeight(x, z), z); dummy.rotation.set(0, rnd() * 6.28, 0);
    dummy.scale.set(scale, scale * (1 + rnd() * .35), scale); dummy.updateMatrix();
    forestPlacements.push({ matrix: dummy.matrix.clone(), color: new T.Color().setHSL(.22 + rnd() * .05, .13 + rnd() * .12, .73 + rnd() * .2) });
  }
  // A small distant landmark, distinct from the village clock tower.
  const castleMaterial = new T.MeshStandardMaterial({ color: "#777f72", roughness: 1 });
  for (const [x, y, h] of [[-18, 11, 9], [-22, 10, 5], [-14, 9, 6]]) {
    add(new T.CylinderGeometry(.8, 1.15, h, 6), castleMaterial, x, y + h / 2, -158).castShadow = false;
    add(new T.ConeGeometry(1.05, h * .5, 6), mat.roof, x, y + h * 1.25, -158).castShadow = false;
  }
  // Authored weeping silhouettes: curved branches with narrow leaves, shared by two trees.
  const willowBarkParts: T.BufferGeometry[] = [], willowLeafParts: T.BufferGeometry[] = [];
  const willowLeaf = new T.BufferGeometry();
  willowLeaf.setAttribute("position", new T.Float32BufferAttribute([0, 0, 0, -.038, -.105, .015, 0, -.25, 0, .038, -.105, .015], 3));
  willowLeaf.setIndex([0, 1, 2, 0, 2, 3]); willowLeaf.computeVertexNormals();
  const trunkCurve = new T.CatmullRomCurve3([new T.Vector3(0, 0, 0), new T.Vector3(.15, 2, .15), new T.Vector3(-.12, 4, 0), new T.Vector3(.3, 6.4, -.1)]);
  willowBarkParts.push(new T.TubeGeometry(trunkCurve, 10, .25, 8, false));
  for (let branch = 0; branch < 28; branch++) {
    const angle = branch * 2.399, extent = 1.8 + rnd() * 2.2;
    const tip = new T.Vector3(Math.cos(angle) * extent, 4.4 + rnd() * 1.9, Math.sin(angle) * extent);
    const curve = new T.CatmullRomCurve3([new T.Vector3(0, 2.7 + rnd() * 1.7, 0), tip.clone().multiply(new T.Vector3(.55, 1.1, .55)), tip]);
    willowBarkParts.push(new T.TubeGeometry(curve, 6, .035 + rnd() * .025, 5, false));
    for (let strand = 0; strand < 7; strand++) {
      const top = curve.getPoint(.55 + strand * .067);
      const length = 1.8 + rnd() * 2.2;
      for (let leaf = 0; leaf < 22; leaf++) {
        const t = leaf / 22;
        dummy.position.set(top.x + Math.sin(t * 2.5 + angle) * .23, top.y - t * length,
          top.z + Math.cos(t * 3 + angle) * .23);
        dummy.rotation.set(.2 + rnd() * .6, angle + leaf * 2.3, (rnd() - .5) * .5);
        dummy.scale.setScalar(.7 + rnd() * .6); dummy.updateMatrix();
        willowLeafParts.push(willowLeaf.clone().applyMatrix4(dummy.matrix));
      }
    }
  }
  const willowBark = mergeGeometries(willowBarkParts)!, willowLeaves = mergeGeometries(willowLeafParts)!;
  willowBarkParts.forEach(g => g.dispose()); willowLeafParts.forEach(g => g.dispose()); willowLeaf.dispose();
  const willowLeafMaterial = new T.MeshStandardMaterial({ color: "#87934a", roughness: .9, side: T.DoubleSide });
  for (const [geometry, material] of [[willowBark, mat.wood], [willowLeaves, willowLeafMaterial]] as const) {
    const mesh = new T.InstancedMesh(geometry, material, 2);
    [[-14, -7, 1.3], [-27, -19, 1.45]].forEach(([x, z, scale], i) => {
      dummy.position.set(x, groundY(x, z), z); dummy.rotation.set(0, i * 2, 0); dummy.scale.setScalar(scale); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    });
    if (material === willowLeafMaterial) mesh.customDepthMaterial = windMaterial(material, .48, true);
    mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
  }
  // Ivy climbs the two visible cottage faces with gaps around the entrance.
  const ivy = new T.InstancedMesh(bushGeo, bushes.material, 18);
  for (let i = 0; i < 18; i++) {
    const y = .5 + (i % 6) * .6;
    dummy.position.set(i < 12 ? 7.2 : 8 + (i % 6) * .7, y, i < 6 ? 13 : i < 12 ? 8.7 : 13.75);
    dummy.rotation.set(0, i, 0); dummy.scale.set(.42, .42, .26); dummy.updateMatrix(); ivy.setMatrixAt(i, dummy.matrix);
  }
  ivy.customDepthMaterial = windMaterial(bushes.material as T.MeshStandardMaterial, .17);
  ivy.receiveShadow = true; group.add(ivy);
  onProgress(60);
  const gltf = await new GLTFLoader().loadAsync(assets("models/birch.glb"));
  gltf.scene.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(gltf.scene),
    size = bounds.getSize(new T.Vector3());
  const factor = 8 / size.y;
  // Bake our licensed birch into a transparent crossed-card LOD: natural canopy at four triangles per tree.
  const bakeScene = new T.Scene(), bakeTree = gltf.scene.clone(true);
  const bakeMaterials: T.Material[] = [];
  bakeTree.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    const prepare = (m: T.Material) => {
      const copy = m.clone();
      if (copy instanceof T.MeshStandardMaterial) { copy.alphaTest = .3; copy.transparent = false; copy.side = T.DoubleSide; }
      bakeMaterials.push(copy); return copy;
    };
    node.material = Array.isArray(node.material) ? node.material.map(prepare) : prepare(node.material);
  });
  bakeScene.add(bakeTree, new T.HemisphereLight(0xffffff, "#b4b8a6", 2.2));
  const center = bounds.getCenter(new T.Vector3()), cardWidth = Math.max(size.x, size.z) * 1.08;
  const bakeCamera = new T.OrthographicCamera(-cardWidth / 2, cardWidth / 2, size.y * .53, -size.y * .53, .01, size.y * 5);
  bakeCamera.position.copy(center).add(new T.Vector3(0, 0, size.y * 2)); bakeCamera.lookAt(center);
  const target = new T.WebGLRenderTarget(384, 512); target.texture.colorSpace = T.SRGBColorSpace;
  const previousTarget = renderer.getRenderTarget(), previousTone = renderer.toneMapping;
  const previousColor = renderer.getClearColor(new T.Color()), previousAlpha = renderer.getClearAlpha();
  renderer.toneMapping = T.NoToneMapping; renderer.setRenderTarget(target); renderer.setClearColor(0, 0); renderer.clear(); renderer.render(bakeScene, bakeCamera);
  renderer.setRenderTarget(previousTarget); renderer.setClearColor(previousColor, previousAlpha); renderer.toneMapping = previousTone;
  bakeMaterials.forEach(m => m.dispose()); renderTargets.push(target);
  const cards = [new T.PlaneGeometry(cardWidth * factor, 8.48), new T.PlaneGeometry(cardWidth * factor, 8.48)];
  cards[1].rotateY(Math.PI / 2); cards.forEach(card => card.translate(0, 4, 0));
  const forestGeometry = mergeGeometries(cards)!; cards.forEach(card => card.dispose());
  const forestMaterial = new T.MeshStandardMaterial({ map: target.texture, alphaTest: .35, side: T.DoubleSide, roughness: 1 });
  const forest = new T.InstancedMesh(forestGeometry, forestMaterial, forestPlacements.length);
  forestPlacements.forEach((p, i) => { forest.setMatrixAt(i, p.matrix); forest.setColorAt(i, p.color); });
  group.add(forest); vegetation.push(forest);

  const treePositions: [number, number, number][] = [
    [-5, 22, 0.78],
    [7, 28, 0.8],
    [-7, 15, 1.15],
    [16, 19, 1.2],
    [-18, -20, 1.3],
    [-32, -10, 1.1],
    [20, -16, 1.3],
    [-31, 15, 1],
    [-25, 29, 1.1],
    [22, 1, 1],
    [-3, -32, 1],
    [13, -41, 1.1],
  ];
  for (let i = 0; i < 20; i++) {
    let a = (i / 20) * Math.PI * 2;
    treePositions.push([
      Math.sin(a) * 46,
      -8 + Math.cos(a) * 49,
      0.65 + rnd() * 0.7,
    ]);
  }
  const treeTransforms = treePositions.map(([x, z, s]) => {
    dummy.position.set(x, landscapeHeight(x, z), z);
    dummy.rotation.set(0, rnd() * Math.PI * 2, 0);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    return dummy.matrix.clone();
  });
  const treeBounds = treePositions.map(
    ([x, z, s]) => new T.Sphere(new T.Vector3(x, landscapeHeight(x, z) + 4 * s, z), 8 * s),
  );
  const trees: World["trees"] = [];
  gltf.scene.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    const geometry = o.geometry.clone().applyMatrix4(o.matrixWorld);
    geometry.translate(
      -bounds.getCenter(new T.Vector3()).x,
      -bounds.min.y,
      -bounds.getCenter(new T.Vector3()).z,
    );
    geometry.scale(factor * 1.4, factor, factor * 1.4);
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    materials.forEach((m) => {
      if (m instanceof T.MeshStandardMaterial) {
        m.roughness = 1;
        m.envMapIntensity = 0.6;
        if (
          m.transparent ||
          m.alphaMap ||
          m.alphaTest > 0 ||
          m.name.includes("leaves")
        ) {
          m.alphaTest = 0.25;
          m.transparent = false;
          m.side = T.DoubleSide;
        }
      }
    });
    const inst = new T.InstancedMesh(
      geometry,
      o.material,
      treePositions.length,
    );
    treeTransforms.forEach((matrix, i) => inst.setMatrixAt(i, matrix));
    inst.frustumCulled = false;
    inst.instanceMatrix.setUsage(T.DynamicDrawUsage);
    trees.push({ mesh: inst, transforms: treeTransforms, bounds: treeBounds });
    if (!Array.isArray(inst.material) && inst.material instanceof T.MeshStandardMaterial)
      inst.customDepthMaterial = windMaterial(inst.material, inst.material.name.includes("leaves") ? 0.3 : 0.1, true);
    inst.castShadow = true;
    inst.receiveShadow = true;
    group.add(inst);
  });
  onProgress(80);
  return {
    group,
    trees,
    colliders,
    flames,
    lanterns,
    water,
    wind,
    vegetation,
    dispose() {
      const geometries = new Set<T.BufferGeometry>(),
        materials = new Set<T.Material>();
      group.traverse((o) => {
        if (o instanceof T.Mesh) {
          geometries.add(o.geometry);
          if (o.customDepthMaterial) materials.add(o.customDepthMaterial);
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            materials.add(m),
          );
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => {
        Object.values(m).forEach((v) => {
          if (v instanceof T.Texture) v.dispose();
        });
        m.dispose();
      });
      textures.forEach((t) => t.dispose());
      renderTargets.forEach(t => t.dispose());
    },
  };
}

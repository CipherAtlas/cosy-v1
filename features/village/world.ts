import * as T from "three";
import { makeFlame } from "./flame";
import { buildBridge } from "./bridge";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { paintedTextures } from "./paintedTextures";
import { buildCottage } from "./architecture";
import { fantasyTreeGeometry } from "./fantasyTrees";
import { BRIDGE, HEARTH, groundY, landscapeHeight, riverX, roadX, type Collider } from "./environment";
export { groundY, riverX } from "./environment";

export type World = {
  group: T.Group;
  trees: {
    mesh: T.InstancedMesh;
    transforms: T.Matrix4[];
    bounds: T.Sphere[];
  }[];
  treeLod: T.InstancedMesh;
  setWeather: (rain: number, dusk: number) => void;
  colliders: Collider[];
  flames: T.Mesh[];
  lanterns: T.Mesh[];
  water: T.Mesh;
  wind: { time: { value: number }; strength: { value: number } };
  vegetation: T.InstancedMesh[];
  dispose: () => void;
};
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
  const painted = paintedTextures();
  const textures = Object.values(painted);
  const { wood: woodMap, roof: roofMap, plaster: plasterMap,
    stone: stoneMap, meadow: groundMap, path: pathMap } = painted;
  groundMap.repeat.set(48, 48);
  const wetness = { value: 0 };
  const mat = {
    wood: new T.MeshStandardMaterial({
      map: woodMap,
      color: "#d7ac76",
      roughness: 0.95,
    }),
    darkWood: new T.MeshStandardMaterial({
      map: woodMap,
      color: "#99806b",
      roughness: 0.94,
    }),
    plaster: new T.MeshStandardMaterial({
      color: "#fff2d3",
      bumpMap: plasterMap,
      bumpScale: 0.045,
      roughness: 1,
    }),
    roof: new T.MeshStandardMaterial({
      map: roofMap,
      color: "#53c4de",
      roughness: 0.91,
      side: T.DoubleSide,
    }),
    terra: new T.MeshStandardMaterial({
      map: roofMap,
      color: "#e99b7c",
      roughness: 0.91,
      side: T.DoubleSide,
    }),
    stone: new T.MeshStandardMaterial({
      map: stoneMap,
      color: "#e7e3cc",
      roughness: 1,
    }),
    ground: new T.MeshStandardMaterial({
      map: groundMap,
      color: "#ffffff",
      vertexColors: true,
      roughness: 1,
    }),
    path: new T.MeshStandardMaterial({
      map: pathMap,
      color: "#f3e5bd",
      bumpMap: pathMap,
      bumpScale: 0.025,
      roughness: 0.94,
    }),
    glass: new T.MeshStandardMaterial({
      map: painted.window,
      emissiveMap: painted.window,
      color: "#fff8e7",
      emissive: "#ffd089",
      emissiveIntensity: 0.12,
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
    paper: new T.MeshStandardMaterial({ color: "#fff0cd", roughness: 1 }),
    trim: new T.MeshStandardMaterial({ color: "#f3d099", roughness: .7 }),
    lilac: new T.MeshStandardMaterial({ map: roofMap, color: "#b6aceb", roughness: .86, side: T.DoubleSide }),
    teal: new T.MeshStandardMaterial({ color: "#50afa8", roughness: .8 }),
    rose: new T.MeshStandardMaterial({ color: "#e68f94", roughness: .85 }),
  };
  mat.wood.name = "Village oak";
  mat.stone.name = "Village limestone";
  mat.plaster.bumpScale = .012;
  // World-space wear keeps large merged batches from repeating the same flat tint.
  for (const material of [mat.plaster, mat.wood, mat.darkWood, mat.stone, mat.roof, mat.terra, mat.lilac, mat.path, mat.ground]) {
    material.onBeforeCompile = shader => {
      shader.uniforms.wetness = wetness;
      shader.vertexShader = "varying vec3 surfacePosition;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>",
        "#include <begin_vertex>\nsurfacePosition=(modelMatrix*vec4(position,1.)).xyz;");
      shader.fragmentShader = "varying vec3 surfacePosition; uniform float wetness;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
        float grain=sin(surfacePosition.x*3.7+sin(surfacePosition.z*2.3))*sin(surfacePosition.y*4.1+surfacePosition.z*1.8);
        float wear=.985+grain*.015;
        float footShade=mix(.86,1.,smoothstep(.06,1.4,surfacePosition.y));
        diffuseColor.rgb*=wear*${material === mat.plaster || material === mat.wood || material === mat.darkWood ? "footShade" : "1."};
        diffuseColor.rgb*=1.-wetness*.16;
      `);
      shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,max(.32,roughnessFactor*.57),wetness);");
    };
    material.customProgramCacheKey = () => `village-surface-${material.type}-${material === mat.plaster || material === mat.wood || material === mat.darkWood}`;
  }
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
    const c = new T.Color().setHSL(.235 + patch * .035, .54, .56 + patch * .13);
    colors.push(c.r, c.g, c.b);
  }
  terrain.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  terrain.computeVertexNormals();
  const terrainMesh = add(terrain, mat.ground, 0, 0, 0);
  terrainMesh.castShadow = false;
  const surfaceShader = mat.ground.onBeforeCompile;
  mat.ground.onBeforeCompile = shader => {
    surfaceShader(shader, renderer);
    shader.fragmentShader = `
      float meadowHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float meadowNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(meadowHash(i),meadowHash(i+vec2(1.,0.)),f.x),mix(meadowHash(i+vec2(0.,1.)),meadowHash(i+vec2(1.,1.)),f.x),f.y);}
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
      float meadow=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
      float meadowPatch=meadowNoise(surfacePosition.xz*.065)*.7+meadowNoise(surfacePosition.xz*.21)*.3;
      diffuseColor.rgb=mix(vec3(.16,.28,.035),vec3(.38,.51,.10),meadowPatch)*(.68+meadow*1.8);
    `);
  };
  mat.ground.customProgramCacheKey = () => "village-painted-meadow";
  // An opaque soil-and-moss shoulder blends paving into the meadow without alpha overdraw.
  const pathMaterial = mat.path.clone();
  pathMaterial.vertexColors = true;
  pathMaterial.onBeforeCompile = shader => {
    mat.path.onBeforeCompile(shader, renderer);
    shader.uniforms.shoulderMap = { value: groundMap };
    shader.fragmentShader = "uniform sampler2D shoulderMap;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `
      float edge=1.-vColor.r;
      float breakup=sin(surfacePosition.x*19.+sin(surfacePosition.z*11.))*sin(surfacePosition.z*23.);
      float blend=smoothstep(.1,.85,edge+breakup*.12);
      float soilDetail=texture2D(shoulderMap,surfacePosition.xz*.3).g;
      vec3 soil=vec3(.21,.31,.065)*(.75+soilDetail);
      diffuseColor.rgb=mix(diffuseColor.rgb,soil,blend);
    `);
  };
  pathMaterial.customProgramCacheKey = () => "village-path-shoulder";
  // Narrow, curved paths are geometry so their paving follows the village layout.
  const pathSurfaces: { geometry: T.BufferGeometry; spine: T.Vector3[]; width: number }[] = [];
  function path(points: T.Vector3[], width: number) {
    const c = new T.CatmullRomCurve3(points);
    const vs: number[] = [],
      uv: number[] = [],
      shoulderColors: number[] = [],
      indices: number[] = [];
    for (let i = 0; i <= 100; i++) {
      let p = c.getPoint(i / 100),
        t = c.getTangent(i / 100);
      for (const s of [-1.27, -1, -.73, .73, 1, 1.27]) {
        const shoulder = 1 + Math.sin(i * 0.71) * 0.055 + Math.sin(i * 1.37) * 0.025;
        let x = p.x + (t.z * width * s * shoulder) / 2,
          z = p.z - (t.x * width * s * shoulder) / 2;
        vs.push(x, Math.max(landscapeHeight(x, z), 0) + 0.045 + pathSurfaces.length*.002, z);
        uv.push(x / 2, z / 2);
        const center = Math.abs(s) < 1 ? 1 : Math.abs(s) > 1 ? 0 : .62;
        shoulderColors.push(center, 1, 1);
      }
      if (i < 100) {
        for (let strip=0; strip<5; strip++) {
          const a=i*6+strip;
          indices.push(a,a+6,a+1,a+1,a+6,a+7);
        }
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(vs, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setAttribute("color", new T.Float32BufferAttribute(shoulderColors, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    add(g, pathMaterial, 0, 0, 0).castShadow = false;
    pathSurfaces.push({ geometry: g, spine: c.getPoints(100), width });
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
  // At junctions, keep every overlapping ribbon paved; moss must never cut across a road.
  // Shared world-space UVs also prevent texture seams where their surfaces overlap.
  for (const surface of pathSurfaces) {
    const positions = surface.geometry.attributes.position, colors = surface.geometry.attributes.color;
    for (let vertex=0; vertex<positions.count; vertex++) {
      if (colors.getX(vertex) === 1) continue;
      const x=positions.getX(vertex), z=positions.getZ(vertex);
      let paving=colors.getX(vertex);
      for (const other of pathSurfaces) {
        if (other === surface) continue;
        let distance=Infinity;
        for (let segment=1; segment<other.spine.length; segment++) {
          const a=other.spine[segment-1], b=other.spine[segment];
          const dx=b.x-a.x, dz=b.z-a.z;
          const t=T.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);
          distance=Math.min(distance,Math.hypot(x-a.x-t*dx,z-a.z-t*dz));
        }
        paving=Math.max(paving,1-T.MathUtils.smoothstep(distance,other.width*.36,other.width*.64));
      }
      colors.setX(vertex,paving);
    }
  }
  // Water occupies a shallow channel, with shader normals moving independently of the banks.
  const waterUniform = { time: { value: 0 } };
  const waterMat = new T.MeshStandardMaterial({
    color: "#42a49b",
    metalness: 0,
    roughness: 0.3,
    transparent: true,
    opacity: 0.86,
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
  let houseIndex = 0;
  function house(x: number, z: number, w: number, d: number, h: number, rot: number, roofMat = mat.roof) {
    const index = houseIndex++;
    const cottage = buildCottage({ ...mat, roof: index % 3 === 2 ? mat.lilac : roofMat }, w, d, h, index);
    cottage.name = `Fantasy cottage ${index + 1}`;
    cottage.position.set(x, 0, z); cottage.rotation.y = rot; group.add(cottage);
    colliders.push({ x, z, w: Math.abs(Math.cos(rot)) * w + Math.abs(Math.sin(rot)) * d,
      d: Math.abs(Math.cos(rot)) * d + Math.abs(Math.sin(rot)) * w });
    lantern(.95, 1.6, d / 2 + .36, cottage);
    if (index === 0) {
      const lamp = new T.PointLight("#ffd19b", 3, 4, 2);
      lamp.position.set(.95, 2, d / 2 + .7); cottage.add(lamp);
    }
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
    new T.CylinderGeometry(2.3, 2.6, 14, 12),
    mat.plaster,
    0,
    7,
    0,
    1,
    1,
    1,
    tower,
  );
  add(new T.LatheGeometry([new T.Vector2(3.2,13.7),new T.Vector2(2.75,14.1),new T.Vector2(1.55,16),new T.Vector2(.65,18.6),new T.Vector2(.05,20.5)],24),mat.roof,0,0,0,1,1,1,tower);
  for(const y of [1,8,13.65]) add(new T.CylinderGeometry(2.48,2.48,.16,12),mat.trim,0,y,0,1,1,1,tower);
  add(sphereGeo,mat.trim,0,20.6,0,.22,.34,.22,tower);
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
      if (o.material !== pathMaterial) {
        const material = o.material as T.MeshStandardMaterial;
        const count = g.attributes.position.count;
        const tint = new T.Color();
        const architectural = [mat.wood,mat.darkWood,mat.plaster,mat.stone,mat.roof,mat.terra,mat.lilac].includes(material);
        if (architectural) {
          material.vertexColors = true;
          const variation = .92 + .12 * (.5+.5*Math.sin(o.matrixWorld.elements[12]*7.13+o.matrixWorld.elements[13]*17.7+o.matrixWorld.elements[14]*4.3));
          tint.setRGB(variation,variation*.99,variation*.97);
          const colors = new Float32Array(count*3);
          for(let i=0;i<count;i++) colors.set([tint.r,tint.g,tint.b],i*3);
          g.setAttribute("color",new T.BufferAttribute(colors,3));
        } else if (g.attributes.color) g.deleteAttribute("color");
      }
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
      mesh.castShadow = m !== mat.ground && m !== mat.path && m !== pathMaterial;
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
    color: "#ffffff",
    side: T.DoubleSide,
    roughness: 1,
  });
  const grassGeo = new T.BufferGeometry();
  const bladeVertices: number[] = [], bladeIndices: number[] = [], bladeColors: number[] = [];
  for (let blade=0; blade<3; blade++) {
    const angle=blade*2.399, height=.3+(blade%3)*.085, lean=.1+(blade%2)*.08;
    const base=bladeVertices.length/3;
    for (let row=0; row<=3; row++) {
      const t=row/3, width=.029*(1-t)+.001;
      for (const side of [-1,1]) {
        bladeVertices.push(Math.cos(angle)*lean*t*t+Math.sin(angle)*width*side,
          height*t, Math.sin(angle)*lean*t*t+Math.cos(angle)*width*side);
        bladeColors.push(.43+t*.57,.52+t*.48,.3+t*.7);
      }
      if (row<3) {const a=base+row*2;bladeIndices.push(a,a+2,a+1,a+1,a+2,a+3);}
    }
  }
  grassGeo.setAttribute("position",new T.Float32BufferAttribute(bladeVertices,3));
  grassGeo.setAttribute("color",new T.Float32BufferAttribute(bladeColors,3));
  grassGeo.setIndex(bladeIndices);grassGeo.computeVertexNormals();grassMat.vertexColors=true;
  const grassCount = 23000;
  const grass = new T.InstancedMesh(grassGeo, grassMat, grassCount);
  let gi = 0;
  for (let attempt = 0; gi < grassCount && attempt < 450000; attempt++) {
    let x = (rnd() - 0.5) * 75,
      z = (rnd() - 0.5) * 90;
    const river = Math.abs(x - riverX(z));
    if (
      river < 4 ||
      Math.abs(x - roadX(z)) < 2.15 ||
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
    dummy.scale.setScalar(0.55 + rnd() * .9);
    dummy.updateMatrix();
    grass.setMatrixAt(gi, dummy.matrix);
    grass.setColorAt(
      gi,
      new T.Color().setHSL(
        0.22 + rnd() * 0.055,
        0.48 + rnd() * 0.16,
        0.48 + rnd() * 0.15,
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
        0, 0.015, -0.11, -0.04, 0, -0.02, 0, 0.025, 0, 0.04, 0, -0.02, 0, 0.005,
        0.11,
      ],
      3,
    ),
  );
  leafGeo.setIndex([0, 1, 2, 0, 2, 3, 1, 4, 2, 2, 4, 3]);
  leafGeo.computeVertexNormals();
  const foliageParts: T.BufferGeometry[] = [];
  for (let i = 0; i < 180; i++) {
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
      color: "#c4d990",
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
      new T.Color().setHSL(0.23 + rnd() * 0.04, 0.48, 0.45 + rnd() * 0.16),
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
      s = 0.35 + rnd() * 0.6;
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
      new T.Color(["#fff3d2", "#ffc766", "#a798ec"][i % 3]),
    );
  }
  stems.count = blossoms.count = flowerCount;
  vegetation.push(stems, blossoms);
  stems.receiveShadow = true;
  blossoms.receiveShadow = true;
  group.add(stems, blossoms);
  // A complete valley surrounds the playable space, including side and rear views.
  for (let band = 0; band < 3; band++) {
    const ring = new T.PlaneGeometry(1, 1, 440, 36);
    const positions = ring.attributes.position, uv = ring.attributes.uv;
    for (let i = 0; i < positions.count; i++) {
      const angle = uv.getX(i) * Math.PI * 2;
      const across = uv.getY(i);
      const radius = 170 + band * 68 + across * 94;
      const x = Math.sin(angle) * radius, z = Math.cos(angle) * radius;
      const silhouette = 29 + band * 10 + Math.sin(angle * 5 + band) * 10
        + Math.abs(Math.sin(angle * 9 - band * 2)) ** 5 * 21 + Math.sin(angle * 23) * 5
        + Math.sin(angle * 51 + band) * 2.4 + Math.sin(angle * 97) * 1.1;
      const envelope = Math.sin(across * Math.PI) ** .85;
      const ridges = Math.sin(x * .11 + z * .045) * 2.6 + Math.cos(z * .16 - x * .09) * 1.8;
      positions.setXYZ(i, x, Math.max(-3, envelope * (silhouette + ridges)) - 3, z);
      uv.setXY(i, x / 16, z / 16);
    }
    ring.computeVertexNormals();
    const mountainColors: number[] = [];
    const rock = new T.Color(["#9dbca9", "#8aaec0", "#a0b8d1"][band]);
    const meadow = new T.Color(["#83b977", "#89b6a4", "#a0bad2"][band]);
    const normal = ring.attributes.normal;
    for (let i=0;i<positions.count;i++) {
      const slope = Math.abs(normal.getY(i));
      const patch = Math.sin(positions.getX(i)*.034+Math.sin(positions.getZ(i)*.047))*.04;
      const tint = rock.clone().lerp(meadow,T.MathUtils.smoothstep(slope,.5,.86)).multiplyScalar(.95+patch);
      mountainColors.push(tint.r,tint.g,tint.b);
    }
    ring.setAttribute("color",new T.Float32BufferAttribute(mountainColors,3));
    const material = new T.MeshStandardMaterial({ vertexColors:true, roughness:1, side:T.DoubleSide });
    add(ring, material, 0, 0, 0).castShadow = false;
  }
  const forestPlacements: { matrix: T.Matrix4; color: T.Color }[] = [];
  for (let i = 0; i < 360; i++) {
    const angle = i * 2.39996, radius = 54 + Math.sqrt(rnd()) * 125;
    const x = Math.sin(angle) * radius, z = Math.cos(angle) * radius;
    const scale = .65 + rnd() * .8;
    dummy.position.set(x, landscapeHeight(x, z), z); dummy.rotation.set(0, rnd() * 6.28, 0);
    dummy.scale.set(scale, scale * (1 + rnd() * .35), scale); dummy.updateMatrix();
    forestPlacements.push({ matrix: dummy.matrix.clone(), color: new T.Color().setHSL(.24 + rnd() * .05, .15, .86 + rnd() * .1) });
  }
  // A small distant landmark, distinct from the village clock tower.
  const castleMaterial = new T.MeshStandardMaterial({ color: "#e0e1c5", roughness: 1 });
  for (const [x, y, h] of [[-18, 11, 9], [-22, 10, 5], [-14, 9, 6]]) {
    add(new T.CylinderGeometry(.8, 1.15, h, 6), castleMaterial, x, y + h / 2, -158).castShadow = false;
    add(new T.ConeGeometry(1.05, h * .5, 6), mat.roof, x, y + h * 1.25, -158).castShadow = false;
  }
  // Distant suspended gardens are scenery, beyond the walkable village boundary.
  const islandRock = new T.MeshStandardMaterial({ color:"#a6b7c0", roughness:1 });
  const islandGrass = new T.MeshStandardMaterial({ color:"#91c89b", roughness:1 });
  for(const [x,y,z,scale] of [[-64,44,-178,1],[88,57,-245,.7]]) {
    const island=new T.Group();island.position.set(x,y,z);island.scale.setScalar(scale);group.add(island);
    const crag = new T.CylinderGeometry(7.5,1,12,11,4);
    const vertices = crag.attributes.position;
    for(let i=0;i<vertices.count;i++) {
      const angle=Math.atan2(vertices.getZ(i),vertices.getX(i)),y=vertices.getY(i);
      const irregular=1+Math.sin(angle*5+.8)*.12+Math.cos(angle*3-y*.27)*.1;
      vertices.setXYZ(i,vertices.getX(i)*irregular,y+Math.sin(angle*3)*.6,vertices.getZ(i)*irregular);
    }
    crag.computeVertexNormals();
    add(crag,islandRock,0,-6,0,1,1,.8,island).castShadow=false;
    add(new T.SphereGeometry(1,20,10),islandGrass,0,.1,0,7.7,.9,6.2,island).castShadow=false;
    add(new T.CylinderGeometry(1.2,1.5,4.8,10),castleMaterial,0,2.7,0,1,1,1,island).castShadow=false;
    add(new T.ConeGeometry(1.9,3.5,16),mat.lilac,0,6.7,0,1,1,1,island).castShadow=false;
    add(new T.OctahedronGeometry(.7),mat.trim,0,9.5,0,1,1.7,1,island).castShadow=false;
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
    if (branch % 2 === 0) {
      const canopy = new T.SphereGeometry(1,12,8);
      canopy.scale(1.15,.65,1.15); canopy.translate(tip.x*.7,tip.y+.13,tip.z*.7); canopy.deleteAttribute("uv");
      willowLeafParts.push(canopy);
    }
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
  const willowLeafMaterial = new T.MeshStandardMaterial({ color: "#a7c76b", roughness: .9, side: T.DoubleSide });
  const willowWood = mat.wood.clone(); willowWood.vertexColors = false;
  for (const [geometry, material] of [[willowBark, willowWood], [willowLeaves, willowLeafMaterial]] as const) {
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
  const nearGeometry = fantasyTreeGeometry(true), forestGeometry = fantasyTreeGeometry(false);
  const forestMaterial = new T.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, roughness: .95 });
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
  const treeLod = new T.InstancedMesh(forestGeometry, forestMaterial, treePositions.length);
  treeLod.frustumCulled = false;
  treeLod.instanceMatrix.setUsage(T.DynamicDrawUsage);
  treeLod.count = 0;
  group.add(treeLod);
  const treeBounds = treePositions.map(
    ([x, z, s]) => new T.Sphere(new T.Vector3(x, landscapeHeight(x, z) + 4 * s, z), 8 * s),
  );
  const trees: World["trees"] = [];
  const nearMaterial = forestMaterial.clone();
  const inst = new T.InstancedMesh(nearGeometry, nearMaterial, treePositions.length);
  treeTransforms.forEach((matrix, i) => inst.setMatrixAt(i, matrix));
  inst.frustumCulled = false; inst.instanceMatrix.setUsage(T.DynamicDrawUsage);
  trees.push({ mesh: inst, transforms: treeTransforms, bounds: treeBounds });
  inst.customDepthMaterial = windMaterial(nearMaterial, .11, true);
  treeLod.customDepthMaterial = windMaterial(forestMaterial, .11, true);
  // Crown colors carry their soft occlusion; self-shadowing intersecting lobes produces striping.
  inst.castShadow = true; inst.receiveShadow = false; group.add(inst);
  onProgress(80);
  return {
    group,
    trees,
    treeLod,
    setWeather(rain: number, dusk: number) {
      wetness.value = rain;
      mat.glass.emissiveIntensity = .12 + dusk * 1.3 + rain * .22;
      waterMat.roughness = .3 + rain * .28;
      waterMat.color.setRGB(.045 + rain*.02, .34 - dusk*.17, .29 - dusk*.1);
    },
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
    },
  };
}

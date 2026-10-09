import { buildTower } from "./towerScene";
import { LOOKOUT_HEIGHT } from "./towerLookout";
import { sampleTerrainHeight } from "./terrain";
import { spatialMesh, spatialBatch } from "./spatialRendering";
import { optimizeGeometry } from "./geometryOptimization";
import { SceneLayout } from "./sceneLayout";
import * as T from "three";
import { townPlantingClearance } from "./worldLayout";
import { inRiver } from "./environment";
import { makeFlame } from "./flame";
import { makeWater } from "./water";
import { conformRiverBank, joinRiverToPonds, makeRiverChannelHeight, refineRiverTerrain, riverGeometry } from "./riverGeometry";
import { buildRiverbankStones } from "./riverbankStones";
import { buildBridge } from "./bridge";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { paintedTextures } from "./paintedTextures";
import { buildCottage } from "./architecture";
import { loadVillageLayout } from "./villageAssets";
import { buildWorldLandscape } from "./worldLandscape";
import { clearPavingBorders, blendPavingJunctions } from "./plantingClearance";
import { buildWayfinding } from "./wayfinding";
import { BIRD_CLEARING, BRIDGE, HEARTH, POND, POND_DOCK, dockHeight, pondDistance, landscapeHeight, riverX, roadX, type Collider } from "./environment";
import { GARDEN_COURT, HARVEST_BASKET } from "./garden";
import { distanceToPath, insidePlantingClearance, type AuthoredWorld } from "./worldLayout";
import { fenceGeometry, fenceCollisionBoxes, fenceWoodMaterial, conformFenceGeometry } from "./fenceGeometry";
import { setAuthoredWorld } from "./environment";
import { VillageSwingSet } from "./swings";
import { BIRD_FEEDING, fillBirdCrumbs } from "./birds";
export { groundY, riverX } from "./environment";

/** Optional authoring hook; the public village keeps its existing merged render path. */
export type WorldLayoutCapture = (id: string, name: string, category: string, objects: T.Object3D[], pivot?: [number, number, number]) => void;
export type VillageBench = { id: string; x: number; z: number; facing: number; seatHeight: number; seatSpacing?: number; seatCount?: number; birdClearing: boolean; hitBox: T.Box3 };

function disposeWorldResources(roots: T.Object3D[], extra: Iterable<T.BufferGeometry | T.Material | T.Texture>) {
  const resources = new Set<T.BufferGeometry | T.Material | T.Texture>(extra);
  for (const root of roots) root.traverse(object => {
    if (!(object instanceof T.Mesh || object instanceof T.Points || object instanceof T.Sprite)) return;
    if (object instanceof T.BatchedMesh) object.dispose();
    else if (!(object instanceof T.Sprite)) resources.add(object.geometry);
    if (object instanceof T.InstancedMesh && object.userData.riverbankStones) object.dispose();
    if (object instanceof T.Mesh && object.customDepthMaterial) resources.add(object.customDepthMaterial);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) resources.add(material);
  });
  for (const resource of resources) if (resource instanceof T.Material)
    for (const value of Object.values(resource)) if (value instanceof T.Texture) resources.add(value);
  resources.forEach(resource => resource.dispose());
}

export type World = {
  group: T.Group;
  trees: {
    mesh: T.InstancedMesh;
    transforms: T.Matrix4[];
    bounds: T.Sphere[];
  }[];
  treeLod: T.InstancedMesh;
  setWeather: (rain: number, dusk: number, night?: number) => void;
  updateLampLights: (x: number, z: number) => void;
  setLanguage: (language: "en" | "ja") => void;
  colliders: Collider[];
  benches: VillageBench[];
  swings: VillageSwingSet[];
  flames: T.Mesh[];
  lanterns: T.Mesh[];
  water: T.Mesh;
  wind: { time: { value: number }; strength: { value: number } };
  vegetation: T.InstancedMesh[];
  authored: AuthoredWorld;
  mapScenery: {
    layout: AuthoredWorld;
    paths: Pick<AuthoredWorld["paths"][number], "spine" | "width">[];
    buildings: { id: string; x: number; z: number; yaw: number; width: number; depth: number }[];
    trees: AuthoredWorld["trees"];
    benches: VillageBench[];
  };
  gardenSurfaces: { paving: T.MeshStandardMaterial; wood: T.MeshStandardMaterial; ground: T.MeshStandardMaterial; stone: T.MeshStandardMaterial };
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
  capture?: WorldLayoutCapture,
  layout?: AuthoredWorld,
  signal?: AbortSignal,
): Promise<World> {
  if (signal?.aborted) throw signal.reason;
  seed = 62025;
  const authored = layout ?? await loadVillageLayout(signal);
  setAuthoredWorld(authored);
  const group = new T.Group();
  const colliders: World["colliders"] = [],
    benches: VillageBench[] = [],
    flames: T.Mesh[] = [],
    lanterns: T.Mesh[] = [];
  const sceneLayout = new SceneLayout(authored, group, colliders, benches);
  const record: WorldLayoutCapture = capture ?? sceneLayout.capture;
  const wind = { time: { value: 0 }, strength: { value: 0.3 } };
  const swings: VillageSwingSet[] = [];
  const vegetation: T.InstancedMesh[] = [];
  const lampLights: T.PointLight[] = [];
  const lanternHalos: T.Sprite[] = [];
  const gardenPathClearance = new Set<number>();
  const plantingCell = (x: number, z: number) => (Math.floor(x * 2) + 256) * 1024 + Math.floor(z * 2) + 256;
  const teaCourtyardDistance = (x: number, z: number) => Math.hypot((x - 15.5) / 3.8, (z + 10.4) / 3.2);
  const plantingLanes = [...authored.paths, ...(authored.rivers ?? [])];
  const onAuthoredPath = (x: number, z: number) => plantingLanes.some(path => distanceToPath(x, z, path) < path.width * .5 + .5);
  // The editor captures uncut source instances so moving or undoing a clearing can restore them.
  const erasedPlanting = (x: number, z: number) => !capture && insidePlantingClearance(x, z, authored.clearings);
  const townPlantingItems = (authored.items ?? []).filter(item => ["horse-racetrack", "farm-row", "horse-stable", "hay-bale"].includes(item.asset));
  const clearPlanting = (x: number, z: number) =>
    inRiver(x, z) ||
    townPlantingClearance(x, z, townPlantingItems) ||
    authored.swings.some(swing => {
      const dx = x - swing.x, dz = z - swing.z, c = Math.cos(swing.yaw), s = Math.sin(swing.yaw);
      return Math.abs(dx * c - dz * s) < 3.1 * swing.scale[0] && Math.abs(dx * s + dz * c) < 3.3 * swing.scale[0];
    }) ||
    (Math.abs(x - BRIDGE.x) < BRIDGE.length / 2 + 2 && Math.abs(z - BRIDGE.z) < BRIDGE.width / 2 + 1.1)
    || Math.hypot(x - HEARTH.x, z - HEARTH.z) < 3.9
    || pondDistance(x, z) < 1.035
    || Math.hypot(x + 24, z + 31) < 4.35
    || Math.hypot(x - HARVEST_BASKET[0], z - HARVEST_BASKET[2]) < 1.25
    || teaCourtyardDistance(x, z) < 1.16
    || gardenPathClearance.has(plantingCell(x, z))
    || (x > 12.5 && x < 18.5 && z > -13.5 && z < -7.5)
    || (x > GARDEN_COURT.left - .7 && x < GARDEN_COURT.right + .7 && z > GARDEN_COURT.back - .7 && z < GARDEN_COURT.front + .7);
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
  const editableTerrain = Boolean(capture || authored.terrain?.samples.length);
  let terrain: T.BufferGeometry = editableTerrain ? new T.PlaneGeometry(640, 640, 320, 320) : new T.PlaneGeometry(650, 650, 210, 210);
  terrain.rotateX(-Math.PI / 2);
  const channelHeight = makeRiverChannelHeight(authored, landscapeHeight);
  const terrainPlacement = !capture && authored.items?.find(item => item.visible && item.asset === "terrain");
  const terrainTransform = new T.Matrix4();
  if (terrainPlacement) terrainTransform.compose(new T.Vector3(...terrainPlacement.position),
    new T.Quaternion().setFromEuler(new T.Euler(...terrainPlacement.rotation.map(T.MathUtils.degToRad) as [number, number, number])), new T.Vector3(...terrainPlacement.scale));
  if (!capture) { const source = terrain; terrain = refineRiverTerrain(source, authored, terrainTransform); source.dispose(); }
  const pos = terrain.attributes.position;
  const terrainInverse = terrainTransform.clone().invert(), terrainPoint = new T.Vector3();
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      z = pos.getZ(i);
    const height = sampleTerrainHeight(authored.terrain, x, z);
    const pondBaseDistance = capture ? Math.hypot((x - POND.x) / POND.rx, (z - POND.z) / POND.rz) : pondDistance(x, z);
    terrainPoint.set(x, pondBaseDistance < 1.35 ? Math.min(-.85, height) : height, z);
    if (!capture) {
      terrainPoint.applyMatrix4(terrainTransform);
      terrainPoint.y = channelHeight(terrainPoint.x, terrainPoint.z, terrainPoint.y);
      terrainPoint.applyMatrix4(terrainInverse);
    }
    pos.setXYZ(i, terrainPoint.x, terrainPoint.y, terrainPoint.z);
    const patch = .5 + .5 * Math.sin(x * .12) * Math.sin(z * .09);
    const c = new T.Color().setHSL(.235 + patch * .035, .54, .56 + patch * .13);
    colors.push(c.r, c.g, c.b);
  }
  terrain.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  terrain.computeVertexNormals();
  try {
    if (!capture) await optimizeGeometry(terrain, .00001, signal);
  } catch (error) {
    disposeWorldResources([group], [terrain, ...Object.values(mat), ...textures]);
    throw error;
  }
  const terrainMesh = add(terrain, mat.ground, 0, 0, 0);
  terrainMesh.castShadow = false;
  record("terrain", "Valley ground", "Landscape", [terrainMesh]);
  // The valley grid is coarse; a local shoreline gives the larger pond a continuous bank.
  const shoreGeometry = new T.RingGeometry(.78, 1.65, 128, 18);
  shoreGeometry.rotateX(-Math.PI / 2);
  const shorePositions = shoreGeometry.attributes.position, shoreColors: number[] = [];
  for (let i = 0; i < shorePositions.count; i++) {
    const x = POND.x + shorePositions.getX(i) * POND.rx, z = POND.z + shorePositions.getZ(i) * POND.rz;
    const d = Math.hypot((x - POND.x) / POND.rx, (z - POND.z) / POND.rz), river = Math.abs(x - riverX(z));
    const bank = -.72 + Math.max(0, Math.min(1, (d - .93) / .11)) * .72;
    const y = d < 1.04 ? Math.min(bank, river < 4 ? -.85 + river * .15 : 0) : landscapeHeight(x, z);
    shorePositions.setXYZ(i, x, y + .007, z);
    shoreGeometry.attributes.uv.setXY(i, x / 650 + .5, .5 - z / 650);
    const patch = .5 + .5 * Math.sin(x * .12) * Math.sin(z * .09);
    const c = new T.Color().setHSL(.235 + patch * .035, .54, .56 + patch * .13);
    shoreColors.push(c.r, c.g, c.b);
  }
  shoreGeometry.setAttribute("color", new T.Float32BufferAttribute(shoreColors, 3));
  shoreGeometry.userData.riverBank = true;
  shoreGeometry.computeVertexNormals();
  const shoreMesh = add(shoreGeometry, mat.ground, 0, 0, 0); shoreMesh.castShadow = false;
  record("shore", "Willow pond bank", "Landscape", [shoreMesh], [POND.x, 0, POND.z]);
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
  function path(points: T.Vector3[], width: number, name?: string, straight = false) {
    const c: T.Curve<T.Vector3> = straight ? new T.CurvePath<T.Vector3>() : new T.CatmullRomCurve3(points);
    if (c instanceof T.CurvePath) for (let i = 1; i < points.length; i++) c.add(new T.LineCurve3(points[i - 1], points[i]));
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
    g.userData.plantingSurface = "paving";
    const ribbon = add(g, pathMaterial, 0, 0, 0); ribbon.castShadow = false;
    record(`path-${pathSurfaces.length + 1}`, name ?? `Village path ${pathSurfaces.length + 1}`, "Paths", [ribbon], c.getPoint(.5).toArray() as [number, number, number]);
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
    new T.Vector3(-2, 0, 3), new T.Vector3(0, 0, 2)], 2.8);
  path(
    [
      new T.Vector3(-21, 0, 5),
      new T.Vector3(-18.2, 0, -1),
      new T.Vector3(-18.4, 0, -5.5),
    ],
    2,
  );

  path([new T.Vector3(-18.4, 0, -5.5), new T.Vector3(-16.55, 0, -5.5),
    new T.Vector3(-16.55, 0, -8.7), new T.Vector3(-17.15, 0, -13),
    new T.Vector3(-17.8, 0, -20), new T.Vector3(-19, 0, -26), new T.Vector3(-21.2, 0, -29)], 1.05, "Bird clearing approach");
  // Enter below the cottage, then branch through the tea clearing into the garden aisles.
  path([new T.Vector3(-.6, 0, -9), new T.Vector3(4, 0, -9),
    new T.Vector3(8.6, 0, -9.3), new T.Vector3(11.8, 0, -11.3), new T.Vector3(14.8, 0, -12)], 2.1);
  path([new T.Vector3(17, 0, -10), new T.Vector3(18.5, 0, -9.2),
    new T.Vector3(19.6, 0, -7.75), new T.Vector3(20.2, 0, -7.75)], 1.5);
  path([new T.Vector3(16.4, 0, -7.7), new T.Vector3(19, 0, -5.2),
    new T.Vector3(19.2, 0, -2), new T.Vector3(19.6, 0, .25), new T.Vector3(20.2, 0, .25)], 1.8);
  path(
    [
      new T.Vector3(0, 0, 13),
      new T.Vector3(5, 0, 11),
      new T.Vector3(10, 0, 11),
    ],
    2.5,
  );
  for (const authoredPath of authored.paths) {
    const points = authoredPath.points.map(([x, z]) => new T.Vector3(x, 0, z));
    path(points, authoredPath.width, `Authored path ${authoredPath.id}`, authoredPath.straight);
  }

  // A rounded terrace shares the paths' paving scale and moss shoulder.
  const terracePositions: number[] = [], terraceUV: number[] = [], terraceColors: number[] = [], terraceIndices: number[] = [];
  const terraceRings = [0, .84, 1, 1.1], terraceSegments = 64;
  for (let ring = 0; ring < terraceRings.length; ring++) {
    for (let segment = 0; segment <= terraceSegments; segment++) {
      const a = segment / terraceSegments * Math.PI * 2, radius = terraceRings[ring];
      const x = 15.5 + Math.cos(a) * 3.8 * radius, z = -10.4 + Math.sin(a) * 3.2 * radius;
      terracePositions.push(x, Math.max(landscapeHeight(x, z), 0) + .072, z);
      terraceUV.push(x / 2, z / 2); terraceColors.push(ring < 2 ? 1 : ring === 2 ? .62 : 0, 1, 1);
      if (ring < terraceRings.length - 1 && segment < terraceSegments) {
        const i = ring * (terraceSegments + 1) + segment, next = i + terraceSegments + 1;
        terraceIndices.push(i, i + 1, next, i + 1, next + 1, next);
      }
    }
  }
  const terrace = new T.BufferGeometry();
  terrace.setAttribute("position", new T.Float32BufferAttribute(terracePositions, 3));
  terrace.setAttribute("uv", new T.Float32BufferAttribute(terraceUV, 2));
  terrace.setAttribute("color", new T.Float32BufferAttribute(terraceColors, 3));
  terrace.setIndex(terraceIndices); terrace.computeVertexNormals();
  terrace.userData.plantingSurface = "paving";
  const teaTerrace = add(terrace, pathMaterial, 0, 0, 0); teaTerrace.castShadow = false;
  record("tea-terrace", "Tea courtyard paving", "Paths", [teaTerrace], [15.5, 0, -10.4]);
  // One continuous level surface gives the rectangular beds even, seam-free aisles.
  const court = GARDEN_COURT, shoulder = .45;
  const courtCoverage = (x: number, z: number) => 1 - T.MathUtils.smoothstep(
    Math.max(court.left - x, x - court.right, court.back - z, z - court.front), 0, shoulder);
  const courtGeometry = new T.PlaneGeometry(court.right - court.left + shoulder * 2, court.front - court.back + shoulder * 2, 48, 60);
  courtGeometry.rotateX(-Math.PI / 2); courtGeometry.translate((court.left + court.right) / 2, .095, (court.back + court.front) / 2);
  const courtPosition = courtGeometry.getAttribute("position"), courtUV = courtGeometry.getAttribute("uv");
  const courtColors = new Float32Array(courtPosition.count * 3);
  for (let i = 0; i < courtPosition.count; i++) {
    const x = courtPosition.getX(i), z = courtPosition.getZ(i);
    courtUV.setXY(i, x / 2, z / 2);
    let coverage = courtCoverage(x, z);
    for (const surface of pathSurfaces) for (const p of surface.spine)
      coverage = Math.max(coverage, 1 - T.MathUtils.smoothstep(Math.hypot(x - p.x, z - p.z), surface.width * .36, surface.width * .64));
    courtColors.set([coverage, 1, 1], i * 3);
  }
  courtGeometry.setAttribute("color", new T.BufferAttribute(courtColors, 3));
  courtGeometry.userData.plantingSurface = "paving";
  const gardenCourt = add(courtGeometry, pathMaterial, 0, 0, 0);
  gardenCourt.name = "Continuous kitchen garden paving"; gardenCourt.castShadow = false;
  record("garden-paving", "Kitchen garden paving", "Paths", [gardenCourt], [24.7, 0, -6]);
  // Reserve the full ribbons and shoulders before scattering meadow plants.
  for (const surface of pathSurfaces) for (const p of surface.spine) {
    if (p.x < 2 || p.z > 2) continue;
    const radius = surface.width * .68 + .38;
    for (let x = Math.floor((p.x - radius) * 2); x <= Math.ceil((p.x + radius) * 2); x++)
      for (let z = Math.floor((p.z - radius) * 2); z <= Math.ceil((p.z + radius) * 2); z++)
        if (Math.hypot(x / 2 - p.x, z / 2 - p.z) <= radius + .36) gardenPathClearance.add(plantingCell(x / 2, z / 2));
  }
  // At junctions, keep every overlapping ribbon paved; moss must never cut across a road.
  // Shared world-space UVs also prevent texture seams where their surfaces overlap.
  for (const surface of pathSurfaces) {
    const positions = surface.geometry.attributes.position, colors = surface.geometry.attributes.color;
    for (let vertex=0; vertex<positions.count; vertex++) {
      if (colors.getX(vertex) === 1) continue;
      const x=positions.getX(vertex), z=positions.getZ(vertex);
      let paving=Math.max(colors.getX(vertex), 1 - T.MathUtils.smoothstep(teaCourtyardDistance(x, z), .84, 1.1), courtCoverage(x, z));
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
  // Keep terrace seams paved where an approach crosses its soft edge.
  const terraceColor = terrace.getAttribute("color"), terracePosition = terrace.getAttribute("position");
  for (let i = 0; i < terracePosition.count; i++) {
    const x = terracePosition.getX(i), z = terracePosition.getZ(i);
    for (const surface of pathSurfaces) for (const p of surface.spine) {
      const coverage = 1 - T.MathUtils.smoothstep(Math.hypot(x - p.x, z - p.z), surface.width * .36, surface.width * .64);
      if (coverage > terraceColor.getX(i)) terraceColor.setX(i, coverage);
    }
  }
  const pondRestPaving = add(terrace, pathMaterial, -39.5, .02867727470825035, -19.1);
  pondRestPaving.castShadow = false;
  record("pond-rest-paving", "Pond rest paving", "Paths", [pondRestPaving], [-24, .02867727470825035, -29.5]);
  // Water occupies a shallow channel, with shader normals moving independently of the banks.
  const waterUniform = { time: { value: 0 } };
  const riverSurface=makeWater(waterUniform.time,wind.strength);
  const pondSurface=makeWater(waterUniform.time,wind.strength,true);
  const waterMat=riverSurface.material;
  const wg = new T.PlaneGeometry(1, 1, 12, 220);
  wg.rotateX(-Math.PI / 2);
  const wp = wg.attributes.position;
  for (let i = 0; i < wp.count; i++) {
    const z = wp.getZ(i) * 220;
    wp.setXYZ(i, riverX(z) + wp.getX(i) * 6.4, -0.32, z);
    wg.attributes.uv.setY(i, z + 110);
  }
  wg.computeVertexNormals();
  wg.setAttribute("waterJoin", new T.Float32BufferAttribute(new Float32Array(wp.count), 1));
  wg.setAttribute("waterPondUV", new T.Float32BufferAttribute(new Float32Array(wp.count * 2), 2));
  wg.userData.plantingSurface = "water";
  wg.userData.riverSurface = true;
  const water = add(wg, waterMat, 0, 0, 0);
  water.castShadow = false;
  water.userData.time = waterUniform.time;
  const pondGeo = new T.CircleGeometry(1, 96);
  pondGeo.rotateX(-Math.PI / 2);
  pondGeo.userData.plantingSurface = "water";
  pondGeo.setAttribute("waterJoin", new T.Float32BufferAttribute(new Float32Array(pondGeo.attributes.position.count), 1));
  pondGeo.setAttribute("waterPondUV", new T.Float32BufferAttribute(new Float32Array(pondGeo.attributes.position.count * 2), 2));
  const pond = add(pondGeo, pondSurface.material, POND.x, POND.y, POND.z, POND.rx, 1, POND.rz);
  pond.name = "Willow pond water";
  pond.castShadow = false;
  record("river", "Flowing river", "Landscape", [water]);
  record("pond", "Willow pond", "Landscape", [pond], [POND.x, 0, POND.z]);
  if (!capture) for (const river of authored.rivers ?? []) {
    const item = authored.items!.find(item => item.id === river.id)!;
    const offset = item.position[1] - landscapeHeight(item.position[0], item.position[2]);
    const geometry = joinRiverToPonds(riverGeometry(river.points, river.width, (x, z) => landscapeHeight(x, z) + offset), new T.Matrix4(), authored);
    const stream = add(geometry, waterMat, 0, 0, 0);
    stream.name = `Authored river ${river.id}`; stream.castShadow = false;
  }
  let layoutStart = group.children.length;
  // Preserve the original random sequence used by later captured assets and saved layouts.
  for (let i = 0; i < 240; i++) {
    const z = -65 + rnd() * 125, side = rnd() > .5 ? 1 : -1, x = riverX(z) + side * (3.4 + rnd() * .6);
    if (Math.abs(z - BRIDGE.z) < BRIDGE.width / 2 + 1 && Math.abs(x - BRIDGE.x) < BRIDGE.length / 2 + 1) continue;
    for (let draw = 0; draw < 7; draw++) rnd();
  }
  // Retain the legacy layout asset ID; bank dressing now follows each visible river.
  record("river-stones", "Automatic riverbank stones", "Landscape", [new T.Group()]);
  const bridge = buildBridge(mat.stone, mat.path, colliders); group.add(bridge);
  record("bridge", "Stone arch bridge", "Bridges", [bridge], [BRIDGE.x, 0, BRIDGE.z]);
  const haloCanvas = document.createElement("canvas");
  haloCanvas.width = haloCanvas.height = 64;
  const haloContext = haloCanvas.getContext("2d")!;
  const haloGradient = haloContext.createRadialGradient(32, 32, 2, 32, 32, 32);
  haloGradient.addColorStop(0, "rgba(255,238,185,.85)");
  haloGradient.addColorStop(.25, "rgba(255,204,116,.32)");
  haloGradient.addColorStop(1, "rgba(255,183,92,0)");
  haloContext.fillStyle = haloGradient;
  haloContext.fillRect(0, 0, 64, 64);
  const haloTexture = new T.CanvasTexture(haloCanvas);
  textures.push(haloTexture);
  const haloMaterial = new T.SpriteMaterial({ map: haloTexture, color: "#ffd49b", transparent: true, depthWrite: false, opacity: 0, blending: T.AdditiveBlending });
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
    const halo = new T.Sprite(haloMaterial);
    halo.position.set(x, y + .27, z);
    halo.scale.set(1.7, 1.7, 1);
    halo.visible = false;
    halo.userData.villageHalo = true;
    parent.add(halo);
    lanternHalos.push(halo);
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
  const mapBuildings: World["mapScenery"]["buildings"] = [];
  function house(x: number, z: number, w: number, d: number, h: number, rot: number, roofMat = mat.roof) {
    const index = houseIndex++;
    const saved = authored.sceneVersion === 1 ? undefined : authored.structures[`cottage-${index + 1}`];
    if (saved) { x = saved.x; z = saved.z; rot = saved.yaw; }
    if (!capture && authored.sceneVersion === 1) rot = 0;
    mapBuildings.push({ id: `cottage-${index + 1}`, x, z, yaw: rot, width: w, depth: d });
    const cottage = buildCottage({ ...mat, roof: index % 3 === 2 ? mat.lilac : roofMat }, w, d, h, index);
    cottage.name = `Fantasy cottage ${index + 1}`;
    cottage.position.set(x, saved?.y ?? 0, z); cottage.rotation.y = rot; group.add(cottage);
    colliders.push({ x, z, w: Math.abs(Math.cos(rot)) * w + Math.abs(Math.sin(rot)) * d,
      d: Math.abs(Math.cos(rot)) * d + Math.abs(Math.sin(rot)) * w });
    lantern(.95, 1.6, d / 2 + .36, cottage);
    if (index === 0) {
      const lamp = new T.PointLight("#ffd19b", 0, 8, 2);
      lamp.position.set(.95, 2, d / 2 + .7); lamp.visible = false; lamp.userData.villageLamp = true; cottage.add(lamp); lampLights.push(lamp);
    }
    record(`cottage-${index + 1}`, ["Bluebell cottage", "Rosewood cottage", "Lilac cottage", "Waterside cottage", "", "", "Hilltop cottage", "Orchard cottage", "Meadow cottage"][index], "Buildings", [cottage], [x, 0, z]);
  }
  house(10, 11, 6, 5.4, 4.2, -Math.PI / 2);
  house(10, -4, 5.8, 5.3, 3.8, -Math.PI / 2, mat.terra);
  house(9, -27, 6.4, 6, 4.3, 0.3);
  house(-23, 8, 5.4, 5.5, 3.5, Math.PI / 2, mat.terra);
  // Both pond cottages are removed; retain the other houses' authored variants.
  houseIndex += 2;
  house(1, -38, 6.5, 6, 4.6, 0, mat.terra);
  house(21, -24, 6.5, 6, 4.4, 0.25);
  house(-31, 25, 5.5, 5.2, 4.3, -0.3);
  const tower = buildTower(mat);
  const savedTower = authored.structures.tower;
  tower.position.set(savedTower?.x ?? 4, savedTower?.y ?? 0, savedTower?.z ?? -57);
  tower.rotation.y = savedTower?.yaw ?? 0;
  mapBuildings.push({ id: "tower", x: tower.position.x, z: tower.position.z, yaw: tower.rotation.y, width: 7.7, depth: 7.7 });
  group.add(tower);
  colliders.push({ x: tower.position.x, z: tower.position.z, w: 5.2, d: 5.2, top: tower.position.y + LOOKOUT_HEIGHT });
  record("tower", "Watchtower · circular lookout", "Buildings", [tower], tower.position.toArray() as [number, number, number]);
  let benchIndex = 0;
  function bench(x: number, z: number, rot: number, scaleX = 1, authoredId?: string, y = 0, scaleY = 1, scaleZ = 1) {
    const b = new T.Group();
    b.position.set(x, y, z);
    b.rotation.y = rot; b.scale.set(scaleX, scaleY, scaleZ);
    group.add(b);
    const collider = { x, z, w: Math.abs(Math.cos(rot)) * 2.2 * scaleX + Math.abs(Math.sin(rot)) * .7 * scaleZ,
      d: Math.abs(Math.sin(rot)) * 2.2 * scaleX + Math.abs(Math.cos(rot)) * .7 * scaleZ, bottom: y - .1, top: y + 1.4 * scaleY };
    colliders.push(collider);
    for (const s of [-1, 1]) {
      box(mat.darkWood, s * 0.88, 0.36, 0, 0.13, 0.72, 0.65, b);
      box(mat.wood, s * 0.88, 0.9, -0.3, 0.1, 1.1, 0.1, b);
    }
    for (let i = 0; i < 3; i++)
      box(mat.wood, 0, 0.65, -0.22 + i * 0.22, 2.2, 0.1, 0.18, b);
    for (let i = 0; i < 2; i++)
      box(mat.wood, 0, 1.05 + i * 0.23, -0.32, 2.2, 0.18, 0.1, b);
    const id = authoredId ?? `bench-${++benchIndex}`;
    benches.push({ id, x, z, facing: rot, seatHeight: y + .7 * scaleY, birdClearing: false,
      hitBox: new T.Box3(new T.Vector3(-1.1 * scaleX, y, -.4 * scaleZ), new T.Vector3(1.1 * scaleX, y + 1.35 * scaleY, .4 * scaleZ)) });
    record(id, authoredId ? "Meadow bench" : `Oak bench ${benchIndex}`, "Furnishings", [b], [x, y, z]);
    return collider;
  }
  // The saved copy places the feeding clearing at the western end of the bridge path.
  layoutStart = group.children.length;
  const clearing = new T.CircleGeometry(BIRD_CLEARING.radius, 64); clearing.rotateX(-Math.PI / 2);
  clearing.userData.plantingSurface = "paving";
  const cp = clearing.attributes.position, cuv = clearing.attributes.uv;
  for (let i = 0; i < cp.count; i++) cuv.setXY(i, (cp.getX(i) + BIRD_CLEARING.x) / 3, (cp.getZ(i) + BIRD_CLEARING.z) / 3);
  add(clearing, mat.path, BIRD_CLEARING.x, .1, BIRD_CLEARING.z).castShadow = false;
  record("bird-clearing-terrace", "Bird clearing terrace", "Furnishings", group.children.slice(layoutStart), [BIRD_CLEARING.x, 0, BIRD_CLEARING.z]);
  layoutStart = group.children.length;
  const rim = new T.TorusGeometry(BIRD_FEEDING.bowlRadius, .065, 8, 48); rim.rotateX(-Math.PI / 2);
  add(rim, mat.stone, BIRD_CLEARING.x, .2, BIRD_CLEARING.z);
  const bowl = new T.LatheGeometry([
    [.04, .015], [.82, .015], [.99, .045], [BIRD_FEEDING.bowlRadius, .09],
    [1.01, .095], [.95, .06], [.8, .035], [.04, .035],
  ].map(([r, y]) => new T.Vector2(r, y)), 48);
  add(bowl, mat.wood, BIRD_CLEARING.x, .1, BIRD_CLEARING.z).castShadow = false;
  if (capture) {
    const serving = new T.InstancedMesh(new T.IcosahedronGeometry(.047, 0), new T.MeshStandardMaterial({ color: "#edc693", roughness: 1 }), BIRD_FEEDING.servingCrumbs);
    fillBirdCrumbs(serving, new T.Object3D()); serving.receiveShadow = true;
    group.add(serving);
  }
  record("bird-feeding-dish", "Sourdough feeding dish", "Furnishings", group.children.slice(layoutStart), [BIRD_CLEARING.x, 0, BIRD_CLEARING.z]);
  layoutStart = group.children.length;
  // A low bench faces the birds, leaving the eastern entrance completely open.
  const birdBenchX = BIRD_CLEARING.x, birdBenchZ = BIRD_CLEARING.benchZ;
  box(mat.wood, birdBenchX, .4, birdBenchZ, 2.5, .14, .65);
  box(mat.wood, birdBenchX, .87, birdBenchZ + .32, 2.5, .48, .1);
  for (const x of [-.9, .9]) for (const z of [-.23, .23]) box(mat.darkWood, birdBenchX + x, .2, birdBenchZ + z, .11, .4, .11);
  const birdBenchCollider = {x: authored.sceneVersion === 1 ? birdBenchX : -24,z: authored.sceneVersion === 1 ? birdBenchZ + .05 : -27.75,w:2.6,d:.85,top:1.12};
  colliders.push(birdBenchCollider);
  benches.push({ id: "bird-clearing-bench", x: birdBenchX, z: birdBenchZ, facing: Math.PI, seatHeight: .47, birdClearing: true,
    hitBox: new T.Box3(new T.Vector3(-1.25, 0, -.4), new T.Vector3(1.25, 1.12, .4)) });
  record("bird-clearing-bench", "Birdwatching bench", "Furnishings", group.children.slice(layoutStart), [birdBenchX, 0, birdBenchZ]);
  const pouchCloth = new T.MeshStandardMaterial({ color: "#c9a679", roughness: 1, bumpMap: plasterMap, bumpScale: .018 });
  const pouchCord = new T.MeshStandardMaterial({ color: "#805a3c", roughness: 1 });
  const bread = new T.MeshStandardMaterial({ color: "#e8c694", roughness: 1 });
  function makeCrumbPouch() {
    const pouch = new T.Group(); pouch.name = "Sourdough crumb pouch";
    const fabric = new T.LatheGeometry([
      [.025, .015], [.14, .025], [.21, .09], [.22, .2], [.18, .29], [.1, .34], [.095, .4], [.11, .42],
    ].map(([r, y]) => new T.Vector2(r, y)), 24);
    const vertices = fabric.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i), z = vertices.getZ(i), y = vertices.getY(i);
      const fold = 1 + Math.sin(Math.atan2(x, z) * 10 + y * 9) * (y > .3 ? .12 : .035);
      vertices.setXYZ(i, x * fold, y, z * fold * .8);
    }
    fabric.computeVertexNormals();
    const body = new T.Mesh(fabric, pouchCloth); body.castShadow = body.receiveShadow = true; pouch.add(body);
    const cord = new T.Mesh(new T.TorusGeometry(.102, .009, 4, 24), pouchCord);
    cord.rotation.x = Math.PI / 2; cord.scale.y = .8; cord.position.y = .355; pouch.add(cord);
    for (const side of [-1, 1]) {
      const loop = new T.CatmullRomCurve3([
        [0, .355, .09], [side * .075, .395, .11], [side * .09, .355, .11], [0, .355, .09], [side * .025, .255, .14],
      ].map(([x, y, z]) => new T.Vector3(x, y, z)));
      pouch.add(new T.Mesh(new T.TubeGeometry(loop, 20, .008, 4, false), pouchCord));
    }
    const filling = new T.Mesh(new T.CylinderGeometry(.087, .087, .018, 16), bread);
    filling.position.y = .395; filling.scale.z = .8; pouch.add(filling);
    for (let i = 0; i < 9; i++) {
      const crumb = new T.Mesh(new T.IcosahedronGeometry(.018, 0), bread);
      const angle = i * 2.4, r = .02 + i % 3 * .023;
      crumb.position.set(Math.cos(angle) * r, .415 + i % 2 * .008, Math.sin(angle) * r * .8);
      crumb.rotation.set(i, i * .4, 0); pouch.add(crumb);
    }
    return pouch;
  }
  if (capture) {
    const pouch = makeCrumbPouch(); pouch.position.set(birdBenchX + 1.55, .1, birdBenchZ - .75); group.add(pouch);
    capture("bird-crumb-pouch", "Sourdough crumb pouch", "Furnishings", [pouch], [pouch.position.x, pouch.position.y, pouch.position.z]);
  } else for (const placed of authored.crumbPouches) {
    const pouch = makeCrumbPouch(); pouch.position.set(placed.x, placed.y, placed.z);
    pouch.rotation.set(...placed.rotation); pouch.scale.fromArray(placed.scale); group.add(pouch);
  }
  layoutStart = group.children.length;
  const leaf = new T.MeshStandardMaterial({color:'#6d9959',roughness:1});
  const petal = new T.MeshStandardMaterial({color:'#fff9e9',roughness:.85});
  const flowerGold = new T.MeshStandardMaterial({color:'#e4b958',roughness:.8});
  for (let i = 0; i < 28; i++) {
    const angle = 1.25 + i / 27 * 3.8, x = -24 + Math.cos(angle) * 4.25, z = -31 + Math.sin(angle) * 4.25;
    const flower = new T.Group(); flower.position.set(x, 0, z);
    flower.userData.pavingBorder = true; flower.userData.pavingBorderRadius = .15;
    group.add(flower);
    add(cylGeo, leaf, 0, .22, 0, .015, .4, .015, flower);
    for (let p=0;p<5;p++) { const a=p*Math.PI*2/5; add(sphereGeo,petal,Math.cos(a)*.072,.44,Math.sin(a)*.072,.066,.028,.066, flower); }
    add(sphereGeo,flowerGold,0,.465,0,.04,.025,.04, flower);
  }
  const clearingFlowers = group.children.slice(layoutStart);
  for (const flower of clearingFlowers) flower.position.add(new T.Vector3(-13, -.12, 34.993025));
  record("bird-clearing-flowers", "Dove clearing flower border", "Nature", clearingFlowers, [-37, -.12, 3.993025]);
  // Seats face the fire; the main village path stays unobstructed.
  bench(HEARTH.x, HEARTH.z + 2.9, Math.PI);
  bench(HEARTH.x, HEARTH.z - 2.9, 0);
  bench(HEARTH.x - 2.7, HEARTH.z, Math.PI / 2);
  bench(13.9, -10, Math.PI / 2);
  bench(-17.8, -7.6, Math.PI / 2);
  const pondRestBench = bench(-24, -30, 0, 1.644445);
  // Apply the new colliders after seeded planting so unrelated scenery stays in place.
  colliders.pop();
  for (const placed of authored.benches) bench(placed.x, placed.z, placed.yaw, placed.scale[0], placed.id, placed.y, placed.scale[1], placed.scale[2]);
  for (const item of authored.items ?? []) if (item.visible && item.asset === "picnic-mat") {
    const yaw = item.rotation[1] * Math.PI / 180, offset = 1.35 * item.scale[2];
    benches.push({ id: item.id, x: item.position[0] + Math.sin(yaw) * offset, z: item.position[2] + Math.cos(yaw) * offset,
      facing: yaw, seatHeight: item.position[1] + .24 * item.scale[1], seatSpacing: .9 * item.scale[0], seatCount: 5, birdClearing: false,
      hitBox: new T.Box3(new T.Vector3(-2.8 * item.scale[0], item.position[1], -.6 * item.scale[2]), new T.Vector3(2.8 * item.scale[0], item.position[1] + .3 * item.scale[1], .6 * item.scale[2])) });
  }
  for (const placed of authored.swings) {
    const swing = new VillageSwingSet(placed); swings.push(swing); group.add(swing.root);
    colliders.push(...swing.colliders());
    record(placed.id, "Meadow swing set", "Furnishings", [swing.root], [placed.x, placed.y, placed.z]);
  }
  layoutStart = group.children.length;
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
  // Clear the uneven meadow and path shoulders instead of letting grass cut through the terrace.
  const hearthPaving = new T.CylinderGeometry(HEARTH.pavingRadius, HEARTH.pavingRadius, .16, 64);
  const hearthPosition = hearthPaving.attributes.position, hearthNormal = hearthPaving.attributes.normal;
  const hearthUV = hearthPaving.attributes.uv;
  for (let i = 0; i < hearthPosition.count; i++) {
    if (hearthNormal.getY(i) > .5)
      hearthUV.setXY(i, (hearthPosition.getX(i) + HEARTH.x) / 2, (hearthPosition.getZ(i) + HEARTH.z) / 2);
  }
  add(hearthPaving, mat.path, HEARTH.x, HEARTH.pavingHeight - .08, HEARTH.z).castShadow = false;
  const charredWood=mat.darkWood.clone();charredWood.color.set("#624030");charredWood.roughness=1;
  for (let i = 0; i < 7; i++) {
    let a = i * 0.8;
    const log = add(
      cylGeo,
      charredWood,
      HEARTH.x + Math.sin(a) * 0.3,
      0.32,
      HEARTH.z + Math.cos(a) * 0.3,
      0.14,
      1.65,
      0.14,
    );
    log.rotation.set(1.25, a, 0.3);
  }
  const fire=makeFlame(1.25,1.7);
  fire.position.set(HEARTH.x,1.0,HEARTH.z);group.add(fire);flames.push(fire);
  colliders.push({ x: HEARTH.x, z: HEARTH.z, w: 2.3, d: 2.3, top: .7 });
  lantern(HEARTH.x - 2.5, .25, HEARTH.z - 2.2);
  const hearthLight = new T.PointLight("#ffad54", 9, 12, 2);
  hearthLight.position.set(HEARTH.x, 1, HEARTH.z); group.add(hearthLight);
  fire.userData.light=hearthLight;fire.userData.coal=coal;
  record("hearth", "Hearth clearing", "Furnishings", group.children.slice(layoutStart), [HEARTH.x, 0, HEARTH.z]);
  layoutStart = group.children.length;
  // Pond dock.
  for (let i = 0; i < 28; i++) {
    const x = POND_DOCK.x + POND_DOCK.w / 2 - .1 - i * .196;
    box(mat.wood, x, dockHeight(x) - .09, POND_DOCK.z, .18, .18, POND_DOCK.d);
  }
  for (const x of [-19.1, -24.1])
    for (const z of [-6.4, -4.6])
      add(cylGeo, mat.darkWood, x, 0.05, z, 0.13, 1.2, 0.13);
  lantern(-24.1, 0.3, -4.6);
  record("dock", "Willow fishing dock", "Bridges", group.children.slice(layoutStart), [POND_DOCK.x, 0, POND_DOCK.z]);
  layoutStart = group.children.length;
  // Tea garden pergola.
  for (const x of [13, 18])
    for (const z of [-8, -13]) box(mat.wood, x, 1.75, z, 0.18, 3.5, 0.18);
  for (let i = 0; i < 8; i++)
    box(mat.wood, 12.8 + i * 0.78, 3.45, -10.5, 0.14, 0.16, 5.6);
  box(mat.wood, 15.5, 3.3, -8, 5.7, 0.2, 0.2);
  box(mat.wood, 15.5, 3.3, -13, 5.7, 0.2, 0.2);
  lantern(13, 2.35, -13);
  lantern(18, 2.35, -13);
  // Low planted pots frame the back corners without narrowing the entrances.
  for (const [x, z] of [[12.3, -13.4], [18.8, -13.4]]) {
    add(new T.CylinderGeometry(.35, .25, .45, 12), mat.terra, x, .22, z);
    add(new T.TorusGeometry(.35, .04, 6, 16), mat.terra, x, .45, z).rotation.x = Math.PI / 2;
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4;
      add(sphereGeo, mat.green, x + Math.cos(a) * .19, .53 + i % 2 * .1, z + Math.sin(a) * .19, .22, .24, .22);
      add(sphereGeo, i % 2 ? mat.rose : mat.paper, x + Math.cos(a) * .22, .76 + i % 2 * .1, z + Math.sin(a) * .22, .1, .065, .1);
    }
  }
  add(cylGeo, mat.wood, 15.2, 0.6, -10, 0.12, 1.2, 0.12);
  add(cylGeo, mat.wood, 15.2, 1.2, -10, 0.8, 0.12, 0.8);
  record("pergola", "Tea garden pergola", "Furnishings", group.children.slice(layoutStart), [15.5, 0, -10.5]);
  layoutStart = group.children.length;
  // Postbox and hand-lettered sign geometry use readable DOM labels on approach.
  box(mat.wood, 3, 0.7, -1, 0.16, 1.4, 0.16);
  box(mat.wood, 3, 1.6, -1, 0.6, 0.7, 0.45);
  box(mat.metal, 3, 1.7, -0.765, 0.38, 0.06, 0.02);
  add(new T.ConeGeometry(0.49, 0.3, 4), mat.terra, 3, 2.1, -1).rotation.y =
    Math.PI / 4;
  record("postbox", "Little postbox", "Furnishings", group.children.slice(layoutStart), [3, 0, -1]);
  // Fences and lamps guide movement without a HUD full of markers.
  const fenceMaterial = fenceWoodMaterial(mat.wood);
  const addFence = (geometry: T.BufferGeometry, transform = new T.Matrix4()) => {
    const mesh = new T.Mesh(geometry, fenceMaterial); mesh.applyMatrix4(transform); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
    for (const bounds of fenceCollisionBoxes(geometry, transform)) {
      const center = bounds.getCenter(new T.Vector3()), size = bounds.getSize(new T.Vector3());
      colliders.push({ x: center.x, z: center.z, w: size.x, d: size.z, bottom: bounds.min.y, top: bounds.max.y });
    }
    return mesh;
  };
  for (const side of [-1, 1])
    for (let z = 18; z < 39; z += 2.4) {
      const x = roadX(z) + side * 3.2;
      const mesh = addFence(fenceGeometry([[x, z], [roadX(z + 2.4) + side * 3.2, z + 2.4]], 1.4, landscapeHeight));
      record(`fence-${side}-${Math.round(z * 10)}`, "Oak fence", "Furnishings", [mesh], [x, 0, z + 1.2]);
    }
  for (const fence of authored.fences) {
    const item = authored.items?.find(item => item.id === fence.id && item.asset === "fence-line");
    let mesh: T.Mesh;
    if (item?.path) {
      const matrix = new T.Matrix4().compose(new T.Vector3(...item.position), new T.Quaternion().setFromEuler(new T.Euler(...item.rotation.map(T.MathUtils.degToRad) as [number, number, number])), new T.Vector3(...item.scale));
      const source = fenceGeometry(item.path.points, item.path.width);
      const lift = Math.max(0, item.position[1] - landscapeHeight(item.position[0], item.position[2]));
      const geometry = conformFenceGeometry(source, matrix, (x, z) => landscapeHeight(x, z) + lift); source.dispose();
      mesh = addFence(geometry, matrix);
    } else mesh = addFence(fenceGeometry(fence.points, fence.height, landscapeHeight));
    record(fence.id, "Oak fence line", "Furnishings", [mesh], [fence.points[0][0], 0, fence.points[0][1]]);
  }
  for (const z of [20, 0, -27]) {
    layoutStart = group.children.length;
    box(mat.darkWood, -3.1, 1.7, z, 0.13, 3.4, 0.13);
    box(mat.darkWood, -2.8, 3.35, z, 0.75, 0.1, 0.1);
    lantern(-2.5, 2.55, z);
    const light = new T.PointLight("#ffd09a", 0, 10, 2);
    light.position.set(-2.5, 2.95, z); light.visible = false; light.userData.villageLamp = true; group.add(light); lampLights.push(light);
    record(`lamp-${z}`, "Hanging lantern", "Furnishings", group.children.slice(layoutStart), [-3.1, 0, z]);
  }
  for (const [id, x, z, angle] of [
    ["lamp-moon-bridge", -4.5, 8.5, 0],
    ["lamp-moon-garden", 19, -6, -Math.PI / 2],
    ["lamp-moon-birds", -31, 9, Math.PI / 2],
    ["lamp-moon-pond", -20, -29, Math.PI],
  ] as [string, number, number, number][]) {
    const post = new T.Group();
    post.position.set(x, 0, z); post.rotation.y = angle;
    box(mat.darkWood, 0, 1.7, 0, .17, 3.4, .17, post);
    box(mat.metal, 0, 3.35, 0, .28, .11, .28, post);
    box(mat.darkWood, .32, 3.27, 0, .75, .12, .12, post);
    lantern(.62, 2.52, 0, post);
    const light = new T.PointLight("#ffc981", 0, 10, 2);
    light.position.set(.62, 2.9, 0); light.visible = false; light.userData.villageLamp = true; post.add(light); lampLights.push(light);
    group.add(post);
    colliders.push({ x, z, w: .4, d: .4, top: 3.5 });
    record(id, "Moonlit path lamppost", "Furnishings", [post], [x, 0, z]);
  }
  // Low shielded lanterns light the planted edge and trace the pond bank without standing in the aisles or water.
  for (const [id, x, z, y] of [
    ["edge-lantern-garden-1", 20, -2.3, .1],
    ["edge-lantern-garden-2", 31.2, -10.5, .1],
    ["edge-lantern-garden-3", 31.2, -2.3, .1],
    ["edge-lantern-pond-1", -30, -2, landscapeHeight(-30, -2)],
    ["edge-lantern-pond-2", -36.4, -14, landscapeHeight(-36.4, -14)],
    ["edge-lantern-pond-3", -31, -25.5, landscapeHeight(-31, -25.5)],
  ] as [string, number, number, number][]) {
    const fixture = new T.Group();
    fixture.position.set(x, y, z);
    const plinth = new T.Mesh(new T.CylinderGeometry(.27, .32, .2, 8), mat.stone);
    plinth.position.y = .1; plinth.castShadow = true; fixture.add(plinth);
    lantern(0, .22, 0, fixture);
    const light = new T.PointLight("#ffd293", 0, 6, 2);
    light.position.y = .72; light.visible = false;
    light.userData.villageLamp = true;
    light.userData.nightIntensity = 3.4;
    fixture.add(light); lampLights.push(light);
    group.add(fixture);
    colliders.push({ x, z, w: .64, d: .64, top: y + 1 });
    record(id, "Low stone lantern", "Furnishings", [fixture], [x, y, z]);
  }
  onProgress(45);
  if (!capture) sceneLayout.apply();
  const riverbankColliders: Collider[] = [];
  // Static architectural geometry is merged per material into a handful of draw calls.
  if (!capture) {
  group.updateMatrixWorld(true);
  const groundBatch = spatialMesh(terrainMesh.geometry, mat.ground, 96);
  groundBatch.name = "Valley ground";
  groundBatch.position.copy(terrainMesh.position); groundBatch.quaternion.copy(terrainMesh.quaternion); groundBatch.scale.copy(terrainMesh.scale);
  terrainMesh.parent!.add(groundBatch); terrainMesh.removeFromParent(); terrain.dispose();
  group.traverse(object => {
    if (object instanceof T.Mesh && object.geometry.userData.riverBank) {
      object.geometry = object.geometry.clone();
      conformRiverBank(object.geometry, object.matrixWorld, authored);
    }
  });
  clearPavingBorders(group);
  blendPavingJunctions(group);
  const riverStones = buildRiverbankStones(group, mat.stone, landscapeHeight, riverbankColliders); group.add(riverStones);
  const batches = new Map<T.Material, Map<string, T.BufferGeometry[]>>();
  const keep = new Set<T.Object3D>([...flames, water, pond, terrainMesh, shoreMesh]);
  groundBatch.traverse(object => keep.add(object));
  riverStones.traverse(object => keep.add(object));
  swings.forEach(swing => swing.dynamicMeshes.forEach(mesh => keep.add(mesh)));
  const remove: T.Object3D[] = [];
  group.traverseVisible((o) => {
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
        } else if (g.attributes.color && material !== fenceMaterial) g.deleteAttribute("color");
      }
      const m = o.material as T.Material;
      if (!batches.has(m)) batches.set(m, new Map());
      const surface = g.userData.plantingSurface ?? "", surfaces = batches.get(m)!;
      if (!surfaces.has(surface)) surfaces.set(surface, []);
      surfaces.get(surface)!.push(g);
      remove.push(o);
    }
  });
  remove.forEach((o) => o.removeFromParent());
  const pendingBatches = new Set([...batches.values()].flatMap(surfaces => [...surfaces.values()].flat()));
  for (const [m, surfaces] of batches) for (const [surface, gs] of surfaces) {
    const g = mergeGeometries(gs);
    gs.forEach(g => { g.dispose(); pendingBatches.delete(g); });
    if (g) {
      try { await optimizeGeometry(g, .0001, signal); }
      catch (error) {
        disposeWorldResources([group, ...remove], [g, ...pendingBatches, ...Object.values(mat), ...textures]);
        throw error;
      }
      if (surface) g.userData.plantingSurface = surface;
      const mesh = spatialBatch(g, m, 32); mesh.name = `Village architecture ${surface || m.name || m.type}`;
      mesh.receiveShadow = true; mesh.castShadow = m !== mat.ground && m !== mat.path && m !== pathMaterial; group.add(mesh); g.dispose();
    }
  }
  }
  const { trees, treeLod, treeRecords } = buildWorldLandscape({
    group, colliders, vegetation, wind, authored, mat, dummy, rnd, add,
    clearPlanting, erasedPlanting, onAuthoredPath, capture, record, applyLayout: () => sceneLayout.apply(), onProgress,
  });
  if (authored.sceneVersion !== 1) { birdBenchCollider.x = birdBenchX; birdBenchCollider.z = birdBenchZ + .05; }
  if (authored.sceneVersion !== 1) colliders.push(pondRestBench);
  const wayfinding = buildWayfinding(colliders);
  group.add(wayfinding.group);
  record("wayfinding", "Village fingerposts", "Furnishings", [wayfinding.group]);
  if (!capture) sceneLayout.apply();
  colliders.push(...riverbankColliders);
  onProgress(80);
  group.updateMatrixWorld(true);
  if (authored.sceneVersion === 1) {
    mapBuildings.splice(0, mapBuildings.length, ...mapBuildings.flatMap(building => (authored.items ?? [])
      .filter(item => item.visible && item.asset === building.id).map(item => ({ ...building, id: item.id,
        x: item.position[0], z: item.position[2], yaw: item.rotation[1] * Math.PI / 180,
        width: building.width * item.scale[0], depth: building.depth * item.scale[2] }))));
  }
  const lampPositions = lampLights.map(light => light.getWorldPosition(new T.Vector3()));
  let lampDusk = 0, lampNight = 0;
  const updateLampLights = (x: number, z: number) => {
    if (capture) return;
    let first = -1, second = -1, firstDistance = Infinity, secondDistance = Infinity;
    lampPositions.forEach((position, index) => {
      const distance = (position.x - x) ** 2 + (position.z - z) ** 2;
      if (distance < firstDistance) {
        second = first; secondDistance = firstDistance;
        first = index; firstDistance = distance;
      } else if (distance < secondDistance) {
        second = index; secondDistance = distance;
      }
    });
    lampLights.forEach((light, index) => {
      light.intensity = lampDusk * .8 + lampNight * (light.userData.nightIntensity ?? 5.2);
      light.visible = (index === first || index === second) && light.intensity > .01;
    });
  };
  return {
    group,
    trees,
    treeLod,
    setLanguage: wayfinding.setLanguage,
    updateLampLights,
    setWeather(rain: number, dusk: number, night = 0) {
      wetness.value = rain;
      mat.glass.emissiveIntensity = .12 + dusk * 1.3 + night * 3.2 + rain * .22;
      haloMaterial.opacity = Math.max(dusk * .35, night * .85);
      lanternHalos.forEach(halo => { halo.visible = haloMaterial.opacity > .01; });
      lampDusk = dusk; lampNight = night;
      if (capture) lampLights.forEach(light => { light.intensity = dusk * .8 + night * (light.userData.nightIntensity ?? 5.2); light.visible = light.intensity > .01; });
      riverSurface.setWeather(rain, Math.min(1, dusk + night));pondSurface.setWeather(rain, Math.min(1, dusk + night));
    },
    colliders,
    benches,
    swings,
    flames,
    lanterns,
    water,
    wind,
    vegetation,
    authored,
    mapScenery: { layout: authored, buildings: mapBuildings, trees: treeRecords, benches,
      paths: pathSurfaces.map(path => ({ width: path.width, spine: path.spine.map(point => [point.x, point.z]) })) },
    gardenSurfaces: { paving: mat.path, wood: mat.wood, ground: mat.ground, stone: mat.stone },
    dispose() {
      disposeWorldResources([group], [...Object.values(mat), ...textures]);
    },
  };
}

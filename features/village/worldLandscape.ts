import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { fantasyTreeGeometry } from "./fantasyTrees";
import { BIRD_CLEARING, pondDistance, groundY, landscapeHeight, riverX, roadX } from "./environment";
import type { World, WorldLayoutCapture } from "./world";
import { meadowFlowers } from "./meadowVegetation";
import { clearSurfacePlanting } from "./plantingClearance";
import { instanceCells } from "./spatialRendering";
import { registerGrassDetail } from "./vegetationDetail";

export function buildWorldLandscape({ group, colliders, vegetation, wind, authored, mat, dummy, rnd, add, clearPlanting, erasedPlanting, onAuthoredPath, capture, record, applyLayout, onProgress }: {
  group: T.Group;
  colliders: World["colliders"];
  vegetation: T.InstancedMesh[];
  wind: World["wind"];
  authored: World["authored"];
  mat: Record<"wood" | "roof" | "lilac" | "trim", T.MeshStandardMaterial>;
  dummy: T.Object3D;
  rnd: () => number;
  add: (geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z: number, sx?: number, sy?: number, sz?: number, parent?: T.Object3D) => T.Mesh;
  clearPlanting: (x: number, z: number) => boolean;
  erasedPlanting: (x: number, z: number) => boolean;
  onAuthoredPath: (x: number, z: number) => boolean;
  capture?: WorldLayoutCapture;
  record: WorldLayoutCapture;
  applyLayout: () => void;
  onProgress: (value: number) => void;
}) {
  let layoutStart: number;
  const meadowFlowerMeshes: T.InstancedMesh[] = [];
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
  if (!capture) registerGrassDetail(grassGeo);
  grassGeo.userData.groundPlant = true; grassGeo.userData.plantingSway = .16;
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
      pondDistance(x, z) < 1.1 ||
      colliders.some(
        (c) =>
          Math.abs(x - c.x) < c.w / 2 + 1 && Math.abs(z - c.z) < c.d / 2 + 1,
      ) ||
      onAuthoredPath(x, z) ||
      clearPlanting(x, z)
    )
      continue;
    dummy.position.set(x, landscapeHeight(x, z), z);
    dummy.rotation.set(0, rnd() * 6.28, 0);
    dummy.scale.setScalar(0.55 + rnd() * .9);
    if (erasedPlanting(x, z)) dummy.scale.setScalar(0);
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
  record("meadow-grass", "Meadow grass", "Landscape", [grass]);
  const authoredGrassCount = authored.grass.reduce((sum, zone) => sum + zone.count, 0);
  if (authoredGrassCount) {
    const addedGrass = new T.InstancedMesh(grassGeo, grassMat, authoredGrassCount);
    let filled = 0;
    for (const zone of authored.grass) {
      let localSeed = [...zone.id].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
      const random = () => { localSeed = (Math.imul(localSeed, 1664525) + 1013904223) >>> 0; return localSeed / 4294967296; };
      for (let i = 0; i < zone.count; i++) {
        const angle = random() * Math.PI * 2, radius = Math.sqrt(random());
        const falloff = Math.min(1, (1 - radius) * 4);
        if (random() > falloff) continue;
        const localX = Math.cos(angle) * radius * zone.radiusX, localZ = Math.sin(angle) * radius * zone.radiusZ;
        const x = zone.x + localX * Math.cos(zone.yaw) + localZ * Math.sin(zone.yaw);
        const z = zone.z - localX * Math.sin(zone.yaw) + localZ * Math.cos(zone.yaw);
        if (onAuthoredPath(x, z) || clearPlanting(x, z) || colliders.some(c => Math.abs(x - c.x) < c.w / 2 + .45 && Math.abs(z - c.z) < c.d / 2 + .45)) continue;
        dummy.position.set(x, landscapeHeight(x, z), z);
        dummy.rotation.set(0, random() * Math.PI * 2, 0);
        dummy.scale.setScalar((.55 + random() * .9) * (.55 + .45 * falloff)); dummy.scale.y *= zone.heightScale; dummy.updateMatrix();
        if (erasedPlanting(x, z)) { dummy.scale.setScalar(0); dummy.updateMatrix(); }
        addedGrass.setMatrixAt(filled, dummy.matrix);
        addedGrass.setColorAt(filled++, new T.Color().setHSL(.22 + random() * .055, .48 + random() * .16, .48 + random() * .15));
      }
    }
    addedGrass.count = filled; addedGrass.customDepthMaterial = grass.customDepthMaterial;
    addedGrass.receiveShadow = true; vegetation.push(addedGrass); group.add(addedGrass);
    record("authored-grass", "Painted meadow grass", "Landscape", [addedGrass]);
  }
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
  bushGeo.userData.groundPlant = true; bushGeo.userData.plantingSway = .23;
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
  record("bushes", "Leafy shrub", "Nature", [bushes]);
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
    if (erasedPlanting(x, z)) dummy.scale.setScalar(0);
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
  for (const mesh of [stems, blossoms]) { mesh.geometry.userData.groundPlant = true; mesh.geometry.userData.plantingRadius = .36; }
  vegetation.push(stems, blossoms);
  stems.receiveShadow = true;
  blossoms.receiveShadow = true;
  group.add(stems, blossoms);
  record("wildflowers", "Lane wildflowers", "Landscape", [stems, blossoms]);
  const flowerZones = (authored.items ?? []).filter(item => item.visible && item.asset === "flower-meadow");
  if (flowerZones.length) {
    const flowers = meadowFlowers(flowerZones, landscapeHeight, (x, z) => onAuthoredPath(x, z) || clearPlanting(x, z) || erasedPlanting(x, z)
      || colliders.some(c => Math.abs(x - c.x) < c.w / 2 + .45 && Math.abs(z - c.z) < c.d / 2 + .45));
    group.add(flowers); flowers.traverse(part => { if (part instanceof T.InstancedMesh) { vegetation.push(part); meadowFlowerMeshes.push(part); } });
  }
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
    const mountain = add(ring, material, 0, 0, 0); mountain.castShadow = false;
    record(`mountain-${band}`, ["Near mountain ridge", "Blue mountain ridge", "Distant mountain ridge"][band], "Landscape", [mountain]);
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
  layoutStart = group.children.length;
  const castleMaterial = new T.MeshStandardMaterial({ color: "#e0e1c5", roughness: 1 });
  for (const [x, y, h] of [[-18, 11, 9], [-22, 10, 5], [-14, 9, 6]]) {
    add(new T.CylinderGeometry(.8, 1.15, h, 6), castleMaterial, x, y + h / 2, -158).castShadow = false;
    add(new T.ConeGeometry(1.05, h * .5, 6), mat.roof, x, y + h * 1.25, -158).castShadow = false;
  }
  record("castle", "Distant castle", "Buildings", group.children.slice(layoutStart), [-18, 10, -158]);
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
    record(`island-${x}`, "Floating garden", "Landscape", [island], [x,y,z]);
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
  layoutStart = group.children.length;
  for (const [geometry, material] of [[willowBark, willowWood], [willowLeaves, willowLeafMaterial]] as const) {
    const mesh = new T.InstancedMesh(geometry, material, 2);
    [[-14, -7, 1.3], [-36.5, -17, 1.45]].forEach(([x, z, scale], i) => {
      dummy.position.set(x, groundY(x, z), z); dummy.rotation.set(0, i * 2, 0); dummy.scale.setScalar(scale); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    });
    if (material === willowLeafMaterial) mesh.customDepthMaterial = windMaterial(material, .48, true);
    mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
  }
  record("willow", "Weeping willow", "Nature", group.children.slice(layoutStart));
  // Ivy climbs the two visible cottage faces with gaps around the entrance.
  const ivy = new T.InstancedMesh(bushGeo, bushes.material, 18);
  for (let i = 0; i < 18; i++) {
    const y = .5 + (i % 6) * .6;
    dummy.position.set(i < 12 ? 7.2 : 8 + (i % 6) * .7, y, i < 6 ? 13 : i < 12 ? 8.7 : 13.75);
    dummy.rotation.set(0, i, 0); dummy.scale.set(.42, .42, .26); dummy.updateMatrix(); ivy.setMatrixAt(i, dummy.matrix);
  }
  ivy.customDepthMaterial = windMaterial(bushes.material as T.MeshStandardMaterial, .17);
  ivy.receiveShadow = true; group.add(ivy);
  record("ivy", "Cottage ivy", "Nature", [ivy]);
  onProgress(60);
  const nearGeometry = fantasyTreeGeometry(true), forestGeometry = fantasyTreeGeometry(false);
  const forestMaterial = new T.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, roughness: .95 });
  const forest = new T.InstancedMesh(forestGeometry, forestMaterial, forestPlacements.length);
  forestPlacements.forEach((p, i) => { forest.setMatrixAt(i, p.matrix); forest.setColorAt(i, p.color); });
  group.add(forest); vegetation.push(forest);
  record("forest", "Distant forest", "Landscape", [forest]);

  const treePositions: [number, number, number][] = [
    [-5, 22, 0.78],
    [7, 28, 0.8],
    [-7, 15, 1.15],
    [16, 19, 1.2],
    [-36.5, -28.5, 1.3],
    [-37, -8, 1.1],
    [20, -16, 1.3],
    [-31, 15, 1],
    [-25, 29, 1.1],
    [35, 12, 1],
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
  const treeRecords = !capture && authored.items ? authored.trees : treePositions.map(([x, z, scale], i) => ({
    id: `tree-${i + 1}`, x, y: i === 4 ? -.005309 : landscapeHeight(x, z), z, rotation: [0, rnd() * Math.PI * 2, 0] as [number, number, number], scale: [scale, scale, scale] as [number, number, number],
  }));
  const treeTransforms = treeRecords.map(tree => {
    dummy.position.set(tree.x, tree.y, tree.z);
    dummy.rotation.set(...tree.rotation);
    dummy.scale.set(...tree.scale);
    dummy.updateMatrix();
    return dummy.matrix.clone();
  });
  const treeLod = new T.InstancedMesh(forestGeometry, forestMaterial, treeRecords.length);
  treeLod.frustumCulled = false;
  treeLod.instanceMatrix.setUsage(T.DynamicDrawUsage);
  treeLod.count = 0;
  group.add(treeLod);
  const treeBounds = treeRecords.map(
    tree => new T.Sphere(new T.Vector3(tree.x, tree.y + 4 * tree.scale[1], tree.z), 8 * Math.max(...tree.scale)),
  );
  const trees: World["trees"] = [];
  const nearMaterial = forestMaterial.clone();
  const inst = new T.InstancedMesh(nearGeometry, nearMaterial, treeRecords.length);
  treeTransforms.forEach((matrix, i) => inst.setMatrixAt(i, matrix));
  inst.frustumCulled = false; inst.instanceMatrix.setUsage(T.DynamicDrawUsage);
  trees.push({ mesh: inst, transforms: treeTransforms, bounds: treeBounds });
  inst.customDepthMaterial = windMaterial(nearMaterial, .11, true);
  treeLod.customDepthMaterial = windMaterial(forestMaterial, .11, true);
  // Crown colors carry their soft occlusion; self-shadowing intersecting lobes produces striping.
  inst.castShadow = true; inst.receiveShadow = false; group.add(inst);
  for (const tree of treeRecords) if (!/^tree-\d+$/.test(tree.id)) colliders.push({ x: tree.x, z: tree.z, w: .7 * tree.scale[0], d: .7 * tree.scale[2], bottom: tree.y, top: tree.y + 5 * tree.scale[1] });
  record("tree", "Round canopy tree", "Nature", [inst]);
  const restShrubs: [number, number, number][] = [
    [-30.5, 0.0021889620241282728, -26.5],
    [-28, 0.04870400533322876, -32],
    [-26.5, 0.06147569016718084, -33.5],
    [-24.5, 0.061601576312927966, -34],
    [-22.5, 0.05088307723410275, -34],
    [-20.5, 0.030448035371557824, -33],
    [-29, 0.038220625820518224, -31],
    [-29, 0.023209967905932886, -29],
  ];
  const shrubColor = new T.Color(); bushes.getColorAt(0, shrubColor);
  restShrubs.forEach((position, i) => {
    const shrub = new T.InstancedMesh(bushGeo, bushes.material, 1);
    shrub.setMatrixAt(0, new T.Matrix4()); shrub.setColorAt(0, shrubColor);
    shrub.position.fromArray(position); shrub.customDepthMaterial = bushes.customDepthMaterial;
    shrub.castShadow = shrub.receiveShadow = true; group.add(shrub); vegetation.push(shrub);
    record(`pond-rest-shrub-${i + 1}`, `Pond rest shrub ${i + 1}`, "Nature", [shrub], position);
  });
  // Clear only the added paving footprints, leaving the seeded rest of the meadow unchanged.
  const plantingMatrix = new T.Matrix4(), plantingPosition = new T.Vector3();
  for (const plants of [grass, stems, blossoms]) {
    for (let i = 0; i < plants.count; i++) {
      plants.getMatrixAt(i, plantingMatrix); plantingPosition.setFromMatrixPosition(plantingMatrix);
      const { x, z } = plantingPosition;
      if (Math.hypot(x - BIRD_CLEARING.x, z - BIRD_CLEARING.z) < 4.35
        || Math.hypot((x + 24) / 4.2, (z + 29.5) / 3.6) < 1) {
        plantingMatrix.scale(new T.Vector3(0, 0, 0)); plants.setMatrixAt(i, plantingMatrix);
      }
    }
    plants.instanceMatrix.needsUpdate = true;
  }
  if (!capture) applyLayout();
  // Keep editor captures whole; only the public renderer needs cullable cells.
  if (!capture) {
    group.updateMatrixWorld(true);
    clearSurfacePlanting(group, vegetation);
    const splitIntoCells = (mesh: T.InstancedMesh, cellSize: number, name: string, windMargin = .5) => {
      const index = vegetation.indexOf(mesh);
      const chunks = instanceCells(mesh, cellSize, name, windMargin);
      vegetation.splice(index, 1, ...chunks);
    };
    for (const meadow of vegetation.filter(mesh => mesh.geometry === grassGeo))
      splitIntoCells(meadow, 18, meadow === grass ? "Meadow grass" : "Painted meadow grass", .5);
    for (const flowers of meadowFlowerMeshes) splitIntoCells(flowers, 36, "Meadow wildflowers");
    splitIntoCells(forest, 48, "Distant forest");
    for (const plants of vegetation.filter(mesh => mesh.geometry === bushGeo))
      splitIntoCells(plants, 18, "Meadow shrubs", .5);
    for (const plants of vegetation.filter(mesh => !mesh.name && mesh.count >= 100))
      splitIntoCells(plants, 18, "Meadow planting", .5);
  }
  return { trees, treeLod, treeRecords };
}

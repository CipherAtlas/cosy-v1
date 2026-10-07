import * as T from "three";
import type { PlaceableAsset } from "./placeableAssets";
import { riverGeometry } from "./riverGeometry";
import { makeWater } from "./water";
import { batchStaticProp } from "./spatialRendering";

function strataGeometry() {
  const rockGeometry = new T.IcosahedronGeometry(1, 1);
  const rockPositions = rockGeometry.attributes.position;
  for (let i = 0; i < rockPositions.count; i++) {
    const x = rockPositions.getX(i), y = rockPositions.getY(i), z = rockPositions.getZ(i);
    rockPositions.setXYZ(i, x + Math.sin(y * 6 + z * 3) * .08, T.MathUtils.clamp(y, -.68, .7) + Math.sin(x * 5 + z * 2) * .06, z + Math.sin(x * 4 - y * 3) * .07);
  }
  rockGeometry.computeVertexNormals();
  rockGeometry.setAttribute("color", new T.Float32BufferAttribute(new Float32Array(rockPositions.count * 3).fill(1), 3));
  return rockGeometry;
}

/** A rock-backed fall: local +Z is downstream, with a pool at the foot. */
export function makeHillWaterfall(time: { value: number }): PlaceableAsset {
  const root = new T.Group(); root.name = "Hill waterfall";
  const stone = new T.MeshStandardMaterial({ color: "#85938c", roughness: .95, flatShading: true, vertexColors: true });
  const dark = new T.MeshStandardMaterial({ color: "#78847b", roughness: 1, flatShading: true, vertexColors: true });
  const moss = new T.MeshStandardMaterial({ color: "#657c4d", roughness: 1 });
  const rockGeometry = strataGeometry();
  const rock = (x: number, y: number, z: number, sx: number, sy: number, sz: number, material = stone, tilt = 0) => {
    const mesh = new T.Mesh(rockGeometry, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
    mesh.rotation.set(.025 * z, Math.sin(y * 1.7 + x) * .12, tilt); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
  };
  // A continuous recessed face ties the irregular shelves into the hillside.
  const levels = [0, 1.6, 3.7, 5.9, 8.1, 10.4, 12.7, 14.8, 16.5, 18];
  const widths = [5.6, 6.2, 5.8, 6.1, 5.8, 5.5, 5.8, 5.5, 5.2, 4.9], columns = [-1, -.68, -.36, 0, .36, .68, 1];
  const face: number[] = [], faceUV: number[] = [], faceColors: number[] = [], faceIndices: number[] = [];
  for (const [i, y] of levels.entries()) {
    const t = 1 - y / 18, z = -2.7 + 3 * Math.min(1, t * 4) + .7 * t * t - .45;
    for (const [column, fraction] of columns.entries()) {
      const edge = Math.abs(fraction) === 1, jitter = Math.sin(i * 2.3 + column * 1.7);
      const px = fraction * widths[i] + (Math.abs(fraction) > .36 ? jitter * .15 : 0);
      const py = i === levels.length - 1 && Math.abs(fraction) <= .36 ? 17.7 : y + (i && i < levels.length - 1 ? jitter * .35 : 0);
      // Recess the wet channel; alternate projecting strata on its shoulders.
      const relief = Math.abs(fraction) <= .36 ? -.15 : edge ? -1.15 + jitter * .2 : .1 + jitter * .35 + (i % 2 ? .2 : -.15);
      face.push(px, py, z + relief); faceUV.push((px + 4) / 8, py / 18); faceColors.push(1, 1, 1);
      if (i && column) {
        const n = i * columns.length + column;
        faceIndices.push(n - columns.length - 1, n - columns.length, n - 1, n - columns.length, n, n - 1);
      }
    }
  }
  // Close the exposed sides and crown so editor rotation and uphill views never reveal a sheet.
  const frontCount = face.length / 3;
  for (let i = 0; i < frontCount; i++) {
    face.push(face[i * 3], face[i * 3 + 1], -6.15);
    faceUV.push(faceUV[i * 2], faceUV[i * 2 + 1]); faceColors.push(1, 1, 1);
  }
  for (let i = 0; i < frontCount; i += columns.length) {
    if (i) for (const column of [0, columns.length - 1]) {
      const a = i - columns.length + column, b = i + column;
      if (column === 0) faceIndices.push(a, b, a + frontCount, b, b + frontCount, a + frontCount);
      else faceIndices.push(a, a + frontCount, b, b, a + frontCount, b + frontCount);
    }
    for (let column = 1; column < columns.length; column++) {
      const n = i + column;
      if (i) faceIndices.push(n - columns.length - 1 + frontCount, n - 1 + frontCount, n - columns.length + frontCount,
        n - columns.length + frontCount, n - 1 + frontCount, n + frontCount);
      if (i === frontCount - columns.length) faceIndices.push(n - 1, n, n - 1 + frontCount, n, n + frontCount, n - 1 + frontCount);
      if (!i) faceIndices.push(n - 1, n - 1 + frontCount, n, n, n - 1 + frontCount, n + frontCount);
    }
  }
  const cliffGeometry = new T.BufferGeometry(); cliffGeometry.setAttribute("position", new T.Float32BufferAttribute(face, 3));
  cliffGeometry.setIndex(faceIndices); cliffGeometry.computeVertexNormals();
  cliffGeometry.setAttribute("uv", new T.Float32BufferAttribute(faceUV, 2));
  cliffGeometry.setAttribute("color", new T.Float32BufferAttribute(faceColors, 3));
  const fractured = cliffGeometry.toNonIndexed(); cliffGeometry.dispose();
  const colors = fractured.attributes.color;
  for (let i = 0; i < colors.count; i += 3) {
    const shade = .94 + (Math.sin(i * 2.17) + 1) * .04;
    for (let corner = 0; corner < 3; corner++) colors.setXYZ(i + corner, shade, shade, shade);
  }
  const cliff = new T.Mesh(fractured, dark); cliff.name = "Recessed waterfall cliff"; cliff.castShadow = cliff.receiveShadow = true; root.add(cliff);
  const shelves = [
    [-2.7, .65, .15, 1.4, 1.2, 1.3, -.12], [2.45, .8, .2, 1.3, 1.3, 1.05, .12],
    [-2.65, 5.55, -.8, 1.15, .65, .95, .08], [2.7, 10.1, -1.1, 1.15, .6, .8, -.06],
    [-2.5, 16.9, -3.6, 1.5, 1.25, 1.15, .07], [2.4, 17.05, -3.8, 1.35, 1.35, 1.3, -.1],
  ];
  shelves.forEach(([x, y, z, sx, sy, sz, tilt]) => rock(x, y, z, sx, sy, sz, stone, tilt));
  rock(-.35, 5.5, -.9, 2.9, .48, .6, dark, -.05);
  rock(.15, 11.8, -1.45, 2.85, .55, .65, dark, .06);
  rock(-.2, 17.45, -4.4, 2.7, .55, 1.1, stone, -.05);
  rock(-1.95, 17.85, -3.45, .85, .65, 1.25, stone, .08);
  rock(1.95, 17.8, -3.65, .85, .7, 1.2, stone, -.06);
  rock(.15, 18.15, -6.2, 2.2, .4, .6, stone, .03);
  for (const [x, y, z, sx, sz] of [[-2.7, 1.45, .05, .8, .75], [2.7, 10.45, -1.1, .65, .6], [-2.5, 17.8, -3.6, .8, .8]])
    rock(x, y, z, sx, .065, sz, moss, x * .015);
  const water = new T.ShaderMaterial({
    uniforms: { time }, side: T.DoubleSide, transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vUv; uniform float time;
      void main(){vUv=uv; vec3 p=position;
        float free=sin(uv.y*3.14159);
        p.z+=free*(sin(uv.y*26.+time*6.+uv.x*8.)*.065+sin(uv.y*43.+time*10.)*.025);
        p.x+=free*sin(uv.y*18.+time*3.+uv.x*5.)*.045;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: `varying vec2 vUv; uniform float time;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){
        vec2 flow=vec2(vUv.x*18.,vUv.y*32.+time*7.2);
        float bands=noise(flow+vec2(noise(flow*.45)*1.5,0.));
        float fine=noise(flow*vec2(2.4,1.7)+vec2(3.,time*1.5));
        float threads=pow(.5+.5*sin(vUv.x*29.+noise(flow*.7)*4.),4.);
        float lip=smoothstep(.89,1.,vUv.y),impact=1.-smoothstep(.02,.2,vUv.y);
        float foam=clamp(smoothstep(.58,.85,bands)*.28+threads*fine*.38+lip*.45+impact*.6,0.,1.);
        vec3 c=mix(vec3(.16,.5,.53),vec3(.46,.8,.79),bands*.6+fine*.2);
        c=mix(c,vec3(.9,.98,.94),foam);
        float edge=smoothstep(0.,.055,vUv.x)*(1.-smoothstep(.945,1.,vUv.x));
        gl_FragColor=vec4(c,edge*(.83+foam*.17));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  const ribbon = (x: number, width: number, phase: number) => {
    const positions: number[] = [], uv: number[] = [], indices: number[] = [];
    for (let i = 0; i <= 36; i++) {
      const t = i / 36, y = 18.22 * (1 - t) - .1;
      const z = -2.7 + 3 * Math.min(1, t * 4) + .7 * t * t;
      for (const side of [-1, 1]) { positions.push(x + side * width / 2 + Math.sin(t * 7 + phase) * .08, y, z); uv.push((side + 1) / 2, 1 - t); }
      if (i < 36) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
    }
    const geometry = new T.BufferGeometry(); geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3)); geometry.setAttribute("uv", new T.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const mesh = new T.Mesh(geometry, water); mesh.castShadow = false; mesh.name = "Flowing waterfall curtain"; root.add(mesh);
  };
  ribbon(0, 2.6, 0);
  const headwater = new T.Mesh(riverGeometry([[0, -6], [0, -2.7]], 2.6, () => 18.05), makeWater(time, { value: .25 }).material);
  headwater.name = "Waterfall headwater"; root.add(headwater);
  const pool = new T.Mesh(riverGeometry([[0, .8], [0, 3.25]], 2.6, () => -.175), makeWater(time, { value: .25 }).material);
  for (let i = 0; i < pool.geometry.attributes.uv.count; i++)
    pool.geometry.attributes.uv.setY(i, pool.geometry.attributes.uv.getY(i) - 2.2);
  pool.name = "Waterfall basin"; root.add(pool);
  const foamMaterial = new T.ShaderMaterial({
    uniforms: { time }, transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vUv;uniform float time;
      void main(){vec2 p=(vUv-.5)*2.;float r=length(p),a=atan(p.y,p.x);
        float wave=fract(r*3.-time*.7+sin(a*7.+time)*.055);
        float ring=(1.-smoothstep(.035,.12,abs(wave-.45)))*(1.-smoothstep(.25,1.,r));
        float churn=(.5+.5*sin(a*11.+r*28.-time*5.))*(1.-smoothstep(.1,.48,r));
        gl_FragColor=vec4(.86,.97,.92,(ring*.42+churn*.48)*(1.-smoothstep(.82,1.,r)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const foam = new T.Mesh(new T.PlaneGeometry(2.5, 2.2), foamMaterial);
  foam.rotation.x = -Math.PI / 2; foam.position.set(0, -.08, 1.55); foam.name = "Expanding waterfall foam"; root.add(foam);
  const seeds: number[] = [];
  for (let i = 0; i < 96; i++) seeds.push((i * .61803398875) % 1, (i * .38196601125) % 1, (i * .754877666) % 1);
  const sprayGeometry = new T.BufferGeometry(); sprayGeometry.setAttribute("position", new T.Float32BufferAttribute(seeds, 3));
  const sprayMaterial = new T.ShaderMaterial({
    uniforms: { time }, transparent: true, depthWrite: false,
    vertexShader: `uniform float time; varying float fade;
      void main(){float age=fract(time*.65+position.z),angle=position.y*6.28318;
        vec3 p=vec3((position.x-.5)*2.9+cos(angle)*age*1.6,-.06+sin(age*3.14159)*(1.+position.x),1.1+sin(angle)*age*1.3+age*.7);
        vec4 mv=modelViewMatrix*vec4(p,1.);fade=sin(age*3.14159)*.55;
        gl_Position=projectionMatrix*mv;gl_PointSize=clamp((45.+position.y*55.)/max(1.,-mv.z),1.,14.);
      }`,
    fragmentShader: `varying float fade;void main(){float r=length(gl_PointCoord-.5)*2.;
      gl_FragColor=vec4(.86,.98,.95,(1.-smoothstep(.15,1.,r))*fade);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  });
  const spray = new T.Points(sprayGeometry, sprayMaterial); spray.name = "Waterfall spray";
  sprayGeometry.boundingSphere = new T.Sphere(new T.Vector3(0, 1, 1.5), 4); root.add(spray);
  for (const [x, y, z, sx, sy, sz] of [[-2.5, .1, 1.1, 1.1, .65, 1.3], [-2.15, -.1, 2.9, .8, .45, 1.05], [-2.5, -.18, 4.5, .55, .3, .75],
    [2.25, .15, 1.45, .9, .7, 1.1], [2, -.1, 3.6, .65, .4, .95], [2.6, -.2, 5, .45, .25, .65]]) rock(x, y, z, sx, sy, sz);
  batchStaticProp(root);
  return { id: "hill-waterfall", name: "Hill waterfall", category: "Landscape", template: root, shelf: true,
    localColliders: [{ x: 0, z: -3.2, w: 12.8, d: 8.4, bottom: -.2, top: 18.5 }, { x: 0, z: 3.3, w: 6.2, d: 7, bottom: -.3, top: .3 }] };
}

/** Embedded stone shelves for the hill shoulders, using the waterfall's rock palette. */
export function makeHillRockOutcrop(): PlaceableAsset {
  const root = new T.Group(); root.name = "Hill rock outcrop";
  const geometry = strataGeometry(), material = new T.MeshStandardMaterial({ color: "#85938c", roughness: .95, flatShading: true, vertexColors: true });
  for (const [x, y, z, sx, sy, sz, tilt] of [
    [-1.6, .4, -.25, 2.8, 1.4, 2.1, -.14], [1.2, .75, .1, 2.5, 1.8, 1.85, .16],
    [-.4, 1.4, -.6, 2.6, .8, 1.6, -.05], [.8, -.1, 1.4, 1.9, .65, 1.3, .12],
  ]) {
    const mesh = new T.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
    mesh.rotation.set(.08 * z, .12 * x, tilt); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
  }
  batchStaticProp(root);
  return { id: "hill-rock-outcrop", name: "Hill rock outcrop", category: "Landscape", template: root, shelf: true,
    localColliders: [{ x: -.25, z: .1, w: 9, d: 5.4, bottom: -.8, top: 2.1 }] };
}

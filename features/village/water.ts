import * as T from "three";

/** Stream-distance advection follows authored bends; ponds use a slower surface drift. */
export function makeWater(time: { value: number }, gust: { value: number }, pond = false) {
  const material = new T.MeshPhysicalMaterial({
    color: "#3b9d9e", roughness: .32, metalness: 0,
    clearcoat: .22, clearcoatRoughness: .42, envMapIntensity: .34,
  });
  const weather = { value: new T.Vector2() };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, {
      uWaterTime: time, uWaterGust: gust, uWaterWeather: weather,
      uPond: { value: pond ? 1 : 0 },
      uDeep: { value: new T.Color("#287f86") }, uShallow: { value: new T.Color("#87c9bd") },
    });
    const field = `
      uniform float uWaterTime, uWaterGust, uPond;
      varying vec3 vWaterWorld;
      varying vec2 vWaterUV;
      varying vec2 vWaterPondUV;
      varying float vWaterJoin;
      float waterHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float waterNoise(vec2 p) {
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(waterHash(i),waterHash(i+vec2(1,0)),f.x),mix(waterHash(i+vec2(0,1)),waterHash(i+vec2(1,1)),f.x),f.y);
      }
      vec2 waterCurrent(float pond) {
        vec2 p=mix(vec2(vWaterUV.x*6.4,vWaterUV.y),vWaterWorld.xz,pond);
        // Every moving detail samples this same field, travelling toward increasing stream distance.
        p.y-=uWaterTime*mix(.9,.12,pond);
        return p;
      }
      float waterHeight(vec2 p) {
        return sin(p.y*7.4+waterNoise(vec2(p.x*1.8,p.y*.6))*3.2)*.0065
          + (waterNoise(p*vec2(4.0,3.0))-.5)*.014;
      }
      float waterFoam(vec2 p) {
        float thread=waterNoise(p*vec2(9.0,.85));
        float fleck=waterNoise(p*vec2(3.0,2.8)+vec2(11.,7.));
        return smoothstep(.79,.93,thread)*smoothstep(.55,.8,fleck);
      }
    `;
    shader.vertexShader = `attribute float waterJoin; attribute vec2 waterPondUV;\n` + field + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      vWaterUV=uv;
      vWaterJoin=waterJoin;vWaterPondUV=waterPondUV;
      vWaterWorld=(modelMatrix*vec4(position,1.0)).xyz;
    `);
    shader.fragmentShader = field + `uniform vec3 uDeep,uShallow; uniform vec2 uWaterWeather;\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      float bank=mix(abs(vWaterUV.x-.5)*2.0,length(vWaterUV-.5)*2.0,uPond);
      bank=mix(bank,length(vWaterPondUV-.5)*2.0,vWaterJoin);
      float shallow=smoothstep(.42,1.0,bank);
      vec2 current=waterCurrent(uPond);
      vec3 waterColor=mix(uDeep,uShallow,shallow*.72);
      waterColor=mix(waterColor,waterColor*vec3(.6,.7,.94),uWaterWeather.y*.55);
      waterColor=mix(waterColor,waterColor*vec3(.8,.92,.95),uWaterWeather.x*.4);
      float foam=waterFoam(current);
      if(vWaterJoin>0.0)foam=mix(foam,waterFoam(waterCurrent(1.0)),vWaterJoin);
      float edge=smoothstep(.86,.98,bank);
      diffuseColor.rgb=mix(waterColor,vec3(.84,.95,.91),foam*(.09+edge*.10));
    `);
    shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_begin>", `#include <normal_fragment_begin>
      float h=waterHeight(waterCurrent(uPond));
      if(vWaterJoin>0.0)h=mix(h,waterHeight(waterCurrent(1.0)),vWaterJoin);
      vec3 dx=dFdx(vWaterWorld),dy=dFdy(vWaterWorld);
      vec3 up=normalize(cross(dx,dy));
      if(up.y<0.0)up=-up;
      vec3 rx=cross(dy,up),ry=cross(up,dx);
      float area=dot(dx,rx);
      vec3 gradient=(rx*dFdx(h)+ry*dFdy(h))/max(abs(area),.000001)*sign(area);
      vec3 rippleNormal=normalize(up-gradient*(.8+uWaterGust*.2));
      normal=normalize((viewMatrix*vec4(rippleNormal,0.0)).xyz);
    `);
  };
  material.customProgramCacheKey = () => `village-water-soft-joined-${pond}`;
  return { material, setWeather: (rain: number, dusk: number) => { weather.value.set(rain,dusk); } };
}

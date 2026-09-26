import * as T from "three";

/** A shared world-space current, with separate shoreline masks for river and pond. */
export function makeWater(time: { value: number }, gust: { value: number }, pond = false) {
  const material = new T.MeshPhysicalMaterial({
    color: "#3b9d9e", roughness: .34, metalness: 0,
    clearcoat: .35, clearcoatRoughness: .3, envMapIntensity: .45,
  });
  const weather = { value: new T.Vector2() };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, {
      uWaterTime: time, uWaterGust: gust, uWaterWeather: weather,
      uPond: { value: pond ? 1 : 0 },
      uDeep: { value: new T.Color("#267981") }, uShallow: { value: new T.Color("#7cc8b3") },
    });
    const field = `
      uniform float uWaterTime, uWaterGust, uPond;
      varying vec3 vWaterWorld;
      varying vec2 vWaterUV;
      float waterHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float waterNoise(vec2 p) {
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(waterHash(i),waterHash(i+vec2(1,0)),f.x),mix(waterHash(i+vec2(0,1)),waterHash(i+vec2(1,1)),f.x),f.y);
      }
      float waterHeight(vec2 p) {
        float speed=mix(.45,.085,uPond), t=uWaterTime*speed;
        vec2 flow=vec2(p.x+sin(p.y*.052)*.32,p.y-t);
        return waterNoise(flow*.95)*.13 + waterNoise(flow*2.1+vec2(t*.17,2.8))*.05
          + sin(p.x*1.3+p.y*.58+t*.7)*.022 + sin(p.y*.92-p.x*.64-t*.48)*.019;
      }
    `;
    shader.vertexShader = field + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      vWaterUV=uv;
      vWaterWorld=(modelMatrix*vec4(position,1.0)).xyz;
      transformed.y+=(waterHeight(vWaterWorld.xz)-.09)*.28;
    `);
    shader.fragmentShader = field + `uniform vec3 uDeep,uShallow; uniform vec2 uWaterWeather;\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      float bank=mix(abs(vWaterUV.x-.5)*2.0,length(vWaterUV-.5)*2.0,uPond);
      float shallow=smoothstep(.42,1.0,bank);
      float eddy=waterNoise(vWaterWorld.xz*.72+vec2(0.0,-uWaterTime*.19));
      vec3 waterColor=mix(uDeep,uShallow,shallow*.73+eddy*.12);
      waterColor=mix(waterColor,waterColor*vec3(.6,.7,.94),uWaterWeather.y*.55);
      waterColor=mix(waterColor,waterColor*vec3(.8,.92,.95),uWaterWeather.x*.4);
      float foam=smoothstep(.9,.98,bank)*smoothstep(.45,.73,eddy)*.24;
      diffuseColor.rgb=mix(waterColor,vec3(.77,.88,.79),foam);
    `);
    shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_begin>", `#include <normal_fragment_begin>
      float h=waterHeight(vWaterWorld.xz), e=.09;
      vec2 slope=vec2(waterHeight(vWaterWorld.xz+vec2(e,0.0))-h,waterHeight(vWaterWorld.xz+vec2(0.0,e))-h)/e;
      vec3 rippleNormal=normalize(vec3(-slope.x*(.8+uWaterGust*.3),1.0,-slope.y));
      normal=normalize((viewMatrix*vec4(rippleNormal,0.0)).xyz);
    `);
  };
  material.customProgramCacheKey = () => `village-water-current-${pond}`;
  return { material, setWeather: (rain: number, dusk: number) => { weather.value.set(rain,dusk); } };
}

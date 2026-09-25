import * as T from "three";
import type { Weather } from "./places";

/** A sky in scene space: cloud detail survives looking up in every direction. */
export function createAtmosphere() {
  const material = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: {
      time: { value: 0 }, rain: { value: 0 }, dusk: { value: 0 },
      sunDirection: { value: new T.Vector3(-35, 26, -55).normalize() },
    },
    vertexShader: `varying vec3 direction;
      void main(){ direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec3 direction; uniform float time; uniform float rain; uniform float dusk; uniform vec3 sunDirection;
      float hash(vec3 p){p=fract(p*.3183099+vec3(.13,.37,.71));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
        mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      float fbm(vec3 p){float f=0.,a=.55;for(int i=0;i<5;i++){f+=noise(p)*a;p=p*2.03+vec3(1.7,3.1,2.4);a*=.48;}return f;}
      void main(){
        vec3 d=normalize(direction);float elevation=max(d.y,0.);
        vec3 horizon=mix(vec3(.67,.65,.53),vec3(.33,.30,.42),dusk);
        vec3 zenith=mix(vec3(.055,.18,.38),vec3(.025,.045,.12),dusk);
        vec3 sky=mix(horizon,zenith,pow(clamp(elevation*2.4,0.,1.),.35));
        sky=mix(sky,mix(vec3(.48,.55,.59),vec3(.22,.30,.38),elevation),rain*.88);
        float sun=max(dot(d,sunDirection),0.);
        sky+=vec3(1.,.64,.28)*pow(sun,14.)*.18*(1.-rain)*(1.-dusk*.8);
        sky+=vec3(1.,.87,.59)*pow(sun,950.)*2.8*(1.-rain)*(1.-dusk);
        vec3 p=d*vec3(6.5,11.,6.5)+vec3(time*.006,0.,time*.003);
        float mass=fbm(p),detail=fbm(p*2.8+2.1);
        float cloud=smoothstep(.53-rain*.17,.69-rain*.17,mass+detail*.12);
        cloud*=smoothstep(-.035,.09,d.y);
        vec3 shade=mix(vec3(.30,.38,.49),vec3(.27,.30,.39),dusk);
        vec3 lit=mix(vec3(1.,.87,.66),vec3(.79,.55,.49),dusk);
        vec3 cloudColor=mix(shade,lit,smoothstep(.36,.7,mass)+sun*.2);
        cloudColor=mix(cloudColor,vec3(.43,.49,.54),rain*.7);
        sky=mix(sky,cloudColor,cloud*.94);
        gl_FragColor=vec4(sky,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new T.Mesh(new T.SphereGeometry(750, 32, 20), material);
  sky.renderOrder = -100;
  sky.frustumCulled = false;
  return {
    sky,
    update(time: number, weather: Weather, camera: T.Vector3) {
      material.uniforms.time.value = time;
      material.uniforms.rain.value = weather === "rain" ? 1 : 0;
      material.uniforms.dusk.value = weather === "dusk" ? 1 : 0;
      sky.position.copy(camera);
    },
  };
}

import * as T from "three";

/** A translucent flame surface with a moving, feathered silhouette. */
export function makeFlame(width: number, height: number) {
  const material = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec2 vUv;
      void main() { vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float time;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){
        float y=vUv.y;float n=noise(vec2(vUv.x*5.,y*4.-time*2.5));
        float wave=sin(y*7.-time*3.)*.08*y;
        float shape=(.48*(1.-pow(y,.65)))-abs(vUv.x-.5+wave)+(n-.5)*.15;
        float alpha=smoothstep(-.04,.045,shape)*smoothstep(0.,.08,y)*.88;
        vec3 color=mix(vec3(1.,.16,.015),vec3(1.,.76,.19),smoothstep(0.,.25,shape));
        gl_FragColor=vec4(color,alpha);
      }`,
  });
  return new T.Mesh(new T.PlaneGeometry(width, height), material);
}

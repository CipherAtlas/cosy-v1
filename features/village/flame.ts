import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Intersecting curved flame ribbons, lifted embers and a restrained smoke plume. */
export function makeFlame(width: number, height: number) {
  const time = { value: 0 };
  const parts: T.BufferGeometry[] = [];
  for (let i=0;i<7;i++) {
    const g=new T.PlaneGeometry(width*(.56+(i%3)*.12),height*(.7+(i%4)*.1),6,14);
    const p=g.attributes.position;
    for(let v=0;v<p.count;v++) {
      const rise=g.attributes.uv.getY(v);
      p.setZ(v,Math.sin(rise*Math.PI)*width*.16);
    }
    g.rotateY(i*Math.PI/3.5);g.translate(Math.sin(i*2.4)*width*.12,0,Math.cos(i*2.4)*width*.12);
    g.setAttribute("flameSeed",new T.BufferAttribute(new Float32Array(p.count).fill(i*.73),1));parts.push(g);
  }
  const geometry=mergeGeometries(parts,false)!;parts.forEach(g=>g.dispose());
  const material = new T.ShaderMaterial({
    transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,
    uniforms:{time},
    vertexShader:`uniform float time; attribute float flameSeed; varying vec2 vUv; varying float vSeed;
      void main(){vUv=uv;vSeed=flameSeed;vec3 p=position;
        p.x+=sin(time*2.2+uv.y*5.0+flameSeed)*uv.y*uv.y*.09;
        p.z+=cos(time*1.7+uv.y*6.0+flameSeed)*uv.y*.06;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
    fragmentShader:`uniform float time; varying vec2 vUv; varying float vSeed;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){
        float y=vUv.y;
        float n=noise(vec2(vUv.x*4.0+vSeed,y*4.8-time*2.2));
        float fine=noise(vec2(vUv.x*9.0-vSeed,y*9.0-time*3.6));
        float curl=sin(y*6.5-time*2.5+vSeed)*.10*y;
        float body=.46*pow(1.0-y,.7)-abs(vUv.x-.5+curl)+(n-.5)*.21+(fine-.5)*.055;
        float alpha=smoothstep(-.025,.065,body)*smoothstep(0.0,.12,y)*(1.0-smoothstep(.85,1.0,y))*.72;
        float core=smoothstep(.02,.28,body)*(1.0-y*.6);
        vec3 color=mix(vec3(.96,.19,.025),vec3(1.0,.66,.12),smoothstep(-.02,.13,body));
        color=mix(color,vec3(1.0,.94,.62),core);
        gl_FragColor=vec4(color,alpha);
      }`,
  });
  const mesh=new T.Mesh(geometry,material);mesh.name="Living flame";
  for(const smoke of [false,true]) {
    const count=smoke?14:30, data=new Float32Array(count*3);
    for(let i=0;i<count;i++) data.set([i/count,Math.sin(i*7.3)*.5,Math.cos(i*4.7)*.5],i*3);
    const g=new T.BufferGeometry();g.setAttribute("position",new T.BufferAttribute(data,3));
    const m=new T.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,
      blending:smoke?T.NormalBlending:T.AdditiveBlending,
      uniforms:{time,scale:{value:new T.Vector2(width,height)}},
      vertexShader:`uniform float time;uniform vec2 scale;varying float vAge;
        void main(){float age=fract(position.x+time*${smoke?'.085':'.21'});vAge=age;
          vec3 p=vec3(position.y*scale.x*.6+sin(age*6.0+position.x*19.0)*age*scale.x*.3,
            -scale.y*.25+age*scale.y*${smoke?'2.9':'2.2'},position.z*scale.x*.4);
          vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;
          gl_PointSize=clamp(${smoke?'(18.0+age*52.0)':'(2.0+position.x*3.0)'}*scale.x/max(1.0,-mv.z),1.0,80.0);}`,
      fragmentShader:`varying float vAge;void main(){float d=length(gl_PointCoord-.5)*2.0;
        float a=pow(max(0.0,1.0-d),${smoke?'2.0':'1.4'})*sin(vAge*3.14159)*${smoke?'.12':'.8'};
        gl_FragColor=vec4(${smoke?'vec3(.43,.46,.44)':'vec3(1.0,.53,.12)'},a);}`,
    });
    const particles=new T.Points(g,m);particles.frustumCulled=false;particles.name=smoke?"Warm smoke":"Drifting embers";mesh.add(particles);
  }
  return mesh;
}

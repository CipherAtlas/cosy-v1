import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Matching opaque near/far tree silhouettes; no photographic billboard texture. */
export function fantasyTreeGeometry(detailed: boolean) {
  const parts: T.BufferGeometry[] = [];
  const crown = [
    [0,6.5,0,2.25,1.8,2.05],[-1.65,5.7,.4,1.6,1.25,1.55],[1.6,5.5,.2,1.8,1.35,1.55],
    [.1,5.35,1.65,1.9,1.25,1.5],[-.2,5.6,-1.5,1.9,1.25,1.5],[-1.25,6.65,-.9,1.35,1.35,1.3],
    [1.15,7,-.35,1.25,1.2,1.35],[.5,6.35,1.55,1.35,1.25,1.25],[-1.45,5.95,1.35,1.15,1.1,1.15],
  ];
  const colorGeometry = (geometry: T.BufferGeometry, bark: boolean) => {
    const positions = geometry.attributes.position, normals = geometry.attributes.normal;
    const colors = new Float32Array(positions.count * 3);
    const shadow = new T.Color(bark ? "#6f7062" : "#458f70"), light = new T.Color(bark ? "#bf9e75" : "#bdde70");
    const color = new T.Color();
    for (let i=0; i<positions.count; i++) {
      const x=positions.getX(i), y=positions.getY(i), z=positions.getZ(i);
      const patch = Math.sin(x*2.3+z*1.4)*Math.sin(y*1.8-z*.7)*.045;
      const amount = bark ? .35+normals.getY(i)*.25 : T.MathUtils.clamp((y-4.1)/4.4+patch,.08,1);
      color.copy(shadow).lerp(light,amount); colors.set([color.r,color.g,color.b],i*3);
      if (!bark) {
        const normal=new T.Vector3(normals.getX(i)*.65,Math.max(.25,normals.getY(i)*.6+.55),normals.getZ(i)*.65).normalize();
        normals.setXYZ(i,normal.x,normal.y,normal.z);
      }
    }
    geometry.setAttribute("color",new T.BufferAttribute(colors,3));
    parts.push(geometry.index ? geometry.toNonIndexed() : geometry);
    if (geometry.index) geometry.dispose();
  };
  const trunk = new T.CylinderGeometry(.12,.38,5.3,detailed?9:5,4);
  trunk.translate(0,2.65,0); colorGeometry(trunk,true);
  if (detailed) for(const side of [-1,1]) {
    const curve=new T.CatmullRomCurve3([new T.Vector3(0,2.5,0),new T.Vector3(side*.5,3.8,.1),new T.Vector3(side*1.6,5.5,.3)]);
    colorGeometry(new T.TubeGeometry(curve,7,.13,6,false),true);
  }
  crown.forEach(([x,y,z,sx,sy,sz],index) => {
    const geometry=new T.IcosahedronGeometry(1,detailed?2:1);
    const p=geometry.attributes.position;
    for(let i=0;i<p.count;i++) {
      const xx=p.getX(i), yy=p.getY(i), zz=p.getZ(i);
      const contour=1+Math.sin(xx*5+index)*Math.sin(zz*4+yy*3)*.085;
      p.setXYZ(i,xx*contour,yy*contour,zz*contour);
    }
    geometry.scale(sx,sy,sz);geometry.translate(x,y,z);
    colorGeometry(geometry,false);
  });
  const geometry=mergeGeometries(parts)!;
  parts.forEach(part=>part.dispose());
  return geometry;
}

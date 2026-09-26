import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { floorHeight, type Collider } from "./environment";
import { JAPANESE_PLACE_NAMES, PLACES } from "./places";

/** Painted village furniture: one arrival directory, junction arrows and six destination posts. */
export function buildWayfinding(colliders: Collider[]) {
  const group = new T.Group(); group.name = "Village wayfinding";
  const wood = new T.MeshStandardMaterial({ color: "#8f623f", roughness: .9 });
  const edge = new T.MeshStandardMaterial({ color: "#dfbd72", roughness: .65 });
  const marker = new T.MeshStandardMaterial({ color: "#ffe8a7", emissive: "#ffce60", emissiveIntensity: .65, roughness: .45 });
  const colors = ["#397f91", "#9a5941", "#488578", "#7970a3", "#5e7850", "#a56578"];
  const labels: { canvas: HTMLCanvasElement; texture: T.CanvasTexture; indices: number[]; arrows: string[]; directory: boolean }[] = [];
  const add = (parent: T.Group, geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z: number) => {
    const mesh = new T.Mesh(geometry, material); mesh.position.set(x,y,z);
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const board = (parent: T.Group, indices: number[], arrows: string[], y: number, width: number, directory = false) => {
    const height = directory ? 2.25 : indices.length * .43 + .12;
    add(parent, new T.BoxGeometry(width+.12,height+.12,.28), edge, 0,y,0);
    for(const side of [1,-1]) {
      const canvas = document.createElement("canvas");canvas.width=1024;canvas.height=directory?1024:256*indices.length;
      const texture = new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
      const material = new T.MeshStandardMaterial({ map:texture,roughness:.9,emissive:"#fff1ca",emissiveMap:texture,emissiveIntensity:.12 });
      const face=add(parent,new T.PlaneGeometry(width,height),material,0,y,side*.151);
      face.rotation.y=side<0?Math.PI:0;face.castShadow=false;
      const opposite: Record<string,string> = { "←":"→", "→":"←", "↑":"↓", "↓":"↑", "↗":"↙", "↖":"↘" };
      labels.push({canvas,texture,indices,arrows:side>0?arrows:arrows.map(arrow=>opposite[arrow]??arrow),directory});
    }
  };
  const post = (x:number,z:number,height:number,rotation=0) => {
    const root=new T.Group();root.position.set(x,floorHeight(x,z),z);root.rotation.y=rotation;root.userData.signpost=true;group.add(root);
    add(root,new T.CylinderGeometry(.085,.12,height,10),wood,0,height/2,0);
    add(root,new T.CylinderGeometry(.19,.23,.15,10),edge,0,.075,0);
    add(root,new T.OctahedronGeometry(.16,0),marker,0,height+.2,0);
    colliders.push({x,z,w:.3,d:.3,top:height});return root;
  };
  const directory=post(-2.8,16,3.7,.15);
  board(directory,[0,4,5,2,3,1],["↗","←","↑","↖","↗","↑"],2.2,3.05,true);
  const junction=post(3.15,5.2,3.15,-.12);
  board(junction,[4,2],["←","←"],2.55,2.6);
  board(junction,[3,1],["↑","↑"],1.5,2.6);
  const north=post(2.5,-8.5,2.7);
  board(north,[3,1],["→","↑"],2.05,2.5);
  const locations=[[4,14.4,0],[-2,-14,.2],[-18.1,-4.2,.1],[11.7,-6.4,-.25],[-17.3,9.5,.25],[4.3,1,0]];
  locations.forEach(([x,z,angle],i)=>{
    const root=post(x,z,2.25,angle);board(root,[i],["◆"],1.65,2.15);
  });
  // Labels remain individual for translation; merge the shared wooden furniture
  // so physical signs do not add dozens of draw calls to every shadow pass.
  group.updateMatrixWorld(true);
  for (const material of [wood, edge, marker]) {
    const meshes: T.Mesh[] = [];
    group.traverse(object => { if (object instanceof T.Mesh && object.material === material) meshes.push(object); });
    const parts = meshes.map(mesh => mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
    const geometry = mergeGeometries(parts, false)!;
    parts.forEach(part => part.dispose());
    meshes.forEach(mesh => { mesh.removeFromParent(); mesh.geometry.dispose(); });
    add(group, geometry, material, 0, 0, 0);
  }
  const setLanguage=(language:"en"|"ja")=>{
    labels.forEach(({canvas,texture,indices,arrows,directory})=>{
      const c=canvas.getContext("2d")!, w=canvas.width,h=canvas.height;
      c.fillStyle="#fff3cf";c.fillRect(0,0,w,h);
      c.strokeStyle="#d1ae65";c.lineWidth=10;c.strokeRect(18,18,w-36,h-36);
      const top=directory?230:15, step=(h-top-20)/indices.length;
      if(directory){
        c.textAlign="center";c.fillStyle="#405a49";c.font=`bold ${language==="ja"?67:82}px Georgia, serif`;
        c.fillText(language==="ja"?"コージー村":"Cosy Village",w/2,118);
        c.font='34px Arial, sans-serif';c.fillText(language==="ja"?"気になる場所へ、ゆっくりと。":"Find a little time for yourself.",w/2,180);
      }
      indices.forEach((index,row)=>{
        const y=top+step*(row+.5);c.fillStyle=colors[index];
        c.beginPath();c.roundRect(42,y-step*.36,step*.72,step*.72,18);c.fill();
        c.fillStyle="#fff8df";c.textAlign="center";c.textBaseline="middle";
        c.font=`bold ${step*.49}px Arial, sans-serif`;c.fillText(arrows[row],42+step*.36,y);
        c.fillStyle="#334b44";c.textAlign="left";
        c.font=`600 ${directory?49:language==="ja"?74:76}px Arial, sans-serif`;
        c.fillText(language==="ja"?JAPANESE_PLACE_NAMES[index]:PLACES[index].name,step*.72+68,y,w-step*.72-103);
      });
      texture.needsUpdate=true;
    });
  };
  setLanguage("en");return {group,setLanguage};
}

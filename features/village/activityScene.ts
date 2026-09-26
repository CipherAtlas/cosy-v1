import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { PlaceId } from "./places";
import type { ActivityMoment, Collider } from "./environment";

// Actor and camera are authored together so the interaction remains visible beside the DOM controls.
export const ACTIVITY_STAGES: Record<PlaceId, { actor: [number,number,number]; yaw: number; camera: [number,number,number]; look: [number,number,number] }> = {
  focus: { actor:[108.65,.15,-.65],yaw:Math.PI,camera:[111.3,2.65,2.5],look:[108.8,1.25,-1.65] },
  music: { actor:[-5.8,.4,-16.1],yaw:Math.PI,camera:[-.9,2.8,-15.5],look:[-5.8,1,-18.1] },
  breathe: { actor:[-22.7,.3,-10.25],yaw:Math.PI,camera:[-20.2,3.2,-8.7],look:[-23.4,.85,-12.8] },
  mood: { actor:[15.2,.1,-8.7],yaw:Math.PI,camera:[18.5,2.6,-5.7],look:[15.2,1.2,-9.6] },
  gratitude: { actor:[-18.2,.05,6.6],yaw:-Math.PI/2,camera:[-16.5,2.8,7.7],look:[-19.1,1.2,6.5] },
  compliment: { actor:[3.05,.05,.35],yaw:Math.PI,camera:[5.2,2.4,-3.2],look:[3,1.25,-.4] },
};

export class VillageActivities {
  readonly outdoor = new T.Group();
  readonly indoor = new T.Group();
  private moment: ActivityMoment = { kind:"focus",running:false,progress:0 };
  private changedAt = 0;
  private time = 0;
  private breathAmount = 0;
  private cup = new T.Group();
  private steam: T.Mesh[] = [];
  private quill = new T.Group();
  private deskQuill = new T.Group();
  private letter = new T.Group();
  private letterFlap = new T.Group();
  private letterPaper = new T.Group();
  private page = new T.Group();
  private sand = new T.Group();
  private sandTop!: T.Mesh;
  private sandBottom!: T.Mesh;
  private sandStream!: T.Mesh;
  private rings: T.Mesh[] = [];
  private motes!: T.InstancedMesh;
  private dummy = new T.Object3D();

  constructor(colliders: Collider[]) {
    colliders.push({x:-19.25,z:6.35,w:.95,d:1.7,top:.96});
    this.outdoor.name="Activity furnishings";this.indoor.name="Desk ritual";this.indoor.visible=false;
    const wood=new T.MeshStandardMaterial({color:"#8f633f",roughness:.8});
    const gold=new T.MeshStandardMaterial({color:"#d7b56d",metalness:.35,roughness:.45});
    const paper=new T.MeshStandardMaterial({color:"#fff2ce",roughness:.9,side:T.DoubleSide});
    const ink=new T.MeshStandardMaterial({color:"#477879",roughness:.7});
    const add=(root:T.Group,g:T.BufferGeometry,m:T.Material,x:number,y:number,z:number)=>{
      const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;
    };
    const box=(root:T.Group,m:T.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>add(root,new T.BoxGeometry(w,h,d),m,x,y,z);
    const feather=(root:T.Group)=>{
      const stem=add(root,new T.CylinderGeometry(.009,.012,.48,7),gold,0,.2,0);stem.rotation.z=-.32;
      const plume=add(root,new T.SphereGeometry(.12,12,8),ink,-.065,.35,0);plume.scale.set(.58,1.75,.18);plume.rotation.z=-.35;
    };
    // A writing table outside the nook, with a real book and quill.
    const desk=new T.Group();desk.position.set(-19.25,0,6.35);desk.rotation.y=Math.PI/2;this.outdoor.add(desk);
    box(desk,wood,0,.9,0,1.7,.12,.95);
    for(const x of [-.65,.65])for(const z of [-.32,.32])box(desk,wood,x,.43,z,.075,.86,.075);
    const book=new T.Group();book.position.set(0,.98,0);desk.add(book);
    box(book,ink,0,0,0,.87,.045,.62);box(book,paper,0,.045,0,.82,.045,.57);
    box(book,gold,0,.07,0,.018,.006,.56);
    for(const x of [-.24,.24])for(let i=0;i<5;i++)box(book,wood,x,.071,-.17+i*.07,.26,.003,.008);
    this.quill.position.set(.26,1.03,.05);feather(this.quill);desk.add(this.quill);
    this.page.position.set(-19.25,1.02,6.35);this.outdoor.add(this.page);
    const liftedPage=add(this.page,new T.PlaneGeometry(.46,.6),paper,0,0,0);liftedPage.rotation.x=-Math.PI/2;
    this.page.visible=false;
    // Tea has thickness, a handle, liquid and steam; it rises in response to a check-in.
    this.cup.position.set(15.2,1.28,-9.65);this.outdoor.add(this.cup);
    add(this.cup,new T.CylinderGeometry(.23,.22,.035,24),paper,0,0,0);
    add(this.cup,new T.LatheGeometry([new T.Vector2(.12,.035),new T.Vector2(.14,.08),new T.Vector2(.17,.27),new T.Vector2(.145,.27),new T.Vector2(.125,.09)],24),ink,0,0,0);
    add(this.cup,new T.CylinderGeometry(.143,.143,.008,24),new T.MeshStandardMaterial({color:"#966027",roughness:.22}),0,.238,0);
    add(this.cup,new T.TorusGeometry(.085,.02,8,18),ink,.18,.16,0);
    for(let i=0;i<3;i++) {
      const path=new T.CatmullRomCurve3([new T.Vector3(0,0,0),new T.Vector3(.035,.1,0),new T.Vector3(-.03,.23,0),new T.Vector3(.025,.4,0)]);
      const m=new T.MeshBasicMaterial({color:"#fff5d9",transparent:true,opacity:.18,depthWrite:false});
      const steam=add(this.cup,new T.TubeGeometry(path,14,.008,5,false),m,(i-1)*.07,.28,0);steam.castShadow=steam.receiveShadow=false;this.steam.push(steam);
    }
    // An envelope opens above the existing postbox, keeping the note physically connected to it.
    this.letter.position.set(3,1.67,-.52);this.outdoor.add(this.letter);
    box(this.letter,paper,0,0,0,.42,.29,.035);
    this.letterFlap.position.set(0,.145,.022);this.letter.add(this.letterFlap);
    const flapGeometry=new T.BufferGeometry();
    flapGeometry.setAttribute("position",new T.Float32BufferAttribute([-.21,0,0,.21,0,0,0,-.19,0],3));flapGeometry.computeVertexNormals();
    add(this.letterFlap,flapGeometry,paper,0,0,0);
    this.letter.add(this.letterPaper);
    box(this.letterPaper,paper,0,0,-.025,.34,.24,.008);
    for(let i=0;i<3;i++)box(this.letterPaper,ink,0,.07-i*.045,-.031,.23,.009,.002);
    add(this.letter,new T.SphereGeometry(.043,12,8),gold,0,0,.055).scale.z=.3;
    // Hourglass and writing companion on the indoor desk.
    this.sand.position.set(107.7,1.1,-2.12);this.indoor.add(this.sand);
    for(const y of [0,.58]) add(this.sand,new T.CylinderGeometry(.18,.18,.055,24),gold,0,y,0);
    for(const x of [-.14,.14])add(this.sand,new T.CylinderGeometry(.017,.017,.56,8),wood,x,.29,0);
    const glass=new T.MeshPhysicalMaterial({color:"#b5e3df",transparent:true,opacity:.24,roughness:.15,depthWrite:false,side:T.DoubleSide});
    add(this.sand,new T.LatheGeometry([new T.Vector2(.12,.035),new T.Vector2(.13,.12),new T.Vector2(.024,.29),new T.Vector2(.13,.46),new T.Vector2(.12,.55)],24),glass,0,0,0);
    this.sandTop=add(this.sand,new T.ConeGeometry(.1,.19,20),gold,0,.44,0);this.sandTop.rotation.z=Math.PI;
    this.sandBottom=add(this.sand,new T.ConeGeometry(.11,.18,20),gold,0,.09,0);
    this.sandStream=add(this.sand,new T.CylinderGeometry(.005,.006,.31,6),gold,0,.27,0);
    this.deskQuill.position.set(108.85,1.14,-1.8);feather(this.deskQuill);this.indoor.add(this.deskQuill);
    for(let i=0;i<3;i++) {
      const m=new T.MeshBasicMaterial({color:i===0?"#d8fff1":"#97ddd1",transparent:true,opacity:.45,side:T.DoubleSide,depthWrite:false});
      const ring=add(this.outdoor,new T.RingGeometry(.94,1,80),m,-23.6,-.24,-13.1);ring.rotation.x=-Math.PI/2;ring.castShadow=ring.receiveShadow=false;ring.visible=false;this.rings.push(ring);
    }
    this.motes=new T.InstancedMesh(new T.SphereGeometry(.025,6,4),new T.MeshBasicMaterial({color:"#ffe1a0",transparent:true,opacity:.65}),14);
    this.motes.frustumCulled=false;this.motes.visible=false;this.outdoor.add(this.motes);
    // Furniture stays batched; only parts that react to an activity need separate draws.
    const moving=new Set<T.Object3D>([this.cup,this.quill,this.deskQuill,this.letter,this.page,this.sandTop,this.sandBottom,this.sandStream,this.motes,...this.rings]);
    for(const root of [this.outdoor,this.indoor]) {
      root.updateMatrixWorld(true);
      const batches=new Map<T.Material,T.Mesh[]>();
      root.traverse(object=>{
        if(!(object instanceof T.Mesh)||Array.isArray(object.material)||object.material.transparent)return;
        for(let ancestor:T.Object3D|null=object;ancestor;ancestor=ancestor.parent)if(moving.has(ancestor))return;
        const batch=batches.get(object.material)??[];batch.push(object);batches.set(object.material,batch);
      });
      for(const [material,meshes] of batches) {
        if(meshes.length<2)continue;
        const parts=meshes.map(mesh=>mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
        const geometry=mergeGeometries(parts,false)!;parts.forEach(part=>part.dispose());
        meshes.forEach(mesh=>{mesh.removeFromParent();mesh.geometry.dispose()});
        add(root,geometry,material,0,0,0);
      }
    }
  }
  setMoment(moment:ActivityMoment) {this.moment=moment;this.changedAt=this.time;}
  enter(place:PlaceId|null) {
    this.indoor.visible=place==="focus";
    this.rings.forEach(r=>r.visible=place==="breathe");
    this.motes.visible=place==="music";
    this.page.visible=false;
    this.changedAt=this.time;
  }
  update(time:number,place:PlaceId|null,reduced:boolean,player:T.Group,character:T.Object3D|undefined,scale:number) {
    const dt=Math.min(.1,time-this.time);
    this.time=time;
    const t=reduced?0:time, age=time-this.changedAt, moment=this.moment;
    this.steam.forEach((steam,i)=>{
      steam.scale.y=.8+Math.sin(t*.8+i)*.17;steam.rotation.y=t*.24+i;
      (steam.material as T.MeshBasicMaterial).opacity=reduced?.16:.12+Math.sin(t*1.3+i)*.05;
    });
    const sip=!reduced&&place==="mood"&&moment.kind==="tea"&&age<3.2?Math.sin(Math.min(1,age/3.2)*Math.PI):0;
    this.cup.position.set(15.2,1.28+sip*.34,-9.65+sip*.45);this.cup.rotation.x=sip*.22;
    const writing=!reduced&&place==="gratitude"&&moment.kind==="write"&&age<1.8;
    this.quill.rotation.z=writing?Math.sin(t*15)*.12:0;this.quill.position.x=.26+(writing?Math.sin(t*4)*.07:0);
    const save=!reduced&&place==="gratitude"&&moment.kind==="save"&&age<1.4;
    this.page.visible=save;this.page.position.y=1.02+(save?Math.sin(age/1.4*Math.PI)*.38:0);this.page.rotation.z=save?Math.sin(age*3)*.12:0;
    const reading=place==="compliment", open=reading?(reduced?1:Math.min(1,age/.7)):0;
    this.letter.position.set(3,1.67+open*.12,-.52+open*.45);this.letter.rotation.set(-open*.18,0,reading&&!reduced?Math.sin(t*1.4)*.06:0);
    const keeping=reading&&moment.kind==="keep"&&!reduced?Math.sin(Math.min(1,age/1.2)*Math.PI):0;
    this.letterFlap.rotation.x=-open*Math.PI*.9;
    this.letterPaper.position.y=open*.18+keeping*.12;
    this.letter.scale.setScalar(1+keeping*.08);
    const progress=moment.kind==="focus"?moment.progress:0;
    this.sandTop.scale.y=Math.max(.02,1-progress);this.sandBottom.scale.y=Math.max(.03,progress);
    this.sandTop.position.y=.53-.095*(1-progress);this.sandBottom.position.y=.035+.09*progress;
    this.sandStream.visible=moment.kind==="focus"&&moment.running;
    this.deskQuill.rotation.z=!reduced&&moment.kind==="focus"&&moment.running?Math.sin(t*3)*.065:0;
    const breathing=moment.kind==="breathe"&&moment.active;
    this.breathAmount=T.MathUtils.damp(this.breathAmount,breathing?moment.amount:0,9,dt);
    const breath=this.breathAmount;
    this.rings.forEach((ring,i)=>{
      const size=reduced?1.2:1.05+breath*.75+i*.36;
      ring.scale.setScalar(size);(ring.material as T.MeshBasicMaterial).opacity=breathing?.42-i*.09:.16-i*.035;
    });
    const playing=moment.kind==="music"&&moment.playing;
    for(let i=0;i<14;i++) {
      const a=i*2.4+t*(playing?.16:.035),r=1+(i%4)*.28;
      this.dummy.position.set(-5.8+Math.cos(a)*r,.5+(i%5)*.29+Math.sin(t*.8+i)*.08,-18+Math.sin(a)*r);
      this.dummy.scale.setScalar(playing?1:.45);this.dummy.updateMatrix();this.motes.setMatrixAt(i,this.dummy.matrix);
    }
    this.motes.instanceMatrix.needsUpdate=true;
    if(!place)return;
    const pose=ACTIVITY_STAGES[place];player.position.fromArray(pose.actor);player.rotation.y=pose.yaw;
    if(character) {
      const bob=reduced?0:Math.sin(t*1.7)*.025;
      character.position.y=.62+bob+(place==="breathe"&&!reduced?breath*.12:0);
      character.rotation.x=(place==="focus"||writing) ? .07 : 0;
      character.rotation.z=reduced?0:place==="music"&&playing?Math.sin(t*1.8)*.045:0;
      const expansion=place==="breathe"&&!reduced?1+breath*.065:1;
      character.scale.set(scale*expansion,scale*expansion,scale*expansion);
    }
  }
}

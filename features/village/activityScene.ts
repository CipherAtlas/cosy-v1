import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { PlaceId } from "./places";
import type { ActivityMoment, Collider } from "./environment";
import { makeDeskQuill, makeFocusHourglass } from "./focusCottageProps";

import { ACTIVITY_STAGES } from "./sharedActors";
export { ACTIVITY_STAGES } from "./sharedActors";

export function makeKindNote() {
  const root = new T.Group(), flap = new T.Group(), sheet = new T.Group();
  root.name = "Kind note and envelope";
  const cream = new T.MeshStandardMaterial({ color: "#f4dfb5", roughness: .95, side: T.DoubleSide });
  const paper = new T.MeshStandardMaterial({ color: "#fff6df", roughness: .95 });
  const ink = new T.MeshStandardMaterial({ color: "#8a9b87", roughness: 1 });
  const seal = new T.MeshStandardMaterial({ color: "#c57a68", roughness: .85 });
  const box = (parent: T.Group, material: T.Material, x: number, y: number, z: number, w: number, h: number, d: number) => {
    const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh);
    return mesh;
  };
  box(root, cream, 0, 0, -.018, .58, .24, .012);
  flap.position.set(0, .12, -.024); root.add(flap);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute([-.29, 0, 0, .29, 0, 0, 0, -.19, 0], 3));
  geometry.computeVertexNormals(); flap.add(new T.Mesh(geometry, cream));
  root.add(sheet);
  box(sheet, paper, 0, .015, 0, .48, .31, .008);
  // Ink on both faces keeps the small sheet readable while orbiting the activity.
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    box(sheet, ink, i === 3 ? -.055 : 0, .115 - i * .045, side * .006, i === 3 ? .22 : .33, .007, .002);
  }
  box(root, cream, 0, -.015, .018, .58, .21, .012);
  const stamp = new T.Mesh(new T.CylinderGeometry(.033, .033, .01, 16), seal);
  stamp.rotation.x = Math.PI / 2; stamp.position.set(0, -.02, .033); root.add(stamp);
  sheet.position.y = .13; flap.rotation.x = Math.PI * .86;
  return { root, flap, sheet };
}

export class VillageActivities {
  readonly outdoor = new T.Group();
  readonly indoor = new T.Group();
  private moment: ActivityMoment = { kind:"focus",running:false,progress:0 };
  private changedAt = 0;
  private enteredAt = 0;
  private time = 0;
  private breathAmount = 0;
  private cup = new T.Group();
  private steam: T.Mesh[] = [];
  private mintLeaves = new T.Group();
  private teaLiquid = new T.MeshStandardMaterial({color:"#966027",roughness:.22});
  private quill = new T.Group();
  private deskQuill = new T.Group();
  private letter = new T.Group();
  private letterFlap = new T.Group();
  private letterPaper = new T.Group();
  private readingFins: { fin: T.Object3D; position: T.Vector3; rotation: T.Euler }[] = [];
  private page = new T.Group();
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
    // Tea has thickness, a handle, liquid and steam; it rises when the visitor drinks it.
    this.cup.position.set(15.2,1.28,-9.65);this.outdoor.add(this.cup);
    add(this.cup,new T.CylinderGeometry(.23,.22,.035,24),paper,0,0,0);
    add(this.cup,new T.LatheGeometry([new T.Vector2(.12,.035),new T.Vector2(.14,.08),new T.Vector2(.17,.27),new T.Vector2(.145,.27),new T.Vector2(.125,.09)],24),ink,0,0,0);
    add(this.cup,new T.CylinderGeometry(.143,.143,.008,24),this.teaLiquid,0,.238,0);
    const leafMaterial = new T.MeshStandardMaterial({ color: "#79a84c", roughness: .85 });
    for (const angle of [-.5, .7]) { const leaf = add(this.mintLeaves, new T.SphereGeometry(.05, 10, 6), leafMaterial, angle * .055, .247, 0); leaf.scale.set(.65, .06, 1.4); leaf.rotation.y = angle; }
    this.mintLeaves.visible = false; this.cup.add(this.mintLeaves);
    add(this.cup,new T.TorusGeometry(.085,.02,8,18),ink,.18,.16,0);
    for(let i=0;i<3;i++) {
      const path=new T.CatmullRomCurve3([new T.Vector3(0,0,0),new T.Vector3(.035,.1,0),new T.Vector3(-.03,.23,0),new T.Vector3(.025,.4,0)]);
      const m=new T.MeshBasicMaterial({color:"#fff5d9",transparent:true,opacity:.18,depthWrite:false});
      const steam=add(this.cup,new T.TubeGeometry(path,14,.008,5,false),m,(i-1)*.07,.28,0);steam.castShadow=steam.receiveShadow=false;this.steam.push(steam);
    }
    const note = makeKindNote();
    this.letter = note.root; this.letterFlap = note.flap; this.letterPaper = note.sheet;
    this.letter.visible = false; this.outdoor.add(this.letter);
    // The timer and quill remain separate so focus progress can move the sand and feather.
    const timer = makeFocusHourglass();
    timer.hourglass.position.set(107.7, 1.1, -2.12); this.indoor.add(timer.hourglass);
    this.sandTop = timer.topSand; this.sandBottom = timer.bottomSand; this.sandStream = timer.stream;
    this.deskQuill.position.set(108.85, 1.16, -1.8);
    this.deskQuill.add(makeDeskQuill()); this.indoor.add(this.deskQuill);
    for(let i=0;i<3;i++) {
      const m=new T.MeshBasicMaterial({color:i===0?"#d8fff1":"#97ddd1",transparent:true,opacity:.45,side:T.DoubleSide,depthWrite:false});
      const ring=add(this.outdoor,new T.RingGeometry(.94,1,80),m,-25,-.24,-9);ring.rotation.x=-Math.PI/2;ring.castShadow=ring.receiveShadow=false;ring.visible=false;this.rings.push(ring);
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
  setMintTea(ready: boolean) { this.mintLeaves.visible = ready; this.teaLiquid.color.set(ready ? "#a6b850" : "#966027"); }
  setMoment(moment:ActivityMoment) {this.moment=moment;this.changedAt=this.time;}
  enter(place:PlaceId|null) {
    this.indoor.visible=place==="focus";
    this.rings.forEach(r=>r.visible=place==="breathe");
    this.motes.visible=place==="music";
    this.page.visible=false;
    this.letter.visible=place==="compliment";
    this.enteredAt=this.time;
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
    this.cup.position.set(T.MathUtils.lerp(15.2,14.4,sip),1.28+sip*.18,T.MathUtils.lerp(-9.65,-10,sip));
    this.cup.rotation.z=sip*.22;
    player.rotation.z = 0;
    const writing=!reduced&&place==="gratitude"&&moment.kind==="write"&&age<1.8;
    this.quill.rotation.z=writing?Math.sin(t*15)*.12:0;this.quill.position.x=.26+(writing?Math.sin(t*4)*.07:0);
    const save=!reduced&&place==="gratitude"&&moment.kind==="save"&&age<1.4;
    this.page.visible=save;this.page.position.y=1.02+(save?Math.sin(age/1.4*Math.PI)*.38:0);this.page.rotation.z=save?Math.sin(age*3)*.12:0;
    const reading=place==="compliment";
    this.letter.visible=reading;
    if(!reading&&this.readingFins.length) {
      this.readingFins.forEach(({fin,position,rotation})=>{fin.position.copy(position);fin.rotation.copy(rotation);});
      this.readingFins=[];
    }
    const open=reduced?1:T.MathUtils.smootherstep(time-this.enteredAt,0,1.1);
    const keeping=reading&&moment.kind==="keep"&&!reduced?Math.sin(Math.min(1,age/1.2)*Math.PI):0;
    const turning=reading&&moment.kind==="letter"&&!reduced?Math.sin(Math.min(1,age/.85)*Math.PI):0;
    this.letterFlap.rotation.x=open*Math.PI*.86;
    this.letterPaper.position.y=open*.13-turning*.07;
    this.letterPaper.rotation.z=turning*-.06;
    this.letter.scale.setScalar(1);
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
    if(reading) {
      // Parent to the reader so an accepted shared position also carries the note.
      if(this.letter.parent!==player)player.add(this.letter);
      const bob=reduced?0:Math.sin(t*1.7)*.012;
      this.letter.position.set(0,.74+bob+open*.04-keeping*.035,.42);
      this.letter.rotation.set(-.22-keeping*.12,0,reduced?0:Math.sin(t*1.4)*.015);
      if(character&&!this.readingFins.length) character.traverse(fin=>{
        if(fin.name.startsWith("SpiritFin"))this.readingFins.push({fin,position:fin.position.clone(),rotation:fin.rotation.clone()});
      });
      this.readingFins.forEach(({fin})=>{
        const side=fin.name.endsWith("L")?-1:1;
        fin.position.set(side*.31/scale,(.2+bob-keeping*.035)/scale,.35/scale);
        fin.rotation.set(0,side*-.3,-side*.18);
      });
    } else if(this.letter.parent!==this.outdoor) this.outdoor.add(this.letter);
    if(character) {
      const bob=reduced?0:Math.sin(t*1.7)*.025;
      character.position.y=.62+bob+(place==="breathe"&&!reduced?breath*.12:0);
      character.rotation.x=reading?-.06:(place==="focus"||writing) ? .07 : 0;
      character.rotation.z=reduced?0:place==="music"&&playing?Math.sin(t*1.8)*.045:0;
      const expansion=place==="breathe"&&!reduced?1+breath*.065:1;
      character.scale.set(scale*expansion,scale*expansion,scale*expansion);
    }
  }
}

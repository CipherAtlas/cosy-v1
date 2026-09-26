import * as T from "three";
import { VillageMovement } from "./movement";
import { type Collider } from "./environment";
import { VILLAGERS } from "./dialogue";

/** A few residents on authored safe routes, and an economical flock over the valley. */
export class VillageLife {
  readonly group = new T.Group();
  readonly residents: {
    root: T.Object3D; spirit: T.Object3D; fins: T.Object3D[]; phase: number;
    movement: VillageMovement; route: [number, number][]; waypoint: number; pause: number; walking: boolean; chatting: boolean;
    encounter: {
      state: "roam" | "approach" | "visit" | "return";
      path: [number, number][]; time: number; noticed: boolean; cooldown: number; checkIn: number;
    };
    pace: number;
  }[] = [];
  private bodies: T.InstancedMesh;
  private leftWings: T.InstancedMesh;
  private rightWings: T.InstancedMesh;
  private bird = new T.Object3D();
  private wing = new T.Object3D();
  private approachScan = 0;

  constructor(source: T.Object3D, colliders: Collider[]) {
    const routes: [number, number][][] = [
      // Cottage lane and the entrance meadow.
      [[1.4, 7], [3.8, 10.8], [4.7, 13.5], [3.8, 19], [1.8, 30], [-.7, 28], [-.8, 18], [-.6, 7]],
      // Cross the bridge, visit the pond approach, then return to the cottages.
      [[-5, 3], [-17.8, 3], [-19, 0], [-19, -6], [-18, -7], [-18, 0], [-17.8, 3],
        [-5, 3], [-1.5, 4], [2.8, 6], [3.8, 10.8], [1.3, 10], [-1.5, 4]],
      // Northern lane and the riverside verge, outside the hearth seating.
      [[-.7, -8], [-.6, -16], [.1, -24], [1, -31], [-1.2, -32], [-2.5, -25],
        [-2.8, -22], [-3.2, -15], [-5, -13], [-5, -8]],
      // Tea garden, central junction and the open garden perimeter.
      [[13.8, -6.8], [12.8, -7.5], [9, -7.8], [6.5, -7.8], [4, -3], [.5, 1],
        [-1.2, -3], [-.8, -9], [4, -10], [8, -10], [12, -14.5], [18, -14.5], [19, -7.5], [17, -5.8]],
    ];
    routes.forEach((route, i) => {
      const root = source.clone(true);
      root.name = `${VILLAGERS[i].name.en} spirit`;
      root.position.y = .55;
      const fins: T.Object3D[] = [], materials = new Map<T.Material, T.Material>();
      root.traverse(node => {
        if (node.name.startsWith("SpiritFin")) fins.push(node);
        if (!(node instanceof T.Mesh)) return;
        const tint = (material: T.Material) => {
          if (materials.has(material)) return materials.get(material)!;
          const copy = material.clone();
          if (copy instanceof T.MeshStandardMaterial && material.name === "Pearl white spirit") {
            copy.color.set(VILLAGERS[i].color); copy.emissive.copy(copy.color); copy.emissiveIntensity = .09;
          }
          materials.set(material, copy); return copy;
        };
        node.material = Array.isArray(node.material) ? node.material.map(tint) : tint(node.material);
      });
      this.dressSpirit(root, i);
      const actor = new T.Group(); actor.add(root); actor.scale.setScalar([.96,1.07,.92,1][i]);
      const movement = new VillageMovement(colliders, () => {});
      movement.settle(...route[0]);
      actor.position.set(movement.position.x, movement.position.y, movement.position.z);
      this.group.add(actor);
      actor.name = VILLAGERS[i].name.en;
      this.residents.push({ root: actor, spirit: root, fins, phase: i * 1.7, movement, route, waypoint: route.length > 1 ? 1 : 0,
        pause: i * 2, walking: false, chatting: false, pace: [.48, .4, .34, .38][i],
        encounter: { state: "roam", path: [], time: 0, noticed: false, cooldown: 0, checkIn: 0 } });
    });
    const material = new T.MeshStandardMaterial({ color: "#343f40", roughness: 1, side: T.DoubleSide });
    const body = new T.SphereGeometry(.12, 8, 4); body.scale(.7, .7, 2);
    const wing = new T.BufferGeometry();
    wing.setAttribute("position", new T.Float32BufferAttribute([0, 0, -.08, .64, 0, .12, .36, 0, -.19, 0, 0, .12], 3));
    wing.setIndex([0, 1, 2, 0, 3, 1]); wing.computeVertexNormals();
    this.bodies = new T.InstancedMesh(body, material, 12);
    this.leftWings = new T.InstancedMesh(wing, material, 12);
    this.rightWings = new T.InstancedMesh(wing, material, 12);
    for (const mesh of [this.bodies, this.leftWings, this.rightWings]) {
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.frustumCulled = false; this.group.add(mesh);
    }
  }
  update(delta: number, elapsed: number, player: T.Vector3, reduced: boolean, canApproach = true) {
    this.approachScan -= delta;
    if (canApproach && this.approachScan <= 0) {
      this.approachScan = .4;
      if (!this.residents.some(r => r.encounter.state === "approach" || r.encounter.state === "visit" || r.chatting)) {
        const nearby = this.residents.filter(r => r.encounter.state === "roam" && !r.encounter.noticed
          && r.encounter.cooldown === 0 && r.root.position.distanceTo(player) < 6)
          .sort((a, b) => a.root.position.distanceToSquared(player) - b.root.position.distanceToSquared(player));
        const r = nearby.find(r => r.movement.canWalkTo(player.x, player.z));
        if (r) {
          r.encounter.state = "approach";
          r.encounter.noticed = true;
          r.encounter.time = 0;
          r.encounter.checkIn = .4;
          r.encounter.path = [[r.movement.position.x, r.movement.position.z]];
        }
      }
    }
    for (const r of this.residents) {
      const encounter = r.encounter;
      const distance = Math.hypot(player.x - r.movement.position.x, player.z - r.movement.position.z);
      encounter.cooldown = Math.max(0, encounter.cooldown - delta);
      if (distance > 9) encounter.noticed = false;
      encounter.time += delta;
      if (encounter.state === "approach" || encounter.state === "visit") {
        encounter.checkIn -= delta;
        const origin = encounter.path[0];
        const tooFar = Math.hypot(player.x - origin[0], player.z - origin[1]) > 8;
        const obstructed = encounter.state === "approach" && encounter.checkIn <= 0 && !r.movement.canWalkTo(player.x, player.z);
        if (encounter.checkIn <= 0) encounter.checkIn = .4;
        if (!canApproach || tooFar || obstructed || (encounter.state === "approach" && encounter.time > 10)
          || (encounter.state === "visit" && (distance > 4.5 || (encounter.time > 8 && !r.chatting)))) {
          encounter.state = "return";
          encounter.cooldown = 15;
          r.chatting = false;
        } else if (encounter.state === "approach" && (distance <= 2.2 || r.chatting)) {
          encounter.state = "visit";
          encounter.time = 0;
        }
      }
      if (encounter.state === "return") {
        const last = encounter.path.at(-1);
        if (last && Math.hypot(last[0] - r.movement.position.x, last[1] - r.movement.position.z) < .2) encounter.path.pop();
        if (!encounter.path.length) { encounter.state = "roam"; r.pause = 2; }
      }
      if (encounter.state === "roam") r.pause = Math.max(0, r.pause - delta);
      const target = encounter.state === "approach" ? [player.x, player.z]
        : encounter.state === "return" ? encounter.path.at(-1)! : r.route[r.waypoint];
      const dx = target[0] - r.movement.position.x, dz = target[1] - r.movement.position.z;
      const length = Math.hypot(dx, dz);
      if (encounter.state === "roam" && length < .3 && r.route.length > 1) {
        // Rest twice per circuit; intermediate waypoints guide turns without repeated stops.
        r.pause = r.waypoint === 0 || r.waypoint === Math.floor(r.route.length / 2) ? 4.5 : 0;
        r.waypoint = (r.waypoint + 1) % r.route.length;
      }
      const moving = !r.chatting && distance > 1.2 && (encounter.state === "approach" || (encounter.state === "return" && length >= .2)
        || (encounter.state === "roam" && r.route.length > 1 && r.pause === 0 && length > .3));
      const pace = encounter.state === "approach" ? r.pace : .43;
      r.movement.update(delta, { x: moving ? dx / length * pace : 0, z: moving ? dz / length * pace : 0, run: false, sprint: false, blocked: false });
      r.root.position.set(r.movement.position.x, r.movement.position.y, r.movement.position.z);
      if (encounter.state === "approach") {
        const last = encounter.path.at(-1)!;
        if (Math.hypot(r.root.position.x - last[0], r.root.position.z - last[1]) >= .4)
          encounter.path.push([r.root.position.x, r.root.position.z]);
      }
      if (moving || r.chatting || encounter.state === "visit") {
        const angle = r.chatting || encounter.state === "visit" ? Math.atan2(player.x - r.root.position.x, player.z - r.root.position.z) : Math.atan2(dx, dz);
        const turn = T.MathUtils.euclideanModulo(angle - r.root.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
        r.root.rotation.y += turn * (1 - Math.exp(-delta * 4));
      }
      const walking = r.movement.speed > .1;
      r.walking = walking;
      r.spirit.position.y = .55 + (reduced ? 0 : Math.sin(elapsed * 2.5 + r.phase) * .065);
      r.spirit.rotation.x = reduced ? 0 : r.movement.speed * .035;
      r.spirit.rotation.z = reduced ? 0 : Math.sin(elapsed * 1.6 + r.phase) * .035;
      r.fins.forEach((fin, i) => { fin.rotation.z = reduced ? 0 : Math.sin(elapsed * (walking ? 7 : 3) + r.phase + i * Math.PI) * .18; });

    }
    const t = reduced ? 0 : elapsed;
    for (let i = 0; i < 12; i++) {
      const a = t * .1 + i * .13 + Math.floor(i / 6) * Math.PI;
      this.bird.position.set(-10 + Math.sin(a) * (22 + i * .5), 10 + i * .55 + Math.sin(a * 2) * 1.4, -4 + Math.cos(a) * 26);
      this.bird.rotation.set(0, Math.atan2(Math.cos(a) * 23, -Math.sin(a) * 26), -.12 * Math.cos(a));
      this.bird.updateMatrix(); this.bodies.setMatrixAt(i, this.bird.matrix);
      const flap = Math.sin(t * 9 + i * 1.3) * .6;
      for (const side of [-1, 1]) {
        this.wing.position.set(0, 0, 0); this.wing.rotation.set(0, 0, side * flap);
        this.wing.scale.set(side, 1, 1); this.wing.updateMatrix();
        (side === -1 ? this.leftWings : this.rightWings).setMatrixAt(i, this.wing.matrix.premultiply(this.bird.matrix));
      }
    }
    for (const mesh of [this.bodies, this.leftWings, this.rightWings]) mesh.instanceMatrix.needsUpdate = true;
  }
  private dressSpirit(root: T.Object3D, index: number) {
    const cream = new T.MeshStandardMaterial({ color: "#fff2d1", roughness: .75 });
    const gold = new T.MeshStandardMaterial({ color: "#ffd36f", roughness: .55 });
    const accent = new T.MeshStandardMaterial({ color: ["#318c9b", "#de8e9b", "#6f9d52", "#7772b5"][index], roughness: .8 });
    const sphere = new T.SphereGeometry(1, 16, 10);
    const add = (geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z: number, sx=1, sy=1, sz=1) => {
      const mesh = new T.Mesh(geometry, material); mesh.position.set(x,y,z); mesh.scale.set(sx,sy,sz);
      mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return mesh;
    };
    const star = new T.Shape();
    for (let i=0;i<10;i++) { const a=i*Math.PI/5+Math.PI/2, r=i%2?.042:.09; if(i===0)star.moveTo(Math.cos(a)*r,Math.sin(a)*r);else star.lineTo(Math.cos(a)*r,Math.sin(a)*r); }
    star.closePath();
    const starGeometry = new T.ExtrudeGeometry(star,{depth:.025,bevelEnabled:false});
    if (index === 0) {
      add(new T.TorusGeometry(.33,.055,8,32),accent,0,.27,0).rotation.x=Math.PI/2;
      add(sphere,accent,.22,.25,.275,.1,.16,.06);
      add(starGeometry,gold,.22,.26,.335);
      add(sphere,cream,-.27,.29,.26,.08,.08,.04);
    } else if (index === 1) {
      add(new T.CylinderGeometry(.22,.23,.09,24),accent,0,1.005,0);
      for (let i=0;i<4;i++) add(sphere,cream,Math.cos(i*Math.PI/2)*.125,1.13,Math.sin(i*Math.PI/2)*.09,.16,.125,.14);
      add(sphere,accent,-.16,.29,.29,.1,.055,.035).rotation.z=-.25;
      add(sphere,accent,.02,.29,.31,.1,.055,.035).rotation.z=.25;
      add(sphere,gold,-.065,.29,.335,.04,.04,.025);
    } else if (index === 2) {
      add(new T.CylinderGeometry(.018,.025,.19,8),accent,.06,1.07,0).rotation.z=-.2;
      for(const side of [-1,1]) add(sphere,accent,.06+side*.105,1.15,.02,.15,.045,.075).rotation.z=side*.4;
      add(sphere,cream,.17,.3,.3,.105,.11,.045);
      add(starGeometry,gold,.17,.31,.35).scale.setScalar(.55);
    } else {
      const crescent = new T.Shape();
      crescent.absarc(0,0,.15,Math.PI*.32,Math.PI*1.68,false);
      crescent.absarc(.082,0,.133,-Math.PI*.56,Math.PI*.56,true);crescent.closePath();
      add(new T.ExtrudeGeometry(crescent,{depth:.025,bevelEnabled:false}),gold,0,1.06,.05).rotation.z=-.35;
      add(new T.TorusGeometry(.33,.047,8,32),accent,0,.27,0).rotation.x=Math.PI/2;
      add(starGeometry,gold,0,.3,.345);
    }
  }
  dispose() { this.residents.forEach(r => r.chatting = false); }
}

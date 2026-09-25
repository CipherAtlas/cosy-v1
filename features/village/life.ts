import * as T from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { VillageMovement } from "./movement";
import { roadX, type Collider } from "./environment";
import { VILLAGERS } from "./dialogue";

/** A few residents on authored safe routes, and an economical flock over the valley. */
export class VillageLife {
  readonly group = new T.Group();
  readonly residents: {
    root: T.Object3D; mixer: T.AnimationMixer; walk: T.AnimationAction; idle: T.AnimationAction;
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

  constructor(source: T.Object3D, clips: T.AnimationClip[], colliders: Collider[]) {
    const routes: [number, number][][] = [
      [[roadX(7) + .7, 7], [roadX(26) + .7, 26]],
      [[-5, 3], [-19, 3]],
      [[roadX(-8) - .7, -8], [roadX(-29) - .7, -29]],
      [[13.8, -6.8]],
    ];
    routes.forEach((route, i) => {
      const root = clone(source);
      root.traverse(node => {
        if (!(node instanceof T.Mesh)) return;
        const tint = (material: T.Material) => {
          const m = material.clone();
          if (m instanceof T.MeshStandardMaterial && /Moss|Terracotta|Olive/.test(m.name)) {
            m.map = null; m.color.set(VILLAGERS[i].color);
            if (/Terracotta/.test(m.name)) m.color.set("#c1ad87");
          }
          return m;
        };
        node.material = Array.isArray(node.material) ? node.material.map(tint) : tint(node.material);
      });
      const actor = new T.Group(); actor.add(root); actor.scale.setScalar(.93 + i * .025);
      const mixer = new T.AnimationMixer(root);
      const walk = mixer.clipAction(clips.find(c => c.name === "Walk")!);
      const idle = mixer.clipAction(clips.find(c => c.name === "Idle")!); idle.play();
      const movement = new VillageMovement(colliders, () => {});
      movement.settle(...route[0]);
      actor.position.set(movement.position.x, movement.position.y, movement.position.z);
      this.group.add(actor);
      actor.name = VILLAGERS[i].name.en;
      this.residents.push({ root: actor, mixer, walk, idle, movement, route, waypoint: route.length > 1 ? 1 : 0,
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
      if (encounter.state === "roam" && length < .3 && r.route.length > 1) { r.waypoint = (r.waypoint + 1) % r.route.length; r.pause = 4.5; }
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
      if (walking !== r.walking) {
        (walking ? r.idle : r.walk).fadeOut(.3);
        (walking ? r.walk : r.idle).reset().fadeIn(.3).play(); r.walking = walking;
      }
      r.mixer.update(delta);
      if (walking) { r.walk.time = (r.movement.phase % 1) * r.walk.getClip().duration; r.mixer.update(0); }
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
  dispose() { this.residents.forEach(r => r.mixer.stopAllAction()); }
}

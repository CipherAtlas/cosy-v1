import * as T from "three";

export type CottageCatStatus = "away" | "asking" | "petting";

/** Private cottage routine. All positions are local to the room, not the shared world. */
export class CottageCat {
  readonly root: T.Object3D;
  private body: T.Object3D;
  private head: T.Object3D;
  private tail: T.Object3D;
  private legs: T.Object3D[];
  private eyes: T.Object3D[];
  private bodyRest: T.Vector3;
  private headRest: T.Quaternion;
  private state: "rest" | "walk" | "stretch" | "nap" | "up" | "ask" | "pet" | "down" = "nap";
  private age = 0;
  private wait = 14;
  private visits = 0;
  private naps = 1;
  private strolls = 0;
  private destination: "floor" | "desk" | "bed" = "floor";
  private active = false;
  private from = new T.Vector3();
  private target = new T.Vector3();
  private desk = new T.Vector3(-.48, 1.08, -1.69);
  private landing = new T.Vector3(1.55, 0, -1.15);
  private bed = new T.Vector3(.5, .12, -.3);
  private legRest: T.Vector3[];
  private status: CottageCatStatus = "away";
  private points = [[1.6, -1.15], [2.4, -1.1], [2.3, .7], [1.55, .75]];

  constructor(model: T.Object3D, private changed: (status: CottageCatStatus) => void, private random = Math.random) {
    this.root = model;
    const part = (name: string) => {
      const node = model.getObjectByName(name);
      if (!node) throw Error(`Missing cottage cat part: ${name}`);
      return node;
    };
    this.body = part("CatBody"); this.head = part("CatHead"); this.tail = part("CatTail");
    this.legs = ["CatFrontLeft", "CatFrontRight", "CatBackLeft", "CatBackRight"].map(part);
    this.eyes = ["CatEyeLeft", "CatEyeRight"].map(part);
    this.legRest = this.legs.map(leg => leg.position.clone());
    this.bodyRest = this.body.position.clone(); this.headRest = this.head.quaternion.clone();
    this.root.position.copy(this.bed); this.root.rotation.y = -.85;
    this.root.traverse(node => { if (node instanceof T.Mesh) node.castShadow = node.receiveShadow = true; });
  }
  enter(active: boolean) {
    this.active = active;
    this.setStatus(active && this.state === "ask" ? "asking" : active && this.state === "pet" ? "petting" : "away");
  }
  private setStatus(status: CottageCatStatus) {
    if (this.status === status) return;
    this.status = status; this.changed(status);
  }
  private begin(state: typeof this.state, duration: number) {
    this.state = state; this.age = 0; this.wait = duration;
    this.from.copy(this.root.position);
    this.setStatus(state === "ask" ? "asking" : state === "pet" ? "petting" : "away");
  }
  pet() {
    if (!this.active || this.state !== "ask") return false;
    this.begin("pet", 3.2); return true;
  }
  get petting() { return this.active && this.state === "pet"; }
  get petAge() { return this.age; }
  petTarget(target: T.Vector3) { this.head.getWorldPosition(target); return target; }
  update(dt: number, time: number, reduced: boolean) {
    if (!this.active) return;
    this.age += dt;
    this.body.position.copy(this.bodyRest); this.body.scale.set(1, 1, 1); this.body.rotation.set(0, 0, 0);
    this.head.quaternion.copy(this.headRest); this.tail.rotation.set(0, 0, 0);
    this.legs.forEach((leg, i) => { leg.position.copy(this.legRest[i]); leg.rotation.set(0, 0, 0); leg.scale.set(1, 1, 1); });
    this.eyes.forEach(eye => eye.scale.y = 1);
    if (reduced) {
      // Keep the invitation available without ambient walking, jumps or stretch motion.
      if (this.state !== "ask" && this.state !== "pet" && this.state !== "nap") {
        this.root.position.copy(this.desk); this.root.rotation.y = -.7; this.begin("ask", 30);
      }
      if (this.state === "nap") {
        this.sleepPose(0);
        if (this.age >= this.wait) { this.root.position.copy(this.desk); this.root.rotation.y = -.7; this.begin("ask", 30); }
      }
      if (this.state === "pet" && this.age >= this.wait) this.begin("ask", 30);
      if (this.state === "ask" && this.age >= this.wait) { this.root.position.copy(this.bed); this.root.rotation.y = -.85; this.begin("nap", 45); }
      this.eyes.forEach(eye => eye.scale.y = this.state === "pet" || this.state === "nap" ? .08 : 1);
      return;
    }
    const blink = time % 6.7;
    this.eyes.forEach(eye => eye.scale.y = this.state === "pet" ? .18 : blink > 6.48 ? .15 : 1);
    this.tail.rotation.z = Math.sin(time * 1.4) * .09;
    this.body.scale.y = 1 + Math.sin(time * 2) * .012;
    if (this.state === "walk") {
      const distance = this.root.position.distanceTo(this.target);
      this.root.position.lerp(this.target, Math.min(1, dt * .48 / Math.max(.001, distance)));
      const heading = Math.atan2(this.target.x - this.root.position.x, this.target.z - this.root.position.z);
      const turn = heading - this.root.rotation.y;
      this.root.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, dt * 7);
      this.legs.forEach((leg, i) => leg.rotation.x = Math.sin(this.age * 8 + (i === 0 || i === 3 ? 0 : Math.PI)) * .38);
      this.body.position.y += Math.cos(this.age * 16) * .008;
      if (distance < .025) {
        if (this.destination === "desk") { this.root.position.copy(this.landing); this.begin("up", 1.1); }
        else if (this.destination === "bed") { this.root.position.copy(this.bed); this.root.rotation.y = -.85; this.naps++; this.begin("nap", 40 + this.random() * 30); }
        else this.begin("rest", 2 + this.random() * 3);
        this.destination = "floor";
      }
    } else if (this.state === "nap") {
      this.sleepPose(Math.sin(time * 1.5) * .007);
      if (this.age >= this.wait) this.begin("stretch", 3.8);
    } else if (this.state === "stretch") {
      const stretch = Math.sin(Math.min(1, this.age / this.wait) * Math.PI) ** 2;
      this.body.scale.z = 1 + stretch * .24; this.body.rotation.x = stretch * .24;
      this.head.rotation.x += stretch * .18;
      this.legs.slice(0, 2).forEach(leg => { leg.rotation.x = -.5 * stretch; });
      this.tail.rotation.x = stretch * -.35;
      if (this.age >= this.wait) this.begin("rest", 3 + this.random() * 4);
    } else if (this.state === "up" || this.state === "down") {
      const p = Math.min(1, this.age / this.wait), eased = T.MathUtils.smoothstep(p, 0, 1);
      this.root.position.lerpVectors(this.from, this.state === "up" ? this.desk : this.landing, eased);
      this.root.position.y += Math.sin(Math.PI * p) * .42;
      this.root.rotation.y = -.7;
      this.legs.forEach(leg => leg.rotation.x = Math.sin(Math.PI * p) * -.65);
      if (p === 1) this.begin(this.state === "up" ? "ask" : "rest", this.state === "up" ? 24 : 8 + this.random() * 8);
    } else if (this.state === "ask" || this.state === "pet") {
      this.head.rotation.x -= .12;
      this.head.rotation.z = Math.sin(time * 1.2) * (this.state === "pet" ? .14 : .025);
      if (this.state === "pet") this.body.position.y += Math.sin(this.age * 5) * .015;
      if (this.age >= this.wait) {
        if (this.state === "pet") this.begin("ask", 16);
        else { this.visits++; this.begin("down", .9); }
      }
    } else if (this.age >= this.wait) {
      // First arrival is prompt; subsequent desk visits follow varied, bounded floor routines.
      if (!this.visits || this.strolls >= 3) {
        this.destination = this.visits >= this.naps ? "bed" : "desk";
        this.target.copy(this.destination === "bed" ? this.bed : this.landing);
        this.strolls = 0; this.begin("walk", 0);
      } else if (this.random() < .38) { this.strolls++; this.begin("stretch", 3.8); }
      else {
        const point = this.points[Math.floor(this.random() * this.points.length)];
        this.target.set(point[0], 0, point[1]); this.strolls++; this.begin("walk", 0);
      }
    }
  }
  private sleepPose(breath: number) {
    this.body.position.y = this.bodyRest.y - .12 + breath;
    this.body.scale.set(1.15, .72, .94);
    this.head.rotation.x += .32; this.head.rotation.z = -.2;
    this.legs.forEach(leg => { leg.position.y -= .16; leg.scale.y = .38; leg.rotation.x = -.25; });
    this.tail.rotation.set(.95, -.8, -.4);
    this.eyes.forEach(eye => eye.scale.y = .06);
  }
}

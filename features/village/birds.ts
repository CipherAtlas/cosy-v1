import * as T from "three";
import { BIRD_CLEARING } from "./environment";

export type BirdStatus = "flying" | "crumbs" | "waiting" | "eating" | "happy";
export const BIRD_THANKS = { en: "Coo coo~ (Thank you~)", ja: "クークー〜（ありがとう〜）" };

/** One flock, with continuous takeoff/circuit/landing and one meal per visit. */
export class BirdFlock {
  readonly group = new T.Group();
  readonly birds: { root: T.Object3D; head: T.Object3D; wings: T.Object3D[]; landing: T.Vector3 }[] = [];
  status: BirdStatus = "flying";
  private phase: "flight" | "ground" = "flight";
  private age = 0;
  private mealAge = -1;
  private queued = false;
  private served = false;
  private lastStatus?: BirdStatus;
  private parts: { mesh: T.InstancedMesh; nodes: T.Object3D[] }[] = [];
  private hearts: T.InstancedMesh;
  private crumbs: T.InstancedMesh;
  private dummy = new T.Object3D();
  private next = new T.Vector3();
  private bubble = document.createElement("div");
  private projected = new T.Vector3();
  private language: "en" | "ja" = "en";
  private announce = false;
  private width = 0;
  private height = 0;

  constructor(source: T.Object3D, host: HTMLElement, private changed: (status: BirdStatus) => void,
    private fed: (byCaretaker: boolean) => void) {
    this.group.name = "White dove flock";
    const template = source.getObjectByName("Dove");
    if (!template) throw new Error("The dove asset is missing its named root.");
    for (let i = 0; i < 12; i++) {
      const root = template.clone(true);
      const angle = i * Math.PI * 2 / 12, radius = i % 2 ? 1.8 : 1.05;
      this.birds.push({ root, head: root.getObjectByName("DoveHead")!,
        wings: [root.getObjectByName("DoveWingLeft")!, root.getObjectByName("DoveWingRight")!],
        landing: new T.Vector3(BIRD_CLEARING.x + Math.cos(angle) * radius, .13, BIRD_CLEARING.z + Math.sin(angle) * radius) });
    }
    template.traverse(node => {
      if (!(node instanceof T.Mesh)) return;
      const mesh = new T.InstancedMesh(node.geometry, node.material, this.birds.length);
      mesh.name = node.name; mesh.castShadow = mesh.receiveShadow = true;
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.frustumCulled = false;
      this.parts.push({ mesh, nodes: this.birds.map(b => b.root.getObjectByName(node.name)!) }); this.group.add(mesh);
    });
    const heart = new T.Shape(); heart.moveTo(0, -.48);
    heart.bezierCurveTo(-.15, -.3, -.55, -.05, -.5, .23); heart.bezierCurveTo(-.45, .55, -.1, .56, 0, .3);
    heart.bezierCurveTo(.1, .56, .45, .55, .5, .23); heart.bezierCurveTo(.55, -.05, .15, -.3, 0, -.48);
    this.hearts = new T.InstancedMesh(new T.ShapeGeometry(heart, 12), new T.MeshBasicMaterial({ color: "#ff9aab", side: T.DoubleSide, depthWrite: false }), 12);
    this.hearts.name = "Happy dove hearts";
    this.crumbs = new T.InstancedMesh(new T.IcosahedronGeometry(.038, 0), new T.MeshStandardMaterial({ color: "#edc693", roughness: 1 }), 36);
    this.crumbs.name = "Sourdough crumbs";
    for (const mesh of [this.hearts, this.crumbs]) {
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.frustumCulled = false; mesh.visible = false; this.group.add(mesh);
    }
    this.bubble.className = "v-bird-bubble"; this.bubble.hidden = true;
    this.bubble.setAttribute("role", "status"); this.bubble.setAttribute("aria-live", "polite");
    host.append(this.bubble);
  }

  setLanguage(language: "en" | "ja") { this.language = language; this.bubble.lang = language; }
  resize(width: number, height: number) { this.width = width; this.height = height; }
  feed() {
    if (this.queued || this.served) return false;
    this.queued = true;
    if (this.phase === "ground") this.startMeal(false);
    this.publish();
    return true;
  }
  private startMeal(caretaker: boolean) {
    this.queued = false; this.served = true; this.mealAge = 0; this.fed(caretaker);
  }
  private publish() {
    this.status = this.mealAge >= 4 ? "happy" : this.mealAge >= 0 ? "eating"
      : this.queued ? "crumbs" : this.phase === "flight" ? "flying" : "waiting";
    if (this.status !== this.lastStatus) { this.lastStatus = this.status; this.changed(this.status); }
  }
  private flightPosition(index: number, age: number, target: T.Vector3) {
    const bird = this.birds[index], t = T.MathUtils.clamp(age / 30, 0, 1);
    const angle = t * Math.PI * 2;
    // The circuit starts and ends exactly on this bird's own landing spot.
    const lift = T.MathUtils.smoothstep(age, 0, 4) * (1 - T.MathUtils.smoothstep(age, 26, 30));
    target.copy(bird.landing);
    target.x += Math.sin(angle) * (17 + index * .22);
    target.z += (1 - Math.cos(angle)) * (21 + index * .18);
    target.y += lift * (12 + (index % 3) * .65);
    return target;
  }
  update(dt: number, time: number, reduced: boolean, camera: T.Camera, player: T.Vector3, caretaker: boolean, visible: boolean) {
    this.age += dt;
    if (this.phase === "flight" && this.age >= 30) { this.phase = "ground"; this.age = 0; }
    const nearby = Math.hypot(player.x - BIRD_CLEARING.x, player.z - BIRD_CLEARING.z) < 7;
    if (this.phase === "ground" && !this.served) {
      if (this.queued && this.age >= .4) this.startMeal(false);
      else if (caretaker && this.age >= (nearby ? 12 : 2.5)) this.startMeal(true);
    }
    if (this.mealAge >= 0) this.mealAge += dt;
    if (this.phase === "ground" && (this.served ? this.mealAge >= 10 : this.age >= 18)) {
      this.phase = "flight"; this.age = 0; this.mealAge = -1; this.served = false;
    }
    this.publish();
    this.hearts.visible = visible && this.status === "happy";
    this.crumbs.visible = visible && (this.queued || this.status === "eating");
    const joyAge = this.mealAge - 4;
    this.birds.forEach((bird, i) => {
      const flying = this.phase === "flight", happy = this.status === "happy";
      if (flying) {
        this.flightPosition(i, this.age, bird.root.position);
        this.flightPosition(i, this.age + .03, this.next).sub(bird.root.position);
        if (this.next.lengthSq() > .00001) bird.root.rotation.y = Math.atan2(this.next.x, this.next.z);
        bird.root.rotation.z = reduced ? 0 : -.09 * Math.sin(this.age / 30 * Math.PI * 2);
        bird.root.rotation.x = reduced ? 0 : -.06 * this.next.y;
      } else {
        bird.root.position.copy(bird.landing);
        bird.root.rotation.set(0, Math.atan2(BIRD_CLEARING.x - bird.landing.x, BIRD_CLEARING.z - bird.landing.z), 0);
        if (!reduced) {
          bird.root.position.y += happy ? Math.abs(Math.sin(joyAge * 5 + i)) * .1 : Math.sin(time * 2 + i) * .009;
          bird.root.rotation.z = happy ? Math.sin(joyAge * 6 + i) * .07 : 0;
        }
      }
      bird.head.rotation.x = !reduced && this.status === "eating" ? .27 + Math.sin(time * 6 + i) * .24 : 0;
      bird.wings.forEach((wing, side) => {
        const flap = reduced ? 0 : Math.sin(time * (flying ? 10 : 13) + i) * (flying ? .65 : .3);
        wing.rotation.z = (side ? -1 : 1) * (flying ? flap : happy ? .65 + flap : 1.12);
      });
      bird.root.updateMatrixWorld(true);
      this.dummy.position.copy(bird.root.position).y += .95 + (reduced ? 0 : Math.max(0, joyAge) * .07);
      this.dummy.quaternion.copy(camera.quaternion); this.dummy.scale.setScalar(reduced ? .27 : .3 + Math.sin(time * 3 + i) * .025);
      this.dummy.updateMatrix(); this.hearts.setMatrixAt(i, this.dummy.matrix);
    });
    for (const part of this.parts) {
      part.nodes.forEach((node, i) => part.mesh.setMatrixAt(i, node.matrixWorld)); part.mesh.instanceMatrix.needsUpdate = true;
    }
    this.hearts.instanceMatrix.needsUpdate = true;
    if (this.crumbs.visible) for (let i = 0; i < 36; i++) {
      const a = i * 2.399, r = .2 + (i % 7) * .19;
      const toss = reduced || this.mealAge < 0 ? 0 : Math.max(0, 1 - this.mealAge * 1.8);
      this.dummy.position.set(BIRD_CLEARING.x + Math.cos(a) * r, .18 + Math.sin(toss * Math.PI) * .7, BIRD_CLEARING.z + Math.sin(a) * r);
      this.dummy.rotation.set(i, i, i); this.dummy.scale.setScalar(this.mealAge > 2 ? Math.max(0, (4 - this.mealAge) / 2) : 1);
      this.dummy.updateMatrix(); this.crumbs.setMatrixAt(i, this.dummy.matrix);
    }
    this.crumbs.instanceMatrix.needsUpdate = true;
    this.projected.set(BIRD_CLEARING.x, 1.8, BIRD_CLEARING.z).project(camera);
    const show = visible && this.status === "happy" && nearby && this.projected.z > -1 && this.projected.z < 1
      && Math.abs(this.projected.x) < .9 && Math.abs(this.projected.y) < .9;
    this.bubble.hidden = !show;
    if (show) {
      if (!this.announce || this.bubble.textContent !== BIRD_THANKS[this.language]) this.bubble.textContent = BIRD_THANKS[this.language];
      this.bubble.style.left = `${T.MathUtils.clamp((this.projected.x * .5 + .5) * this.width, 135, Math.max(135, this.width - 135))}px`;
      this.bubble.style.top = `${T.MathUtils.clamp((-this.projected.y * .5 + .5) * this.height - 32, this.width < 600 ? 205 : 150, this.height * (this.width < 600 ? .54 : .85))}px`;
    }
    this.announce = show;
  }
  dispose() { this.bubble.remove(); }
}

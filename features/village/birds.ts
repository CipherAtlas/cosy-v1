import type { AuthoredWorld } from "./worldLayout";
import * as T from "three";
import { BIRD_CLEARING, floorHeight } from "./environment";
import type { SharedBirds } from "./sharedActors";

export type BirdStatus = "flying" | "crumbs" | "waiting" | "sad" | "eating" | "happy";
export const BIRD_THANKS = { en: "Coo coo~ (Thank you~)", ja: "クークー〜（ありがとう〜）" };
const BIRD_SAD = { en: "Coo coo :(", ja: "クークー :(" };
const SAD_AFTER = 6;
export const BIRD_FEEDING = { bowlRadius: 1.05, servingCrumbs: 96, thrownCrumbs: 18 };

/** The editor preview and the live serving share the same crumb distribution. */
export function fillBirdCrumbs(mesh: T.InstancedMesh, dummy: T.Object3D, portion = 1, x = BIRD_CLEARING.x, z = BIRD_CLEARING.z) {
  for (let i = 0; i < mesh.count; i++) {
    const angle = i * 2.399;
    const inBowl = i < mesh.count * .65;
    const radius = inBowl ? .95 * Math.sqrt((i + .5) / (mesh.count * .65)) : 1.12 + (i % 11) * .038;
    dummy.position.set(x + Math.cos(angle) * radius, inBowl ? .17 + i % 3 * .009 : .13, z + Math.sin(angle) * radius);
    dummy.rotation.set(i * .7, i * 1.3, i * .4);
    dummy.scale.set(.75 + i % 4 * .16, .5 + i % 3 * .17, .7 + i % 5 * .12).multiplyScalar(portion);
    dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

// Landing positions from the saved “Current village copy”.
export const BIRD_LANDING_SPOTS: [number, number][] = [
  [-35.95, 3.993025],
  [-35.441154, 4.893025],
  [-36.475, 4.902352],
  [-36, 2],
  [-37.525, 4.993025],
  [-38.558846, 4.893025],
  [-38.05, 3.993025],
  [-38.558846, 3.093025],
  [-37.525, 3.083698],
  [-37, 2.193025],
  [-36.475, 3.083698],
  [-35.441154, 3.093025],
];

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
  private sadness = 0;
  private lastStatus?: BirdStatus;
  private parts: { mesh: T.InstancedMesh; nodes: T.Object3D[] }[] = [];
  private hearts: T.InstancedMesh;
  private crumbs: T.InstancedMesh;
  private thrownCrumbs: T.InstancedMesh;
  private throwOrigin = new T.Vector3();
  private throwAge = -1;
  private dummy = new T.Object3D();
  private next = new T.Vector3();
  private flightCount = 0;
  // Every circuit starts and ends at the same dry landing spots. The higher
  // paths cross scenery only after climbing above it.
  private flightRoutes = [
    [[0, 0, 0], [6, 8, 1], [14, 20, -6], [14, 26, -24], [3, 29, -31], [-6, 24, -23], [-8, 16, -10], [-5, 7, -1], [0, 0, 0]],
    [[0, 0, 0], [6, 9, 1], [15, 24, 7], [29, 36, -6], [16, 39, -26], [-5, 32, -23], [-13, 21, -9], [-5, 8, -1], [0, 0, 0]],
    [[0, 0, 0], [6, 9, 1], [16, 25, -8], [7, 34, -25], [-8, 30, -15], [8, 23, -8], [16, 17, 2], [-5, 8, -1], [0, 0, 0]],
  ].map(points => new T.CatmullRomCurve3(points.map(([x, y, z]) => new T.Vector3(x, y, z))));
  private bubble = document.createElement("div");
  private projected = new T.Vector3();
  private language: "en" | "ja" = "en";
  private announce = false;
  private width = 0;
  private height = 0;
  private shared: SharedBirds | null = null;
  private sharedClock = 0;
  applyShared(state: SharedBirds, time: number) {
    if (state.mealAt !== null && state.mealAt !== this.shared?.mealAt) this.fed(false);
    this.shared = state; this.sharedClock = time - Date.now();
  }

  constructor(source: T.Object3D, host: HTMLElement, private changed: (status: BirdStatus) => void,
    private fed: (byCaretaker: boolean) => void, authored?: AuthoredWorld) {
    this.group.name = "White dove flock";
    const template = source.getObjectByName("Dove");
    if (!template) throw new Error("The dove asset is missing its named root.");
    const placements = authored?.sceneVersion === 1 ? (authored.items ?? []).filter(item => item.visible && item.asset === "white-dove") : undefined;
    const landings = placements ? placements.map(item => item.position) : BIRD_LANDING_SPOTS.map(([x, z]) => [x, .13, z]);
    for (let i = 0; i < landings.length; i++) {
      const root = template.clone(true);
      if (placements) root.scale.multiply(new T.Vector3(...placements[i].scale));
      const [x, y, z] = landings[i];
      this.birds.push({ root, head: root.getObjectByName("DoveHead")!,
        wings: [root.getObjectByName("DoveWingLeft")!, root.getObjectByName("DoveWingRight")!],
        landing: new T.Vector3(x, y, z) });
    }
    const picnic = authored?.items?.find(item => item.visible && item.asset === "picnic-mat");
    if (picnic && this.birds.length) {
      const origin = this.birds.reduce((sum, bird) => sum.add(bird.landing), new T.Vector3()).divideScalar(this.birds.length);
      const [x, y, z] = picnic.position;
      const ground = Math.max(y, ...Array.from({ length: 8 }, (_, i) =>
        floorHeight(x + Math.cos(i * Math.PI / 4) * 14, z + Math.sin(i * Math.PI / 4) * 14)));
      const nearbyTrees = (authored?.trees ?? []).filter(tree => Math.hypot(tree.x - x, tree.z - z) < 28);
      // Climb near the clearing before crossing the hill. Keep the circuit close
      // enough to the blanket to see the existing doves, above its tree crowns.
      const height = Math.max(ground + 14, ...nearbyTrees.map(tree => tree.y + 8.6 * tree.scale[1] + 3));
      const points = [
        origin.clone(), new T.Vector3(origin.x + 6, origin.y + 9, origin.z + 1),
        new T.Vector3(origin.x - 2, origin.y + 27, origin.z + 6),
        new T.Vector3(x + 20, height, z + 10), new T.Vector3(x + 8, height, z + 6),
        new T.Vector3(x - 7, height + 2, z + 2), new T.Vector3(x - 10, height + 3, z - 9),
        new T.Vector3(x + 3, height + 2, z - 12), new T.Vector3(x + 24, height, z - 4),
        new T.Vector3(origin.x - 10, origin.y + 23, origin.z - 8),
        new T.Vector3(origin.x - 5, origin.y + 8, origin.z - 1), origin.clone(),
      ];
      this.flightRoutes.push(new T.CatmullRomCurve3(points.map(point => point.sub(origin))));
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
    this.hearts = new T.InstancedMesh(new T.ShapeGeometry(heart, 12), new T.MeshBasicMaterial({ color: "#ff9aab", side: T.DoubleSide, depthWrite: false }), this.birds.length);
    this.hearts.name = "Happy dove hearts";
    this.crumbs = new T.InstancedMesh(new T.IcosahedronGeometry(.047, 0), new T.MeshStandardMaterial({ color: "#edc693", roughness: 1 }), BIRD_FEEDING.servingCrumbs);
    this.crumbs.name = "Sourdough crumbs";
    this.thrownCrumbs = new T.InstancedMesh(this.crumbs.geometry, this.crumbs.material, BIRD_FEEDING.thrownCrumbs);
    this.thrownCrumbs.name = "Scattered sourdough crumbs";
    for (const mesh of [this.hearts, this.crumbs, this.thrownCrumbs]) {
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.frustumCulled = false; mesh.visible = false; this.group.add(mesh);
    }
    this.bubble.className = "v-bird-bubble"; this.bubble.hidden = true;
    this.bubble.setAttribute("role", "status"); this.bubble.setAttribute("aria-live", "polite");
    host.append(this.bubble);
  }

  setLanguage(language: "en" | "ja") { this.language = language; this.bubble.lang = language; }
  resize(width: number, height: number) { this.width = width; this.height = height; }
  feed(from: T.Vector3) {
    if (this.queued || this.served) return false;
    this.throwOrigin.copy(from).y += 1.05;
    this.throwAge = 0;
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
      : this.queued ? "crumbs" : this.phase === "flight" ? "flying" : this.age >= SAD_AFTER ? "sad" : "waiting";
    if (this.status !== this.lastStatus) { this.lastStatus = this.status; this.changed(this.status); }
  }
  private flightPosition(index: number, age: number, target: T.Vector3, reduced = false) {
    const bird = this.birds[index], t = T.MathUtils.clamp(age / 30, 0, 1);
    const spread = Math.sin(t * Math.PI) ** 2, pattern = this.flightCount % this.flightRoutes.length;
    this.flightRoutes[pattern].getPointAt(t, target).add(bird.landing);
    const row = Math.floor(index / 2), side = index % 2 ? 1 : -1;
    const lateral = pattern === 0 ? side * row * .65 : pattern === 1 ? (index % 4 - 1.5) * 1.4 : side * 2.2;
    target.x += spread * (lateral + (reduced ? 0 : Math.sin(t * Math.PI * 4 + index * .7) * .45));
    target.z += spread * (pattern === 0 ? -row * .5 : pattern === 1 ? -Math.floor(index / 4) * 1.5 : (row - 2.5) * .85);
    target.y += spread * (index % 3) * .65;
    return target;
  }
  update(dt: number, time: number, reduced: boolean, camera: T.Camera, player: T.Vector3, caretaker: boolean, visible: boolean, otherBlobNearby = false) {
    const nearby = Math.hypot(player.x - BIRD_CLEARING.x, player.z - BIRD_CLEARING.z) <= BIRD_CLEARING.feedingPerimeter;
    if (this.shared) {
      const now = Date.now() + this.sharedClock;
      this.phase = this.shared.phase; this.age = Math.max(0, (now - this.shared.since) / 1000);
      this.mealAge = this.shared.mealAt === null ? -1 : Math.max(0, (now - this.shared.mealAt) / 1000);
      this.queued = this.shared.queued; this.served = this.shared.served;
      this.throwAge = this.shared.throwAt === null ? -1 : Math.max(0, (now - this.shared.throwAt) / 1000);
      this.throwOrigin.fromArray(this.shared.origin);
      this.flightCount = this.shared.flightCount ?? 0;
    } else {
    this.age += dt;
    if (this.throwAge >= 0) this.throwAge += dt;
    if (this.phase === "flight" && this.age >= 30) { this.phase = "ground"; this.age = 0; }
    if (this.phase === "ground" && !this.served) {
      if (this.queued && this.age >= .4) this.startMeal(false);
      else if (caretaker && !nearby && !otherBlobNearby && this.age >= 2.5) this.startMeal(true);
    }
    if (this.mealAge >= 0) this.mealAge += dt;
    if (this.phase === "ground" && (this.served ? this.mealAge >= 10 : this.age >= 18)) {
      this.phase = "flight"; this.age = 0; this.mealAge = -1; this.served = false; this.flightCount++;
    }
    }
    this.publish();
    const sadGoal = this.status === "sad" ? 1 : 0;
    this.sadness = reduced ? sadGoal : T.MathUtils.lerp(this.sadness, sadGoal, 1 - Math.exp(-dt * 4));
    this.hearts.visible = visible && this.status === "happy";
    this.crumbs.visible = visible && (this.queued || this.served && this.mealAge < 7) && (reduced || this.throwAge < 0 || this.throwAge >= 1.15);
    const joyAge = this.mealAge - 4;
    this.birds.forEach((bird, i) => {
      const flying = this.phase === "flight", happy = this.status === "happy";
      if (flying) {
        this.flightPosition(i, this.age, bird.root.position, reduced);
        this.flightPosition(i, this.age + .03, this.next, reduced).sub(bird.root.position);
        if (this.next.lengthSq() > .00001) bird.root.rotation.y = Math.atan2(this.next.x, this.next.z);
        bird.root.rotation.z = reduced ? 0 : -.09 * Math.sin(this.age / 30 * Math.PI * 2);
        bird.root.rotation.x = reduced ? 0 : -.06 * this.next.y;
      } else {
        bird.root.position.copy(bird.landing);
        bird.root.rotation.set(0, Math.atan2(BIRD_CLEARING.x - bird.landing.x, BIRD_CLEARING.z - bird.landing.z), 0);
        bird.root.rotation.x = this.sadness * .1;
        if (!reduced) {
          bird.root.position.y += happy ? Math.abs(Math.sin(joyAge * 5 + i)) * .1 : Math.sin(time * 2 + i) * .009 - this.sadness * .025;
          bird.root.rotation.z = happy ? Math.sin(joyAge * 6 + i) * .07 : 0;
        }
      }
      bird.head.rotation.x = this.sadness * (.4 + (reduced ? 0 : Math.sin(time * 1.8 + i) * .035))
        + (!reduced && this.status === "eating" ? .27 + Math.sin(time * 6 + i) * .24 : 0);
      bird.head.rotation.z = reduced ? 0 : this.sadness * Math.sin(time * 1.2 + i) * .06;
      bird.wings.forEach((wing, side) => {
        const flap = reduced ? 0 : Math.sin(time * (flying ? 10 : 13) + i) * (flying ? .65 : .3);
        wing.rotation.z = (side ? -1 : 1) * (flying ? flap : happy ? .65 + flap : 1.12 + this.sadness * .27);
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
    if (this.crumbs.visible) fillBirdCrumbs(this.crumbs, this.dummy, this.mealAge > 2 ? Math.max(0, (7 - this.mealAge) / 5) : 1);
    this.thrownCrumbs.visible = visible && this.throwAge >= 0 && this.throwAge < 3.5;
    if (this.thrownCrumbs.visible) {
      const progress = reduced ? 1 : T.MathUtils.clamp(this.throwAge / 1.15, 0, 1);
      for (let i = 0; i < this.thrownCrumbs.count; i++) {
        const angle = i * 2.399, radius = .2 + (i % 6) * .17;
        const startX = this.throwOrigin.x + Math.cos(angle) * .12;
        const startZ = this.throwOrigin.z + Math.sin(angle) * .12;
        const endX = BIRD_CLEARING.x + Math.cos(angle) * radius;
        const endZ = BIRD_CLEARING.z + Math.sin(angle) * radius;
        this.dummy.position.set(
          T.MathUtils.lerp(startX, endX, progress),
          T.MathUtils.lerp(this.throwOrigin.y, .19, progress) + (reduced ? 0 : Math.sin(progress * Math.PI) * .65),
          T.MathUtils.lerp(startZ, endZ, progress),
        );
        this.dummy.rotation.set(i, i, i);
        this.dummy.scale.setScalar(this.throwAge > 2.5 ? Math.max(0, (3.5 - this.throwAge)) : 1);
        this.dummy.updateMatrix(); this.thrownCrumbs.setMatrixAt(i, this.dummy.matrix);
      }
      this.thrownCrumbs.instanceMatrix.needsUpdate = true;
    }
    this.projected.set(BIRD_CLEARING.x, 1.8, BIRD_CLEARING.z).project(camera);
    const show = visible && (this.status === "happy" || this.status === "sad") && nearby && this.projected.z > -1 && this.projected.z < 1
      && Math.abs(this.projected.x) < .9 && Math.abs(this.projected.y) < .9;
    this.bubble.hidden = !show;
    if (show) {
      const speech = this.status === "sad" ? BIRD_SAD[this.language] : BIRD_THANKS[this.language];
      if (!this.announce || this.bubble.textContent !== speech) this.bubble.textContent = speech;
      this.bubble.style.left = `${T.MathUtils.clamp((this.projected.x * .5 + .5) * this.width, 135, Math.max(135, this.width - 135))}px`;
      this.bubble.style.top = `${T.MathUtils.clamp((-this.projected.y * .5 + .5) * this.height - 32, this.width < 600 ? 205 : 150, this.height * (this.width < 600 ? .54 : .85))}px`;
    }
    this.announce = show;
  }
  dispose() { this.bubble.remove(); }
}

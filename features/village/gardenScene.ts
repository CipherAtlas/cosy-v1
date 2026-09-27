import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { floorHeight, POND, type Collider } from "./environment";
import { BEDS, CROP_NAMES, FEED_POSITION, FLOWER_POSITION, MINT_POSITION, MINT_BED, growthProgress, growthTimeLeft, freshGarden, type GardenAction, type GardenSound, type GardenState } from "./garden";

/** Original Blender kit, instanced planting, and bounded pools for water/feeding effects. */
export class GardenScene {
  readonly group = new T.Group();
  private geometry = new Map<string, T.BufferGeometry>();
  private material: T.MeshStandardMaterial;
  private foliage: T.MeshStandardMaterial;
  private wind = { value: 0 };
  private breeze = { value: 1 };
  private beds: { root: T.Group; sprout: T.InstancedMesh; carrot: T.InstancedMesh; radish: T.InstancedMesh; mint: T.InstancedMesh; scale: number }[] = [];
  private birds: { root: T.Object3D; head?: T.Object3D; wings: T.Object3D[]; phase: number; swan: boolean }[] = [];
  private fish: { root: T.Object3D; tail?: T.Object3D; jumping: boolean }[] = [];
  private ripples: T.InstancedMesh;
  private drops: T.InstancedMesh;
  private crumbs: T.InstancedMesh;
  private hearts: T.InstancedMesh;
  private can: T.Object3D;
  private teapot: T.Object3D;
  private teaMint: T.Object3D;
  private harvest: T.Object3D;
  private dummy = new T.Object3D();
  private state = freshGarden();
  private time = 0;
  private action?: GardenAction;
  private actionAt = -100;
  private feedAt = -100;
  private feedCelebrated = true;
  private teaAt = -100;
  private splashAt = -100;
  private splashPosition = new T.Vector3();
  private nextDuck = 8;
  private language: "en" | "ja" = "en";
  private labels: { canvas: HTMLCanvasElement; texture: T.CanvasTexture; bed?: number; en: string; ja: string; text: string }[] = [];
  private clocks: { canvas: HTMLCanvasElement; texture: T.CanvasTexture; sprite: T.Sprite; text: string }[] = [];

  constructor(private source: T.Object3D, colliders: Collider[], private sound: (kind: GardenSound, position: [number, number, number]) => void, surfaces: { paving: T.MeshStandardMaterial; wood: T.MeshStandardMaterial; ground: T.MeshStandardMaterial }) {
    this.group.name = "Kitchen garden and pond life";
    source.updateMatrixWorld(true);
    let material: T.MeshStandardMaterial | undefined;
    source.traverse(o => { if (o instanceof T.Mesh && o.material instanceof T.MeshStandardMaterial) material = o.material; });
    this.material = material!;
    this.foliage = this.material.clone();
    this.foliage.onBeforeCompile = shader => {
      shader.uniforms.gardenTime = this.wind; shader.uniforms.gardenBreeze = this.breeze;
      shader.vertexShader = "uniform float gardenTime, gardenBreeze;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
        float phase = instanceMatrix[3].x * .8 + instanceMatrix[3].z * .6;
        transformed.x += sin(gardenTime * 1.3 + phase + position.y) * .025 * max(0.0, position.y) * gardenBreeze;
        transformed.z += sin(gardenTime * .9 + phase) * .018 * max(0.0, position.y) * gardenBreeze;
      `);
    };
    this.foliage.customProgramCacheKey = () => "garden-breeze-v1";
    const wood = surfaces.wood, paving = surfaces.paving;
    const soil = surfaces.ground.clone(); soil.name = "Painted garden soil";
    soil.vertexColors = false; soil.color.set("#80634b"); soil.bumpMap = soil.map; soil.bumpScale = .025;
    soil.onBeforeCompile = () => {};
    soil.customProgramCacheKey = () => "garden-painted-soil";
    const box = (m: T.Material, x: number, y: number, z: number, w: number, h: number, d: number) => {
      const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z);
      if (m === soil || m === paving) {
        const positions = o.geometry.getAttribute("position"), uv = o.geometry.getAttribute("uv");
        for (let i = 0; i < positions.count; i++) uv.setXY(i, (positions.getX(i) + x) / (m === soil ? 96 : 2), (positions.getZ(i) + z) / (m === soil ? 96 : 2));
      }
      if (m === wood) o.geometry.setAttribute("color", new T.BufferAttribute(new Float32Array(o.geometry.getAttribute("position").count * 3).fill(1), 3));
      o.castShadow = o.receiveShadow = true; this.group.add(o); return o;
    };
    const sign = (x: number, z: number, en: string, ja: string, bed?: number, yaw = 0) => {
      const root = new T.Group(); root.position.set(x, 0, z); root.rotation.y = yaw;
      root.name = `${en} wooden bed label`; root.userData.gardenLabel = true; this.group.add(root);
      for (const [y, w, h, d] of [[.49, .085, .7, .085], [.83, 1.55, .38, .085]]) {
        const geometry = new T.BoxGeometry(w, h, d);
        geometry.setAttribute("color", new T.BufferAttribute(new Float32Array(geometry.getAttribute("position").count * 3).fill(1), 3));
        const mesh = new T.Mesh(geometry, wood); mesh.position.y = y; mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
      }
      const canvas = document.createElement("canvas"); canvas.width = 768; canvas.height = 192;
      const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 8;
      const material = new T.MeshStandardMaterial({ map: texture, transparent: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 });
      for (const side of [-1, 1]) {
        const face = new T.Mesh(new T.PlaneGeometry(1.48, .35), material);
        face.position.set(0, .83, side * .045); face.rotation.y = side < 0 ? Math.PI : 0; root.add(face);
      }
      this.labels.push({ canvas, texture, bed, en, ja, text: "" });
      root.updateMatrixWorld(true);
      const bounds = new T.Box3().setFromObject(root), size = bounds.getSize(new T.Vector3());
      colliders.push({ x, z, w: size.x, d: size.z, top: bounds.max.y });
    };
    BEDS.forEach((bed, index) => {
      box(soil, bed.x, .13, bed.z, 3.2, .25, 2.5);
      for (const z of [-1.28, 1.28]) box(wood, bed.x, .2, bed.z + z, 3.45, .38, .14);
      for (const x of [-1.65, 1.65]) box(wood, bed.x + x, .2, bed.z, .14, .38, 2.7);
      colliders.push({ x: bed.x, z: bed.z, w: 3.5, d: 2.8, top: .45 });
      const root = new T.Group(); root.position.set(bed.x, .25, bed.z); root.name = `Vegetable bed ${index + 1}`; this.group.add(root);
      const positions = Array.from({ length: 9 }, (_, i) => [(i % 3 - 1) * .92, 0, (Math.floor(i / 3) - 1) * .7, 1] as const);
      const sprout = this.plant("Sprout", positions, root), carrot = this.plant("Carrot", positions, root), radish = this.plant("Radish", positions, root);
      const mint = this.plant("Mint", positions, root);
      this.beds.push({ root, sprout, carrot, radish, mint, scale: 1 });
      sign(bed.x + .25, bed.z + 1.23, index === MINT_BED ? "Mint · Tea leaves" : "", index === MINT_BED ? "ミント・お茶の葉" : "", index);
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 192;
      const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
      const sprite = new T.Sprite(new T.SpriteMaterial({ map: texture, depthWrite: false }));
      sprite.name = `Bed ${index + 1} growth countdown`; sprite.position.set(bed.x - 1.05, 1.05, bed.z + 1.23); sprite.scale.set(.65, .65, 1);
      sprite.visible = false; this.group.add(sprite); this.clocks.push({ canvas, texture, sprite, text: "" });
    });
    // The same limestone and world-space texture scale as the footpaths edge the planting.
    const flowerBed = (x: number, z: number, width: number, depth: number) => {
      // Include the stone edging so walking and companion routes keep the planting clear.
      colliders.push({ x, z, w: width + .15, d: depth + .15, top: .18 });
      box(soil, x, .09, z, width, .07, depth);
      for (const edge of [-1, 1]) {
        box(paving, x, .12, z + edge * depth / 2, width + .15, .12, .15);
        box(paving, x + edge * width / 2, .12, z, .15, .12, depth);
      }
    };
    flowerBed(24.7, -12.7, 9.9, 1.1);
    flowerBed(27.2, -1, 3.45, 2.7);
    flowerBed(30.1, -7.3, .85, 9.5);
    const sunflowers = Array.from({ length: 13 }, (_, i) => [20.08 + i * .77, .13, -12.7 + Math.sin(i * 1.5) * .08, .9 + (i % 3) * .09] as const);
    this.plant("Sunflower", sunflowers);
    this.plant("Daisy", Array.from({ length: 20 }, (_, i) => [25.96 + (i % 5) * .62, .13, -.1 - Math.floor(i / 5) * .55, .75 + (i % 3) * .08] as const));
    this.plant("Iris", Array.from({ length: 12 }, (_, i) => [30.1 + Math.sin(i * 2.4) * .2, .13, -11.3 + i * .74, .75] as const));
    sign(24.7, -12.25, "Sunflowers", "ひまわり");
    sign(27.45, .23, "Daisies", "デイジー");
    sign(29.78, -7.3, "Irises", "アイリス", undefined, -Math.PI / 2);
    this.can = this.model("WateringCan", [24, .1, -.8]);
    this.model("Basket", [25, .08, -.6]);
    this.model("BreadPouch", [-23.8, .25, -4.9], .75);
    this.teapot = this.model("Teapot", [15, 1.28, -10.3], 1);
    this.teaMint = this.model("Mint", [15.21, 1.49, -9.64], .13); this.teaMint.visible = false;
    this.harvest = this.model("Carrot", [0, 0, 0]); this.harvest.visible = false;

    const reeds: [number, number, number, number][] = [], irises: typeof reeds = [], daisies: typeof reeds = [];
    for (let i = 0; i < 90; i++) {
      const a = i * Math.PI * 2 / 90, x = POND.x + Math.cos(a) * (POND.rx + .5), z = POND.z + Math.sin(a) * (POND.rz + .5);
      // Keep the dock and its approach fully open, and leave gaps between shoreline clumps.
      if (z > -7.6 && z < -3.1 && x > -26 || i % 8 > 5) continue;
      reeds.push([x, floorHeight(x, z), z, .7 + (i % 4) * .17]);
      if (i % 3 === 0) irises.push([x + .25, .02, z + .3, .75]);
      if (i % 5 === 0) daisies.push([x - .32, .02, z - .15, .85]);
    }
    this.plant("Reeds", reeds); this.plant("Iris", irises); this.plant("Daisy", daisies);
    this.plant("Lily", Array.from({ length: 14 }, (_, i) => {
      const a = i * 2.4, r = .6 + (i % 3) * .085;
      return [POND.x + Math.cos(a) * POND.rx * r, POND.y + .04, POND.z + Math.sin(a) * POND.rz * r, .65 + i % 2 * .22] as const;
    }), this.group, false);
    for (let i = 0; i < 6; i++) {
      const species = i === 0 ? "Swan" : i === 1 ? "Duck" : "Duckling";
      const root = this.model(species, [POND.x + (i - 3) * .8, POND.y, POND.z + 3]);
      const wings: T.Object3D[] = [];
      root.traverse(o => { if (o.name === species + "WingL" || o.name === species + "WingR") wings.push(o); });
      this.birds.push({ root, head: root.getObjectByName(species + "Head"), wings, phase: i * 1.3, swan: i === 0 });
    }
    for (let i = 0; i < 4; i++) {
      const root = this.model("Fish", [0, 0, 0], .9 + i * .08);
      this.fish.push({ root, tail: root.getObjectByName("FishTail"), jumping: false });
    }
    const rippleGeometry = new T.RingGeometry(.92, 1, 40); rippleGeometry.rotateX(-Math.PI / 2);
    this.ripples = new T.InstancedMesh(rippleGeometry, new T.MeshBasicMaterial({ color: "#d2eee2", transparent: true, opacity: .34, depthWrite: false }), 12);
    this.drops = new T.InstancedMesh(new T.SphereGeometry(.024, 6, 4), new T.MeshBasicMaterial({ color: "#b9e9eb", transparent: true, opacity: .8 }), 40);
    this.crumbs = new T.InstancedMesh(new T.IcosahedronGeometry(.036, 0), new T.MeshStandardMaterial({ color: "#ecc88b", roughness: 1 }), 18);
    const heart = new T.Shape();
    heart.moveTo(0, -.48);
    heart.bezierCurveTo(-.15, -.3, -.55, -.05, -.5, .23);
    heart.bezierCurveTo(-.45, .55, -.1, .56, 0, .3);
    heart.bezierCurveTo(.1, .56, .45, .55, .5, .23);
    heart.bezierCurveTo(.55, -.05, .15, -.3, 0, -.48);
    this.hearts = new T.InstancedMesh(new T.ShapeGeometry(heart, 12), new T.MeshBasicMaterial({ color: "#ff9aab", side: T.DoubleSide, depthWrite: false }), 5);
    this.hearts.name = "Happy duck hearts";
    this.hearts.instanceMatrix.setUsage(T.DynamicDrawUsage); this.hearts.frustumCulled = false; this.hearts.visible = false; this.group.add(this.hearts);
    for (const mesh of [this.ripples, this.drops, this.crumbs]) {
      mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); this.group.add(mesh);
    }
    this.drops.visible = this.crumbs.visible = false;
    // Batch raised-bed timber and soil; foliage and moving parts retain their own transforms.
    this.group.updateMatrixWorld(true);
    for (const m of [wood, soil, paving]) {
      const pieces: T.Mesh[] = [];
      this.group.traverse(o => { if (o instanceof T.Mesh && o.material === m) pieces.push(o); });
      const parts = pieces.map(o => o.geometry.clone().applyMatrix4(o.matrixWorld));
      const geometry = mergeGeometries(parts)!; parts.forEach(g => g.dispose());
      pieces.forEach(o => { o.removeFromParent(); o.geometry.dispose(); });
      const mesh = new T.Mesh(geometry, m); mesh.castShadow = mesh.receiveShadow = true; this.group.add(mesh);
    }
    this.sync(this.state);
  }

  private model(name: string, position: readonly number[], scale = 1) {
    const template = this.source.getObjectByName(name);
    if (!template) throw new Error(`Garden model missing: ${name}`);
    const root = template.clone(true); root.position.set(position[0], position[1], position[2]); root.scale.multiplyScalar(scale);
    root.traverse(o => { if (o instanceof T.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.group.add(root); return root;
  }

  private plant(name: string, positions: readonly (readonly [number, number, number, number])[], parent: T.Group = this.group, windy = true) {
    let geometry = this.geometry.get(name);
    if (!geometry) {
      const parts: T.BufferGeometry[] = [];
      this.source.getObjectByName(name)!.traverse(o => { if (o instanceof T.Mesh) parts.push(o.geometry.clone().applyMatrix4(o.matrixWorld)); });
      geometry = mergeGeometries(parts)!; parts.forEach(g => g.dispose()); this.geometry.set(name, geometry);
    }
    const mesh = new T.InstancedMesh(geometry, windy ? this.foliage : this.material, positions.length);
    positions.forEach(([x, y, z, scale], i) => {
      this.dummy.position.set(x, y, z); this.dummy.rotation.set(0, Math.sin(i * 7.3) * .3, 0); this.dummy.scale.setScalar(scale); this.dummy.updateMatrix(); mesh.setMatrixAt(i, this.dummy.matrix);
    });
    mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }

  sync(state: GardenState) {
    this.state = state;
    this.beds.forEach((bed, i) => {
      bed.sprout.visible = state.beds[i].stage === "sprout";
      const leafy = state.beds[i].stage === "grown" || state.beds[i].stage === "growing";
      bed.carrot.visible = leafy && state.beds[i].crop === "carrot";
      bed.radish.visible = leafy && state.beds[i].crop === "radish";
      bed.mint.visible = leafy && i === MINT_BED;
    });
    this.updateLabels();
  }

  setLanguage(language: "en" | "ja") { this.language = language; this.updateLabels(); }

  private updateLabels() {
    for (const label of this.labels) {
      const text = label.bed !== undefined && label.bed !== MINT_BED
        ? CROP_NAMES[this.state.beds[label.bed].crop][this.language] : label[this.language];
      if (text === label.text) continue;
      label.text = text;
      const c = label.canvas.getContext("2d")!;
      c.clearRect(0, 0, 768, 192); c.fillStyle = "#fff0c9"; c.textAlign = "center"; c.textBaseline = "middle";
      c.font = `${this.language === "ja" ? 65 : 70}px Georgia, serif`; c.fillText(text, 384, 100, 710);
      label.texture.needsUpdate = true;
    }
  }

  act(action: GardenAction) {
    this.action = action; this.actionAt = this.time;
    let sound: GardenSound = "pluck";
    let position: [number, number, number] = [...MINT_POSITION];
    if ("bed" in action) {
      const bed = BEDS[action.bed]; position = [bed.x, .6, bed.z];
      if (action.kind === "plant") this.beds[action.bed].scale = .12;
      sound = action.kind === "plant" ? "plant" : action.kind === "water" ? "water" : "pluck";
    } else if (action.kind === "flowers") { position = [...FLOWER_POSITION]; sound = "water"; }
    else if (action.kind === "feed") { this.feedAt = this.time; this.feedCelebrated = false; position = [...FEED_POSITION]; sound = "crumbs"; }
    else if (action.kind === "gift" && action.crop === "mint") { this.teaAt = this.time; this.teaMint.visible = true; position = [15.2, 1.5, -10]; sound = "pour"; }
    else if (action.kind === "gift") { position = [16.5, 1, -11.5]; }
    else if (action.kind === "drink") { position = [13.9, 1.3, -10]; sound = "pour"; }
    this.sound(sound, position);
  }

  update(dt: number, time: number, reduced: boolean, cameraRotation?: T.Quaternion) {
    this.time = time; this.wind.value = reduced ? 0 : time; this.breeze.value = reduced ? 0 : 1;
    const t = reduced ? 0 : time, feedAge = time - this.feedAt, feeding = feedAge < 11;
    this.hearts.visible = feedAge >= 7 && feedAge < 10.7;
    if (!this.feedCelebrated && feedAge >= 7) {
      this.feedCelebrated = true;
      if (feedAge < 11) { const duck = this.birds[2].root.position; this.sound("duck", [duck.x, duck.y, duck.z]); }
    }
    this.birds.forEach((bird, i) => {
      const a = t * (bird.swan ? .07 : .105) + bird.phase;
      const targetX = feeding && !bird.swan ? -25 + Math.cos(i * 2.4) * 1.4 : POND.x + Math.cos(a) * (bird.swan ? 4.8 : 3.3);
      const targetZ = feeding && !bird.swan ? -7.8 + Math.sin(i * 2.4) * 1.2 : POND.z + Math.sin(a) * (bird.swan ? 6 : 4.4);
      const dx = targetX - bird.root.position.x, dz = targetZ - bird.root.position.z;
      const blend = reduced ? 1 : 1 - Math.exp(-dt * .7);
      bird.root.position.x += dx * blend; bird.root.position.z += dz * blend;
      bird.root.position.y = POND.y + .015 + Math.sin(t * 2 + bird.phase) * (reduced ? 0 : .022);
      const happyAge = feedAge - 7 - (i - 1) * .16;
      const happy = !bird.swan && happyAge >= 0 && happyAge < 3.1;
      const joy = happy && !reduced ? Math.sin(Math.min(1, happyAge / 3.1) * Math.PI) : 0;
      bird.root.position.y += Math.abs(Math.sin(happyAge * 5)) * joy * .13;
      bird.root.rotation.z = Math.sin(happyAge * 7) * joy * .09;
      if (Math.hypot(dx, dz) > .03) {
        const turn = T.MathUtils.euclideanModulo(Math.atan2(dx, dz) - bird.root.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
        bird.root.rotation.y += turn * (reduced ? 1 : 1 - Math.exp(-dt * 2));
      }
      bird.wings.forEach((wing, side) => { wing.rotation.z = reduced ? 0 : (Math.sin(t * (happy ? 13 : feeding ? 8 : 1.7) + bird.phase) * (happy ? .48 : feeding ? .24 : .04) + joy * .18) * (side ? 1 : -1); });
      if (bird.head) bird.head.rotation.x = happy ? -joy * .13 : feeding && !reduced && !bird.swan ? .16 + Math.sin(t * 3 + i) * .16 : 0;
      if (i > 0) {
        const scale = happy ? reduced ? .3 : Math.min(1, happyAge * 5, (3.1 - happyAge) * 3) * .4 : 0;
        this.dummy.position.copy(bird.root.position).y += .85 + (reduced ? 0 : Math.max(0, happyAge) * .2);
        this.dummy.quaternion.copy(cameraRotation ?? bird.root.quaternion);
        this.dummy.scale.setScalar(scale); this.dummy.updateMatrix(); this.hearts.setMatrixAt(i - 1, this.dummy.matrix);
      }
      this.dummy.position.set(bird.root.position.x, POND.y + .032, bird.root.position.z);
      this.dummy.rotation.set(0, bird.root.rotation.y, 0); this.dummy.scale.set(bird.swan ? .8 : .48, 1, bird.swan ? 1.1 : .65);
      this.dummy.updateMatrix(); this.ripples.setMatrixAt(i, this.dummy.matrix);
    });
    this.hearts.instanceMatrix.needsUpdate = true;
    this.fish.forEach((fish, i) => {
      const a = t * .15 + i * 1.57, cycle = (t + i * 4.8) % 22;
      const leap = !reduced && cycle < 1.7 ? Math.sin(cycle / 1.7 * Math.PI) : 0;
      fish.root.position.set(POND.x + Math.cos(a) * (3.6 + i * .48), POND.y - .095 + leap * 1.25, POND.z + Math.sin(a) * (5.5 + i * .38));
      fish.root.rotation.set(leap > 0 ? -Math.cos(cycle / 1.7 * Math.PI) * .72 : 0, Math.atan2(-Math.sin(a), Math.cos(a) * 1.45), 0);
      if (fish.tail) fish.tail.rotation.y = Math.sin(t * 9 + i) * (reduced ? 0 : .35);
      if (fish.jumping && leap === 0) {
        this.splashAt = time; this.splashPosition.copy(fish.root.position); this.sound("splash", [fish.root.position.x, POND.y, fish.root.position.z]);
      }
      fish.jumping = leap > 0;
    });
    for (let i = 6; i < 12; i++) {
      const age = time - this.splashAt, pulse = age + (i - 6) * .14;
      const scale = age < 2 && !reduced ? pulse * .65 : 0;
      this.dummy.position.set(this.splashPosition.x, POND.y + .035, this.splashPosition.z); this.dummy.scale.set(scale, 1, scale); this.dummy.updateMatrix(); this.ripples.setMatrixAt(i, this.dummy.matrix);
    }
    this.ripples.instanceMatrix.needsUpdate = true;
    if (time > this.nextDuck) { this.nextDuck = time + 14 + Math.sin(time) * 4; const duck = this.birds[2].root.position; this.sound("duck", [duck.x, duck.y, duck.z]); }
    this.crumbs.visible = feedAge < 7;
    if (this.crumbs.visible) for (let i = 0; i < 18; i++) {
      const f = reduced ? 1 : Math.min(1, Math.max(0, feedAge / 1.2 - i * .016)), x = -25 + Math.cos(i * 2.4) * .6, z = -7.8 + Math.sin(i * 2.4) * 1.2;
      this.dummy.position.set(T.MathUtils.lerp(FEED_POSITION[0], x, f), T.MathUtils.lerp(1.1, POND.y + .04, f) + Math.sin(f * Math.PI) * .65, T.MathUtils.lerp(FEED_POSITION[2], z, f));
      this.dummy.rotation.set(i, i, i); this.dummy.scale.setScalar(feedAge > 4 ? Math.max(0, 1 - (feedAge - 4) / 3) : 1); this.dummy.updateMatrix(); this.crumbs.setMatrixAt(i, this.dummy.matrix);
    }
    this.crumbs.instanceMatrix.needsUpdate = true;
    this.beds.forEach((bed, i) => {
      bed.scale = reduced ? 1 : T.MathUtils.damp(bed.scale, 1, 3, dt);
      const growth = this.state.beds[i].stage === "growing" ? .18 + growthProgress(this.state.beds[i]) * .82 : 1;
      bed.root.scale.set(1, bed.scale * growth, 1);
      const clock = this.clocks[i], value = this.state.beds[i];
      clock.sprite.visible = value.stage === "growing";
      const text = growthTimeLeft(value);
      if (clock.sprite.visible && clock.text !== text) {
        clock.text = text;
        const c = clock.canvas.getContext("2d")!, progress = growthProgress(value);
        c.clearRect(0, 0, 192, 192); c.fillStyle = "#faf3de";
        c.beginPath(); c.arc(96, 96, 84, 0, Math.PI * 2); c.fill();
        c.lineWidth = 9; c.strokeStyle = "#d7dfc6"; c.beginPath(); c.arc(96, 96, 69, 0, Math.PI * 2); c.stroke();
        c.strokeStyle = "#537850"; c.lineCap = "round"; c.beginPath(); c.arc(96, 96, 69, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); c.stroke();
        c.fillStyle = "#36573d"; c.font = "43px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(text, 96, 99);
        clock.texture.needsUpdate = true;
      }
    });
    const age = time - this.actionAt, action = this.action;
    const watering = age < 2.5 && (action?.kind === "water" || action?.kind === "flowers");
    this.drops.visible = watering && !reduced;
    if (watering) {
      const target = action.kind === "water" ? [BEDS[action.bed].x, .4, BEDS[action.bed].z] : FLOWER_POSITION;
      this.can.position.set(target[0] - .4, 1.45, target[2]); this.can.rotation.z = reduced ? -.22 : -.35 + Math.sin(age * 3) * .08;
      for (let i = 0; i < 40; i++) {
        const f = (age * 1.6 + i / 40) % 1;
        this.dummy.position.set(target[0] + .16 + Math.sin(i * 2.4) * f * .4, 1.7 - f * 1.4, target[2] + Math.cos(i * 2.4) * f * .4);
        this.dummy.rotation.set(0, 0, 0); this.dummy.scale.set(1, 1.7, 1); this.dummy.updateMatrix(); this.drops.setMatrixAt(i, this.dummy.matrix);
      }
      this.drops.instanceMatrix.needsUpdate = true;
    } else { this.can.position.set(24, .1, -.8); this.can.rotation.z = 0; }
    this.harvest.visible = !reduced && age < 1.6 && action?.kind === "harvest";
    if (this.harvest.visible && action) {
      const origin = "bed" in action ? [BEDS[action.bed].x, .4, BEDS[action.bed].z] : MINT_POSITION;
      const f = Math.min(1, age / 1.6);
      const crop = this.state.beds[(action as { bed: number }).bed].crop;
      const name = crop === "mint" ? "Mint" : crop === "carrot" ? "Carrot" : "Radish";
      if (this.harvest.name !== name) { this.harvest.removeFromParent(); this.harvest = this.model(name, origin); }
      this.harvest.position.set(T.MathUtils.lerp(origin[0], 25, f), .6 + Math.sin(f * Math.PI) * 1.5, T.MathUtils.lerp(origin[2], -.6, f)); this.harvest.rotation.y = age * 2;
    }
    const teaAge = time - this.teaAt, pour = teaAge < 2.5 && !reduced ? Math.sin(teaAge / 2.5 * Math.PI) : 0;
    this.teapot.position.set(15 + pour * .04, 1.28 + pour * .25, -10.3 + pour * .25); this.teapot.rotation.z = -pour * .6;
  }

  dispose() {
    for (const clock of this.clocks) { clock.texture.dispose(); clock.sprite.material.dispose(); }
    // Original template geometry also includes unused alternatives; release those on teardown.
    this.source.traverse(o => { if (o instanceof T.Mesh) o.geometry.dispose(); });
  }
}

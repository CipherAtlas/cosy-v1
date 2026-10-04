import * as T from "three";
import type { AnimalSoundSource } from "./townAnimalAudio";
import { createAnimalDialogueCue, type AnimalDialogueCue } from "./animalDialogue";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { drawGardenGrowthClock } from "./gardenGrowthDisplay";
import { floorHeight, POND, type Collider } from "./environment";
import { BEDS, CROP_NAMES, CROP_MODELS, CROP_INVENTORY, HARVEST_BASKET, SUNFLOWER_BED, FEED_POSITION, FLOWER_POSITION, MINT_POSITION, MINT_BED, DAISY_BED, growthProgress, growthTimeLeft, freshGarden, type Crop, type GardenAction, type GardenSound, type GardenState } from "./garden";
import type { AuthoredWorld } from "./worldLayout";
import { PondLifeSpace, POND_BIRDS, pondBirdRoute } from "./pondLife";
import { animateAnimalRig, disposeAnimalRig, isAnimalRigLoaded, makeAnimalRig, type AnimalRigSlug } from "./animalRig";

/** Original Blender kit, instanced planting, and bounded pools for water/feeding effects. */
export class GardenScene {
  readonly group = new T.Group();
  private geometry = new Map<string, T.BufferGeometry>();
  private material: T.MeshStandardMaterial;
  private foliage: T.MeshStandardMaterial;
  private wind = { value: 0 };
  private breeze = { value: 1 };
  private beds: { root: T.Group; sprout: T.InstancedMesh; carrot: T.InstancedMesh; radish: T.InstancedMesh; mint: T.InstancedMesh; daisy: T.InstancedMesh; sunflower: T.InstancedMesh | null; scale: number }[] = [];
  readonly dialogueCues: AnimalDialogueCue[] = [];
  private birds: { root: T.Object3D; head?: T.Object3D; wings: T.Object3D[]; phase: number; swan: boolean; immersion: number }[] = [];
  get soundSources(): AnimalSoundSource[] {
    return this.group.visible ? this.birds.map((bird, index) => ({ id: `pond-${index}`, species: index < 3 ? "swan" : index < 7 ? "duck" : "duckling",
      position: [bird.root.position.x, bird.root.position.y + .3, bird.root.position.z] })) : [];
  }
  private fish: { root: T.Object3D; tail?: T.Object3D; jumping: boolean }[] = [];
  private ripples: T.InstancedMesh;
  private drops: T.InstancedMesh;
  private crumbs: T.InstancedMesh;
  private hearts: T.InstancedMesh;
  private can: T.Object3D;
  private teapot: T.Object3D;
  private teaMint: T.Object3D;
  private harvest: T.Object3D;
  private basketContents: { crop: Crop; root: T.Object3D }[] = [];
  private dummy = new T.Object3D();
  private pondSpace: PondLifeSpace;
  private state = freshGarden();
  private time = 0;
  private action?: GardenAction;
  private actionAt = -100;
  private feedAt = -100;
  private sharedClock: number | null = null;
  private sharedEpoch = 0;
  syncShared(time: number, epoch: number, feedAt: number | null) {
    this.sharedClock = time - Date.now(); this.sharedEpoch = epoch;
    const feedingAt = feedAt === null ? -100 : (feedAt - epoch) / 1000;
    if (feedingAt !== this.feedAt) this.feedCelebrated = false;
    this.feedAt = feedingAt;
  }
  private feedCelebrated = true;
  private teaAt = -100;
  private splashAt = -100;
  private splashPosition = new T.Vector3();
  private language: "en" | "ja" = "en";
  private labels: { canvas: HTMLCanvasElement; texture: T.CanvasTexture; bed?: number; en: string; ja: string; text: string }[] = [];
  private clocks: { canvas: HTMLCanvasElement; texture: T.CanvasTexture; sprite: T.Sprite; text: string }[] = [];

  constructor(private source: T.Object3D, colliders: Collider[], private sound: (kind: GardenSound, position: [number, number, number]) => void, surfaces: { paving: T.MeshStandardMaterial; wood: T.MeshStandardMaterial; ground: T.MeshStandardMaterial }, private sunDirection = new T.Vector3(35, 28, -48), layout?: AuthoredWorld) {
    this.pondSpace = new PondLifeSpace(layout);
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
    BEDS.forEach((bed, index) => {
      const isSunflower = index === SUNFLOWER_BED;
      if (isSunflower) flowerBed(bed.x, bed.z, 9.9, 1.1);
      else {
        box(soil, bed.x, .13, bed.z, 3.2, .25, 2.5);
        for (const z of [-1.28, 1.28]) box(wood, bed.x, .2, bed.z + z, 3.45, .38, .14);
        for (const x of [-1.65, 1.65]) box(wood, bed.x + x, .2, bed.z, .14, .38, 2.7);
        colliders.push({ x: bed.x, z: bed.z, w: 3.5, d: 2.8, top: .45 });
      }
      const root = new T.Group(); root.position.set(bed.x, isSunflower ? .13 : .25, bed.z); root.name = `Garden bed ${index + 1}`; this.group.add(root);
      const positions = isSunflower
        ? Array.from({ length: 13 }, (_, i) => [-4.62 + i * .77, 0, Math.sin(i * 1.5) * .08, .9 + (i % 3) * .09] as const)
        : Array.from({ length: 9 }, (_, i) => [(i % 3 - 1) * .92, 0, (Math.floor(i / 3) - 1) * .7, 1] as const);
      const sprout = this.plant("Sprout", positions, root), carrot = this.plant("Carrot", positions, root), radish = this.plant("Radish", positions, root);
      const mint = this.plant("Mint", positions, root);
      const daisies = Array.from({ length: 20 }, (_, i) => [-1.24 + (i % 5) * .62, 0, .9 - Math.floor(i / 5) * .55, .75 + (i % 3) * .08] as const);
      const daisy = this.plant("Daisy", daisies, root);
      const sunflower = isSunflower ? this.plant("Sunflower", positions, root) : null;
      this.beds.push({ root, sprout, carrot, radish, mint, daisy, sunflower, scale: 1 });
      const labelZ = bed.z + (isSunflower ? .45 : 1.23);
      sign(bed.x + .25, labelZ, index === MINT_BED ? "Mint · Tea leaves" : "", index === MINT_BED ? "ミント・お茶の葉" : "", index);
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 192;
      const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
      const sprite = new T.Sprite(new T.SpriteMaterial({ map: texture, depthWrite: false }));
      sprite.name = `Bed ${index + 1} growth countdown`; sprite.position.set(bed.x - 1.05, 1.05, labelZ); sprite.scale.set(.65, .65, 1);
      sprite.visible = false; this.group.add(sprite); this.clocks.push({ canvas, texture, sprite, text: "" });
    });
    flowerBed(30.1, -7.3, .85, 9.5);
    this.plant("Iris", Array.from({ length: 12 }, (_, i) => [30.1 + Math.sin(i * 2.4) * .2, .13, -11.3 + i * .74, .75] as const));
    sign(29.78, -7.3, "Irises", "アイリス", undefined, -Math.PI / 2);
    const basket = this.model("Basket", HARVEST_BASKET, 1.5);
    basket.name = "Harvest basket"; basket.rotation.y = Math.PI / 2;
    const basketBounds = new T.Box3().setFromObject(basket);
    basket.position.y += floorHeight(HARVEST_BASKET[0], HARVEST_BASKET[2]) - basketBounds.min.y;
    basketBounds.setFromObject(basket);
    const basketSize = basketBounds.getSize(new T.Vector3());
    colliders.push({ x: HARVEST_BASKET[0], z: HARVEST_BASKET[2], w: basketSize.x, d: basketSize.z, top: basketBounds.max.y });
    for (const [i, crop] of (["carrot", "radish", "mint", "daisy", "sunflower"] as const).entries()) {
      const root = this.model(CROP_MODELS[crop], [HARVEST_BASKET[0] + (i % 3 - 1) * .22, basket.position.y + .42, HARVEST_BASKET[2] + (Math.floor(i / 3) - .5) * .24], crop === "sunflower" ? .32 : .55);
      root.name = `Stored ${crop}`; root.rotation.z = (i - 2) * .14; root.visible = false;
      this.basketContents.push({ crop, root });
    }
    this.can = this.model("WateringCan", [0, 0, 0]); this.can.visible = false;
    this.teapot = this.model("Teapot", [15, 1.28, -10.3], 1);
    this.teaMint = this.model("Mint", [15.21, 1.49, -9.64], .13); this.teaMint.visible = false;
    this.harvest = this.model("Carrot", [0, 0, 0]); this.harvest.visible = false;

    const reeds: [number, number, number, number][] = [], irises: typeof reeds = [], daisies: typeof reeds = [];
    for (let i = 0; i < 90; i++) {
      const a = i * Math.PI * 2 / 90, x = POND.x + Math.cos(a) * (POND.rx + .5), z = POND.z + Math.sin(a) * (POND.rz + .5);
      // Keep the dock and its approach fully open, and leave gaps between shoreline clumps.
      if (z > -7.6 && z < -3.1 && x > -26 || i % 8 > 5) continue;
      const world = this.pondSpace.point(x, 0, z);
      reeds.push([world[0], floorHeight(world[0], world[2]), world[2], .7 + (i % 4) * .17]);
      if (i % 3 === 0) irises.push([...this.pondSpace.point(x + .25, .02, z + .3), .75]);
      if (i % 5 === 0) daisies.push([...this.pondSpace.point(x - .32, .02, z - .15), .85]);
    }
    for (const [name, positions] of [["Reeds", reeds], ["Iris", irises], ["Daisy", daisies]] as const) {
      const bank = this.plant(name, positions);
      bank.userData.bankPlant = true; bank.userData.pondPlant = true; bank.geometry.userData.plantingSway = .06;
    }
    // Small, irregular shore colonies leave the swimming water and eastern dock open.
    const lilies = [2.08, 3.47, 4.94].flatMap((angle, clump) => Array.from({ length: clump === 2 ? 4 : 5 }, (_, i) => {
      const a = angle + [0, -.1, .08, -.045, .04][i], r = [.85, .89, .86, .91, .84][(i + clump) % 5];
      return [...this.pondSpace.point(POND.x + Math.cos(a) * POND.rx * r, POND.y + .04, POND.z + Math.sin(a) * POND.rz * r), .65 + (i + clump) % 2 * .22] as const;
    }));
    this.plant("Lily", lilies, this.group, false).userData.pondPlant = true;
    for (let i = 0; i < POND_BIRDS.length; i++) {
      const species = POND_BIRDS[i];
      const root = this.model(species, this.pondSpace.point(...pondBirdRoute(i, 0)));
      const wings: T.Object3D[] = [];
      root.traverse(o => { if (o.name === species + "WingL" || o.name === species + "WingR") wings.push(o); });
      const immersion = root.userData.animalRigSlug ? species === "Swan" ? .16 : species === "Duck" ? .1 : .06 : 0;
      this.birds.push({ root, head: root.getObjectByName(root.userData.animalRigSlug ? "Head" : species + "Head"), wings, phase: i * 1.3, swan: species === "Swan", immersion });
      this.dialogueCues.push(createAnimalDialogueCue(`pond-${species.toLowerCase()}-${i}`, species === "Swan" ? "Honk honk~ (Thank you~)" : "Quack quack~ (Thank you~)", species === "Swan" ? "ホンクホンク〜（ありがとう〜）" : "クワックワッ〜（ありがとう〜）"));
    }
    for (let i = 0; i < 8; i++) {
      const root = this.model("Fish", [0, 0, 0], .85 + i % 4 * .08);
      this.fish.push({ root, tail: root.getObjectByName("FishTail"), jumping: false });
    }
    const rippleGeometry = new T.RingGeometry(.92, 1, 40); rippleGeometry.rotateX(-Math.PI / 2);
    this.ripples = new T.InstancedMesh(rippleGeometry, new T.MeshBasicMaterial({ color: "#d2eee2", transparent: true, opacity: .34, depthWrite: false }), POND_BIRDS.length + 6);
    this.drops = new T.InstancedMesh(new T.SphereGeometry(.024, 6, 4), new T.MeshBasicMaterial({ color: "#b9e9eb", transparent: true, opacity: .8 }), 40);
    this.crumbs = new T.InstancedMesh(new T.IcosahedronGeometry(.036, 0), new T.MeshStandardMaterial({ color: "#ecc88b", roughness: 1 }), 18);
    const heart = new T.Shape();
    heart.moveTo(0, -.48);
    heart.bezierCurveTo(-.15, -.3, -.55, -.05, -.5, .23);
    heart.bezierCurveTo(-.45, .55, -.1, .56, 0, .3);
    heart.bezierCurveTo(.1, .56, .45, .55, .5, .23);
    heart.bezierCurveTo(.55, -.05, .15, -.3, 0, -.48);
    this.hearts = new T.InstancedMesh(new T.ShapeGeometry(heart, 12), new T.MeshBasicMaterial({ color: "#ff9aab", side: T.DoubleSide, depthWrite: false }), POND_BIRDS.length - 3);
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
    const slug = ({ Swan: "swan", Duck: "duck", Duckling: "duckling" } as Record<string, AnimalRigSlug>)[name];
    const root = slug && isAnimalRigLoaded(slug) ? makeAnimalRig(slug) : template.clone(true); root.position.set(position[0], position[1], position[2]); root.scale.multiplyScalar(scale);
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
      this.dummy.position.set(x, y, z); this.dummy.rotation.set(0, name === "Sunflower" ? Math.atan2(this.sunDirection.x, this.sunDirection.z) : Math.sin(i * 7.3) * .3, 0); this.dummy.scale.setScalar(scale); this.dummy.updateMatrix(); mesh.setMatrixAt(i, this.dummy.matrix);
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
      bed.daisy.visible = leafy && i === DAISY_BED;
      if (bed.sunflower) bed.sunflower.visible = leafy && i === SUNFLOWER_BED;
    });
    this.basketContents.forEach(({ crop, root }) => { root.visible = state[CROP_INVENTORY[crop]] > 0; });
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
    if (action.kind === "basket") return;
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
    if (this.sharedClock !== null) time = (Date.now() + this.sharedClock - this.sharedEpoch) / 1000;
    this.time = time; this.wind.value = reduced ? 0 : time; this.breeze.value = reduced ? 0 : 1;
    const t = reduced ? 0 : time, feedAge = time - this.feedAt, feeding = feedAge < 11;
    this.hearts.visible = feedAge >= 7 && feedAge < 13;
    if (!this.feedCelebrated && feedAge >= 7) {
      this.feedCelebrated = true;
      if (feedAge < 11) { const duck = this.birds[3].root.position; this.sound("duck", [duck.x, duck.y, duck.z]); }
    }
    this.birds.forEach((bird, i) => {
      const swim = this.pondSpace.swim(i, time, this.feedAt);
      const targetX = swim[0], targetZ = swim[2];
      const dx = targetX - bird.root.position.x, dz = targetZ - bird.root.position.z;
      const blend = reduced ? 1 : 1 - Math.exp(-dt * .7);
      if (this.sharedClock !== null) {
        bird.root.position.x = targetX; bird.root.position.z = targetZ;
      } else { bird.root.position.x += dx * blend; bird.root.position.z += dz * blend; }
      bird.root.position.y = swim[1] + .015 - bird.immersion + Math.sin(t * 2 + bird.phase) * (reduced ? 0 : .022);
      const happyAge = feedAge - 7 - (i - 3) * .16;
      const happy = !bird.swan && happyAge >= 0 && happyAge < 3.1;
      const joy = happy && !reduced ? Math.sin(Math.min(1, happyAge / 3.1) * Math.PI) : 0;
      bird.root.position.y += Math.abs(Math.sin(happyAge * 5)) * joy * .13;
      bird.root.rotation.z = Math.sin(happyAge * 7) * joy * .09;
      const heading = this.sharedClock !== null ? this.pondSpace.heading(i, time, this.feedAt) : Math.atan2(dx, dz);
      const turn = Math.atan2(Math.sin(heading - bird.root.rotation.y), Math.cos(heading - bird.root.rotation.y));
      bird.root.rotation.y += turn * (this.sharedClock !== null || reduced ? 1 : 1 - Math.exp(-dt * 5));
      const native = animateAnimalRig(bird.root, { action: "swim", time: t + bird.phase, reduced });
      const cue = this.dialogueCues[i]; cue.visible = feedAge >= 7 && feedAge < 11; cue.priority = 3;
      (bird.head ?? bird.root).getWorldPosition(cue.position); cue.position.y += .2;
      const stretchAge = (t + bird.phase * 2) % 29, dipAge = (t + bird.phase * 3) % 17;
      const stretch = !reduced && stretchAge < 2.8 ? Math.sin(stretchAge / 2.8 * Math.PI) : 0;
      const dip = !reduced && dipAge < 2.4 ? Math.sin(dipAge / 2.4 * Math.PI) : 0;
      if (!native) bird.wings.forEach((wing, side) => { wing.rotation.z = reduced ? 0 : (Math.sin(t * (happy ? 13 : feeding ? 8 : 1.7) + bird.phase) * (happy ? .48 : feeding ? .24 : .04) + joy * .18 + stretch * .48) * (side ? 1 : -1); });
      if (!native && bird.head) {
        bird.head.rotation.x = reduced ? 0 : happy ? -joy * .13 : feeding && !bird.swan ? .16 + Math.sin(t * 3 + i) * .16 : dip * (bird.swan ? .24 : .32);
        bird.head.rotation.y = reduced ? 0 : stretch * .24 * Math.sin(bird.phase);
      }
      if (!bird.swan) {
        const scale = happy ? reduced ? .3 : Math.min(1, happyAge * 5, (3.1 - happyAge) * 3) * .4 : 0;
        this.dummy.position.copy(bird.root.position).y += .85 + (reduced ? 0 : Math.max(0, happyAge) * .2);
        this.dummy.quaternion.copy(cameraRotation ?? bird.root.quaternion);
        this.dummy.scale.setScalar(scale); this.dummy.updateMatrix(); this.hearts.setMatrixAt(i - 3, this.dummy.matrix);
      }
      this.dummy.position.set(bird.root.position.x, POND.y + .032, bird.root.position.z);
      this.dummy.rotation.set(0, bird.root.rotation.y, 0); this.dummy.scale.set(bird.swan ? .8 : .48, 1, bird.swan ? 1.1 : .65);
      this.dummy.updateMatrix(); this.ripples.setMatrixAt(i, this.dummy.matrix);
    });
    this.hearts.instanceMatrix.needsUpdate = true;
    this.fish.forEach((fish, i) => {
      const a = t * .15 + i * 1.57, cycle = (t + i * 4.8) % 22;
      const leap = !reduced && cycle < 1.7 ? Math.sin(cycle / 1.7 * Math.PI) : 0;
      const radius = .35 + i % 4 * .11;
      fish.root.position.fromArray(this.pondSpace.point(POND.x + Math.cos(a) * POND.rx * radius, POND.y - .075 + leap * 1.25, POND.z + Math.sin(a) * POND.rz * radius));
      fish.root.rotation.set(leap > 0 ? -Math.cos(cycle / 1.7 * Math.PI) * .72 : 0, Math.atan2(-Math.sin(a), Math.cos(a) * 1.45) + this.pondSpace.yaw, 0);
      if (fish.tail) fish.tail.rotation.y = Math.sin(t * 9 + i) * (reduced ? 0 : .35);
      if (fish.jumping && leap === 0) {
        this.splashAt = time; this.splashPosition.copy(fish.root.position); this.sound("splash", [fish.root.position.x, POND.y, fish.root.position.z]);
      }
      fish.jumping = leap > 0;
    });
    for (let i = this.birds.length; i < this.birds.length + 6; i++) {
      const age = time - this.splashAt, pulse = age + (i - this.birds.length) * .14;
      const scale = age < 2 && !reduced ? pulse * .65 : 0;
      this.dummy.position.set(this.splashPosition.x, POND.y + .035, this.splashPosition.z); this.dummy.scale.set(scale, 1, scale); this.dummy.updateMatrix(); this.ripples.setMatrixAt(i, this.dummy.matrix);
    }
    this.ripples.instanceMatrix.needsUpdate = true;
    this.crumbs.visible = feedAge < 7;
    if (this.crumbs.visible) for (let i = 0; i < 18; i++) {
      const f = reduced ? 1 : Math.min(1, Math.max(0, feedAge / 1.2 - i * .016));
      const from = this.pondSpace.dockPoint(FEED_POSITION), to = this.pondSpace.meal(3 + i % 12);
      this.dummy.position.set(T.MathUtils.lerp(from[0], to[0], f), T.MathUtils.lerp(1.1, POND.y + .04, f) + Math.sin(f * Math.PI) * .65, T.MathUtils.lerp(from[2], to[2], f));
      this.dummy.rotation.set(i, i, i); this.dummy.scale.setScalar(feedAge > 4 ? Math.max(0, 1 - (feedAge - 4) / 3) : 1); this.dummy.updateMatrix(); this.crumbs.setMatrixAt(i, this.dummy.matrix);
    }
    this.crumbs.instanceMatrix.needsUpdate = true;
    this.beds.forEach((bed, i) => {
      bed.scale = reduced ? 1 : T.MathUtils.damp(bed.scale, 1, 3, dt);
      const growth = this.state.beds[i].stage === "growing" ? .18 + growthProgress(this.state.beds[i]) * .82 : 1;
      bed.root.scale.set(1, bed.scale * growth, 1);
      const clock = this.clocks[i], value = this.state.beds[i];
      const now = Date.now(), progress = growthProgress(value, now);
      clock.sprite.visible = value.stage === "growing" && progress < 1;
      const text = growthTimeLeft(value, now);
      if (clock.sprite.visible && clock.text !== text) {
        clock.text = text;
        drawGardenGrowthClock(clock.canvas, text, progress);
        clock.texture.needsUpdate = true;
      }
    });
    const age = time - this.actionAt, action = this.action;
    const watering = age < 2.5 && (action?.kind === "water" || action?.kind === "flowers");
    this.can.visible = watering;
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
    }
    this.harvest.visible = !reduced && age < 1.6 && action?.kind === "harvest";
    if (this.harvest.visible && action) {
      const origin = "bed" in action ? [BEDS[action.bed].x, .4, BEDS[action.bed].z] : MINT_POSITION;
      const f = Math.min(1, age / 1.6);
      const crop = this.state.beds[(action as { bed: number }).bed].crop;
      const name = CROP_MODELS[crop];
      if (this.harvest.name !== name) { this.harvest.removeFromParent(); this.harvest = this.model(name, origin); }
      this.harvest.position.set(T.MathUtils.lerp(origin[0], HARVEST_BASKET[0], f), .6 + Math.sin(f * Math.PI) * 1.5, T.MathUtils.lerp(origin[2], HARVEST_BASKET[2], f)); this.harvest.rotation.y = age * 2;
    }
    const teaAge = time - this.teaAt, pour = teaAge < 2.5 && !reduced ? Math.sin(teaAge / 2.5 * Math.PI) : 0;
    this.teapot.position.set(15 + pour * .04, 1.28 + pour * .25, -10.3 + pour * .25); this.teapot.rotation.z = -pour * .6;
  }

  dispose() {
    this.birds.forEach(bird => disposeAnimalRig(bird.root));
    for (const clock of this.clocks) { clock.texture.dispose(); clock.sprite.material.dispose(); }
    // Original template geometry also includes unused alternatives; release those on teardown.
    this.source.traverse(o => { if (o instanceof T.Mesh) o.geometry.dispose(); });
  }
}

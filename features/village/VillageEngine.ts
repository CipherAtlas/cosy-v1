import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { makeFlame } from "./flame";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { buildWorld, type VillageBench, type World } from "./world";
import { VillageMovement } from "./movement";
import { createAtmosphere } from "./atmosphere";
import { BirdFlock, type BirdStatus } from "./birds";
import { VillageLife } from "./life";
import { CompanionHands } from "./companionWalk";
import { VillagerDialogue } from "./dialogue";
import { VillageActivities, ACTIVITY_STAGES } from "./activityScene";
import { GardenScene } from "./gardenScene";
import { GARDEN_TARGETS, HARVEST_COMPLIMENTS, freshGarden, nearbyGardenAction, type GardenState, type GardenAction, type GardenSound } from "./garden";
import type { ActivityMoment } from "./environment";
import { skipDistantPointLights, softenShadowEdges } from "./shadows";
import { GRAPHICS_TIERS, graphicsPixelRatio, initialGraphicsTier, slowerGraphicsTier, type GraphicsTier } from "./graphics";
import { BIRD_CLEARING, BRIDGE, floorHeight, windAt, type MovementStatus, type WorldContact, type EnvironmentFrame } from "./environment";
import { PLACES, type PlaceId, type Quality, type Weather } from "./places";
import { withBasePath } from "@/lib/basePath";
import type { SharedChatEntry, SharedVisitor } from "./sharedWorld";
import { makeBridgeWindow, makeCoffeeCup, makeDeskInkwell, makeDeskJournal } from "./focusCottageProps";

export class VillageEngine {
  readonly renderer: T.WebGLRenderer;
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(55, 1, 0.12, 1100);
  private atmosphere = createAtmosphere();
  private life?: VillageLife;
  private companionHands = new CompanionHands();
  private birds?: BirdFlock;
  private birdFeedAt = -100;
  private dialogue?: VillagerDialogue;
  private activities?: VillageActivities;
  private garden?: GardenScene;
  private gardenState = freshGarden();
  private companions: string[] = [];
  private nearGarden: string | null = null;
  private walkingHeading = Math.PI;
  private language: "en" | "ja" = "en";
  private world?: World;
  private environment?: T.WebGLRenderTarget;
  private skyTexture?: T.DataTexture;
  private player = new T.Group();
  private character?: T.Object3D;
  private remoteVisitors = new Map<string, { name: string; slot: number; group: T.Group; target: T.Vector3; heading: number; label: HTMLDivElement }>();
  private chatBubbles = new Map<string, { element: HTMLDivElement; timer: number }>();
  private sharedSlot: number | null = null;
  private sharedColor: string | null = null;
  private sharedSpawnPlaced = false;
  private visitorLabelPoint = new T.Vector3();
  private movement?: VillageMovement;
  private running = false;
  private lastStatus = "";
  private statusTime = 0;
  private environmentTime = 0;
  private shadowTime = 0;
  private spiritFins: T.Object3D[] = [];
  private spiritScale = 1;
  private audioForward = new T.Vector3();
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0.15;
  private mouseSensitivity = 1;
  private distance = 3.8;
  private teaPanAt = -100;
  private teaPan = 1;
  private teaPanHeld = false;
  private activityOrbit = { yaw: 0, pitch: 0 };
  private orbit = new T.Spherical();
  private pointer?: {
    id: number;
    x: number;
    y: number;
  };
  private mouseLook: "free" | "locked" | "drag" = "free";
  private wantsMouseLook = false;
  private pointerLockPending = false;
  private lastTime = 0;
  private elapsed = 0;
  private resizeObserver: ResizeObserver;
  private disposed = false;
  private blocked = false;
  private place: PlaceId | null = null;
  private near: PlaceId | null = null;
  private nearBench: VillageBench | null = null;
  private seatedBench: VillageBench | null = null;
  private seatedIndex: 0 | 1 | null = null;
  private quality: Quality = "low";
  private graphicsTier: GraphicsTier = "battery";
  private detailedRenderScale = 1;
  private sceneryPrepareId = 0;
  private qualityChangedAt = 0;
  private slowSamples = 0;
  private frameSum = 0;
  private frames = 0;
  private statsTime = 0;
  private lowestFps = Infinity;
  private longestFrameMs = 0;
  private longestRenderSubmitMs = 0;
  private lastSceneryPrepareMs = 0;
  private reducedMotion = false;
  private motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  private sun = new T.DirectionalLight("#ffe0ad", 4.1);
  private weatherBlend = { rain: 0, dusk: 0, night: 0 };
  private bounce = new T.DirectionalLight("#c4d9ef", .48);
  private lightColor = new T.Color();
  private fill = new T.HemisphereLight("#bdd7f2", "#6b6550", .9);
  private cameraGoal = new T.Vector3();
  private lookGoal = new T.Vector3();
  private currentLook = new T.Vector3();
  private compactView = false;
  private direction = new T.Vector3();
  private temp = new T.Vector3();
  private indoor?: T.Group;
  private coffeeSteam: T.Mesh[] = [];
  private bridgeWindow?: T.WebGLRenderTarget;
  private bridgeCamera = new T.PerspectiveCamera(56, 576 / 512, .12, 1100);
  private bridgeWindowTime = -1000;
  private rain?: T.LineSegments;
  private weather: Weather = "golden";
  private collisionBox = new T.Box3();
  private cameraRay = new T.Ray();
  private cameraHit = new T.Vector3();
  private treeFrustum = new T.Frustum();
  private viewProjection = new T.Matrix4();
  private indoorLight = new T.PointLight("#ffb569", 0, 12, 1.7);
  private spiritLights = [new T.PointLight("#ffd17d", 0, 5, 2)];
  private spiritGlowColor = new T.Color("#ffd58e");
  private spiritGlowApplied = -1;
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      if (this.seatedBench && !this.blocked) this.stand();
      this.releaseMouseLook();
      this.clearKeys();
      return;
    }
    if (
      this.blocked || this.place ||
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement ||
      e.target instanceof HTMLButtonElement ||
      (e.target instanceof HTMLElement && e.target.isContentEditable)
    )
      return;
    if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)
    )
      e.preventDefault();
    this.keys.add(e.key.toLowerCase());
    if (e.key === " " && !e.repeat && !this.seatedBench) this.movement?.jump();
    if (e.key.toLowerCase() === "r" && !e.repeat) this.toggleRun();
    if (e.key.toLowerCase() === "f" && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) this.dialogue?.talk();
    if (e.key.toLowerCase() === "c" && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) this.dialogue?.invite();
    if (e.key.toLowerCase() === "b" && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) this.dialogue?.bread();
    if (e.key.toLowerCase() === "e" && !e.repeat && !this.place) {
      if (this.seatedBench) this.stand();
      else if (this.nearBench) this.sit(this.nearBench.id);
      else if (this.nearGarden && nearbyGardenAction(this.nearGarden, this.gardenState)) this.callbacks.gardenInteract?.(this.nearGarden);
      else if (this.near === "birds") this.callbacks.scatterBirds?.();
      else if (this.near && this.near !== "garden") this.callbacks.interact(this.near);
    }
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
  private clearKeys = () => {
    this.keys.clear();
    if (this.pointer && this.renderer.domElement.hasPointerCapture(this.pointer.id))
      this.renderer.domElement.releasePointerCapture(this.pointer.id);
    this.pointer = undefined;
    this.movement?.pause();
  };
  private onBlur = () => {
    this.releaseMouseLook();
    this.clearKeys();
  };
  private onVisibility = () => {
    this.clearKeys();
    if (document.hidden) this.releaseMouseLook();
    this.lastTime = 0;
    this.frameSum = this.frames = this.slowSamples = 0;
    this.statsTime = this.qualityChangedAt = performance.now();
  };
  private motionChange = () => {
    this.reducedMotion = this.motionQuery.matches;
  };
  private onDown = (e: PointerEvent) => {
    if (this.blocked || e.button !== 0 || this.pointer) return;
    this.renderer.domElement.focus({ preventScroll: true });
    if (document.pointerLockElement === this.renderer.domElement) return;
    this.pointer = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
    };
    if (e.pointerType === "mouse" && !this.place) this.captureMouse();
    else this.renderer.domElement.setPointerCapture(e.pointerId);
  };
  private onMove = (e: PointerEvent) => {
    if (!this.pointer || e.pointerId !== this.pointer.id || this.blocked
      || (!this.place && e.pointerType === "mouse" && this.mouseLook !== "drag")) return;
    const dx = e.clientX - this.pointer.x,
      dy = e.clientY - this.pointer.y;
    const lookStep = .004 * (e.pointerType === "mouse" ? this.mouseSensitivity : 1);
    if (this.place) {
      this.teaPanHeld = true;
      this.activityOrbit.yaw = T.MathUtils.euclideanModulo(this.activityOrbit.yaw - dx * lookStep + Math.PI, Math.PI * 2) - Math.PI;
      this.activityOrbit.pitch = T.MathUtils.clamp(this.activityOrbit.pitch + dy * lookStep, -.8, .9);
    } else {
      this.yaw -= dx * lookStep;
      this.pitch = T.MathUtils.clamp(this.pitch + dy * lookStep, -0.85, 1.35);
    }
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
  };
  private onUp = (e: PointerEvent) => {
    if (this.pointer?.id !== e.pointerId) return;
    this.pointer = undefined;
    if (this.renderer.domElement.hasPointerCapture(e.pointerId)) this.renderer.domElement.releasePointerCapture(e.pointerId);
  };
  private onMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement !== this.renderer.domElement || this.blocked || this.place) return;
    this.yaw -= e.movementX * .004 * this.mouseSensitivity;
    this.pitch = T.MathUtils.clamp(this.pitch + e.movementY * .004 * this.mouseSensitivity, -.85, 1.35);
  };
  private setMouseLook(mode: "free" | "locked" | "drag") {
    if (this.mouseLook === mode) return;
    this.mouseLook = mode;
    this.callbacks.mouseLook?.(mode);
  }
  private onPointerLockChange = () => {
    this.pointerLockPending = false;
    if (this.disposed) {
      this.releaseMouseLook();
      document.removeEventListener("pointerlockchange", this.onPointerLockChange);
      document.removeEventListener("pointerlockerror", this.onPointerLockError);
      return;
    }
    if (document.pointerLockElement === this.renderer.domElement) {
      if (!this.wantsMouseLook || this.blocked || this.place || this.disposed || document.hidden) {
        this.releaseMouseLook();
        return;
      }
      this.pointer = undefined;
      this.setMouseLook("locked");
    } else {
      this.wantsMouseLook = false;
      this.clearKeys();
      this.setMouseLook("free");
    }
  };
  private onPointerLockError = () => {
    this.pointerLockPending = false;
    if (this.disposed) {
      document.removeEventListener("pointerlockchange", this.onPointerLockChange);
      document.removeEventListener("pointerlockerror", this.onPointerLockError);
    }
    if (this.wantsMouseLook && !this.disposed && !this.blocked && !this.place) this.setMouseLook("drag");
    this.wantsMouseLook = false;
  };
  captureMouse() {
    const canvas = this.renderer.domElement;
    if (this.blocked || this.place || this.disposed || !this.world || document.hidden
      || this.pointerLockPending || document.pointerLockElement === canvas) return;
    this.wantsMouseLook = true;
    this.pointerLockPending = true;
    if (!canvas.requestPointerLock) { this.onPointerLockError(); return; }
    try {
      const request = canvas.requestPointerLock();
      request?.catch(this.onPointerLockError);
    } catch { this.onPointerLockError(); }
  }
  private releaseMouseLook() {
    this.wantsMouseLook = false;
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    this.setMouseLook("free");
  }
  private onWheel = (e: WheelEvent) => {
    if (this.blocked || this.place) return;
    e.preventDefault();
    this.distance = T.MathUtils.clamp(this.distance + e.deltaY * 0.004, 2.2, 12);
  };
  private onLost = (e: Event) => {
    e.preventDefault();
    this.releaseMouseLook();
    this.clearKeys();
    this.renderer.setAnimationLoop(null);
    this.callbacks.error(
      "The 3D view was interrupted. Please retry the village.",
    );
  };
  constructor(
    private host: HTMLElement,
    private callbacks: {
      progress: (n: number) => void;
      ready: () => void;
      near: (id: PlaceId | null) => void;
      nearBench?: (id: string | null) => void;
      seat?: (id: string | null) => void;
      scatterBirds?: () => void;
      interact: (id: PlaceId) => void;
      error: (message: string) => void;
      stats: (fps: number, draws: number, triangles: number) => void;
      movement: (status: MovementStatus) => void;
      contact: (event: WorldContact) => void;
      environment: (frame: EnvironmentFrame) => void;
      mouseLook?: (mode: "free" | "locked" | "drag") => void;
      companion?: (id: string) => void;
      crumbs?: (id: string) => void;
      birds?: (status: BirdStatus) => void;
      visitTea?: () => void;
      gardenSound?: (kind: GardenSound, position: [number, number, number]) => void;
      nearGarden?: (id: string | null) => void;
      gardenInteract?: (id: string) => void;
    },
  ) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Walkable Hearthwillow village. Use arrow keys or WASD to move, R to glide faster, hold Shift to run, Space to jump. Click to capture the mouse, move it to look, and press Escape to release. While settled into an activity, drag the scene to look around. On touch screens, drag to look and use the movement buttons. E to tend nearby plants, sit, or enter activities; Enter to chat; F to chat with a villager; C to invite a nearby villager; B to ask Maple or Wren for crumbs when close.",
    );
    this.renderer.domElement.tabIndex = 0;
    this.host.appendChild(this.renderer.domElement);
    this.scene.fog = new T.FogExp2("#c3c3a8", 0.004);
    this.sun.position.set(35, 28, -48);
    this.bounce.position.set(-15, 12, 25);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -24,
      right: 24,
      top: 27,
      bottom: -27,
      near: 1,
      far: 130,
    });
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.radius = 3.5;
    this.scene.add(this.sun.target);
    this.scene.add(
      this.sun,
      this.fill,
      this.bounce,
      this.indoorLight,
      ...this.spiritLights,
      new T.AmbientLight("#e9d9ba", 0.08),
    );
    this.player.position.set(0.3, 0, 20);
    this.player.rotation.y = Math.PI;
    this.scene.add(this.player);
    this.camera.position.set(0.3, 2.0, 23.8);
    this.currentLook.set(0.3, 1.35, 20);
    this.camera.lookAt(this.currentLook);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    document.addEventListener("pointerlockerror", this.onPointerLockError);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.motionQuery.addEventListener("change", this.motionChange);
    this.motionChange();
    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerup", this.onUp);
    el.addEventListener("pointercancel", this.clearKeys);
    el.addEventListener("lostpointercapture", this.onUp);
    el.addEventListener("pointerleave", this.onUp);
    el.addEventListener("wheel", this.onWheel, { passive: false });
    el.addEventListener("webglcontextlost", this.onLost);
  }
  async load() {
    const [world, gltf, gardenKit, dove] = await Promise.all([
      buildWorld(this.callbacks.progress, this.renderer),
      new GLTFLoader().loadAsync(
        withBasePath("/village/models/spirit.glb?v=1"),
      ),
      new GLTFLoader().loadAsync(withBasePath("/village/models/garden-pond.glb?v=2")),
      new GLTFLoader().loadAsync(withBasePath("/village/models/dove.glb?v=1")),
    ]);
    if (this.disposed) {
      world.dispose();
      return;
    }
    this.world = world;
    world.setLanguage(this.language);
    this.movement = new VillageMovement(world.colliders, event => {
      // A floating spirit has no footfalls; jump/landing events retain the movement contract.
      if (event.kind !== "footstep") this.callbacks.contact(event);
    });
    this.scene.add(world.group);
    try {
      const texture = await new HDRLoader().loadAsync(
        withBasePath("/village/textures/sunset.hdr"),
      );
      if (this.disposed) {
        texture.dispose();
        return;
      }
      texture.mapping = T.EquirectangularReflectionMapping;
      this.skyTexture = texture;
      const pmrem = new T.PMREMGenerator(this.renderer);
      this.environment = pmrem.fromEquirectangular(texture);
      pmrem.dispose();
      this.scene.environment = this.environment.texture;
      this.scene.environmentIntensity = 0.26;
      this.scene.environmentRotation.set(0, 1.67, 0);
    } catch {
      /* Directional and hemisphere lighting also work without the environment map. */
    }
    this.scene.add(this.atmosphere.sky);

    const root = gltf.scene;
    const b = new T.Box3().setFromObject(root),
      height = b.getSize(new T.Vector3()).y;
    this.spiritScale = .95 / height;
    root.scale.setScalar(this.spiritScale);
    root.position.y = .62 - b.min.y * this.spiritScale;
    root.traverse((o) => {
      if (o.name.startsWith("SpiritFin")) this.spiritFins.push(o);
      if (o instanceof T.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.player.add(root);
    this.character = root;
    if (this.sharedColor) this.tintSpirit(root, this.sharedColor, false);
    this.placeSharedSpawn();
    this.garden = new GardenScene(gardenKit.scene, world.colliders, (kind, position) => this.callbacks.gardenSound?.(kind, position), world.gardenSurfaces, this.sun.position.clone().sub(this.sun.target.position));
    this.garden.setLanguage(this.language);
    this.garden.sync(this.gardenState); world.group.add(this.garden.group);
    this.activities=new VillageActivities(this.world.colliders);
    this.world.group.add(this.activities.outdoor);this.scene.add(this.activities.indoor);
    this.life = new VillageLife(root, world.colliders, gardenKit.scene, world.authored);
    this.life.setCompanions(this.companions);
    this.scene.add(this.life.group);
    this.birds = new BirdFlock(dove.scene, this.host, status => {
      this.callbacks.birds?.(status);
      if (status === "happy") this.callbacks.gardenSound?.("coo", [BIRD_CLEARING.x, .6, BIRD_CLEARING.z]);
    }, caretaker => {
      if (caretaker) this.life?.feedBirds();
      this.callbacks.gardenSound?.("crumbs", [BIRD_CLEARING.x, .4, BIRD_CLEARING.z]);
    });
    this.scene.add(this.birds.group);
    this.dialogue = new VillagerDialogue(this.host, this.life, world.colliders, this.clearKeys, {
      companion: id => this.callbacks.companion?.(id), crumbs: id => this.callbacks.crumbs?.(id), visitTea: () => this.callbacks.visitTea?.(),
    });
    this.dialogue.setLanguage(this.language);
    this.dialogue.setEnabled(!this.blocked && !this.place);
    this.resize();
    this.buildInterior();
    skipDistantPointLights();
    softenShadowEdges(this.scene);
    const rainGeometry = new T.BufferGeometry(),
      rainPositions = new Float32Array(1200 * 6);
    for (let i = 0; i < 1200; i++) {
      const x = (Math.random() - 0.5) * 34,
        y = Math.random() * 17,
        z = (Math.random() - 0.5) * 34;
      rainPositions.set([x, y, z, x - 0.05, y + 0.4, z], i * 6);
    }
    rainGeometry.setAttribute(
      "position",
      new T.BufferAttribute(rainPositions, 3),
    );
    this.rain = new T.LineSegments(
      rainGeometry,
      new T.LineBasicMaterial({
        color: "#c9dbd9",
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    );
    this.rain.visible = false;
    this.scene.add(this.rain);
    this.callbacks.progress(100);
    this.callbacks.ready();
    this.applyGraphicsTier();
    this.renderer.setAnimationLoop((t) => this.frame(t));
  }
  private buildInterior() {
    // A compact furnished cottage interior, loaded with the shared world materials.
    const g = new T.Group();
    g.position.set(110, 0, 0);
    this.scene.add(g);
    this.indoor = g;
    g.visible = false;
    const materials: T.Material[] = [];
    this.world?.group.traverse((o) => {
      if (o instanceof T.Mesh && !Array.isArray(o.material))
        materials.push(o.material);
    });
    const woodSource =
      materials.find(
        (m) =>
          m instanceof T.MeshStandardMaterial &&
          m.name === "Village oak",
      ) || new T.MeshStandardMaterial({ color: "#644d32" });
    const stoneSource =
      materials.find(
        (m) =>
          m instanceof T.MeshStandardMaterial &&
          m.name === "Village limestone",
      ) || new T.MeshStandardMaterial({ color: "#888374" });
    const wooden = (woodSource as T.MeshStandardMaterial).clone();
    wooden.vertexColors = false; wooden.color.set("#efd5aa"); wooden.roughness = .82;
    const stone = (stoneSource as T.MeshStandardMaterial).clone();
    stone.vertexColors = false; stone.color.set("#dbceb2");
    const plaster = new T.MeshStandardMaterial({
      color: "#ddc6a2",
      roughness: 1,
    });
    const cube = (
      m: T.Material,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
    ) => {
      const o = new T.Mesh(new T.BoxGeometry(w, h, d), m);
      o.position.set(x, y, z);
      o.receiveShadow = true;
      o.castShadow = true;
      g.add(o);
      return o;
    };
    cube(wooden, 0, -0.13, 0, 9, 0.2, 9);
    cube(wooden, 0, 4.9, 0, 9, 0.15, 9);
    cube(plaster, 0, 2.5, -4.5, 9, 5, 0.25);
    cube(plaster, 0, 2.5, 4.5, 9, 5, 0.25);
    cube(plaster, 4.5, 2.5, 0, 0.25, 5, 9);
    cube(plaster, -4.5, 2.5, 0, 0.25, 5, 9);
    const panel = wooden.clone(); panel.color.set("#ba916b");
    // The room remains enclosed when the focus camera is dragged around the desk.
    for (const z of [-4.31, 4.31]) {
      cube(panel, 0, .58, z, 8.8, 1.16, .085);
      cube(wooden, 0, 1.2, z + (z > 0 ? -.07 : .07), 8.8, .11, .15);
      for (let x = -4.25; x <= 4.25; x += .85) cube(wooden, x, .55, z + (z > 0 ? -.07 : .07), .055, 1.05, .11);
    }
    for (const x of [-4.31, 4.31]) {
      cube(panel, x, .58, 0, .085, 1.16, 8.8);
      cube(wooden, x + (x > 0 ? -.07 : .07), 1.2, 0, .15, .11, 8.8);
      for (let z = -4.25; z <= 4.25; z += .85) cube(wooden, x + (x > 0 ? -.07 : .07), .55, z, .11, 1.05, .055);
    }
    for (const x of [-4, -2, 0, 2, 4]) {
      cube(wooden, x, 4.5, 0, 0.2, 0.2, 9);
    }
    for (const x of [-4, 0, 2, 4]) cube(wooden, x, 2.2, -4.3, 0.18, 4.5, 0.18);
    this.bridgeWindow = new T.WebGLRenderTarget(384, 342, { depthBuffer: true });
    this.bridgeWindow.texture.colorSpace = T.SRGBColorSpace;
    const window = makeBridgeWindow(this.bridgeWindow.texture);
    window.position.set(-2.1, 1.23, -4.12);
    g.add(window);
    cube(wooden, -1.6, 1, -2, 3, 0.16, 1.4);
    for (const x of [-2.85, -0.35])
      for (const z of [-2.5, -1.5]) cube(wooden, x, 0.45, z, 0.12, 0.95, 0.12);
    const journal = makeDeskJournal();
    journal.position.set(-1.55, 1.08, -1.95);
    journal.rotation.y = .12;
    g.add(journal);
    const inkwell = makeDeskInkwell();
    inkwell.position.set(-1.15, 1.08, -1.8);
    g.add(inkwell);
    const coffeeCup = makeCoffeeCup();
    coffeeCup.position.set(-.65, 1.08, -1.85);
    coffeeCup.traverse(object => {
      if (object instanceof T.Mesh && object.name.startsWith("Coffee steam")) this.coffeeSteam.push(object);
    });
    g.add(coffeeCup);
    cube(stone, 2.7, 1.35, -4.05, 2.5, 2.7, 0.65);
    cube(
      new T.MeshBasicMaterial({ color: "#271b12" }),
      2.7,
      0.75,
      -3.7,
      1.65,
      1.45,
      0.02,
    );
    const embers=new T.MeshStandardMaterial({color:"#6b2b12",emissive:"#f27b23",emissiveIntensity:1.1,roughness:1});
    const charred=wooden.clone();charred.color.set("#3a2117");charred.roughness=1;
    for(let i=0;i<5;i++) {
      const log=new T.Mesh(new T.CylinderGeometry(.095,.13,1.05,10),charred);
      log.position.set(2.7+Math.sin(i*2.3)*.22,.38+(i%2)*.12,-3.38+Math.cos(i*2.3)*.14);
      log.rotation.set(Math.PI/2,i*.9,.14);log.castShadow=log.receiveShadow=true;g.add(log);
    }
    for(let i=0;i<16;i++) {
      const ember=new T.Mesh(new T.IcosahedronGeometry(.075+(i%3)*.016,0),embers);
      ember.position.set(2.7+Math.sin(i*2.4)*.57,.32,-3.42+Math.cos(i*2.4)*.24);ember.scale.y=.45;g.add(ember);
    }
    const hearthGlow = new T.Mesh(new T.PlaneGeometry(1.55, 1.3), new T.MeshBasicMaterial({ color: "#ff9f4c", transparent: true, opacity: .28, depthWrite: false }));
    hearthGlow.position.set(2.7, .87, -3.67); g.add(hearthGlow);
    const firelight = new T.Mesh(new T.CircleGeometry(1.5, 32), new T.MeshBasicMaterial({ color: "#ffb663", transparent: true, opacity: .14, depthWrite: false }));
    firelight.rotation.x = -Math.PI / 2; firelight.scale.y = .55; firelight.position.set(2.4, .025, -2.25); g.add(firelight);
    cube(wooden, 2.7, 2.75, -3.9, 2.8, 0.18, 0.9);
    const f = makeFlame(1.2, 1.1);
    f.position.set(112.7, .82, -3.38);this.scene.add(f);
    f.visible=false;f.userData.interior=true;f.userData.light=this.indoorLight;f.userData.coal=embers;
    this.world?.flames.push(f);
    const cloth = new T.MeshStandardMaterial({ color: "#b26756", roughness: 1 });
    const linen = new T.MeshStandardMaterial({ color: "#c6ba97", roughness: 1, side: T.DoubleSide });
    cube(cloth, -.6, .006, .1, 4.8, .018, 3.2);
    for (const z of [-1.37, -1.25, 1.42, 1.54]) cube(linen, -.6, .021, z, 4.6, .012, .025);
    for (const x of [-2.85, 1.65]) cube(linen, x, .021, .1, .025, .012, 2.85);
    // A grounded spindle chair, tucked beside the writing desk.
    cube(wooden, -1.4, .56, -.7, .7, .12, .72);
    for (const x of [-1.69, -1.11]) for (const z of [-.98, -.42]) cube(wooden, x, .26, z, .065, .52, .065);
    for (const x of [-1.7, -1.55, -1.4, -1.25, -1.1]) cube(wooden, x, .98, -.39, .045, .78, .045);
    cube(wooden, -1.4, 1.39, -.39, .74, .1, .1);
    cube(cloth, -1.4, .65, -.7, .62, .08, .61);
    for (const x of [-3.95, -.24]) {
      const curtain = new T.PlaneGeometry(.52, 2.7, 12, 1);
      const vertices = curtain.attributes.position;
      for (let i = 0; i < vertices.count; i++) vertices.setZ(i, Math.sin(vertices.getX(i) * 34) * .045);
      curtain.computeVertexNormals(); const mesh = new T.Mesh(curtain, linen);
      mesh.position.set(x, 2.5, -3.99); g.add(mesh);
    }
    cube(wooden, -2.1, 3.98, -4, 3.72, .065, .065);
    for (const side of [-1, 1]) for (let row = 0; row < 5; row++) cube(stone, 2.7 + side * 1.02, .23 + row * .44, -3.53, .35, .39, .42);
    for (let i = 0; i < 7; i++) cube(stone, 1.84 + i * .285, 2.4, -3.48, .26, .3, .48);
    cube(wooden, 1.5, 3.45, -4.04, 3.4, .12, .55);
    const pottery = new T.MeshStandardMaterial({ color: "#70877b", roughness: .55 });
    for (const [x, scale] of [[.25, .18], [1, .23], [2.45, .15]]) {
      const vase = new T.Mesh(new T.LatheGeometry([new T.Vector2(.45, 0), new T.Vector2(.75, .3), new T.Vector2(.8, 1), new T.Vector2(.35, 1.5), new T.Vector2(.38, 1.8)], 16), pottery);
      vase.scale.setScalar(scale); vase.position.set(x, 3.51, -4.02); g.add(vase);
    }
    const windowBounce = new T.PointLight("#ffd19a", 7, 8, 2);
    windowBounce.position.set(-2.1, 2.7, -3.3); g.add(windowBounce);
    // Batch static furniture while retaining light and flame objects independently.
    g.updateMatrixWorld(true);
    const interiorInverse = g.matrixWorld.clone().invert();
    const batches = new Map<T.Material, T.BufferGeometry[]>();
    const pieces: T.Mesh[] = [];
    g.traverse(o => {
      if (!(o instanceof T.Mesh) || Array.isArray(o.material) || o.material.transparent) return;
      const geometry = o.geometry.clone().applyMatrix4(interiorInverse.clone().multiply(o.matrixWorld));
      const list = batches.get(o.material) ?? []; list.push(geometry); batches.set(o.material, list); pieces.push(o);
    });
    pieces.forEach(o => { o.removeFromParent(); o.geometry.dispose(); });
    batches.forEach((parts, material) => {
      const geometry = mergeGeometries(parts); parts.forEach(p => p.dispose());
      if (geometry) { const mesh = new T.Mesh(geometry, material); g.add(mesh); }
    });
    this.indoorLight.position.set(112.7, 2, -2.8);
  }
  private renderBridgeWindow(now: number, time: number) {
    const interval = this.graphicsTier === "minimal" ? 50 : 33;
    if (this.place !== "focus" || !this.bridgeWindow || !this.world || now - this.bridgeWindowTime < interval) return;
    this.bridgeWindowTime = now;
    const windowCamera = this.bridgeCamera;
    // Offset the outdoor viewpoint with the indoor eye for a small amount of parallax.
    windowCamera.position.set(
      1.6 + T.MathUtils.clamp((this.camera.position.x - 111.3) * .24, -.8, .8),
      4.2 + T.MathUtils.clamp((this.camera.position.y - 2.65) * .18, -.35, .35),
      10.5 + T.MathUtils.clamp((this.camera.position.z - 2.5) * .2, -.6, .6),
    );
    windowCamera.lookAt(BRIDGE.x, 1.1, BRIDGE.z);
    const indoorVisible = this.indoor?.visible ?? false;
    const worldVisible = this.world.group.visible;
    const residentVisibility = this.life?.residents.map(resident => resident.root.visible);
    if (this.indoor) this.indoor.visible = false;
    this.world.group.visible = true;
    this.life?.residents.forEach(resident => { resident.root.visible = !resident.following; });
    this.atmosphere.update(time, windowCamera.position);
    this.renderer.setRenderTarget(this.bridgeWindow);
    this.renderer.render(this.scene, windowCamera);
    this.renderer.setRenderTarget(null);
    this.atmosphere.update(time, this.camera.position);
    this.world.group.visible = worldVisible;
    if (this.indoor) this.indoor.visible = indoorVisible;
    this.life?.residents.forEach((resident, index) => { resident.root.visible = residentVisibility?.[index] ?? true; });
  }
  private resize() {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    this.statsTime = this.qualityChangedAt = performance.now();
    this.frameSum = this.frames = this.slowSamples = 0;
    this.renderer.setPixelRatio(graphicsPixelRatio(this.graphicsTier, w, h, window.devicePixelRatio) *
      (this.graphicsTier === "detailed" ? this.detailedRenderScale : 1));
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.compactView = w <= 700;
    this.camera.clearViewOffset();
    if (this.place) {
      this.camera.setViewOffset(w,h,w>700?w*.16:0,w>700?0:h*.18,w,h);
    }
    this.camera.updateProjectionMatrix();
    this.dialogue?.resize(w, h);
    this.birds?.resize(w, h);
  }
  setBlocked(v: boolean) {
    this.blocked = v;
    this.dialogue?.setEnabled(!v && !this.place);
    if (v) {
      this.releaseMouseLook();
      this.clearKeys();
    }
  }
  setLanguage(language: "en" | "ja") {
    this.language = language;
    this.dialogue?.setLanguage(language);
    this.birds?.setLanguage(language);
    this.world?.setLanguage(language);
    this.garden?.setLanguage(language);
  }
  setMouseSensitivity(value: number) {
    if (Number.isFinite(value)) this.mouseSensitivity = T.MathUtils.clamp(value, .25, 2);
  }
  setQuality(q: Quality) {
    this.quality = q;
    this.graphicsTier = initialGraphicsTier(q);
    if (q === "high") this.detailedRenderScale = 1;
    this.applyGraphicsTier();
  }
  private applyGraphicsTier() {
    const budget = GRAPHICS_TIERS[this.graphicsTier];
    const windowWidth = this.graphicsTier === "detailed" ? 384 : this.graphicsTier === "battery" ? 320 : 256;
    this.bridgeWindow?.setSize(windowWidth, Math.round(windowWidth * 512 / 576));
    this.qualityChangedAt = this.statsTime = performance.now();
    this.frameSum = this.frames = this.slowSamples = 0;
    this.renderer.shadowMap.enabled = budget.shadowSize > 0;
    // Changing the light's shadow count also invalidates Three's cached lighting shaders.
    this.sun.castShadow = this.renderer.shadowMap.enabled;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = this.place !== "focus";
    const shadowSize = budget.shadowSize || 512;
    if (this.sun.shadow.mapSize.x !== shadowSize) {
      this.sun.shadow.map?.dispose(); this.sun.shadow.map = null;
      this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    }
    this.world?.vegetation.forEach(mesh => {
      if (mesh.userData.fullCount === undefined) mesh.userData.fullCount = mesh.count;
      mesh.count = Math.floor(mesh.userData.fullCount * budget.vegetation);
    });
    this.resize();
  }
  getPerformanceReport() {
    const gl = this.renderer.getContext();
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      graphicsVersion: "pixel-budget-v1",
      browser: navigator.userAgent,
      gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      viewport: [this.host.clientWidth, this.host.clientHeight],
      devicePixelRatio: window.devicePixelRatio,
      drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
      preference: this.quality,
      tier: this.graphicsTier,
      detailedRenderScale: this.detailedRenderScale,
      shadows: this.renderer.shadowMap.enabled,
      antialias: gl.getContextAttributes()?.antialias,
      contextLost: gl.isContextLost(),
      weather: this.weather,
      lowestFps: Number.isFinite(this.lowestFps) ? this.lowestFps : null,
      longestFrameMs: Math.round(this.longestFrameMs),
      longestRenderSubmitMs: Math.round(this.longestRenderSubmitMs),
      lastSceneryPrepareMs: Math.round(this.lastSceneryPrepareMs),
      shaderPrograms: this.renderer.info.programs?.length ?? 0,
    };
  }
  setWeather(w: Weather) {
    this.weather = w;
    this.renderer.shadowMap.needsUpdate = this.place !== "focus";
  }
  async prepareWeather(w: Weather) {
    if (this.disposed || !this.world || this.weather === w) return;
    const prepareId = ++this.sceneryPrepareId;
    const start = performance.now();
    this.renderer.setAnimationLoop(null);
    this.clearKeys();
    this.setWeather(w);
    this.weatherBlend.rain = w === "rain" ? 1 : 0;
    this.weatherBlend.dusk = w === "dusk" ? 1 : 0;
    this.weatherBlend.night = w === "night" ? 1 : 0;
    this.updateLighting(0);
    this.updateSpiritLights();
    if (this.rain) this.rain.visible = w === "rain" && this.place !== "focus";
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
      if (this.disposed || prepareId !== this.sceneryPrepareId) return;
      const now = performance.now();
      this.bridgeWindowTime = -1000;
      this.renderBridgeWindow(now, this.elapsed);
      this.renderer.shadowMap.needsUpdate = this.place !== "focus";
      this.renderer.render(this.scene, this.camera);
    } finally {
      if (!this.disposed && prepareId === this.sceneryPrepareId && !this.renderer.getContext().isContextLost()) {
        this.lastSceneryPrepareMs = performance.now() - start;
        this.lastTime = 0;
        this.statsTime = this.qualityChangedAt = performance.now();
        this.frameSum = this.frames = this.slowSamples = 0;
        this.renderer.setAnimationLoop((time) => this.frame(time));
      }
    }
  }
  private updateLighting(dt: number) {
    const speed = this.reducedMotion ? 1 : 1 - Math.exp(-dt * 2.4);
    this.weatherBlend.rain = T.MathUtils.lerp(this.weatherBlend.rain, this.weather === "rain" ? 1 : 0, speed);
    this.weatherBlend.dusk = T.MathUtils.lerp(this.weatherBlend.dusk, this.weather === "dusk" ? 1 : 0, speed);
    this.weatherBlend.night = T.MathUtils.lerp(this.weatherBlend.night, this.weather === "night" ? 1 : 0, speed);
    const { rain, dusk, night } = this.weatherBlend;
    const blendColor = (color: T.Color, golden: string, evening: string, overcast: string) => {
      color.set(golden).lerp(this.lightColor.set(evening), dusk).lerp(this.lightColor.set(overcast), rain);
    };
    blendColor(this.sun.color, "#ffe5b2", "#efa885", "#cedbe2");
    this.sun.color.lerp(this.lightColor.set("#b3c8ed"), night);
    this.sun.intensity = (4.1 - dusk * 3.5 - rain * 3.35) * (1 - night) + .09 * night;
    this.fill.intensity = (1.05 - dusk * .2 + rain * .37) * (1 - night) + .22 * night;
    blendColor(this.fill.color, "#bfd8ef", "#7b97d0", "#b3c6cf");
    blendColor(this.fill.groundColor, "#7a7351", "#424c56", "#6f7c70");
    this.fill.color.lerp(this.lightColor.set("#6882b9"), night);
    this.fill.groundColor.lerp(this.lightColor.set("#303b59"), night);
    this.bounce.intensity = (.65 - dusk*.19 - rain*.14) * (1 - night) + .035 * night;
    this.scene.environmentIntensity = (.34 - dusk*.14 + rain*.05) * (1 - night) + .025 * night;
    this.renderer.toneMappingExposure = 1.02 + dusk*.06 - night*.08;
    const fog = this.scene.fog as T.FogExp2;
    blendColor(fog.color, "#bfd9da", "#8894bf", "#a3b8bd");
    fog.color.lerp(this.lightColor.set("#172544"), night);
    fog.density = .0046 + rain * .005 + dusk * .001 + night * .0007;
    this.world?.setWeather(rain, dusk, night);
    this.world?.updateLampLights(this.player.position.x, this.player.position.z);
    this.atmosphere.setWeather(rain, dusk, night);
    if (Math.abs(night - this.spiritGlowApplied) > .015 || night === 0 && this.spiritGlowApplied !== 0) {
      this.glowSpirit(this.player, night);
      this.life?.residents.forEach(resident => this.glowSpirit(resident.spirit, night));
      this.remoteVisitors.forEach(remote => this.glowSpirit(remote.group, night));
      this.spiritGlowApplied = night;
    }
  }
  setGarden(state: GardenState) { this.gardenState = state; this.garden?.sync(state); }
  getPlayerPose() { return { x: this.player.position.x, z: this.player.position.z, heading: this.player.rotation.y }; }
  showChatBubble(entry: SharedChatEntry, selfId: string, selfName: string) {
    const id = entry.id ?? (entry.name === selfName ? selfId : [...this.remoteVisitors].find(([, remote]) => remote.name === entry.name)?.[0]);
    if (!id || (id !== selfId && !this.remoteVisitors.has(id))) return;
    const previous = this.chatBubbles.get(id);
    if (previous) { clearTimeout(previous.timer); previous.element.remove(); }
    const element = document.createElement("div");
    element.className = "v-visitor-chat";
    element.textContent = entry.message;
    this.host.append(element);
    const timer = window.setTimeout(() => {
      element.remove();
      this.chatBubbles.delete(id);
    }, 6000);
    this.chatBubbles.set(id, { element, timer });
  }
  private seatPoint(bench: VillageBench, index: 0 | 1) {
    const offset = index === 0 ? -.68 : .68;
    return { x: bench.x + Math.cos(bench.facing) * offset, z: bench.z - Math.sin(bench.facing) * offset };
  }
  private visitorSeat(x: number, z: number, heading: number) {
    for (const bench of this.world?.benches ?? []) {
      const turn = Math.atan2(Math.sin(heading - bench.facing), Math.cos(heading - bench.facing));
      if (Math.abs(turn) > .45) continue;
      if (Math.hypot(x - bench.x, z - bench.z) < .35) return { bench, index: null };
      for (const index of [0, 1] as const) {
        const point = this.seatPoint(bench, index);
        if (Math.hypot(x - point.x, z - point.z) < .4) return { bench, index };
      }
    }
    return null;
  }
  private seatOccupants(bench: VillageBench) {
    const occupants = new Map<0 | 1, number[]>();
    for (const remote of this.remoteVisitors.values()) {
      const seat = this.visitorSeat(remote.target.x, remote.target.z, remote.heading);
      if (seat?.bench.id !== bench.id) continue;
      for (const index of seat.index === null ? [0, 1] as const : [seat.index]) {
        const slots = occupants.get(index) ?? [];
        slots.push(remote.slot);
        occupants.set(index, slots);
      }
    }
    return occupants;
  }
  private resolveSeatCollision() {
    const bench = this.seatedBench, index = this.seatedIndex;
    if (!bench || index === null) return;
    const occupied = this.seatOccupants(bench);
    if (!(occupied.get(index) ?? []).some(slot => slot < (this.sharedSlot ?? Infinity))) return;
    const other = index === 0 ? 1 : 0;
    if (!occupied.has(other)) this.seatedIndex = other;
  }
  setSharedIdentity(slot: number, color: string) {
    if (this.sharedSlot === slot && this.sharedColor === color) return;
    this.sharedSlot = slot;
    this.sharedColor = color;
    this.distance = Math.max(this.distance, 5);
    if (this.character) this.tintSpirit(this.character, color, false);
    this.placeSharedSpawn();
  }
  private placeSharedSpawn() {
    if (this.sharedSpawnPlaced || this.sharedSlot === null || !this.movement) return;
    this.sharedSpawnPlaced = true;
    if (Math.hypot(this.player.position.x - .3, this.player.position.z - 20) > 1) return;
    const offsets = [[-.7, 0], [.7, 0], [0, -1.5], [0, 1.5], [-1.4, -1.5], [1.4, -1.5]];
    const [dx, dz] = offsets[this.sharedSlot % offsets.length];
    const x = .3 + dx, z = 20 + dz;
    if (!this.movement.clear(x, z)) return;
    this.movement.settle(x, z);
    this.player.position.set(x, floorHeight(x, z), z);
    if (!this.place) {
      this.updateWalkingCamera();
      this.camera.position.copy(this.cameraGoal);
      this.currentLook.copy(this.lookGoal);
      this.camera.lookAt(this.currentLook);
    }
  }
  private tintSpirit(spirit: T.Object3D, color: string, copyMaterials: boolean) {
    spirit.traverse(object => {
      if (!(object instanceof T.Mesh)) return;
      const materials = (Array.isArray(object.material) ? object.material : [object.material]).map(material => {
        const result = copyMaterials ? material.clone() : material;
        if (result instanceof T.MeshStandardMaterial && result.name === "Pearl white spirit") {
          result.color.set(color);
          result.userData.dayColor = result.color.getHex();
        }
        return result;
      });
      if (copyMaterials) object.material = Array.isArray(object.material) ? materials : materials[0];
    });
  }
  private glowSpirit(spirit: T.Object3D, night: number) {
    spirit.traverse(object => {
      if (!(object instanceof T.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!(material instanceof T.MeshStandardMaterial) || material.name !== "Pearl white spirit") continue;
        if (material.userData.dayEmissive === undefined) {
          material.userData.dayColor = material.color.getHex();
          material.userData.dayEmissive = material.emissive.getHex();
          material.userData.dayEmissiveIntensity = material.emissiveIntensity;
        }
        material.color.setHex(material.userData.dayColor).lerp(this.spiritGlowColor, night * .72);
        material.emissive.setHex(material.userData.dayEmissive).lerp(this.spiritGlowColor, night);
        material.emissiveIntensity = material.userData.dayEmissiveIntensity + night * .65;
      }
    });
  }
  private updateSpiritLights() {
    const night = this.weatherBlend.night;
    const light = this.spiritLights[0];
    light.visible = night >= .01;
    if (light.visible) {
      light.position.copy(this.player.position); light.position.y += 1.05;
      light.intensity = night * 2.8;
    }
  }
  setRemoteVisitors(visitors: SharedVisitor[]) {
    if (!this.character) return;
    const active = new Set(visitors.map(visitor => visitor.id));
    for (const [id, remote] of this.remoteVisitors) if (!active.has(id)) {
      remote.group.traverse(object => {
        if (object instanceof T.SkinnedMesh) object.skeleton.dispose();
        if (object instanceof T.Mesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
      });
      remote.label.remove();
      const bubble = this.chatBubbles.get(id);
      if (bubble) { clearTimeout(bubble.timer); bubble.element.remove(); this.chatBubbles.delete(id); }
      remote.group.removeFromParent(); this.remoteVisitors.delete(id);
    }
    for (const visitor of visitors) {
      let remote = this.remoteVisitors.get(visitor.id);
      if (!remote) {
        const group = new T.Group(), spirit = cloneSkeleton(this.character);
        this.tintSpirit(spirit, visitor.color, true);
        this.glowSpirit(spirit, this.weatherBlend.night);
        const label = document.createElement("div");
        label.className = "v-visitor-name";
        label.textContent = visitor.name;
        label.style.setProperty("--visitor-color", visitor.color);
        this.host.append(label);
        group.add(spirit);
        const seat = this.visitorSeat(visitor.x, visitor.z, visitor.heading);
        group.position.set(visitor.x, seat ? seat.bench.seatHeight - .62 : floorHeight(visitor.x, visitor.z), visitor.z);
        group.rotation.y = visitor.heading;
        this.scene.add(group);
        remote = { name: visitor.name, slot: visitor.slot, group, target: group.position.clone(), heading: visitor.heading, label };
        this.remoteVisitors.set(visitor.id, remote);
      }
      if (remote.label.textContent !== visitor.name) remote.label.textContent = visitor.name;
      remote.name = visitor.name;
      remote.slot = visitor.slot;
      remote.label.style.setProperty("--visitor-color", visitor.color);
      const seat = this.visitorSeat(visitor.x, visitor.z, visitor.heading);
      remote.target.set(visitor.x, seat ? seat.bench.seatHeight - .62 : floorHeight(visitor.x, visitor.z), visitor.z);
      remote.heading = visitor.heading;
      remote.group.visible = this.place !== "focus";
    }
    this.resolveSeatCollision();
  }
  gardenAction(action: GardenAction, source?: { x: number; z: number }, animateSelf = true) {
    if ((action.kind === "feed" || action.kind === "feedBirds") && !this.gardenState.crumbPouch) return false;
    if (action.kind === "feedBirds") {
      const origin = source ? new T.Vector3(source.x, floorHeight(source.x, source.z), source.z) : this.player.position;
      const accepted = this.birds?.feed(origin) ?? false;
      if (accepted && animateSelf) this.birdFeedAt = this.elapsed;
      return accepted;
    }
    if (action.kind === "crumbs" || action.kind === "birdCrumbs") this.callbacks.gardenSound?.("crumbs", [this.player.position.x, this.player.position.y, this.player.position.z]);
    else this.garden?.act(action);
    if (animateSelf) this.life?.gardenMoment(action);
    if (action.kind === "gift" && this.place === "mood") this.dialogue?.sayAtTea(HARVEST_COMPLIMENTS[action.crop]);
    if (action.kind === "gift" && action.crop === "mint" || action.kind === "drink") this.activities?.setMintTea(true);
    if (action.kind === "drink") this.setActivityMoment({ kind: "tea" });
    return true;
  }
  setCompanions(ids: string[]) {
    this.companions = ids; this.life?.setCompanions(ids); this.life?.setActivity(this.place);
  }
  setActivityMoment(moment:ActivityMoment) { this.activities?.setMoment(moment); this.life?.setMoment(moment); }
  setPlace(id: PlaceId | null) {
    if (id !== "mood") this.dialogue?.clearTeaSpeech();
    if (id && this.seatedBench) {
      this.seatedBench = null;
      this.seatedIndex = null;
      this.callbacks.seat?.(null);
    }
    this.releaseMouseLook();
    this.dialogue?.setEnabled(!id && !this.blocked);
    const previousPlace = this.place;
    this.activityOrbit.yaw = this.activityOrbit.pitch = 0;
    this.teaPanAt = this.elapsed; this.teaPan = 0; this.teaPanHeld = false;
    if (id && !previousPlace) this.walkingHeading=this.player.rotation.y;
    this.activities?.enter(id);
    if (id === "mood") this.activities?.setMintTea(this.gardenState.mintTea > 0);
    this.renderer.shadowMap.needsUpdate = id !== "focus";
    this.place = id;
    if (this.world) this.world.group.visible = id !== "focus";
    if (this.life) this.life.group.visible = true;
    if (this.birds) this.birds.group.visible = id !== "focus";
    this.remoteVisitors.forEach(remote => { remote.group.visible = id !== "focus"; });
    const arrival = this.movement?.position;
    this.life?.setActivity(id, arrival ? [arrival.x, arrival.z] : undefined);
    if (id) {
      this.updateActivityCamera(id);
      this.camera.position.copy(this.cameraGoal);
      this.currentLook.copy(this.lookGoal);
    }
    this.clearKeys();
    this.movement?.settle();
    if (!id && previousPlace !== null) {
      // Authored return angles keep residents and nearby walls out of the foreground.
      if (this.movement) this.player.position.copy(this.movement.position);
      this.player.rotation.y=this.walkingHeading;
      this.yaw = previousPlace === "mood" ? -Math.PI + .4 : 0;
      this.updateWalkingCamera();
      this.camera.position.copy(this.cameraGoal);
      this.currentLook.copy(this.lookGoal);
      this.camera.lookAt(this.currentLook);
    }
    this.player.visible = true;
    this.resize();
    if (this.indoor) this.indoor.visible = id === "focus";
    this.indoorLight.intensity = id === "focus" ? 10 : 0;
    if (id === "focus") this.bridgeWindowTime = -1000;
    this.world?.flames.forEach((f) => {
      if (f.userData.interior) f.visible = id === "focus";
    });
    if (!id) {
      this.callbacks.near(this.near);
    }
  }
  travel(id: PlaceId) {
    if (!this.world) return;
    const p = PLACES.find((p) => p.id === id)!;
    let x: number = p.position[0], z: number = p.position[2];
    if (this.sharedSlot !== null) {
      const stage = ACTIVITY_STAGES[id];
      const facingX = stage.look[0] - stage.camera[0], facingZ = stage.look[2] - stage.camera[2];
      const length = Math.hypot(facingX, facingZ) || 1;
      const rightX = -facingZ / length, rightZ = facingX / length;
      const side = this.sharedSlot % 2 === 0 ? -1 : 1;
      for (const distance of [1.45, 1.1, .8]) {
        const candidateX = x + rightX * side * distance, candidateZ = z + rightZ * side * distance;
        if (this.movement?.clear(candidateX, candidateZ)) { x = candidateX; z = candidateZ; break; }
      }
    }
    this.player.position.set(x, floorHeight(x, z), z);
    this.movement?.settle(x, z);
    this.near = id;
    this.callbacks.near(id);
    this.setPlace(id);
  }
  resetPosition() {
    const x = .3, z = 20;
    if (!this.movement?.clear(x, z)) return false;
    this.releaseMouseLook();
    this.clearKeys();
    this.seatedBench = null;
    this.seatedIndex = null;
    this.callbacks.seat?.(null);
    this.movement.settle(x, z);
    this.player.position.set(x, floorHeight(x, z), z);
    this.player.rotation.y = this.walkingHeading = Math.PI;
    this.yaw = 0;
    this.pitch = .15;
    this.near = null;
    this.nearBench = null;
    this.nearGarden = null;
    this.callbacks.near(null);
    this.callbacks.nearBench?.(null);
    this.callbacks.nearGarden?.(null);
    this.updateWalkingCamera();
    this.camera.position.copy(this.cameraGoal);
    this.currentLook.copy(this.lookGoal);
    this.camera.lookAt(this.currentLook);
    this.reportMovement(true);
    return true;
  }
  sit(id: string) {
    const bench = this.world?.benches.find(value => value.id === id);
    if (!bench || this.blocked || this.place || this.seatedBench || this.nearBench?.id !== id) return;
    const occupied = this.seatOccupants(bench);
    const preferred = this.sharedSlot !== null && this.sharedSlot % 2 === 1 ? [1, 0] as const : [0, 1] as const;
    const index = preferred.find(value => !occupied.has(value)) ?? preferred[0];
    this.releaseMouseLook();
    this.clearKeys();
    this.seatedBench = bench;
    this.seatedIndex = index;
    this.yaw = bench.facing;
    this.pitch = .4;
    this.callbacks.seat?.(id);
  }
  stand() {
    const bench = this.seatedBench;
    if (!bench) return;
    const seat = this.seatPoint(bench, this.seatedIndex ?? 0);
    const exits = [1.35, 1.8, -1.35].map(offset => ({
      x: seat.x + Math.sin(bench.facing) * offset,
      z: seat.z + Math.cos(bench.facing) * offset,
    })).concat([1.35, 1.8, -1.35].map(offset => ({
      x: bench.x + Math.sin(bench.facing) * offset,
      z: bench.z + Math.cos(bench.facing) * offset,
    })), [{ x: this.movement?.position.x ?? bench.x, z: this.movement?.position.z ?? bench.z }]);
    const { x, z } = exits.find(point => this.movement?.clear(point.x, point.z)) ?? exits[exits.length - 1];
    this.seatedBench = null;
    this.seatedIndex = null;
    this.movement?.settle(x, z);
    this.player.position.set(x, floorHeight(x, z), z);
    this.callbacks.seat?.(null);
  }
  walkKey(key: string, down: boolean) {
    if (down && (this.blocked || this.place || this.seatedBench)) return;
    if (down) {
      this.keys.add(key);
      if (key === " " && !this.seatedBench) this.movement?.jump();
    } else this.keys.delete(key);
  }
  toggleRun() { this.running = !this.running; this.reportMovement(true); }
  private updateActivityCamera(place: PlaceId) {
    const stage=ACTIVITY_STAGES[place];
    this.cameraGoal.fromArray(stage.camera);
    this.lookGoal.fromArray(stage.look);
    if (place === "mood") {
      if (!this.teaPanHeld) this.teaPan = this.reducedMotion ? 1 : T.MathUtils.smoothstep(this.elapsed - this.teaPanAt, 0, 4);
      this.cameraGoal.lerp(this.temp.set(11.6, 2.6, -8.3), 1 - this.teaPan);
    }
    if (this.companions.length) {
      this.cameraGoal.sub(this.lookGoal).multiplyScalar(place === "focus" ? 1.28 : 1.15).add(this.lookGoal);
      this.cameraGoal.y += .2;
    }
    if (this.compactView && place === "mood") {
      // Keep both the gardener and Luma above the phone's activity sheet.
      this.lookGoal.set(15.2, 1.35, -10.7);
      this.cameraGoal.x = this.lookGoal.x + (this.cameraGoal.x - this.lookGoal.x) * 1.8;
      this.cameraGoal.z = this.lookGoal.z + (this.cameraGoal.z - this.lookGoal.z) * 1.8;
    } else if (this.compactView && place === "birds") {
      this.lookGoal.set(BIRD_CLEARING.x, .3, BIRD_CLEARING.z);
      this.cameraGoal.set(BIRD_CLEARING.x + 7, 7.3, BIRD_CLEARING.z + 10.5);
    } else if(this.compactView) {
      this.temp.fromArray(stage.actor).y+=1.1;
      this.lookGoal.lerp(this.temp,.7);
    }
    if (this.activityOrbit.yaw === 0 && this.activityOrbit.pitch === 0) return;
    this.orbit.setFromVector3(this.temp.subVectors(this.cameraGoal, this.lookGoal));
    this.orbit.theta += this.activityOrbit.yaw;
    this.orbit.phi = T.MathUtils.clamp(this.orbit.phi - this.activityOrbit.pitch, .2, Math.PI / 2 - .04);
    this.cameraGoal.copy(this.lookGoal).add(this.temp.setFromSpherical(this.orbit));
    if (place === "focus") {
      // Keep the orbit inside the cottage walls and below its ceiling.
      this.cameraGoal.set(T.MathUtils.clamp(this.cameraGoal.x, 106.5, 113.5),
        T.MathUtils.clamp(this.cameraGoal.y, .6, 3.9), T.MathUtils.clamp(this.cameraGoal.z, -3.45, 3.5));
    } else {
      this.cameraRay.origin.copy(this.lookGoal);
      this.cameraRay.direction.subVectors(this.cameraGoal, this.lookGoal).normalize();
      for (const c of this.world?.colliders ?? []) {
        this.collisionBox.min.set(c.x - c.w / 2 - .25, c.bottom ?? 0, c.z - c.d / 2 - .25);
        this.collisionBox.max.set(c.x + c.w / 2 + .25, c.top ?? 8, c.z + c.d / 2 + .25);
        // The activity's own table or prop can contain the authored look point.
        if (this.collisionBox.containsPoint(this.lookGoal)) continue;
        if (this.cameraRay.intersectBox(this.collisionBox, this.cameraHit)) {
          const distance = this.cameraHit.distanceTo(this.lookGoal);
          if (distance < this.cameraGoal.distanceTo(this.lookGoal))
            this.cameraGoal.copy(this.lookGoal).addScaledVector(this.cameraRay.direction, Math.max(.55, distance - .2));
        }
      }
      this.cameraGoal.y = Math.max(this.cameraGoal.y, floorHeight(this.cameraGoal.x, this.cameraGoal.z) + .35);
    }
  }
  private updateWalkingCamera() {
    this.lookGoal.copy(this.player.position).add(this.temp.set(0, 1.35, 0));
    this.lookGoal.y += Math.max(0, -Math.sin(this.pitch)) * 2.4;
    this.cameraGoal.copy(this.player.position).add(this.temp.set(
      Math.sin(this.yaw) * Math.cos(this.pitch) * (this.seatedBench ? 3 : this.distance),
      1.35 + Math.sin(this.pitch) * (this.seatedBench ? 3 : this.distance),
      Math.cos(this.yaw) * Math.cos(this.pitch) * (this.seatedBench ? 3 : this.distance),
    ));
    this.cameraRay.origin.copy(this.lookGoal);
    this.cameraRay.direction.subVectors(this.cameraGoal, this.lookGoal).normalize();
    for (const c of this.world?.colliders ?? []) {
      this.collisionBox.min.set(c.x - c.w / 2 - 0.3, c.bottom ?? 0, c.z - c.d / 2 - 0.3);
      this.collisionBox.max.set(c.x + c.w / 2 + 0.3, c.top ?? 8, c.z + c.d / 2 + 0.3);
      if (this.seatedBench && this.collisionBox.containsPoint(this.lookGoal)) continue;
      if (this.cameraRay.intersectBox(this.collisionBox, this.cameraHit)) {
        const hitDistance = this.cameraHit.distanceTo(this.lookGoal);
        if (hitDistance < this.cameraGoal.distanceTo(this.lookGoal)) {
          this.cameraGoal.copy(this.lookGoal).addScaledVector(
            this.cameraRay.direction, Math.max(0.55, hitDistance - 0.2),
          );
        }
      }
    }
    this.cameraGoal.y = Math.max(this.cameraGoal.y, floorHeight(this.cameraGoal.x, this.cameraGoal.z) + .3);
  }
  private reportMovement(force = false) {
    const m = this.movement;
    if (!m) return;
    const status = { gait: m.gait, running: this.running };
    const key = JSON.stringify(status);
    if (force || key !== this.lastStatus) {
      this.lastStatus = key;
      this.callbacks.movement(status);
    }
  }
  private frame(now: number) {
    if (this.disposed || document.hidden) return;
    const frameDelta = this.lastTime ? (now - this.lastTime) / 1000 : 0.016;
    if (now - this.qualityChangedAt > 4000)
      this.longestFrameMs = Math.max(this.longestFrameMs, frameDelta * 1000);
    let dt = Math.min(frameDelta, 0.06);
    this.lastTime = now;
    this.elapsed += dt;
    if (!this.world) return;
    const movement = this.movement!;
    this.direction.set(0, 0, 0);
    if (!this.blocked && !this.place && !this.seatedBench) {
      const forward = Number(this.keys.has("w") || this.keys.has("arrowup")) - Number(this.keys.has("s") || this.keys.has("arrowdown"));
      const side = Number(this.keys.has("d") || this.keys.has("arrowright")) - Number(this.keys.has("a") || this.keys.has("arrowleft"));
      this.direction.set(side * Math.cos(this.yaw) - forward * Math.sin(this.yaw), 0,
        -forward * Math.cos(this.yaw) - side * Math.sin(this.yaw));
      if (this.direction.lengthSq() > 0) this.direction.normalize();
    }
    movement.update(dt, { x: this.direction.x, z: this.direction.z, run: this.running,
      sprint: this.keys.has("shift"), blocked: this.blocked || this.place !== null || !!this.seatedBench });
    this.player.position.set(movement.position.x, movement.position.y, movement.position.z);
    if (this.seatedBench) {
      const seat = this.seatPoint(this.seatedBench, this.seatedIndex ?? 0);
      this.player.position.set(seat.x, this.seatedBench.seatHeight - .62, seat.z);
      this.player.rotation.y = this.seatedBench.facing;
    }
    const moving = movement.speed > 0.12;
    if (moving) {
      const angle = Math.atan2(movement.velocity.x, movement.velocity.z);
      const turn = T.MathUtils.euclideanModulo(angle - this.player.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
      this.player.rotation.y += turn * (1 - Math.exp(-dt * 14));
    }
    if (!this.blocked && !this.place && !this.seatedBench) {
      let near: PlaceId | null = null,
        dist = 4;
      PLACES.forEach((p) => {
        if (p.id === "garden") return;
        // Keep the arrival approach reachable while covering the tea seating itself.
        const d = p.id === "birds" ? Math.hypot(BIRD_CLEARING.x - this.player.position.x, BIRD_CLEARING.z - this.player.position.z) : Math.min(
          Math.hypot(p.position[0] - this.player.position.x, p.position[2] - this.player.position.z),
          "interactionPosition" in p
            ? Math.hypot(p.interactionPosition[0] - this.player.position.x, p.interactionPosition[2] - this.player.position.z)
            : Infinity,
        );
        if (d < dist) {
          dist = d;
          near = p.id;
        }
      });
      if (near !== this.near) {
        this.near = near;
        this.callbacks.near(near);
      }
      const bench = this.world.benches.find(value => Math.hypot(value.x - this.player.position.x, value.z - this.player.position.z) < 2.7) ?? null;
      if (bench !== this.nearBench) { this.nearBench = bench; this.callbacks.nearBench?.(bench?.id ?? null); }
      const target = GARDEN_TARGETS.map(p => ({
        id: p.id, radius: p.radius,
        distance: Math.hypot(Math.max(0, Math.abs(p.x - this.player.position.x) - ("halfWidth" in p ? p.halfWidth : 0)), p.z - this.player.position.z),
      })).filter(p => p.distance < p.radius).sort((a, b) => a.distance - b.distance)[0]?.id ?? null;
      if (target !== this.nearGarden) { this.nearGarden = target; this.callbacks.nearGarden?.(target); }
    }
    if (now - this.statusTime > 100) { this.reportMovement(); this.statusTime = now; }
    this.companionHands.reset();
    if (this.character) {
      const bob = this.reducedMotion || this.blocked || this.seatedBench ? 0 : Math.sin(this.elapsed*2.8)*.065;
      this.character.position.y = .62 + bob;
      this.character.rotation.x = T.MathUtils.lerp(this.character.rotation.x, this.seatedBench ? -.08 : this.reducedMotion ? 0 : movement.speed*.022, 1-Math.exp(-dt*8));
      this.character.rotation.z = this.reducedMotion || this.blocked ? 0 : Math.sin(this.elapsed*1.7)*.035;
      const squash = this.reducedMotion ? 0 : movement.landing>0 ? -.1 : movement.takeoff>0 ? .09 : 0;
      this.character.scale.set(this.spiritScale*(this.seatedBench ? 1.05 : 1-squash*.4),this.spiritScale*(this.seatedBench ? .86 : 1+squash),this.spiritScale*(this.seatedBench ? 1.05 : 1-squash*.4));
      this.spiritFins.forEach((fin,i) => { fin.rotation.z = this.reducedMotion || this.blocked ? 0 : Math.sin(this.elapsed*(moving?8:3)+i*Math.PI)*.18; });
    }
    this.activities?.update(this.elapsed,this.place,this.reducedMotion,this.player,this.character,this.spiritScale);
    const scatterAge = this.elapsed - this.birdFeedAt;
    if (this.character && scatterAge < 1.6 && !this.reducedMotion) {
      this.character.rotation.x = Math.sin(scatterAge / 1.6 * Math.PI) * .16;
      this.spiritFins.forEach((fin, i) => { fin.rotation.z = Math.sin(scatterAge * 5 + i) * .4; });
    }
    if (this.place) {
      this.updateActivityCamera(this.place);
    } else this.updateWalkingCamera();
    if (this.rain) {
      this.rain.visible = this.weather === "rain" && this.place !== "focus";
      this.rain.position.copy(this.player.position);
      if (!this.reducedMotion) {
        const p = this.rain.geometry.attributes.position as T.BufferAttribute;
        for (let i = 0; i < p.count; i += 2) {
          let y = p.getY(i) - dt * 9;
          if (y < 0) y = 17;
          p.setY(i, y);
          p.setY(i + 1, y + 0.4);
        }
        p.needsUpdate = true;
      }
    }
    const blend = this.reducedMotion ? 1 : 1 - Math.exp(-dt * 7);
    this.camera.position.lerp(this.cameraGoal, blend);
    if (!this.place) this.camera.position.y = Math.max(this.camera.position.y, floorHeight(this.camera.position.x, this.camera.position.z) + .3);
    this.currentLook.lerp(this.lookGoal, blend);
    this.camera.lookAt(this.currentLook);
    const t = this.reducedMotion ? 0 : this.elapsed;
    this.updateLighting(dt);
    this.atmosphere.update(t, this.camera.position);
    this.life?.update(dt, this.elapsed, this.player.position, this.reducedMotion, !this.blocked && !this.place, this.camera.quaternion, this.player.rotation.y);
    if (this.life) this.companionHands.update(dt, this.player, this.spiritFins, this.life.residents.filter(r => r.following),
      !this.place && !this.blocked && !this.seatedBench && movement.grounded && scatterAge >= 1.6 && !this.life.companionWalk.singleFile);
    if (this.place !== "focus") this.garden?.update(dt, this.elapsed, this.reducedMotion, this.camera.quaternion);
    this.world.wind.time.value = t;
    this.world.wind.strength.value = this.reducedMotion ? 0 : windAt(t, this.weather);
    if (now - this.environmentTime > 80) {
      this.camera.getWorldDirection(this.audioForward);
      const origin = this.place ? this.currentLook : this.player.position;
      this.callbacks.environment({ listener: [origin.x, origin.y + (this.place ? 0 : 1.4), origin.z],
        forward: [this.audioForward.x, this.audioForward.y, this.audioForward.z],
        wind: windAt(this.elapsed, this.weather), weather: this.weather, sheltered: this.place === "focus" });
      this.environmentTime = now;
    }
    this.world.water.userData.time.value = t;
    this.world.flames.forEach((f, i) => {
      f.scale.y = 0.95 + Math.sin(t * 3 + i * 2) * 0.08;
      if (f.material instanceof T.ShaderMaterial)
        f.material.uniforms.time.value = t + i;
      if (f.userData.light) f.userData.light.intensity = f.userData.interior
        ? (this.place === "focus" ? 10 : 0)
        : (9 + this.weatherBlend.night * 6) * (1 + Math.sin(t*7.1)*.045 + Math.sin(t*11.7)*.03);
      if (f.userData.coal) f.userData.coal.emissiveIntensity=.45+this.weatherBlend.night*.9+Math.sin(t*2.1)*.1;
    });
    if (this.place === "focus") this.coffeeSteam.forEach((steam, i) => {
      const phase = (t * .42 + i / this.coffeeSteam.length) % 1;
      steam.position.x = steam.userData.baseX + Math.sin(t * 1.3 + i * 2.2) * .015;
      steam.position.y = .265 + phase * .18;
      steam.scale.set(1 + phase * .28, .72 + phase * .42, 1 + phase * .28);
      (steam.material as T.MeshBasicMaterial).opacity = this.reducedMotion ? .3 : .6 * Math.sin(Math.PI * phase);
    });
    if (this.place !== "focus") {
      this.camera.updateMatrixWorld();
      this.viewProjection.multiplyMatrices(
        this.camera.projectionMatrix,
        this.camera.matrixWorldInverse,
      );
      this.treeFrustum.setFromProjectionMatrix(this.viewProjection);
      const nearTrees: number[] = [], farTrees: number[] = [];
      const treeSource = this.world.trees[0];
      treeSource?.bounds.forEach((bounds, index) => {
        const distance = Math.hypot(bounds.center.x - this.player.position.x, bounds.center.z - this.player.position.z);
        if (distance < GRAPHICS_TIERS[this.graphicsTier].trees) nearTrees.push(index);
        else if (this.treeFrustum.intersectsSphere(bounds)) farTrees.push(index);
      });
      for (const batch of this.world.trees) {
        nearTrees.forEach((index, i) => batch.mesh.setMatrixAt(i, batch.transforms[index]));
        batch.mesh.count = nearTrees.length;
        batch.mesh.instanceMatrix.needsUpdate = true;
      }
      if (treeSource) {
        farTrees.forEach((index, i) => this.world!.treeLod.setMatrixAt(i, treeSource.transforms[index]));
        this.world.treeLod.count = farTrees.length;
        this.world.treeLod.instanceMatrix.needsUpdate = true;
      }
    }
    // Refresh moving shadows every frame in detailed graphics; limit lower tiers to 30 Hz.
    if (this.place !== "focus" && this.renderer.shadowMap.enabled && now - this.shadowTime > (this.graphicsTier === "detailed" ? 0 : 32) && (!this.reducedMotion || moving)) {
      const texel = 48 / this.sun.shadow.mapSize.x;
      const x = Math.round(this.player.position.x / texel) * texel, z = Math.round(this.player.position.z / texel) * texel;
      this.sun.position.set(x + 35, 28, z - 48);
      this.sun.target.position.set(x, 0, z);
      this.sun.target.updateMatrixWorld();
      this.renderer.shadowMap.needsUpdate = true; this.shadowTime = now;
    }
    this.birds?.update(dt, this.elapsed, this.reducedMotion, this.camera, this.player.position, this.life?.caretakerPresent ?? false, this.place !== "focus" && !this.blocked);
    for (const remote of this.remoteVisitors.values()) {
      remote.group.position.lerp(remote.target, 1 - Math.exp(-dt * 12));
      const turn = T.MathUtils.euclideanModulo(remote.heading - remote.group.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
      remote.group.rotation.y += turn * (1 - Math.exp(-dt * 12));
    }
    this.updateSpiritLights();
    const renderStart = performance.now();
    this.renderBridgeWindow(now, t);
    if (this.place === "focus") this.sun.intensity = 0;
    this.renderer.render(this.scene, this.camera);
    if (now - this.qualityChangedAt > 4000)
      this.longestRenderSubmitMs = Math.max(this.longestRenderSubmitMs, performance.now() - renderStart);
    for (const remote of this.remoteVisitors.values()) {
      const point = this.visitorLabelPoint.copy(remote.group.position).add(this.temp.set(0, 1.65, 0)).project(this.camera);
      remote.label.hidden = point.z < -1 || point.z > 1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 1 || this.place === "focus";
      if (!remote.label.hidden) {
        remote.label.style.left = `${(point.x * .5 + .5) * this.host.clientWidth}px`;
        remote.label.style.top = `${(-point.y * .5 + .5) * this.host.clientHeight}px`;
      }
    }
    for (const [id, bubble] of this.chatBubbles) {
      const origin = this.remoteVisitors.get(id)?.group.position ?? this.player.position;
      const point = this.visitorLabelPoint.copy(origin).add(this.temp.set(0, 2.25, 0)).project(this.camera);
      bubble.element.hidden = (this.place === "focus" && this.remoteVisitors.has(id)) ||
        point.z < -1 || point.z > 1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 1;
      if (!bubble.element.hidden) {
        bubble.element.style.left = `${(point.x * .5 + .5) * this.host.clientWidth}px`;
        bubble.element.style.top = `${(-point.y * .5 + .5) * this.host.clientHeight}px`;
      }
    }
    this.dialogue?.update(dt, this.camera, this.player.position, this.weather);
    this.frameSum += frameDelta;
    this.frames++;
    if (now - this.statsTime > 2000) {
      const fps = Math.round(this.frames / this.frameSum);
      if (now - this.qualityChangedAt > 4000) this.lowestFps = Math.min(this.lowestFps, fps);
      this.callbacks.stats(
        fps,
        this.renderer.info.render.calls,
        this.renderer.info.render.triangles,
      );
      this.slowSamples = fps < 45 ? this.slowSamples + 1 : 0;
      if (this.quality === "high" && this.graphicsTier === "detailed" &&
          this.slowSamples >= 2 && now - this.qualityChangedAt > 4000 && this.detailedRenderScale > .67) {
        this.detailedRenderScale = Math.max(.67, Math.round((this.detailedRenderScale - .16) * 100) / 100);
        this.resize();
      }
      // Keep the selected preference: automatic and battery modes can step down again.
      // Ignore startup/resizing and isolated slow samples; Detailed keeps its scene tier while its drawing buffer adapts.
      if (this.quality !== "high" && this.graphicsTier !== "minimal" &&
          now - this.qualityChangedAt > 4000 && (fps < 24 || this.slowSamples >= 2)) {
        this.graphicsTier = slowerGraphicsTier(this.graphicsTier);
        this.applyGraphicsTier();
      }
      this.frameSum = 0;
      this.frames = 0;
      this.statsTime = now;
    }
  }
  dispose() {
    this.disposed = true;
    for (const bubble of this.chatBubbles.values()) clearTimeout(bubble.timer);
    this.chatBubbles.clear();
    this.releaseMouseLook();
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("mousemove", this.onMouseMove);
    if (!this.pointerLockPending) {
      document.removeEventListener("pointerlockchange", this.onPointerLockChange);
      document.removeEventListener("pointerlockerror", this.onPointerLockError);
    }
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.motionQuery.removeEventListener("change", this.motionChange);
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onDown);
    el.removeEventListener("pointermove", this.onMove);
    el.removeEventListener("pointerup", this.onUp);
    el.removeEventListener("pointercancel", this.clearKeys);
    el.removeEventListener("lostpointercapture", this.onUp);
    el.removeEventListener("pointerleave", this.onUp);
    el.removeEventListener("wheel", this.onWheel);
    el.removeEventListener("webglcontextlost", this.onLost);
    this.dialogue?.dispose();
    this.life?.dispose();
    this.birds?.dispose();
    this.garden?.dispose();
    this.world?.group.removeFromParent();
    this.world?.dispose();
    this.scene.traverse((object) => {
      if (!(object instanceof T.Mesh) && !(object instanceof T.LineSegments) && !(object instanceof T.Points))
        return;
      if (object instanceof T.SkinnedMesh) object.skeleton.dispose();
      object.geometry.dispose();
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        for (const value of Object.values(material))
          if (value instanceof T.Texture) value.dispose();
        material.dispose();
      }
    });
    this.environment?.dispose();
    this.bridgeWindow?.dispose();
    this.skyTexture?.dispose();
    this.renderer.dispose();
    this.host.replaceChildren();
  }
}

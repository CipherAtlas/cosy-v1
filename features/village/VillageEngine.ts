import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { makeFlame } from "./flame";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { buildWorld, type World } from "./world";
import { VillageMovement } from "./movement";
import { createAtmosphere } from "./atmosphere";
import { VillageLife } from "./life";
import { VillagerDialogue } from "./dialogue";
import { VillageActivities, ACTIVITY_STAGES } from "./activityScene";
import type { ActivityMoment } from "./environment";
import { softenShadowEdges } from "./shadows";
import { GRAPHICS_TIERS, graphicsPixelRatio, initialGraphicsTier, slowerGraphicsTier, type GraphicsTier } from "./graphics";
import { floorHeight, windAt, type MovementStatus, type WorldContact, type EnvironmentFrame } from "./environment";
import { PLACES, type PlaceId, type Quality, type Weather } from "./places";
import { withBasePath } from "@/lib/basePath";

export class VillageEngine {
  readonly renderer: T.WebGLRenderer;
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(55, 1, 0.12, 1100);
  private atmosphere = createAtmosphere();
  private life?: VillageLife;
  private dialogue?: VillagerDialogue;
  private activities?: VillageActivities;
  private walkingHeading = Math.PI;
  private language: "en" | "ja" = "en";
  private world?: World;
  private environment?: T.WebGLRenderTarget;
  private skyTexture?: T.DataTexture;
  private player = new T.Group();
  private character?: T.Object3D;
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
  private distance = 3.8;
  private pointer?: {
    id: number;
    x: number;
    y: number;
    moved: boolean;
    startX: number;
    startY: number;
  };
  private walkTarget?: T.Vector3;
  private walkMarker = new T.Mesh(new T.RingGeometry(.16, .21, 40),
    new T.MeshBasicMaterial({ color: "#ffe4a1", transparent: true, opacity: .85, depthWrite: false }));
  private lastTime = 0;
  private elapsed = 0;
  private resizeObserver: ResizeObserver;
  private disposed = false;
  private blocked = false;
  private place: PlaceId | null = null;
  private near: PlaceId | null = null;
  private quality: Quality = "auto";
  private graphicsTier: GraphicsTier = "detailed";
  private qualityChangedAt = 0;
  private slowSamples = 0;
  private frameSum = 0;
  private frames = 0;
  private statsTime = 0;
  private reducedMotion = false;
  private motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  private sun = new T.DirectionalLight("#ffe0ad", 4.1);
  private weatherBlend = { rain: 0, dusk: 0 };
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
  private rain?: T.LineSegments;
  private weather: Weather = "golden";
  private collisionBox = new T.Box3();
  private cameraRay = new T.Ray();
  private cameraHit = new T.Vector3();
  private treeFrustum = new T.Frustum();
  private viewProjection = new T.Matrix4();
  private indoorLight = new T.PointLight("#ffb569", 0, 12, 1.7);
  private onKeyDown = (e: KeyboardEvent) => {
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
    if (e.key === " " && !e.repeat) this.movement?.jump();
    if (e.key.toLowerCase() === "r" && !e.repeat) this.toggleRun();
    if (e.key.toLowerCase() === "f" && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) this.dialogue?.talk();
    if (e.key.toLowerCase() === "e" && this.near && !this.place)
      this.callbacks.interact(this.near);
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
  private clearKeys = () => {
    this.keys.clear();
    this.pointer = undefined;
    this.walkTarget = undefined;
    this.movement?.pause();
  };
  private onVisibility = () => {
    this.clearKeys();
    this.lastTime = 0;
    this.frameSum = this.frames = this.slowSamples = 0;
    this.statsTime = this.qualityChangedAt = performance.now();
  };
  private motionChange = () => {
    this.reducedMotion = this.motionQuery.matches;
  };
  private onDown = (e: PointerEvent) => {
    if (this.blocked || this.place) return;
    this.pointer = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
    };
    this.renderer.domElement.setPointerCapture(e.pointerId);
  };
  private onMove = (e: PointerEvent) => {
    if (!this.pointer || this.blocked || this.place) return;
    const dx = e.clientX - this.pointer.x,
      dy = e.clientY - this.pointer.y;
    this.yaw -= dx * 0.004;
    this.pitch = T.MathUtils.clamp(this.pitch + dy * 0.004, -0.85, 1.35);
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
    if (
      Math.hypot(
        e.clientX - this.pointer.startX,
        e.clientY - this.pointer.startY,
      ) > 8
    )
      this.pointer.moved = true;
  };
  private onUp = (e: PointerEvent) => {
    const p = this.pointer;
    this.pointer = undefined;
    if (!p || p.moved || this.blocked || this.place) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ray = new T.Raycaster();
    ray.setFromCamera(
      new T.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
    const hit = new T.Vector3();
    if (
      ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), 0), hit) &&
      hit.distanceTo(this.player.position) < 45
    ) {
      this.walkTarget = hit;
    }
  };
  private onWheel = (e: WheelEvent) => {
    if (this.blocked || this.place) return;
    e.preventDefault();
    this.distance = T.MathUtils.clamp(this.distance + e.deltaY * 0.004, 2.2, 12);
  };
  private onLost = (e: Event) => {
    e.preventDefault();
    this.renderer.setAnimationLoop(null);
    this.callbacks.error(
      "The 3D view was interrupted. Your activities are still available in simple view.",
    );
  };
  constructor(
    private host: HTMLElement,
    private callbacks: {
      progress: (n: number) => void;
      ready: () => void;
      near: (id: PlaceId | null) => void;
      interact: (id: PlaceId) => void;
      error: (message: string) => void;
      stats: (fps: number, draws: number, triangles: number) => void;
      movement: (status: MovementStatus) => void;
      contact: (event: WorldContact) => void;
      environment: (frame: EnvironmentFrame) => void;
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
      "Walkable Cosy village. Use arrow keys or WASD to glide, R to glide faster, Shift to dash, Space to jump, drag to look, click to glide to a spot, E for activities, F to chat with a nearby villager. Places provides direct access to every activity.",
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
      new T.AmbientLight("#e9d9ba", 0.08),
    );
    this.player.position.set(0.3, 0, 20);
    this.player.rotation.y = Math.PI;
    this.scene.add(this.player);
    this.walkMarker.rotation.x = -Math.PI / 2;
    this.walkMarker.visible = false;
    this.scene.add(this.walkMarker);
    this.camera.position.set(0.3, 2.0, 23.8);
    this.currentLook.set(0.3, 1.35, 20);
    this.camera.lookAt(this.currentLook);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.clearKeys);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.motionQuery.addEventListener("change", this.motionChange);
    this.motionChange();
    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerup", this.onUp);
    el.addEventListener("pointercancel", this.clearKeys);
    el.addEventListener("wheel", this.onWheel, { passive: false });
    el.addEventListener("webglcontextlost", this.onLost);
  }
  async load() {
    const [world, gltf] = await Promise.all([
      buildWorld(this.callbacks.progress, this.renderer),
      new GLTFLoader().loadAsync(
        withBasePath("/village/models/spirit.glb?v=1"),
      ),
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
    this.life = new VillageLife(root, world.colliders);
    this.scene.add(this.life.group);
    this.dialogue = new VillagerDialogue(this.host, this.life, world.colliders, this.clearKeys);
    this.dialogue.setLanguage(this.language);
    this.dialogue.setEnabled(!this.blocked && !this.place);
    this.resize();
    this.buildInterior();
    this.activities=new VillageActivities(this.world.colliders);
    this.world.group.add(this.activities.outdoor);this.scene.add(this.activities.indoor);
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
      color: "#b2a081",
      roughness: 1,
    });
    const glow = new T.MeshStandardMaterial({
      color: "#b0d5dd",
      emissive: "#c6e3df",
      emissiveIntensity: .55,
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
    cube(plaster, 4.5, 2.5, 0, 0.25, 5, 9);
    cube(plaster, -4.5, 2.5, 0, 0.25, 5, 9);
    for (const x of [-4, -2, 0, 2, 4]) {
      cube(wooden, x, 4.5, 0, 0.2, 0.2, 9);
      cube(wooden, x, 2.2, -4.3, 0.18, 4.5, 0.18);
    }
    cube(wooden, -2.1, 2.5, -4.28, 2.5, 2.8, 0.18);
    cube(glow, -2.1, 2.5, -4.15, 2.2, 2.5, 0.05);
    cube(wooden, -2.1, 2.5, -4.05, 0.08, 2.5, 0.08);
    cube(wooden, -2.1, 2.5, -4.05, 2.3, 0.08, 0.08);
    cube(wooden, -1.6, 1, -2, 3, 0.16, 1.4);
    for (const x of [-2.85, -0.35])
      for (const z of [-2.5, -1.5]) cube(wooden, x, 0.45, z, 0.12, 0.95, 0.12);
    const paper = new T.MeshStandardMaterial({ color: "#e2d4af" });
    cube(paper, -1.4, 1.1, -1.95, 0.7, 0.03, 0.5).rotation.y = 0.12;
    const mug = new T.Mesh(
      new T.CylinderGeometry(0.13, 0.1, 0.24, 20),
      new T.MeshStandardMaterial({ color: "#a9aa82" }),
    );
    mug.position.set(-2.6, 1.2, -2.2);
    g.add(mug);
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
    const embers=new T.MeshStandardMaterial({color:"#25160e",emissive:"#d64408",emissiveIntensity:.45,roughness:1});
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
    for (const x of [-3.34, -.84]) {
      const curtain = new T.PlaneGeometry(.52, 2.7, 12, 1);
      const vertices = curtain.attributes.position;
      for (let i = 0; i < vertices.count; i++) vertices.setZ(i, Math.sin(vertices.getX(i) * 34) * .045);
      curtain.computeVertexNormals(); const mesh = new T.Mesh(curtain, linen);
      mesh.position.set(x, 2.5, -3.99); g.add(mesh);
    }
    cube(wooden, -2.1, 3.96, -4, 3.15, .065, .065);
    for (const side of [-1, 1]) for (let row = 0; row < 5; row++) cube(stone, 2.7 + side * 1.02, .23 + row * .44, -3.53, .35, .39, .42);
    for (let i = 0; i < 7; i++) cube(stone, 1.84 + i * .285, 2.4, -3.48, .26, .3, .48);
    cube(wooden, 1.5, 3.45, -4.04, 3.4, .12, .55);
    const pottery = new T.MeshStandardMaterial({ color: "#70877b", roughness: .55 });
    for (const [x, scale] of [[.25, .18], [1, .23], [2.45, .15]]) {
      const vase = new T.Mesh(new T.LatheGeometry([new T.Vector2(.45, 0), new T.Vector2(.75, .3), new T.Vector2(.8, 1), new T.Vector2(.35, 1.5), new T.Vector2(.38, 1.8)], 16), pottery);
      vase.scale.setScalar(scale); vase.position.set(x, 3.51, -4.02); g.add(vase);
    }
    const windowBounce = new T.PointLight("#ffe1ae", 9, 8, 2);
    windowBounce.position.set(-2, 2.7, -3.3); g.add(windowBounce);
    // Batch static furniture while retaining light and flame objects independently.
    g.updateMatrixWorld(true);
    const batches = new Map<T.Material, T.BufferGeometry[]>();
    const pieces: T.Mesh[] = [];
    g.traverse(o => {
      if (!(o instanceof T.Mesh) || Array.isArray(o.material)) return;
      o.updateMatrix(); const geometry = o.geometry.clone().applyMatrix4(o.matrix);
      const list = batches.get(o.material) ?? []; list.push(geometry); batches.set(o.material, list); pieces.push(o);
    });
    pieces.forEach(o => { o.removeFromParent(); o.geometry.dispose(); });
    batches.forEach((parts, material) => {
      const geometry = mergeGeometries(parts); parts.forEach(p => p.dispose());
      if (geometry) { const mesh = new T.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; g.add(mesh); }
    });
    this.indoorLight.position.set(112.7, 2, -2.8);
  }
  private resize() {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    this.statsTime = this.qualityChangedAt = performance.now();
    this.frameSum = this.frames = this.slowSamples = 0;
    this.renderer.setPixelRatio(graphicsPixelRatio(this.graphicsTier, w, h, window.devicePixelRatio));
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.compactView = w <= 700;
    this.camera.clearViewOffset();
    if (this.place) {
      this.camera.setViewOffset(w,h,w>700?w*.16:0,w>700?0:h*.18,w,h);
    }
    this.camera.updateProjectionMatrix();
    this.dialogue?.resize(w, h);
  }
  setBlocked(v: boolean) {
    this.blocked = v;
    this.dialogue?.setEnabled(!v && !this.place);
    if (v) {
      this.clearKeys();
    }
  }
  setLanguage(language: "en" | "ja") {
    this.language = language;
    this.dialogue?.setLanguage(language);
    this.world?.setLanguage(language);
  }
  setQuality(q: Quality) {
    this.quality = q;
    this.graphicsTier = initialGraphicsTier(q);
    this.applyGraphicsTier();
  }
  private applyGraphicsTier() {
    const budget = GRAPHICS_TIERS[this.graphicsTier];
    this.qualityChangedAt = this.statsTime = performance.now();
    this.frameSum = this.frames = this.slowSamples = 0;
    this.renderer.shadowMap.enabled = budget.shadowSize > 0;
    // Changing the light's shadow count also invalidates Three's cached lighting shaders.
    this.sun.castShadow = this.renderer.shadowMap.enabled;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
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
      shadows: this.renderer.shadowMap.enabled,
      antialias: gl.getContextAttributes()?.antialias,
      contextLost: gl.isContextLost(),
    };
  }
  setWeather(w: Weather) {
    this.weather = w;
    this.renderer.shadowMap.needsUpdate = true;
  }
  private updateLighting(dt: number) {
    const speed = this.reducedMotion ? 1 : 1 - Math.exp(-dt * 2.4);
    this.weatherBlend.rain = T.MathUtils.lerp(this.weatherBlend.rain, this.weather === "rain" ? 1 : 0, speed);
    this.weatherBlend.dusk = T.MathUtils.lerp(this.weatherBlend.dusk, this.weather === "dusk" ? 1 : 0, speed);
    const { rain, dusk } = this.weatherBlend;
    const blendColor = (color: T.Color, golden: string, evening: string, overcast: string) => {
      color.set(golden).lerp(this.lightColor.set(evening), dusk).lerp(this.lightColor.set(overcast), rain);
    };
    blendColor(this.sun.color, "#ffe5b2", "#efa885", "#cedbe2");
    this.sun.intensity = 4.1 - dusk * 3.5 - rain * 3.35;
    this.fill.intensity = 1.05 - dusk * .2 + rain * .37;
    blendColor(this.fill.color, "#bfd8ef", "#7b97d0", "#b3c6cf");
    blendColor(this.fill.groundColor, "#7a7351", "#424c56", "#6f7c70");
    this.bounce.intensity = .65 - dusk*.19 - rain*.14;
    this.scene.environmentIntensity = .34 - dusk*.14 + rain*.05;
    this.renderer.toneMappingExposure = 1.02 + dusk*.06;
    const fog = this.scene.fog as T.FogExp2;
    blendColor(fog.color, "#bfd9da", "#8894bf", "#a3b8bd");
    fog.density = .0046 + rain * .005 + dusk * .001;
    this.world?.setWeather(rain, dusk);
    this.atmosphere.setWeather(rain, dusk);
  }
  setActivityMoment(moment:ActivityMoment) { this.activities?.setMoment(moment); }
  setPlace(id: PlaceId | null) {
    this.dialogue?.setEnabled(!id && !this.blocked);
    const previousPlace = this.place;
    if (id && !previousPlace) this.walkingHeading=this.player.rotation.y;
    this.activities?.enter(id);
    this.renderer.shadowMap.needsUpdate = true;
    this.place = id;
    if (this.world) this.world.group.visible = id !== "focus";
    if (this.life) this.life.group.visible = id !== "focus";
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
    this.indoorLight.intensity = id === "focus" ? 18 : 0;
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
    this.player.position.fromArray(p.position);
    this.player.position.y = floorHeight(p.position[0], p.position[2]);
    this.movement?.settle(p.position[0], p.position[2]);
    this.near = id;
    this.callbacks.near(id);
    this.setPlace(id);
  }
  walkKey(key: string, down: boolean) {
    if (down && (this.blocked || this.place)) return;
    if (down) {
      this.keys.add(key);
      if (key === " ") this.movement?.jump();
    } else this.keys.delete(key);
  }
  toggleRun() { this.running = !this.running; this.reportMovement(true); }
  private updateActivityCamera(place: PlaceId) {
    const stage=ACTIVITY_STAGES[place];
    this.cameraGoal.fromArray(stage.camera);
    this.lookGoal.fromArray(stage.look);
    if(this.compactView) {
      this.temp.fromArray(stage.actor).y+=1.1;
      this.lookGoal.lerp(this.temp,.7);
    }
  }
  private updateWalkingCamera() {
    this.lookGoal.copy(this.player.position).add(this.temp.set(0, 1.35, 0));
    this.lookGoal.y += Math.max(0, -Math.sin(this.pitch)) * 2.4;
    this.cameraGoal.copy(this.player.position).add(this.temp.set(
      Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance,
      1.35 + Math.sin(this.pitch) * this.distance,
      Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance,
    ));
    this.cameraRay.origin.copy(this.lookGoal);
    this.cameraRay.direction.subVectors(this.cameraGoal, this.lookGoal).normalize();
    for (const c of this.world?.colliders ?? []) {
      this.collisionBox.min.set(c.x - c.w / 2 - 0.3, c.bottom ?? 0, c.z - c.d / 2 - 0.3);
      this.collisionBox.max.set(c.x + c.w / 2 + 0.3, c.top ?? 8, c.z + c.d / 2 + 0.3);
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
    const status = { stamina: Math.round(m.stamina), exhausted: m.exhausted, gait: m.gait, running: this.running };
    const key = JSON.stringify(status);
    if (force || key !== this.lastStatus) {
      this.lastStatus = key;
      this.callbacks.movement(status);
    }
  }
  private frame(now: number) {
    if (this.disposed || document.hidden) return;
    const frameDelta = this.lastTime ? (now - this.lastTime) / 1000 : 0.016;
    let dt = Math.min(frameDelta, 0.06);
    this.lastTime = now;
    this.elapsed += dt;
    if (!this.world) return;
    const movement = this.movement!;
    this.direction.set(0, 0, 0);
    if (!this.blocked && !this.place) {
      const forward = Number(this.keys.has("w") || this.keys.has("arrowup")) - Number(this.keys.has("s") || this.keys.has("arrowdown"));
      const side = Number(this.keys.has("d") || this.keys.has("arrowright")) - Number(this.keys.has("a") || this.keys.has("arrowleft"));
      this.direction.set(side * Math.cos(this.yaw) - forward * Math.sin(this.yaw), 0,
        -forward * Math.cos(this.yaw) - side * Math.sin(this.yaw));
      if (this.direction.lengthSq() > 0) {
        this.walkTarget = undefined; this.direction.normalize();
      } else if (this.walkTarget) {
        this.direction.subVectors(this.walkTarget, this.player.position); this.direction.y = 0;
        if (this.direction.length() < 0.25) { this.walkTarget = undefined; this.direction.set(0, 0, 0); }
        else this.direction.normalize();
      }
    }
    movement.update(dt, { x: this.direction.x, z: this.direction.z, run: this.running,
      sprint: this.keys.has("shift"), blocked: this.blocked || this.place !== null });
    this.player.position.set(movement.position.x, movement.position.y, movement.position.z);
    this.walkMarker.visible = !!this.walkTarget && !this.blocked && !this.place;
    if (this.walkTarget) {
      this.walkMarker.position.set(this.walkTarget.x, floorHeight(this.walkTarget.x, this.walkTarget.z) + .065, this.walkTarget.z);
      this.walkMarker.scale.setScalar(this.reducedMotion ? 1 : 1 + Math.sin(this.elapsed*4)*.08);
    }
    const moving = movement.speed > 0.12;
    if (moving) {
      const angle = Math.atan2(movement.velocity.x, movement.velocity.z);
      const turn = T.MathUtils.euclideanModulo(angle - this.player.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
      this.player.rotation.y += turn * (1 - Math.exp(-dt * 14));
    } else {
      if (this.walkTarget && this.direction.lengthSq() > 0) this.walkTarget = undefined;
    }
    if (!this.blocked && !this.place) {
      let near: PlaceId | null = null,
        dist = 4;
      PLACES.forEach((p) => {
        const d = Math.hypot(
          p.position[0] - this.player.position.x,
          p.position[2] - this.player.position.z,
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
    }
    if (now - this.statusTime > 100) { this.reportMovement(); this.statusTime = now; }
    if (this.character) {
      const bob = this.reducedMotion || this.blocked ? 0 : Math.sin(this.elapsed*2.8)*.065;
      this.character.position.y = .62 + bob;
      this.character.rotation.x = T.MathUtils.lerp(this.character.rotation.x, this.reducedMotion ? 0 : movement.speed*.022, 1-Math.exp(-dt*8));
      this.character.rotation.z = this.reducedMotion || this.blocked ? 0 : Math.sin(this.elapsed*1.7)*.035;
      const squash = this.reducedMotion ? 0 : movement.landing>0 ? -.1 : movement.takeoff>0 ? .09 : 0;
      this.character.scale.set(this.spiritScale*(1-squash*.4),this.spiritScale*(1+squash),this.spiritScale*(1-squash*.4));
      this.spiritFins.forEach((fin,i) => { fin.rotation.z = this.reducedMotion || this.blocked ? 0 : Math.sin(this.elapsed*(moving?8:3)+i*Math.PI)*.18; });
    }
    this.activities?.update(this.elapsed,this.place,this.reducedMotion,this.player,this.character,this.spiritScale);
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
    if (this.place !== "focus") this.life?.update(dt, this.elapsed, this.player.position, this.reducedMotion, !this.blocked && !this.place);
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
      if (f.userData.light) f.userData.light.intensity = (f.userData.interior ? (this.place === "focus" ? 18 : 0) : 9) * (1 + Math.sin(t*7.1)*.045 + Math.sin(t*11.7)*.03);
      if (f.userData.coal) f.userData.coal.emissiveIntensity=.45+Math.sin(t*2.1)*.1;
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
    // Refresh moving shadows every frame in detailed view; cap simple view at 30 Hz.
    if (this.renderer.shadowMap.enabled && now - this.shadowTime > (this.graphicsTier === "detailed" ? 0 : 32) && (!this.reducedMotion || moving)) {
      const texel = 48 / this.sun.shadow.mapSize.x;
      const x = Math.round(this.player.position.x / texel) * texel, z = Math.round(this.player.position.z / texel) * texel;
      this.sun.position.set(x + 35, 28, z - 48);
      this.sun.target.position.set(x, 0, z);
      this.sun.target.updateMatrixWorld();
      this.renderer.shadowMap.needsUpdate = true; this.shadowTime = now;
    }
    this.renderer.render(this.scene, this.camera);
    this.dialogue?.update(dt, this.camera, this.player.position, this.weather);
    this.frameSum += frameDelta;
    this.frames++;
    if (now - this.statsTime > 2000) {
      const fps = Math.round(this.frames / this.frameSum);
      this.callbacks.stats(
        fps,
        this.renderer.info.render.calls,
        this.renderer.info.render.triangles,
      );
      this.slowSamples = fps < 45 ? this.slowSamples + 1 : 0;
      // Keep the selected preference: automatic and battery modes can step down again.
      // Ignore startup/resizing and isolated slow samples; explicit Detailed stays fixed.
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
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.clearKeys);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.motionQuery.removeEventListener("change", this.motionChange);
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onDown);
    el.removeEventListener("pointermove", this.onMove);
    el.removeEventListener("pointerup", this.onUp);
    el.removeEventListener("pointercancel", this.clearKeys);
    el.removeEventListener("wheel", this.onWheel);
    el.removeEventListener("webglcontextlost", this.onLost);
    this.dialogue?.dispose();
    this.life?.dispose();
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
    this.skyTexture?.dispose();
    this.renderer.dispose();
    this.host.replaceChildren();
  }
}

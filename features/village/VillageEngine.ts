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
  private language: "en" | "ja" = "en";
  private world?: World;
  private environment?: T.WebGLRenderTarget;
  private skyTexture?: T.DataTexture;
  private player = new T.Group();
  private character?: T.Object3D;
  private mixer?: T.AnimationMixer;
  private actions: Record<string, T.AnimationAction> = {};
  private currentAction = "";
  private movement?: VillageMovement;
  private running = false;
  private lastStatus = "";
  private statusTime = 0;
  private environmentTime = 0;
  private shadowTime = 0;
  private scarf?: T.Bone;
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
  private lastTime = 0;
  private elapsed = 0;
  private resizeObserver: ResizeObserver;
  private disposed = false;
  private blocked = false;
  private place: PlaceId | null = null;
  private near: PlaceId | null = null;
  private autoQuality = true;
  private quality: Quality = "auto";
  private frameSum = 0;
  private frames = 0;
  private statsTime = 0;
  private reducedMotion = false;
  private motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  private sun = new T.DirectionalLight("#ffd092", 3.4);
  private fill = new T.HemisphereLight("#dce8ea", "#b4aa83", 1.4);
  private cameraGoal = new T.Vector3();
  private lookGoal = new T.Vector3();
  private currentLook = new T.Vector3();
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Walkable Cosy village. Use arrow keys or WASD to walk, R to toggle run, Shift to sprint, Space to jump, drag to look, E for activities, F to chat with a nearby villager. Places provides direct access to every activity.",
    );
    this.renderer.domElement.tabIndex = 0;
    this.host.appendChild(this.renderer.domElement);
    this.scene.fog = new T.FogExp2("#c3c3a8", 0.004);
    this.sun.position.set(-35, 26, -55);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -40,
      right: 40,
      top: 45,
      bottom: -45,
      near: 1,
      far: 130,
    });
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.035;
    this.scene.add(
      this.sun,
      this.fill,
      this.indoorLight,
      new T.AmbientLight("#fff1d6", 0.18),
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
        withBasePath("/village/models/traveller.glb"),
      ),
    ]);
    if (this.disposed) {
      world.dispose();
      return;
    }
    this.world = world;
    this.movement = new VillageMovement(world.colliders, this.callbacks.contact);
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
    root.scale.setScalar(1.8 / height);
    root.position.y = -b.min.y * (1.8 / height);
    root.traverse((o) => {
      if (o instanceof T.Bone && o.name === "Scarf") this.scarf = o;
      if (o instanceof T.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    // Merge static pieces under each animated limb while retaining its pivot.
    const parents: T.Object3D[] = [];
    root.traverse((node) => {
      if (node.children.some((child) => child instanceof T.Mesh && !(child instanceof T.SkinnedMesh)))
        parents.push(node);
    });
    for (const parent of parents) {
      const batches = new Map<T.Material, T.Mesh[]>();
      for (const child of parent.children) {
        if (!(child instanceof T.Mesh) || child instanceof T.SkinnedMesh || Array.isArray(child.material))
          continue;
        const meshes = batches.get(child.material) || [];
        meshes.push(child);
        batches.set(child.material, meshes);
      }
      batches.forEach((meshes, material) => {
        if (meshes.length < 2) return;
        const parts = meshes.map((mesh) => {
          mesh.updateMatrix();
          return mesh.geometry.clone().applyMatrix4(mesh.matrix);
        });
        const geometry = mergeGeometries(parts);
        parts.forEach((part) => part.dispose());
        if (!geometry) return;
        meshes.forEach((mesh) => {
          parent.remove(mesh);
          mesh.geometry.dispose();
        });
        const combined = new T.Mesh(geometry, material);
        combined.castShadow = true;
        combined.receiveShadow = true;
        parent.add(combined);
      });
    }
    this.player.add(root);
    this.character = root;
    this.mixer = new T.AnimationMixer(root);
    gltf.animations.forEach((c) => {
      this.actions[c.name] = this.mixer!.clipAction(c);
      if (["JumpStart", "LandSoft", "LandMoving"].includes(c.name)) {
        this.actions[c.name].setLoop(T.LoopOnce, 1);
        this.actions[c.name].clampWhenFinished = true;
      }
    });
    this.animateCharacter("Idle");
    this.life = new VillageLife(root, gltf.animations, world.colliders);
    this.scene.add(this.life.group);
    this.dialogue = new VillagerDialogue(this.host, this.life, world.colliders, this.clearKeys);
    this.dialogue.setLanguage(this.language);
    this.dialogue.setEnabled(!this.blocked && !this.place);
    this.resize();
    this.buildInterior();
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
    const wooden =
      materials.find(
        (m) =>
          m instanceof T.MeshStandardMaterial &&
          m.map?.name === "wood-color.jpg",
      ) || new T.MeshStandardMaterial({ color: "#644d32" });
    const stone =
      materials.find(
        (m) =>
          m instanceof T.MeshStandardMaterial &&
          m.map?.name === "stone-color.jpg",
      ) || new T.MeshStandardMaterial({ color: "#888374" });
    const plaster = new T.MeshStandardMaterial({
      color: "#b2a081",
      roughness: 1,
    });
    const glow = new T.MeshStandardMaterial({
      color: "#edb261",
      emissive: "#ed9c3a",
      emissiveIntensity: 2,
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
    cube(
      new T.MeshStandardMaterial({
        color: "#27160d",
        emissive: "#d64408",
        emissiveIntensity: 0.5,
      }),
      2.7,
      0.3,
      -3.5,
      1.45,
      0.08,
      0.65,
    );
    cube(wooden, 2.7, 2.75, -3.9, 2.8, 0.18, 0.9);
    for (let i = 0; i < 3; i++) {
      const f = makeFlame(0.65, 1.15);
      f.position.set(112.25 + i * 0.42, 0.82, -3.38);
      this.scene.add(f);
      f.visible = false;
      f.userData.interior = true;
      this.world?.flames.push(f);
    }
    const cloth = new T.MeshStandardMaterial({ color: "#aa7958", roughness: 1 });
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
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dialogue?.resize(w, h);
  }
  private animateCharacter(name: string) {
    if (this.currentAction === name) return;
    const next = this.actions[name] || this.actions.Idle;
    if (!next) {
      this.actions[this.currentAction]?.fadeOut(0.25);
      this.currentAction = name;
      return;
    }
    this.actions[this.currentAction]?.fadeOut(0.16);
    next.reset().fadeIn(name === "JumpStart" || name.startsWith("Land") ? 0.065 : 0.16).play();
    this.currentAction = name;
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
  }
  setQuality(q: Quality) {
    this.quality = q;
    this.autoQuality = q === "auto";
    const low = q === "low";
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, low ? 0.85 : 1.25),
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    const shadowSize = low ? 1024 : 2048;
    if (this.sun.shadow.mapSize.x !== shadowSize) {
      this.sun.shadow.map?.dispose(); this.sun.shadow.map = null;
      this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    }
    this.world?.vegetation.forEach(mesh => {
      if (mesh.userData.fullCount === undefined) mesh.userData.fullCount = mesh.count;
      mesh.count = Math.floor(mesh.userData.fullCount * (low ? 0.58 : 1));
    });
    this.resize();
  }
  setWeather(w: Weather) {
    this.weather = w;
    this.renderer.shadowMap.needsUpdate = true;
    const dusk = w === "dusk",
      rain = w === "rain";
    this.scene.backgroundIntensity = dusk ? 0.13 : rain ? 0.35 : 0.65;
    this.sun.color.set(dusk ? "#d9926c" : rain ? "#d9e2dd" : "#ffdaa0");
    this.sun.intensity = dusk ? 0.7 : rain ? 0.85 : 3.8;
    this.fill.intensity = dusk ? 0.78 : rain ? 1.3 : 1.65;
    this.fill.color.set(dusk ? "#7b94c5" : rain ? "#b0c0c4" : "#aecbe9");
    this.fill.groundColor.set(dusk ? "#484f48" : "#879565");
    this.scene.environmentIntensity = dusk ? .17 : rain ? .4 : .48;
    this.renderer.toneMappingExposure = dusk ? 1 : 1.08;
    const fog = this.scene.fog as T.FogExp2;
    fog.color.set(dusk ? "#69758e" : rain ? "#a3b3b1" : "#b9c9c4");
    fog.density = rain ? 0.009 : 0.0035;
  }
  setPlace(id: PlaceId | null) {
    this.dialogue?.setEnabled(!id && !this.blocked);
    const wasSettled = this.place !== null;
    this.renderer.shadowMap.needsUpdate = true;
    this.place = id;
    if (this.world) this.world.group.visible = id !== "focus";
    if (this.life) this.life.group.visible = id !== "focus";
    if (id === "focus") {
      this.camera.position.set(110.2, 2.25, 2.8);
      this.currentLook.set(110, 1.8, -3.8);
    } else if (id) {
      const p = PLACES.find((p) => p.id === id)!;
      this.camera.position.fromArray(p.camera);
      this.currentLook.fromArray(p.look);
    }
    this.clearKeys();
    this.movement?.settle();
    if (!id && wasSettled) {
      this.updateWalkingCamera();
      this.camera.position.copy(this.cameraGoal);
      this.currentLook.copy(this.lookGoal);
      this.camera.lookAt(this.currentLook);
    }
    this.player.visible = !id;
    if (this.indoor) this.indoor.visible = id === "focus";
    this.indoorLight.intensity = id === "focus" ? 18 : 0;
    this.world?.flames.forEach((f) => {
      if (f.userData.interior) f.visible = id === "focus";
    });
    if (!id) {
      this.animateCharacter("Idle");
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
    const moving = movement.speed > 0.12;
    if (moving) {
      const angle = Math.atan2(movement.velocity.x, movement.velocity.z);
      const turn = T.MathUtils.euclideanModulo(angle - this.player.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
      this.player.rotation.y += turn * (1 - Math.exp(-dt * 14));
    } else if (this.walkTarget && this.direction.lengthSq() > 0) this.walkTarget = undefined;
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
    const clip = movement.takeoff > 0 ? "JumpStart" : !movement.grounded ? "AirLoop"
      : movement.landing > 0 ? moving ? "LandMoving" : "LandSoft"
      : movement.gait === "sprint" ? "Sprint" : movement.gait === "run" ? "Run" : moving ? "Walk" : "Idle";
    this.animateCharacter(clip);
    this.mixer?.update(this.blocked ? 0 : dt);
    const action = this.actions[clip];
    if (action && ["Walk", "Run", "Sprint"].includes(clip)) {
      action.time = (movement.phase % 1) * action.getClip().duration;
      this.mixer?.update(0);
    }
    if (now - this.statusTime > 100) { this.reportMovement(); this.statusTime = now; }
    if (this.scarf && !this.reducedMotion)
      this.scarf.rotation.y += Math.sin(this.elapsed * 2.3) * windAt(this.elapsed, this.weather) * .13;
    if (this.place === "focus") {
      this.cameraGoal.set(110.2, 2.25, 2.8);
      this.lookGoal.set(110, 1.8, -3.8);
    } else if (this.place) {
      const p = PLACES.find((p) => p.id === this.place)!;
      this.cameraGoal.fromArray(p.camera);
      this.lookGoal.fromArray(p.look);
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
    this.atmosphere.update(t, this.weather, this.camera.position);
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
    });
    if (this.place !== "focus") {
      this.camera.updateMatrixWorld();
      this.viewProjection.multiplyMatrices(
        this.camera.projectionMatrix,
        this.camera.matrixWorldInverse,
      );
      this.treeFrustum.setFromProjectionMatrix(this.viewProjection);
      for (const batch of this.world.trees) {
        let count = 0;
        batch.bounds.forEach((bounds, index) => {
          if (this.treeFrustum.intersectsSphere(bounds) || bounds.center.distanceToSquared(this.player.position) < 32 * 32)
            batch.mesh.setMatrixAt(count++, batch.transforms[index]);
        });
        batch.mesh.count = count;
        batch.mesh.instanceMatrix.needsUpdate = true;
      }
    }
    // Bound moving foliage/character shadow work; stationary weather still has animated casters.
    if (now - this.shadowTime > (this.quality === "low" ? 180 : 100) && (!this.reducedMotion || moving)) {
      this.renderer.shadowMap.needsUpdate = true; this.shadowTime = now;
    }
    this.renderer.render(this.scene, this.camera);
    this.dialogue?.update(dt, this.camera, this.player.position, this.weather);
    this.frameSum += frameDelta;
    this.frames++;
    if (now - this.statsTime > 4000) {
      const fps = Math.round(this.frames / this.frameSum);
      this.callbacks.stats(
        fps,
        this.renderer.info.render.calls,
        this.renderer.info.render.triangles,
      );
      if (this.autoQuality && this.elapsed > 8 && fps < 28) {
        this.setQuality("low");
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
    this.mixer?.stopAllAction();
    this.dialogue?.dispose();
    this.life?.dispose();
    this.world?.group.removeFromParent();
    this.world?.dispose();
    this.scene.traverse((object) => {
      if (!(object instanceof T.Mesh) && !(object instanceof T.LineSegments))
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

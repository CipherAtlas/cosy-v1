import { DEFAULT_KEYBINDINGS, gameKey, type Keybindings } from "./keybindings";
import { activityInLayout, configureLayoutInteractions } from "./layoutInteractions";
import { addSupplementalLayout } from "./placeableAssets";
import { SceneLayout } from "./sceneLayout";
import * as T from "three";
import { VillageVisitors, tintSpirit, glowSpirit } from "./villageVisitors";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { buildWorld, type VillageBench, type World } from "./world";
import { VillageMovement } from "./movement";
import { createAtmosphere } from "./atmosphere";
import { BirdFlock, type BirdStatus } from "./birds";
import { AnimalDialogue, type AnimalDialogueCue } from "./animalDialogue";
import { PuppyPack, puppyCommandForKey, type NearbyPuppy, type PuppyCommand } from "./puppies";
import type { PuppyBreed } from "./worldLayout";
import { VillageLife } from "./life";
import { CompanionHands, relaxBlobArm } from "./companionWalk";
import { VillagerDialogue } from "./dialogue";
import { VillageActivities, ACTIVITY_STAGES } from "./activityScene";
import { GardenScene } from "./gardenScene";
import { clearSurfacePlanting } from "./plantingClearance";
import { GARDEN_TARGETS, HARVEST_COMPLIMENTS, freshGarden, nearbyGardenAction, type GardenState, type GardenAction, type GardenSound } from "./garden";
import type { ActivityMoment } from "./environment";
import { skipDistantPointLights, softenShadowEdges } from "./shadows";
import { GRAPHICS_TIERS, graphicsPixelRatio, initialGraphicsTier, slowerGraphicsTier, type GraphicsTier } from "./graphics";
import { BIRD_CLEARING, BRIDGE, floorHeight, windAt, type MovementStatus, type WorldContact, type EnvironmentFrame } from "./environment";
import { PLACES, type PlaceId, type Quality, type Weather } from "./places";
import { withBasePath } from "@/lib/basePath";
import type { SharedChatEntry, SharedVisitor, SharedPuppyTrick } from "./sharedWorld";
import { loadVillageLayout, loadPlacedPuppies } from "./villageAssets";
import { VegetationDetail } from "./vegetationDetail";
import { instanceCells } from "./spatialRendering";
import { optimizeGardenGeometry } from "./geometryOptimization";
import { VillageCamera } from "./villageCamera";
import { buildFocusCottage } from "./focusCottageScene";
import { CottageCat, type CottageCatStatus } from "./cottageCat";
import { animalRigSlugsForLayout, loadAnimalRigs, makeAnimalRig, disposeAnimalRig } from "./animalRig";
import { type SwingSeat } from "./swings";
import type { SharedActors, SharedInteraction, InteractionResult } from "./sharedActors";
import type { SharedHorseInput } from "./sharedActors";
import { HorseRiding } from "./horseRiding";
import { VillageHorses, type NearbyHorse } from "./horses";
import type { HorseSoundEvent } from "./horseAudio";
import { TownInteractions, type TownContext } from "./townInteractions";
import type { ForageInventory, TownAction } from "./townShared";
import { loadTownAssetKit, TOWN_ASSET_IDS } from "./townAssets";
import { TownAnimals } from "./townAnimals";
import { TownScene } from "./townScene";
import { VILLAGERS } from "./villagers";
import type { MapActor } from "./sharedActors";
import { townActivityHUD, type TownActivityHUDState } from "./townProgress";
import type { AnimalSoundSource, TownAnimalSoundEvent } from "./townAnimalAudio";
import { RaceGuide } from "./raceGuide";

export class VillageEngine {
  readonly renderer: T.WebGLRenderer;
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(55, 1, 0.12, 1100);
  private atmosphere = createAtmosphere();
  private life?: VillageLife;
  private companionHands = new CompanionHands();
  private birds?: BirdFlock;
  private animalDialogue?: AnimalDialogue;
  private animalDialogueCues: AnimalDialogueCue[] = [];
  private puppies?: PuppyPack;
  private horses?: VillageHorses;
  private horseRiding = new HorseRiding();
  private nearHorse: NearbyHorse | null = null;
  private townInteractions?: TownInteractions;
  private townContext: TownContext | null = null;
  private townContextSignature = "";
  private activityHUDSignature = "";
  private forageInventory: ForageInventory = { apples: 0, mushrooms: 0 };
  private sharedTimeOffset = 0;
  private townAnimals?: TownAnimals;
  private townScene?: TownScene;
  private raceGuide?: RaceGuide;
  private horseMountPending = false;
  private horseMountCancelled = false;
  private nearPuppy: NearbyPuppy | null = null;
  private puppyPetTarget = new T.Vector3();
  private puppyPetSide = -1;
  private puppyTrickId: string | null = null;
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
  private visitors: VillageVisitors;
  private get remoteVisitors() { return this.visitors.entries; }
  private pendingPuppyTricks = new Map<string, SharedPuppyTrick>();
  private sharedSlot: number | null = null;
  private sharedColor: string | null = null;
  private sharedSpawnPlaced = false;
  private sharedMode = false;
  private sharedConnected = false;
  private sharedSelfId = "";
  private sharedActors: SharedActors | null = null;
  private sharedInteraction: ((request: SharedInteraction) => Promise<InteractionResult>) | null = null;
  private pendingInteractions = new Set<string>();
  private heldPuppy: string | null = null;
  private activitySeat: 0 | 1 | null = null;
  private activityPosition: [number, number, number] | null = null;
  private lastSharedFollowers = "";
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
  private keybindings: Keybindings = DEFAULT_KEYBINDINGS;
  private yaw = 0;
  private pitch = 0.15;
  private mouseSensitivity = 1;
  private distance = 3.8;
  private teaPanAt = -100;
  private teaPan = 1;
  private teaPanHeld = false;
  private activityOrbit = { yaw: 0, pitch: 0 };
  private pointer?: {
    id: number;
    x: number;
    y: number;
    startX: number;
    startY: number;
    seat?: { id: string; index: 0 | 1 };
  };
  private benchRaycaster = new T.Raycaster();
  private benchPointer = new T.Vector2();
  private benchMatrix = new T.Matrix4();
  private benchHit = new T.Vector3();
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
  private nearSwing: SwingSeat | null = null;
  private ridingSwing: SwingSeat | null = null;
  private swingCamera = { yaw: 0, pitch: .15 };
  private swingPulse = { direction: 0, until: 0 };
  private swingBrakeUntil = 0;
  private quality: Quality = "low";
  private vegetationDetail?: VegetationDetail;
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
  private view = new VillageCamera();
  private currentLook = new T.Vector3();
  private compactView = false;
  private direction = new T.Vector3();
  private temp = new T.Vector3();
  private indoor?: T.Group;
  private cottageCat?: CottageCat;
  private cottageCatLoading?: Promise<void>;
  private catPetTarget = new T.Vector3();
  private coffeeSteam: T.Mesh[] = [];
  private bridgeWindow?: T.WebGLRenderTarget;
  private bridgeCamera = new T.PerspectiveCamera(56, 400 / 345, .12, 1100);
  private bridgeWindowTime = -1000;
  private rain?: T.LineSegments;
  private weather: Weather = "golden";
  private treeFrustum = new T.Frustum();
  private viewProjection = new T.Matrix4();
  private indoorLight = new T.PointLight("#ffb569", 0, 12, 1.7);
  private spiritLights = [new T.PointLight("#ffd17d", 0, 5, 2)];
  private spiritGlowApplied = -1;
  private onKeyDown = (e: KeyboardEvent) => {
    const key = gameKey(this.keybindings, e.key);
    if (e.key === "Escape") {
      if ((this.horseRiding.actor || this.horseMountPending) && !this.blocked) this.leaveHorse();
      if (this.ridingSwing && !this.blocked) this.leaveSwing();
      if (this.seatedBench && !this.blocked) this.stand();
      this.releaseMouseLook();
      this.clearKeys();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing || !key) return;
    if (this.place === "focus" && !this.blocked && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey && key === "e"
      && !(e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"))) {
      if (this.petCottageCat()) e.preventDefault();
      return;
    }
    if (
      this.blocked || this.place ||
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement ||
      (e.target instanceof HTMLElement && e.target.isContentEditable)
    )
      return;
    if (e.target instanceof HTMLButtonElement && (e.key === " " || e.key === "Enter")) return;
    if (!e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const action = this.townContext?.actions.find(action => action.key.toLowerCase() === key);
      if (action) { e.preventDefault(); if (!action.disabled) this.townAction(action.request); return; }
    }
    if (this.horseRiding.actor) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift", " "].includes(key)) {
        e.preventDefault(); this.keys.add(key);
      }
      if ((key === "e" || key === "r") && !e.repeat) { e.preventDefault(); this.leaveHorse(); }
      return;
    }
    if (this.ridingSwing) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (["w", "s", "arrowup", "arrowdown", " "].includes(key)) { e.preventDefault(); this.keys.add(key); }
      if (key === "e" && !e.repeat) { e.preventDefault(); this.leaveSwing(); }
      if (key === "r" && !e.repeat) { e.preventDefault(); this.resetPosition(); }
      return;
    }
    if (this.seatedBench?.birdClearing && key === "f" && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      this.callbacks.scatterBirds?.(true);
      return;
    }
    if (e.target instanceof HTMLButtonElement && (e.key === " " || e.key === "Enter")) return;
    if (
      ["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)
    )
      e.preventDefault();
    this.keys.add(key);
    if (key === " " && !e.repeat && !this.seatedBench) this.movement?.jump();
    if (key === "r" && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) this.resetPosition();
    if (key === "g" && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) this.toggleRun();
    if (key === "f" && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) this.dialogue?.talk();
    if (key === "c" && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) this.dialogue?.invite();
    if (key === "b" && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) this.dialogue?.bread();
    if (key === "p" && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey && this.nearPuppy)
      this.togglePuppyFollow(this.nearPuppy.id);
    if (key === "h" && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey)
      this.sendPuppyHome();
    if (!e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey && this.nearPuppy) {
      const command = puppyCommandForKey(key);
      if (command) this.commandPuppy(this.nearPuppy.id, command);
    }
    if (key === "e" && !e.repeat && !this.place) {
      if (this.nearHorse) { this.mountHorse(this.nearHorse.id); return; }
      if (this.nearSwing) { this.rideSwing(this.nearSwing.id, this.nearSwing.index); return; }
      if (this.dialogue?.visitTea()) return;
      if (this.seatedBench) this.stand();
      else if (this.nearBench) this.sit(this.nearBench.id);
      else if (this.nearGarden && nearbyGardenAction(this.nearGarden, this.gardenState)) this.callbacks.gardenInteract?.(this.nearGarden);
      else if (this.near === "birds") this.callbacks.scatterBirds?.();
      else if (this.nearPuppy) this.petPuppy(this.nearPuppy.id);
      else if (this.near && this.near !== "garden") this.callbacks.interact(this.near);
    }
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(gameKey(this.keybindings, e.key));
  private clearKeys = () => {
    this.keys.clear();
    this.horseRiding.stop();
    this.swingPulse.direction = 0;
    this.swingBrakeUntil = 0;
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
    const canvas = this.renderer.domElement;
    const locked = document.pointerLockElement === canvas;
    const rect = canvas.getBoundingClientRect();
    const seat = this.pickBenchSeat(locked ? rect.left + rect.width / 2 : e.clientX,
      locked ? rect.top + rect.height / 2 : e.clientY);
    if (locked) {
      if (seat) this.sit(seat.id, seat.index);
      return;
    }
    this.pointer = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      seat: seat ?? undefined,
    };
    if (seat || e.pointerType !== "mouse") canvas.setPointerCapture(e.pointerId);
    else this.captureMouse();
  };
  private onMove = (e: PointerEvent) => {
    if (!this.pointer || e.pointerId !== this.pointer.id || this.blocked) return;
    if (this.pointer.seat) {
      if (Math.hypot(e.clientX - this.pointer.startX, e.clientY - this.pointer.startY) < 8) return;
      this.pointer.seat = undefined;
      if (e.pointerType === "mouse") this.setMouseLook("drag");
    }
    if (!this.place && e.pointerType === "mouse" && this.mouseLook !== "drag") return;
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
    const { seat, startX, startY } = this.pointer;
    this.pointer = undefined;
    if (this.renderer.domElement.hasPointerCapture(e.pointerId)) this.renderer.domElement.releasePointerCapture(e.pointerId);
    if (seat && Math.hypot(e.clientX - startX, e.clientY - startY) < 8) this.sit(seat.id, seat.index);
  };
  private onMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement !== this.renderer.domElement || this.blocked) return;
    const step = .004 * this.mouseSensitivity;
    if (this.place) {
      this.teaPanHeld = true;
      this.activityOrbit.yaw = T.MathUtils.euclideanModulo(this.activityOrbit.yaw - e.movementX * step + Math.PI, Math.PI * 2) - Math.PI;
      this.activityOrbit.pitch = T.MathUtils.clamp(this.activityOrbit.pitch + e.movementY * step, -.8, .9);
    } else {
      this.yaw -= e.movementX * step;
      this.pitch = T.MathUtils.clamp(this.pitch + e.movementY * step, -.85, 1.35);
    }
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
      if (!this.wantsMouseLook || this.blocked || this.disposed || document.hidden) {
        this.releaseMouseLook();
        return;
      }
      this.pointer = undefined;
      this.setMouseLook("locked");
    } else {
      // Browsers can consume Esc while releasing pointer lock, without a page keydown.
      const escaped = this.mouseLook === "locked" && this.wantsMouseLook && !this.blocked && !document.hidden;
      this.wantsMouseLook = false;
      this.clearKeys();
      this.setMouseLook("free");
      if (escaped) {
        if (this.horseRiding.actor || this.horseMountPending) this.leaveHorse();
        if (this.ridingSwing) this.leaveSwing();
        if (this.seatedBench) this.stand();
        this.callbacks.escape?.();
      }
    }
  };
  private onPointerLockError = () => {
    this.pointerLockPending = false;
    if (this.disposed) {
      document.removeEventListener("pointerlockchange", this.onPointerLockChange);
      document.removeEventListener("pointerlockerror", this.onPointerLockError);
    }
    if (this.wantsMouseLook && !this.disposed && !this.blocked) this.setMouseLook("drag");
    this.wantsMouseLook = false;
  };
  captureMouse() {
    const canvas = this.renderer.domElement;
    if (this.blocked || this.disposed || !this.world || document.hidden
      || this.pointerLockPending || document.pointerLockElement === canvas) return;
    this.wantsMouseLook = true;
    this.pointerLockPending = true;
    if (!canvas.requestPointerLock) { this.onPointerLockError(); return; }
    try {
      const request = canvas.requestPointerLock();
      request?.catch(this.onPointerLockError);
    } catch { this.onPointerLockError(); }
  }
  releaseMouseLook() {
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
      nearSwing?: (seat: SwingSeat | null) => void;
      ridingSwing?: (seat: SwingSeat | null) => void;
      nearHorse?: (horse: NearbyHorse | null) => void;
      ridingHorse?: (horse: NearbyHorse | null) => void;
      horseSound?: (event: HorseSoundEvent) => void;
      townAnimalSound?: (event: TownAnimalSoundEvent) => void;
      animalNearby?: (sources: AnimalSoundSource[], walking: boolean) => void;
      townContext?: (context: TownContext | null) => void;
      activityHUD?: (state: TownActivityHUDState | null) => void;
      scatterBirds?: (fromBench?: boolean) => void;
      interact: (id: PlaceId) => void;
      error: (message: string) => void;
      stats: (fps: number, draws: number, triangles: number) => void;
      movement: (status: MovementStatus) => void;
      recovered?: (result: "nearby" | "entrance" | "unavailable") => void;
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
      nearPuppy?: (puppy: NearbyPuppy | null) => void;
      cottageCat?: (status: CottageCatStatus) => void;
      puppyFollowing?: (puppies: NearbyPuppy[]) => void;
      puppyPetted?: (puppy: NearbyPuppy) => void;
      puppyCommanded?: (puppy: NearbyPuppy, command: PuppyCommand) => void;
      sharedNotice?: (message: string) => void;
      escape?: () => void;
      puppySound?: (breed: PuppyBreed, position: [number, number, number], kind: "bark" | "happy") => void;
    },
  ) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.visitors = new VillageVisitors(this.scene, host);
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    // A cottage frame can render the outdoor window and the interior.
    this.renderer.info.autoReset = false;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Walkable Hearthwillow village. Use arrow keys or WASD to move, G to glide faster, hold Shift to run, Space to jump, or R to move to nearby safe ground if stuck. Click to capture the mouse and move it to look, including while seated or in an activity. Escape leaves an activity, stands up, gets off a swing or closes dog tricks, and releases the mouse. Tab and Shift Tab choose controls; Enter or Space activates them. M expands the village map, O opens Sound, comma opens Settings. E to pet a nearby puppy, tend plants, sit, enter activities, or share harvest over tea with nearby Luma; Enter to chat; F to chat with a villager; C to invite a nearby villager; B to ask Maple or Wren for crumbs when close.",
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
    const layout = loadVillageLayout();
    const animalRigs = layout.then(authored => loadAnimalRigs(animalRigSlugsForLayout(authored)));
    const sky = new HDRLoader().loadAsync(withBasePath("/village/textures/sunset.hdr")).catch(() => undefined);
    const [world, gltf, gardenKit, dove, puppyKit, placedCat, townKit] = await Promise.all([
      layout.then(authored => buildWorld(this.callbacks.progress, this.renderer, undefined, authored)),
      new GLTFLoader().loadAsync(
        withBasePath("/village/models/spirit.glb?v=3"),
      ),
      new GLTFLoader().loadAsync(withBasePath("/village/models/garden-pond.glb?v=2")),
      new GLTFLoader().loadAsync(withBasePath("/village/models/dove.glb?v=1")),
      layout.then(loadPlacedPuppies),
      animalRigs.then(() => layout).then(authored => authored.items?.some(item => item.visible && item.asset === "cottage-cat")
        ? makeAnimalRig("cat") : undefined),
      animalRigs.then(() => layout).then(authored => authored.items?.some(item => item.visible && TOWN_ASSET_IDS.includes(item.asset)) ? loadTownAssetKit() : undefined),
      animalRigs,
    ]);
    if (this.disposed) {
      world.dispose();
      (await sky)?.dispose();
      return;
    }
    this.world = world;
    this.townInteractions = new TownInteractions(world.authored);
    this.raceGuide = new RaceGuide(world.authored);
    this.scene.add(this.raceGuide.group);
    world.setLanguage(this.language);
    this.movement = new VillageMovement(world.colliders, event => {
      // A floating spirit has no footfalls; jump/landing events retain the movement contract.
      if (event.kind !== "footstep") this.callbacks.contact(event);
    });
    this.scene.add(world.group);
    try {
      const texture = await sky;
      if (!texture) throw Error("Environment map unavailable");
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
    const b = new T.Box3().setFromObject(root.getObjectByName("SpiritBody") ?? root),
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
    if (this.sharedColor) tintSpirit(root, this.sharedColor, false);
    this.placeSharedSpawn();
    const activityLayout = new SceneLayout(world.authored, world.group, world.colliders, world.benches);
    this.garden = new GardenScene(gardenKit.scene, world.colliders, (kind, position) => this.callbacks.gardenSound?.(kind, position), world.gardenSurfaces, this.sun.position.clone().sub(this.sun.target.position), world.authored);
    this.garden.setLanguage(this.language);
    this.garden.sync(this.gardenState); world.group.add(this.garden.group);
    await optimizeGardenGeometry(this.garden.group);
    activityLayout.capture("kitchen-garden", "Kitchen garden & pond life", "Furnishings", [this.garden.group], [24, 0, -6]);
    this.activities=new VillageActivities(this.world.colliders);
    this.world.group.add(this.activities.outdoor);this.scene.add(this.activities.indoor);
    activityLayout.capture("activity-furnishings", "Writing desk & activity furnishings", "Furnishings", [this.activities.outdoor], [0, 0, 0]);
    activityLayout.apply();
    const bankPlants: T.InstancedMesh[] = [];
    this.garden.group.traverse(object => { if (object instanceof T.InstancedMesh && object.userData.bankPlant) bankPlants.push(object); });
    clearSurfacePlanting(world.group, bankPlants);
    for (const mesh of bankPlants) instanceCells(mesh, 8, "Pond planting", .1);
    this.vegetationDetail = new VegetationDetail(world.vegetation);
    configureLayoutInteractions(world.authored);
    await addSupplementalLayout(world, gardenKit.scene, placedCat, townKit);
    if (townKit) {
      this.townAnimals = new TownAnimals(world.authored, townKit, root, event => this.callbacks.townAnimalSound?.(event));
      this.townScene = new TownScene(world.authored, gardenKit.scene, townKit, event => this.callbacks.townAnimalSound?.(event));
      this.scene.add(this.townAnimals.group, this.townScene.group);
    }
    this.life = new VillageLife(root, world.colliders, gardenKit.scene, world.authored);
    this.life.setCompanions(this.companions);
    this.scene.add(this.life.group);
    this.birds = new BirdFlock(dove.scene, this.host, status => {
      this.callbacks.birds?.(status);
      if (status === "happy") this.callbacks.gardenSound?.("coo", [BIRD_CLEARING.x, .6, BIRD_CLEARING.z]);
    }, caretaker => {
      if (caretaker) this.life?.feedBirds();
      this.callbacks.gardenSound?.("crumbs", [BIRD_CLEARING.x, .4, BIRD_CLEARING.z]);
    }, world.authored);
    this.scene.add(this.birds.group);
    this.animalDialogue = new AnimalDialogue(this.host);
    this.animalDialogue.setLanguage(this.language);
    this.puppies = new PuppyPack(puppyKit.scene, puppyKit.animations, world.authored.puppies, world.colliders, world.authored,
      (breed, position, kind) => this.callbacks.puppySound?.(breed, position, kind));
    for (const trick of this.pendingPuppyTricks.values()) this.puppies.sharedTrick(trick);
    this.pendingPuppyTricks.clear();
    this.scene.add(this.puppies.group);
    this.horses = new VillageHorses(world.authored.horses ?? [], event => this.callbacks.horseSound?.(event), event => this.callbacks.townAnimalSound?.(event));
    this.scene.add(this.horses.group);
    this.dialogue = new VillagerDialogue(this.host, this.life, world.colliders, this.clearKeys, {
      companion: id => this.callbacks.companion?.(id), crumbs: id => this.callbacks.crumbs?.(id), visitTea: () => this.callbacks.visitTea?.(),
      talk: id => { if (this.sharedMode) this.requestShared({ kind: "resident", id, action: "talk" }, () => {}); },
    });
    this.dialogue.setMintAvailable(this.gardenState.mint > 0);
    this.dialogue.setLanguage(this.language);
    this.dialogue.setKeybindings(this.keybindings);
    this.dialogue.setEnabled(!this.blocked && !this.place);
    if (this.sharedActors) this.setSharedActors(this.sharedActors, this.sharedSelfId);
    this.resize();
    const cottage = buildFocusCottage(this.scene, this.indoorLight, world.flames);
    this.indoor = cottage.group;
    this.bridgeWindow = cottage.bridgeWindow;
    this.coffeeSteam = cottage.coffeeSteam;
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
  private async loadCottageCat() {
    if (this.cottageCat || this.disposed) return;
    if (this.cottageCatLoading) return this.cottageCatLoading;
    this.cottageCatLoading = loadAnimalRigs(["cat"]).then(() => {
      const model = makeAnimalRig("cat");
      if (this.disposed) { disposeAnimalRig(model); return; }
      this.cottageCat = new CottageCat(model, status => {
        this.callbacks.cottageCat?.(status);
        if (status === "asking" || status === "petting") {
          const position = this.cottageCat?.petTarget(new T.Vector3());
          if (position) this.callbacks.townAnimalSound?.({ species: "cat", position: position.toArray() as [number, number, number], happy: status === "petting" });
        }
      });
      this.indoor!.add(this.cottageCat.root);
      this.cottageCat.enter(this.place === "focus");
      softenShadowEdges(this.cottageCat.root);
    }).catch(() => {
      if (!this.disposed) this.callbacks.sharedNotice?.("The cottage cat couldn't load. Leave and return to try again.");
    }).finally(() => { this.cottageCatLoading = undefined; });
    return this.cottageCatLoading;
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
    // Direct cottage entry can precede the first outdoor frame/shadow allocation.
    if (this.renderer.shadowMap.enabled && !this.sun.shadow.map) this.renderer.shadowMap.needsUpdate = true;
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
    this.animalDialogue?.resize(w, h);
  }
  setBlocked(v: boolean) {
    this.blocked = v;
    this.dialogue?.setEnabled(!v && !this.place && !this.horseRiding.actor);
    if (v) {
      this.releaseMouseLook();
      this.clearKeys();
    }
  }
  setKeybindings(bindings: Keybindings) {
    this.clearKeys();
    this.keybindings = bindings;
    this.dialogue?.setKeybindings(bindings);
  }

  setLanguage(language: "en" | "ja") {
    this.language = language;
    this.dialogue?.setLanguage(language);
    this.birds?.setLanguage(language);
    this.animalDialogue?.setLanguage(language);
    this.world?.setLanguage(language);
    this.garden?.setLanguage(language);
  }
  petCottageCat() {
    if (this.blocked || this.place !== "focus") return false;
    return this.cottageCat?.pet() ?? false;
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
      graphicsVersion: "spatial-batches-v2",
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
      this.renderer.info.reset();
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
      glowSpirit(this.player, night);
      this.life?.residents.forEach(resident => glowSpirit(resident.spirit, night));
      this.remoteVisitors.forEach(remote => glowSpirit(remote.group, night));
      this.spiritGlowApplied = night;
    }
  }
  setGarden(state: GardenState) { this.gardenState = state; this.garden?.sync(state); this.dialogue?.setMintAvailable(state.mint > 0); }
  getPlayerPose() {
    const swing = this.world?.swings.find(value => value.placement.id === this.ridingSwing?.id);
    const pendulum = swing && this.ridingSwing ? swing.pendulums[this.ridingSwing.index] : null;
    return { x: this.player.position.x, y: this.player.position.y, z: this.player.position.z, heading: this.player.rotation.y,
      swing: pendulum && this.ridingSwing ? { ...this.ridingSwing, angle: pendulum.angle,
        velocity: this.blocked || this.place ? 0 : pendulum.velocity } : null,
      bench: this.seatedBench && this.seatedIndex !== null ? { id: this.seatedBench.id, index: this.seatedIndex }
        : this.place && this.activitySeat !== null ? { id: { music: "bench-1", mood: "bench-4", birds: "bird-clearing-bench" }[this.place as "music" | "mood" | "birds"], index: this.activitySeat } : null,
      horse: this.horseRiding.actor?.id ?? null,
      activity: this.place, active: !document.hidden && !this.blocked, holdingPuppy: this.heldPuppy };
  }
  setHorseInput(handler: (input: SharedHorseInput) => void) { this.horseRiding.connect(handler); }
  syncSharedSelf(visitor: SharedVisitor) {
    if (!this.horseRiding.actor || visitor.horse === this.horseRiding.actor.id) return;
    this.clearHorseRide();
    if (!this.place) {
      this.movement?.settle(visitor.x, visitor.z);
      this.player.position.set(visitor.x, visitor.y ?? floorHeight(visitor.x, visitor.z), visitor.z);
    }
  }
  setSharedInteraction(handler: (request: SharedInteraction) => Promise<InteractionResult>) {
    this.sharedMode = true; this.sharedInteraction = handler;
  }
  setSharedConnected(connected: boolean) {
    this.sharedConnected = connected;
    if (!connected) {
      this.forageInventory = { apples: 0, mushrooms: 0 };
      this.clearHorseRide(); this.horses?.reset(); this.townAnimals?.reset(); this.townScene?.applyShared(undefined, Date.now()); this.raceGuide?.applyShared(undefined, "");
      this.heldPuppy = null; this.puppies?.cancelPet(); this.puppyTrickId = null; this.leaveSwing(); this.stand();
    }
  }
  setForageInventory(inventory: ForageInventory) {
    this.forageInventory = { ...inventory };
  }
  private requestShared(request: SharedInteraction, accepted: (result: InteractionResult) => void) {
    if (!this.sharedMode) return false;
    const key = JSON.stringify(request);
    if (this.pendingInteractions.has(key)) return true;
    if (!this.sharedConnected || !this.sharedInteraction) { this.callbacks.sharedNotice?.("Wait for the village to reconnect."); return true; }
    this.pendingInteractions.add(key);
    const selfId = this.sharedSelfId;
    void this.sharedInteraction(request).then(result => {
      if (this.disposed || !this.sharedConnected || selfId !== this.sharedSelfId) return;
      if (result.ok) accepted(result);
      else this.callbacks.sharedNotice?.(result.reason ?? "That interaction is busy. Try again in a moment.");
    }).catch(() => { if (!this.disposed) this.callbacks.sharedNotice?.("The village didn't respond. Try again."); })
      .finally(() => this.pendingInteractions.delete(key));
    return true;
  }
  setSharedActors(world: SharedActors, selfId: string) {
    this.sharedActors = world; this.sharedSelfId = selfId;
    this.sharedTimeOffset = world.time - Date.now();
    this.puppies?.applyShared(world.actors, selfId, world.time);
    this.life?.applyShared(world.actors, selfId, world.time);
    this.horses?.applyShared(world.actors, selfId, world.time, world.town?.hayFeeds);
    this.townAnimals?.applyShared(world.town, world.time);
    this.townScene?.applyShared(world.town, world.time);
    this.raceGuide?.applyShared(world.town, selfId);
    const previousHorse = this.horseRiding.actor;
    if (this.horseRiding.sync(world.actors, selfId)) {
      if (this.horseRiding.actor) {
        this.clearKeys(); this.dialogue?.setEnabled(false);
        this.puppyTrickId = null; this.heldPuppy = null;
        this.near = null; this.nearBench = null; this.nearSwing = null; this.nearPuppy = null; this.nearGarden = null;
        this.callbacks.near(null); this.callbacks.nearBench?.(null); this.callbacks.nearSwing?.(null);
        this.callbacks.nearPuppy?.(null); this.callbacks.nearGarden?.(null);
        this.yaw = this.horseRiding.actor.heading + Math.PI; this.pitch = .22;
      } else if (previousHorse && !this.place) {
        this.movement?.settle(this.player.position.x, this.player.position.z);
        this.dialogue?.setEnabled(!this.blocked);
      }
      const actor = this.horseRiding.actor;
      this.callbacks.ridingHorse?.(actor ? { id: actor.id, name: this.world?.authored.horses?.find(horse => horse.id === actor.id)?.name ?? "Horse", owner: actor.owner } : null);
    }
    this.birds?.applyShared(world.birds, world.time);
    this.garden?.syncShared(world.time, world.epoch, world.pondFeedAt);
    this.life?.syncSharedGift(world.gift, world.time);
    const followers = this.puppies?.sharedFollowers ?? [];
    const following = world.actors.filter(actor => actor.kind === "puppy" && actor.following && actor.owner === selfId).map(actor => actor.id).sort().join("|");
    if (following !== this.lastSharedFollowers) { this.lastSharedFollowers = following; this.callbacks.puppyFollowing?.(followers); }
  }
  setActivitySeat(index: 0 | 1 | undefined, position?: [number, number, number]) {
    this.activitySeat = index ?? null; this.activityPosition = position ?? null;
  }
  showPuppyTrick(trick: SharedPuppyTrick) {
    if (this.puppies) this.puppies.sharedTrick(trick);
    else this.pendingPuppyTricks.set(trick.id, trick);
  }
  setPuppyInteraction(id: string | null) {
    const previous = this.heldPuppy; this.heldPuppy = id;
    this.puppies?.setInteraction(id);
    if (this.sharedMode) {
      if (previous && previous !== id) this.requestShared({ kind: "puppy", id: previous, action: "release" }, () => {});
      if (id && previous !== id) this.requestShared({ kind: "puppy", id, action: "hold" }, () => {});
    }
  }
  swingOccupied(id: string, index: 0 | 1) {
    return [...this.remoteVisitors.values()].some(remote => remote.swing?.id === id && remote.swing.index === index);
  }
  showChatBubble(entry: SharedChatEntry, selfId: string, selfName: string) { this.visitors.showChatBubble(entry, selfId, selfName); }
  removeChatBubbles(messageIds: string[]) { this.visitors.removeChatBubbles(messageIds); }
  private seatPoint(bench: VillageBench, index: 0 | 1) {
    const offset = index === 0 ? -.68 : .68;
    return { x: bench.x + Math.cos(bench.facing) * offset, z: bench.z - Math.sin(bench.facing) * offset };
  }
  private pickBenchSeat(clientX: number, clientY: number) {
    const bench = this.nearBench;
    if (!bench || this.blocked || this.place || this.seatedBench) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    this.benchPointer.set((clientX - rect.left) / rect.width * 2 - 1, 1 - (clientY - rect.top) / rect.height * 2);
    this.benchRaycaster.setFromCamera(this.benchPointer, this.camera);
    this.benchMatrix.makeRotationY(bench.facing).setPosition(bench.x, 0, bench.z).invert();
    const hit = this.benchRaycaster.ray.clone().applyMatrix4(this.benchMatrix).intersectBox(bench.hitBox, this.benchHit);
    if (!hit) return null;
    return { id: bench.id, index: (hit.x < 0 ? 0 : 1) as 0 | 1 };
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
      if (this.sharedMode) {
        if (remote.bench?.id === bench.id) occupants.set(remote.bench.index, [remote.slot]);
        continue;
      }
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
    if (this.sharedMode) return;
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
    if (this.character) tintSpirit(this.character, color, false);
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
      this.camera.position.copy(this.view.goal);
      this.currentLook.copy(this.view.look);
      this.camera.lookAt(this.currentLook);
    }
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
    this.visitors.sync(visitors, this.character, this.world, this.elapsed, this.weatherBlend.night, this.place === "focus", visitor => {
      const seat = this.visitorSeat(visitor.x, visitor.z, visitor.heading);
      return seat ? seat.bench.seatHeight - .62 : floorHeight(visitor.x, visitor.z);
    });
    this.resolveSeatCollision();
  }
  gardenAction(action: GardenAction, source?: { x: number; z: number }, animateSelf = true) {
    if ((action.kind === "feed" || action.kind === "feedBirds") && !source && !this.gardenState.crumbPouch) return false;
    if (action.kind === "feedBirds") {
      if (this.sharedMode) { if (animateSelf) this.birdFeedAt = this.elapsed; return true; }
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
    if (action.kind === "drink" && animateSelf) this.setActivityMoment({ kind: "tea" });
    return true;
  }
  setCompanions(ids: string[]) {
    this.companions = ids; this.life?.setCompanions(ids); this.life?.setActivity(this.place);
  }
  get sittingAtBirdBench() { return !this.blocked && !this.place && this.seatedBench?.birdClearing === true; }
  private puppyPetStance(id: string) {
    const puppy = this.puppies?.puppies.find(puppy => puppy.info.id === id);
    if (!puppy || !this.movement) return;
    const bearing = Math.atan2(puppy.actor.position.x - this.player.position.x, puppy.actor.position.z - this.player.position.z) + Math.PI;
    const beside = .38 * puppy.actor.scale.y + .426 * this.spiritScale, ahead = -(1.14 - .43 * puppy.actor.scale.y);
    return ([-1, 1] as const).find(value => this.movement!.canWalkTo(
      this.player.position.x + Math.sin(bearing) * ahead + Math.cos(bearing) * value * beside,
      this.player.position.z + Math.cos(bearing) * ahead - Math.sin(bearing) * value * beside));
  }
  petPuppy(id: string, accepted = false, sharedSide: -1 | 1 = -1) {
    if (!accepted && this.sharedMode) {
      if (this.blocked || this.place || this.seatedBench || !this.movement?.grounded || this.movement.speed > .18) return false;
      const side = this.puppyPetStance(id);
      if (side === undefined) { this.callbacks.sharedNotice?.("Make a little room to pet your dog."); return false; }
      this.requestShared({ kind: "puppy", id, action: "pet" }, () => this.petPuppy(id, true, side)); return true;
    }
    if (accepted) {
      const puppy = this.puppies?.puppies.find(puppy => puppy.info.id === id);
      if (!puppy) return false;
      this.puppyPetTarget.copy(puppy.actor.position); this.puppyPetSide = sharedSide;
      this.callbacks.puppyPetted?.(puppy.info); return true;
    }
    if (this.blocked || this.place || this.seatedBench || !this.movement?.grounded || this.movement.speed > .18 || !this.puppies?.pet(id, this.player.position)) return false;
    const puppy = this.puppies.puppies.find(value => value.info.id === id)!;
    const side = this.puppyPetStance(id);
    if (side === undefined) { this.puppies.cancelPet(); return false; }
    this.puppyPetSide = side;
    this.puppyPetTarget.copy(puppy.actor.position);
    this.callbacks.puppyPetted?.(puppy.info);
    return true;
  }
  commandPuppy(id: string, command: PuppyCommand) {
    if (this.blocked || this.place || this.seatedBench) return false;
    if (this.sharedMode) {
      this.requestShared({ kind: "puppy", id, action: command }, () => {
        const puppy = this.puppies?.puppies.find(puppy => puppy.info.id === id);
        if (puppy) { this.puppyTrickId = id; this.callbacks.puppyCommanded?.(puppy.info, command); }
      }); return true;
    }
    const puppy = this.puppies?.command(id, command, this.player.position);
    if (!puppy) return false;
    this.puppyTrickId = id;
    this.callbacks.puppyCommanded?.(puppy, command);
    return true;
  }
  togglePuppyFollow(id: string) {
    if (this.blocked || this.place || this.seatedBench || !this.puppies) return false;
    if (this.sharedMode) {
      this.requestShared({ kind: "puppy", id, action: this.puppies.followers.some(puppy => puppy.id === id) ? "home" : "walk" }, () => {}); return true;
    }
    if (this.puppies.followers.some(puppy => puppy.id === id)) {
      this.puppies.dismiss(id);
    } else if (!this.puppies.invite(id, this.player.position, this.player.rotation.y)) return false;
    this.callbacks.puppyFollowing?.(this.puppies.followers);
    return true;
  }
  sendPuppyHome() {
    if (this.sharedMode) {
      for (const puppy of this.puppies?.followers ?? []) this.requestShared({ kind: "puppy", id: puppy.id, action: "home" }, () => {});
      return true;
    }
    if (this.blocked || this.place || !this.puppies?.dismiss().length) return false;
    this.callbacks.puppyFollowing?.([]);
    return true;
  }
  setActivityMoment(moment:ActivityMoment) { this.activities?.setMoment(moment); this.life?.setMoment(moment); }
  get currentPlace() { return this.place; }
  get mapScenery() { return this.world?.mapScenery; }
  getMapActors(): MapActor[] {
    return (this.sharedActors?.actors ?? []).flatMap<MapActor>(actor => {
      if (actor.kind === "horse" || actor.activity === "focus") return [];
      if (actor.kind === "puppy") {
        const puppy = this.puppies?.puppies.find(puppy => puppy.info.id === actor.id);
        return [{ id: actor.id, kind: "puppy" as const, name: puppy?.info.name ?? "Puppy", color: "#d1b995",
          x: puppy?.actor.position.x ?? actor.x, z: puppy?.actor.position.z ?? actor.z }];
      }
      const index = VILLAGERS.findIndex(profile => profile.id === actor.id), profile = VILLAGERS[index];
      const resident = this.life?.residents[index];
      return [{ id: actor.id, kind: "resident" as const, name: profile?.name[this.language] ?? actor.id, color: profile?.color ?? "#c0ddb0",
        x: resident?.root.position.x ?? actor.x, z: resident?.root.position.z ?? actor.z }];
    });
  }
  townAction(action: TownAction) {
    if (this.blocked || this.place || this.seatedBench || this.ridingSwing) return false;
    return this.requestShared(action, () => {});
  }
  mountHorse(id: string) {
    if (this.blocked || this.place || this.seatedBench || this.ridingSwing || this.horseRiding.actor || this.horseMountPending || !this.movement?.grounded) return false;
    if (!this.sharedConnected || !this.sharedInteraction) { this.callbacks.sharedNotice?.("Wait for the village to reconnect."); return false; }
    this.horseMountPending = true; this.horseMountCancelled = false;
    const selfId = this.sharedSelfId;
    void this.sharedInteraction({ kind: "horse", id, action: "mount" }).then(result => {
      if (!result.ok) { this.callbacks.sharedNotice?.(result.reason ?? "This horse is already being ridden."); return; }
      if (this.disposed || this.horseMountCancelled || this.blocked || this.place || selfId !== this.sharedSelfId)
        void this.sharedInteraction?.({ kind: "horse", id, action: "dismount" });
    }).catch(() => this.callbacks.sharedNotice?.("The village didn't respond. Try again."))
      .finally(() => { this.horseMountPending = false; });
    return true;
  }
  leaveHorse() {
    this.horseMountCancelled = true;
    const actor = this.horseRiding.actor;
    if (!actor) return false;
    this.clearKeys();
    this.requestShared({ kind: "horse", id: actor.id, action: "dismount" }, result => {
      this.clearHorseRide();
      if (result.position && !this.place) {
        this.movement?.settle(result.position[0], result.position[2]);
        this.player.position.fromArray(result.position);
      }
    });
    return true;
  }
  private clearHorseRide() {
    if (!this.horseRiding.actor) return;
    this.horseRiding.clear(); this.clearKeys();
    this.callbacks.ridingHorse?.(null);
    if (!this.place) this.movement?.settle(this.player.position.x, this.player.position.z);
    this.dialogue?.setEnabled(!this.blocked && !this.place);
  }
  horseKey(key: string, down: boolean) {
    if (!this.horseRiding.actor || this.blocked || this.place) return;
    if (down) this.keys.add(key); else this.keys.delete(key);
  }
  setPlace(id: PlaceId | null) {
    if (id) { this.horseMountCancelled = true; this.clearHorseRide(); }
    if (id && this.ridingSwing) this.leaveSwing(false);
    if (id !== "mood") this.dialogue?.clearTeaSpeech();
    if (id && this.seatedBench) {
      this.seatedBench = null;
      this.seatedIndex = null;
      this.callbacks.seat?.(null);
    }
    this.dialogue?.setEnabled(!id && !this.blocked);
    const previousPlace = this.place;
    this.activityOrbit.yaw = this.activityOrbit.pitch = 0;
    this.teaPanAt = this.elapsed; this.teaPan = 0; this.teaPanHeld = false;
    if (id && !previousPlace) this.walkingHeading=this.player.rotation.y;
    this.activities?.enter(id);
    if (id === "mood") this.activities?.setMintTea(this.gardenState.mintTea > 0);
    this.renderer.shadowMap.needsUpdate = id !== "focus";
    this.place = id;
    if (!id) this.activityPosition = null;
    if (this.world) this.world.group.visible = id !== "focus";
    if (this.life) this.life.group.visible = true;
    if (this.birds) this.birds.group.visible = id !== "focus";
    if (this.puppies) this.puppies.group.visible = id !== "focus";
    if (this.horses) this.horses.group.visible = id !== "focus";
    if (this.townAnimals) this.townAnimals.group.visible = id !== "focus";
    if (this.townScene) this.townScene.group.visible = id !== "focus";
    this.remoteVisitors.forEach(remote => { remote.group.visible = id !== "focus" && remote.activity !== "focus"; });
    const arrival = this.movement?.position;
    this.life?.setActivity(id, arrival ? [arrival.x, arrival.z] : undefined);
    if (id) {
      this.updateActivityCamera(id);
      this.camera.position.copy(this.view.goal);
      this.currentLook.copy(this.view.look);
    }
    this.clearKeys();
    this.movement?.settle();
    if (!id && previousPlace !== null) {
      // Authored return angles keep residents and nearby walls out of the foreground.
      if (this.movement) this.player.position.copy(this.movement.position);
      this.player.rotation.y=this.walkingHeading;
      this.yaw = previousPlace === "mood" ? -Math.PI + .4 : 0;
      this.updateWalkingCamera();
      this.camera.position.copy(this.view.goal);
      this.currentLook.copy(this.view.look);
      this.camera.lookAt(this.currentLook);
    }
    this.player.visible = true;
    this.resize();
    if (this.indoor) this.indoor.visible = id === "focus";
    this.cottageCat?.enter(id === "focus");
    if (id === "focus") void this.loadCottageCat();
    this.indoorLight.intensity = id === "focus" ? 10 : 0;
    if (id === "focus") this.bridgeWindowTime = -1000;
    this.world?.flames.forEach((f) => {
      if (f.userData.interior) f.visible = id === "focus";
    });
    if (!id) {
      this.callbacks.near(this.near);
    }
  }
  travelToMapDestination(id: string, arrived: () => void) {
    if (!this.world || !this.movement) return;
    this.requestShared({ kind: "mapTravel", id }, result => {
      if (!result.position) return;
      this.horseMountCancelled = true;
      this.clearHorseRide();
      if (this.ridingSwing) this.leaveSwing(false);
      this.seatedBench = null; this.seatedIndex = null; this.callbacks.seat?.(null);
      this.setPlace(null);
      this.player.position.fromArray(result.position);
      this.movement?.settle(result.position[0], result.position[2]);
      this.near = null; this.nearBench = null; this.nearSwing = null; this.nearGarden = null; this.nearPuppy = null;
      this.callbacks.near(null); this.callbacks.nearBench?.(null); this.callbacks.nearSwing?.(null);
      this.callbacks.nearGarden?.(null); this.callbacks.nearPuppy?.(null);
      this.clearKeys(); this.updateWalkingCamera(); this.camera.position.copy(this.view.goal);
      this.currentLook.copy(this.view.look); this.camera.lookAt(this.currentLook); this.reportMovement(true);
      arrived();
    });
  }
  travel(id: PlaceId) {
    if (!this.world || !activityInLayout(this.world.authored, id)) return;
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
    if (this.blocked || this.place || !this.movement) return false;
    if (this.horseRiding.actor) return this.leaveHorse();
    if (this.ridingSwing) this.leaveSwing();
    const nearby = this.movement.recoverySpot();
    const { x, z } = nearby ?? { x: .3, z: 20 };
    if (!this.movement.clear(x, z)) {
      this.callbacks.recovered?.("unavailable");
      return false;
    }
    this.releaseMouseLook();
    this.clearKeys();
    this.seatedBench = null;
    this.seatedIndex = null;
    this.callbacks.seat?.(null);
    this.movement.settle(x, z);
    this.player.position.set(x, floorHeight(x, z), z);
    this.player.rotation.y = this.walkingHeading;
    this.near = null;
    this.nearBench = null;
    this.nearSwing = null;
    this.callbacks.nearSwing?.(null);
    this.nearGarden = null;
    this.nearPuppy = null;
    this.callbacks.near(null);
    this.callbacks.nearBench?.(null);
    this.callbacks.nearGarden?.(null);
    this.callbacks.nearPuppy?.(null);
    this.updateWalkingCamera();
    this.camera.position.copy(this.view.goal);
    this.currentLook.copy(this.view.look);
    this.camera.lookAt(this.currentLook);
    this.reportMovement(true);
    this.callbacks.recovered?.(nearby ? "nearby" : "entrance");
    return true;
  }
  sit(id: string, selectedSide?: 0 | 1, accepted = false) {
    const bench = this.world?.benches.find(value => value.id === id);
    if (!bench || this.blocked || this.place || this.seatedBench || this.ridingSwing || this.nearBench?.id !== id) return;
    if (!accepted && this.requestShared({ kind: "bench", id, ...(selectedSide === undefined ? {} : { index: selectedSide }) },
      result => this.sit(id, result.index, true))) return;
    const occupied = this.seatOccupants(bench);
    const preferred = selectedSide !== undefined ? [selectedSide, selectedSide === 0 ? 1 : 0] as const
      : this.sharedSlot !== null && this.sharedSlot % 2 === 1 ? [1, 0] as const : [0, 1] as const;
    const index = accepted ? selectedSide : preferred.find(value => !occupied.has(value));
    if (index === undefined) { this.callbacks.sharedNotice?.("That bench is occupied. Try another bench."); return; }
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
    if (this.sharedMode && this.sharedConnected) this.requestShared({ kind: "leave" }, () => {});
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
      if (key === " " && !this.seatedBench && !this.ridingSwing) this.movement?.jump();
    } else this.keys.delete(key);
  }
  toggleRun() { this.running = !this.running; this.reportMovement(true); }
  rideSwing(id: string, index: 0 | 1, accepted = false) {
    const swing = this.world?.swings.find(value => value.placement.id === id);
    if (!swing || this.swingOccupied(id, index) || this.blocked || this.place || this.seatedBench || this.ridingSwing || !this.movement?.grounded) return false;
    swing.seatPoint(index, this.temp);
    if (this.temp.distanceTo(this.player.position) > 2.9) return false;
    if (!accepted && this.requestShared({ kind: "swing", id, index }, () => this.rideSwing(id, index, true))) return true;
    this.puppies?.cancelPet(); this.puppyTrickId = null;
    this.clearKeys();
    this.swingCamera = { yaw: this.yaw, pitch: this.pitch };
    this.ridingSwing = { id, index }; this.nearSwing = null;
    this.yaw = swing.placement.yaw + 1.1; this.pitch = .45;
    this.dialogue?.setEnabled(false);
    this.callbacks.nearSwing?.(null); this.callbacks.ridingSwing?.(this.ridingSwing);
    return true;
  }
  swingKey(key: "w" | "s" | " ", down: boolean) {
    if (down && (!this.ridingSwing || this.blocked || this.place)) return;
    this.walkKey(key, down);
  }
  pushSwing(direction: -1 | 1) {
    if (!this.ridingSwing || this.blocked || this.place) return;
    this.swingPulse = { direction, until: this.elapsed + .3 };
  }
  brakeSwing() {
    if (this.ridingSwing && !this.blocked && !this.place) this.swingBrakeUntil = this.elapsed + .5;
  }
  leaveSwing(releaseShared = true) {
    const rider = this.ridingSwing, swing = this.world?.swings.find(value => value.placement.id === rider?.id);
    if (!rider || !swing || !this.movement) return false;
    const exits: { x: number; z: number }[] = [];
    for (const distance of [3.3, -3.3, 4, -4]) {
      swing.root.localToWorld(this.temp.set(rider.index === 0 ? -.98 : .98, 0, distance));
      exits.push({ x: this.temp.x, z: this.temp.z });
    }
    exits.push({ x: this.movement.position.x, z: this.movement.position.z }, { x: .3, z: 20 });
    const exit = exits.find(point => this.movement!.clear(point.x, point.z));
    if (!exit) return false;
    if (releaseShared && this.sharedMode && this.sharedConnected) this.requestShared({ kind: "leave" }, () => {});
    this.ridingSwing = null; this.clearKeys();
    this.player.rotation.set(0, swing.placement.yaw, 0);
    this.yaw = this.swingCamera.yaw; this.pitch = this.swingCamera.pitch;
    this.movement.settle(exit.x, exit.z);
    this.player.position.copy(this.movement.position);
    this.dialogue?.setEnabled(!this.blocked && !this.place);
    this.callbacks.ridingSwing?.(null);
    this.updateWalkingCamera();
    return true;
  }
  private updateSwingCamera() {
    const swing = this.world?.swings.find(value => value.placement.id === this.ridingSwing?.id);
    if (swing) this.view.swing(swing, this.yaw, this.pitch, this.compactView);
  }
  private updateActivityCamera(place: PlaceId) {
    if (place === "mood" && !this.teaPanHeld)
      this.teaPan = this.reducedMotion ? 1 : T.MathUtils.smoothstep(this.elapsed - this.teaPanAt, 0, 4);
    this.view.activity(place, { teaPan: this.teaPan, companionCount: this.companions.length,
      compactView: this.compactView, activityOrbit: this.activityOrbit, colliders: this.world?.colliders ?? [] });
  }
  private updateWalkingCamera() {
    this.view.walking({ player: this.player, yaw: this.yaw, pitch: this.pitch, distance: this.horseRiding.actor ? Math.max(6.5, this.distance) : this.distance,
      seated: !!this.seatedBench, puppies: this.horseRiding.actor ? undefined : this.puppies, colliders: this.world?.colliders ?? [] });
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
    if (!this.blocked) this.cottageCat?.update(dt, this.elapsed, this.reducedMotion);
    const movement = this.movement!;
    const horse = this.horseRiding.actor;
    this.horseRiding.update(this.keys, !this.blocked && !this.place && this.sharedConnected, this.elapsed);
    this.horses?.update(dt, this.elapsed, this.reducedMotion, this.player.position, this.place !== "focus" && !this.blocked);
    this.townAnimals?.update(dt, this.reducedMotion, this.camera.quaternion);
    this.townScene?.update(this.reducedMotion, this.camera.quaternion);
    this.direction.set(0, 0, 0);
    if (!this.blocked && !this.place && !this.seatedBench && !this.ridingSwing && !horse) {
      const forward = Number(this.keys.has("w") || this.keys.has("arrowup")) - Number(this.keys.has("s") || this.keys.has("arrowdown"));
      const side = Number(this.keys.has("d") || this.keys.has("arrowright")) - Number(this.keys.has("a") || this.keys.has("arrowleft"));
      this.direction.set(side * Math.cos(this.yaw) - forward * Math.sin(this.yaw), 0,
        -forward * Math.cos(this.yaw) - side * Math.sin(this.yaw));
      if (this.direction.lengthSq() > 0) this.direction.normalize();
    }
    movement.update(dt, { x: this.direction.x, z: this.direction.z, run: this.running,
      sprint: this.keys.has("shift"), blocked: this.blocked || this.place !== null || !!this.seatedBench || !!this.ridingSwing || !!horse });
    const swingInput = Number(this.keys.has("w") || this.keys.has("arrowup")) - Number(this.keys.has("s") || this.keys.has("arrowdown"));
    const swingDirection = swingInput || (this.elapsed < this.swingPulse.until ? this.swingPulse.direction : 0);
    this.world.swings.forEach(swing => swing.update(dt, this.ridingSwing, swingDirection, this.keys.has(" ") || this.elapsed < this.swingBrakeUntil, this.blocked || !!this.place));
    this.player.position.set(movement.position.x, movement.position.y, movement.position.z);
    if (horse && this.horses?.seatPoint(horse.id, this.player.position)) {
      this.player.position.y -= .62;
      this.player.rotation.set(0, this.horses.heading(horse.id), 0);
    }
    if (this.ridingSwing) {
      const swing = this.world.swings.find(value => value.placement.id === this.ridingSwing!.id)!;
      swing.seatPoint(this.ridingSwing.index, this.player.position);
      this.player.position.y -= .62;
      this.player.rotation.set(0, swing.placement.yaw, 0);
    }
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
    if (!this.blocked && !this.place && !this.seatedBench && !this.ridingSwing && !horse) {
      const nearbyHorse = this.horses?.nearest(this.player.position) ?? null;
      if (nearbyHorse?.id !== this.nearHorse?.id || nearbyHorse?.owner !== this.nearHorse?.owner || nearbyHorse?.mode !== this.nearHorse?.mode) {
        this.nearHorse = nearbyHorse; this.callbacks.nearHorse?.(nearbyHorse);
      }
      const swing = this.world.swings.map(value => value.nearest(this.player.position,
        index => this.swingOccupied(value.placement.id, index))).find(value => value !== null) ?? null;
      if (swing?.id !== this.nearSwing?.id || swing?.index !== this.nearSwing?.index) { this.nearSwing = swing; this.callbacks.nearSwing?.(swing); }
      let near: PlaceId | null = null,
        dist = 4;
      PLACES.forEach((p) => {
        if (p.id === "garden" || !activityInLayout(this.world!.authored, p.id)) return;
        // Keep the arrival approach reachable while covering the tea seating itself.
        const d = p.id === "birds" ? Math.hypot(p.look[0] - this.player.position.x, p.look[2] - this.player.position.z) : Math.min(
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
      const puppy = this.puppies?.nearest(this.player.position) ?? null;
      if (puppy?.id !== this.nearPuppy?.id || puppy?.owner !== this.nearPuppy?.owner) { this.nearPuppy = puppy; this.callbacks.nearPuppy?.(puppy); }
    }
    if (now - this.statusTime > 100) {
      const context = !this.blocked && !this.place && !this.seatedBench && !this.ridingSwing && this.sharedConnected
        ? this.townInteractions?.context(this.sharedActors?.town, this.sharedSelfId, this.player.position.x, this.player.position.z,
          horse?.id ?? null, this.nearHorse?.id ?? null, this.gardenState.crumbPouch, Date.now() + this.sharedTimeOffset, this.forageInventory) ?? null : null;
      const signature = JSON.stringify(context);
      if (signature !== this.townContextSignature) {
        this.townContext = context; this.townContextSignature = signature; this.callbacks.townContext?.(context);
      }
      const progress = this.sharedConnected && !this.place && !this.blocked
        ? townActivityHUD(this.sharedActors?.town, this.sharedSelfId, context, Date.now() + this.sharedTimeOffset) : null;
      const progressSignature = JSON.stringify(progress);
      if (progressSignature !== this.activityHUDSignature) {
        this.activityHUDSignature = progressSignature; this.callbacks.activityHUD?.(progress);
      }
      this.reportMovement(); this.statusTime = now;
    }
    this.companionHands.reset();
    if (this.character) {
      const bob = this.reducedMotion || this.blocked || this.seatedBench || this.ridingSwing || horse ? 0 : Math.sin(this.elapsed*2.8)*.065;
      this.character.position.x = 0;
      this.character.position.y = .62 + bob;
      this.character.position.z = 0;
      this.character.rotation.y = 0;
      this.character.rotation.x = T.MathUtils.lerp(this.character.rotation.x, this.reducedMotion ? 0 : horse ? -.05 - Math.abs(horse.speed) * .008 : this.ridingSwing ? -.1 + swingDirection * .1 : this.seatedBench ? -.08 : movement.speed*.022, 1-Math.exp(-dt*8));
      this.character.rotation.z = this.reducedMotion || this.blocked || this.ridingSwing || horse ? 0 : Math.sin(this.elapsed*1.7)*.035;
      const squash = this.reducedMotion ? 0 : movement.landing>0 ? -.1 : movement.takeoff>0 ? .09 : 0;
      const sitting = this.seatedBench || this.ridingSwing || horse;
      this.character.scale.set(this.spiritScale*(sitting ? 1.05 : 1-squash*.4),this.spiritScale*(sitting ? .86 : 1+squash),this.spiritScale*(sitting ? 1.05 : 1-squash*.4));
      this.spiritFins.forEach(fin => relaxBlobArm(fin, this.elapsed, moving, this.reducedMotion || this.blocked));
    }
    if (this.character) this.townAnimals?.posePetting(this.sharedSelfId, this.player, this.character, this.spiritFins, dt, this.reducedMotion,
      !this.blocked && !this.place && !this.seatedBench && !this.ridingSwing && !horse && !moving);
    this.activities?.update(this.elapsed,this.place,this.reducedMotion,this.player,this.character,this.spiritScale);
    if (this.sharedMode && this.place && this.activityPosition) this.player.position.fromArray(this.activityPosition);
    if (this.sharedMode && this.place && this.activitySeat !== null) {
      const benchId = { music: "bench-1", mood: "bench-4", birds: "bird-clearing-bench" }[this.place as "music" | "mood" | "birds"];
      const bench = this.world.benches.find(bench => bench.id === benchId);
      if (bench) { const point = this.seatPoint(bench, this.activitySeat); this.player.position.set(point.x, bench.seatHeight - .62, point.z); }
    }
    const scatterAge = this.elapsed - this.birdFeedAt;
    if (this.character && scatterAge < 1.6 && !this.reducedMotion) {
      this.character.rotation.x = Math.sin(scatterAge / 1.6 * Math.PI) * .16;
      this.spiritFins.forEach((fin, i) => { fin.rotation.z = Math.sin(scatterAge * 5 + i) * .4; });
    }
    if (!this.sharedMode && (movement.speed > .18 || !movement.grounded || this.blocked || this.place || this.ridingSwing)) this.puppies?.cancelPet();
    const pettingDog = this.puppies?.pettingPuppy;
    if (pettingDog) {
      this.puppyPetTarget.copy(pettingDog.actor.position);
      const angle = Math.atan2(pettingDog.actor.position.x - this.player.position.x, pettingDog.actor.position.z - this.player.position.z) + Math.PI;
      const turn = T.MathUtils.euclideanModulo(angle - this.player.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
      this.player.rotation.y += turn * (1 - Math.exp(-dt * 8));
    }
    if (this.place) {
      this.updateActivityCamera(this.place);
    } else if (this.ridingSwing) {
      this.updateSwingCamera();
    } else {
      this.updateWalkingCamera();
      const townFrame = this.townAnimals?.interactionPosition(this.sharedSelfId, this.player.position, this.temp);
      if (!moving && !horse && !this.blocked && !this.seatedBench && townFrame
        && this.temp.distanceTo(this.player.position) < 4) {
        this.view.animal(townFrame, this.player.position, this.temp, this.world.colliders, this.world.authored.items);
      }
      const performingPuppy = this.puppies?.puppies.find(puppy => puppy.info.id === this.puppyTrickId && puppy.command);
      const watchingTrick = !!performingPuppy && !this.blocked && !this.reducedMotion && !this.seatedBench;
      const watchingPet = !!pettingDog?.petting && !this.blocked && !this.reducedMotion && !this.seatedBench;
      if ((watchingPet || watchingTrick) && movement.speed < .12) {
        const target = watchingTrick ? performingPuppy!.actor.position : this.puppyPetTarget;
        const dx = target.x - this.player.position.x, dz = target.z - this.player.position.z;
        const length = Math.hypot(dx, dz) || 1, directionX = dx / length, directionZ = dz / length;
        const sideX = -directionZ, sideZ = directionX;
        const middleX = this.player.position.x + dx * .5, middleZ = this.player.position.z + dz * .5;
        // Show the petting hand on the near side and keep tricks clear of the controls.
        const side = watchingPet ? this.puppyPetSide : -1;
        const portrait = this.camera.aspect < .85;
        const distance = watchingTrick ? (portrait ? 8.5 : 3.8) : (portrait ? 4.8 : 3.15);
        const offset = distance * Math.tan(T.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect * .5;
        const frameX = watchingTrick ? target.x - directionX * offset : middleX + Math.cos(this.player.rotation.y) * this.puppyPetSide * .3;
        const frameZ = watchingTrick ? target.z - directionZ * offset : middleZ - Math.sin(this.player.rotation.y) * this.puppyPetSide * .3;
        const back = watchingTrick ? 0 : distance * .94;
        const lateral = watchingTrick ? distance : distance * .35;
        this.view.look.set(frameX, this.player.position.y + .86, frameZ);
        this.view.goal.set(frameX + sideX * side * lateral - directionX * back,
          this.player.position.y + 2.2, frameZ + sideZ * side * lateral - directionZ * back);
      }
    }
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
    const cameraResponse = !this.place && !this.seatedBench && !this.ridingSwing
      && (this.puppies?.followers.length ?? 0) > 1 && movement.speed > .12 ? 14 : 7;
    const blend = this.reducedMotion ? 1 : 1 - Math.exp(-dt * cameraResponse);
    this.camera.position.lerp(this.view.goal, blend);
    if (!this.place) this.camera.position.y = Math.max(this.camera.position.y, floorHeight(this.camera.position.x, this.camera.position.z) + .3);
    this.currentLook.lerp(this.view.look, blend);
    this.camera.lookAt(this.currentLook);
    const t = this.reducedMotion ? 0 : this.elapsed;
    this.updateLighting(dt);
    this.atmosphere.update(t, this.camera.position);
    if (!this.sharedMode || this.sharedActors) {
      this.life?.update(dt, this.elapsed, this.player.position, this.reducedMotion, !this.blocked && !this.place && !this.ridingSwing && !horse, this.camera.quaternion, this.player.rotation.y);
      this.puppies?.update(dt, this.elapsed, this.player.position, this.reducedMotion, !this.blocked && !this.place && !horse,
        this.camera.quaternion, this.player.rotation.y);
    }
    if (this.life) this.companionHands.update(dt, this.player, this.spiritFins, this.life.residents.filter(r => r.following),
      !this.place && !this.blocked && !this.seatedBench && !horse && !this.puppies?.pettingPuppy && movement.grounded && scatterAge >= 1.6 && !this.life.companionWalk.singleFile);
    const contact = this.puppies?.petContact(this.player.rotation.y, this.puppyPetSide);
    const dog = this.puppies?.pettingPuppy;
    if (contact && dog?.petting && this.character) {
      const hand = this.spiritFins.find(fin => fin.name === (this.puppyPetSide < 0 ? "SpiritFinR" : "SpiritFinL"));
      if (hand) {
        const amount = this.reducedMotion ? 1 : T.MathUtils.smoothstep(dog.petAge, 0, .65) * (1 - T.MathUtils.smoothstep(dog.petAge, 2.35, 3));
        const stroke = this.reducedMotion ? 0 : Math.sin(dog.petAge * 7) * .025;
        this.character.rotation.set(amount * .14, 0, 0);
        hand.rotation.z = -this.puppyPetSide * amount * (.12 + stroke * 3);
        this.player.updateWorldMatrix(true, false);
        const target = this.player.worldToLocal(contact);
        const offset = hand.position.clone().multiply(this.character.scale).applyQuaternion(this.character.quaternion);
        const lowered = target.sub(offset);
        // Bring the whole blob beside the dog's cheek, keeping the original tiny arms.
        this.character.position.lerp(lowered, amount);
      }
    }
    if (this.cottageCat?.petting && this.character && !this.blocked) {
      this.player.updateWorldMatrix(true, true);
      this.cottageCat.root.updateWorldMatrix(true, true);
      const hand = this.spiritFins.find(fin => fin.name === "SpiritFinL");
      if (hand?.parent) {
        const age = this.cottageCat.petAge;
        const amount = this.reducedMotion ? 1 : T.MathUtils.smoothstep(age, 0, .6) * (1 - T.MathUtils.smoothstep(age, 2.6, 3.2));
        this.cottageCat.petTarget(this.catPetTarget).add(this.temp.set(.06, .08 + (this.reducedMotion ? 0 : Math.sin(age * 7) * .025), .03));
        const target = this.player.worldToLocal(this.catPetTarget);
        const offset = hand.position.clone().multiply(this.character.scale).applyQuaternion(this.character.quaternion);
        this.character.position.lerp(target.sub(offset), amount);
        hand.rotation.z += amount * .16;
      }
    }
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
      if (!this.place && !this.blocked) this.callbacks.animalNearby?.([
        ...(this.townAnimals?.soundSources ?? []), ...(this.townScene?.soundSources ?? []),
        ...(this.horses?.soundSources ?? []), ...(this.puppies?.soundSources ?? []), ...(this.garden?.soundSources ?? []),
        { id: "bird-clearing", species: "dove", position: [BIRD_CLEARING.x, .6, BIRD_CLEARING.z] },
      ], moving && !this.seatedBench && !this.ridingSwing);
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
    // A stale shadow can fall onto the moving blob's back between battery refreshes.
    // Keep movement in sync with rendering; idle battery scenes retain the 30 Hz cap.
    const horsesMoving = this.sharedActors?.actors.some(actor => actor.kind === "horse" && actor.speed > .05);
    const shadowInterval = this.graphicsTier === "detailed" || moving || horsesMoving || !movement.grounded ? 0 : 32;
    if (this.place !== "focus" && this.renderer.shadowMap.enabled && now - this.shadowTime > shadowInterval && (!this.reducedMotion || moving || horsesMoving || !movement.grounded)) {
      const texel = 48 / this.sun.shadow.mapSize.x;
      const x = Math.round(this.player.position.x / texel) * texel, z = Math.round(this.player.position.z / texel) * texel;
      this.sun.position.set(x + 35, 28, z - 48);
      this.sun.target.position.set(x, 0, z);
      this.sun.target.updateMatrixWorld();
      this.renderer.shadowMap.needsUpdate = true; this.shadowTime = now;
    }
    let otherBlobNearby = this.life?.otherBlobAtBirdClearing ?? false;
    for (const remote of this.remoteVisitors.values()) {
      if (Math.hypot(remote.target.x - BIRD_CLEARING.x, remote.target.z - BIRD_CLEARING.z) <= BIRD_CLEARING.feedingPerimeter) {
        otherBlobNearby = true; break;
      }
    }
    this.birds?.update(dt, this.elapsed, this.reducedMotion, this.camera, this.player.position,
      this.life?.caretakerPresent ?? false, this.place !== "focus" && !this.blocked, otherBlobNearby);
    this.visitors.update(dt, this.elapsed, this.reducedMotion, this.world.swings);
    for (const [id, remote] of this.remoteVisitors) {
      this.townAnimals?.posePetting(id, remote.group, remote.spirit, remote.fins, dt, this.reducedMotion,
        remote.group.visible && !remote.activity && !remote.bench && !remote.swing && remote.group.position.distanceTo(remote.target) < .1);
    }
    for (const rider of this.horses?.riders ?? []) {
      const remote = this.remoteVisitors.get(rider.owner);
      if (remote && this.horses?.seatPoint(rider.id, remote.group.position)) {
        remote.group.position.y -= .62;
        remote.group.rotation.y = this.horses.heading(rider.id);
      }
    }
    this.updateSpiritLights();
    const renderStart = performance.now();
    this.renderer.info.reset();
    this.renderBridgeWindow(now, t);
    if (this.place === "focus") this.sun.intensity = 0;
    this.vegetationDetail?.update(this.camera);
    this.renderer.render(this.scene, this.camera);
    if (now - this.qualityChangedAt > 4000)
      this.longestRenderSubmitMs = Math.max(this.longestRenderSubmitMs, performance.now() - renderStart);
    this.visitors.projectLabels(this.camera, this.player.position, this.place === "focus");
    this.dialogue?.update(dt, this.camera, this.player.position, this.weather);
    this.animalDialogueCues.length = 0;
    if (this.place === "focus") this.animalDialogueCues.push(...this.cottageCat?.dialogueCues ?? []);
    else for (const animals of [this.townAnimals, this.townScene, this.garden, this.puppies, this.horses])
      this.animalDialogueCues.push(...animals?.dialogueCues ?? []);
    this.animalDialogue?.update(this.animalDialogueCues, this.camera, this.place === "focus" ? this.camera.position : this.player.position, dt, this.reducedMotion, !this.blocked);
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
    this.visitors.dispose();
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
    this.animalDialogue?.dispose();
    this.puppies?.dispose();
    this.horseRiding.clear(); this.horses?.dispose();
    this.townAnimals?.dispose(); this.townScene?.dispose(); this.raceGuide?.dispose();
    this.garden?.dispose();
    this.cottageCat?.dispose();
    this.world?.group.removeFromParent();
    this.vegetationDetail?.dispose();
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

import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { createAtmosphere } from "../../features/village/atmosphere";
import { StudioCollision } from "./spatial";
import { LayoutScene, readTransform, type Asset, type Layout, type LayoutItem } from "./model";

export class StudioView {
  readonly renderer = new T.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  readonly scene = new T.Scene();
  readonly perspective = new T.PerspectiveCamera(42, 1, .1, 1400);
  readonly orthographic = new T.OrthographicCamera(-50, 50, 50, -50, .1, 1400);
  camera: T.PerspectiveCamera | T.OrthographicCamera = this.perspective;
  readonly orbit: OrbitControls;
  readonly transform: TransformControls;
  readonly model = new LayoutScene();
  readonly collision = new StudioCollision(this.model);
  avoidOverlaps = true;
  private cameraAnchor = new T.Vector3();
  private atmosphere = createAtmosphere();
  private sun = new T.DirectionalLight("#ffe8c1", 3.4);
  private fill = new T.HemisphereLight("#d1e6f5", "#8c9361", 1.45);
  private grid = new T.GridHelper(300, 300, "#708775", "#899a71");
  private outline = new T.Box3Helper(new T.Box3(), new T.Color("#f4e3a2"));
  private pivot = new T.Object3D();
  private initialPivot = new T.Matrix4();
  private initialMatrices = new Map<string, T.Matrix4>();
  private ray = new T.Raycaster();
  private pointer = new T.Vector2();
  private dragStart = new T.Vector2();
  private moved = false;
  private gizmoGesture = false;
  private marquee = document.createElement("div");
  private marqueePointer: number | null = null;
  private navigationKeys = new Set<string>();
  private selected: string[] = [];
  private tool = "select";
  private layout?: Layout;
  private ghost?: T.Object3D;
  private ghostMaterials: T.Material[] = [];
  private placement?: string;
  private ghostYaw = 0;
  private drawing = false;
  private pathPoints: [number, number][] = [];
  private straightPath = false;
  private pathGuide = new T.Line(new T.BufferGeometry(), new T.LineBasicMaterial({ color: "#f9ebac", depthTest: false }));
  private pathDots = new T.Group();
  private ground = new T.Vector3();
  private frame = 0;
  private lastFrame = 0;
  private preview = false;
  snap = .5;
  private reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  private resizeObserver: ResizeObserver;

  constructor(private host: HTMLElement, private callbacks: {
    select: (id: string | null, additive: boolean) => void;
    selectArea: (ids: string[]) => void;
    begin: () => void;
    transform: (items: { id: string; transform: ReturnType<typeof readTransform> }[]) => void;
    commit: () => void;
    place: (asset: string, position: [number, number, number], yaw: number, repeat: boolean) => void;
    path: (points: [number, number][]) => void;
    status: (message: string) => void;
    coordinates: (position: T.Vector3) => void;
    stats: (draws: number, triangles: number) => void;
  }) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = T.SRGBColorSpace; this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false; this.renderer.shadowMap.needsUpdate = true;
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute("aria-label", "Village layout. WASD to move; Shift to move faster; Shift-drag to select an area; drag to orbit; right-drag to pan; scroll to zoom. Use the Scene list for keyboard selection.");
    host.prepend(this.renderer.domElement);
    this.marquee.className = "selection-marquee"; this.marquee.hidden = true; this.marquee.setAttribute("aria-hidden", "true"); host.append(this.marquee);
    this.scene.fog = new T.FogExp2("#c5d7b4", .0025);
    this.sun.position.set(40, 60, 25); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048); Object.assign(this.sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 220 });
    this.sun.shadow.bias = -.0004; this.sun.shadow.normalBias = .07;
    this.scene.add(this.sun, this.sun.target, this.fill, new T.AmbientLight("#e8e5cf", .24), this.atmosphere.sky, this.model.group, this.pivot);
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement); this.orbit.enableDamping = false;
    this.orbit.maxPolarAngle = Math.PI * .49; this.orbit.minDistance = .8; this.orbit.maxDistance = 700; this.orbit.zoomSpeed = 2.6; this.orbit.zoomToCursor = true; this.orbit.panSpeed = 1.2;
    this.orbit.minZoom = .15; this.orbit.maxZoom = 160;
    this.orbit.addEventListener("change", () => this.constrainCamera());
    this.transform = new TransformControls(this.camera, this.renderer.domElement); this.transform.setSize(.8); this.scene.add(this.transform.getHelper());
    this.transform.setTranslationSnap(this.snap); this.transform.setRotationSnap(T.MathUtils.degToRad(15));
    this.transform.addEventListener("dragging-changed", event => {
      this.orbit.enabled = !event.value;
      if (event.value) {
        this.gizmoGesture = true; this.callbacks.begin(); this.pivot.updateMatrix(); this.initialPivot.copy(this.pivot.matrix).invert(); this.initialMatrices.clear();
        for (const id of this.selected) { const root = this.model.roots.get(id)!; root.updateMatrix(); this.initialMatrices.set(id, root.matrix.clone()); }
      } else { this.callbacks.commit(); }
    });
    this.transform.addEventListener("objectChange", () => {
      if (!this.transform.dragging) return;
      if (this.selected.length > 1) {
        this.pivot.updateMatrix(); const delta = this.pivot.matrix.clone().multiply(this.initialPivot);
        for (const [id, initial] of this.initialMatrices) {
          const root = this.model.roots.get(id)!; delta.clone().multiply(initial).decompose(root.position, root.quaternion, root.scale); root.updateMatrixWorld(true);
        }
      }
      this.callbacks.transform(this.selected.map(id => ({ id, transform: readTransform(this.model.roots.get(id)!) })));
      this.updateOutline(); this.renderer.shadowMap.needsUpdate = true;
    });
    this.grid.position.y = .105; this.grid.visible = false;
    (this.grid.material as T.Material).transparent = true; (this.grid.material as T.LineBasicMaterial).opacity = .24;
    this.outline.visible = false; this.outline.renderOrder = 100;
    (this.outline.material as T.Material).depthTest = false;
    this.pathGuide.renderOrder = 100; this.pathGuide.visible = false;
    this.scene.add(this.grid, this.outline, this.pathGuide, this.pathDots);
    this.home();
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", event => {
      this.dragStart.set(event.clientX, event.clientY); this.moved = false; this.gizmoGesture = false;
      canvas.focus({ preventScroll: true });
      if (event.button === 0 && event.shiftKey && !this.preview && !this.placement && !this.drawing) {
        event.preventDefault(); event.stopImmediatePropagation();
        this.marqueePointer = event.pointerId; canvas.setPointerCapture(event.pointerId);
      }
    }, { capture: true });
    canvas.addEventListener("pointermove", event => {
      if (this.marqueePointer !== event.pointerId) return;
      event.preventDefault(); event.stopImmediatePropagation();
      this.moved = this.dragStart.distanceTo(new T.Vector2(event.clientX, event.clientY)) > 5;
      const rect = canvas.getBoundingClientRect();
      Object.assign(this.marquee.style, { left: `${Math.min(this.dragStart.x, event.clientX) - rect.left}px`, top: `${Math.min(this.dragStart.y, event.clientY) - rect.top}px`, width: `${Math.abs(event.clientX - this.dragStart.x)}px`, height: `${Math.abs(event.clientY - this.dragStart.y)}px` });
      this.marquee.hidden = !this.moved;
    }, { capture: true });
    canvas.addEventListener("pointerup", event => {
      if (this.marqueePointer !== event.pointerId) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (this.moved) this.selectRectangle(event.clientX, event.clientY);
      else this.pick(event, true);
      this.cancelMarquee();
    }, { capture: true });
    canvas.addEventListener("pointercancel", () => this.cancelMarquee());
    canvas.addEventListener("lostpointercapture", () => this.cancelMarquee());
    canvas.addEventListener("pointermove", event => {
      if (this.dragStart.distanceTo(new T.Vector2(event.clientX, event.clientY)) > 5) this.moved = true;
      this.updateRay(event);
      const point = this.groundPoint();
      if (point) {
        this.ground.copy(point); this.callbacks.coordinates(point);
        if (this.ghost) this.updateGhost(point);
        if (this.drawing) this.updatePathGuide([point.x, point.z]);
      }
    });
    canvas.addEventListener("pointerup", event => {
      if (event.button !== 0 || this.moved || this.gizmoGesture || this.transform.dragging || this.preview) return;
      this.updateRay(event);
      if (this.placement) {
        const p = this.groundPoint(); if (!p) return;
        this.callbacks.place(this.placement, p.toArray() as [number, number, number], T.MathUtils.radToDeg(this.ghostYaw), event.shiftKey); return;
      }
      if (this.drawing) {
        const p = this.groundPoint(); if (!p) return;
        if (this.pathPoints.length && new T.Vector2(...this.pathPoints.at(-1)!).distanceTo(new T.Vector2(p.x, p.z)) < .2) return;
        if (this.pathPoints.length >= 100) { this.callbacks.status("A path can have up to 100 points. Finish this path to start another."); return; }
        this.pathPoints.push([p.x, p.z]); this.updatePathGuide(); this.callbacks.status(`${this.pathPoints.length} path points · click to continue · Enter to finish`); return;
      }
      this.pick(event, event.shiftKey);
    });
    canvas.addEventListener("dblclick", () => { if (!this.placement && !this.drawing) this.focus(); });
    canvas.addEventListener("webglcontextlost", event => { event.preventDefault(); this.renderer.setAnimationLoop(null); this.callbacks.status("The 3D view was interrupted. Export or save your layout, then reload the studio."); });
    window.addEventListener("keyup", event => { this.navigationKeys.delete(event.code); if (!event.shiftKey) { this.navigationKeys.delete("ShiftLeft"); this.navigationKeys.delete("ShiftRight"); } });
    window.addEventListener("blur", () => { this.navigationKeys.clear(); this.cancelMarquee(); });
    document.addEventListener("visibilitychange", () => this.navigationKeys.clear());
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(host); this.resize();
    this.renderer.setAnimationLoop(time => this.render(time));
  }
  private cancelMarquee() {
    const pointer = this.marqueePointer; this.marqueePointer = null; this.marquee.hidden = true;
    if (pointer !== null && this.renderer.domElement.hasPointerCapture(pointer)) this.renderer.domElement.releasePointerCapture(pointer);
  }
  private pick(event: PointerEvent, additive: boolean) {
    this.updateRay(event);
    const candidates = this.layout?.objects.filter(item => item.visible && !item.locked).map(item => this.model.roots.get(item.id)!) ?? [];
    const hit = this.ray.intersectObjects(candidates, true).find(hit => this.visible(hit.object));
    let root = hit?.object;
    while (root && !root.userData.layoutId) root = root.parent ?? undefined;
    this.callbacks.select(root?.userData.layoutId ?? null, additive);
  }
  private selectRectangle(x: number, y: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const left = Math.min(x, this.dragStart.x), right = Math.max(x, this.dragStart.x), top = Math.min(y, this.dragStart.y), bottom = Math.max(y, this.dragStart.y);
    this.camera.updateMatrixWorld();
    const frustum = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse));
    const ids: string[] = [];
    for (const item of this.layout?.objects ?? []) {
      if (!item.visible || item.locked) continue;
      const box = new T.Box3().setFromObject(this.model.roots.get(item.id)!);
      if (box.isEmpty() || !frustum.intersectsBox(box)) continue;
      const screen = new T.Box2();
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const point = new T.Vector3(x, y, z).project(this.camera);
        screen.expandByPoint(new T.Vector2(rect.left + (point.x + 1) * rect.width / 2, rect.top + (1 - point.y) * rect.height / 2));
      }
      if (screen.max.x >= left && screen.min.x <= right && screen.max.y >= top && screen.min.y <= bottom) ids.push(item.id);
    }
    this.callbacks.selectArea(ids);
  }
  navigate(event: KeyboardEvent) {
    if (!["KeyW", "KeyA", "KeyS", "KeyD", "PageUp", "PageDown", "ShiftLeft", "ShiftRight"].includes(event.code)) return false;
    this.navigationKeys.add(event.code);
    if (event.shiftKey) this.navigationKeys.add("ShiftLeft");
    if (!event.code.startsWith("Shift")) event.preventDefault();
    return true;
  }
  private moveCamera(dt: number) {
    const focused = document.activeElement;
    if (document.querySelector("dialog[open]") || focused?.matches("input, select, textarea, [contenteditable=true]")) this.navigationKeys.clear();
    if (!this.navigationKeys.size || this.transform.dragging || this.marqueePointer !== null) return;
    const pressed = (code: string) => Number(this.navigationKeys.has(code));
    const forward = this.camera === this.orthographic ? new T.Vector3(0, 0, -1) : this.camera.getWorldDirection(new T.Vector3()).setY(0).normalize();
    const right = new T.Vector3(-forward.z, 0, forward.x);
    const direction = forward.multiplyScalar(pressed("KeyW") - pressed("KeyS")).addScaledVector(right, pressed("KeyD") - pressed("KeyA"));
    direction.y = pressed("PageUp") - pressed("PageDown");
    const distance = this.camera === this.orthographic ? 100 / this.camera.zoom : this.camera.position.distanceTo(this.orbit.target);
    const speed = T.MathUtils.clamp(distance * .4, 12, 100) * (pressed("ShiftLeft") || pressed("ShiftRight") ? 3 : 1);
    direction.normalize().multiplyScalar(speed * dt);
    const next = this.collision.moveCamera(this.camera.position, this.camera.position.clone().add(direction));
    this.orbit.target.add(next.clone().sub(this.camera.position)); this.camera.position.copy(next);
  }
  private constrainCamera() {
    this.camera.position.copy(this.collision.moveCamera(this.cameraAnchor, this.camera.position));
    this.cameraAnchor.copy(this.camera.position);
    this.orbit.target.y = Math.max(this.orbit.target.y, this.collision.height(this.orbit.target.x, this.orbit.target.z));
    this.camera.lookAt(this.orbit.target); this.camera.updateMatrixWorld();
  }
  pastePoint(): [number, number, number] {
    const p = this.orbit.target.clone();
    if (this.snap) { p.x = Math.round(p.x / this.snap) * this.snap; p.z = Math.round(p.z / this.snap) * this.snap; }
    p.y = this.collision.height(p.x, p.z); return p.toArray() as [number, number, number];
  }
  navigationState() { return { position: this.camera.position.toArray(), target: this.orbit.target.toArray(), zoom: this.camera.zoom, floor: this.collision.height(this.camera.position.x, this.camera.position.z) + 1.5 }; }
  private visible(object: T.Object3D): boolean { for (let o: T.Object3D | null = object; o; o = o.parent) if (!o.visible) return false; return true; }
  private resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    this.renderer.setSize(w, h, false); this.perspective.aspect = w / h; this.perspective.updateProjectionMatrix();
    this.orthographic.left = -50 * w / h; this.orthographic.right = 50 * w / h; this.orthographic.updateProjectionMatrix();
  }
  private render(time: number) {
    if (document.hidden || time - this.lastFrame < 32) return;
    const dt = Math.min((time - this.lastFrame) / 1000, .05); this.lastFrame = time;
    this.moveCamera(dt); this.orbit.update(); this.constrainCamera();
    if (this.model.world) {
      const world = this.model.world; world.wind.time.value = this.reduced ? 0 : time / 1000; world.wind.strength.value = this.reduced ? 0 : .25;
      world.water.userData.time.value = this.reduced ? 0 : time / 1000;
      for (const flame of world.flames) if ((flame.material as T.ShaderMaterial).uniforms?.time) (flame.material as T.ShaderMaterial).uniforms.time.value = this.reduced ? 0 : time / 1000;
    }
    this.atmosphere.update(this.reduced ? 0 : time / 1000, this.camera.position);
    this.renderer.render(this.scene, this.camera);
    if (++this.frame % 60 === 0) this.callbacks.stats(this.renderer.info.render.calls, this.renderer.info.render.triangles);
  }
  async load(progress: (n: number) => void) { await this.model.load(this.renderer, progress); this.collision.refresh(this.model.original); this.renderer.shadowMap.needsUpdate = true; }
  sync(layout: Layout) { this.layout = layout; this.model.apply(layout); this.collision.refresh(layout); this.model.conformPaths((x, z) => this.collision.height(x, z)); this.model.conformGrass((x, z) => this.collision.height(x, z), p => this.collision.blocksGrass(p)); this.renderer.shadowMap.needsUpdate = true; this.setSelection(this.selected.filter(id => this.model.roots.has(id))); }
  setSelection(ids: string[]) {
    this.selected = ids; this.transform.detach();
    const unlocked = ids.filter(id => !this.layout?.objects.find(o => o.id === id)?.locked);
    if (unlocked.length === ids.length && ids.length && this.tool !== "select" && !this.preview && !this.placement && !this.drawing) {
      if (ids.length === 1) this.transform.attach(this.model.roots.get(ids[0])!);
      else {
        const center = new T.Vector3(); ids.forEach(id => center.add(this.model.roots.get(id)!.position)); center.divideScalar(ids.length);
        this.pivot.position.copy(center); this.pivot.rotation.set(0, 0, 0); this.pivot.scale.set(1, 1, 1); this.pivot.updateMatrixWorld(true); this.transform.attach(this.pivot);
      }
    }
    this.updateOutline();
  }
  private updateOutline() {
    this.outline.box.makeEmpty();
    for (const id of this.selected) { const root = this.model.roots.get(id); if (root?.visible) this.outline.box.expandByObject(root); }
    this.outline.visible = !this.preview && !this.outline.box.isEmpty();
  }
  setTool(tool: string) { this.tool = tool; if (tool !== "select") this.transform.setMode(tool as "translate" | "rotate" | "scale"); this.setSelection(this.selected); }
  setSpace(space: string) { this.transform.setSpace(space as "world" | "local"); }
  setSnap(distance: number, angle: number) { this.snap = distance; this.transform.setTranslationSnap(distance || null); this.transform.setRotationSnap(angle ? T.MathUtils.degToRad(angle) : null); }
  toggleGrid(visible: boolean) { this.grid.visible = visible; }
  setLighting(value: string) {
    const dusk = value === "dusk" ? .85 : 0;
    this.model.world?.setWeather(0, dusk); this.atmosphere.setWeather(0, dusk);
    this.sun.color.set(value === "day" ? "#ffe8c1" : "#ffcc8c"); this.sun.intensity = value === "dusk" ? .8 : value === "golden" ? 3.8 : 3.4;
    this.sun.position.set(40, value === "golden" ? 26 : 60, 25); this.fill.intensity = value === "dusk" ? .65 : 1.45;
    this.renderer.shadowMap.needsUpdate = true;
  }
  home() { this.orbit.target.set(-3, 0, -9); this.camera.position.set(70, 75, 93); if (this.camera === this.orthographic) { this.camera.position.set(-3, 150, -8.99); this.orthographic.zoom = 1; this.orthographic.updateProjectionMatrix(); } this.cameraAnchor.copy(this.camera.position); this.orbit.update(); }
  topDown(top: boolean) {
    const target = this.orbit.target.clone();
    this.camera = top ? this.orthographic : this.perspective;
    this.orbit.object = this.camera; this.transform.camera = this.camera; this.orbit.enableRotate = !top;
    if (top) { this.camera.position.set(target.x, 160, target.z + .001); this.camera.lookAt(target); }
    else if (this.perspective.position.distanceTo(target) < 2) this.perspective.position.copy(target).add(new T.Vector3(25, 25, 30));
    this.cameraAnchor.copy(this.camera.position); this.orbit.update(); this.resize();
  }
  focus() {
    this.updateOutline(); if (this.outline.box.isEmpty()) return;
    const center = this.outline.box.getCenter(new T.Vector3()), size = this.outline.box.getSize(new T.Vector3());
    this.orbit.target.copy(center);
    if (this.camera === this.orthographic) { this.camera.position.set(center.x, center.y + 160, center.z + .001); this.orthographic.zoom = Math.min(8, 65 / Math.max(size.x, size.z, 4)); this.orthographic.updateProjectionMatrix(); }
    else {
      const root = this.selected.length === 1 ? this.model.roots.get(this.selected[0]) : null;
      const heading = root?.rotation.y ?? -.5;
      this.camera.position.copy(center).add(new T.Vector3(Math.sin(heading), .95, Math.cos(heading)).normalize().multiplyScalar(Math.max(size.length() * 1.6, 7)));
    }
    this.cameraAnchor.copy(this.camera.position); this.orbit.update();
  }
  private updateRay(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); this.ray.setFromCamera(this.pointer, this.camera);
  }
  private groundPoint() {
    const point = this.collision.pickGround(this.ray.ray);
    if (!point || Math.abs(point.x) > 1500 || Math.abs(point.z) > 1500) return null;
    if (this.snap) { point.x = Math.round(point.x / this.snap) * this.snap; point.z = Math.round(point.z / this.snap) * this.snap; }
    point.y = this.collision.height(point.x, point.z); return point;
  }
  private updateGhost(point: T.Vector3) {
    if (!this.ghost || !this.placement) return;
    const item: LayoutItem = { id: "placement-preview", asset: this.placement, name: "Placement", path: this.model.assets.get(this.placement)?.path, position: point.toArray(), rotation: [0, T.MathUtils.radToDeg(this.ghostYaw), 0], scale: [1, 1, 1], visible: true, locked: false };
    this.collision.ground(item, !this.model.assets.get(item.asset)?.surface);
    this.ghost.position.fromArray(item.position); this.ghost.rotation.y = this.ghostYaw; this.ghost.visible = true;
    const blocked = this.avoidOverlaps && this.layout && this.collision.overlap(item, this.layout);
    for (const material of this.ghostMaterials) {
      const color = (material as T.MeshStandardMaterial).color;
      if (color) color.copy(blocked ? new T.Color("#e66d62") : material.userData.placementColor);
    }
    this.renderer.domElement.style.cursor = blocked ? "not-allowed" : "crosshair";
  }
  startPlacement(asset: Asset) {
    this.cancelPlacement(); this.placement = asset.id; this.ghostYaw = 0; this.ghost = asset.template.clone(true);
    this.ghost.traverse(o => {
      if (o instanceof T.Mesh) {
        const materials = (Array.isArray(o.material) ? o.material : [o.material]).map(m => { const material = m.clone(); material.transparent = true; material.opacity = .52; material.depthWrite = false; if ((m as T.MeshStandardMaterial).color) material.userData.placementColor = (m as T.MeshStandardMaterial).color.clone(); this.ghostMaterials.push(material); return material; });
        o.material = Array.isArray(o.material) ? materials : materials[0]; o.castShadow = false;
      } else if (o instanceof T.Light) o.visible = false;
    });
    this.ghost.visible = false; this.scene.add(this.ghost); this.transform.detach(); this.renderer.domElement.style.cursor = "crosshair";
  }
  turnPlacement(degrees: number) { this.ghostYaw += T.MathUtils.degToRad(degrees); if (this.ghost) this.updateGhost(this.ground); }
  cancelPlacement() {
    this.ghost?.removeFromParent(); this.ghost = undefined; this.ghostMaterials.forEach(m => m.dispose()); this.ghostMaterials = []; this.placement = undefined;
    this.drawing = false; this.pathPoints = []; this.pathGuide.visible = false; this.clearDots(); this.renderer.domElement.style.cursor = ""; this.setSelection(this.selected);
  }
  startPath(points: [number, number][] = [], straight = false) {
    this.cancelPlacement(); this.drawing = true; this.straightPath = straight; this.pathPoints = structuredClone(points);
    this.transform.detach(); this.renderer.domElement.style.cursor = "crosshair"; this.updatePathGuide();
  }
  finishPath() { if (this.pathPoints.length < 2) { this.callbacks.status("Place at least two points for your path."); return false; } this.callbacks.path(structuredClone(this.pathPoints)); this.cancelPlacement(); return true; }
  private clearDots() { for (const o of [...this.pathDots.children]) { const mesh = o as T.Mesh; mesh.geometry.dispose(); (mesh.material as T.Material).dispose(); mesh.removeFromParent(); } }
  private updatePathGuide(hover?: [number, number]) {
    const points = [...this.pathPoints, ...(hover ? [hover] : [])].map(([x, z]) => new T.Vector3(x, this.collision.height(x, z) + .25, z));
    this.pathGuide.geometry.dispose(); this.pathGuide.geometry = new T.BufferGeometry().setFromPoints(points.length > 1 && !this.straightPath ? new T.CatmullRomCurve3(points).getPoints(100) : points); this.pathGuide.visible = points.length > 1;
    this.clearDots();
    for (const [x, z] of this.pathPoints) { const dot = new T.Mesh(new T.SphereGeometry(.25, 8, 6), new T.MeshBasicMaterial({ color: "#fff4c9", depthTest: false })); dot.position.set(x, this.collision.height(x, z) + .25, z); dot.renderOrder = 101; this.pathDots.add(dot); }
  }
  setPreview(preview: boolean) { this.preview = preview; if (preview) this.cancelPlacement(); this.setSelection(this.selected); }
  capture() { this.renderer.render(this.scene, this.camera); return this.renderer.domElement.toDataURL("image/png"); }
  getBounds() { this.updateOutline(); return this.outline.box.clone(); }
  screenPoint(id: string, offset?: [number, number, number]) {
    const root = this.model.roots.get(id); if (!root) return null;
    const point = offset ? root.position.clone().add(new T.Vector3(...offset)) : new T.Box3().setFromObject(root).getCenter(new T.Vector3());
    point.project(this.camera); const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.x + (point.x + 1) * rect.width / 2, y: rect.y + (1 - point.y) * rect.height / 2 };
  }
  async thumbnails(onThumbnail: (asset: Asset) => void) {
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(240, 192); renderer.setPixelRatio(1); renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
    const scene = new T.Scene(); const key = new T.DirectionalLight("#fff0d2", 3.5); key.position.set(7, 10, 6);
    scene.add(key, new T.HemisphereLight("#e5f0f5", "#a6ae85", 2));
    const camera = new T.PerspectiveCamera(34, 240 / 192, .01, 2000);
    for (const asset of this.model.assets.values()) {
      if (!asset.shelf) continue;
      const root = asset.template.clone(true); scene.add(root); root.updateMatrixWorld(true);
      const bounds = new T.Box3().setFromObject(root), center = bounds.getCenter(new T.Vector3()), size = bounds.getSize(new T.Vector3());
      const distance = Math.max(size.x, size.y * 1.25, size.z) * 2.25;
      camera.position.copy(center).add(new T.Vector3(1, .65, 1.2).normalize().multiplyScalar(Math.max(distance, .5))); camera.lookAt(center);
      renderer.render(scene, camera); asset.thumbnail = renderer.domElement.toDataURL(); root.removeFromParent(); onThumbnail(asset);
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
    renderer.dispose(); renderer.forceContextLoss();
  }
}

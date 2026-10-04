import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MOVEMENT } from "../../features/village/movement";
import type { StudioCollision } from "./spatial";

/** Local play testing uses the unsaved scene, without connecting to the shared village. */
export class PlayPreview {
  readonly player = new T.Group();
  private character?: T.Object3D;
  private velocityY = 0;
  private jumpRequested = false;
  private grounded = true;
  private phase = 0;
  private fins: T.Object3D[] = [];

  constructor(private collision: StudioCollision) { this.player.visible = false; }

  async load() {
    const { scene } = await new GLTFLoader().loadAsync("/village/models/spirit.glb?v=3");
    const bounds = new T.Box3().setFromObject(scene.getObjectByName("SpiritBody") ?? scene);
    const scale = .95 / bounds.getSize(new T.Vector3()).y;
    scene.scale.setScalar(scale); scene.position.y = .62 - bounds.min.y * scale;
    scene.traverse(object => {
      if (object.name.startsWith("SpiritFin")) this.fins.push(object);
      if (object instanceof T.Mesh) object.castShadow = object.receiveShadow = true;
    });
    this.character = scene; this.player.add(scene);
  }

  enter(anchor: T.Vector3) {
    for (const center of [anchor, new T.Vector3(.3, 0, 20), new T.Vector3(40, 0, 30)]) {
      for (let radius = 0; radius <= 20; radius += 2) for (let i = 0; i < (radius ? 24 : 1); i++) {
        const angle = i * Math.PI / 12, x = center.x + Math.cos(angle) * radius, z = center.z + Math.sin(angle) * radius;
        const y = this.collision.height(x, z);
        if (!this.collision.playerClear(x, z, y)) continue;
        this.player.position.set(x, y, z); this.player.rotation.y = Math.PI;
        this.velocityY = 0; this.grounded = true; this.jumpRequested = false; this.phase = 0; this.player.visible = true;
        return true;
      }
    }
    return false;
  }
  leave() { this.player.visible = false; this.jumpRequested = false; }
  jump() { this.jumpRequested = true; }

  update(dt: number, keys: Set<string>, camera: T.Camera, reduced: boolean) {
    const pressed = (a: string, b?: string) => Number(keys.has(a) || !!b && keys.has(b));
    const forward = camera.getWorldDirection(new T.Vector3()).setY(0).normalize();
    const right = new T.Vector3(-forward.z, 0, forward.x);
    const direction = forward.multiplyScalar(pressed("KeyW", "ArrowUp") - pressed("KeyS", "ArrowDown"))
      .addScaledVector(right, pressed("KeyD", "ArrowRight") - pressed("KeyA", "ArrowLeft")).normalize();
    const running = keys.has("ShiftLeft") || keys.has("ShiftRight"), speed = running ? MOVEMENT.run : MOVEMENT.walk;
    const steps = Math.max(1, Math.ceil(dt / (1 / 120))), step = dt / steps;
    if (this.jumpRequested && this.grounded) { this.velocityY = MOVEMENT.jump; this.grounded = false; }
    this.jumpRequested = false;
    const before = this.player.position.clone();
    for (let i = 0; i < steps; i++) {
      const position = this.player.position;
      for (const axis of ["x", "z"] as const) {
        const x = position.x + (axis === "x" ? direction.x * speed * step : 0);
        const z = position.z + (axis === "z" ? direction.z * speed * step : 0);
        const floor = this.collision.height(x, z), rise = floor - this.collision.height(position.x, position.z);
        if (rise > .15 || !this.collision.playerClear(x, z, Math.max(position.y, floor))) continue;
        position[axis] = axis === "x" ? x : z;
      }
      const floor = this.collision.height(position.x, position.z);
      this.velocityY -= MOVEMENT.gravity * step; position.y += this.velocityY * step;
      if (position.y <= floor) { position.y = floor; this.velocityY = 0; this.grounded = true; } else this.grounded = false;
    }
    const moving = Math.hypot(this.player.position.x - before.x, this.player.position.z - before.z) > .001;
    if (moving) {
      const yaw = Math.atan2(-direction.x, -direction.z), delta = Math.atan2(Math.sin(yaw - this.player.rotation.y), Math.cos(yaw - this.player.rotation.y));
      this.player.rotation.y += delta * Math.min(1, dt * 12);
    }
    this.phase += dt * (moving ? running ? 11 : 7 : 2);
    if (this.character) this.character.position.y += ((reduced ? 0 : Math.sin(this.phase) * (moving ? .045 : .015)) - (this.character.userData.bob ?? 0));
    if (this.character) this.character.userData.bob = reduced ? 0 : Math.sin(this.phase) * (moving ? .045 : .015);
    for (const [i, fin] of this.fins.entries()) fin.rotation.z = reduced ? 0 : Math.sin(this.phase + i * Math.PI) * (moving ? .2 : .03);
    return this.player.position.clone().sub(before);
  }
  state() { return { active: this.player.visible, position: this.player.position.toArray(), grounded: this.grounded }; }
}

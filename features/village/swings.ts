import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Collider } from "./environment";
import type { AuthoredWorld } from "./worldLayout";

export const SWING_LENGTH = 2.65;
export const SWING_PIVOT_HEIGHT = 3.45;
export const SWING_MAX_ANGLE = 78 * Math.PI / 180;
export type SwingSeat = { id: string; index: 0 | 1 };

/** Fixed-step constrained pendulum: input adds torque; gravity and drag keep the arc physical. */
export class SwingPendulum {
  angle = 0;
  velocity = 0;
  private accumulator = 0;
  constructor(readonly length = SWING_LENGTH) {}
  update(dt: number, direction: number, brake: boolean, occupied: boolean) {
    this.accumulator += Math.min(.1, Math.max(0, dt));
    const step = 1 / 120, gravity = 9.81 / this.length;
    const maximumEnergy = gravity * (1 - Math.cos(SWING_MAX_ANGLE));
    while (this.accumulator >= step) {
      this.accumulator -= step;
      const damping = brake ? 4.2 : occupied ? .055 : .22;
      this.velocity += (-gravity * Math.sin(this.angle) + (brake ? 0 : direction) * 1.65 * Math.cos(this.angle) - damping * this.velocity) * step;
      this.angle += this.velocity * step;
      // Cap energy rather than bouncing off an invisible angular stop.
      this.angle = T.MathUtils.clamp(this.angle, -SWING_MAX_ANGLE, SWING_MAX_ANGLE);
      const potential = gravity * (1 - Math.cos(this.angle));
      const speedLimit = Math.sqrt(Math.max(0, 2 * (maximumEnergy - potential)));
      this.velocity = T.MathUtils.clamp(this.velocity, -speedLimit, speedLimit);
    }
  }
  reset() { this.angle = this.velocity = this.accumulator = 0; }
}

export class VillageSwingSet {
  readonly root = new T.Group();
  readonly pivots = [new T.Group(), new T.Group()];
  private seatCarriers = [new T.Group(), new T.Group()];
  readonly pendulums: SwingPendulum[];
  readonly dynamicMeshes = new Set<T.Object3D>();
  private point = new T.Vector3();
  constructor(readonly placement: AuthoredWorld["swings"][number]) {
    const { id, x, y, z, yaw, scale } = placement;
    this.root.name = id;
    this.root.position.set(x, y, z); this.root.rotation.y = yaw; this.root.scale.fromArray(scale);
    this.pendulums = [new SwingPendulum(SWING_LENGTH * scale[1]), new SwingPendulum(SWING_LENGTH * scale[1])];
    const sage = new T.MeshStandardMaterial({ color: "#668c79", roughness: .75 });
    const wood = new T.MeshStandardMaterial({ color: "#bc8654", roughness: .85 });
    const copper = new T.MeshStandardMaterial({ color: "#d6b278", metalness: .55, roughness: .4 });
    const chain = new T.MeshStandardMaterial({ color: "#657064", metalness: .65, roughness: .45 });
    const seat = new T.MeshStandardMaterial({ color: "#365b4b", roughness: .9 });
    const stone = new T.MeshStandardMaterial({ color: "#c5c0a6", roughness: 1 });
    const part = (geometry: T.BufferGeometry, material: T.Material, parent: T.Group, position: [number, number, number]) => {
      const mesh = new T.Mesh(geometry, material); mesh.position.fromArray(position);
      mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    const pole = (a: [number, number, number], b: [number, number, number], radius: number, material: T.Material, parent = this.root) => {
      const start = new T.Vector3(...a), end = new T.Vector3(...b), delta = end.clone().sub(start);
      const mesh = part(new T.CylinderGeometry(radius, radius, delta.length(), 10), material, parent, start.add(end).multiplyScalar(.5).toArray());
      mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize()); return mesh;
    };
    for (const side of [-1, 1]) {
      for (const depth of [-1, 1]) {
        pole([side * 2.45, -.25, depth * 1.25], [side * 2.45, SWING_PIVOT_HEIGHT, 0], .095, sage);
        part(new T.CylinderGeometry(.22, .27, .35, 8), stone, this.root, [side * 2.45, -.1, depth * 1.25]);
      }
      pole([side * 2.45, 1.18, -.78], [side * 2.45, 1.18, .78], .07, sage);
      part(new T.SphereGeometry(.14, 12, 8), copper, this.root, [side * 2.45, SWING_PIVOT_HEIGHT, 0]);
    }
    part(new T.BoxGeometry(5.4, .22, .24), wood, this.root, [0, SWING_PIVOT_HEIGHT + .05, 0]);
    for (const [index, pivot] of this.pivots.entries()) {
      const seatX = index === 0 ? -.98 : .98;
      pivot.position.set(seatX, SWING_PIVOT_HEIGHT, 0); this.root.add(pivot);
      for (const side of [-1, 1]) {
        part(new T.TorusGeometry(.085, .018, 6, 12), copper, this.root, [seatX + side * .36, SWING_PIVOT_HEIGHT - .02, 0]);
        // One merged mesh per chain retains visible interlocking links without per-link draw calls.
        const links: T.BufferGeometry[] = [];
        for (let i = 0; i < 44; i++) {
          const link = new T.TorusGeometry(.036, .009, 4, 8);
          if (i % 2) link.rotateY(Math.PI / 2);
          link.scale(1, 1.45, 1); link.translate(side * .36, -.04 - i * (SWING_LENGTH - .08) / 43, 0); links.push(link);
        }
        const geometry = mergeGeometries(links)!; links.forEach(link => link.dispose());
        part(geometry, chain, pivot, [0, 0, 0]);
      }
      const seatShape = new T.Shape();
      seatShape.moveTo(-.42, -.17); seatShape.lineTo(.42, -.17); seatShape.quadraticCurveTo(.49, -.17, .49, -.1);
      seatShape.lineTo(.49, .1); seatShape.quadraticCurveTo(.49, .17, .42, .17);
      seatShape.lineTo(-.42, .17); seatShape.quadraticCurveTo(-.49, .17, -.49, .1);
      seatShape.lineTo(-.49, -.1); seatShape.quadraticCurveTo(-.49, -.17, -.42, -.17);
      const geometry = new T.ExtrudeGeometry(seatShape, { depth: .065, bevelEnabled: true, bevelThickness: .018, bevelSize: .018, bevelSegments: 2, steps: 1 });
      geometry.rotateX(Math.PI / 2);
      const carrier = this.seatCarriers[index]; carrier.position.y = -SWING_LENGTH; pivot.add(carrier);
      part(geometry, seat, carrier, [0, 0, 0]);
      pivot.traverse(object => { if (object instanceof T.Mesh) this.dynamicMeshes.add(object); });
    }
    this.root.updateMatrixWorld(true);
  }
  update(dt: number, rider: SwingSeat | null, direction: number, brake: boolean, paused: boolean) {
    if (paused) return;
    this.pendulums.forEach((pendulum, index) => {
      const occupied = rider?.id === this.placement.id && rider.index === index;
      pendulum.update(dt, occupied ? direction : 0, occupied && brake, occupied);
      this.pivots[index].rotation.x = -pendulum.angle;
      this.seatCarriers[index].rotation.x = pendulum.angle;
    });
    this.root.updateMatrixWorld(true);
  }
  seatPoint(index: 0 | 1, target: T.Vector3) {
    return this.pivots[index].localToWorld(target.set(0, -SWING_LENGTH, 0));
  }
  showSharedMotion(index: 0 | 1, angle: number, velocity: number, dt: number) {
    const pendulum = this.pendulums[index];
    pendulum.angle = T.MathUtils.lerp(pendulum.angle, angle, 1 - Math.exp(-dt * 18));
    pendulum.velocity = velocity;
    this.pivots[index].rotation.x = -pendulum.angle;
    this.seatCarriers[index].rotation.x = pendulum.angle;
    this.root.updateMatrixWorld(true);
  }
  nearest(position: T.Vector3, occupied?: (index: 0 | 1) => boolean): SwingSeat | null {
    let distance = 2.5, nearest: SwingSeat | null = null;
    for (const index of [0, 1] as const) {
      if (occupied?.(index)) continue;
      this.seatPoint(index, this.point);
      const d = Math.hypot(this.point.x - position.x, this.point.z - position.z);
      if (d < distance && Math.abs(this.point.y - position.y) < 1.65) { distance = d; nearest = { id: this.placement.id, index }; }
    }
    return nearest;
  }
  colliders(): Collider[] {
    const boxes: Collider[] = [];
    for (const side of [-1, 1]) {
      const box = new T.Box3(new T.Vector3(side * 2.45 - .2, -.3, -1.5), new T.Vector3(side * 2.45 + .2, SWING_PIVOT_HEIGHT + .2, 1.5));
      box.applyMatrix4(this.root.matrixWorld);
      boxes.push({ x: (box.min.x + box.max.x) / 2, z: (box.min.z + box.max.z) / 2, w: box.max.x - box.min.x, d: box.max.z - box.min.z, bottom: box.min.y, top: box.max.y });
    }
    const beam = new T.Box3(new T.Vector3(-2.7, 3.36, -.14), new T.Vector3(2.7, 3.63, .14)).applyMatrix4(this.root.matrixWorld);
    boxes.push({ x: (beam.min.x + beam.max.x) / 2, z: (beam.min.z + beam.max.z) / 2, w: beam.max.x - beam.min.x, d: beam.max.z - beam.min.z, bottom: beam.min.y, top: beam.max.y });
    return boxes;
  }
}

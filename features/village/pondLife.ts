import { POND, POND_DOCK } from "./environment";
import { layoutWorldPoint } from "./layoutTransforms";
import type { AuthoredWorld } from "./worldLayout";

export const POND_BIRDS = ["Swan", "Swan", "Swan", "Duck", "Duck", "Duck", "Duck", ...Array<string>(8).fill("Duckling")];

/** Families share a lane; each duckling trails its parent at a different distance. */
export function pondBirdRoute(index: number, time: number): [number, number, number] {
  const swan = index < 3, family = index < 7 ? index - 3 : Math.floor((index - 7) / 2);
  const lag = index < 7 ? 0 : .16 + (index - 7) % 2 * .15;
  const phase = swan ? index * 2.1 : family * 1.57 + .7 - lag;
  const angle = time * (swan ? .055 + index * .007 : .09 + family * .007) + phase + Math.sin(time * .12 + phase) * .045;
  const radius = swan ? .54 + index * .085 : .36 + family * .065 + (index < 7 ? 0 : ((index - 7) % 2 ? -.025 : .025));
  return [POND.x + Math.cos(angle) * POND.rx * radius, POND.y, POND.z + Math.sin(angle) * POND.rz * radius];
}

const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

/** Scale swimming routes and shore planting while keeping each creature its natural size. */
export class PondLifeSpace {
  private pond;
  private dock;
  constructor(layout?: AuthoredWorld) {
    this.pond = layout?.sceneVersion === 1 ? layout.items?.find(item => item.visible && item.asset === "pond") : undefined;
    this.dock = layout?.sceneVersion === 1 ? layout.items?.find(item => item.visible && item.asset === "dock") : undefined;
  }
  point(x: number, y: number, z: number): [number, number, number] {
    return this.pond ? layoutWorldPoint(this.pond, [x, y, z], [POND.x, 0, POND.z]) : [x, y, z];
  }
  get yaw() { return (this.pond?.rotation[1] ?? 0) * Math.PI / 180; }
  dockPoint(point: readonly number[]): [number, number, number] {
    return this.dock ? layoutWorldPoint(this.dock, point, [POND_DOCK.x, 0, POND_DOCK.z]) : [...point] as [number, number, number];
  }
  meal(i: number): [number, number, number] {
    const radius = 1 + Math.sqrt(Math.max(0, i - 3)) * .38;
    const point: [number, number, number] = [-25 + Math.cos(i * 2.4) * radius, POND.y, -9 + Math.sin(i * 2.4) * radius * .6];
    return this.dockPoint(point);
  }
  swim(index: number, time: number, feedAt: number): [number, number, number] {
    const orbit = this.point(...pondBirdRoute(index, time)), age = time - feedAt;
    if (index < 3 || age < 0 || age >= 17) return orbit;
    const meal = this.meal(index);
    const arrival = smooth(age / 4), departure = smooth((age - 11) / 6);
    const influence = arrival * (1 - departure);
    return orbit.map((value, axis) => value + (meal[axis] - value) * influence) as [number, number, number];
  }
  heading(index: number, time: number, feedAt: number): number {
    // A path tangent stays valid even when a frame advances less than a centimetre.
    const before = this.swim(index, time - .005, feedAt), after = this.swim(index, time + .005, feedAt);
    if (Math.hypot(after[0] - before[0], after[2] - before[2]) > .000001)
      return Math.atan2(after[0] - before[0], after[2] - before[2]);
    const meal = this.meal(index), center = this.dockPoint([-25, POND.y, -9]);
    return Math.atan2(center[0] - meal[0], center[2] - meal[2]);
  }
}

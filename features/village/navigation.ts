import { floorHeight, type Collider } from "./environment";
import { VillageMovement } from "./movement";

type Point = [number, number];
const CELL = .75, MIN_X = -39, MIN_Z = -47.25, WIDTH = 105, HEIGHT = 119;

/** Shared lazy navigation grid using exactly the player's collision and water rules. */
export class VillageNavigation {
  private probe: VillageMovement;
  private walkable = new Int8Array(WIDTH * HEIGHT);
  constructor(colliders: Collider[]) { this.probe = new VillageMovement(colliders, () => {}); }
  private point(id: number): Point { return [MIN_X + id % WIDTH * CELL, MIN_Z + Math.floor(id / WIDTH) * CELL]; }
  private valid(id: number) {
    if (id < 0 || id >= this.walkable.length) return false;
    if (!this.walkable[id]) { const [x, z] = this.point(id); this.walkable[id] = this.probe.clear(x, z) ? 1 : -1; }
    return this.walkable[id] === 1;
  }
  private visible(a: Point, b: Point) {
    this.probe.position = { x: a[0], y: floorHeight(...a), z: a[1] };
    return this.probe.canWalkTo(...b);
  }
  private closest(point: Point, connect: boolean) {
    const cx = Math.round((point[0] - MIN_X) / CELL), cz = Math.round((point[1] - MIN_Z) / CELL);
    let best = -1, distance = Infinity;
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      const x = cx + dx, z = cz + dz, id = z * WIDTH + x;
      if (x < 0 || x >= WIDTH || z < 0 || z >= HEIGHT || !this.valid(id)) continue;
      const p = this.point(id), d = Math.hypot(p[0] - point[0], p[1] - point[1]);
      if (d < distance && (!connect || this.visible(point, p))) { best = id; distance = d; }
    }
    return best;
  }
  path(from: Point, to: Point): Point[] {
    if (this.probe.clear(...to) && this.visible(from, to)) return [to];
    const start = this.closest(from, true), end = this.closest(to, false);
    if (start < 0 || end < 0) return [];
    const goal = this.point(end), size = WIDTH * HEIGHT;
    const costs = new Float32Array(size).fill(Infinity), parents = new Int32Array(size).fill(-1), closed = new Uint8Array(size);
    const heap: { id: number; score: number }[] = [];
    const push = (id: number, score: number) => {
      let i = heap.length; heap.push({ id, score });
      while (i > 0) { const parent = (i - 1) >> 1; if (heap[parent].score <= score) break; heap[i] = heap[parent]; i = parent; }
      heap[i] = { id, score };
    };
    const pop = () => {
      const first = heap[0], last = heap.pop()!;
      if (heap.length) {
        let i = 0;
        while (i * 2 + 1 < heap.length) {
          let child = i * 2 + 1; if (child + 1 < heap.length && heap[child + 1].score < heap[child].score) child++;
          if (last.score <= heap[child].score) break; heap[i] = heap[child]; i = child;
        }
        heap[i] = last;
      }
      return first.id;
    };
    costs[start] = 0; push(start, 0);
    while (heap.length) {
      const id = pop(); if (closed[id]) continue; closed[id] = 1;
      if (id === end) {
        const route: Point[] = [];
        for (let n = end; n !== start && n >= 0; n = parents[n]) route.push(this.point(n));
        route.push(this.point(start)); route.reverse();
        if (this.probe.clear(...to) && this.visible(goal, to)) route.push(to);
        const smooth: Point[] = [];
        let previous = from;
        for (let i = 0; i < route.length;) {
          let far = i;
          while (far + 1 < route.length && this.visible(previous, route[far + 1])) far++;
          smooth.push(route[far]); previous = route[far]; i = far + 1;
        }
        return smooth;
      }
      const x = id % WIDTH, z = Math.floor(id / WIDTH), a = this.point(id);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = x + dx, nz = z + dz, next = nz * WIDTH + nx;
        if (nx < 0 || nx >= WIDTH || nz < 0 || nz >= HEIGHT || closed[next] || !this.valid(next)) continue;
        const cost = costs[id] + Math.hypot(dx, dz) * CELL;
        if (cost >= costs[next]) continue;
        const b = this.point(next); if (!this.visible(a, b)) continue;
        costs[next] = cost; parents[next] = id;
        push(next, cost + Math.hypot(b[0] - goal[0], b[1] - goal[1]));
      }
    }
    return [];
  }
}

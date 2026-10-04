import { townPoint } from "./townShared";
import type { WorldItem } from "./worldLayout";

const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

/** Slow woodland loops with long glides and a quiet pause on the authored roost. */
export function owlFlightPosition(home: WorldItem, index: number, seconds: number): [number, number, number] {
  const cycle = ((seconds + index * 13) % 46 + 46) % 46;
  if (cycle >= 22) return [...home.position];
  const u = cycle / 22, angle = u * Math.PI * 2;
  const lift = smooth(u / .14) * (1 - smooth((u - .86) / .14));
  const [x, z] = townPoint(home, Math.sin(angle) * (5.2 + index * .45) * lift,
    (Math.cos(angle) - 1) * (2.5 + index * .28) * lift);
  return [x, home.position[1] + (2.6 + index * .18 + Math.sin(angle * 2) * .18) * lift * home.scale[1], z];
}

/** Accepted meal time overrides the loop without teleporting an already airborne owl. */
export function owlPosition(home: WorldItem, perch: WorldItem | undefined, index: number, seconds: number, feedAt: number | null): [number, number, number] {
  if (!perch || feedAt === null || seconds < feedAt || seconds >= feedAt + 12) return owlFlightPosition(home, index, seconds);
  const age = seconds - feedAt, start = owlFlightPosition(home, index, feedAt);
  const [x, z] = townPoint(perch, (index - 1) * .69, 1.25);
  const meal: [number, number, number] = [x, perch.position[1] + .66 * perch.scale[1], z];
  if (age < 2.2) {
    const u = age / 2.2, blend = smooth(u);
    return start.map((value, axis) => value + (meal[axis] - value) * blend + (axis === 1 ? Math.sin(Math.PI * u) ** 2 * .55 : 0)) as [number, number, number];
  }
  if (age < 9.2) return meal;
  const u = (age - 9.2) / 2.8, blend = smooth(u), flight = owlFlightPosition(home, index, seconds);
  return meal.map((value, axis) => value + (flight[axis] - value) * blend + (axis === 1 ? Math.sin(Math.PI * u) ** 2 * .6 : 0)) as [number, number, number];
}

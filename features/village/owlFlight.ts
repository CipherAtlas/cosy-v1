import { townPoint } from "./townShared";
import type { WorldItem } from "./worldLayout";

const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const cycleAt = (index: number, seconds: number) => ((seconds + index * 13) % 46 + 46) % 46;

// Integrate a smooth speed ramp so both ends arrive at the roost at rest.
function flightProgress(u: number) {
  const ramp = .12;
  const start = (t: number) => { const q = t / ramp; return ramp * (q ** 3 - .5 * q ** 4) / (1 - ramp); };
  return u < ramp ? start(u) : u > 1 - ramp ? 1 - start(1 - u) : (u - ramp / 2) / (1 - ramp);
}

/** Slow woodland loops with long glides and a quiet pause on the authored roost. */
export function owlFlightPosition(home: WorldItem, index: number, seconds: number): [number, number, number] {
  const cycle = cycleAt(index, seconds);
  if (cycle >= 26) return [...home.position];
  const u = cycle / 26, angle = flightProgress(u) * Math.PI * 2;
  const lift = smooth(u / .12) * (1 - smooth((u - .88) / .12));
  const direction = index % 2 ? -1 : 1;
  const [x, z] = townPoint(home, direction * (1 - Math.cos(angle)) * (3.1 + index * .35),
    Math.sin(angle) * (4.3 + index * .3));
  return [x, home.position[1] + (2.6 + index * .22 + Math.sin(angle) ** 2 * .35) * lift * home.scale[1], z];
}

/** Pose and wing mode come from the same accepted clock as the public position. */
export function owlFlightPose(home: WorldItem, perch: WorldItem | undefined, index: number, seconds: number, feedAt: number | null) {
  const position = owlPosition(home, perch, index, seconds, feedAt);
  const before = owlPosition(home, perch, index, seconds - .08, feedAt), after = owlPosition(home, perch, index, seconds + .08, feedAt);
  const dx = after[0] - before[0], dy = after[1] - before[1], dz = after[2] - before[2];
  const travel = Math.hypot(dx, dz), speed = Math.hypot(travel, dy) / .16;
  const cycle = cycleAt(index, seconds), age = perch && feedAt !== null ? seconds - feedAt : -1;
  const feeding = age >= 0 && age < 12;
  const returningHome = feedAt !== null && cycleAt(index, feedAt + 12) >= 26;
  let action: "idle" | "fly" | "glide" | "land" | "feed" = "idle";
  if (feeding) action = age < 1.55 ? "fly" : age < 2.2 ? "land" : age < 9.2 ? "feed" : returningHome && age >= 11.35 ? "land" : "fly";
  else if (cycle < 26) action = cycle < 3 || cycle >= 8 && cycle < 9.8 || cycle >= 16 && cycle < 17.8 ? "fly" : cycle >= 23 ? "land" : "glide";
  const flying = action === "fly" || action === "glide" || action === "land";
  const restingHeading = (feeding && age < 9.2 && perch ? perch.rotation[1] : home.rotation[1]) * Math.PI / 180;
  let heading = travel > .000001 ? Math.atan2(dx, dz) : restingHeading;
  // Settle facing the authored roost/tray instead of snapping when travel stops.
  const approach = feeding ? age < 2.2 ? smooth((age - 1.55) / .65) : age < 9.2 ? 1 : returningHome ? smooth((age - 11.35) / .65) : 0 : smooth((cycle - 24.5) / 1.5);
  heading += Math.atan2(Math.sin(restingHeading - heading), Math.cos(restingHeading - heading)) * approach;
  const velocityBefore = [position[0] - before[0], position[2] - before[2]], velocityAfter = [after[0] - position[0], after[2] - position[2]];
  const turn = Math.atan2(velocityBefore[1] * velocityAfter[0] - velocityBefore[0] * velocityAfter[1], velocityBefore[0] * velocityAfter[0] + velocityBefore[1] * velocityAfter[1]) / .08;
  const bank = flying ? Math.max(-.32, Math.min(.32, -turn * speed * .10)) * (1 - approach) : 0;
  const pitch = flying ? Math.max(-.30, Math.min(.30, -Math.atan2(dy, Math.max(.002, travel)) * .45)) * smooth(speed / .8) : 0;
  return { position, heading, bank, pitch, action, flying };
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

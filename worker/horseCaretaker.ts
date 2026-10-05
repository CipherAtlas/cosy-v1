import type { SharedActor } from "../features/village/sharedActors";
import type { TownSimulation } from "./town";

/** One accepted care clock; never interrupt a visitor's horse or hay meal. */
export function horseCareTarget(rowan: SharedActor, horses: SharedActor[], town: TownSimulation, now: number,
  home: [number, number]): [number, number] | null {
  const available = horses.filter(horse => !horse.owner && horse.mode !== "ride"
    && Math.hypot(horse.x - home[0], horse.z - home[1]) < 12
    && !town.state.hayFeeds.some(meal => meal.horseId === horse.id && meal.owner && meal.until > now))
    .sort((a, b) => a.id.localeCompare(b.id));
  const horse = available[Math.floor(now / 12_000) % available.length];
  if (!horse) { delete rowan.gesture; return null; }
  const target: [number, number] = [horse.x + Math.cos(horse.heading) * 1.55, horse.z - Math.sin(horse.heading) * 1.55];
  if (Math.hypot(rowan.x - target[0], rowan.z - target[1]) > .45) { delete rowan.gesture; return target; }
  rowan.heading = Math.atan2(horse.x - rowan.x, horse.z - rowan.z);
  if (rowan.gesture && now < rowan.gesture.at + 6000) return target;
  const feeding = Math.floor(now / 6000) % 2 === 0;
  rowan.gesture = { kind: feeding ? "horseFeed" : "horsePet", at: now, horseId: horse.id };
  if (feeding) {
    if (!town.feedingHorse(horse.id, now)) town.state.hayFeeds.push({ horseId: horse.id, owner: null, startedAt: now, until: now + 5000 });
  } else if (!town.feedingHorse(horse.id, now)) {
    Object.assign(horse, { mode: "hold", startedAt: now, until: now + 3000, speed: 0 });
  }
  return target;
}

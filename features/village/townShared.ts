import type { SharedActor } from "./sharedActors";
import type { AuthoredWorld, WorldItem } from "./worldLayout";
import type { GardenState } from "./garden";

export type TownCrop = "carrot" | "radish" | "mint";
/** Named farms keep their crop even when rows are reordered in the editor. */
export function farmCrop(item: WorldItem): TownCrop | null {
  if (item.asset !== "farm-row") return null;
  const number = /^farm-([123])-row-/.exec(item.id)?.[1];
  if (number) return ({ "1": "carrot", "2": "radish", "3": "mint" } as const)[number as "1" | "2" | "3"];
  return /\bcarrot\b/i.test(item.name ?? "") ? "carrot" : /\bradish\b/i.test(item.name ?? "") ? "radish"
    : /\bmint\b/i.test(item.name ?? "") ? "mint" : null;
}
export type TownBed = { id: string; crop: TownCrop | null; plantedAt: number | null; wateredAt: number | null; growAt: number | null };
export type TownFood = "apple" | "mushroom";
export type ForageInventory = { apples: number; mushrooms: number; carrots?: number; radishes?: number; mint?: number; daisies?: number; sunflowers?: number; mintTea?: number };
export const INVENTORY_KEYS = ["apples", "mushrooms", "carrots", "radishes", "mint", "daisies", "sunflowers", "mintTea"] as const;
export function readInventory(value?: ForageInventory | null): Required<ForageInventory> {
  return Object.fromEntries(INVENTORY_KEYS.map(key => [key, Number.isFinite(value?.[key]) ? Math.max(0, Math.min(9999, Math.floor(value![key]!))) : 0])) as Required<ForageInventory>;
}
export function withGardenInventory(garden: GardenState, inventory: ForageInventory): GardenState {
  const { carrots, radishes, mint, daisies, sunflowers, mintTea } = readInventory(inventory);
  return { ...garden, carrots, radishes, mint, daisies, sunflowers, mintTea };
}
export type TownAnimal = { id: string; species: "cow" | "sheep" | "lamb" | "hedgehog"; x: number; y: number; z: number; heading: number;
  owner: string | null; mode: "graze" | "pet" | "forage" | "return" | "gift" | "apple"; startedAt: number; until: number;
  carry: TownFood | null; mealFood?: TownFood; forageSource: string | null; nextForageAt: number };
export type TownRace = {
  trackId: string; owner: string; horseId: string; phase: "countdown" | "racing" | "finished" | "cancelled";
  startedAt: number; goAt: number; nextCheckpoint: number; playerFinishAt: number | null; npcFinishAt: number | null;
  result: "visitor" | "rival" | "tie" | null; until: number;
};
export type SharedTown = {
  beds: TownBed[]; harvest: Record<TownCrop, number>;
  owlFeedAt: number | null; owlOwner: string | null; owlUntil: number;
  hayFeeds: { horseId: string; owner: string | null; startedAt: number; until: number }[];
  race: TownRace | null; rival: SharedActor | null;
  applePickedAt?: Record<string, number>;
  animals: TownAnimal[];
};
export type TownAction = {
  kind: "town"; action: "raceInvite" | "raceStart" | "raceCancel" | "hay" | "owlFood" | "owlFeed" | "gardenPlant" | "gardenWater" | "gardenHarvest" | "animalPet" | "animalGift" | "animalApple" | "animalMushroom" | "applePick";
  id: string; crop?: TownCrop;
};
export const TOWN_GROW_MS = 180_000;
export const TOWN_MEAL_MS = 12_000;
export const TOWN_RACE_COUNTDOWN_MS = 3000;
export const TOWN_RIVAL_LAP_MS = 34_000;
export const TOWN_RACE_LIMIT_MS = 90_000;
export const TOWN_TRACK_START_ANGLE = Math.PI / 2;
export const TOWN_APPLE_REGROW_MS = 30_000;
export const TOWN_RIVAL_LANE = -1.4;
export const TOWN_CHECKPOINTS = 8;

/** Town actions follow the authored item, including editor rotation and scaling. */
export function townItems(world: AuthoredWorld, asset: string): WorldItem[] {
  return (world.items ?? []).filter(item => item.visible && item.asset === asset && item.scale.every(value => value > 0)
    && Math.abs(item.rotation[0]) < .001 && Math.abs(item.rotation[2]) < .001);
}
export function townPoint(item: WorldItem, x: number, z: number): [number, number] {
  const yaw = item.rotation[1] * Math.PI / 180, c = Math.cos(yaw), s = Math.sin(yaw);
  return [item.position[0] + x * item.scale[0] * c + z * item.scale[2] * s,
    item.position[2] - x * item.scale[0] * s + z * item.scale[2] * c];
}
export function trackPoint(item: WorldItem, angle: number, lane = 0): [number, number] {
  return townPoint(item, (24 + lane) * Math.cos(angle), (14 + lane) * Math.sin(angle));
}

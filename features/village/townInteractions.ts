import type { AuthoredWorld } from "./worldLayout";
import type { ForageInventory, SharedTown, TownAction } from "./townShared";
import { farmCrop, townItems, townPoint, trackPoint, TOWN_TRACK_START_ANGLE, TOWN_GROW_MS, TOWN_APPLE_REGROW_MS } from "./townShared";
import { layoutLocalPoint } from "./layoutTransforms";

export type TownContext = {
  title: string; detail: string;
  kind?: "race" | "farm" | "animal" | "owls" | "stable" | "orchard";
  nextGateDistance?: number;
  minorOnly?: boolean;
  growth?: { crop: string; readyAt: number | null; duration: number };
  actions: { label: string; key: string; request: TownAction; disabled?: boolean }[];
};

/** Nearby controls use the same saved asset anchors as the shared simulation. */
export class TownInteractions {
  constructor(private layout: AuthoredWorld) {}

  context(town: SharedTown | undefined, selfId: string, x: number, z: number, riding: string | null,
    nearbyHorse: string | null, hasFood: boolean, now: number, inventory: ForageInventory): TownContext | null {
    if (!town) return null;
    const near = (point: readonly number[], radius: number) => Math.hypot(point[0] - x, point[1] - z) < radius;
    const race = town.race;
    const raceActive = race?.phase === "countdown" || race?.phase === "racing";
    if (!riding && nearbyHorse && !(raceActive && race?.owner === selfId)) {
      const stable = townItems(this.layout, "horse-stable").find(item => near(townPoint(item, 0, -2), 7));
      if (stable) {
        const meal = town.hayFeeds.find(feed => feed.horseId === nearbyHorse && feed.until > now);
        return { kind: "stable", title: "The hay stable", detail: "",
          actions: [{ label: meal ? "Eating hay…" : "Feed hay", key: "F", request: { kind: "town", action: "hay", id: nearbyHorse }, disabled: !!meal }] };
      }
    }
    const track = townItems(this.layout, "horse-racetrack")[0];
    if (track && (riding && near(track.position.filter((_, i) => i !== 1), 33 * Math.max(track.scale[0], track.scale[2]))
      || near(trackPoint(track, TOWN_TRACK_START_ANGLE), 7) || raceActive && race?.owner === selfId)) {
      const mine = race?.owner === selfId;
      const active = race?.phase === "countdown" || race?.phase === "racing";
      const atStart = near(trackPoint(track, TOWN_TRACK_START_ANGLE), 6);
      const detail = active ? race.phase === "countdown" ? `Starting in ${Math.max(1, Math.ceil((race.goAt - now) / 1000))}…`
        : `${mine ? "Your race" : "Race in progress"} · checkpoint ${Math.min(8, race.nextCheckpoint)} / 8.`
        : race?.phase === "finished" ? `${race.result === "visitor" ? mine ? "You won!" : "The visitor won!" : race.result === "tie" ? "A tie!" : "Rowan won this lap."} ${race.playerFinishAt ? `Lap time: ${((race.playerFinishAt - race.goAt) / 1000).toFixed(1)}s.` : ""}`
        : "";
      const gate = race ? trackPoint(track, TOWN_TRACK_START_ANGLE + race.nextCheckpoint * Math.PI * 2 / 8) : null;
      return { title: "Rowan’s racetrack", detail, kind: "race", minorOnly: mine && !!race, nextGateDistance: gate ? Math.round(Math.hypot(gate[0] - x, gate[1] - z)) : undefined, actions: active ? mine ? [{ label: "Leave race", key: "F", request: { kind: "town", action: "raceCancel", id: track.id } }] : []
        : riding && atStart ? [{ label: "Race Rowan", key: "F", request: { kind: "town", action: "raceStart", id: track.id } }] : [] };
    }
    if (riding) return null;
    const animal = town.animals.map(animal => ({ animal, d: Math.hypot(animal.x - x, animal.z - z) }))
      .filter(value => value.d < (value.animal.species === "cow" ? 3.6 : 3.2)).sort((a, b) => a.d - b.d)[0]?.animal;
    if (animal) {
      const name = this.layout.items?.find(item => item.id === animal.id)?.name || { cow: "Highland cow", sheep: "Sheep", lamb: "Little lamb", hedgehog: "Hedgehog" }[animal.species];
      const petting = animal.mode === "pet" && animal.until > now;
      const eating = animal.mode === "apple" && animal.until > now;
      const travelling = animal.mode === "forage" || animal.mode === "return";
      const gift = animal.mode === "gift" && animal.carry;
      const busy = petting || eating || travelling;
      return { kind: "animal", title: name, detail: "",
        actions: [
          ...(gift ? [{ label: `Receive ${animal.carry}`, key: "E", request: { kind: "town" as const, action: "animalGift" as const, id: animal.id } }] : []),
          { label: eating ? `Enjoying ${animal.mealFood === "mushroom" ? "a mushroom" : "an apple"}…` : travelling ? "Foraging…" : petting ? "Being petted…" : `Pet ${name}`, key: gift ? "2" : "E", request: { kind: "town", action: "animalPet", id: animal.id }, disabled: busy },
          ...(animal.species === "cow" && inventory.apples > 0 ? [{ label: "Feed apple", key: "F", request: { kind: "town" as const, action: "animalApple" as const, id: animal.id }, disabled: busy }] : []),
          ...(animal.species === "cow" && inventory.mushrooms > 0 ? [{ label: "Feed mushroom", key: "3", request: { kind: "town" as const, action: "animalMushroom" as const, id: animal.id }, disabled: busy }] : []),
        ] };
    }
    const perch = townItems(this.layout, "owl-feeding-perch").find(item => near(townPoint(item, 0, 1.8), 4));
    if (perch) {
      const eating = town.owlUntil > now;
      return { kind: "owls", title: "The owl grove", detail: "",
        actions: [{ label: eating ? "Owls are eating…" : hasFood ? "Feed the owls" : "Take owl treats", key: "E", disabled: eating,
          request: { kind: "town", action: hasFood ? "owlFeed" : "owlFood", id: perch.id } }] };
    }
    const appleTree = townItems(this.layout, "apple-tree").find(item => near(townPoint(item, 0, 1.8), 3.5));
    if (appleTree) {
      const readyAt = (town.applePickedAt?.[appleTree.id] ?? -Infinity) + TOWN_APPLE_REGROW_MS;
      const waiting = readyAt > now;
      return { kind: "orchard", title: appleTree.name || "The apple tree", detail: waiting ? `Apple ready in ${Math.ceil((readyAt - now) / 1000)}s` : "",
        actions: [{ label: waiting ? "Apple growing…" : "Pick an apple", key: "E", request: { kind: "town", action: "applePick", id: appleTree.id }, disabled: waiting }] };
    }
    const bedItem = [...townItems(this.layout, "farm-row"), ...townItems(this.layout, "town-garden-bed")].map(item => {
      const [px, pz] = layoutLocalPoint(item, x, z, [0, 0, 0]);
      return { item, d: Math.hypot(Math.max(0, Math.abs(px) - (item.asset === "farm-row" ? 8 : 1.6)) * item.scale[0], Math.max(0, Math.abs(pz) - .6) * item.scale[2]) };
    })
      .filter(value => value.d < 2.4).sort((a, b) => a.d - b.d)[0]?.item;
    const bed = town.beds.find(value => value.id === bedItem?.id);
    if (!bed || !bedItem) return null;
    const request = (action: TownAction["action"], crop?: TownAction["crop"]): TownAction => ({ kind: "town", action, id: bed.id, ...(crop ? { crop } : {}) });
    const grown = bed.growAt !== null && now >= bed.growAt;
    const remaining = Math.max(0, Math.ceil(((bed.growAt ?? now) - now) / 1000));
    const required = farmCrop(bedItem);
    return { kind: "farm", title: bedItem.name || "Town farm",
      growth: bed.crop ? { crop: bed.crop, readyAt: bed.growAt, duration: TOWN_GROW_MS } : undefined,
      detail: bed.crop === null ? "" : grown ? "Ready to pick"
        : bed.wateredAt === null ? "Needs water" : `${bed.crop} growing · ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`,
      actions: bed.crop === null ? required ? [{ label: `Plant ${required === "carrot" ? "carrots" : required === "radish" ? "radishes" : "mint"}`, key: "E", request: request("gardenPlant", required) }] : [
        { label: "Plant carrots", key: "E", request: request("gardenPlant", "carrot") },
        { label: "Plant radishes", key: "2", request: request("gardenPlant", "radish") },
        { label: "Plant mint", key: "3", request: request("gardenPlant", "mint") },
      ] : grown ? [{ label: "Harvest", key: "E", request: request("gardenHarvest") }]
        : bed.wateredAt === null ? [{ label: "Water", key: "E", request: request("gardenWater") }] : [],
    };
  }
}

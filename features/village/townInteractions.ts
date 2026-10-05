import { villageName } from "./localization";
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
    nearbyHorse: string | null, hasFood: boolean, now: number, inventory: ForageInventory, language: "en" | "ja" = "en"): TownContext | null {
    const t = (en: string, ja: string) => language === "ja" ? ja : en;
    const crops = { carrot: t("carrots", "ニンジン"), radish: t("radishes", "ラディッシュ"), mint: t("mint", "ミント") };
    if (!town) return null;
    const near = (point: readonly number[], radius: number) => Math.hypot(point[0] - x, point[1] - z) < radius;
    const race = town.race;
    const raceActive = race?.phase === "countdown" || race?.phase === "racing";
    if (!riding && nearbyHorse && !(raceActive && race?.owner === selfId)) {
      const stable = townItems(this.layout, "horse-stable").find(item => near(townPoint(item, 0, -2), 7));
      if (stable) {
        const meal = town.hayFeeds.find(feed => feed.horseId === nearbyHorse && feed.until > now);
        return { kind: "stable", title: t("The hay stable", "馬小屋"), detail: "",
          actions: [{ label: meal ? t("Eating hay…", "干し草を食べています…") : t("Feed hay", "干し草をあげる"), key: "F", request: { kind: "town", action: "hay", id: nearbyHorse }, disabled: !!meal }] };
      }
    }
    const track = townItems(this.layout, "horse-racetrack")[0];
    if (track && race && (riding && near(track.position.filter((_, i) => i !== 1), 33 * Math.max(track.scale[0], track.scale[2]))
      || near(trackPoint(track, TOWN_TRACK_START_ANGLE), 7) || raceActive && race?.owner === selfId)) {
      const mine = race?.owner === selfId;
      const active = race?.phase === "countdown" || race?.phase === "racing";
      const detail = active ? race.phase === "countdown" ? t(`Starting in ${Math.max(1, Math.ceil((race.goAt - now) / 1000))}…`, `あと${Math.max(1, Math.ceil((race.goAt - now) / 1000))}秒でスタート…`)
        : t(`${mine ? "Your race" : "Race in progress"} · checkpoint ${Math.min(8, race.nextCheckpoint)} / 8.`, `${mine ? "あなたのレース" : "レース開催中"} · チェックポイント ${Math.min(8, race.nextCheckpoint)} / 8`)
        : race?.phase === "finished" ? `${race.result === "visitor" ? mine ? t("You won!", "あなたの勝ち！") : t("The visitor won!", "お客さんの勝ち！") : race.result === "tie" ? t("A tie!", "引き分け！") : t("Rowan won this lap.", "今回はローワンの勝ち。")} ${race.playerFinishAt ? t(`Lap time: ${((race.playerFinishAt - race.goAt) / 1000).toFixed(1)}s.`, `タイム：${((race.playerFinishAt - race.goAt) / 1000).toFixed(1)}秒`) : ""}`
        : "";
      const gate = race ? trackPoint(track, TOWN_TRACK_START_ANGLE + race.nextCheckpoint * Math.PI * 2 / 8) : null;
      return { title: t("Rowan’s racetrack", "ローワンの競走コース"), detail, kind: "race", minorOnly: mine && !!race, nextGateDistance: gate ? Math.round(Math.hypot(gate[0] - x, gate[1] - z)) : undefined, actions: active ? mine ? [{ label: t("Leave race", "レースをやめる"), key: "F", request: { kind: "town", action: "raceCancel", id: track.id } }] : []
        : [] };
    }
    if (riding) return null;
    const animal = town.animals.map(animal => ({ animal, d: Math.hypot(animal.x - x, animal.z - z) }))
      .filter(value => value.d < (value.animal.species === "cow" ? 3.6 : 3.2)).sort((a, b) => a.d - b.d)[0]?.animal;
    if (animal) {
      const originalName = this.layout.items?.find(item => item.id === animal.id)?.name || { cow: "Highland cow", sheep: "Sheep", lamb: "Little lamb", hedgehog: "Hedgehog" }[animal.species];
      const name = villageName(originalName, language);
      const petting = animal.mode === "pet" && animal.until > now;
      const eating = animal.mode === "apple" && animal.until > now;
      const travelling = animal.mode === "forage" || animal.mode === "return";
      const gift = animal.mode === "gift" && animal.carry;
      const busy = petting || eating || travelling;
      return { kind: "animal", title: name, detail: "",
        actions: [
          ...(gift ? [{ label: t(`Receive ${animal.carry}`, `${animal.carry === "apple" ? "リンゴ" : "キノコ"}を受け取る`), key: "E", request: { kind: "town" as const, action: "animalGift" as const, id: animal.id } }] : []),
          { label: eating ? t(`Enjoying ${animal.mealFood === "mushroom" ? "a mushroom" : "an apple"}…`, `${animal.mealFood === "mushroom" ? "キノコ" : "リンゴ"}を食べています…`) : travelling ? t("Foraging…", "食べ物を探しています…") : petting ? t("Being petted…", "なでてもらっています…") : t(`Pet ${name}`, `${name}をなでる`), key: gift ? "2" : "E", request: { kind: "town", action: "animalPet", id: animal.id }, disabled: busy },
          ...(animal.species === "cow" && inventory.apples > 0 ? [{ label: t("Feed apple", "リンゴをあげる"), key: "F", request: { kind: "town" as const, action: "animalApple" as const, id: animal.id }, disabled: busy }] : []),
          ...(animal.species === "cow" && inventory.mushrooms > 0 ? [{ label: t("Feed mushroom", "キノコをあげる"), key: "3", request: { kind: "town" as const, action: "animalMushroom" as const, id: animal.id }, disabled: busy }] : []),
        ] };
    }
    const perch = townItems(this.layout, "owl-feeding-perch").find(item => near(townPoint(item, 0, 1.8), 4));
    if (perch) {
      const eating = town.owlUntil > now;
      return { kind: "owls", title: t("The owl grove", "フクロウの木立"), detail: "",
        actions: [{ label: eating ? t("Owls are eating…", "フクロウたちが食事中です…") : hasFood ? t("Feed the owls", "フクロウに餌をあげる") : t("Take owl treats", "フクロウの餌をもらう"), key: "E", disabled: eating,
          request: { kind: "town", action: hasFood ? "owlFeed" : "owlFood", id: perch.id } }] };
    }
    const appleTree = townItems(this.layout, "apple-tree").find(item => near(townPoint(item, 0, 1.8), 3.5));
    if (appleTree) {
      const readyAt = (town.applePickedAt?.[appleTree.id] ?? -Infinity) + TOWN_APPLE_REGROW_MS;
      const waiting = readyAt > now;
      return { kind: "orchard", title: villageName(appleTree.name || "The apple tree", language), detail: waiting ? t(`Apple ready in ${Math.ceil((readyAt - now) / 1000)}s`, `あと${Math.ceil((readyAt - now) / 1000)}秒でリンゴが実ります`) : "",
        actions: [{ label: waiting ? t("Apple growing…", "リンゴが育っています…") : t("Pick an apple", "リンゴを摘む"), key: "E", request: { kind: "town", action: "applePick", id: appleTree.id }, disabled: waiting }] };
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
    const required = farmCrop(bedItem);
    const crop = required ?? bed.crop;
    const row = /-row-(\d+)$/.exec(bedItem.id)?.[1] ?? /\brow\s+(\d+)\b/i.exec(bedItem.name ?? "")?.[1];
    const title = bedItem.asset === "farm-row" && crop
      ? t(`${crop.charAt(0).toUpperCase() + crop.slice(1)} Farm${row ? ` - Row ${row}` : ""}`, `${crops[crop]}畑${row ? ` - ${row}列目` : ""}`)
      : villageName(bedItem.name || "Town farm", language);
    return { kind: "farm", title,
      growth: bed.crop ? { crop: bed.crop, readyAt: bed.growAt, duration: TOWN_GROW_MS } : undefined,
      detail: bed.crop !== null && !grown && bed.wateredAt === null ? t("Needs water", "水をあげましょう") : "",
      actions: bed.crop === null ? required ? [{ label: t(`Plant ${required === "carrot" ? "carrots" : required === "radish" ? "radishes" : "mint"}`, `${crops[required]}を植える`), key: "E", request: request("gardenPlant", required) }] : [
        { label: t("Plant carrots", "ニンジンを植える"), key: "E", request: request("gardenPlant", "carrot") },
        { label: t("Plant radishes", "ラディッシュを植える"), key: "2", request: request("gardenPlant", "radish") },
        { label: t("Plant mint", "ミントを植える"), key: "3", request: request("gardenPlant", "mint") },
      ] : grown ? [{ label: t("Harvest", "収穫する"), key: "E", request: request("gardenHarvest") }]
        : bed.wateredAt === null ? [{ label: t("Water", "水をあげる"), key: "E", request: request("gardenWater") }]
        : [{ label: t("Harvest", "収穫する"), key: "E", request: request("gardenHarvest"), disabled: true }],
    };
  }
}

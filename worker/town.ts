import type { AuthoredWorld, WorldItem } from "../features/village/worldLayout";
import type { InteractionResult, SharedActor } from "../features/village/sharedActors";
import { floorHeight, type Collider } from "../features/village/environment";
import { VillageMovement } from "../features/village/movement";
import { VillageNavigation } from "../features/village/navigation";
import { TOWN_CHECKPOINTS, TOWN_GROW_MS, TOWN_RACE_LIMIT_MS, TOWN_TRACK_START_ANGLE, TOWN_APPLE_REGROW_MS, readInventory, TOWN_MEAL_MS, TOWN_RACE_COUNTDOWN_MS, TOWN_RIVAL_LAP_MS, TOWN_RIVAL_LANE,
  farmCrop, townItems, townPoint, trackPoint, type SharedTown, type TownAction, type TownCrop, type TownAnimal, type ForageInventory } from "../features/village/townShared";

const animalAssets = { "cow-highland": "cow", "cow-highland-girl": "cow", sheep: "sheep", lamb: "lamb", hedgehog: "hedgehog" } as const;

type Visitor = { id: string; x: number; z: number; active?: boolean; lastSeen?: number; activity?: string | null;
  bench?: unknown; swing?: unknown; horse?: string | null; crumbPouch?: boolean; forageInventory?: ForageInventory };

/** Shared town tasks and their clocks live beside the existing actor simulation. */
export class TownSimulation {
  readonly state: SharedTown;
  private lastStepAt = 0;
  private navigation: VillageNavigation;
  private foragePaths = new Map<string, [number, number][]>();
  constructor(private world: AuthoredWorld, saved?: SharedTown, private colliders: Collider[] = []) {
    this.navigation = new VillageNavigation(colliders, world);
    this.state = {
      beds: [...townItems(world, "town-garden-bed"), ...townItems(world, "farm-row")].map((item, index) => {
        const bed = saved?.beds.find(bed => bed.id === item.id);
        if (bed) return { ...bed, crop: bed.crop ? farmCrop(item) ?? bed.crop : null };
        const crop = farmCrop(item) ?? (["carrot", "radish", "mint"] as const)[Math.floor(index / 5) % 3], row = Number(item.id.match(/-row-(\d+)$/)?.[1] ?? index % 5 + 1) - 1;
        const plantedAt = Date.now() - TOWN_GROW_MS;
        return item.asset === "farm-row" && row < 3 ? { id: item.id, crop, plantedAt,
          wateredAt: row < 2 ? plantedAt : null, growAt: row < 2 ? plantedAt + TOWN_GROW_MS : null }
          : { id: item.id, crop: null, plantedAt: null, wateredAt: null, growAt: null };
      }),
      harvest: saved?.harvest ? { ...saved.harvest } : { carrot: 0, radish: 0, mint: 0 },
      owlFeedAt: saved?.owlFeedAt ?? null, owlOwner: saved?.owlOwner ?? null, owlUntil: saved?.owlUntil ?? 0,
      hayFeeds: saved?.hayFeeds.map(meal => ({ ...meal })) ?? [],
      race: saved?.race ? { ...saved.race } : null, rival: null, applePickedAt: { ...saved?.applePickedAt },
      animals: Object.entries(animalAssets).flatMap(([asset, species]) => townItems(world, asset).map(item => {
        const animal = saved?.animals?.find(animal => animal.id === item.id && animal.species === species);
        return animal ? { ...animal, carry: animal.carry ?? null, forageSource: animal.forageSource ?? null, nextForageAt: animal.nextForageAt ?? 0 } : { id: item.id, species, x: item.position[0], y: item.position[1], z: item.position[2],
          heading: item.rotation[1] * Math.PI / 180, owner: null, mode: "graze" as const, startedAt: 0, until: 0,
          carry: null, forageSource: null, nextForageAt: 0 };
      })),
    };
    if (!townItems(world, "owl-feeding-perch").length) {
      this.state.owlFeedAt = null; this.state.owlOwner = null; this.state.owlUntil = 0;
    }
    if (this.state.race && !this.track(this.state.race.trackId)) this.state.race = null;
  }

  snapshot(): SharedTown {
    return { ...this.state, applePickedAt: { ...this.state.applePickedAt }, beds: this.state.beds.map(bed => ({ ...bed })), harvest: { ...this.state.harvest },
      animals: this.state.animals.map(animal => ({ ...animal })),
      hayFeeds: this.state.hayFeeds.map(meal => ({ ...meal })), race: this.state.race ? { ...this.state.race } : null,
      rival: this.state.rival ? { ...this.state.rival } : null };
  }
  track(id: string) { return townItems(this.world, "horse-racetrack").find(item => item.id === id); }
  private near(visitor: Visitor, point: [number, number], radius = 3.5) {
    return visitor.active !== false && !visitor.activity && !visitor.bench && !visitor.swing
      && Math.hypot(visitor.x - point[0], visitor.z - point[1]) <= radius;
  }
  feedingHorse(id: string, now: number) { return this.state.hayFeeds.some(meal => meal.horseId === id && meal.until > now); }
  countdownHorse(id: string, now: number) {
    const race = this.state.race;
    return !!race && race.horseId === id && race.phase === "countdown" && now < race.goAt;
  }
  releaseVisitor(id: string, now: number) {
    if (this.state.owlOwner === id) this.state.owlOwner = null;
    for (const meal of this.state.hayFeeds) if (meal.owner === id) meal.owner = null;
    for (const animal of this.state.animals) if (animal.owner === id) {
      animal.owner = null;
      if (animal.mode === "apple" && animal.until > now) continue;
      animal.mode = animal.carry ? "gift" : "graze"; animal.until = 0; animal.startedAt = now;
    }
    const race = this.state.race;
    if (race?.owner === id && ["countdown", "racing"].includes(race.phase)) {
      race.phase = "cancelled"; race.until = now + 8000; race.result = null;
    }
  }

  action(visitor: Visitor, request: TownAction, now: number, horses: SharedActor[]): InteractionResult {
    if (typeof request.id !== "string") return { ok: false, reason: "That town activity is unavailable." };
    const state = this.state;
    if (request.action === "raceCancel") {
      const race = state.race;
      if (!race || race.owner !== visitor.id || race.trackId !== request.id || !["countdown", "racing"].includes(race.phase))
        return { ok: false, reason: "You are not in this race." };
      this.releaseVisitor(visitor.id, now); return { ok: true };
    }
    if (request.action === "raceStart") {
      const track = this.track(request.id), horse = horses.find(horse => horse.owner === visitor.id && horse.mode === "ride");
      if (!track || !horse) return { ok: false, reason: "Mount a stable horse before racing." };
      if (state.race && ["countdown", "racing"].includes(state.race.phase))
        return { ok: false, reason: "A race is underway. Watch this lap, then join the next." };
      if (!this.near(visitor, trackPoint(track, TOWN_TRACK_START_ANGLE), 6)) return { ok: false, reason: "Ride to the track's starting ribbon." };
      state.race = { trackId: track.id, owner: visitor.id, horseId: horse.id, phase: "countdown", startedAt: now,
        goAt: now + TOWN_RACE_COUNTDOWN_MS, nextCheckpoint: 1, playerFinishAt: null, npcFinishAt: null, result: null,
        until: now + TOWN_RACE_COUNTDOWN_MS + TOWN_RACE_LIMIT_MS };
      return { ok: true };
    }
    if (visitor.horse) return { ok: false, reason: "Dismount before tending the town." };
    if (request.action === "applePick") {
      const tree = townItems(this.world, "apple-tree").find(item => item.id === request.id);
      if (!tree || !this.near(visitor, townPoint(tree, 0, 1.8))) return { ok: false, reason: "Come closer to the apple tree." };
      if (state.animals.some(animal => animal.species === "hedgehog" && animal.mode === "forage" && animal.forageSource === tree.id)
        || now < (state.applePickedAt?.[tree.id] ?? -Infinity) + TOWN_APPLE_REGROW_MS) return { ok: false, reason: "Let the next apple ripen first." };
      const inventory = readInventory(visitor.forageInventory);
      if (inventory.apples >= 9) return { ok: false, reason: "Your apple basket is full. Share one with a cow." };
      visitor.forageInventory = { ...inventory, apples: inventory.apples + 1 };
      state.applePickedAt ??= {}; state.applePickedAt[tree.id] = now;
      return { ok: true };
    }
    if (["animalPet", "animalGift", "animalApple", "animalMushroom"].includes(request.action)) {
      const animal = state.animals.find(animal => animal.id === request.id);
      if (!animal || !this.near(visitor, [animal.x, animal.z], animal.species === "cow" ? 3.6 : 3.2))
        return { ok: false, reason: "Come a little closer to this animal." };
      if (animal.owner || animal.until > now) return { ok: false, reason: animal.mode === "apple" ? "This cow is enjoying its apple. Let it finish."
        : animal.mode === "forage" ? "The hedgehog is gathering its little gift." : "This animal is enjoying another visitor's company." };
      if (request.action === "animalGift") {
        if (animal.species !== "hedgehog" || animal.mode !== "gift" || !animal.carry)
          return { ok: false, reason: "Let the hedgehog bring its little gift home first." };
        const inventory = visitor.forageInventory ?? { apples: 0, mushrooms: 0 }, food = animal.carry === "apple" ? "apples" : "mushrooms";
        if (inventory[food] >= 9) return { ok: false, reason: "Your little gift basket is full." };
        visitor.forageInventory = { ...inventory, [food]: inventory[food] + 1 };
        Object.assign(animal, { carry: null, mode: "graze", startedAt: now, until: 0, nextForageAt: now + 9000 });
        return { ok: true };
      }
      if (request.action === "animalApple" || request.action === "animalMushroom") {
        if (animal.species !== "cow" || animal.mode !== "graze") return { ok: false, reason: "Let this Highland cow finish first." };
        const inventory = readInventory(visitor.forageInventory), food = request.action === "animalApple" ? "apples" : "mushrooms";
        if (!inventory[food]) return { ok: false, reason: `Your basket has no ${food}. Pick an apple or receive a hedgehog gift first.` };
        visitor.forageInventory = { ...inventory, [food]: inventory[food] - 1 };
        Object.assign(animal, { owner: visitor.id, mode: "apple", mealFood: food === "apples" ? "apple" : "mushroom", startedAt: now, until: now + 8000,
          heading: Math.atan2(visitor.x - animal.x, visitor.z - animal.z) });
        return { ok: true };
      }
      if (["forage", "return", "apple"].includes(animal.mode)) return { ok: false, reason: "Let this animal finish its little adventure." };
      Object.assign(animal, { owner: visitor.id, mode: "pet", startedAt: now, until: now + 6000, heading: Math.atan2(visitor.x - animal.x, visitor.z - animal.z) });
      return { ok: true };
    }
    if (request.action === "hay") {
      const horse = horses.find(horse => horse.id === request.id);
      const stable = townItems(this.world, "horse-stable").find(item => this.near(visitor, townPoint(item, 0, -2), 7));
      if (!horse || !stable || !this.near(visitor, [horse.x, horse.z], 3.5)
        || Math.hypot(horse.x - stable.position[0], horse.z - stable.position[2]) > 9 * Math.max(stable.scale[0], stable.scale[2]))
        return { ok: false, reason: "Bring the horse close to its stable hay rack." };
      if (horse.owner || this.feedingHorse(horse.id, now)) return { ok: false, reason: "This horse is busy. Let it finish first." };
      state.hayFeeds = state.hayFeeds.filter(meal => meal.horseId !== horse.id);
      state.hayFeeds.push({ horseId: horse.id, owner: visitor.id, startedAt: now, until: now + TOWN_MEAL_MS });
      Object.assign(horse, { owner: visitor.id, mode: "hold", speed: 0, startedAt: now, until: now + TOWN_MEAL_MS });
      return { ok: true };
    }
    if (request.action === "owlFood" || request.action === "owlFeed") {
      const perch = townItems(this.world, "owl-feeding-perch").find(item => item.id === request.id);
      if (!perch || !this.near(visitor, townPoint(perch, 0, 1.8), 4))
        return { ok: false, reason: "Come closer to the owl feeding perch." };
      if (request.action === "owlFood") { visitor.crumbPouch = true; return { ok: true }; }
      if (state.owlUntil > now) return { ok: false, reason: "The owls are enjoying their meal. Give them a moment." };
      if (!visitor.crumbPouch) return { ok: false, reason: "Take a pouch of owl treats first." };
      visitor.crumbPouch = false; state.owlFeedAt = now; state.owlOwner = visitor.id; state.owlUntil = now + TOWN_MEAL_MS;
      return { ok: true };
    }
    const item = [...townItems(this.world, "town-garden-bed"), ...townItems(this.world, "farm-row")].find(item => item.id === request.id);
    const bed = state.beds.find(bed => bed.id === request.id);
    let nearby = !!item && this.near(visitor, townPoint(item, 0, 1.8));
    if (item?.asset === "farm-row") {
      const yaw = item.rotation[1] * Math.PI / 180, dx = visitor.x - item.position[0], dz = visitor.z - item.position[2];
      nearby = this.near(visitor, [visitor.x, visitor.z])
        && Math.hypot(Math.max(0, Math.abs(dx * Math.cos(yaw) - dz * Math.sin(yaw)) - 8 * item.scale[0]),
          Math.max(0, Math.abs(dx * Math.sin(yaw) + dz * Math.cos(yaw)) - .6 * item.scale[2])) <= 2.4;
    }
    if (!item || !bed || !nearby)
      return { ok: false, reason: "Come closer to this garden bed." };
    if (request.action === "gardenPlant") {
      const required = farmCrop(item);
      if (required && request.crop !== required) return { ok: false, reason: `This farm only grows ${required}.` };
      if (bed.crop || !["carrot", "radish", "mint"].includes(request.crop ?? ""))
        return { ok: false, reason: "Choose an empty bed and a crop." };
      Object.assign(bed, { crop: request.crop as TownCrop, plantedAt: now, wateredAt: null, growAt: null });
    } else if (request.action === "gardenWater") {
      if (!bed.crop || bed.wateredAt !== null) return { ok: false, reason: "This bed does not need water yet." };
      bed.wateredAt = now; bed.growAt = now + TOWN_GROW_MS;
    } else if (request.action === "gardenHarvest") {
      if (!bed.crop || bed.growAt === null || now < bed.growAt) return { ok: false, reason: "Let this crop finish growing." };
      const inventory = readInventory(visitor.forageInventory), crop = bed.crop === "carrot" ? "carrots" : bed.crop === "radish" ? "radishes" : "mint";
      if (inventory[crop] >= 9999) return { ok: false, reason: "Your harvest basket is full. Share some with Luma first." };
      visitor.forageInventory = { ...inventory, [crop]: inventory[crop] + 1 };
      state.harvest[bed.crop] = Math.min(9999, state.harvest[bed.crop] + 1);
      Object.assign(bed, { crop: null, plantedAt: null, wateredAt: null, growAt: null });
    } else return { ok: false, reason: "That town action is unavailable." };
    return { ok: true };
  }

  step(now: number, visitors: Visitor[], horses: SharedActor[]) {
    const delta = this.lastStepAt ? Math.min(.25, Math.max(0, (now - this.lastStepAt) / 1000)) : 0;
    this.lastStepAt = now;
    const present = new Map(visitors.filter(visitor => visitor.active !== false && now - (visitor.lastSeen ?? now) <= 10_000)
      .map(visitor => [visitor.id, visitor]));
    this.stepAnimals(now, present, delta);
    if (this.state.owlOwner && !present.has(this.state.owlOwner)) this.state.owlOwner = null;
    if (now >= this.state.owlUntil) this.state.owlOwner = null;
    for (const meal of this.state.hayFeeds) {
      const horse = horses.find(horse => horse.id === meal.horseId);
      if (meal.owner && !present.has(meal.owner)) meal.owner = null;
      if (horse?.mode === "hold" && (horse.until <= now || !meal.owner)) {
        Object.assign(horse, { owner: null, mode: "idle", speed: 0, until: 0 });
      }
    }
    this.state.hayFeeds = this.state.hayFeeds.filter(meal => now - meal.until < 60_000 && horses.some(horse => horse.id === meal.horseId));
    const race = this.state.race;
    const track = race ? this.track(race.trackId) : townItems(this.world, "horse-racetrack")[0];
    if (!track) { this.state.race = null; this.state.rival = null; return; }
    if (race && ["countdown", "racing"].includes(race.phase)) {
      const owner = present.get(race.owner), horse = horses.find(horse => horse.id === race.horseId);
      if (!owner || owner.activity || owner.bench || owner.swing || !horse || horse.owner !== race.owner || horse.mode !== "ride"
        || now >= race.until) this.releaseVisitor(race.owner, now);
      else if (now >= race.goAt) {
        race.phase = "racing";
        if (now >= race.goAt + TOWN_RIVAL_LAP_MS) race.npcFinishAt = race.goAt + TOWN_RIVAL_LAP_MS;
        const checkpoint = trackPoint(track, TOWN_TRACK_START_ANGLE + race.nextCheckpoint * Math.PI * 2 / TOWN_CHECKPOINTS);
        if (Math.hypot(horse.x - checkpoint[0], horse.z - checkpoint[1]) < 6.2 * Math.min(track.scale[0], track.scale[2])) {
          race.nextCheckpoint++;
          if (race.nextCheckpoint > TOWN_CHECKPOINTS) {
            const rivalFinish = race.goAt + TOWN_RIVAL_LAP_MS;
            race.playerFinishAt = now; race.npcFinishAt = now >= rivalFinish ? rivalFinish : null;
            race.result = Math.abs(now - rivalFinish) < 120 ? "tie" : now < rivalFinish ? "visitor" : "rival";
            race.phase = "finished"; race.until = now + 30_000;
          }
        }
      }
    }
    if (race?.phase === "finished" && now >= race.goAt + TOWN_RIVAL_LAP_MS) race.npcFinishAt = race.goAt + TOWN_RIVAL_LAP_MS;
    if (race && now >= race.until) this.state.race = null;
    if (!race || !["countdown", "racing", "finished"].includes(race.phase) || now >= race.goAt + TOWN_RIVAL_LAP_MS) {
      this.state.rival = null; return;
    }
    const moving = ["racing", "finished"].includes(race.phase) && now < race.goAt + TOWN_RIVAL_LAP_MS;
    const progress = race && ["racing", "finished"].includes(race.phase)
      ? Math.min(1, Math.max(0, (now - race.goAt) / TOWN_RIVAL_LAP_MS)) : 0;
    const angle = TOWN_TRACK_START_ANGLE + progress * Math.PI * 2, [x, z] = trackPoint(track, angle, TOWN_RIVAL_LANE);
    const next = trackPoint(track, angle + .001, TOWN_RIVAL_LANE);
    this.state.rival = { id: "race-rival", kind: "horse", x, y: floorHeight(x, z), z, heading: Math.atan2(next[0] - x, next[1] - z),
      speed: moving ? 5.2 : 0, owner: null, following: false, mode: moving ? "ride" : "idle", action: null,
      startedAt: race?.goAt ?? 0, until: 0, speech: null };
  }

  private stepAnimals(now: number, present: Map<string, Visitor>, delta: number) {
    for (const animal of this.state.animals) {
      const owner = animal.owner ? present.get(animal.owner) : undefined;
      if (animal.mode === "apple") {
        if (!owner || !this.near(owner, [animal.x, animal.z], 4.2)) animal.owner = null;
        if (now < animal.until) continue;
        animal.owner = null; animal.mode = "graze"; animal.until = 0; animal.startedAt = now;
      }
      if (animal.mode === "pet") {
        if (owner && this.near(owner, [animal.x, animal.z], animal.species === "cow" ? 4.2 : 3.8) && now < animal.until) {
          animal.heading = Math.atan2(owner.x - animal.x, owner.z - animal.z); continue;
        }
        animal.owner = null; animal.mode = animal.carry ? "gift" : "graze"; animal.until = 0; animal.startedAt = now;
      }
      const home = this.world.items?.find(item => item.id === animal.id && item.visible && item.asset in animalAssets);
      if (!home) continue;
      if (animal.species === "hedgehog" && this.forage(animal, home.position, now, delta)) continue;
      const seed = [...animal.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
      const phase = now / 7500 + seed, range = animal.species === "hedgehog" ? .25 : animal.species === "cow" ? 2.4 : 1.6;
      const target = townPoint(home, Math.sin(phase) * range, Math.sin(phase * .7) * range);
      // A short blend resumes grazing from the held position without a release jump.
      const blend = Math.min(1, Math.max(0, (now - animal.startedAt) / 2500));
      const dx = target[0] - animal.x, dz = target[1] - animal.z, distance = Math.hypot(dx, dz);
      const step = Math.min(distance, .72 * delta * blend);
      if (distance > .001) {
        const probe = new VillageMovement(this.colliders, () => {}); probe.settle(animal.x, animal.z);
        const x = animal.x + dx / distance * step, z = animal.z + dz / distance * step;
        if (probe.canWalkTo(x, z)) { animal.x = x; animal.z = z; }
        animal.heading += Math.atan2(Math.sin(Math.atan2(dx, dz) - animal.heading), Math.cos(Math.atan2(dx, dz) - animal.heading)) * Math.min(1, delta * 6);
      }
      animal.y = floorHeight(animal.x, animal.z) + home.position[1] - floorHeight(home.position[0], home.position[2]);
    }
  }

  private forage(animal: TownAnimal, home: [number, number, number], now: number, delta: number) {
    const sources = [...townItems(this.world, "apple-tree"), ...townItems(this.world, "mushroom-patch")]
      .filter(item => Math.hypot(item.position[0] - home[0], item.position[2] - home[2]) <= 12);
    if (animal.mode === "gift") return true;
    if (animal.mode === "graze" && now >= animal.nextForageAt && sources.length) {
      const last = sources.find(item => item.id === animal.forageSource);
      const available = sources.filter(item => item.asset !== "apple-tree" || now >= (this.state.applePickedAt?.[item.id] ?? -Infinity) + TOWN_APPLE_REGROW_MS)
        .filter(item => !this.state.animals.some(other => other.id !== animal.id && other.mode === "forage" && other.forageSource === item.id));
      let source: WorldItem | undefined, path: [number, number][] = [];
      const candidates = [...available.filter(item => item.asset !== last?.asset), ...available.filter(item => item.asset === last?.asset)];
      for (const candidate of candidates) {
        const target = townPoint(candidate, 0, candidate.asset === "apple-tree" ? 1.8 : .8);
        const route = this.navigation.path([animal.x, animal.z], target), end = route.at(-1);
        if (end && Math.hypot(end[0] - target[0], end[1] - target[1]) <= .2) { source = candidate; path = route; break; }
      }
      if (!source) { animal.nextForageAt = now + 10_000; return false; }
      this.foragePaths.set(animal.id, path);
      Object.assign(animal, { mode: "forage", forageSource: source.id, startedAt: now, until: 0 });
    }
    const source = sources.find(item => item.id === animal.forageSource);
    if (animal.mode === "forage") {
      if (!source) { animal.mode = "graze"; animal.until = 0; animal.nextForageAt = now + 9000; return false; }
      if (!animal.until) {
        if (this.walkForage(animal, townPoint(source, 0, source.asset === "apple-tree" ? 1.8 : .8), delta)) {
          animal.startedAt = now; animal.until = now + 1400;
        }
      } else if (now >= animal.until) {
        animal.carry = source.asset === "apple-tree" ? "apple" : "mushroom";
        if (source.asset === "apple-tree") { this.state.applePickedAt ??= {}; this.state.applePickedAt[source.id] = now; }
        animal.mode = "return"; animal.startedAt = now; animal.until = 0; this.foragePaths.delete(animal.id);
      }
    }
    if (animal.mode === "return" && this.walkForage(animal, [home[0], home[2]], delta)) {
      animal.mode = "gift"; animal.startedAt = now; animal.until = 0;
    }
    animal.y = floorHeight(animal.x, animal.z) + home[1] - floorHeight(home[0], home[2]);
    return ["forage", "return", "gift"].includes(animal.mode);
  }

  private walkForage(animal: TownAnimal, target: [number, number], delta: number) {
    let path = this.foragePaths.get(animal.id);
    if (!path) { path = this.navigation.path([animal.x, animal.z], target); this.foragePaths.set(animal.id, path); }
    while (path.length && Math.hypot(path[0][0] - animal.x, path[0][1] - animal.z) < .12) path.shift();
    if (!path.length) { this.foragePaths.delete(animal.id); return Math.hypot(target[0] - animal.x, target[1] - animal.z) < .2; }
    const [x, z] = path[0], dx = x - animal.x, dz = z - animal.z, distance = Math.hypot(dx, dz), step = Math.min(distance, 1.2 * delta);
    const probe = new VillageMovement(this.colliders, () => {}); probe.settle(animal.x, animal.z);
    const nx = animal.x + dx / distance * step, nz = animal.z + dz / distance * step;
    if (probe.canWalkTo(nx, nz)) { animal.x = nx; animal.z = nz; animal.heading += Math.atan2(Math.sin(Math.atan2(dx, dz) - animal.heading), Math.cos(Math.atan2(dx, dz) - animal.heading)) * Math.min(1, delta * 6); }
    else this.foragePaths.delete(animal.id);
    return false;
  }
}

export type Crop = "carrot" | "radish" | "mint";
export type GardenBed = { crop: Crop; stage: "empty" | "sprout" | "growing" | "grown"; wateredAt?: number };
export type GardenState = {
  beds: GardenBed[];
  mint: number;
  carrots: number;
  radishes: number;
  mintTea: number;
  crumbPouch: boolean;
};
export type GardenAction =
  | { kind: "plant"; bed: number; crop: Crop }
  | { kind: "water" | "harvest"; bed: number }
  | { kind: "gift"; crop: Crop }
  | { kind: "flowers" | "drink" | "crumbs" | "feed" };
export type GardenSound = "water" | "pluck" | "plant" | "pour" | "crumbs" | "splash" | "duck";

export const GARDEN_KEY = "cosy-village-garden-v1";
export const GROWTH_MS: Record<Crop, number> = { radish: 120_000, mint: 180_000, carrot: 300_000 };
export const CROP_NAMES = { carrot: { en: "Carrots", ja: "ニンジン" }, radish: { en: "Radishes", ja: "ラディッシュ" }, mint: { en: "Mint", ja: "ミント" } };
export const CROP_INVENTORY = { carrot: "carrots", radish: "radishes", mint: "mint" } as const;
export const HARVEST_COMPLIMENTS = {
  carrot: { en: "Luma: You grew this? What a lovely little carrot. You have such a gentle touch!", ja: "ルマ：育てたの？なんてかわいいニンジン。あなたの優しさが伝わるね！" },
  radish: { en: "Luma: A rosy little radish! You make this garden feel loved. Thank you.", ja: "ルマ：ばら色のラディッシュ！あなたのおかげで、庭が幸せそう。ありがとう。" },
  mint: { en: "Luma: It smells wonderful! You grew a little cup of happiness. This special mint tea is for you.", ja: "ルマ：いい香り！小さな幸せを育ててくれたね。特別なミントティーをどうぞ。" },
};
export const GARDEN = { x: 25, z: -7, width: 12, depth: 12 };
export const MINT_POSITION = [22.2, 0, -1] as const;
export const GARDEN_COURT = { left: 19.6, right: 31, back: -13.65, front: 1.05 };
export const BEDS = [
  { x: 22.2, z: -10 }, { x: 27.2, z: -10 },
  { x: 22.2, z: -5.5 }, { x: 27.2, z: -5.5 },
  { x: MINT_POSITION[0], z: MINT_POSITION[2] },
] as const;
export const MINT_BED = 4;
export const FLOWER_POSITION = [27.2, 0, -1] as const;
export const FEED_POSITION = [-23.2, .24, -5.5] as const;
export const GARDEN_TARGETS = [
  ...BEDS.map((bed, i) => ({ id: `bed-${i}`, x: bed.x, z: bed.z, radius: i === MINT_BED ? 2 : 2.7 })),
  { id: "flowers", x: FLOWER_POSITION[0], z: FLOWER_POSITION[2], radius: 2.4 },
  { id: "feed", x: FEED_POSITION[0], z: FEED_POSITION[2], radius: 2 },
  { id: "tea", x: 15.2, z: -10, radius: 2.5 },
];
export function growthProgress(bed: GardenBed, now = Date.now()) {
  return bed.stage === "grown" ? 1 : bed.stage === "growing" && bed.wateredAt !== undefined
    ? Math.max(0, Math.min(1, (now - bed.wateredAt) / GROWTH_MS[bed.crop])) : 0;
}
export function growthTimeLeft(bed: GardenBed, now = Date.now()) {
  const seconds = bed.stage === "growing" ? Math.ceil((1 - growthProgress(bed, now)) * GROWTH_MS[bed.crop] / 1000) : 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
/** Real-time growth has no expiry: absence can only leave a plant ready to pick. */
export function growGarden(state: GardenState, now = Date.now()): GardenState {
  if (!state.beds.some(bed => bed.stage === "growing" && growthProgress(bed, now) >= 1)) return state;
  return { ...state, beds: state.beds.map(bed => bed.stage === "growing" && growthProgress(bed, now) >= 1 ? { crop: bed.crop, stage: "grown" } : bed) };
}
export function nearbyGardenAction(id: string, state: GardenState): GardenAction | null {
  if (id.startsWith("bed-")) {
    const bed = Number(id.slice(4)), value = state.beds[bed];
    if (!value || value.stage === "growing") return null;
    return value.stage === "empty" ? { kind: "plant", bed, crop: value.crop } : { kind: value.stage === "sprout" ? "water" : "harvest", bed };
  }
  if (id === "flowers" || id === "feed") return { kind: id };
  if (id === "tea" && state.mintTea > 0) return { kind: "drink" };
  return null;
}
export const freshGarden = (): GardenState => ({
  beds: [
    { crop: "carrot", stage: "grown" }, { crop: "radish", stage: "grown" },
    { crop: "carrot", stage: "empty" }, { crop: "radish", stage: "empty" },
    { crop: "mint", stage: "sprout" },
  ], mint: 0, carrots: 0, radishes: 0, mintTea: 0, crumbPouch: false,
});

export function readGarden(raw: string | null, now = Date.now()): GardenState {
  const result = freshGarden();
  if (!raw) return result;
  try {
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return result;
    if (Array.isArray(saved.beds)) result.beds = result.beds.map((bed, i) => {
      const value = saved.beds[i];
      if (!value || !(i === MINT_BED ? value.crop === "mint" : ["carrot", "radish"].includes(value.crop))
        || !["empty", "sprout", "growing", "grown"].includes(value.stage)) return bed;
      if (value.stage === "growing") {
        // A malformed date restores an unwatered sprout, never an endless wait.
        return Number.isSafeInteger(value.wateredAt) && value.wateredAt >= 0
          ? { crop: value.crop, stage: "growing", wateredAt: Math.min(now, value.wateredAt) }
          : { crop: value.crop, stage: "sprout" };
      }
      return { crop: value.crop, stage: value.stage };
    });
    for (const key of ["mint", "carrots", "radishes", "mintTea"] as const) {
      if (Number.isSafeInteger(saved[key]) && saved[key] >= 0) result[key] = Math.min(saved[key], 9999);
    }
    result.crumbPouch = saved.crumbPouch === true;
  } catch { /* A damaged optional garden save does not affect notes or preferences. */ }
  return growGarden(result, now);
}

export function gardenActionAllowed(state: GardenState, action: GardenAction) {
  if (action.kind === "gift") return state[CROP_INVENTORY[action.crop]] > 0 && (action.crop !== "mint" || state.mintTea < 9999);
  if (action.kind === "drink") return state.mintTea > 0;
  if (action.kind === "feed") return state.crumbPouch;
  if (action.kind === "flowers" || action.kind === "crumbs") return true;
  if (!("bed" in action)) return false;
  const bed = state.beds[action.bed];
  return !!bed && (action.kind !== "plant" || (action.bed === MINT_BED ? action.crop === "mint" : action.crop !== "mint"))
    && bed.stage === (action.kind === "plant" ? "empty" : action.kind === "water" ? "sprout" : "grown");
}
export function gardenAction(state: GardenState, action: GardenAction, now = Date.now()): GardenState {
  state = growGarden(state, now);
  if (!gardenActionAllowed(state, action)) return state;
  if ("bed" in action) {
    const bed = state.beds[action.bed];
    const next: GardenBed = action.kind === "plant" ? { crop: action.crop, stage: "sprout" }
      : action.kind === "water" ? { crop: bed.crop, stage: "growing", wateredAt: now } : { crop: bed.crop, stage: "empty" };
    const beds = state.beds.map((value, i) => i === action.bed ? next : value);
    const inventory = CROP_INVENTORY[bed.crop];
    return { ...state, beds, [inventory]: Math.min(9999, state[inventory] + (action.kind === "harvest" ? 1 : 0)) };
  }
  if (action.kind === "gift") {
    const inventory = CROP_INVENTORY[action.crop];
    return { ...state, [inventory]: state[inventory] - 1, mintTea: state.mintTea + (action.crop === "mint" ? 1 : 0) };
  }
  if (action.kind === "drink") return { ...state, mintTea: state.mintTea - 1 };
  if (action.kind === "crumbs") return { ...state, crumbPouch: true };
  return state;
}

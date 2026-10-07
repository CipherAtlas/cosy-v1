import type { AuthoredWorld, WorldItem } from "./worldLayout";
import { townItems, townPoint, type ForageInventory } from "./townShared";

export const RECIPES = [
  { id: "gardenSoup", name: "Garden soup", japanese: "畑のスープ", icon: "🥣", ingredients: { carrots: 1, mushrooms: 1 } },
  { id: "crispSalad", name: "Mint & radish salad", japanese: "ミントとラディッシュのサラダ", icon: "🥗", ingredients: { radishes: 1, mint: 1 } },
  { id: "bakedApples", name: "Baked apples", japanese: "焼きリンゴ", icon: "🍎", ingredients: { apples: 1 } },
  { id: "roastRoots", name: "Roasted vegetables", japanese: "畑の焼き野菜", icon: "🥕", ingredients: { carrots: 1, radishes: 1 } },
] as const;
export type RecipeId = typeof RECIPES[number]["id"];
export type PicnicAction = { kind: "picnic"; action: "cook" | "pack" | "place" | "eat"; id: string; recipe?: RecipeId; dishId?: string };
export type PicnicCooking = { id: string; kitchen: string; owner: string; recipe: RecipeId; startedAt: number; readyAt: number };
export type PicnicDish = { id: string; mat: string; slot: number; recipe: RecipeId; portions: number; placedBy: string; placedAt: number };
export type SharedPicnic = { cooking: PicnicCooking[]; dishes: PicnicDish[]; bites: { visitor: string; recipe: RecipeId; at: number }[] };
export type PicnicContext = { id: string; kind: "kitchen" | "picnic"; dish?: PicnicDish; seatIndex?: number };
export const COOKING_MS = 4500;
export const PICNIC_SLOTS = 4;
export const EATING_MS = 1600;
export const MEAL_HEART_MS = 1400;
export const MEAL_FEEDBACK_MS = EATING_MS + MEAL_HEART_MS;
export function recipeById(id?: string) { return RECIPES.find(recipe => recipe.id === id); }
export function canCook(inventory: ForageInventory, id: RecipeId) {
  const recipe = recipeById(id)!;
  return Object.entries(recipe.ingredients).every(([key, count]) => (inventory[key as keyof ForageInventory] ?? 0) >= count);
}
export function picnicItems(world: AuthoredWorld) { return [...townItems(world, "garden-kitchen"), ...townItems(world, "picnic-mat")]; }
export function kitchenPoint(item: WorldItem) { return townPoint(item, 0, 1.9); }
export function dishPoint(item: WorldItem, slot: number) { return townPoint(item, -.9 + (slot % 2) * 1.8, -.8 + Math.floor(slot / 2) * 1.1); }
export function nearPicnic(world: AuthoredWorld, x: number, z: number, state?: SharedPicnic): PicnicContext | null {
  for (const item of picnicItems(world).sort((a, b) => Math.hypot(x - a.position[0], z - a.position[2]) - Math.hypot(x - b.position[0], z - b.position[2]))) {
    const [cx, cz] = item.asset === "garden-kitchen" ? kitchenPoint(item) : townPoint(item, 0, 0);
    if (Math.hypot(x - cx, z - cz) > (item.asset === "garden-kitchen" ? 3 : 4) * Math.max(item.scale[0], item.scale[2])) continue;
    const dish = state?.dishes.filter(dish => dish.mat === item.id).sort((a, b) => {
      const pa = dishPoint(item, a.slot), pb = dishPoint(item, b.slot);
      return Math.hypot(x - pa[0], z - pa[1]) - Math.hypot(x - pb[0], z - pb[1]);
    })[0];
    const point = dish && dishPoint(item, dish.slot);
    return { id: item.id, kind: item.asset === "garden-kitchen" ? "kitchen" : "picnic", dish: point && Math.hypot(x - point[0], z - point[1]) <= 4 * Math.max(item.scale[0], item.scale[2]) ? dish : undefined };
  }
  return null;
}

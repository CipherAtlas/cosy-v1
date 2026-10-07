import { canCook, COOKING_MS, PICNIC_SLOTS, MEAL_FEEDBACK_MS, recipeById, kitchenPoint, dishPoint, type PicnicAction, type SharedPicnic } from "../features/village/picnic";
import { readInventory, townItems, townPoint, type ForageInventory } from "../features/village/townShared";
import type { AuthoredWorld } from "../features/village/worldLayout";
import type { InteractionResult } from "../features/village/sharedActors";

type Visitor = { id: string; x: number; z: number; activity?: string | null; horse?: string | null; lookout?: number | null; inventoryToken?: string; forageInventory?: ForageInventory };
/** Private ingredients and public portions change together through the Worker's resource transaction. */
export class PicnicSimulation {
  state: SharedPicnic;
  tokens: Record<string, string>;
  constructor(private world: AuthoredWorld, saved?: { state: SharedPicnic; tokens: Record<string, string> }) {
    this.state = saved ? this.copyState(saved.state) : { cooking: [], dishes: [], bites: [] };
    this.tokens = { ...saved?.tokens };
  }
  private copyState(state: SharedPicnic) {
    return { cooking: state.cooking.map(job => ({ ...job })), dishes: state.dishes.map(dish => ({ ...dish })), bites: state.bites.map(bite => ({ ...bite })) };
  }
  save() { return { state: this.snapshot(), tokens: { ...this.tokens } }; }
  snapshot() { return this.copyState(this.state); }
  resume(token: string, owner: string) {
    for (const job of this.state.cooking) if (this.tokens[job.id] === token) job.owner = owner;
    for (const bite of this.state.bites) if (this.tokens[`bite:${bite.visitor}`] === token) {
      delete this.tokens[`bite:${bite.visitor}`]; bite.visitor = owner; this.tokens[`bite:${owner}`] = token;
    }
  }
  action(visitor: Visitor, request: PicnicAction, now: number): InteractionResult {
    const reject = (reason: string) => ({ ok: false, reason });
    if (visitor.activity || visitor.horse || visitor.lookout != null || !visitor.inventoryToken) return reject("Come here on foot to cook or share food.");
    const inventory = readInventory(visitor.forageInventory);
    const item = townItems(this.world, request.action === "cook" || request.action === "pack" ? "garden-kitchen" : "picnic-mat").find(item => item.id === request.id);
    if (!item) return reject("That kitchen or picnic mat is unavailable.");
    const [x, z] = item.asset === "garden-kitchen" ? kitchenPoint(item) : townPoint(item, 0, 0);
    if (Math.hypot(visitor.x - x, visitor.z - z) > (item.asset === "garden-kitchen" ? 3 : 4) * Math.max(item.scale[0], item.scale[2])) return reject("Come a little closer to the kitchen or picnic mat.");
    if (request.action === "cook") {
      const recipe = recipeById(request.recipe);
      if (!recipe) return reject("Choose a recipe from the kitchen.");
      if (this.state.cooking.some(job => this.tokens[job.id] === visitor.inventoryToken)) return reject("Pack your finished dish before making another.");
      if (this.state.cooking.some(job => job.kitchen === item.id && job.readyAt > now)) return reject("Someone is cooking. The stove will be free in a moment.");
      if (this.state.cooking.length >= 256) return reject("The kitchen has lots of dishes waiting to be packed. Try again later.");
      if (!canCook(inventory, recipe.id)) return reject("Gather the ingredients for this recipe first.");
      for (const [key, count] of Object.entries(recipe.ingredients)) inventory[key as keyof typeof inventory] -= count;
      const id = crypto.randomUUID();
      this.tokens[id] = visitor.inventoryToken;
      this.state.cooking.push({ id, kitchen: item.id, owner: visitor.id, recipe: recipe.id, startedAt: now, readyAt: now + COOKING_MS });
      visitor.forageInventory = inventory;
    } else if (request.action === "pack") {
      const job = this.state.cooking.find(job => this.tokens[job.id] === visitor.inventoryToken && job.kitchen === item.id);
      if (!job || job.readyAt > now) return reject("Your dish is still cooking.");
      if (inventory[job.recipe] >= 9999) return reject("Your basket is full of this dish. Share one first.");
      inventory[job.recipe]++; visitor.forageInventory = inventory;
      this.state.cooking = this.state.cooking.filter(value => value.id !== job.id); delete this.tokens[job.id];
    } else if (request.action === "place") {
      const recipe = recipeById(request.recipe);
      if (!recipe || inventory[recipe.id] < 1) return reject("Cook and pack this dish before sharing it.");
      const slot = Array.from({ length: PICNIC_SLOTS }, (_, i) => i).find(slot => !this.state.dishes.some(dish => dish.mat === item.id && dish.slot === slot));
      if (slot === undefined) return reject("The mat is full. Eat a dish to make room.");
      inventory[recipe.id]--; visitor.forageInventory = inventory;
      this.state.dishes.push({ id: crypto.randomUUID(), mat: item.id, slot, recipe: recipe.id, portions: 3, placedBy: visitor.id, placedAt: now });
    } else if (request.action === "eat") {
      const dish = this.state.dishes.find(dish => dish.mat === item.id && dish.id === request.dishId);
      if (!dish) return reject("That dish is finished.");
      const [dx, dz] = dishPoint(item, dish.slot);
      if (Math.hypot(visitor.x - dx, visitor.z - dz) > 4 * Math.max(item.scale[0], item.scale[2])) return reject("Come closer to that dish.");
      if (this.state.bites.some(bite => bite.visitor === visitor.id && now - bite.at < MEAL_FEEDBACK_MS)) return reject("Wait before eating another portion.");
      dish.portions--;
      this.state.dishes = this.state.dishes.filter(dish => dish.portions > 0);
      for (const bite of this.state.bites) if (now - bite.at >= MEAL_FEEDBACK_MS) delete this.tokens[`bite:${bite.visitor}`];
      this.state.bites = [...this.state.bites.filter(bite => now - bite.at < MEAL_FEEDBACK_MS), { visitor: visitor.id, recipe: dish.recipe, at: now }];
      this.tokens[`bite:${visitor.id}`] = visitor.inventoryToken;
    } else return reject("That picnic action is unavailable.");
    return { ok: true };
  }
}

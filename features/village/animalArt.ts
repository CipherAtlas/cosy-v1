import type { PlaceableAsset } from "./placeableAssets";
import { loadAnimalRigs, makeAnimalRig } from "./animalRig";

export const ANIMAL_ART = [
  ["horse-bay", "Bay horse · standing"], ["horse-grey", "Grey horse · standing"],
  ["highland-copper", "Copper Highland cow"], ["highland-flower", "Flower Highland cow"],
  ["dog-corgi", "Corgi · standing"], ["dog-shiba", "Shiba · standing"],
  ["dog-beagle", "Beagle · standing"], ["dog-samoyed", "Samoyed · standing"],
  ["dog-collie", "Border collie · standing"], ["dog-shepherd", "German shepherd · standing"],
  ["sheep", "Woolly meadow sheep"], ["lamb", "Woolly meadow lamb"],
  ["cat", "Cream & caramel cat · standing"], ["swan", "Ivory swan"],
  ["owl", "Tawny woodland owl · perched"], ["duck", "Cream duck"], ["duckling", "Golden duckling"],
] as const;

/** Placeable previews share the approved models and skeletons with the active animals. */
export async function loadAnimalArt(ids?: Set<string>) {
  const assets = new Map<string, PlaceableAsset>();
  const selected = ANIMAL_ART.filter(([slug]) => !ids || ids.has(`animal-${slug}`));
  await loadAnimalRigs(selected.map(([slug]) => slug));
  const templates = selected.map(([slug, name]) => ({ id: `animal-${slug}`, name, category: "Animals", template: makeAnimalRig(slug), shelf: true, solid: false }));
  for (const asset of templates) assets.set(asset.id, asset);
  return assets;
}

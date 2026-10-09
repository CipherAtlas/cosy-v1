import * as T from "three";
import { withBasePath } from "../../lib/basePath";
import { VillageLoading } from "./assetLoading";
import { disposeAssetModel, loadVillageEnvironment, loadVillageModel } from "./assetModels";
import { animalRigSlugsForLayout, disposeAnimalRig, loadAnimalRigs, makeAnimalRig } from "./animalRig";
import { loadVillageLayout, loadPlacedPuppies } from "./villageAssets";
import { loadTownAssetKit, TOWN_ASSET_IDS } from "./townAssets";
import { buildWorld } from "./world";

export async function loadVillageStartup(loading: VillageLoading, progress: (value: number) => void, renderer: T.WebGLRenderer) {
  const { signal } = loading;
  const layout = loadVillageLayout(signal);
  const animalRigs = layout.then(authored => loadAnimalRigs(animalRigSlugsForLayout(authored), signal));
  const sky = loading.track(loadVillageEnvironment(withBasePath("/village/textures/sunset.hdr"), signal), texture => texture.dispose()).catch(() => undefined);
  const [world, gltf, gardenKit, dove, puppyKit, placedCat, townKit] = await loading.wait(Promise.all([
    loading.track(layout.then(authored => buildWorld(progress, renderer, undefined, authored, signal)), world => world.dispose()),
    loading.track(loadVillageModel(withBasePath("/village/models/spirit.glb?v=3"), "Your village character", signal), disposeAssetModel),
    loading.track(loadVillageModel(withBasePath("/village/models/garden-pond.glb?v=2"), "The garden", signal), disposeAssetModel),
    loading.track(loadVillageModel(withBasePath("/village/models/dove.glb?v=1"), "The village birds", signal), disposeAssetModel),
    animalRigs.then(() => layout).then(authored => loadPlacedPuppies(authored, signal)),
    loading.track(animalRigs.then(() => layout).then(authored => authored.items?.some(item => item.visible && item.asset === "cottage-cat")
      ? makeAnimalRig("cat") : undefined), cat => { if (cat) disposeAnimalRig(cat); }),
    animalRigs.then(() => layout).then(authored => authored.items?.some(item => item.visible && TOWN_ASSET_IDS.includes(item.asset))
      ? loadTownAssetKit(signal) : undefined),
    animalRigs,
  ]));
  return { world, gltf, gardenKit, dove, puppyKit, placedCat, townKit, sky };
}

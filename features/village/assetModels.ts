import * as T from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { readVillageAsset } from "./assetLoading";

export function disposeAssetModel(model: { scene: T.Group }) {
  const resources = new Set<{ dispose: () => void }>();
  model.scene.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    resources.add(object.geometry);
    if (object instanceof T.SkinnedMesh) resources.add(object.skeleton);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      resources.add(material);
      for (const property of Object.values(material)) if (property instanceof T.Texture) resources.add(property);
    }
  });
  resources.forEach(resource => resource.dispose());
}

export function loadVillageModel(url: string, label: string, signal?: AbortSignal) {
  // All authored GLBs embed their buffers/textures; the base path also supports editor previews.
  return readVillageAsset<GLTF>(url, label, bytes => new GLTFLoader().parseAsync(bytes, url.slice(0, url.lastIndexOf("/") + 1)), {
    signal, abandon: disposeAssetModel,
  });
}

export function loadVillageEnvironment(url: string, signal?: AbortSignal) {
  // The sky is optional: keep directional lighting rather than hold entry on a slow HDR.
  return readVillageAsset(url, "The sky", bytes => new HDRLoader().createDataTexture(bytes), {
    signal, timeoutMs: 8000, stallMs: 5000, abandon: texture => texture.dispose(),
  });
}

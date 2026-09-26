import * as T from "three";

// Three r186 uses five randomly rotated PCF samples. A fixed weighted grid gives
// this slow, bright scene a smooth penumbra without screen-space grain.
const shadowChunk = T.ShaderChunk.shadowmap_pars_fragment.replace(
  /\/\/ Hardware PCF[\s\S]*?\) \* 0\.2;/,
  `vec2 texelSize = vec2(1.0) / shadowMapSize;
   shadow = 0.0;
   for (int y = 0; y < 4; y++) {
     for (int x = 0; x < 4; x++) {
       vec2 offset = vec2(float(x), float(y)) - 1.5;
       float weight = (2.5 - abs(offset.x)) * (2.5 - abs(offset.y));
       shadow += texture(shadowMap, vec3(shadowCoord.xy + offset * texelSize * shadowRadius / 1.5, shadowCoord.z)) * weight;
     }
   }
   shadow /= 36.0;`,
);

export function softenShadowEdges(root: T.Object3D) {
  const materials = new Set<T.Material>();
  root.traverse(object => {
    if (object instanceof T.Mesh && object.receiveShadow)
      (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m));
  });
  materials.forEach(material => {
    const compile = material.onBeforeCompile, cacheKey = material.customProgramCacheKey();
    material.onBeforeCompile = function(shader, renderer) {
      compile.call(this, shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace("#include <shadowmap_pars_fragment>", shadowChunk);
    };
    material.customProgramCacheKey = () => `${cacheKey}|village-tent-shadow-16`;
    material.needsUpdate = true;
  });
}

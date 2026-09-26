import { GRAPHICS_TIERS, graphicsPixelRatio } from './modules/features/village/graphics.js';

// Exercise the production engine's resize and frame paths, including a second downgrade.
export function checkGraphics(engine) {
  const results = [];
  const check = (condition, name) => { if (!condition) throw Error(name); results.push(name); };
  const host = engine.host, style = host.style.cssText, quality = engine.quality;
  const sample = (fps, age = 8000) => {
    const now = performance.now();
    engine.qualityChangedAt = now - age;
    engine.statsTime = now - 2100;
    engine.frameSum = 2 - 1 / fps;
    engine.frames = fps * 2 - 1;
    engine.lastTime = now - 1000 / fps;
    engine.frame(now);
  };
  try {
    for (const [width, height, dpr] of [[3840, 2160, 1], [2560, 1440, 2], [1920, 1080, 1], [390, 844, 3]]) {
      for (const tier of Object.keys(GRAPHICS_TIERS)) {
        const ratio = graphicsPixelRatio(tier, width, height, dpr);
        check(Math.floor(width * ratio) * Math.floor(height * ratio) <= GRAPHICS_TIERS[tier].pixels,
          `${tier} pixel budget at ${width}x${height}, DPR ${dpr}`);
      }
    }
    host.style.width = '3840px'; host.style.height = '2160px';
    engine.setQuality('low');
    check(engine.renderer.domElement.width * engine.renderer.domElement.height <= 1280 * 720, 'Battery mode caps the real 4K drawing buffer');
    engine.setQuality('auto');
    sample(15, 1000);
    check(engine.graphicsTier === 'detailed', 'Startup samples do not downgrade');
    sample(15);
    check(engine.graphicsTier === 'battery' && engine.quality === 'auto', 'First downgrade preserves Automatic');
    sample(15);
    check(engine.graphicsTier === 'minimal' && engine.quality === 'auto', 'Automatic can downgrade a second time');
    check(!engine.renderer.shadowMap.enabled, 'Minimum tier removes the live shadow pass');
    check(engine.renderer.domElement.width * engine.renderer.domElement.height <= 960 * 540, 'Minimum tier caps the real drawing buffer');
    sample(15);
    const gl = engine.renderer.getContext();
    check(gl.getError() === gl.NO_ERROR, 'Shadow-off frame has no stale shadow-sampler error');
    engine.setQuality('low'); sample(15);
    check(engine.graphicsTier === 'minimal' && engine.quality === 'low', 'Battery preference can adapt further');
    engine.setQuality('auto'); sample(35);
    check(engine.graphicsTier === 'detailed', 'One moderately slow sample does not downgrade');
    sample(60); sample(35);
    check(engine.graphicsTier === 'detailed', 'A healthy sample clears consecutive slow samples');
    sample(35);
    check(engine.graphicsTier === 'battery', 'Sustained sub-45 FPS lowers the tier');
    engine.setQuality('high'); sample(15); sample(15);
    check(engine.graphicsTier === 'detailed' && engine.renderer.shadowMap.enabled, 'Explicit Detailed restores shadows and stays selected');
    check(gl.getError() === gl.NO_ERROR, 'Restoring shadows has no WebGL error');
    check(engine.world.vegetation.every(mesh => mesh.count === mesh.userData.fullCount), 'Detailed restores full vegetation counts');
    engine.setQuality('auto'); sample(35); engine.onVisibility();
    check(engine.frames === 0 && engine.frameSum === 0 && engine.slowSamples === 0, 'Visibility change clears stale frame samples');
    const report = engine.getPerformanceReport();
    check(report.browser && report.gpu && report.drawingBuffer.length === 2 && report.preference === 'auto', 'Report identifies browser, renderer and actual resolution');
    return { passed: results.length, results };
  } finally {
    host.style.cssText = style;
    engine.setQuality(quality);
    engine.lastTime = 0;
  }
}

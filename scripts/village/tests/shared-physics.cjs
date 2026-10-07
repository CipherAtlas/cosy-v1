const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:3063');
    const physics = await page.evaluate(async () => {
      const { VillageEngine } = await import('/modules/features/village/VillageEngine.js');
      const engine = new VillageEngine(document.querySelector('#scene'), { progress: () => {}, ready: () => {}, near: () => {},
        interact: () => {}, error: message => { throw Error(message); }, stats: () => {}, movement: () => {}, contact: () => {}, environment: () => {} });
      await engine.load();
      const result = { colliders: engine.world.colliders, benches: engine.world.benches.map(({ id, x, z, facing, seatHeight, seatSpacing, seatCount }) => ({ id, x, z, facing, seatHeight, ...(seatSpacing === undefined ? {} : { seatSpacing }), ...(seatCount === undefined ? {} : { seatCount }) })) };
      engine.dispose(); return result;
    });
    physics.layoutHash = createHash('sha256').update(fs.readFileSync('public/village/world-layout.json')).digest('hex');
    if (process.argv.includes('--write')) fs.writeFileSync('worker/world-physics.json', JSON.stringify(physics, null, 2) + '\n');
    else assert.deepEqual(physics, JSON.parse(fs.readFileSync('worker/world-physics.json', 'utf8')), 'Worker collisions/bench catalog must match the rendering engine');
    console.log(`Worker/rendering parity: ${physics.colliders.length} colliders and ${physics.benches.length} benches.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

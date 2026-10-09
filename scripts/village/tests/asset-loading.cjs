const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const sourcePath = path.resolve(__dirname, '../../../features/village/assetLoading.ts');
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const instance = new Module(sourcePath); instance._compile(compiled, sourcePath);
const { readVillageAsset, sharedVillageAsset, VillageAssetLoadError, VillageLoading } = instance.exports;
let checks = 0;
const check = (value, label) => { assert(value, label); checks++; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function loadFixture(name, dependencies) {
  const filename = path.resolve(__dirname, `../../../features/village/${name}.ts`);
  const fixture = new Module(filename);
  fixture.require = name => { assert(name in dependencies, `Unexpected fixture dependency: ${name}`); return dependencies[name]; };
  fixture._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return fixture.exports;
}

async function run() {
  let requests = 0;
  global.fetch = async () => { requests++; return new Response('layout'); };
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(readVillageAsset('/layout', 'The layout', bytes => bytes, { signal: cancelled.signal }), { name: 'AbortError' });
  check(requests === 0, 'Already cancelled entry does not start a download');

  global.fetch = async () => new Response('missing', { status: 404 });
  await assert.rejects(readVillageAsset('/private-file', 'The layout', bytes => bytes), error => error instanceof VillageAssetLoadError
    && error.kind === 'unavailable' && !error.message.includes('/private-file'));
  checks++;
  global.fetch = async () => new Response('{bad');
  await assert.rejects(readVillageAsset('/layout', 'The layout', bytes => JSON.parse(new TextDecoder().decode(bytes))), { kind: 'unavailable' });
  checks++;

  global.fetch = (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  await assert.rejects(readVillageAsset('/stalled', 'The animals', bytes => bytes, { stallMs: 15, timeoutMs: 500 }), { kind: 'stalled' });
  checks++;

  let streamCancelled = false;
  global.fetch = async (_, { signal }) => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1]));
      signal.addEventListener('abort', () => { streamCancelled = true; controller.error(signal.reason); }, { once: true });
    },
  }));
  await assert.rejects(readVillageAsset('/stalled-body', 'The animals', bytes => bytes, { stallMs: 15, timeoutMs: 500 }), { kind: 'stalled' });
  check(streamCancelled, 'A stalled body aborts its actual request');

  global.fetch = async (_, { signal }) => new Response(new ReadableStream({
    start(controller) {
      const interval = setInterval(() => controller.enqueue(new Uint8Array([1])), 4);
      signal.addEventListener('abort', () => { clearInterval(interval); controller.error(signal.reason); }, { once: true });
    },
  }));
  await assert.rejects(readVillageAsset('/endless', 'The animals', bytes => bytes, { stallMs: 500, timeoutMs: 30 }), { kind: 'timeout' });
  checks++;

  global.fetch = async () => new Response('bytes');
  let finishDecode, discarded = false;
  const decode = new Promise(resolve => { finishDecode = resolve; });
  await assert.rejects(readVillageAsset('/model', 'The model', () => decode, {
    timeoutMs: 15, stallMs: 500, abandon: () => { discarded = true; },
  }), { kind: 'timeout' });
  finishDecode({}); await tick();
  check(discarded, 'A model decoded after cancellation is disposed instead of entering the scene');

  let finishShared, sharedSignal, starts = 0;
  const shared = sharedVillageAsset(signal => {
    starts++; sharedSignal = signal;
    return new Promise(resolve => { finishShared = resolve; });
  });
  const a = new AbortController(), b = new AbortController();
  const first = shared(a.signal), second = shared(b.signal); await tick();
  a.abort(); await assert.rejects(first, { name: 'AbortError' });
  check(!sharedSignal.aborted && starts === 1, 'One cancelled view keeps the other view’s shared request alive');
  finishShared('ready'); check(await second === 'ready' && await shared() === 'ready' && starts === 1, 'Successful assets are reused');

  const signals = [], resolvers = [];
  const retry = sharedVillageAsset(signal => {
    signals.push(signal); return new Promise(resolve => resolvers.push(resolve));
  });
  const owner = new AbortController(), abandoned = retry(owner.signal); await tick();
  owner.abort(); await assert.rejects(abandoned, { name: 'AbortError' });
  check(signals[0].aborted, 'No remaining consumers cancels the shared download');
  const next = retry(); await tick();
  resolvers[0]('stale'); resolvers[1]('fresh');
  check(await next === 'fresh' && await retry() === 'fresh' && signals.length === 2, 'Cancelled retry cannot poison or delete a newer cache entry');

  let attempts = 0;
  const failing = sharedVillageAsset(async () => { if (++attempts === 1) throw Error('missing'); return 'loaded'; });
  await assert.rejects(failing());
  check(await failing() === 'loaded' && attempts === 2, 'A failed request remains retryable');

  const scope = new VillageLoading(500);
  const adopted = {}, held = {};
  let disposed = 0, disposeLate = 0, finishWorld;
  await scope.track(Promise.resolve(adopted), () => disposed++); scope.adopt(adopted);
  await scope.track(Promise.resolve(held), () => disposed++);
  const lateWorld = scope.track(new Promise(resolve => { finishWorld = resolve; }), () => disposeLate++);
  const waitingWorld = scope.wait(lateWorld);
  scope.cancel(); await assert.rejects(waitingWorld, { name: 'AbortError' });
  check(disposed === 1, 'Failed startup cleans unadopted assets and leaves scene-owned assets alone');
  finishWorld({}); await assert.rejects(lateWorld, { name: 'AbortError' });
  check(disposeLate === 1, 'World construction finishing after failure is disposed exactly once');
  scope.cancel(); check(disposed === 1 && disposeLate === 1, 'Repeated disposal does not repeat startup cleanup');

  const boundedAssembly = new VillageLoading(15);
  await assert.rejects(boundedAssembly.wait(new Promise(() => {})), { kind: 'timeout' });
  check(boundedAssembly.signal.aborted, 'Whole startup includes a bounded barrier for asynchronous geometry preparation');
  const completed = new VillageLoading(500); completed.finish();
  check(!completed.signal.aborted, 'Ready village preserves the load signal for later lazy private assets');
  completed.cancel();

  const T = require('three');
  let ready, simplifications = 0;
  const simplifier = { supported: true, ready: new Promise(resolve => { ready = resolve; }),
    simplifyWithAttributes(indices) { simplifications++; return [indices.slice(0, Math.floor(indices.length / 6) * 3), 0]; } };
  const optimization = loadFixture('geometryOptimization', { three: T, './assetLoading': instance.exports,
    'three/addons/libs/meshopt_simplifier.module.js': { MeshoptSimplifier: simplifier } });
  const terrain = new T.PlaneGeometry(20, 20, 20, 20), originalIndices = terrain.index.array.slice();
  const terrainOwner = new AbortController(), terrainPreparation = optimization.optimizeGeometry(terrain, .00001, terrainOwner.signal);
  terrainOwner.abort(); await assert.rejects(terrainPreparation, { name: 'AbortError' });
  ready(); await tick();
  check(simplifications === 0 && terrain.index.array.every((value, index) => value === originalIndices[index]), 'Actual queued terrain optimization cannot resume or rewrite its buffer after cancellation');

  simplifier.ready = new Promise(resolve => { ready = resolve; });
  const vegetation = loadFixture('vegetationDetail', { three: T, './geometryOptimization': optimization });
  const plant = new T.PlaneGeometry(20, 20, 20, 20), mesh = new T.InstancedMesh(plant, new T.MeshStandardMaterial(), 1);
  let abandonedClones = 0;
  const clone = plant.clone.bind(plant);
  plant.clone = () => { const distant = clone(); distant.addEventListener('dispose', () => abandonedClones++); return distant; };
  const plantOwner = new AbortController(), plantPreparation = vegetation.registerPlantDetail([mesh], plantOwner.signal);
  plantOwner.abort(); await assert.rejects(plantPreparation, { name: 'AbortError' });
  ready(); await tick();
  check(abandonedClones === 1 && simplifications === 0, 'Actual pending plant LOD preparation disposes its cloned buffer exactly once on cancellation');

  simplifier.ready = Promise.resolve();
  await vegetation.registerPlantDetail([mesh]);
  mesh.setMatrixAt(0, new T.Matrix4()); mesh.computeBoundingSphere(); mesh.updateMatrixWorld();
  const detail = new vegetation.VegetationDetail([mesh]), camera = new T.PerspectiveCamera(); camera.position.z = 100;
  detail.update(camera);
  check(mesh.geometry !== plant && simplifications === 1, 'Successful plant preparation still installs its actual distant geometry');
  detail.dispose(); terrain.dispose(); plant.dispose(); mesh.dispose(); mesh.material.dispose();
  console.log(`${checks} asset timeout, stall, cancellation, disposal and retry checks passed.`);
}
run().catch(error => { console.error(error); process.exitCode = 1; });

// Real Durable Object storage, WebSockets and atomic ingredient/portion changes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createRequire } = require('node:module');
const tools = createRequire(path.resolve(process.env.TEST_TOOLS_ROOT, 'package.json'));
const { Miniflare } = tools('miniflare');
const esbuild = tools('esbuild');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cosy-picnic-worker-'));
let source = fs.readFileSync('worker/index.js', 'utf8').replaceAll('Date.now()', 'picnicNow()');
source += `
let offset = 0; const picnicNow = () => Date.now() + offset;
export class PicnicFixture extends VillageWorld {
 async fetch(request) {
  const route = new URL(request.url).pathname;
  if (route === '/test/tick') { const value = await request.json(); offset += value.ms;
   for (const socket of this.sockets()) { const visitor = socket.deserializeAttachment(); visitor.lastSeen = picnicNow(); socket.serializeAttachment(visitor); }
   this.publishWorld(picnicNow()); return Response.json(this.simulation.snapshot(picnicNow())); }
  if (route === '/test/ingredients') { const value = await request.json(); const socket = this.sockets().find(s => s.deserializeAttachment().id === value.id);
   const visitor = socket.deserializeAttachment(); this.restoreInventory(visitor); visitor.forageInventory = { ...visitor.forageInventory, carrots: 10, radishes: 10, mint: 10, mushrooms: 10, apples: 10 }; this.saveInventory(visitor); return Response.json({ ok: true }); }
  if (route === '/test/fail') { this.failWrite = true; return Response.json({ ok: true }); }
  return super.fetch(request);
 }
 persistResources(visitor, write) { return super.persistResources(visitor, () => { write(); if (this.failWrite) { this.failWrite = false; throw Error('injected storage failure'); } }); }
}
`;
const bundle = esbuild.buildSync({ stdin: { contents: source, resolveDir: path.resolve('worker'), sourcefile: 'index.js' }, bundle: true, write: false, format: 'esm', platform: 'neutral', external: ['cloudflare:workers'] }).outputFiles[0].text;
const mf = new Miniflare({ host: '127.0.0.1', port: 0, telemetry: { enabled: false }, resourcePersistencePath: temporary,
 workers: [{ config: { name: 'picnic-fixture', compatibilityDate: '2026-09-28', manifest: { mainModule: 'world.mjs', modules: { 'world.mjs': { type: 'esm', contents: bundle } } },
 env: { VILLAGE: { type: 'durable-object', worker: 'picnic-fixture', exportName: 'PicnicFixture' } }, exports: { PicnicFixture: { type: 'durable-object', storage: 'sqlite' } } } }] });
const clients = [], checks = [];
const mat = JSON.parse(fs.readFileSync('public/village/world-layout.json','utf8')).objects.find(item=>item.id==='picnic-hill-mat');
const [matX, matY, matZ] = mat.position;
const output = path.resolve(process.env.PICNIC_EVIDENCE_DIR || 'docs/village/evidence/picnic-20261007');
let stub, number = 0;
const check = (ok, label) => { assert(ok, label); checks.push(label); console.log(label); };
const control = async (route, body) => (await stub.fetch(`http://fixture.invalid/test/${route}`, { method: 'POST', body: JSON.stringify(body || {}) })).json();
const tick = ms => control('tick', { ms });
async function join(token) {
 const result = await mf.dispatchFetch('http://localhost/', { headers: { Upgrade: 'websocket', Origin: 'http://127.0.0.1:3051' } });
 assert.equal(result.status, 101); const socket = result.webSocket, messages = [];
 socket.addEventListener('message', event => messages.push(JSON.parse(event.data))); socket.accept();
 const wait = async predicate => { const until = Date.now() + 6000; while (!predicate()) { if (Date.now() > until) throw Error('WebSocket timeout'); await new Promise(r => setTimeout(r, 10)); } };
 await wait(() => messages.some(m => m.type === 'welcome')); const welcome = messages.find(m => m.type === 'welcome');
 const client = { socket, messages, wait, id: welcome.selfId, token: welcome.inventoryToken,
  inventory: () => messages.filter(m => m.type === 'forageInventory').at(-1)?.inventory || welcome.forageInventory,
  world: () => messages.filter(m => m.type === 'actors').at(-1)?.world || welcome.world };
 clients.push(client);
 if (token) { socket.send(JSON.stringify({ type: 'inventory_resume', token })); await wait(() => messages.some(m => m.type === 'forageInventory')); client.token = token; }
 return client;
}
async function action(client, request, x = 113, z = -76.1) {
 await tick(120); const requestId = `picnic-${++number}`;
 client.socket.send(JSON.stringify({ type: 'interaction', requestId, request, pose: { x, z, y: x < -90 ? matY : 0, heading: 0, active: true } }));
 await client.wait(() => client.messages.some(m => m.requestId === requestId)); return client.messages.find(m => m.requestId === requestId).result;
}
const request = (action, recipe, id = 'farm-kitchen', dishId) => ({ kind: 'picnic', action, recipe, id, dishId });
(async () => {
 await mf.ready; stub = (await mf.getDurableObjectNamespace('VILLAGE')).getByName('one-shared-village');
 if (process.env.PICNIC_BROWSER_ONLY === '1') { await require('./picnic-browser.cjs')({ workerUrl: String(await mf.ready).replace('http:', 'ws:'), control, tick }); return; }
 const a = await join(), b = await join();
 check(!(await action(a, request('cook', 'bakedApples'))).ok, 'Empty inventory cannot cook');
 await control('ingredients', { id: a.id }); await control('ingredients', { id: b.id });
 check(!(await action(a, request('cook', 'bakedApples'), 0, 0)).ok, 'Remote cooking is refused');
 check((await action(a, request('cook', 'gardenSoup'))).ok && a.inventory().carrots === 9 && a.inventory().mushrooms === 9, 'Cooking atomically consumes real ingredients');
 check(!(await action(b, request('cook', 'bakedApples'))).ok && b.inventory().apples === 10, 'Competing cook preserves their ingredients and original clock');
 check(!(await action(a, request('pack'))).ok && !a.inventory().gardenSoup, 'Unfinished dishes cannot be packed');
 const readyAt = a.world().picnic.cooking[0].readyAt;
 a.socket.close(); await new Promise(r => setTimeout(r, 50)); await tick(4600);
 const resumed = await join(a.token);
 check(resumed.inventory().carrots === 9, 'Consumed ingredients survive reconnect');
 const packed = await action(resumed, request('pack'));
 check(packed.ok && resumed.inventory().gardenSoup === 1, 'Accepted cooking survives disconnect and packs after reconnect');
 check(!(await action(resumed, request('pack'))).ok && resumed.inventory().gardenSoup === 1, 'Repeated packing cannot duplicate a dish');
 check((await action(resumed, request('place', 'gardenSoup', 'picnic-hill-mat'), matX, matZ)).ok && resumed.inventory().gardenSoup === 0, 'Sharing consumes one packed dish and creates three public portions');
 const dish = resumed.world().picnic.dishes[0];
 let late = await join(); check(late.world().picnic.dishes[0].id === dish.id && dish.portions === 3, 'Late join sees the same mat food and portion count');
 const eat = request('eat', undefined, 'picnic-hill-mat', dish.id);
 check(!(await action(b, eat, 0, 0)).ok && !b.world().picnic.bites.some(bite => bite.visitor === b.id), 'Remote eating is refused without granting an eating or heart clock');
 check((await action(b, eat, matX, matZ)).ok, 'Other visitors can eat a shared dish');
 const bBite = b.world().picnic.bites.find(bite => bite.visitor === b.id);
 check(bBite && resumed.world().picnic.bites.some(bite => bite.visitor === b.id && bite.at === bBite.at), 'Accepted eating broadcasts one shared animation clock to other visitors');
 check(!(await action(b, eat, matX, matZ)).ok && b.world().picnic.bites.find(bite => bite.visitor === b.id).at === bBite.at, 'Rejected repeated eating leaves the accepted animation clock unchanged');
 check((await action(late, eat, matX, matZ)).ok, 'A second visitor enjoys the next portion');
 const lateBite = late.world().picnic.bites.find(bite => bite.visitor === late.id), lateToken = late.token;
 await tick(1650);
 const mealObserver = await join();
 check(mealObserver.world().picnic.bites.some(bite => bite.visitor === late.id && bite.at === lateBite.at), 'A late join receives the accepted bite clock during its post-meal heart phase');
 late.socket.close(); await new Promise(r => setTimeout(r, 30)); late = await join(lateToken); await tick(120);
 check(late.world().picnic.bites.some(bite => bite.visitor === late.id && bite.at === lateBite.at), 'Reconnect resumes the accepted meal clock without restarting the eating animation');
 check(!(await action(late, eat, matX, matZ)).ok, 'Reconnect cannot bypass the three-second meal feedback cooldown');
 check((await action(resumed, eat, matX, matZ)).ok && !resumed.world().picnic.dishes.length, 'The final portion removes the dish for everybody');
 check(!(await action(late, eat, matX, matZ)).ok, 'Contested final portion cannot be duplicated');
 const fourth = await join(), fifth = await join(), sixth = await join();
 for (const index of [-1, 5, 1.5, '1', null, 100])
  check(!(await action(sixth, { kind: 'bench', id: 'picnic-hill-mat', index }, matX, matZ)).ok, `Malformed picnic cushion index ${JSON.stringify(index)} is refused`);
 const seats = [];
 for (const [index, client] of [resumed, b, late, fourth, fifth].entries()) {
  const result = await action(client, { kind: 'bench', id: 'picnic-hill-mat', index }, matX, matZ);
  check(result.ok && result.index === index, `Picnic cushion ${index + 1} claims its exact shared seat`); seats.push(result.index);
 }
 check(new Set(seats).size === 5, 'Five visitors reserve five distinct picnic cushions');
 check(!(await action(sixth, { kind: 'bench', id: 'picnic-hill-mat' }, matX, matZ)).ok, 'A sixth visitor is refused when all five cushions are full');
 check(!(await action(sixth, { kind: 'bench', id: 'picnic-hill-mat', index: 4 }, matX, matZ)).ok, 'A contested fifth cushion cannot be claimed twice');
 check((await action(resumed, { kind: 'leave' }, matX, matZ)).ok && (await action(sixth, { kind: 'bench', id: 'picnic-hill-mat', index: 0 }, matX, matZ)).ok, 'Standing releases the exact picnic cushion');
 b.socket.close(); await new Promise(r => setTimeout(r, 50));
 const replacement = await join();
 check((await action(replacement, { kind: 'bench', id: 'picnic-hill-mat', index: 1 }, matX, matZ)).ok, 'Disconnection releases the exact picnic cushion');
 const reconnected = await join(b.token);
 check(!(await action(reconnected, { kind: 'bench', id: 'picnic-hill-mat', index: 1 }, matX, matZ)).ok, 'Reconnection cannot displace the replacement cushion owner');
 await control('ingredients', { id: late.id }); await control('ingredients', { id: replacement.id });
 const focusA = await action(late, { kind: 'activity', id: 'focus' }, 0, 0), focusB = await action(replacement, { kind: 'activity', id: 'focus' }, 0, 0);
 check(focusA.ok && focusB.ok, 'Two visitors enter independent private focus while the picnic stays shared');
 check(late.world().picnic.dishes.length === 0 && !(await action(late, request('cook', 'bakedApples'))).ok && late.inventory().apples === 10, 'Private focus cannot cook outdoor food or spend ingredients');
 await action(resumed, { kind: 'leave' });
 await control('fail');
 const failed = await action(resumed, request('cook', 'bakedApples'));
 check(!failed.ok && resumed.inventory().apples === 10, 'Storage failure preserves ingredients');
 await tick(120); check(!resumed.world().picnic.cooking.length, 'Storage failure rolls back the public cooking order');
 check((await action(resumed, request('cook', 'bakedApples'))).ok, 'Cooking recovers after a failed atomic write');
 await tick(4600); await action(resumed, request('pack'));
 check(resumed.inventory().bakedApples === 1, 'Recovered order packs exactly once');
 check(!JSON.stringify(resumed.world()).includes(resumed.token) && readyAt > 0, 'Public snapshots never expose private inventory tokens');
 for (const recipe of ['crispSalad', 'roastRoots']) {
  check((await action(resumed, request('cook', recipe))).ok, `${recipe} accepts its real crop ingredients`);
  await tick(4600); check((await action(resumed, request('pack'))).ok && resumed.inventory()[recipe] === 1, `${recipe} packs into the persistent basket`);
 }
 for (const recipe of ['bakedApples', 'crispSalad', 'roastRoots']) check((await action(resumed, request('place', recipe, 'picnic-hill-mat'), matX, matZ)).ok, `${recipe} shares a distinct mat dish`);
 for (let i=0;i<2;i++) { await action(resumed, request('cook', 'bakedApples')); await tick(4600); await action(resumed, request('pack'));
  const placed = await action(resumed, request('place', 'bakedApples', 'picnic-hill-mat'), matX, matZ);
  check(i === 0 ? placed.ok : !placed.ok && resumed.inventory().bakedApples === 1, i === 0 ? 'The fourth serving uses the final real mat slot' : 'A full mat preserves the unplaced dish in the basket'); }
 fs.mkdirSync(output, { recursive: true });
 fs.writeFileSync(path.join(output,'worker.json'), JSON.stringify({ checks, limits: 'Local SQLite Durable Object/WebSockets; accelerated cooking clocks and test-only ingredients/storage-failure injection. No production deployment.' }, null, 2));
 console.log(`${checks.length} real Worker picnic checks passed.`);
 if (process.env.PICNIC_BROWSER === '1') await require('./picnic-browser.cjs')({ workerUrl: String(await mf.ready).replace('http:', 'ws:'), control, tick });
})().finally(async () => { clients.forEach(c => { try { c.socket.close(); } catch {} }); await mf.dispose(); fs.rmSync(temporary, { recursive: true, force: true }); }).catch(error => { console.error(error); process.exitCode = 1; });

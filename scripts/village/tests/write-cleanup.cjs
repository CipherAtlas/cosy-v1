const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const garden = require('../../../features/village/garden.ts');
const { VillageSimulation } = require('../../../worker/simulation.ts');
const { ACTIVITY_STAGES } = require('../../../features/village/sharedActors.ts');
const HOUR = 3_600_000;
let now = 100 * HOUR + 1000;
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const source = fs.readFileSync('worker/index.js', 'utf8').replace(/^import .*;\n/gm, '')
  .replace('export class VillageWorld', 'class VillageWorld').replace('export default {', 'const workerDefault = {');
const mod = { exports: {} };
vm.runInNewContext(`${fs.readFileSync('worker/worldClock.js', 'utf8').replace('export class SharedWorldClock', 'class SharedWorldClock')}\n${source}\nmodule.exports = VillageWorld;`, {
  setTimeout: () => 1, clearTimeout: () => {},
  module: mod, crypto: webcrypto, URL, Request, Response, TextEncoder, Uint8Array,
  Date: class extends Date { static now() { return now; } },
  DurableObject: class { constructor(ctx) { this.ctx = ctx; } }, VillageSimulation, ACTIVITY_STAGES,
  ...garden,
  readGarden: raw => garden.readGarden(raw, now), growGarden: state => garden.growGarden(state, now),
  gardenAction: (state, action) => garden.gardenAction(state, action, now),
});
const World = mod.exports;
const checks = [];
const check = (value, label) => { assert(value, label); checks.push(label); };
function fixture({ savedGarden = garden.freshGarden(), savedChat = { hour: Math.floor(now / HOUR), entries: [] }, alarm = null } = {}) {
  const records = new Map();
  if (savedGarden !== null) records.set('garden', clone(savedGarden));
  if (savedChat !== null) records.set('chat', clone(savedChat));
  const writes = [], alarmWrites = [], sockets = [];
  const storage = {
    alarmAt: alarm, failKey: null, failAlarm: false, failRead: false,
    transactionSync(callback) {
      const previous = new Map(records), writeCount = writes.length;
      try { return callback(); }
      catch (error) { records.clear(); for (const [key, value] of previous) records.set(key, value); writes.splice(writeCount); throw error; }
    },
    kv: {
      get: key => clone(records.get(key)),
      put: (key, value) => {
        if (storage.failKey === key) { storage.failKey = null; throw new Error(`failed put: ${key}`); }
        writes.push({ key, value: clone(value) }); records.set(key, clone(value));
      },
    },
    async getAlarm() { if (this.failRead) { this.failRead = false; throw new Error('failed alarm read'); } return this.alarmAt; },
    async setAlarm(at) { if (this.failAlarm) { this.failAlarm = false; throw new Error('failed alarm write'); } this.alarmAt = at; alarmWrites.push(at); },
  };
  const ctx = { storage, getWebSockets: () => sockets };
  const result = { records, writes, alarmWrites, storage, ctx, sockets, world: new World(ctx),
    count: key => writes.filter(write => write.key === key).length,
    reopen() { this.world = new World(ctx); return this.world; },
    socket(id = 'visitor') {
      const socket = {
        visitor: { id, name: id, slot: sockets.length + 1, x: 0, z: 0, heading: 0, lastChat: 0, lastSeen: now, active: true, crumbPouch: false }, messages: [],
        send(raw) { this.messages.push(JSON.parse(raw)); },
        serializeAttachment(value) { this.visitor = clone(value); }, deserializeAttachment() { return clone(this.visitor); }, close() {},
      };
      sockets.push(socket); return socket;
    },
    poll(method = 'GET', headers = {}) { return this.world.fetch(new Request('https://fixture.invalid/admin/chat', { method, headers })); },
    send(socket, message) { socket.visitor.lastSeen = now; return this.world.webSocketMessage(socket, JSON.stringify(message)); },
    action(socket, action) { return this.send(socket, { type: 'garden', action }); },
  };
  return result;
}
(async () => {
  const f = fixture();
  const observer = f.socket();
  // Two unchanged five-second polling sources, simulated for one complete day.
  const start = 100 * HOUR;
  for (let second = 0; second < 86400; second += 5) {
    now = start + second * 1000;
    assert.equal((await f.poll()).status, 200);
    assert.equal((await f.poll()).status, 200);
  }
  check(f.alarmWrites.length === 24, '34,560 same/next-hour admin polls schedule exactly 24 hourly alarms');
  check(f.count('chat') === 23, 'Polling only persists the 23 elapsed chat-hour changes');
  check(f.count('sharedActors') === 0 && f.count('garden') === 0, 'Admin polling does not touch world/garden writes');
  const alarmCount = f.alarmWrites.length;
  f.reopen(); await f.poll();
  check(f.alarmWrites.length === alarmCount, 'Reconstruction reads the persisted matching alarm without rewriting');
  for (const alarm of [null, now - HOUR, now + 2 * HOUR]) {
    f.storage.alarmAt = alarm; await f.poll();
    assert.equal(f.storage.alarmAt, (Math.floor(now / HOUR) + 1) * HOUR);
  }
  check(f.alarmWrites.length === alarmCount + 3, 'Missing, overdue and wrong future alarms are repaired');
  const beforeReset = observer.messages.length;
  now = 124 * HOUR + 1; f.storage.alarmAt = null; f.sockets.length = 0;
  await f.world.alarm();
  check(f.records.get('chat').hour === 124 && f.storage.alarmAt === 125 * HOUR, 'Consumed alarm resets the hour with no connected visitors and schedules its successor');
  await f.world.alarm();
  check(f.alarmWrites.length === alarmCount + 4, 'Duplicate alarm delivery with a correct successor does not rewrite it');
  f.storage.alarmAt = null; await f.world.alarm({ retryCount: 1, isRetry: true });
  check(f.alarmWrites.length === alarmCount + 5 && f.count('chat') === 24, 'A retry repairs an absent alarm without clearing the same hour twice');
  check(observer.messages.length === beforeReset, 'No-visitor alarm emits no stale socket messages');
  f.storage.alarmAt = null; f.storage.failAlarm = true;
  await assert.rejects(f.world.alarm(), /failed alarm write/);
  await f.world.alarm();
  check(f.storage.alarmAt === 125 * HOUR, 'Scheduling failure is awaited/propagated and a retry can restore the alarm');
  f.storage.failRead = true;
  await assert.rejects(f.poll(), /failed alarm read/);
  await f.poll();
  check(f.records.get('chat').hour === 124, 'A failed alarm read is surfaced and later requests recover');
  // The hour must be sampled after an asynchronous alarm read.
  now = 125 * HOUR - 1;
  const crossing = fixture({ alarm: 125 * HOUR });
  crossing.storage.getAlarm = async () => { now = 125 * HOUR + 1; return 125 * HOUR; };
  await crossing.poll();
  check(crossing.world.chatHour === 125 && crossing.storage.alarmAt === 126 * HOUR, 'Hour boundary during getAlarm does not leave a stale chat hour or past alarm');

  const chat = fixture({ alarm: 126 * HOUR }); const chatter = chat.socket();
  for (let i = 0; i < 4; i++) await chat.poll('DELETE', { 'If-Match': '"125"' });
  check(chat.count('chat') === 0, 'Repeated empty chat clears skip all identical KV writes');
  check(chatter.messages.length === 8 && chatter.messages.every((m, i) => m.type === (i % 2 ? 'chat_sync' : 'hour')), 'Empty clear still broadcasts both legacy reset and current chat sync events');
  now += 3001; await chat.send(chatter, { type: 'chat', message: 'Synthetic message' });
  const id = chat.records.get('chat').entries[0].messageId;
  check(chat.count('chat') === 1 && !!id, 'A new chat message still persists and receives a stable ID');
  assert.equal((await chat.poll('DELETE', { 'If-Match': '"124"' })).status, 409);
  check(chat.count('chat') === 1 && chat.world.chat.length === 1, 'A stale clear version neither writes nor removes a message');
  await chat.world.fetch(new Request(`https://fixture.invalid/admin/chat/${id}`, { method: 'DELETE' }));
  check(chat.count('chat') === 2 && chat.reopen().chat.length === 0, 'In-place message removal persists despite the immutable prior-value baseline');
  assert.equal((await chat.world.fetch(new Request(`https://fixture.invalid/admin/chat/${id}`, { method: 'DELETE' }))).status, 404);
  await chat.poll('DELETE', { 'If-Match': '"125"' });
  check(chat.count('chat') === 2, 'Missing message removal and already-empty clear add no writes');
  const legacy = fixture({ savedChat: { hour: 125, entries: [{ name: 'Old visitor', message: 'Synthetic old format' }] } });
  const legacyId = legacy.records.get('chat').entries[0].messageId;
  check(legacy.count('chat') === 1 && legacy.reopen().chat[0].messageId === legacyId && legacy.count('chat') === 1, 'Legacy message-ID migration writes once and survives reconstruction');
  const absent = fixture({ savedGarden: null, savedChat: null }); await absent.poll();
  check(absent.count('chat') === 1, 'An absent chat record is initialized rather than treated as already persisted');

  const g = fixture(); const gardener = g.socket();
  const flowers = garden.GARDEN_TARGETS.find(target => target.id === 'flowers');
  gardener.visitor.x = flowers.x; gardener.visitor.z = flowers.z;
  for (let i = 0; i < 10; i++) { now += 120; await g.action(gardener, { kind: 'flowers' }); }
  check(g.count('garden') === 0, 'Ten unchanged flower actions skip ten garden writes');
  check(g.count('sharedActors') === 10 && gardener.messages.filter(m => m.type === 'garden').length === 10, 'No-op garden actions retain every action event and authoritative world snapshot write');
  const pouch = g.world.simulation.authored.crumbPouches[0];
  gardener.visitor.x = pouch.x; gardener.visitor.z = pouch.z;
  now += 120; await g.action(gardener, { kind: 'crumbs' });
  check(gardener.visitor.crumbPouch && gardener.messages.some(m => m.type === 'crumbs' && m.hasCrumbs), 'No-op persistent garden value still grants crumbs to the socket attachment');
  const feed = garden.GARDEN_TARGETS.find(target => target.id === 'feed');
  gardener.visitor.x = feed.x; gardener.visitor.z = feed.z;
  now += 120; await g.action(gardener, { kind: 'feed' });
  const fedAt = now;
  check(g.count('garden') === 0 && g.records.get('sharedActors').pondFeedAt === fedAt, 'Feeding retains the durable shared meal clock while skipping unchanged garden storage');
  g.reopen(); now += 120; await g.action(gardener, { kind: 'feed' });
  check(gardener.messages.at(-1).type === 'action_rejected' && g.records.get('sharedActors').pondFeedAt === fedAt, 'Reconstructed shared meal refuses a competing early restart');
  gardener.visitor.activity = 'garden';
  const initialWrites = g.count('garden');
  now += 120; await g.action(gardener, { kind: 'harvest', bed: 0 });
  check(g.count('garden') === initialWrites + 1 && g.records.get('garden').carrots === 0 && gardener.visitor.forageInventory.carrots === 1, 'Harvest persists public bed changes and the accepted private crop together');
  await g.action(gardener, { kind: 'harvest', bed: 0 });
  check(g.count('garden') === initialWrites + 1 && g.records.get('garden').carrots === 0 && gardener.visitor.forageInventory.carrots === 1, 'Duplicate harvest cannot create another crop or redundant garden write');
  await g.action(gardener, { kind: 'plant', bed: 0, crop: 'carrot' });
  await g.action(gardener, { kind: 'water', bed: 0 });
  check(g.count('garden') === initialWrites + 3 && g.records.get('garden').beds[0].wateredAt === now, 'Plant/water transitions and watering timestamp persist');
  const grownState = clone(g.records.get('garden')); now += garden.GROWTH_MS.carrot + 1;
  const growth = fixture({ savedGarden: grownState }); const grower = growth.socket();
  grower.visitor.x = flowers.x; grower.visitor.z = flowers.z;
  await growth.action(grower, { kind: 'flowers' });
  check(growth.count('garden') === 1 && growth.records.get('garden').beds[0].stage === 'grown', 'Constructor-applied growth is compared against raw persisted state and saved by an otherwise no-op action');
  const repaired = fixture({ savedGarden: { beds: [], carrots: -50 } }); const repairer = repaired.socket();
  repairer.visitor.x = flowers.x; repairer.visitor.z = flowers.z;
  await repaired.action(repairer, { kind: 'flowers' });
  check(repaired.count('garden') === 1 && repaired.records.get('garden').carrots === 0 && repaired.records.get('garden').beds.length === 7, 'Normalization repairs are not incorrectly suppressed');
  const absentGrower = absent.socket(); absentGrower.visitor.x = flowers.x; absentGrower.visitor.z = flowers.z;
  await absent.action(absentGrower, { kind: 'flowers' });
  check(absent.count('garden') === 1, 'A missing garden is persisted on the first accepted action');

  const failure = fixture(); const subject = failure.socket(); subject.visitor.activity = 'garden';
  failure.storage.failKey = 'garden';
  await assert.rejects(failure.action(subject, { kind: 'harvest', bed: 0 }), /failed put: garden/);
  check(!subject.messages.some(m => m.type === 'garden') && failure.records.get('garden').carrots === 0, 'A synchronous garden-write failure emits no garden acceptance and preserves durable inventory');
  failure.reopen(); await failure.action(subject, { kind: 'harvest', bed: 0 });
  check(failure.records.get('garden').carrots === 0 && subject.visitor.forageInventory.carrots === 1, 'Reconstruction after a failed garden write permits one durable harvest');
  const privateFailure = fixture(), privateSubject = privateFailure.socket(); privateSubject.visitor.activity = 'garden';
  privateFailure.storage.failKey = 'visitorInventories';
  await assert.rejects(privateFailure.action(privateSubject, { kind: 'harvest', bed: 0 }), /failed put: visitorInventories/);
  check(privateFailure.records.get('garden').beds[0].stage === 'grown' && !privateFailure.records.has('visitorInventories')
    && !privateSubject.messages.some(m => m.type === 'garden' || m.type === 'forageInventory'),
    'Private inventory failure rolls back the public bed and emits neither acceptance');
  await privateFailure.action(privateSubject, { kind: 'harvest', bed: 0 });
  check(privateSubject.visitor.forageInventory.carrots === 1 && privateFailure.count('garden') === 1,
    'The same Worker can retry a rolled-back garden grant once without a stale write baseline');
  for (const failedKey of ['sharedActors', 'visitorInventories']) {
    const townFailure = fixture(), farmer = townFailure.socket();
    const row = townFailure.world.simulation.authored.items.find(item => item.visible && item.asset === 'farm-row');
    const rowBed = townFailure.world.simulation.town.state.beds.find(bed => bed.id === row.id);
    Object.assign(rowBed, { crop: 'mint', plantedAt: now - 180000, wateredAt: now - 180000, growAt: now - 1 });
    townFailure.records.set('sharedActors', clone(townFailure.world.simulation.save()));
    farmer.visitor.x = row.position[0] + 7.6; farmer.visitor.z = row.position[2] + 1.8;
    townFailure.storage.failKey = failedKey;
    const request = { type: 'interaction', requestId: `rollback-${failedKey}`, request: { kind: 'town', action: 'gardenHarvest', id: row.id } };
    now += 120; await assert.rejects(townFailure.send(farmer, request), new RegExp(`failed put: ${failedKey}`));
    check(townFailure.records.get('sharedActors').town.beds.find(bed => bed.id === row.id).crop === 'mint'
      && !townFailure.records.has('visitorInventories') && !farmer.messages.some(m => m.type === 'forageInventory' || m.type === 'interaction_result'),
      `Town ${failedKey} failure preserves the shared crop and cannot grant a private item`);
    now += 120; await townFailure.send(farmer, { ...request, requestId: `${request.requestId}-retry` });
    check(farmer.visitor.forageInventory.mint === 1 && townFailure.world.simulation.town.state.beds.find(bed => bed.id === row.id).crop === null,
      `Town ${failedKey} rollback permits one accepted retry without reconstructing the Worker`);
  }
  const changed = { hour: Math.floor(now / HOUR), entries: [{ messageId: webcrypto.randomUUID(), message: 'Synthetic retry' }] };
  failure.storage.failKey = 'chat';
  assert.throws(() => failure.world.putIfChanged('chat', changed), /failed put: chat/);
  failure.world.putIfChanged('chat', changed);
  changed.entries[0].message = 'Synthetic nested edit'; failure.world.putIfChanged('chat', changed);
  check(failure.records.get('chat').entries[0].message === 'Synthetic nested edit', 'Failed put does not advance the baseline; later nested mutation is compared to immutable serialized bytes');
  const worldWrites = failure.count('sharedActors');
  for (let i = 0; i < 10; i++) { now += 120; failure.world.publishWorld(now); }
  check(failure.count('sharedActors') === worldWrites + 10, 'Explicit action publications retain one immediate snapshot write each');
  console.log(JSON.stringify({ passed: checks.length, checks, writeCounts: { adminPolls: 34560, alarmWrites: 24, unchangedFlowerActions: 10, gardenWritesForFlowers: 0, sharedActorsWritesForFlowers: 10 } }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });

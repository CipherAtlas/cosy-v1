const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const ts = require('typescript');

let now = 1_800_000_000_000;
const Clock = class extends Date { static now() { return now; } };
const records = new Map();
const sockets = [];
const pairs = [];
const releases = [];
const makeSocket = () => ({
  messages: [], attachment: null,
  send(raw) { this.messages.push(JSON.parse(raw)); },
  accept() { this.accepted = true; },
  close(code) { this.closedWith = code; },
  serializeAttachment(value) { this.attachment = JSON.parse(JSON.stringify(value)); },
  deserializeAttachment() { return this.attachment; },
});
class WorkerResponse {
  constructor(body, options = {}) { this.body = body; this.status = options.status ?? 200; this.webSocket = options.webSocket; }
  static json(value) { return new WorkerResponse(JSON.stringify(value)); }
  async json() { return JSON.parse(this.body); }
}
const source = fs.readFileSync('worker/index.js', 'utf8').replace(/^import .*;\n/gm, '')
  .replace('export class VillageWorld', 'class VillageWorld').replace('export default {', 'const workerDefault = {');
const workerModule = { exports: {} };
vm.runInNewContext(`${source}\nmodule.exports = { VillageWorld, workerDefault };`, {
  module: workerModule, crypto: webcrypto, TextEncoder, Uint8Array, URL, Request, Response: WorkerResponse, Date: Clock,
  DurableObject: class { constructor(ctx) { this.ctx = ctx; } },
  freshGarden: () => ({ beds: [] }), readGarden: raw => JSON.parse(raw),
  VillageSimulation: class {
    mountedHorse() { return undefined; }
    step() {} snapshot() { return {}; } save() { return {}; }
    releaseVisitor(id) { releases.push(id); }
  },
  WebSocketPair: class { constructor() { this.client = {}; this.server = makeSocket(); pairs.push(this); } },
});
const { VillageWorld, workerDefault } = workerModule.exports;
const ctx = {
  storage: { kv: { get: key => records.get(key), put: (key, value) => records.set(key, value) }, getAlarm: async () => null, setAlarm: async () => {} },
  getWebSockets: () => sockets, acceptWebSocket: socket => sockets.push(socket),
};
let world = new VillageWorld(ctx);
const secret = 'test-only-'.repeat(5);
const env = { VILLAGE_ADMIN_TOKEN: secret, VILLAGE: { getByName: () => ({ fetch: request => world.fetch(request) }) } };
const admin = (path, method = 'GET', token = secret) => workerDefault.fetch(new Request(`https://world.example${path}`, {
  method, headers: { Authorization: `Bearer ${token}` },
}), env);
const join = async (ip, extra = {}) => {
  const response = await workerDefault.fetch(new Request('https://world.example/', { headers: {
    Origin: 'https://cosy.sabarg.com', Upgrade: 'websocket', ...(ip ? { 'CF-Connecting-IP': ip } : {}), ...extra,
  } }), env);
  assert.equal(response.status, 101);
  return pairs.at(-1).server;
};

async function checkWorker() {
  const a = await join('192.0.2.10'), b = await join('192.0.2.10'), observer = await join('192.0.2.20');
  const targetId = a.attachment.id;
  a.attachment.bench = { id: 'bench-1', index: 0 };
  b.attachment.swing = { id: 'swings', index: 0 };
  const kickPath = `/admin/players/${targetId}/kick`;
  assert.equal((await admin('/admin/players', 'GET', 'invalid')).status, 401);
  assert.equal((await admin(kickPath, 'POST', 'invalid')).status, 401);
  assert.equal(records.has('ipKicks'), false);
  const listing = await (await admin('/admin/players')).json();
  assert.equal(listing.players.length, 3);
  assert(listing.players.every(player => player.canKick));
  assert(!JSON.stringify(listing).includes('ipHash'));
  assert(!JSON.stringify(a.messages).includes('ipHash'), 'public welcome never includes IP fingerprints');
  assert(!JSON.stringify(a.messages).includes('192.0.2.10'));
  const result = await (await admin(kickPath, 'POST')).json();
  const expiry = now + 300_000;
  assert.equal(result.until, expiry);
  assert.equal(result.kickedCount, 2);
  assert.equal(result.players.length, 1);
  for (const socket of [a, b]) {
    assert.equal(socket.closedWith, 4003);
    assert.equal(socket.messages.at(-1).type, 'kicked');
    assert.equal(socket.messages.at(-1).until, expiry);
    assert(!world.visitors().some(visitor => visitor.id === socket.attachment.id), 'visitor and seat claims are removed immediately');
    if (world.simulation) assert(releases.includes(socket.attachment.id), 'shared actor ownership is released immediately');
  }
  assert(observer.messages.some(message => message.type === 'leave' && message.id === targetId));
  assert.equal(observer.closedWith, undefined);
  assert(!JSON.stringify(records.get('ipKicks')).includes('192.0.2.10'), 'raw IP is not persisted');
  assert.equal((await admin(kickPath, 'POST')).status, 404, 'a stale console cannot restart the cooldown');
  const count = a.messages.length;
  await world.webSocketMessage(a, JSON.stringify({ type: 'chat', message: 'Should never arrive' }));
  assert.equal(a.messages.length, count);
  await world.webSocketClose(a);
  assert.equal(a.closedWith, 4003, 'close callback preserves the terminal kick code');
  const blocked = await join('192.0.2.10', { 'X-Forwarded-For': '192.0.2.99' });
  assert.equal(blocked.messages[0].type, 'kicked');
  assert.equal(blocked.accepted, true);
  assert.equal(sockets.includes(blocked), false, 'refused sockets never occupy the world');
  world = new VillageWorld(ctx);
  now = expiry - 1;
  const revived = await join('192.0.2.10');
  assert.equal(revived.messages[0].type, 'kicked', 'cooldown survives Durable Object reconstruction');
  assert.equal(revived.messages[0].until, expiry, 'attempted re-entry does not extend the five minutes');
  now = expiry;
  const returning = await join('192.0.2.10');
  assert(returning.messages.some(message => message.type === 'welcome'), 'entry works at exactly five minutes');
  assert.equal(records.get('ipKicks').length, 0, 'expired cooldowns are pruned');
  const noIp = await join(null);
  const noIpId = noIp.attachment.id;
  assert.equal((await admin(`/admin/players/${noIpId}/kick`, 'POST')).status, 409);
  assert.equal((await (await admin('/admin/players')).json()).players.find(player => player.id === noIpId).canKick, false);
  const ipv6 = await join('240.0.0.1', { 'CF-Connecting-IPv6': '2001:db8::1' });
  await admin(`/admin/players/${ipv6.attachment.id}/kick`, 'POST');
  const sameIpv6 = await join('240.0.0.2', { 'CF-Connecting-IPv6': '2001:db8::1' });
  assert.equal(sameIpv6.messages[0].type, 'kicked', 'real IPv6 is used when Cloudflare supplies a pseudo IPv4');
}

async function checkClient() {
  const compiled = ts.transpileModule(fs.readFileSync('features/village/sharedWorld.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const clientModule = { exports: {} };
  const timers = new Map(), clients = [];
  let timerId = 0, kicks = 0, disconnects = 0;
  class MockWebSocket {
    static OPEN = 1;
    readyState = 1;
    constructor() { clients.push(this); }
    send() {}
    close() { this.readyState = 3; this.onclose?.({ code: 1000 }); }
  }
  const schedule = callback => { timers.set(++timerId, callback); return timerId; };
  vm.runInNewContext(compiled, {
    exports: clientModule.exports, require: () => ({ readGarden: raw => JSON.parse(raw) }),
    process: { env: {} }, WebSocket: MockWebSocket,
    window: { setTimeout: schedule, clearTimeout: id => timers.delete(id), setInterval: schedule, clearInterval: id => timers.delete(id) },
  });
  const options = {
    getPose: () => null, onState() {}, onChat() {}, onChatCooldown() {}, onAction() {},
    onDisconnect: () => disconnects++, onKicked: () => kicks++,
  };
  const event = message => ({ data: JSON.stringify(message) });
  const joining = clientModule.exports.connectSharedWorld(options);
  clients.at(-1).onmessage(event({ type: 'welcome', selfId: 'self', visitors: [], garden: { beds: [] }, chatHour: 1, chat: [] }));
  const connection = await joining;
  const pending = connection.interact?.({ kind: 'leave' });
  clients.at(-1).onmessage(event({ type: 'kicked', until: now + 300_000 }));
  if (pending) assert.equal((await pending).ok, false);
  assert.equal(kicks, 1);
  assert.equal(disconnects, 0);
  assert.equal(timers.size, 0, 'kick clears heartbeat, interaction and reconnect timers');
  assert.equal(connection.sendChat('blocked'), false);
  clients.at(-1).onclose({ code: 4003 });
  assert.equal(kicks, 1, 'message and close report a kick only once');
  const fresh = clientModule.exports.connectSharedWorld(options);
  const rejected = assert.rejects(fresh, /You've been kicked/);
  clients.at(-1).onmessage(event({ type: 'kicked', until: now + 300_000 }));
  await rejected;
  assert.equal(kicks, 2, 'first join during the cooldown still opens the kick screen');
  assert.equal(timers.size, 0);
  const fallback = clientModule.exports.connectSharedWorld(options);
  const closed = assert.rejects(fallback, /You've been kicked/);
  clients.at(-1).onclose({ code: 4003 });
  await closed;
  assert.equal(kicks, 3, 'terminal close code works even if the kick message is lost');
  const recover = clientModule.exports.connectSharedWorld(options);
  clients.at(-1).onmessage(event({ type: 'welcome', selfId: 'again', visitors: [], garden: { beds: [] }, chatHour: 1, chat: [] }));
  const normalConnection = await recover;
  clients.at(-1).onclose({ code: 1006 });
  assert.equal(disconnects, 1, 'ordinary network drops still retry');
  assert.equal(timers.size, 1);
  normalConnection.close();
}

(async () => {
  await checkWorker();
  await checkClient();
  console.log('IP kick: authentication, shared-IP removal, ownership release, restart/reload enforcement, five-minute expiry, IP privacy, IPv6 and terminal client handling pass.');
})().catch(error => { console.error(error); process.exitCode = 1; });

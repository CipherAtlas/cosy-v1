const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const ts = require('typescript');

const source = fs.readFileSync('worker/index.js', 'utf8')
  .replace(/^import .*;\n/gm, '')
  .replace('export class VillageWorld', 'class VillageWorld')
  .replace('export default {', 'const workerDefault = {');
const moduleRef = { exports: {} };
const nowHour = Math.floor(Date.now() / 3_600_000);
vm.runInNewContext(`${source}\nmodule.exports = { VillageWorld, workerDefault };`, {
  module: moduleRef, crypto: webcrypto, TextEncoder, Uint8Array, URL, Request, Response, Date,
  DurableObject: class { constructor(ctx) { this.ctx = ctx; } },
  freshGarden: () => ({ beds: [] }), readGarden: value => JSON.parse(value),
  VillageSimulation: class {},
});
const { VillageWorld, workerDefault } = moduleRef.exports;

const saved = { hour: nowHour, entries: [{ id: 'visitor', name: 'Cosy Otter', message: 'Hello' }] };
const records = new Map([['chat', saved]]);
const messages = [];
const socket = { send: raw => messages.push(JSON.parse(raw)), deserializeAttachment: () => null };
const ctx = {
  storage: {
    kv: { get: key => records.get(key), put: (key, value) => records.set(key, value) },
    getAlarm: async () => null, setAlarm: async () => {},
  },
  getWebSockets: () => [socket],
};
const room = new VillageWorld(ctx);
const secret = 'a'.repeat(48);
const env = { VILLAGE_ADMIN_TOKEN: secret, VILLAGE: { getByName: () => ({ fetch: request => room.fetch(request) }) } };
const request = (path, method = 'GET', token = secret, headers = {}) => new Request(`https://world.example${path}`, {
  method, headers: { Authorization: `Bearer ${token}`, ...headers },
});

(async () => {
  assert.equal(records.get('chat').entries[0].messageId.length, 36, 'older messages receive stable IDs');
  assert.equal((await workerDefault.fetch(request('/admin/chat', 'GET', 'bad'), env)).status, 401);
  assert.equal((await workerDefault.fetch(new Request('https://world.example/admin/chat'), env)).status, 401);
  const initial = await (await workerDefault.fetch(request('/admin/chat'), env)).json();
  assert.equal(initial.entries.length, 1);
  const id = initial.entries[0].messageId;
  const removed = await (await workerDefault.fetch(request(`/admin/chat/${id}`, 'DELETE'), env)).json();
  assert.equal(removed.entries.length, 0);
  assert.equal(records.get('chat').entries.length, 0);
  assert.equal(messages.at(-1).type, 'chat_sync');
  assert.equal(messages.at(-1).removedMessageIds[0], id);
  assert.equal((await workerDefault.fetch(request(`/admin/chat/${id}`, 'DELETE'), env)).status, 404);

  const nextId = webcrypto.randomUUID();
  room.chat = [{ id: 'visitor', messageId: nextId, name: 'Cosy Otter', message: 'Again' }];
  const stale = await workerDefault.fetch(request('/admin/chat', 'DELETE', secret, { 'If-Match': `"${nowHour - 1}"` }), env);
  assert.equal(stale.status, 409);
  assert.equal(room.chat.length, 1);
  const cleared = await (await workerDefault.fetch(request('/admin/chat', 'DELETE', secret, { 'If-Match': `"${nowHour}"` }), env)).json();
  assert.equal(cleared.entries.length, 0);
  assert.equal(messages.at(-2).type, 'hour', 'already-open older clients also clear their log');
  assert.equal(messages.at(-1).removedMessageIds[0], nextId);

  const clientSource = ts.transpileModule(fs.readFileSync('features/village/sharedWorld.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const clientModule = { exports: {} };
  let clientSocket;
  class MockWebSocket {
    static OPEN = 1;
    readyState = 1;
    constructor() { clientSocket = this; }
    send() {}
    close() { this.readyState = 3; }
  }
  vm.runInNewContext(clientSource, {
    exports: clientModule.exports,
    require: () => ({ readGarden: value => JSON.parse(value) }),
    process: { env: {} }, WebSocket: MockWebSocket,
    window: { setInterval: () => 1, setTimeout: () => 2, clearInterval: () => {}, clearTimeout: () => {} },
  });
  const snapshots = [];
  const moderated = [];
  const joining = clientModule.exports.connectSharedWorld({
    getPose: () => null,
    onState: state => snapshots.push(JSON.parse(JSON.stringify(state))),
    onChat: () => {}, onChatModerated: ids => moderated.push(...ids),
    onChatCooldown: () => {}, onAction: () => {}, onDisconnect: () => {},
  });
  clientSocket.onmessage({ data: JSON.stringify({
    type: 'welcome', selfId: 'self', visitors: [], garden: { beds: [] },
    chatHour: nowHour, chat: [{ id: 'visitor', messageId: nextId, name: 'Cosy Otter', message: 'Again' }],
  }) });
  const connection = await joining;
  clientSocket.onmessage({ data: JSON.stringify(messages.at(-1)) });
  assert.equal(snapshots.at(-1).chat.length, 0);
  assert.deepEqual(moderated, [nextId]);
  connection.close();
  console.log('Admin authentication, legacy IDs, message removal, stale-hour guard, clear, and client sync pass.');
})().catch(error => { console.error(error); process.exitCode = 1; });

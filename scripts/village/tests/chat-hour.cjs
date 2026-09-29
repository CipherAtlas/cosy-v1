const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');

const source = fs.readFileSync('worker/index.js', 'utf8')
  .replace(/^import .*;\n/gm, '')
  .replace('export class VillageWorld', 'class VillageWorld')
  .replace('export default {', 'const workerDefault = {');
const hourMs = 3_600_000;
let now = 100 * hourMs + 1000;
const workerModule = { exports: {} };
vm.runInNewContext(`${source}\nmodule.exports = VillageWorld;`, {
  module: workerModule,
  Date: class extends Date { static now() { return now; } },
  DurableObject: class { constructor(ctx) { this.ctx = ctx; } },
  crypto: webcrypto,
  freshGarden: () => ({ beds: [] }),
  readGarden: value => JSON.parse(value),
});
const VillageWorld = workerModule.exports;

function room(savedChat, connected = true) {
  const records = new Map(savedChat ? [['chat', savedChat]] : []);
  const messages = [];
  const sockets = connected ? [{ send: raw => messages.push(JSON.parse(raw)) }] : [];
  const storage = {
    kv: { get: key => records.get(key), put: (key, value) => records.set(key, value) },
    setAlarm: time => { storage.alarmAt = time; },
  };
  const ctx = { storage, getWebSockets: () => sockets };
  return { ctx, records, messages, sockets, storage };
}

(async () => {
  let resetEvent;
  for (const savedChat of [undefined, { hour: 100, entries: [{ name: 'Visitor', message: 'Hello' }] }]) {
    const testRoom = room(savedChat);
    new VillageWorld(testRoom.ctx).rollHour();
    assert.equal(testRoom.storage.alarmAt, 101 * hourMs);
    testRoom.messages.length = 0;

    now = 101 * hourMs + 1;
    const awakened = new VillageWorld(testRoom.ctx);
    await awakened.alarm();
    assert.deepEqual(testRoom.messages, [{ type: 'hour', chatHour: 101 }]);
    resetEvent = testRoom.messages[0];
    assert.equal(awakened.chatHour, 101);
    assert.equal(awakened.chat.length, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(testRoom.records.get('chat'))), { hour: 101, entries: [] });
    assert.equal(testRoom.storage.alarmAt, 102 * hourMs);
    now = 100 * hourMs + 1000;
  }

  const emptyRoom = room({ hour: 100, entries: [{ name: 'Visitor', message: 'Hello' }] }, false);
  now = 101 * hourMs + 1;
  await new VillageWorld(emptyRoom.ctx).alarm();
  assert.deepEqual(JSON.parse(JSON.stringify(emptyRoom.records.get('chat'))), { hour: 101, entries: [] });
  assert.deepEqual(emptyRoom.messages, []);

  const clientSource = ts.transpileModule(fs.readFileSync('features/village/sharedWorld.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const clientModule = { exports: {} };
  let socket;
  class MockWebSocket {
    static OPEN = 1;
    readyState = 1;
    constructor() { socket = this; }
    send() {}
    close() { this.readyState = 3; }
  }
  vm.runInNewContext(clientSource, {
    exports: clientModule.exports,
    require: () => ({ readGarden: value => JSON.parse(value) }),
    process: { env: {} },
    WebSocket: MockWebSocket,
    window: { setInterval: () => 1, clearInterval: () => {}, clearTimeout: () => {} },
  });
  const snapshots = [];
  const joining = clientModule.exports.connectSharedWorld({
    getPose: () => null,
    onState: snapshot => snapshots.push(JSON.parse(JSON.stringify(snapshot))),
    onChat: () => {}, onChatCooldown: () => {}, onAction: () => {}, onDisconnect: () => {},
  });
  socket.onmessage({ data: JSON.stringify({
    type: 'welcome', selfId: 'self', visitors: [], garden: { beds: [] },
    chatHour: 100, chat: [{ name: 'Visitor', message: 'Hello' }],
  }) });
  const connection = await joining;
  socket.onmessage({ data: JSON.stringify(resetEvent) });
  assert.equal(snapshots.at(-1).chatHour, 101);
  assert.deepEqual(snapshots.at(-1).chat, []);

  const messageRoom = room({ hour: 101, entries: [] });
  const sender = { id: 'visitor', name: 'Cosy Otter', lastChat: 0 };
  messageRoom.sockets[0].deserializeAttachment = () => sender;
  messageRoom.sockets[0].serializeAttachment = () => {};
  await new VillageWorld(messageRoom.ctx).webSocketMessage(messageRoom.sockets[0], JSON.stringify({ type: 'chat', message: 'Hello again' }));
  assert.equal(messageRoom.records.get('chat').entries[0].sentAt, now);
  assert.equal(messageRoom.messages.at(-1).entry.sentAt, now);
  assert.equal(new VillageWorld(messageRoom.ctx).chat[0].sentAt, now);
  socket.onmessage({ data: JSON.stringify(messageRoom.messages.at(-1)) });
  assert.equal(snapshots.at(-1).chat[0].sentAt, now);
  connection.close();
  console.log('Hourly reset and persisted, broadcast chat timestamps pass through the shared client.');
})().catch(error => { console.error(error); process.exitCode = 1; });

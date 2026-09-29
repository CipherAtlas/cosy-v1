const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('features/village/sharedWorld.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

let now = 10_000;
let timerId = 0;
const timers = new Map();
const accepted = [];
const cooldowns = [];
let lastChat = 0;
const schedule = (callback, delay) => {
  const id = ++timerId;
  timers.set(id, { at: now + delay, callback });
  return id;
};
const advanceTo = target => {
  while (true) {
    const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
    if (!next || next[1].at > target) break;
    now = next[1].at;
    timers.delete(next[0]);
    next[1].callback();
  }
  now = target;
};

class MockWebSocket {
  static OPEN = 1;
  constructor() {
    this.readyState = MockWebSocket.OPEN;
    schedule(() => this.onmessage({ data: JSON.stringify({
      type: 'welcome', selfId: 'self', visitors: [], garden: { beds: [] }, chatHour: 1, chat: [],
    }) }), 0);
  }
  send(raw) {
    const message = JSON.parse(raw);
    if (message.type !== 'chat') return;
    if (now - lastChat < 3000) return; // Match the Worker's current limit.
    lastChat = now;
    accepted.push(message.message);
  }
  close() { this.readyState = 3; }
}

const chatModule = {};
vm.runInNewContext(compiled, {
  exports: chatModule,
  require: () => ({ readGarden: value => JSON.parse(value) }),
  process: { env: {} },
  WebSocket: MockWebSocket,
  Date: class extends Date { static now() { return now; } },
  window: {
    setTimeout: schedule,
    clearTimeout: id => timers.delete(id),
    setInterval: () => 0,
    clearInterval: () => {},
  },
});

(async () => {
  const connecting = chatModule.connectSharedWorld({
    getPose: () => null,
    onState: () => {},
    onChat: () => {},
    onChatCooldown: until => cooldowns.push(until),
    onAction: () => {},
    onDisconnect: () => {},
  });
  advanceTo(now);
  const connection = await connecting;
  assert.equal(connection.sendChat('First sentence.'), true);
  assert.equal(cooldowns.at(-1), 13_100);
  assert.equal(connection.sendChat('Second sentence.'), false);
  assert.deepEqual(accepted, ['First sentence.']);
  advanceTo(now + 3099);
  assert.equal(connection.sendChat('Second sentence.'), false);
  assert.deepEqual(accepted, ['First sentence.']);
  advanceTo(now + 1);
  assert.equal(connection.sendChat('Second sentence.'), true);
  assert.deepEqual(accepted, ['First sentence.', 'Second sentence.']);
  assert.equal(accepted.length, 2);
  connection.close();
  assert.equal(connection.sendChat('After leaving.'), false);
  console.log('Chat refuses Enter-time sends during cooldown and accepts the retained second sentence afterward.');
})().catch(error => { console.error(error); process.exitCode = 1; });

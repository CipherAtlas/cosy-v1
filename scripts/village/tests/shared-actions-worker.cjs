const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
let now = 10000, current, interval, timerId = 0;
const timers = new Map(), sent = [], worlds = [], tricks = [];
let disconnected = 0, rejected = 0, crumbs = false;
let pose = { x: 1, z: 2, heading: 0, active: true };
class ClientSocket {
  static OPEN = 1;
  readyState = 1;
  constructor() { current = this; }
  send(raw) { sent.push(JSON.parse(raw)); }
  close() { this.readyState = 3; }
}
const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('features/village/sharedWorld.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, {
  exports: mod.exports, require: () => ({ readGarden: raw => JSON.parse(raw) }), process: { env: {} },
  WebSocket: ClientSocket, Date: class extends Date { static now() { return now; } },
  window: { setInterval: callback => { interval = callback; return 1; }, clearInterval: () => {},
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; }, clearTimeout: id => timers.delete(id) },
});
const receive = message => current.onmessage({ data: JSON.stringify(message) });
const world = { time: now, epoch: now, actors: [], birds: {}, pondFeedAt: null, gift: null };
const welcome = id => receive({ type: 'welcome', protocol: 2, selfId: id, visitors: [], garden: { beds: [] }, chatHour: 1, chat: [], world, hasCrumbs: false });
(async () => {
  const joining = mod.exports.connectSharedWorld({ getPose: () => pose, onState: () => {}, onChat: () => {}, onChatCooldown: () => {},
    onAction: () => {}, onDisconnect: () => disconnected++, onSwingTaken: () => rejected++, onPuppyTrick: trick => tricks.push(trick),
    onWorld: state => worlds.push(state), onCrumbs: value => crumbs = value });
  welcome('a'); const connection = await joining;
  assert.equal(worlds.length, 1);
  interval(); interval();
  assert.equal(sent.filter(message => message.type === 'move').length, 1);
  assert.equal(sent.filter(message => message.type === 'heartbeat').length, 2);
  pose = { ...pose, y: 1 }; interval();
  assert.equal(sent.filter(message => message.type === 'move').at(-1).y, 1);
  pose = { ...pose, bench: { id: 'bench-1', index: 0 } }; interval();
  assert.equal(sent.filter(message => message.type === 'move').at(-1).bench.index, 0);
  pose = { ...pose, holdingPuppy: 'mochi', active: false }; interval();
  assert.equal(sent.at(-1).holdingPuppy, 'mochi'); assert.equal(sent.at(-1).active, false);
  const claim = connection.interact({ kind: 'bench', id: 'bench-1', index: 0 });
  const request = sent.at(-1);
  assert.equal(request.type, 'interaction');
  receive({ type: 'interaction_result', requestId: request.requestId, result: { ok: true, index: 0 } });
  assert.equal((await claim).index, 0);
  const denied = connection.interact({ kind: 'puppy', id: 'mochi', action: 'walk' });
  receive({ type: 'interaction_result', requestId: sent.at(-1).requestId, result: { ok: false, reason: 'Busy' } });
  assert.equal((await denied).reason, 'Busy');
  receive({ type: 'crumbs', hasCrumbs: true }); assert(crumbs);
  receive({ type: 'swing_taken' }); assert.equal(rejected, 1);
  const timeout = connection.interact({ kind: 'activity', id: 'mood' });
  const requestTimer = [...timers.values()].find(timer => timer.delay === 4000); requestTimer.callback();
  assert.equal((await timeout).ok, false);
  const pending = connection.interact({ kind: 'puppy', id: 'mochi', action: 'hold' });
  const old = current; old.readyState = 3; old.onclose({ code: 1000 });
  assert.equal((await pending).ok, false); assert.equal(disconnected, 1);
  const retry = [...timers.values()].find(timer => timer.delay === 1000); retry.callback();
  welcome('rejoined');
  old.onmessage({ data: JSON.stringify({ type: 'crumbs', hasCrumbs: true }) });
  assert.equal(crumbs, false, 'Stale socket callbacks cannot change the rejoined visit');
  const closing = connection.interact({ kind: 'puppy', id: 'mochi', action: 'hold' });
  connection.close(); assert.equal((await closing).ok, false);
  const before = sent.length; assert.equal((await connection.interact({ kind: 'activity', id: 'music' })).ok, false);
  assert.equal(sent.length, before);
  console.log('Shared client pose/heartbeat, seat requests, rejection/timeout, crumb grants, reconnect and close contracts pass.');
})().catch(error => { console.error(error); process.exitCode = 1; });

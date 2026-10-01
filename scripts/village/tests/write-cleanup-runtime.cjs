// Local-only integration harness. Dependencies live outside the application lockfile.
// TEST_TOOLS_ROOT must contain esbuild and Miniflare 5; see VILLAGE_BUILD.md.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createRequire } = require('node:module');
if (!process.env.TEST_TOOLS_ROOT) throw new Error('Set TEST_TOOLS_ROOT to an external directory containing esbuild and Miniflare 5 (see VILLAGE_BUILD.md).');
const tools = createRequire(path.resolve(process.env.TEST_TOOLS_ROOT, 'package.json'));
const { Miniflare } = tools('miniflare');
const esbuild = tools('esbuild');
const HOUR = 3_600_000;
const secret = 'synthetic-local-only-admin-token-0000000000000000';
const checks = [];
const check = (ok, label) => { assert(ok, label); checks.push(label); };
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cosy-write-cleanup-'));
// Instrument method calls in the bundled test copy only. Production has no test endpoints.
let source = fs.readFileSync('worker/index.js', 'utf8')
  .replaceAll('this.ctx.storage.kv.put(', 'this.testPut(')
  .replaceAll('ctx.storage.kv.put(', 'this.testPut(')
  .replaceAll('this.ctx.storage.setAlarm(', 'this.testSetAlarm(');
source += `\nexport class InstrumentedWorld extends VillageWorld {
  testPut(key, value) { this.counts ??= {}; this.counts[key] = (this.counts[key] || 0) + 1; this.ctx.storage.kv.put(key, value); }
  async testSetAlarm(at) { this.counts ??= {}; this.counts.alarm = (this.counts.alarm || 0) + 1; await this.ctx.storage.setAlarm(at); }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/__test/stats') return Response.json({ counts: this.counts || {}, alarm: await this.ctx.storage.getAlarm(), chat: this.ctx.storage.kv.get('chat'), garden: this.ctx.storage.kv.get('garden') });
    if (path === '/__test/arm-alarm') { await this.testSetAlarm(Date.now() + 100); return Response.json({ ok: true }); }
    if (path === '/__test/delete-alarm') { await this.ctx.storage.deleteAlarm(); return Response.json({ ok: true }); }
    if (path === '/__test/previous-hour') {
      this.chatHour = Math.floor(Date.now() / 3600000) - 1;
      this.chat = [{ messageId: crypto.randomUUID(), id: 'old', name: 'Synthetic', message: 'Previous hour', sentAt: Date.now() - 3600000 }];
      this.putIfChanged('chat', { hour: this.chatHour, entries: this.chat });
      await this.ctx.storage.deleteAlarm(); return Response.json({ hour: this.chatHour });
    }
    return super.fetch(request);
  }
}\n`;
const bundle = esbuild.buildSync({ stdin: { contents: source, resolveDir: path.resolve('worker'), sourcefile: 'index.js' }, bundle: true, write: false, format: 'esm', platform: 'neutral', external: ['cloudflare:workers'] }).outputFiles[0].text;
const options = {
  host: '127.0.0.1', port: 0, telemetry: { enabled: false }, resourcePersistencePath: temporary,
  workers: [{ config: {
    name: 'cosy-write-cleanup', compatibilityDate: '2026-09-28',
    manifest: { mainModule: 'world.mjs', modules: { 'world.mjs': { type: 'esm', contents: bundle } } },
    env: { VILLAGE: { type: 'durable-object', worker: 'cosy-write-cleanup', exportName: 'InstrumentedWorld' }, VILLAGE_ADMIN_TOKEN: { type: 'json', value: secret } },
    exports: { InstrumentedWorld: { type: 'durable-object', storage: 'sqlite' } },
  } }],
};
let mf;
const sockets = [];
async function connect(ip) {
  const response = await mf.dispatchFetch('http://localhost/', { headers: { Upgrade: 'websocket', Origin: 'http://127.0.0.1:3051', 'CF-Connecting-IP': ip } });
  assert.equal(response.status, 101);
  const socket = response.webSocket, messages = [];
  socket.addEventListener('message', event => messages.push(JSON.parse(event.data)));
  socket.accept(); sockets.push(socket);
  const until = async predicate => {
    const deadline = Date.now() + 5000;
    while (!predicate()) { if (Date.now() > deadline) throw new Error(`WebSocket result timed out: ${JSON.stringify(messages)}`); await new Promise(resolve => setTimeout(resolve, 10)); }
  };
  await until(() => messages.some(m => m.type === 'welcome'));
  return { socket, messages, until, welcome: messages.find(m => m.type === 'welcome') };
}
if (process.env.SERVE_LOCAL_FIXTURE === '1') {
  // Optional loopback fixture for rendered-browser QA; never part of the production bundle.
  options.port = 2567;
  const http = require('node:http');
  const start = async () => { mf = new Miniflare(options); await mf.ready; };
  (async () => {
    await start();
    const control = http.createServer(async (request, response) => {
      try {
        const route = new URL(request.url, 'http://localhost').pathname;
        let result;
        if (route === '/restart') { await mf.dispose(); await start(); result = { ok: true }; }
        else if (route === '/hibernate') {
          await mf.unsafeEvictDurableObject('cosy-write-cleanup', 'InstrumentedWorld', { name: 'one-shared-village', webSockets: 'hibernate' });
          result = { ok: true };
        } else {
          const stub = (await mf.getDurableObjectNamespace('VILLAGE')).getByName('one-shared-village');
          result = await (await stub.fetch(`http://fixture.invalid/__test${route}`)).json();
        }
        response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify(result));
      } catch (error) { response.writeHead(500); response.end(JSON.stringify({ error: error.message })); }
    });
    control.listen(2568, '127.0.0.1', () => console.log('Synthetic Worker :2567; local controls :2568 ready'));
    const stop = async () => { control.close(); await mf.dispose(); fs.rmSync(temporary, { recursive: true, force: true }); process.exit(0); };
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
  })().catch(error => { console.error(error); process.exitCode = 1; });
} else (async () => {
  mf = new Miniflare(options); await mf.ready;
  const namespace = await mf.getDurableObjectNamespace('VILLAGE');
  const stub = namespace.getByName('one-shared-village');
  const test = async (path, method = 'GET') => (await stub.fetch(`http://fixture.invalid/__test/${path}`, { method })).json();
  const admin = (path = '/admin/chat', method = 'GET', headers = {}) => mf.dispatchFetch(`http://localhost${path}`, { method, headers: { Authorization: `Bearer ${secret}`, ...headers } });
  const hour = Math.floor(Date.now() / HOUR);
  const responses = await Promise.all(Array.from({ length: 40 }, () => admin()));
  check(responses.every(r => r.status === 200), 'Forty concurrent admin polls all succeed with actual SQLite Durable Object storage');
  let stats = await test('stats');
  check(stats.counts.alarm === 1 && stats.alarm === (hour + 1) * HOUR, 'Concurrent initial polls create exactly one successor alarm');
  await test('delete-alarm'); await Promise.all(Array.from({ length: 20 }, () => admin()));
  stats = await test('stats');
  check(stats.counts.alarm === 2, 'Concurrent polls repair a removed real runtime alarm exactly once');
  const a = await connect('192.0.2.10'), b = await connect('192.0.2.20');
  check(a.welcome.visitors.length === 1 && b.welcome.visitors.length === 2, 'Two real WebSocket clients join the same local Worker');
  a.socket.send(JSON.stringify({ type: 'chat', message: 'Synthetic runtime hello' }));
  await b.until(() => b.messages.some(m => m.type === 'chat'));
  let visible = await (await admin()).json();
  check(visible.entries.length === 1 && visible.entries[0].message === 'Synthetic runtime hello', 'Chat is broadcast to the other real client and immediately readable by the admin API');
  const old = await test('previous-hour');
  // A fresh third socket avoids the normal per-visitor chat cooldown.
  const c = await connect('192.0.2.30');
  await test('previous-hour');
  c.socket.send(JSON.stringify({ type: 'chat', message: 'Synthetic concurrent new-hour message' }));
  const [stale, ...polls] = await Promise.all([
    admin('/admin/chat', 'DELETE', { 'If-Match': `"${old.hour}"` }),
    ...Array.from({ length: 20 }, () => admin()),
  ]);
  check(stale.status === 409 && polls.every(r => r.status === 200), 'Concurrent rollover/message/admin polls refuse a stale-hour clear');
  await c.until(() => c.messages.some(m => m.type === 'chat' && m.entry.message === 'Synthetic concurrent new-hour message'));
  visible = await (await admin()).json();
  check(visible.chatHour === hour && visible.entries.length === 1 && visible.entries[0].message === 'Synthetic concurrent new-hour message', 'Concurrent rollover leaves exactly the new-hour message durably readable');
  stats = await test('stats');
  const alarmsAfterRollover = stats.counts.alarm;
  await Promise.all(Array.from({ length: 30 }, () => admin()));
  check((await test('stats')).counts.alarm === alarmsAfterRollover, 'Continued real admin polling adds no duplicate alarm writes');
  await mf.unsafeEvictDurableObject('cosy-write-cleanup', 'InstrumentedWorld', { name: 'one-shared-village', webSockets: 'hibernate' });
  b.messages.length = 0; b.socket.send(JSON.stringify({ type: 'heartbeat', active: true }));
  await b.until(() => b.messages.some(m => m.type === 'actors'));
  visible = await (await admin()).json();
  const afterHibernation = await test('stats');
  check(visible.entries.length === 1 && !b.messages.some(m => m.type === 'welcome') && (afterHibernation.counts.alarm || 0) === 0, 'Retained-socket hibernation resumes heartbeat/world publication and preserves chat/alarm without rescheduling');
  for (const socket of sockets.splice(0)) socket.close();
  await mf.dispose(); mf = new Miniflare(options); await mf.ready;
  visible = await (await admin()).json();
  check(visible.entries.length === 1 && visible.entries[0].message === 'Synthetic concurrent new-hour message', 'Full local-runtime restart restores the acknowledged concurrent message');
  const reopenedStub = (await mf.getDurableObjectNamespace('VILLAGE')).getByName('one-shared-village');
  stats = await (await reopenedStub.fetch('http://fixture.invalid/__test/stats')).json();
  check((stats.counts.alarm || 0) === 0 && stats.alarm === (hour + 1) * HOUR, 'Runtime restart preserves the real alarm and does not reschedule it');
  const removed = await admin(`/admin/chat/${visible.entries[0].messageId}`, 'DELETE');
  check(removed.status === 200 && (await removed.json()).entries.length === 0, 'Admin removes the restored message using its stable ID');
  const before = await (await reopenedStub.fetch('http://fixture.invalid/__test/stats')).json();
  await Promise.all(Array.from({ length: 20 }, () => admin('/admin/chat', 'DELETE', { 'If-Match': `"${hour}"` })));
  const after = await (await reopenedStub.fetch('http://fixture.invalid/__test/stats')).json();
  check(after.counts.chat === before.counts.chat && (after.counts.alarm || 0) === 0, 'Twenty concurrent empty clears perform no chat/alarm rewrites in actual storage');
  await reopenedStub.fetch('http://fixture.invalid/__test/previous-hour');
  await reopenedStub.fetch('http://fixture.invalid/__test/arm-alarm');
  let fired;
  const deadline = Date.now() + 5000;
  do {
    fired = await (await reopenedStub.fetch('http://fixture.invalid/__test/stats')).json();
    if (fired.chat.hour === hour && fired.chat.entries.length === 0 && fired.alarm === (hour + 1) * HOUR) break;
    assert(Date.now() < deadline, 'actual runtime alarm must fire');
    await new Promise(resolve => setTimeout(resolve, 20));
  } while (true);
  check(fired.chat.hour === hour && fired.chat.entries.length === 0 && fired.alarm === (hour + 1) * HOUR, 'A real scheduled local-runtime alarm clears seeded prior-hour chat without visitors and schedules the next UTC hour');
  console.log(JSON.stringify({ passed: checks.length, checks, runtime: tools('miniflare/package.json').version }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  for (const socket of sockets) socket.close();
  if (mf) await mf.dispose();
  fs.rmSync(temporary, { recursive: true, force: true });
});

// Real local Worker/client/render regression: jumps must travel without horizontal motion.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');

(async () => {
  const output = process.env.OUTPUT_DIR || '/tmp/cosy-shared-jumps';
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'chrome',
    args: ['--disable-features=LocalNetworkAccessChecks'] });
  const checks = [], errors = [], check = (ok, label) => { if (!ok) throw Error(label); checks.push(label); };
  try {
    const pages = [];
    for (let index = 0; index < 2; index++) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      pages.push(page);
      page.on('pageerror', error => errors.push(error.message));
      // Keep the Worker's allowed local origin while using our isolated QA source.
      const origin = 'http://127.0.0.1:3051';
      const qa = process.env.QA_URL || origin;
      if (qa !== origin) await page.route(origin + '/**', async route => {
        const response = await route.fetch({ url: route.request().url().replace(origin, qa) });
        await route.fulfill({ response });
      });
      await page.goto(origin);
      await page.evaluate(async ({ index, endpoint }) => {
        window.process = { env: { NEXT_PUBLIC_SHARED_WORLD_URL: endpoint } };
        const { VillageEngine } = await import('/modules/features/village/VillageEngine.js');
        const { connectSharedWorld } = await import('/modules/features/village/sharedWorld.js');
        document.body.innerHTML = '<div class="village"><div id="scene" style="position:fixed;inset:0"></div></div>';
        const noop = () => {};
        const e = window.engine = new VillageEngine(document.querySelector('#scene'), {
          progress: noop, ready: noop, near: noop, interact: noop, movement: noop, contact: noop,
          environment: noop, stats: noop, error: message => { throw Error(message); },
        });
        await e.load(); e.setQuality('low'); e.setBlocked(false);
        e.movement.settle(index ? 1.6 : .3, index ? 23 : 20);
        window.poseEvents = [];
        window.connection = await connectSharedWorld({
          getPose: () => e.getPlayerPose(),
          onState: snapshot => {
            window.selfId = snapshot.selfId;
            const other = snapshot.visitors.filter(visitor => visitor.id !== snapshot.selfId);
            e.setRemoteVisitors(other);
            if (other.length) poseEvents.push({ y: other[0].y, x: other[0].x, z: other[0].z });
          },
          onChat: noop, onChatCooldown: noop, onAction: noop, onDisconnect: noop,
        });
      }, { index, endpoint: process.env.WORKER_URL || 'ws://127.0.0.1:2571' });
    }
    const [jumper, observer] = pages;
    await observer.waitForFunction(() => [...engine.remoteVisitors.values()].some(remote => Math.abs(remote.target.x - .3) < .01 && Number.isFinite(remote.target.y)));
    const ground = await jumper.evaluate(() => engine.getPlayerPose().y);
    const peaks = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      await observer.evaluate(() => { window.jumpSamples = []; window.sampleTimer = setInterval(() => {
        const remote = [...engine.remoteVisitors.values()][0];
        if (remote) jumpSamples.push({ y: remote.group.position.y, target: remote.target.y, x: remote.target.x, z: remote.target.z });
      }, 20); });
      await jumper.locator('canvas').focus();
      await jumper.keyboard.press('Space');
      await observer.waitForFunction(({ ground }) => [...engine.remoteVisitors.values()].some(remote => remote.group.position.y > ground + .3), { ground });
      await jumper.waitForFunction(() => engine.movement.grounded && engine.movement.takeoff === 0);
      await observer.waitForFunction(({ ground }) => [...engine.remoteVisitors.values()].every(remote => Math.abs(remote.group.position.y - ground) < .02), { ground });
      const samples = await observer.evaluate(() => { clearInterval(sampleTimer); return jumpSamples; });
      const peak = Math.max(...samples.map(sample => sample.y)) - ground;
      check(peak > .5, `Stationary jump ${attempt + 1} visibly rises on the observer's rendered spirit`);
      check(samples.every(sample => Math.abs(sample.x - .3) < .01 && Math.abs(sample.z - 20) < .01),
        `Jump ${attempt + 1} synchronizes even when horizontal position and facing stay fixed`);
      peaks.push(peak);
    }
    const connection = await observer.evaluate(async () => {
      const e = engine, bench = e.world.benches[0];
      const visitor = { id: 'legacy', name: 'Legacy visitor', color: '#ccbb99', slot: 99,
        x: bench.x, z: bench.z, heading: bench.facing };
      e.setRemoteVisitors([visitor]);
      const legacyHeight = e.remoteVisitors.get('legacy').target.y;
      e.setRemoteVisitors([{ ...visitor, y: .85 }]);
      const explicitHeight = e.remoteVisitors.get('legacy').target.y;
      e.setRemoteVisitors([{ ...visitor, y: NaN }]);
      return { legacyHeight, expected: bench.seatHeight - .62, explicitHeight,
        invalidHeight: e.remoteVisitors.get('legacy').target.y };
    });
    check(Math.abs(connection.legacyHeight - connection.expected) < .001, 'Visitors without a height retain legacy bench positioning');
    check(connection.explicitHeight === .85, 'Explicit airborne height overrides ground/bench inference');
    check(Number.isFinite(connection.invalidHeight), 'Invalid visitor height cannot enter the rendered transform');
    check(errors.length === 0, 'Two local clients have no captured page errors');
    fs.writeFileSync(output + '/checks.json', JSON.stringify({ checks, peaks, errors }, null, 2));
    console.log(JSON.stringify({ checks, peaks, errors }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

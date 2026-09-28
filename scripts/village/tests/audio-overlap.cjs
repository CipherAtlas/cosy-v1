// Run against preview_qa.py; this exercises the actual browser audio graph.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage();
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:3011/');
    const result = await page.evaluate(async () => {
      const { VillageAudio } = await import('/modules/features/village/audio.js');
      const { DEFAULT_MIX } = await import('/modules/features/village/places.js');
      const audio = new VillageAudio();
      const countBeds = () => [...audio.voices].filter(voice => !voice.effect).length;
      const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
      try {
        audio.setMix({ ...DEFAULT_MIX, music: 0 });
        await audio.start();
        if (countBeds() !== 3) throw Error(`Expected three nature beds, got ${countBeds()}`);
        for (let i = 0; i < 3; i++) {
          audio.stop();
          await audio.start();
          if (countBeds() !== 3) throw Error(`Sound off/on ${i + 1} stacked ${countBeds()} nature beds`);
        }
        await delay(450);
        if (audio.context.state !== 'running' || countBeds() !== 3) throw Error('A stale stop interrupted the restarted sound');
        audio.setMix(DEFAULT_MIX);
        for (let i = 0; i < 100 && !audio.soundtrack.current; i++) await delay(50);
        if (!audio.soundtrack.current) throw Error('Music did not start');
        audio.stop();
        await audio.start();
        if (audio.soundtrack.decks.filter(deck => !deck.audio.paused).length !== 1) throw Error('Sound off/on stacked music decks');
        audio.stop();
        await delay(450);
        if (audio.context.state !== 'suspended' || audio.voices.size !== 0) throw Error('Completed stop left audio active');
        await audio.start();
        if (countBeds() !== 3) throw Error('Restart after a completed stop lost or duplicated nature beds');
        return 'Quick restarts keep one set of nature beds and one music deck; completed stop restarts cleanly';
      } finally { audio.dispose(); }
    });
    console.log(`PASS ${result}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });

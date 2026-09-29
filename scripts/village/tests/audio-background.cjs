// Run against preview_qa.py to check the production audio graph with a hidden, timer-throttled page.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage();
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:3011/');
    await page.evaluate(async () => {
      const { VillageAudio } = await import('/modules/features/village/audio.js');
      const { DEFAULT_MIX } = await import('/modules/features/village/places.js');
      const audio = new VillageAudio();
      audio.setMix({ ...DEFAULT_MIX, music: 0, rain: 1 });
      await audio.start();
      const analyser = audio.context.createAnalyser();
      audio.ambience.connect(analyser);
      window.backgroundAudioCheck = { audio, analyser };
    });

    // Simulate visibilitychange and fully stalled page timers; Web Audio keeps rendering the beds.
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      const { audio } = window.backgroundAudioCheck;
      clearInterval(audio.timer);
      audio.timer = undefined;
      for (const voice of audio.voices) {
        if (!voice.effect) voice.source.playbackRate.value = 10;
      }
    });
    await page.waitForTimeout(6000);
    const result = await page.evaluate(() => {
      const { audio, analyser } = window.backgroundAudioCheck;
      const beds = [...audio.voices].filter(voice => !voice.effect);
      const samples = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(samples);
      return {
        hidden: document.hidden,
        context: audio.context.state,
        beds: beds.length,
        looping: beds.every(voice => voice.source.loop),
        ambienceGain: audio.ambience.gain.value,
        effectsGain: audio.effects.gain.value,
        rms: Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length),
      };
    });
    await page.evaluate(() => window.backgroundAudioCheck.audio.dispose());
    if (!result.hidden || result.context !== 'running' || result.beds !== 3 || !result.looping || result.ambienceGain < .1 || result.effectsGain > .01 || result.rms < .0001)
      throw Error(`Background ambience stopped: ${JSON.stringify(result)}`);
    console.log(`PASS simulated hidden page and stalled timer retain three looping beds and non-silent ambience: ${JSON.stringify(result)}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });

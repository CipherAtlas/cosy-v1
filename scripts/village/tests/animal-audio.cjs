// Production Web Audio playback, overlap/mute/privacy and a listenable compressor-output mix.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const output = process.env.OUTPUT_DIR || path.resolve('docs/village/evidence/animal-audio-20261004');
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:3072/');
    await page.exposeFunction('saveMix', bytes => fs.writeFileSync(path.join(output, 'game-mix.webm'), Buffer.from(bytes)));
    const result = await page.evaluate(async capture => {
      const { VillageAudio } = await import('/modules/features/village/audio.js');
      const { DEFAULT_MIX } = await import('/modules/features/village/places.js');
      const { RECORDINGS } = await import('/modules/features/village/soundtrack.js');
      const audio = new VillageAudio(), checks = [], timeline = [];
      const check = (condition, label) => { if (!condition) throw Error(label); checks.push(label); };
      const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
      const count = () => audio.townAnimals.voice ? 1 : 0;
      let compressor;
      const original = AudioContext.prototype.createDynamicsCompressor;
      AudioContext.prototype.createDynamicsCompressor = function () { return compressor = original.call(this); };
      let maxMusic = 0, watcher;
      try {
        audio.setMix({ ...DEFAULT_MIX, soundtrack: 'village' });
        await audio.start();
        check(audio.townAnimals.buffers.size === 16, 'All twelve species/purr recordings and four existing dog clips decode');
        const analyser = audio.context.createAnalyser(); analyser.fftSize = 2048;
        compressor.connect(analyser);
        let peak = 0;
        watcher = setInterval(() => {
          maxMusic = Math.max(maxMusic, audio.soundtrack.decks.filter(deck => !deck.audio.paused).length);
          const data = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(data);
          peak = Math.max(peak, ...data.map(Math.abs));
        }, 10);
        const frame = x => ({ listener: [x, 1.4, 20], forward: [0, 0, -1], wind: .3, weather: 'golden', sheltered: false });
        audio.setEnvironment(frame(0));
        audio.townAnimal({ species: 'cow', position: [0, 1, 35], happy: true });
        check(count() === 0, 'Distant animals cannot start a response');
        const herd = [{ id: 'a', species: 'cow', position: [2, 1, 20] }, { id: 'b', species: 'sheep', position: [3, 1, 20] }];
        audio.animalNearby(herd, false); check(count() === 0, 'Standing near a herd does not trigger walk-by sound');
        audio.animalNearby(herd, true); const greeting = audio.townAnimals.voice;
        check(count() === 1, 'Walking into range starts one nearby greeting');
        audio.townAnimal({ species: 'sheep', position: [2, 1, 20], happy: true });
        check(count() === 1 && audio.townAnimals.voice !== greeting && audio.townAnimals.voice.happy, 'Pet/feed response replaces a walk-by greeting');
        for (let i = 0; i < 30; i++) audio.townAnimal({ species: 'cow', position: [2, 1, 20], happy: true });
        check(count() === 1, 'A burst of thirty calls cannot stack animal voices');
        audio.setMix({ ...DEFAULT_MIX, soundtrack: 'village', effects: 0 });
        check(count() === 0, 'Effects mute immediately stops animal playback');
        audio.setMix({ ...DEFAULT_MIX, soundtrack: 'village' }); await delay(1500);
        audio.setPlace('focus'); audio.setEnvironment({ ...frame(110), listener: [110, 1.4, -3.8], sheltered: true });
        audio.puppyEffect('corgi', [110, 1, -3.8], 'happy');
        audio.townAnimal({ species: 'cow', position: [110, 1, -3.8], happy: true });
        check(count() === 0, 'Private focus rejects outdoor dogs and calls');
        audio.townAnimal({ species: 'cat', position: [111, 1, -3.8], happy: true });
        check(count() === 1 && audio.townAnimals.voice.source.buffer === audio.townAnimals.buffers.get('purr'), 'Private petting uses the recorded cat purr');
        audio.setPlace(null); audio.setEnvironment(frame(0)); check(count() === 0, 'Leaving the private room stops its cat');
        for (const cue of ['water', 'hearth', 'rest', 'village']) {
          audio.setMix({ ...DEFAULT_MIX, soundtrack: cue });
          const deadline = performance.now() + 10000;
          while (audio.soundtrack.current !== cue && performance.now() < deadline) await delay(25);
          check(audio.soundtrack.current === cue && audio.soundtrack.decks.filter(deck => !deck.audio.paused).length === 1, `${cue}: exactly one music recording plays after selection`);
        }
        check(maxMusic === 1, 'Ten-millisecond observation sees no overlapping music recordings during changes');
        const originalRest = RECORDINGS.rest.file;
        RECORDINGS.rest.file = 'missing-audio-check.mp3';
        try { await audio.soundtrack.start('rest'); } catch { /* Expected failed cue. */ }
        finally { RECORDINGS.rest.file = originalRest; }
        check(audio.soundtrack.current === 'village' && !audio.soundtrack.decks[audio.soundtrack.active].audio.paused,
          'A failed music load preserves the preceding single recording');

        if (capture) {
          const destination = audio.context.createMediaStreamDestination(); compressor.connect(destination);
          const recorder = new MediaRecorder(destination.stream), chunks = [];
          recorder.ondataavailable = event => chunks.push(event.data);
          const stopped = new Promise(resolve => { recorder.onstop = resolve; });
          recorder.start(); const began = audio.context.currentTime;
          await delay(2000);
          for (const species of ['cow', 'sheep', 'lamb', 'hedgehog', 'owl', 'horse', 'dog', 'duck', 'duckling', 'swan', 'dove', 'cat']) {
            if (species === 'cat') {
              audio.setPlace('focus'); audio.setEnvironment({ ...frame(110), listener: [110, 1.4, -3.8], sheltered: true });
            }
            const position = species === 'cat' ? [111.5, 1.3, -3.8] : [2, 1, 20];
            timeline.push({ seconds: audio.context.currentTime - began, species, event: 'pet/feed', distance: 2 });
            audio.townAnimal({ species, position, happy: true });
            await delay(3800);
          }
          audio.setPlace(null); audio.setEnvironment(frame(0));
          timeline.push({ seconds: audio.context.currentTime - began, species: 'horse', event: 'response', distance: 8 });
          audio.townAnimal({ species: 'horse', position: [8, 1, 20], happy: true });
          await delay(3500);
          recorder.stop(); await stopped;
          const blob = new Blob(chunks, { type: recorder.mimeType });
          await window.saveMix([...new Uint8Array(await blob.arrayBuffer())]);
          compressor.disconnect(destination);
        }
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'));
        audio.townAnimal({ species: 'owl', position: [2, 1, 20], happy: true }); check(count() === 0, 'A hidden tab cannot play or retain animal calls');
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange'));
        audio.stop(); await delay(450);
        check(audio.context.state === 'suspended' && count() === 0, 'Sound off stops animals and suspends playback');
        check(peak > .001 && peak < .95, 'Representative compressor output is audible and has clipping headroom');
        return { checks, timeline, peak, maxPlayingMusic: maxMusic };
      } finally { clearInterval(watcher); audio.dispose(); AudioContext.prototype.createDynamicsCompressor = original; }
    }, process.env.CAPTURE !== '0');
    assert.deepEqual(errors, []); result.pageErrors = errors;
    fs.writeFileSync(path.join(output, 'browser-checks.json'), JSON.stringify(result, null, 2));
    console.log(`${result.checks.length} browser audio checks passed; peak=${result.peak.toFixed(4)}, max music=${result.maxPlayingMusic}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });

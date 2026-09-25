import { DEFAULT_MIX, PLACES, type AudioMix, type PlaceId, type Weather } from "./places";
import type { EnvironmentFrame, Surface, WorldContact } from "./environment";
import { HEARTH, riverX } from "./environment";
import { VillageScore, type ScoreEvent } from "./composition";
import { withBasePath } from "@/lib/basePath";

type Voice = { source: AudioScheduledSourceNode; nodes: AudioNode[]; end: number; effect: boolean };

// Explicit activation only. Composition, environmental loops and contact effects have separate routing.
export class VillageAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private music?: GainNode;
  private ambience?: GainNode;
  private effects?: GainNode;
  private reverb?: ConvolverNode;
  private rain?: GainNode;
  private fire?: GainNode;
  private wind?: GainNode;
  private water?: GainNode;
  private firePan?: PannerNode;
  private waterPan?: PannerNode;
  private shelter?: BiquadFilterNode;
  private timer?: ReturnType<typeof setInterval>;
  private suspension?: ReturnType<typeof setTimeout>;
  private enabled = false;
  private disposed = false;
  private mix: AudioMix = DEFAULT_MIX;
  private place: PlaceId | null = null;
  private environment: EnvironmentFrame = { listener: [0, 1.4, 20], forward: [0, 0, -1], wind: .3, weather: "golden", sheltered: false };
  private piano = new Map<number, AudioBuffer>();
  private loading?: Promise<void>;
  private loadAbort = new AbortController();
  private noise?: AudioBuffer;
  private loops: AudioBufferSourceNode[] = [];
  private voices = new Set<Voice>();
  private score = new VillageScore();
  private queue: { event: ScoreEvent; time: number; duration: number; vibe: AudioMix["vibe"] }[] = [];
  private nextBar = 0;
  private nextDetail = 0;
  private steps = new Map<Surface, AudioBuffer[]>();
  private lastStep = -1;
  private onVisibility = () => this.apply();

  constructor() { document.addEventListener("visibilitychange", this.onVisibility); }

  private graph() {
    const c = new AudioContext(); this.context = c;
    this.master = c.createGain(); this.master.gain.value = 0;
    const compressor = c.createDynamicsCompressor();
    compressor.threshold.value = -12; compressor.knee.value = 12; compressor.ratio.value = 4;
    compressor.attack.value = .008; compressor.release.value = .3;
    this.master.connect(compressor).connect(c.destination);
    this.music = c.createGain(); this.music.connect(this.master);
    this.ambience = c.createGain(); this.ambience.connect(this.master);
    this.effects = c.createGain(); this.effects.connect(this.master);
    this.shelter = c.createBiquadFilter(); this.shelter.type = "lowpass";
    this.shelter.connect(this.ambience);
    this.reverb = c.createConvolver();
    const ir = c.createBuffer(2, c.sampleRate * 1.8, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const a = ir.getChannelData(ch);
      for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / a.length) ** 3 * .22;
    }
    this.reverb.buffer = ir;
    const wet = c.createGain(); wet.gain.value = .16;
    this.reverb.connect(wet).connect(this.music);
    this.noise = c.createBuffer(1, c.sampleRate * 6, c.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const bed = (frequency: number, highpass: number, rate: number) => {
      const source = c.createBufferSource(); source.buffer = this.noise!; source.loop = true; source.playbackRate.value = rate;
      const low = c.createBiquadFilter(); low.type = "lowpass"; low.frequency.value = frequency;
      const high = c.createBiquadFilter(); high.type = "highpass"; high.frequency.value = highpass;
      const gain = c.createGain(); gain.gain.value = 0;
      source.connect(high).connect(low).connect(gain); source.start(); this.loops.push(source);
      return gain;
    };
    this.rain = bed(2300, 450, 1); this.rain.connect(this.shelter);
    this.wind = bed(620, 90, .73); this.wind.connect(this.shelter);
    this.water = bed(1650, 230, .89); this.waterPan = this.panner([riverX(20), -.2, 20], 5);
    this.water.connect(this.waterPan).connect(this.shelter);
    this.fire = bed(320, 50, .51); this.firePan = this.panner([HEARTH.x, .5, HEARTH.z], 3);
    this.fire.connect(this.firePan).connect(this.ambience);
    this.makeFootsteps();
  }
  async start() {
    if (this.disposed) return { sampled: false };
    if (!this.context) this.graph();
    clearTimeout(this.suspension);
    const c = this.context!;
    await c.resume();
    if (!this.loading) this.loading = Promise.all(([
      ["A1", 33], ["C2", 36], ["Ds2", 39], ["Fs2", 42], ["A2", 45], ["C3", 48], ["Ds3", 51],
      ["Fs3", 54], ["A3", 57], ["C4", 60], ["Ds4", 63], ["Fs4", 66], ["A4", 69], ["C5", 72],
    ] as const).map(async ([name, midi]) => {
      try {
        const res = await fetch(withBasePath(`/village/audio/${name}.mp3`), { signal: this.loadAbort.signal });
        if (!res.ok) return;
        const buffer = await c.decodeAudioData(await res.arrayBuffer());
        if (!this.disposed) this.piano.set(midi, buffer);
      } catch { /* A reported soft-synthesis fallback keeps sound controls usable. */ }
    })).then(() => {});
    await this.loading;
    if (this.disposed) return { sampled: false };
    this.enabled = true; this.queue = []; this.nextBar = c.currentTime + .12; this.nextDetail = c.currentTime + 5;
    this.apply();
    if (this.mix.master === 0) await c.suspend();
    this.schedule();
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 80);
    return { sampled: this.piano.size === 14 };
  }
  stop() {
    this.enabled = false; this.queue = [];
    if (this.timer) clearInterval(this.timer); this.timer = undefined;
    if (!this.context) return;
    this.master?.gain.setTargetAtTime(0, this.context.currentTime, .06);
    clearTimeout(this.suspension);
    this.suspension = setTimeout(() => {
      if (!this.enabled && !this.disposed) { this.clearVoices(); void this.context?.suspend(); }
    }, 350);
  }
  setMix(m: AudioMix) {
    const wasSilent = this.mix.master === 0;
    this.mix = m; this.apply();
    if (this.enabled && this.context) {
      if (m.master === 0) {
        this.queue = []; this.clearVoices(); void this.context.suspend();
      } else if (wasSilent) {
        this.nextBar = this.context.currentTime + .1; void this.context.resume();
      }
    }
  }
  setPlace(place: PlaceId | null) {
    const previous = this.place; this.place = place;
    if (previous !== place && (place === "focus" || previous === "focus")) this.interaction("door");
    if (previous !== place && place === "compliment") this.interaction("paper");
    const destination = PLACES.find(p => p.id === place);
    this.environment = { ...this.environment, sheltered: place === "focus",
      listener: place === "focus" ? [110, 1.8, -3.8] : destination ? [...destination.look] : [.3, 1.4, 20] };
    this.apply();
  }
  setWeather(weather: Weather) { this.environment = { ...this.environment, weather }; this.applyWorld(); }
  setEnvironment(frame: EnvironmentFrame) { this.environment = frame; this.applyWorld(); }
  private apply() {
    const c = this.context; if (!c) return;
    this.master?.gain.setTargetAtTime(this.enabled ? this.mix.master * .65 : 0, c.currentTime, .12);
    this.music?.gain.setTargetAtTime(this.mix.music, c.currentTime, .5);
    this.effects?.gain.setTargetAtTime(document.hidden ? 0 : (this.mix.effects ?? .6), c.currentTime, .2);
    this.ambience?.gain.setTargetAtTime(document.hidden ? 0 : (this.mix.ambience ?? .5), c.currentTime, .8);
    this.applyWorld();
  }
  private applyWorld() {
    const c = this.context; if (!c) return;
    const { listener, forward, sheltered, wind, weather } = this.environment, now = c.currentTime;
    const smooth = (param: AudioParam, value: number) => param.setTargetAtTime(value, now, .12);
    // Firefox exposes the legacy listener methods rather than AudioParam coordinates.
    if (c.listener.positionX) {
      [c.listener.positionX, c.listener.positionY, c.listener.positionZ].forEach((p, i) => smooth(p, listener[i]));
      [c.listener.forwardX, c.listener.forwardY, c.listener.forwardZ].forEach((p, i) => smooth(p, forward[i]));
    } else {
      c.listener.setPosition(...listener);
      c.listener.setOrientation(...forward, 0, 1, 0);
    }
    const shelter = sheltered ? .13 : 1;
    this.rain?.gain.setTargetAtTime(this.mix.rain * .16 * shelter, now, .7);
    this.wind?.gain.setTargetAtTime((.025 + wind * .075) * shelter, now, .35);
    this.water?.gain.setTargetAtTime(.13 * shelter, now, .6);
    this.fire?.gain.setTargetAtTime(this.mix.fire * .16, now, .6);
    this.shelter?.frequency.setTargetAtTime(sheltered ? 950 : weather === "rain" ? 3500 : 6500, now, .7);
    const fire = sheltered ? [112.7, .5, -3.5] : [HEARTH.x, .5, HEARTH.z];
    if (this.firePan) [this.firePan.positionX, this.firePan.positionY, this.firePan.positionZ].forEach((p, i) => smooth(p, fire[i]));
    if (this.waterPan && !sheltered) {
      smooth(this.waterPan.positionX, riverX(listener[2])); smooth(this.waterPan.positionZ, listener[2]);
    }
  }
  private panner(position: number[], distance: number) {
    const p = this.context!.createPanner(); p.panningModel = "equalpower"; p.distanceModel = "inverse";
    p.refDistance = distance; p.maxDistance = 65; p.rolloffFactor = 1.3;
    p.positionX.value = position[0]; p.positionY.value = position[1]; p.positionZ.value = position[2];
    return p;
  }
  private track(source: AudioScheduledSourceNode, nodes: AudioNode[], end: number, effect = false) {
    // All tails count toward the budget. Prefer dropping a quiet new voice to unbounded work.
    const limit = effect ? 16 : 32;
    if ([...this.voices].filter(v => v.effect === effect).length >= limit) {
      nodes.forEach(n => n.disconnect()); source.disconnect(); return false;
    }
    const voice = { source, nodes, end, effect }; this.voices.add(voice);
    source.onended = () => { source.disconnect(); nodes.forEach(n => n.disconnect()); this.voices.delete(voice); };
    return true;
  }
  private clearVoices() {
    for (const voice of this.voices) { try { voice.source.stop(); } catch {} voice.source.disconnect(); voice.nodes.forEach(n => n.disconnect()); }
    this.voices.clear();
  }
  private tone(event: ScoreEvent, when: number, duration: number, vibe: AudioMix["vibe"]) {
    const c = this.context!;
    const gain = c.createGain(), filter = c.createBiquadFilter(); filter.type = "lowpass";
    filter.frequency.value = vibe === "lofi" ? 1450 : event.instrument === "bass" ? 450 : 3300;
    gain.connect(filter).connect(this.music!);
    if (event.instrument === "piano") filter.connect(this.reverb!);
    const end = when + Math.max(.15, duration);
    const volume = event.velocity * (event.instrument === "bass" ? .75 : vibe === "piano" ? 6 : 4);
    gain.gain.setValueAtTime(0, when); gain.gain.linearRampToValueAtTime(volume, when + .008);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001, volume * .32), when + Math.min(.35, duration * .4));
    gain.gain.exponentialRampToValueAtTime(.0001, end);
    let source: AudioBufferSourceNode | OscillatorNode;
    if (event.instrument === "piano" && this.piano.size) {
      const key = [...this.piano.keys()].reduce((a, b) => Math.abs(a - event.midi) < Math.abs(b - event.midi) ? a : b);
      source = c.createBufferSource(); source.buffer = this.piano.get(key)!; source.playbackRate.value = 2 ** ((event.midi - key) / 12);
    } else {
      source = c.createOscillator(); source.type = event.instrument === "bass" ? "triangle" : "sine";
      source.frequency.value = 440 * 2 ** ((event.midi - 69) / 12);
    }
    source.connect(gain);
    if (this.track(source, [gain, filter], end)) { source.start(when); source.stop(end + .03); }
  }
  private percussion(event: ScoreEvent, when: number, duration: number) {
    const c = this.context!, gain = c.createGain(), filter = c.createBiquadFilter();
    let source: OscillatorNode | AudioBufferSourceNode;
    if (event.instrument === "kick") {
      source = c.createOscillator(); source.frequency.setValueAtTime(95, when); source.frequency.exponentialRampToValueAtTime(43, when + .13);
      filter.type = "lowpass"; filter.frequency.value = 200;
    } else {
      source = c.createBufferSource(); source.buffer = this.noise!;
      filter.type = "highpass"; filter.frequency.value = event.instrument === "hat" ? 6500 : 1500;
    }
    gain.gain.setValueAtTime(event.velocity * .7, when); gain.gain.exponentialRampToValueAtTime(.0001, when + duration);
    source.connect(filter).connect(gain).connect(this.music!);
    if (this.track(source, [gain, filter], when + duration)) { source.start(when); source.stop(when + duration); }
  }
  private schedule() {
    const c = this.context; if (!c || !this.enabled || c.state !== "running" || this.mix.master === 0) return;
    if (this.nextBar < c.currentTime - .5) { this.nextBar = c.currentTime + .08; this.queue = []; }
    if (this.nextBar < c.currentTime + .24) {
      const vibe = this.mix.vibe, plan = this.score.next(vibe, this.place === "focus" || this.place === "breathe");
      const beat = 60 / plan.tempo;
      this.queue.push(...plan.events.map(event => ({ event, time: this.nextBar + event.beat * beat, duration: event.duration * beat, vibe })));
      this.nextBar += beat * 4;
    }
    while (this.queue.length && this.queue[0].time < c.currentTime + .24) {
      const item = this.queue.shift()!;
      if (item.time < c.currentTime - .03 || this.mix.music === 0) continue;
      if (item.event.instrument === "piano" || item.event.instrument === "bass") this.tone(item.event, item.time, item.duration, item.vibe);
      else this.percussion(item.event, item.time, item.duration);
    }
    if (!document.hidden && c.currentTime > this.nextDetail) {
      this.nextDetail = c.currentTime + 4 + Math.random() * 8;
      if (this.place === "music" || this.place === "focus") this.interaction("fire");
      else if (this.environment.weather !== "rain") this.bird();
    }
  }
  private makeFootsteps() {
    const c = this.context!;
    for (const surface of ["stone", "wood", "soil", "grass"] as const) {
      const variations: AudioBuffer[] = [];
      for (let variant = 0; variant < 6; variant++) {
        const duration = surface === "grass" ? .19 : .12;
        const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * duration), c.sampleRate), a = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < a.length; i++) {
          const t = i / c.sampleRate, noise = Math.random() * 2 - 1;
          last = last * .65 + noise * .35;
          const pitch = (surface === "wood" ? 155 : surface === "stone" ? 95 : 65) + variant * 7;
          const thud = Math.sin(t * Math.PI * 2 * pitch) * Math.exp(-t * 55);
          const grit = (surface === "stone" ? noise : last) * Math.exp(-t * (surface === "grass" ? 26 : 65));
          a[i] = (thud * .35 + grit * .5) * Math.min(1, t * 1200) * (1 - i / a.length);
        }
        variations.push(buffer);
      }
      this.steps.set(surface, variations);
    }
  }
  contact(event: WorldContact) {
    if (!this.enabled || !this.context || document.hidden || this.mix.master === 0) return;
    const c = this.context, source = c.createBufferSource(), gain = c.createGain();
    let variation = Math.floor(Math.random() * 6); if (variation === this.lastStep) variation = (variation + 1) % 6; this.lastStep = variation;
    source.buffer = this.steps.get(event.surface)![variation]; source.playbackRate.value = .96 + Math.random() * .08;
    const level = event.kind === "landing" ? Math.min(.6, event.impact * .065) : event.kind === "takeoff" ? .11 : .16 + event.speed * .016;
    gain.gain.value = level;
    const panner = this.panner(event.position, 2);
    source.connect(gain).connect(panner).connect(this.effects!);
    if (this.track(source, [gain, panner], c.currentTime + .3, true)) source.start();
  }
  private interaction(kind: "door" | "paper" | "fire") {
    if (!this.enabled || !this.context || document.hidden) return;
    const c = this.context, source = c.createBufferSource(), gain = c.createGain(), filter = c.createBiquadFilter();
    source.buffer = this.noise!; const duration = kind === "door" ? .32 : kind === "paper" ? .25 : .07;
    filter.type = "bandpass"; filter.frequency.value = kind === "door" ? 210 : kind === "paper" ? 2600 : 950;
    gain.gain.setValueAtTime(kind === "fire" ? .055 * this.mix.fire : .08, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, c.currentTime + duration);
    source.connect(filter).connect(gain).connect(this.effects!);
    if (this.track(source, [gain, filter], c.currentTime + duration, true)) { source.start(0, Math.random() * 4); source.stop(c.currentTime + duration); }
  }
  private bird() {
    const c = this.context!;
    if ((this.mix.ambience ?? .5) === 0) return;
    const source = c.createOscillator(), gain = c.createGain(), now = c.currentTime;
    const pitch = 1500 + Math.random() * 750;
    source.frequency.setValueAtTime(pitch, now); source.frequency.exponentialRampToValueAtTime(pitch * 1.4, now + .08);
    source.frequency.exponentialRampToValueAtTime(pitch * .9, now + .18);
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(.023, now + .02); gain.gain.exponentialRampToValueAtTime(.0001, now + .2);
    const origin = this.environment.listener;
    const panner = this.panner([origin[0] - 7 + Math.random() * 14, 6, origin[2] - 10], 4);
    source.connect(gain).connect(panner).connect(this.ambience!);
    if (this.track(source, [gain, panner], now + .22, true)) { source.start(); source.stop(now + .22); }
  }
  chime() {
    if (!this.enabled || !this.context) return;
    [72, 76, 79].forEach((midi, i) => this.tone({ instrument: "piano", midi, beat: 0, duration: 2, velocity: .07 }, this.context!.currentTime + i * .22, 2, "piano"));
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.stop(); clearTimeout(this.suspension); this.loadAbort.abort();
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.clearVoices(); this.loops.forEach(s => { s.stop(); s.disconnect(); }); this.piano.clear(); this.steps.clear();
    void this.context?.close();
  }
}

import { DEFAULT_MIX, PLACES, type AudioMix, type PlaceId, type Weather } from "./places";
import type { EnvironmentFrame, Surface, WorldContact } from "./environment";
import { HEARTH, riverX } from "./environment";
import { RecordedSoundtrack, soundtrackFor } from "./soundtrack";
import { withBasePath } from "@/lib/basePath";

type Voice = { source: AudioScheduledSourceNode; nodes: AudioNode[]; end: number; effect: boolean };

// Explicit activation only. Recorded music, environmental loops and effects have separate buses.
export class VillageAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private music?: GainNode;
  private ambience?: GainNode;
  private effects?: GainNode;
  private soundtrack?: RecordedSoundtrack;
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
  private recordings = new Map<string, { buffer: AudioBuffer; gain: GainNode; next: number }>();
  private loading?: Promise<boolean>;
  private loadAbort = new AbortController();
  private noise?: AudioBuffer;
  private loops: AudioBufferSourceNode[] = [];
  private voices = new Set<Voice>();
  private nextDetail = 0;
  private steps = new Map<Surface, AudioBuffer[]>();
  private lastStep = -1;
  private onVisibility = () => this.apply();

  constructor(private onIssue: (kind: "music" | "ambience") => void = () => {}) { document.addEventListener("visibilitychange", this.onVisibility); }

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
    this.soundtrack = new RecordedSoundtrack(c, this.music, () => this.onIssue("music"));
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
    this.rain = c.createGain(); this.rain.connect(this.shelter);
    this.wind = bed(620, 90, .73); this.wind.connect(this.shelter);
    this.water = c.createGain(); this.waterPan = this.panner([riverX(20), -.2, 20], 5);
    this.water.connect(this.waterPan).connect(this.shelter);
    this.fire = c.createGain(); this.firePan = this.panner([HEARTH.x, .5, HEARTH.z], 3);
    this.fire.connect(this.firePan).connect(this.ambience);
    this.makeFootsteps();
  }
  private async loadWorldRecordings() {
    if (this.recordings.size === 3) return true;
    if (!this.loading) this.loading = Promise.all((["fire", "stream", "rain"] as const).map(async name => {
      if (this.recordings.has(name)) return;
      try {
        const response = await fetch(withBasePath(`/village/audio/world/${name}.mp3`), { signal: this.loadAbort.signal });
        if (!response.ok) return;
        const buffer = await this.context!.decodeAudioData(await response.arrayBuffer());
        if (!this.disposed) this.recordings.set(name, { buffer, gain: name === "fire" ? this.fire! : name === "stream" ? this.water! : this.rain!, next: 0 });
      } catch { /* Report partial ambience availability; retry missing recordings on the next start. */ }
    })).then(() => this.recordings.size === 3).finally(() => { this.loading = undefined; });
    return this.loading;
  }
  async start() {
    if (this.disposed) throw new Error("Audio was disposed.");
    if (!this.context) this.graph();
    clearTimeout(this.suspension);
    const c = this.context!;
    await c.resume();
    if (this.disposed) throw new Error("Audio was disposed.");
    this.enabled = true;
    const cue = soundtrackFor(this.mix, this.place, this.environment);
    const [ambience] = await Promise.all([
      this.loadWorldRecordings(),
      this.mix.music > 0 && this.mix.master > 0 ? this.soundtrack!.start(cue) : Promise.resolve(),
    ]);
    if (this.disposed) throw new Error("Audio was disposed.");
    this.recordings.forEach(recording => recording.next = 0);
    this.nextDetail = c.currentTime + 5; this.apply();
    if (this.mix.master === 0) await c.suspend();
    this.schedule();
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 80);
    return { recorded: true, ambience };
  }
  stop() {
    this.enabled = false;
    if (this.timer) clearInterval(this.timer); this.timer = undefined;
    if (!this.context) return;
    this.master?.gain.setTargetAtTime(0, this.context.currentTime, .06);
    clearTimeout(this.suspension);
    this.suspension = setTimeout(() => {
      if (!this.enabled && !this.disposed) { this.soundtrack?.pause(); this.clearVoices(); void this.context?.suspend(); }
    }, 350);
  }
  setMix(m: AudioMix) {
    const wasMasterSilent = this.mix.master === 0;
    const wasSilent = wasMasterSilent || this.mix.music === 0;
    this.mix = m; this.apply();
    this.soundtrack?.request(soundtrackFor(m, this.place, this.environment), true);
    if (this.enabled && this.context) {
      if (m.master === 0) {
        this.soundtrack?.pause(); this.clearVoices(); this.recordings.forEach(r => r.next = 0);
        void this.context.suspend();
      } else {
        if (wasMasterSilent) void this.context.resume();
        if (m.music === 0) this.soundtrack?.pause();
        else if (wasSilent) {
          void this.context.resume().then(() => {
            if (this.enabled && this.mix.master > 0 && this.mix.music > 0) return this.soundtrack?.start(soundtrackFor(this.mix, this.place, this.environment));
          }).catch(() => this.onIssue("music"));
        }
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
    this.soundtrack?.request(soundtrackFor(this.mix, place, this.environment), true);
    this.apply();
  }
  setWeather(weather: Weather) { this.environment = { ...this.environment, weather }; this.applyWorld(); }
  setEnvironment(frame: EnvironmentFrame) { this.environment = frame; this.applyWorld(); }
  private apply() {
    const c = this.context; if (!c) return;
    this.master?.gain.setTargetAtTime(this.enabled ? this.mix.master * .65 : 0, c.currentTime, .12);
    this.music?.gain.setTargetAtTime(this.mix.music * 1.6, c.currentTime, .5);
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
    this.rain?.gain.setTargetAtTime((this.mix.rain + (weather === "rain" ? .55 : 0)) * shelter, now, .7);
    this.wind?.gain.setTargetAtTime((.012 + wind * .035) * shelter, now, .35);
    this.water?.gain.setTargetAtTime(.65 * shelter, now, .6);
    this.fire?.gain.setTargetAtTime(this.mix.fire * 1.2, now, .6);
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
  private schedule() {
    const c = this.context; if (!c || !this.enabled || c.state !== "running" || this.mix.master === 0) return;
    this.soundtrack?.request(soundtrackFor(this.mix, this.place, this.environment));
    this.soundtrack?.tick();
    for (const recording of this.recordings.values()) {
      if (recording.next > c.currentTime + .2) continue;
      const when = Math.max(c.currentTime, recording.next), duration = recording.buffer.duration, fade = .8;
      const source = c.createBufferSource(), gain = c.createGain(); source.buffer = recording.buffer;
      gain.gain.setValueAtTime(0, when); gain.gain.linearRampToValueAtTime(1, when + fade);
      gain.gain.setValueAtTime(1, when + duration - fade); gain.gain.linearRampToValueAtTime(0, when + duration);
      source.connect(gain).connect(recording.gain);
      if (this.track(source, [gain], when + duration)) source.start(when);
      recording.next = when + duration - fade;
    }
    if (!document.hidden && c.currentTime > this.nextDetail) {
      this.nextDetail = c.currentTime + 7 + Math.random() * 10;
      if (!this.environment.sheltered && this.environment.weather === "golden") this.bird();
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
    if (!this.enabled || !this.context || document.hidden) return;
    const c = this.context;
    [880, 1174.66].forEach((frequency, i) => {
      const source = c.createOscillator(), gain = c.createGain(), when = c.currentTime + i * .13;
      source.frequency.value = frequency;
      gain.gain.setValueAtTime(0, when); gain.gain.linearRampToValueAtTime(.045, when + .01);
      gain.gain.exponentialRampToValueAtTime(.0001, when + .75);
      source.connect(gain).connect(this.effects!);
      if (this.track(source, [gain], when + .8, true)) { source.start(when); source.stop(when + .8); }
    });
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.stop(); clearTimeout(this.suspension); this.loadAbort.abort();
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.clearVoices(); this.loops.forEach(s => { s.stop(); s.disconnect(); }); this.recordings.clear(); this.steps.clear(); this.soundtrack?.dispose();
    void this.context?.close();
  }
}

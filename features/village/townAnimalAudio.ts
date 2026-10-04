import { withBasePath } from "@/lib/basePath";

export type AnimalSpecies = "cow" | "sheep" | "lamb" | "hedgehog" | "owl" | "horse" | "dog" | "duck" | "duckling" | "swan" | "dove" | "cat";
export type TownAnimalSoundEvent = { species: AnimalSpecies; position: [number, number, number]; happy: boolean };
export type AnimalSoundSource = { id: string; species: AnimalSpecies; position: [number, number, number] };

const CLIPS = {
  cow: "animals/cow.mp3", sheep: "animals/sheep.mp3", lamb: "animals/lamb.mp3", hedgehog: "animals/hedgehog.mp3",
  owl: "animals/owl.mp3", horse: "animals/horse.mp3", duck: "animals/duck.mp3", duckling: "animals/duckling.mp3",
  swan: "animals/swan.mp3", dove: "animals/dove.mp3", cat: "animals/cat.mp3", purr: "animals/purr.mp3",
  dog: "puppies/mochi-yip.mp3", shiba: "puppies/kiko-yip.mp3", beagle: "puppies/biscuit-yip.mp3", samoyed: "puppies/cloud-yip.mp3",
} as const;
const LEVELS: Record<AnimalSpecies, number> = {
  cow: .9, sheep: .8, lamb: .7, hedgehog: .45, owl: .8, horse: .85, dog: .26,
  duck: .75, duckling: .6, swan: .65, dove: .7, cat: .6,
};

/** One shared call channel gives nearby interactions priority over occasional greetings. */
export class TownAnimalAudio {
  private buffers = new Map<string, AudioBuffer>();
  private loading?: Promise<boolean>;
  private abort = new AbortController();
  private disposed = false;
  private voice?: { source: AudioBufferSourceNode; gain: GainNode; pan: PannerNode; happy: boolean };
  private lastCall = -Infinity;
  private lastInteraction = -Infinity;
  private speciesCalls = new Map<AnimalSpecies, number>();
  private greetings = new Map<string, number>();
  private heard = new Set<string>();

  constructor(private context: AudioContext, private output: GainNode, private duck: (duration: number, event: TownAnimalSoundEvent) => void = () => {}) {}

  load() {
    if (!this.loading) this.loading = Promise.all(Object.entries(CLIPS).map(async ([key, file]) => {
      if (this.buffers.has(key)) return;
      try {
        const response = await fetch(withBasePath(`/village/audio/${file}`), { signal: this.abort.signal });
        if (!response.ok) return;
        const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
        if (!this.disposed) this.buffers.set(key, buffer);
      } catch { /* Missing optional calls are retried on the next explicit sound start. */ }
    })).then(() => this.buffers.size === Object.keys(CLIPS).length).finally(() => { this.loading = undefined; });
    return this.loading;
  }

  play(event: TownAnimalSoundEvent, clip: keyof typeof CLIPS = event.species === "cat" && event.happy ? "purr" : event.species) {
    const c = this.context, now = c.currentTime, buffer = this.buffers.get(clip);
    if (this.disposed || c.state !== "running" || !buffer) return false;
    if (event.happy) {
      if (now - this.lastInteraction < .8 || this.voice?.happy) return false;
    } else if (this.voice || now - this.lastCall < 6 || now - (this.speciesCalls.get(event.species) ?? -Infinity) < 18) return false;
    this.stopVoice();
    const source = c.createBufferSource(), gain = c.createGain(), pan = c.createPanner();
    source.buffer = buffer; source.playbackRate.value = .97 + Math.random() * .06;
    gain.gain.value = LEVELS[event.species] * 1.35 * (event.happy ? 1 : .7);
    pan.panningModel = "equalpower"; pan.distanceModel = "inverse"; pan.refDistance = 2; pan.maxDistance = 12; pan.rolloffFactor = 2;
    if (pan.positionX) { pan.positionX.value = event.position[0]; pan.positionY.value = event.position[1]; pan.positionZ.value = event.position[2]; }
    else pan.setPosition(...event.position);
    source.connect(gain).connect(pan).connect(this.output);
    const voice = { source, gain, pan, happy: event.happy }; this.voice = voice;
    source.onended = () => {
      source.disconnect(); gain.disconnect(); pan.disconnect();
      if (this.voice === voice) this.voice = undefined;
    };
    this.lastCall = now; this.speciesCalls.set(event.species, now);
    if (event.happy) this.lastInteraction = now;
    this.duck(buffer.duration / source.playbackRate.value + .25, event);
    source.start();
    return true;
  }

  nearby(sources: AnimalSoundSource[], listener: [number, number, number], walking: boolean) {
    const nearby = sources.map(source => ({ source, distance: Math.hypot(source.position[0] - listener[0], source.position[2] - listener[2]) }));
    const present = new Set(nearby.filter(entry => entry.distance < 9).map(entry => entry.source.id));
    for (const id of this.heard) if (!present.has(id)) this.heard.delete(id);
    if (!walking) return;
    const now = this.context.currentTime;
    const candidate = nearby.filter(({ source, distance }) => distance < 5.5 && !this.heard.has(source.id)
      && now - (this.greetings.get(source.id) ?? -Infinity) >= 45).sort((a, b) => a.distance - b.distance)[0];
    if (candidate && this.play({ ...candidate.source, happy: false })) {
      // A flock/herd answers once per approach, rather than taking turns around the player.
      nearby.filter(entry => entry.distance < 9).forEach(entry => this.heard.add(entry.source.id));
      this.greetings.set(candidate.source.id, now);
    }
  }

  private stopVoice() {
    const voice = this.voice; if (!voice) return;
    voice.source.onended = null; voice.source.stop(); voice.source.disconnect(); voice.gain.disconnect(); voice.pan.disconnect();
    this.voice = undefined;
  }
  stop() { this.stopVoice(); this.heard.clear(); this.lastInteraction = -Infinity; }
  dispose() { this.disposed = true; this.abort.abort(); this.stop(); this.buffers.clear(); this.speciesCalls.clear(); this.greetings.clear(); }
}

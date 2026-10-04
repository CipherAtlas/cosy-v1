import { withBasePath } from "@/lib/basePath";
import { HEARTH, type EnvironmentFrame } from "./environment";
import type { AudioMix, PlaceId } from "./places";

export const RECORDINGS = {
  village: { file: "quiet-village-1.mp3", title: "Quiet Village 1" },
  water: { file: "quiet-village-2.mp3", title: "Quiet Village 2" },
  rest: { file: "quiet-village-3.mp3", title: "Quiet Village 3" },
  hearth: { file: "quiet-village-4.mp3", title: "Quiet Village 4" },
} as const;
export type SoundtrackId = keyof typeof RECORDINGS;
export type RadioTrack = { id: string; title: string; artist: string; permalink: string; duration: number };

export function soundtrackFor(mix: AudioMix, place: PlaceId | null, frame: EnvironmentFrame): SoundtrackId {
  if (mix.soundtrack && mix.soundtrack !== "auto") return mix.soundtrack;
  if (place === "focus" || place === "gratitude") return "rest";
  if (place === "music") return "hearth";
  if (place === "breathe" || place === "mood") return "water";
  const [x,,z] = frame.listener;
  if (Math.hypot(x-HEARTH.x,z-HEARTH.z)<8) return "hearth";
  if (Math.hypot(x+21,z+9)<10 || Math.hypot(x-15,z+10)<7) return "water";
  if (frame.sheltered || frame.weather !== "golden" || Math.hypot(x+22,z-7)<6) return "rest";
  return "village";
}

/** Two loading decks, with only one playing; a failed change restores the previous cue. */
export class RecordedSoundtrack {
  private decks: { audio: HTMLAudioElement; source: MediaElementAudioSourceNode; gain: GainNode; cue?: SoundtrackId | RadioTrack }[];
  private active = -1;
  private candidate?: SoundtrackId;
  private candidateSince = 0;
  private changedAt = -100;
  private loading = false;
  private enabled = false;
  private disposed = false;
  private generation = 0;
  private cancelLoad?: () => void;
  private failed?: SoundtrackId;
  private radio: RadioTrack | null = null;

  constructor(private context: AudioContext, bus: GainNode, private onError: () => void, private onRadioEnded: () => void = () => {}) {
    this.decks = [0,1].map(()=>{
      const audio = new Audio(); audio.preload="none";audio.loop=true;audio.crossOrigin="anonymous";
      const source=context.createMediaElementSource(audio),gain=context.createGain();gain.gain.value=0;
      source.connect(gain).connect(bus);return {audio,source,gain};
    });
    this.decks.forEach((deck, index) => { deck.audio.onended = () => {
      if (this.enabled && this.active === index && typeof deck.cue !== "string") this.onRadioEnded();
    }; });
  }
  get current() { return this.active < 0 ? null : this.decks[this.active].cue ?? null; }
  private key(cue: SoundtrackId | RadioTrack) { return typeof cue === "string" ? cue : `radio:${cue.id}`; }
  async start(cue: SoundtrackId) {
    if (this.disposed) return;
    this.enabled=true;this.failed=undefined;this.candidate=cue;
    const next = this.radio ?? cue;
    if(this.current && this.key(this.current) === this.key(next) && this.decks[this.active].audio.readyState>=2) {
      await this.decks[this.active].audio.play();
      if (!this.enabled || this.disposed) return;
      const gain = this.decks[this.active].gain.gain;
      gain.cancelScheduledValues(this.context.currentTime);
      gain.setTargetAtTime(typeof next === "string" ? 1 : .7,this.context.currentTime,.5);
    } else await this.change(next);
  }
  async selectRadio(track: RadioTrack) {
    this.radio = track;
    if (this.enabled && (!this.current || this.key(this.current) !== this.key(track))) await this.change(track);
  }
  async leaveRadio(cue: SoundtrackId) {
    this.radio = null;
    this.request(cue, true);
    if (this.enabled && this.current !== cue) await this.change(cue);
  }
  request(cue: SoundtrackId, immediate=false) {
    if (this.radio) return;
    if(cue!==this.candidate) { this.candidate=cue;this.candidateSince=this.context.currentTime;this.failed=undefined; }
    if(immediate) { this.candidateSince=-100;this.changedAt=-100; }
  }
  tick() {
    const now=this.context.currentTime;
    if(this.radio || !this.enabled || this.loading || !this.candidate || this.failed===this.candidate || this.current===this.candidate) return;
    // Hysteresis prevents a new track every time the player skirts a garden boundary.
    if(now-this.candidateSince<2.5 || now-this.changedAt<10) return;
    void this.change(this.candidate).catch(()=>this.onError());
  }
  private async change(cue: SoundtrackId | RadioTrack) {
    this.cancelLoad?.();
    const generation=++this.generation,index=this.active===0?1:0,deck=this.decks[index];
    this.loading=true;deck.gain.gain.cancelScheduledValues(this.context.currentTime);deck.gain.gain.value=0;
    try {
      deck.audio.pause();deck.cue=cue;deck.audio.loop=typeof cue === "string";
      await new Promise<void>((resolve,reject)=>{
        const finish=(error?: Error)=>{
          clearTimeout(timeout);deck.audio.removeEventListener("canplay",ready);deck.audio.removeEventListener("error",fail);
          this.cancelLoad=undefined;error?reject(error):resolve();
        };
        const ready=()=>finish(),fail=()=>finish(new Error("The soundtrack could not load."));
        const timeout=setTimeout(fail,15000);
        this.cancelLoad=()=>finish(new Error("Soundtrack loading cancelled."));
        deck.audio.addEventListener("canplay",ready,{once:true});deck.audio.addEventListener("error",fail,{once:true});
        deck.audio.src=typeof cue === "string"
          ? withBasePath(`/village/audio/music/${RECORDINGS[cue].file}`)
          : `https://api.audius.co/v1/tracks/${encodeURIComponent(cue.id)}/stream`;
        deck.audio.load();
      });
      if(this.disposed || !this.enabled || generation!==this.generation) return;
      // Load the next cue in silence, then pause the old recording before starting it.
      if (this.active >= 0) {
        const old = this.decks[this.active];
        old.audio.pause(); old.gain.gain.cancelScheduledValues(this.context.currentTime); old.gain.gain.value = 0;
      }
      await deck.audio.play();
      if(this.disposed || !this.enabled) { deck.audio.pause();return; }
      if(generation!==this.generation) return;
      const now=this.context.currentTime;
      deck.gain.gain.setValueAtTime(0,now);deck.gain.gain.linearRampToValueAtTime(typeof cue === "string" ? 1 : .7,now+.6);
      this.active=index;this.changedAt=now;
    } catch(error) {
      if (generation !== this.generation) return;
      deck.audio.pause();if (typeof cue === "string") this.failed=cue;
      if (!this.disposed && this.enabled && this.active >= 0) {
        const old = this.decks[this.active];
        await old.audio.play();
        if (this.disposed || !this.enabled) { old.audio.pause(); return; }
        if (this.enabled && !this.disposed && generation === this.generation)
          old.gain.gain.setTargetAtTime(typeof old.cue === "string" ? 1 : .7, this.context.currentTime, .2);
      }
      if(!this.disposed && this.enabled) throw error;
    } finally { if (generation === this.generation) this.loading=false; }
  }
  pause() {
    this.enabled=false;this.generation++;this.cancelLoad?.();
    this.loading=false;
    this.decks.forEach(deck=>{deck.audio.pause();deck.gain.gain.cancelScheduledValues(this.context.currentTime);});
  }
  dispose() {
    this.disposed=true;this.pause();
    this.decks.forEach(({audio,source,gain})=>{
      audio.onended=null;
      audio.removeAttribute("src");audio.load();source.disconnect();gain.disconnect();
    });
  }
}

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

/** Two streaming decks bound memory use; a failed change leaves the previous music playing. */
export class RecordedSoundtrack {
  private decks: { audio: HTMLAudioElement; source: MediaElementAudioSourceNode; gain: GainNode; cue?: SoundtrackId }[];
  private active = -1;
  private fading?: { index: number; until: number };
  private candidate?: SoundtrackId;
  private candidateSince = 0;
  private changedAt = -100;
  private loading = false;
  private enabled = false;
  private disposed = false;
  private generation = 0;
  private cancelLoad?: () => void;
  private failed?: SoundtrackId;

  constructor(private context: AudioContext, bus: GainNode, private onError: () => void) {
    this.decks = [0,1].map(()=>{
      const audio = new Audio(); audio.preload="none";audio.loop=true;
      const source=context.createMediaElementSource(audio),gain=context.createGain();gain.gain.value=0;
      source.connect(gain).connect(bus);return {audio,source,gain};
    });
  }
  get current() { return this.active < 0 ? null : this.decks[this.active].cue ?? null; }
  async start(cue: SoundtrackId) {
    if (this.disposed) return;
    this.enabled=true;this.failed=undefined;this.candidate=cue;
    if(this.current===cue && this.decks[this.active].audio.readyState>=2) {
      await this.decks[this.active].audio.play();
      if (!this.enabled || this.disposed) return;
      const gain = this.decks[this.active].gain.gain;
      gain.cancelScheduledValues(this.context.currentTime);
      gain.setTargetAtTime(1,this.context.currentTime,.5);
    } else await this.change(cue);
  }
  request(cue: SoundtrackId, immediate=false) {
    if(cue!==this.candidate) { this.candidate=cue;this.candidateSince=this.context.currentTime;this.failed=undefined; }
    if(immediate) { this.candidateSince=-100;this.changedAt=-100; }
  }
  tick() {
    const now=this.context.currentTime;
    if(this.fading && now>=this.fading.until) {
      this.decks[this.fading.index].audio.pause();this.fading=undefined;
    }
    if(!this.enabled || this.loading || this.fading || !this.candidate || this.failed===this.candidate || this.current===this.candidate) return;
    // Hysteresis prevents a new track every time the player skirts a garden boundary.
    if(now-this.candidateSince<2.5 || now-this.changedAt<10) return;
    void this.change(this.candidate).catch(()=>this.onError());
  }
  private async change(cue: SoundtrackId) {
    this.cancelLoad?.();
    const generation=++this.generation,index=this.active===0?1:0,deck=this.decks[index];
    this.loading=true;deck.gain.gain.cancelScheduledValues(this.context.currentTime);deck.gain.gain.value=0;
    try {
      deck.audio.pause();deck.cue=cue;
      await new Promise<void>((resolve,reject)=>{
        const finish=(error?: Error)=>{
          clearTimeout(timeout);deck.audio.removeEventListener("canplay",ready);deck.audio.removeEventListener("error",fail);
          this.cancelLoad=undefined;error?reject(error):resolve();
        };
        const ready=()=>finish(),fail=()=>finish(new Error("The soundtrack could not load."));
        const timeout=setTimeout(fail,15000);
        this.cancelLoad=()=>finish(new Error("Soundtrack loading cancelled."));
        deck.audio.addEventListener("canplay",ready,{once:true});deck.audio.addEventListener("error",fail,{once:true});
        deck.audio.src=withBasePath(`/village/audio/music/${RECORDINGS[cue].file}`);deck.audio.load();
      });
      if(this.disposed || !this.enabled || generation!==this.generation) return;
      await deck.audio.play();
      if(this.disposed || !this.enabled || generation!==this.generation) { deck.audio.pause();return; }
      const now=this.context.currentTime,previous=this.active;
      deck.gain.gain.setValueAtTime(0,now);deck.gain.gain.linearRampToValueAtTime(1,now+4);
      if(previous>=0) {
        const old=this.decks[previous];old.gain.gain.cancelScheduledValues(now);
        old.gain.gain.setValueAtTime(old.gain.gain.value,now);old.gain.gain.linearRampToValueAtTime(0,now+4);
        this.fading={index:previous,until:now+4.1};
      }
      this.active=index;this.changedAt=now;
    } catch(error) {
      if (generation !== this.generation) return;
      deck.audio.pause();this.failed=cue;
      if(!this.disposed && this.enabled) throw error;
    } finally { if (generation === this.generation) this.loading=false; }
  }
  pause() {
    this.enabled=false;this.generation++;this.cancelLoad?.();
    this.loading=false;
    this.decks.forEach(deck=>{deck.audio.pause();deck.gain.gain.cancelScheduledValues(this.context.currentTime);});
    if(this.fading) { this.decks[this.fading.index].gain.gain.value=0;this.fading=undefined; }
  }
  dispose() {
    this.disposed=true;this.pause();
    this.decks.forEach(({audio,source,gain})=>{
      audio.removeAttribute("src");audio.load();source.disconnect();gain.disconnect();
    });
  }
}

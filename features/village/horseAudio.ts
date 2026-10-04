import type { Surface } from "./environment";

export type HorseSoundEvent = { kind: "hoof" | "breath" | "neigh"; position: [number, number, number]; surface: Surface; speed: number };

/** Original synthesized foley, connected to the existing effects bus and listener. */
export class HorseAudio {
  private buffers = new Map<string, AudioBuffer>();
  private voices = new Set<{ source: AudioBufferSourceNode; gain: GainNode; pan: PannerNode }>();
  private variation = 0;
  constructor(private context: AudioContext, private output: GainNode) {}

  play(event: HorseSoundEvent) {
    const c = this.context;
    if (c.state !== "running" || this.voices.size >= 12) return;
    const variation = this.variation++ % 4, key = `${event.kind}:${event.surface}:${variation}`;
    let buffer = this.buffers.get(key);
    if (!buffer) { buffer = this.createBuffer(event.kind, event.surface, variation); this.buffers.set(key, buffer); }
    const source = c.createBufferSource(), gain = c.createGain(), pan = c.createPanner();
    source.buffer = buffer; source.playbackRate.value = .97 + variation * .018;
    gain.gain.value = event.kind === "hoof" ? .25 + Math.min(event.speed, 7) * .022 : event.kind === "neigh" ? .13 : .15;
    pan.panningModel = "equalpower"; pan.distanceModel = "inverse"; pan.refDistance = event.kind === "hoof" ? 2.3 : 1.8;
    pan.maxDistance = 30; pan.rolloffFactor = 1.7;
    if (pan.positionX) { pan.positionX.value = event.position[0]; pan.positionY.value = event.position[1]; pan.positionZ.value = event.position[2]; }
    else pan.setPosition(...event.position);
    source.connect(gain).connect(pan).connect(this.output);
    const voice = { source, gain, pan }; this.voices.add(voice);
    source.onended = () => { source.disconnect(); gain.disconnect(); pan.disconnect(); this.voices.delete(voice); };
    source.start();
  }

  private createBuffer(kind: HorseSoundEvent["kind"], surface: Surface, variation: number) {
    const c = this.context, duration = kind === "hoof" ? .19 : kind === "breath" ? .68 : 1.35;
    const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * duration), c.sampleRate), data = buffer.getChannelData(0);
    let filtered = 0, phase = 0, seed = 1931 + variation * 617;
    const hard = surface === "stone" || surface === "wood", pitch = (surface === "wood" ? 440 : 710) + variation * 37;
    for (let i = 0; i < data.length; i++) {
      const t = i / c.sampleRate, u = t / duration;
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const noise = seed / 2147483648 - 1; filtered = filtered * .82 + noise * .18;
      if (kind === "hoof") {
        const attack = Math.min(1, t * 1400), body = Math.sin(2 * Math.PI * (hard ? 155 : 105) * t) * Math.exp(-t * 44);
        const click = (Math.sin(2 * Math.PI * pitch * t) * .38 + noise * .32) * Math.exp(-t * (hard ? 105 : 210));
        const scuff = filtered * Math.exp(-t * 26) * (hard ? .1 : .6);
        data[i] = attack * (body * .58 + click * (hard ? .65 : .3) + scuff);
      } else if (kind === "breath") {
        const envelope = Math.sin(Math.PI * u) ** 2 * (.65 + .35 * Math.sin(t * 39) ** 2);
        data[i] = filtered * envelope * .9;
      } else {
        const frequency = 390 + Math.sin(Math.PI * Math.min(1, u * 1.7)) * 180 - u * 160 + Math.sin(t * 53) * (10 + u * 30);
        phase += Math.PI * 2 * frequency / c.sampleRate;
        const voice = Math.sin(phase) * .25 + Math.sin(phase * 2) * .13 + Math.sin(phase * 3) * .07;
        const envelope = Math.min(1, u * 12) * (1 - u) ** 1.3 * (.6 + .4 * Math.sin(t * 27) ** 2);
        data[i] = (voice + filtered * .45) * envelope;
      }
    }
    return buffer;
  }

  stop() {
    for (const voice of this.voices) { voice.source.onended = null; voice.source.stop(); voice.source.disconnect(); voice.gain.disconnect(); voice.pan.disconnect(); }
    this.voices.clear();
  }
  dispose() { this.stop(); this.buffers.clear(); }
}

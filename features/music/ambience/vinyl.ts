import * as Tone from "tone";

const clampVolume = (value: number): number => Math.max(0, Math.min(1, value));

const randomDuration = (): "128n" | "64n" | "32n" => {
  const roll = Math.random();
  if (roll < 0.7) {
    return "128n";
  }
  if (roll < 0.95) {
    return "64n";
  }
  return "32n";
};

export class VinylAmbience {
  private readonly crackleSynth: Tone.NoiseSynth;
  private readonly crackleLoop: Tone.Loop;
  private readonly popLoop: Tone.Loop;
  private readonly driftLoop: Tone.Loop;
  private readonly highpass: Tone.Filter;
  private readonly lowpass: Tone.Filter;
  private readonly gain: Tone.Gain;

  private enabled = false;
  private volume = 0.08;
  private driftFactor = 1;

  constructor(output: Tone.ToneAudioNode) {
    this.gain = new Tone.Gain(0).connect(output);
    this.lowpass = new Tone.Filter({ type: "lowpass", frequency: 5800, rolloff: -24 }).connect(this.gain);
    this.highpass = new Tone.Filter({ type: "highpass", frequency: 900, rolloff: -24 }).connect(this.lowpass);

    this.crackleSynth = new Tone.NoiseSynth({
      volume: -34,
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.022, sustain: 0, release: 0.03 }
    }).connect(this.highpass);

    this.crackleLoop = new Tone.Loop((time) => {
      if (Math.random() > 0.83) {
        this.crackleSynth.triggerAttackRelease(randomDuration(), time, Math.random() * 0.22 + 0.08);
      }

      if (Math.random() > 0.97) {
        this.crackleSynth.triggerAttackRelease("32n", time + Tone.Time("64n").toSeconds(), 0.24);
      }
    }, "16n");

    this.popLoop = new Tone.Loop((time) => {
      if (Math.random() > 0.82) {
        this.crackleSynth.triggerAttackRelease("16n", time, 0.2);
      }
    }, "1m");

    this.driftLoop = new Tone.Loop(() => {
      this.driftFactor = 0.85 + Math.random() * 0.3;
      this.applyGain(2.6);
    }, "2m");
  }

  public setEnabled(next: boolean): void {
    this.enabled = next;

    if (next) {
      this.crackleLoop.start(0);
      this.popLoop.start(0);
      this.driftLoop.start(0);
      this.applyGain(0.35);
      return;
    }

    this.applyGain(0.3);
    this.crackleLoop.stop(0);
    this.popLoop.stop(0);
    this.driftLoop.stop(0);
  }

  public setVolume(next: number): void {
    this.volume = clampVolume(next);
    this.applyGain(0.25);
  }

  public getVolume(): number {
    return this.volume;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public dispose(): void {
    this.crackleLoop.dispose();
    this.popLoop.dispose();
    this.driftLoop.dispose();
    this.crackleSynth.dispose();
    this.highpass.dispose();
    this.lowpass.dispose();
    this.gain.dispose();
  }

  private applyGain(rampSeconds: number): void {
    const target = this.enabled ? this.volume * this.driftFactor : 0;
    this.gain.gain.rampTo(target, rampSeconds);
  }
}

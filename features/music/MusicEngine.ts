import * as Tone from "tone";
import { RainAmbience } from "@/features/music/ambience/rain";
import { VinylAmbience } from "@/features/music/ambience/vinyl";
import { createArrangement, getArrangementBarContext, getSectionAtBar } from "@/features/music/generators/arrangement";
import { generateBassPattern } from "@/features/music/generators/bass";
import { generateChordPlan } from "@/features/music/generators/chords";
import { generateDrumPattern } from "@/features/music/generators/drums";
import { generateMelodyPhrase } from "@/features/music/generators/melody";
import { ArrangementBarContext, BassEvent, DrumEvent, GeneratedTrack, MelodyEvent, MixLayer, MixState, TrackInfo, TrackSection, VibeId, VibeMixPreset } from "@/features/music/types";
import { getVibeProfile } from "@/features/music/vibes";

type InfoListener = (info: TrackInfo) => void;

type DisposableNode = {
  dispose: () => void;
};

type LayerInstrument = {
  triggerAttackRelease(...args: unknown[]): unknown;
  releaseAll?(...args: unknown[]): unknown;
  dispose(): void;
};

type InstrumentSet = {
  chords: LayerInstrument;
  melody: LayerInstrument;
  bass: LayerInstrument;
  hasDrums: boolean;
  triggerDrum: (event: DrumEvent, time: number) => void;
  releaseAll: () => void;
  dispose: () => void;
};

type SectionDynamics = {
  isTransition: boolean;
  isSectionIntro: boolean;
  isSectionOutro: boolean;
  isEnteringFromTransition: boolean;
  chordVelocityScale: number;
  melodyVelocityScale: number;
  melodyKeepRatio: number;
  bassVelocityScale: number;
  bassKeepRatio: number;
  drumsVelocityScale: number;
  drumsKeepRatio: number;
};

const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const maybe = (probability: number): boolean => Math.random() < probability;
const randomItem = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const randomTempo = ([min, max]: [number, number]) => {
  const span = max - min;
  return Math.round(min + Math.random() * span);
};
const PIANO_ARPEGGIO_PATTERNS: number[][] = [
  [0, 1, 2, 3, 0, 1, 2, 3],
  [0, 1, 2, 3, 2, 1, 0, 1],
  [0, 2, 1, 3, 1, 2, 0, 2],
  [0, 2, 1, 2, 0, 2, 1, 3]
];

const GRAND_PIANO_BASE_URL = "https://tonejs.github.io/audio/salamander/";

const GRAND_PIANO_URLS: Record<string, string> = {
  A1: "A1.mp3",
  C2: "C2.mp3",
  "D#2": "Ds2.mp3",
  "F#2": "Fs2.mp3",
  A2: "A2.mp3",
  C3: "C3.mp3",
  "D#3": "Ds3.mp3",
  "F#3": "Fs3.mp3",
  A3: "A3.mp3",
  C4: "C4.mp3",
  "D#4": "Ds4.mp3",
  "F#4": "Fs4.mp3",
  A4: "A4.mp3",
  C5: "C5.mp3"
};

const createGrandPianoSampler = (output: Tone.ToneAudioNode, volumeDb: number): Tone.Sampler =>
  new Tone.Sampler({
    baseUrl: GRAND_PIANO_BASE_URL,
    urls: GRAND_PIANO_URLS,
    release: 1.9,
    volume: volumeDb
  }).connect(output);

const VIBE_MIX_PRESETS: Record<VibeId, VibeMixPreset> = {
  lofi: {
    volumes: {
      master: 0.92,
      outputBoost: 0.58,
      chords: 0.72,
      melody: 0.76,
      bass: 0.56,
      drums: 0.64,
      rain: 0.08,
      vinyl: 0.035
    },
    rainEnabled: false,
    vinylEnabled: true
  },
  piano: {
    volumes: {
      master: 0.9,
      outputBoost: 0.56,
      chords: 0.7,
      melody: 0.82,
      bass: 0.44,
      drums: 0,
      rain: 0.07,
      vinyl: 0.015
    },
    rainEnabled: true,
    vinylEnabled: false
  },
  jazz: {
    volumes: {
      master: 0.9,
      outputBoost: 0.54,
      chords: 0.68,
      melody: 0.72,
      bass: 0.58,
      drums: 0.52,
      rain: 0.05,
      vinyl: 0.01
    },
    rainEnabled: false,
    vinylEnabled: false
  }
};

export class MusicEngine {
  private readonly masterGain: Tone.Gain;
  private readonly outputBoostGain: Tone.Gain;
  private readonly limiter: Tone.Limiter;
  private readonly musicBus: Tone.Gain;
  private readonly ambienceBus: Tone.Gain;
  private readonly ambienceHighpass: Tone.Filter;
  private readonly ambienceLowpass: Tone.Filter;

  private readonly chordsGain: Tone.Gain;
  private readonly melodyGain: Tone.Gain;
  private readonly bassGain: Tone.Gain;
  private readonly drumsGain: Tone.Gain;

  private readonly chordReverb: Tone.Reverb;
  private readonly melodyFilter: Tone.Filter;

  private readonly barLoop: Tone.Loop;
  private readonly rainAmbience: RainAmbience;
  private readonly vinylAmbience: VinylAmbience;
  private readonly listeners = new Set<InfoListener>();

  private instruments: InstrumentSet;
  private vibeId: VibeId;
  private track: GeneratedTrack;
  private mixState: MixState;
  private currentSection: TrackSection = "intro";
  private barIndex = 0;
  private transportStarted = false;
  private pianoArpeggioPattern: number[] = PIANO_ARPEGGIO_PATTERNS[0];
  private pianoPatternBarsRemaining = 0;
  private audioPrepared = false;
  private prepareAudioPromise: Promise<boolean> | null = null;

  constructor(initialVibe: VibeId = "lofi") {
    this.limiter = new Tone.Limiter(-1).toDestination();
    this.outputBoostGain = new Tone.Gain(1.8).connect(this.limiter);
    this.masterGain = new Tone.Gain(0.9).connect(this.outputBoostGain);

    this.musicBus = new Tone.Gain(1.08).connect(this.masterGain);
    this.ambienceBus = new Tone.Gain(0.68).connect(this.masterGain);
    this.ambienceLowpass = new Tone.Filter({ type: "lowpass", frequency: 2400, rolloff: -24 }).connect(this.ambienceBus);
    this.ambienceHighpass = new Tone.Filter({ type: "highpass", frequency: 70, rolloff: -24 }).connect(this.ambienceLowpass);

    this.chordsGain = new Tone.Gain(0.6).connect(this.musicBus);
    this.melodyGain = new Tone.Gain(0.58).connect(this.musicBus);
    this.bassGain = new Tone.Gain(0.42).connect(this.musicBus);
    this.drumsGain = new Tone.Gain(0.45).connect(this.musicBus);

    this.chordReverb = new Tone.Reverb({ decay: 6.8, wet: 0.26 }).connect(this.chordsGain);
    this.melodyFilter = new Tone.Filter({ type: "lowpass", frequency: 2300, rolloff: -24 }).connect(this.melodyGain);

    this.rainAmbience = new RainAmbience(this.ambienceHighpass);
    this.vinylAmbience = new VinylAmbience(this.ambienceHighpass);

    this.vibeId = initialVibe;
    this.instruments = this.createInstrumentSet(initialVibe);
    this.mixState = { ...VIBE_MIX_PRESETS[initialVibe].volumes };
    this.track = this.createTrack(initialVibe);

    this.barLoop = new Tone.Loop((time) => {
      this.playBar(time);
    }, "1m");

    this.applyVibeTone(initialVibe);
    this.applyMixState(0.01);
    this.applyPresetToggles(initialVibe, false);

    Tone.Transport.bpm.value = this.track.tempo;
    this.emitInfo();
  }

  public async start(): Promise<void> {
    const unlocked = await this.prepareAudio();
    if (!unlocked) {
      throw new Error("Audio context is not available.");
    }

    if (!this.transportStarted) {
      this.barLoop.start(0);
      this.transportStarted = true;
    }

    if (Tone.Transport.state !== "started") {
      Tone.Transport.start();
    }
  }

  public pause(): void {
    Tone.Transport.pause();
  }

  public isPlaying(): boolean {
    return Tone.Transport.state === "started";
  }

  public setVibe(vibe: VibeId): void {
    if (this.vibeId === vibe) {
      return;
    }

    const shouldResume = this.isPlaying();

    Tone.Transport.stop();
    Tone.Transport.position = 0;

    this.instruments.releaseAll();
    this.instruments.dispose();

    this.vibeId = vibe;
    this.instruments = this.createInstrumentSet(vibe);

    this.applyVibeTone(vibe);
    this.resetPianoArpeggioState();
    this.resetMix();
    this.generateNewTrack();

    if (shouldResume) {
      Tone.Transport.start();
    }
  }

  public getVibe(): VibeId {
    return this.vibeId;
  }

  public generateNewTrack(): void {
    this.track = this.createTrack(this.vibeId);
    this.barIndex = 0;
    this.currentSection = getSectionAtBar(this.track.arrangement, 0);
    this.resetPianoArpeggioState();

    Tone.Transport.position = 0;
    Tone.Transport.bpm.rampTo(this.track.tempo, 0.35);
    this.emitInfo();
  }

  public setLayerVolume(layer: MixLayer, next: number): void {
    this.mixState[layer] = clamp(next);
    this.applyMixState(0.12);
  }

  public getMixState(): MixState {
    return { ...this.mixState };
  }

  public resetMix(): void {
    const preset = VIBE_MIX_PRESETS[this.vibeId];
    this.mixState = { ...preset.volumes };
    this.applyMixState(0.18);
    this.applyPresetToggles(this.vibeId, true);
  }

  public isLayerAvailable(layer: MixLayer): boolean {
    if (layer !== "drums") {
      return true;
    }

    return this.instruments.hasDrums;
  }

  public setRain(enabled: boolean): void {
    this.rainAmbience.setEnabled(enabled);
  }

  public setVinyl(enabled: boolean): void {
    this.vinylAmbience.setEnabled(enabled);
  }

  public isRainEnabled(): boolean {
    return this.rainAmbience.isEnabled();
  }

  public isVinylEnabled(): boolean {
    return this.vinylAmbience.isEnabled();
  }

  public getTrackInfo(): TrackInfo {
    return {
      vibe: this.track.vibe,
      key: this.track.keyLabel,
      tempo: this.track.tempo,
      section: this.currentSection
    };
  }

  public subscribe(listener: InfoListener): () => void {
    this.listeners.add(listener);
    listener(this.getTrackInfo());

    return () => {
      this.listeners.delete(listener);
    };
  }

  public dispose(): void {
    this.barLoop.dispose();

    this.instruments.releaseAll();
    this.instruments.dispose();

    this.chordReverb.dispose();
    this.melodyFilter.dispose();

    this.chordsGain.dispose();
    this.melodyGain.dispose();
    this.bassGain.dispose();
    this.drumsGain.dispose();

    this.rainAmbience.dispose();
    this.vinylAmbience.dispose();

    this.ambienceHighpass.dispose();
    this.ambienceLowpass.dispose();
    this.ambienceBus.dispose();
    this.musicBus.dispose();
    this.masterGain.dispose();
    this.outputBoostGain.dispose();
    this.limiter.dispose();
  }

  public async prepareAudio(): Promise<boolean> {
    const isContextRunning = Tone.getContext().rawContext.state === "running";
    if (this.audioPrepared && isContextRunning) {
      Tone.Destination.mute = false;
      return true;
    }

    if (!this.prepareAudioPromise) {
      this.prepareAudioPromise = (async () => {
        const unlocked = await this.ensureAudioContextRunning();
        if (!unlocked) {
          return false;
        }

        await this.warmOutputPath();
        this.audioPrepared = true;
        return true;
      })().finally(() => {
        this.prepareAudioPromise = null;
      });
    }

    return this.prepareAudioPromise;
  }

  private emitInfo(): void {
    const info = this.getTrackInfo();
    this.listeners.forEach((listener) => listener(info));
  }

  private async ensureAudioContextRunning(): Promise<boolean> {
    const rawContext = Tone.getContext().rawContext;
    const isRunning = (): boolean => Tone.getContext().rawContext.state === "running";

    if (isRunning()) {
      Tone.Destination.mute = false;
      return true;
    }

    const pause = (ms: number) => new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms);
    });

    for (let attempt = 0; attempt < 3 && !isRunning(); attempt += 1) {
      try {
        await Tone.start();
      } catch {
        // Continue with explicit resume fallbacks for mobile browsers.
      }

      if (isRunning()) {
        break;
      }

      try {
        await rawContext.resume();
      } catch {
        // Continue with silent-buffer unlock fallback.
      }

      if (isRunning()) {
        break;
      }

      try {
        const unlockSource = rawContext.createBufferSource();
        const unlockGain = rawContext.createGain();
        unlockGain.gain.value = 0;
        unlockSource.buffer = rawContext.createBuffer(1, 1, rawContext.sampleRate || 22050);
        unlockSource.connect(unlockGain);
        unlockGain.connect(rawContext.destination);
        unlockSource.start(0);
        unlockSource.stop(0.02);
        await rawContext.resume();
      } catch {
        // If this fails, caller can ask for another explicit tap gesture.
      }

      if (!isRunning()) {
        await pause(16);
      }
    }

    Tone.Destination.mute = false;
    return isRunning();
  }

  private async warmOutputPath(): Promise<void> {
    try {
      const warmup = new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.01, sustain: 0, release: 0.01 },
        volume: -86
      }).connect(this.musicBus);

      const now = Tone.now();
      warmup.triggerAttackRelease("C5", 0.02, now, 0.0015);
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 32);
      });
      warmup.dispose();
    } catch {
      // Warmup is best effort for mobile compatibility.
    }
  }

  private createTrack(vibe: VibeId): GeneratedTrack {
    const profile = getVibeProfile(vibe);
    const chordPlan = generateChordPlan(profile);

    return {
      vibe,
      keyRoot: chordPlan.keyRoot,
      keyLabel: chordPlan.keyLabel,
      scaleNotes: chordPlan.scaleNotes,
      tempo: randomTempo(profile.tempoRange),
      progressionDegrees: chordPlan.progressionDegrees,
      chordBars: chordPlan.chordBars,
      arrangement: createArrangement()
    };
  }

  private createInstrumentSet(vibe: VibeId): InstrumentSet {
    const disposables: DisposableNode[] = [];
    const releaseables: LayerInstrument[] = [];

    const trackInstrument = <T extends LayerInstrument>(instrument: T): T => {
      disposables.push(instrument);
      releaseables.push(instrument);
      return instrument;
    };

    const trackNode = <T extends DisposableNode>(node: T): T => {
      disposables.push(node);
      return node;
    };

    if (vibe === "piano") {
      const chords = trackInstrument(createGrandPianoSampler(this.chordReverb, -10));
      const melody = trackInstrument(createGrandPianoSampler(this.melodyFilter, -11));
      const bass = trackInstrument(createGrandPianoSampler(this.bassGain, -12));

      return {
        chords,
        melody,
        bass,
        hasDrums: false,
        triggerDrum: () => {},
        releaseAll: () => {
          releaseables.forEach((instrument) => {
            instrument.releaseAll?.();
          });
        },
        dispose: () => {
          [...disposables].reverse().forEach((node) => node.dispose());
        }
      };
    }

    if (vibe === "jazz") {
      const chords = trackInstrument(createGrandPianoSampler(this.chordReverb, -11));
      const melody = trackInstrument(createGrandPianoSampler(this.melodyFilter, -12));

      const bass = trackInstrument(
        new Tone.MonoSynth({
          volume: -13,
          oscillator: { type: "triangle" },
          filter: { Q: 1.2, type: "lowpass", rolloff: -24 },
          envelope: { attack: 0.03, decay: 0.22, sustain: 0.54, release: 1.1 },
          filterEnvelope: { attack: 0.02, decay: 0.22, sustain: 0.3, release: 1.2, baseFrequency: 70, octaves: 2.5 }
        }).connect(this.bassGain)
      );

      const kick = trackNode(new Tone.MembraneSynth({ volume: -29, pitchDecay: 0.03, octaves: 2.4 }).connect(this.drumsGain));
      const snare = trackNode(
        new Tone.NoiseSynth({
          volume: -30,
          noise: { type: "pink" },
          envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.08 }
        }).connect(this.drumsGain)
      );
      const hat = trackNode(
        new Tone.NoiseSynth({
          volume: -36,
          noise: { type: "brown" },
          envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.03 }
        }).connect(this.drumsGain)
      );

      return {
        chords,
        melody,
        bass,
        hasDrums: true,
        triggerDrum: (event, time) => {
          if (event.type === "kick") {
            kick.triggerAttackRelease("G1", "16n", time, event.velocity);
            return;
          }

          if (event.type === "snare") {
            snare.triggerAttackRelease("16n", time, event.velocity);
            return;
          }

          hat.triggerAttackRelease("32n", time, event.velocity);
        },
        releaseAll: () => {
          releaseables.forEach((instrument) => {
            instrument.releaseAll?.();
          });
        },
        dispose: () => {
          [...disposables].reverse().forEach((node) => node.dispose());
        }
      };
    }

    const chords = trackInstrument(
      new Tone.PolySynth(Tone.FMSynth, {
        volume: -15,
        harmonicity: 2.4,
        modulationIndex: 8,
        oscillator: { type: "sine" },
        envelope: { attack: 0.05, decay: 0.32, sustain: 0.38, release: 1.2 },
        modulation: { type: "triangle" },
        modulationEnvelope: { attack: 0.08, decay: 0.12, sustain: 0.2, release: 0.6 }
      }).connect(this.chordReverb)
    );

    const melody = trackInstrument(
      new Tone.Synth({
        volume: -17,
        oscillator: { type: "triangle" },
        envelope: { attack: 0.01, decay: 0.18, sustain: 0.23, release: 0.32 }
      }).connect(this.melodyFilter)
    );

    const bass = trackInstrument(
      new Tone.MonoSynth({
        volume: -17,
        oscillator: { type: "triangle" },
        filter: { Q: 1.8, type: "lowpass", rolloff: -24 },
        envelope: { attack: 0.02, decay: 0.24, sustain: 0.45, release: 0.48 },
        filterEnvelope: { attack: 0.03, decay: 0.2, sustain: 0.26, release: 0.42, baseFrequency: 130, octaves: 2 }
      }).connect(this.bassGain)
    );

    const kick = trackNode(new Tone.MembraneSynth({ volume: -17 }).connect(this.drumsGain));
    const snare = trackNode(
      new Tone.NoiseSynth({
        volume: -23,
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 }
      }).connect(this.drumsGain)
    );
    const hat = trackNode(
      new Tone.MetalSynth({
        volume: -35,
        envelope: { attack: 0.001, decay: 0.05, release: 0.04 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 1000,
        octaves: 1.5
      }).connect(this.drumsGain)
    );

    return {
      chords,
      melody,
      bass,
      hasDrums: true,
      triggerDrum: (event, time) => {
        if (event.type === "kick") {
          kick.triggerAttackRelease("C1", "8n", time, event.velocity);
          return;
        }

        if (event.type === "snare") {
          snare.triggerAttackRelease("16n", time, event.velocity);
          return;
        }

        hat.triggerAttackRelease("16n", time, event.velocity);
      },
      releaseAll: () => {
        releaseables.forEach((instrument) => {
          instrument.releaseAll?.();
        });
      },
      dispose: () => {
        [...disposables].reverse().forEach((node) => node.dispose());
      }
    };
  }

  private applyMixState(rampSeconds: number): void {
    const mappedOutputGain = 1 + this.mixState.outputBoost * 2.2;

    this.masterGain.gain.rampTo(this.mixState.master, rampSeconds);
    this.outputBoostGain.gain.rampTo(mappedOutputGain, rampSeconds);
    this.chordsGain.gain.rampTo(this.mixState.chords, rampSeconds);
    this.melodyGain.gain.rampTo(this.mixState.melody, rampSeconds);
    this.bassGain.gain.rampTo(this.mixState.bass, rampSeconds);
    this.drumsGain.gain.rampTo(this.instruments.hasDrums ? this.mixState.drums : 0, rampSeconds);

    this.rainAmbience.setVolume(this.mixState.rain);
    this.vinylAmbience.setVolume(this.mixState.vinyl);
  }

  private applyPresetToggles(vibe: VibeId, smooth: boolean): void {
    const preset = VIBE_MIX_PRESETS[vibe];

    if (smooth) {
      this.setRain(preset.rainEnabled);
      this.setVinyl(preset.vinylEnabled);
      return;
    }

    this.rainAmbience.setEnabled(preset.rainEnabled);
    this.vinylAmbience.setEnabled(preset.vinylEnabled);
  }

  private applyVibeTone(vibe: VibeId): void {
    if (vibe === "lofi") {
      this.melodyFilter.frequency.rampTo(1850, 0.25);
      this.chordReverb.wet.rampTo(0.28, 0.25);
      Tone.Transport.swing = 0.02;
      return;
    }

    if (vibe === "piano") {
      this.melodyFilter.frequency.rampTo(3600, 0.25);
      this.chordReverb.wet.rampTo(0.34, 0.25);
      Tone.Transport.swing = 0;
      return;
    }

    this.melodyFilter.frequency.rampTo(2800, 0.25);
    this.chordReverb.wet.rampTo(0.2, 0.25);
    Tone.Transport.swing = 0.14;
  }

  private resetPianoArpeggioState(): void {
    this.pianoPatternBarsRemaining = 0;
  }

  private getPianoPatternForBar(): number[] {
    if (this.pianoPatternBarsRemaining <= 0) {
      const alternatives = PIANO_ARPEGGIO_PATTERNS.filter((pattern) => pattern !== this.pianoArpeggioPattern);
      this.pianoArpeggioPattern = randomItem(alternatives.length > 0 ? alternatives : PIANO_ARPEGGIO_PATTERNS);
      this.pianoPatternBarsRemaining = 2 + Math.floor(Math.random() * 3);
    }

    this.pianoPatternBarsRemaining -= 1;
    return this.pianoArpeggioPattern;
  }

  private toLeftHandRegister(note: string): string {
    const match = note.match(/^([A-G](?:#|b)?)(-?\d+)$/);
    if (!match) {
      return note;
    }

    const [, name, octaveText] = match;
    const octave = Number(octaveText);
    if (!Number.isFinite(octave)) {
      return note;
    }

    const shiftedOctave = octave >= 4 ? octave - 2 : octave - 1;
    const clampedOctave = Math.max(1, Math.min(3, shiftedOctave));
    return `${name}${clampedOctave}`;
  }

  private getSectionDynamics(vibe: VibeId, context: ArrangementBarContext): SectionDynamics {
    const isEnteringFromTransition = context.isSectionIntro && this.barIndex > 0;
    const dynamics: SectionDynamics = {
      isTransition: context.isTransitionBar,
      isSectionIntro: context.isSectionIntro,
      isSectionOutro: context.isSectionOutro,
      isEnteringFromTransition,
      chordVelocityScale: 1,
      melodyVelocityScale: 1,
      melodyKeepRatio: 1,
      bassVelocityScale: 1,
      bassKeepRatio: 1,
      drumsVelocityScale: 1,
      drumsKeepRatio: 1
    };

    if (context.isTransitionBar) {
      dynamics.chordVelocityScale = 0.68;
      dynamics.melodyVelocityScale = 0.72;
      dynamics.melodyKeepRatio = 0.52;
      dynamics.bassVelocityScale = 0.72;
      dynamics.bassKeepRatio = 0.58;
      dynamics.drumsVelocityScale = 0.5;
      dynamics.drumsKeepRatio = 0.5;
    } else if (context.isSectionOutro) {
      dynamics.chordVelocityScale = 0.82;
      dynamics.melodyVelocityScale = 0.84;
      dynamics.melodyKeepRatio = 0.7;
      dynamics.bassVelocityScale = 0.82;
      dynamics.bassKeepRatio = 0.74;
      dynamics.drumsVelocityScale = 0.72;
      dynamics.drumsKeepRatio = 0.7;
    } else if (isEnteringFromTransition) {
      dynamics.chordVelocityScale = 0.86;
      dynamics.melodyVelocityScale = 0.82;
      dynamics.melodyKeepRatio = 0.76;
      dynamics.bassVelocityScale = 0.84;
      dynamics.bassKeepRatio = 0.84;
      dynamics.drumsVelocityScale = 0.74;
      dynamics.drumsKeepRatio = 0.72;
    }

    if (vibe === "lofi" && context.isTransitionBar) {
      dynamics.drumsVelocityScale = 0.42;
      dynamics.drumsKeepRatio = 0.36;
      dynamics.melodyKeepRatio = 0.62;
    }

    if (vibe === "jazz" && context.isTransitionBar) {
      dynamics.drumsVelocityScale = 0.62;
      dynamics.drumsKeepRatio = 0.58;
      dynamics.melodyKeepRatio = 0.64;
      dynamics.bassKeepRatio = 0.72;
    }

    if (vibe === "piano" && context.isTransitionBar) {
      dynamics.melodyKeepRatio = 0.56;
      dynamics.chordVelocityScale = 0.62;
    }

    return dynamics;
  }

  private shapeMelodyEvents(events: MelodyEvent[], dynamics: SectionDynamics, context: ArrangementBarContext): MelodyEvent[] {
    let shaped = [...events];

    if (dynamics.isTransition) {
      shaped = shaped.filter((_, index) => index === 0 || index % 2 === 0);
    } else if (dynamics.isSectionOutro) {
      shaped = shaped.filter((_, index) => index < Math.max(1, Math.ceil(events.length * dynamics.melodyKeepRatio)));
    }

    shaped = shaped.filter((_, index) => index === 0 || maybe(dynamics.melodyKeepRatio));

    if (dynamics.isEnteringFromTransition) {
      shaped = shaped.filter((event) => event.step <= 5.5 || maybe(0.28));
    }

    if (shaped.length === 0 && events.length > 0) {
      shaped = [events[0]];
    }

    const withDynamics = shaped.map((event) => ({
      ...event,
      velocity: clamp(event.velocity * dynamics.melodyVelocityScale + (Math.random() - 0.5) * 0.02)
    }));

    if (dynamics.isTransition && context.transitionTo && withDynamics.length > 0 && !withDynamics.some((event) => event.step >= 6.5)) {
      const pickup = withDynamics[withDynamics.length - 1];
      withDynamics.push({
        step: 6.75,
        note: pickup.note,
        duration: "16n",
        velocity: clamp(pickup.velocity * 0.7)
      });
    }

    return withDynamics;
  }

  private shapeBassEvents(events: BassEvent[], dynamics: SectionDynamics, vibe: VibeId): BassEvent[] {
    let shaped = [...events];

    if (dynamics.isTransition) {
      if (vibe === "lofi") {
        shaped = shaped.filter((event) => event.step === 0);
      } else if (vibe === "jazz") {
        shaped = shaped.filter((event) => event.step === 0 || event.step === 4 || event.step === 6);
      } else {
        shaped = shaped.slice(0, 1);
      }
    } else {
      shaped = shaped.filter((_, index) => index === 0 || maybe(dynamics.bassKeepRatio));
    }

    if (shaped.length === 0 && events.length > 0) {
      shaped = [events[0]];
    }

    return shaped.map((event) => ({
      ...event,
      velocity: clamp(event.velocity * dynamics.bassVelocityScale)
    }));
  }

  private shapeDrumEvents(events: DrumEvent[], dynamics: SectionDynamics, vibe: VibeId): DrumEvent[] {
    let shaped = [...events];

    if (dynamics.isTransition) {
      if (vibe === "lofi") {
        shaped = shaped.filter((event) => event.type !== "snare" && (event.step === 0 || event.step === 4 || event.step === 7));
      } else if (vibe === "jazz") {
        shaped = shaped.filter((event) => event.type === "hat" || (event.type === "snare" && event.step === 7));
      } else {
        shaped = shaped.slice(0, 2);
      }
    } else {
      shaped = shaped.filter((_, index) => index === 0 || maybe(dynamics.drumsKeepRatio));
    }

    return shaped.map((event) => ({
      ...event,
      velocity: clamp(event.velocity * dynamics.drumsVelocityScale)
    }));
  }

  private playPianoArpeggio(
    chordNotes: string[],
    section: TrackSection,
    time: number,
    stepSeconds: number,
    chordVelocity: number,
    dynamics: SectionDynamics
  ): void {
    const leftHandNotes = [...new Set(chordNotes.map((note) => this.toLeftHandRegister(note)))].sort(
      (a, b) => Tone.Frequency(a).toMidi() - Tone.Frequency(b).toMidi()
    );
    if (leftHandNotes.length === 0) {
      return;
    }

    const pattern = this.getPianoPatternForBar();
    const reducedPattern = section === "break" || dynamics.isTransition || dynamics.isSectionOutro;
    const patternSteps = reducedPattern ? pattern.slice(0, 4) : pattern;
    const rhythmicSteps = reducedPattern ? [0, 2, 4, 6] : patternSteps.map((_, index) => index);
    const restChance = reducedPattern ? 0.24 : dynamics.isEnteringFromTransition ? 0.14 : 0.1;
    const durationSeconds = dynamics.isTransition ? stepSeconds * 2.2 : dynamics.isSectionOutro ? stepSeconds * 1.72 : stepSeconds * 1.08;

    rhythmicSteps.forEach((gridStep, noteIndex) => {
      if (noteIndex !== 0 && maybe(restChance)) {
        return;
      }

      const patternIndex = patternSteps[noteIndex % patternSteps.length];
      const note = leftHandNotes[patternIndex % leftHandNotes.length];
      const offset = (Math.random() - 0.5) * 0.03;
      const eventTime = time + gridStep * stepSeconds + (gridStep === 0 ? Math.max(0, offset) : offset);
      const velocity = clamp(chordVelocity * 0.9 * dynamics.chordVelocityScale + (Math.random() - 0.5) * 0.07);

      this.instruments.chords.triggerAttackRelease(note, durationSeconds, eventTime, velocity);
    });
  }

  private playBar(time: number): void {
    const profile = getVibeProfile(this.track.vibe);
    const barContext = getArrangementBarContext(this.track.arrangement, this.barIndex);
    const section = barContext.section;
    const dynamics = this.getSectionDynamics(profile.id, barContext);

    if (!barContext.isTransitionBar && section !== this.currentSection) {
      this.currentSection = section;
      this.emitInfo();
    }

    const chordBar = this.track.chordBars[this.barIndex % this.track.chordBars.length];
    const stepSeconds = Tone.Time("8n").toSeconds();
    const shouldSwing = profile.id === "jazz";
    const swingShift = shouldSwing ? stepSeconds * 0.16 : 0;

    const chordVelocity =
      (section === "break" ? profile.chordVelocity * 0.68 : profile.chordVelocity) * dynamics.chordVelocityScale;

    if (profile.id === "piano") {
      this.playPianoArpeggio(chordBar.notes, section, time, stepSeconds, profile.chordVelocity, dynamics);
    } else {
      const chordDuration: Tone.Unit.Time = dynamics.isEnteringFromTransition ? "2n" : section === "break" ? "2n" : "1m";
      this.instruments.chords.triggerAttackRelease(
        chordBar.notes,
        chordDuration,
        time,
        chordVelocity
      );
    }

    const melodyEvents = this.shapeMelodyEvents(
      generateMelodyPhrase(profile, this.track.scaleNotes, section, chordBar.notes, this.barIndex),
      dynamics,
      barContext
    );
    melodyEvents.forEach((event) => {
      const eventTime = time + event.step * stepSeconds + (shouldSwing && event.step % 2 === 1 ? swingShift : 0);
      this.instruments.melody.triggerAttackRelease(event.note, event.duration, eventTime, event.velocity);
    });

    if (profile.id === "piano") {
      const eventTime = time + (dynamics.isEnteringFromTransition ? stepSeconds * 0.5 : Math.max(0, (Math.random() - 0.5) * 0.02));
      const velocity = clamp((0.16 + (Math.random() - 0.5) * 0.05) * dynamics.bassVelocityScale);
      const duration: Tone.Unit.Time = dynamics.isTransition || dynamics.isSectionOutro ? "1m" : section === "break" ? "4n" : "2n";
      this.instruments.bass.triggerAttackRelease(chordBar.bassNote, duration, eventTime, velocity);
    } else {
      const bassEvents = this.shapeBassEvents(
        generateBassPattern(profile, section, chordBar.bassNote, chordBar.notes),
        dynamics,
        profile.id
      );
      bassEvents.forEach((event) => {
        const eventTime = time + event.step * stepSeconds;
        this.instruments.bass.triggerAttackRelease(event.note, event.duration, eventTime, event.velocity);
      });
    }

    if (this.instruments.hasDrums) {
      const drumEvents = this.shapeDrumEvents(generateDrumPattern(profile, section), dynamics, profile.id);
      drumEvents.forEach((event) => {
        const eventTime = time + event.step * stepSeconds + (shouldSwing && event.step % 2 === 1 ? swingShift : 0);
        this.instruments.triggerDrum(event, eventTime);
      });
    }

    this.barIndex += 1;
  }
}

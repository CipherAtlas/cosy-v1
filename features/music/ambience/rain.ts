import * as Tone from "tone";

const clampVolume = (value: number): number => Math.max(0, Math.min(1, value));
const randomInRange = (min: number, max: number): number => min + Math.random() * (max - min);

const BASE_RAIN_URL = "/assets/audio/rain/base-rain.mp3";
const TEXTURE_RAIN_URLS = ["/assets/audio/rain/texture-1.mp3", "/assets/audio/rain/texture-2.mp3"];
const DROPLET_URLS = [
  "/assets/audio/rain/droplet-1.mp3",
  "/assets/audio/rain/droplet-2.mp3",
  "/assets/audio/rain/droplet-3.mp3"
];

export class RainAmbience {
  private readonly rainMasterGain: Tone.Gain;
  private readonly rainBus: Tone.Gain;

  private readonly baseGain: Tone.Gain;
  private readonly textureGain: Tone.Gain;
  private readonly dropletGain: Tone.Gain;

  private readonly baseLowpass: Tone.Filter;
  private readonly baseStereo: Tone.StereoWidener;

  private readonly textureLowpass: Tone.Filter;
  private readonly textureHighpass: Tone.Filter;

  private readonly dropletLowpass: Tone.Filter;
  private readonly dropletHighpass: Tone.Filter;

  private readonly baseRain: Tone.Player;
  private readonly textureLayers: Tone.Player[];
  private readonly dropletLayers: Tone.Player[];

  private readonly fallbackBase: Tone.Noise;
  private readonly fallbackTexture: Tone.NoiseSynth;
  private readonly fallbackDroplet: Tone.NoiseSynth;

  private enabled = false;
  private volume = 0.14;

  private textureTimer: ReturnType<typeof setTimeout> | null = null;
  private dropletTimer: ReturnType<typeof setTimeout> | null = null;
  private driftTimer: ReturnType<typeof setTimeout> | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(output: Tone.ToneAudioNode) {
    this.rainMasterGain = new Tone.Gain(0).connect(output);
    this.rainBus = new Tone.Gain(1).connect(this.rainMasterGain);

    this.baseGain = new Tone.Gain(0.62).connect(this.rainBus);
    this.textureGain = new Tone.Gain(0.34).connect(this.rainBus);
    this.dropletGain = new Tone.Gain(0.24).connect(this.rainBus);

    // Layer 1: distant continuous rain bed.
    this.baseStereo = new Tone.StereoWidener(0.55).connect(this.baseGain);
    this.baseLowpass = new Tone.Filter({ type: "lowpass", frequency: 1450, rolloff: -24 }).connect(this.baseStereo);

    // Layer 2: mid texture to add moving rain surface detail.
    this.textureLowpass = new Tone.Filter({ type: "lowpass", frequency: 2500, rolloff: -24 }).connect(this.textureGain);
    this.textureHighpass = new Tone.Filter({ type: "highpass", frequency: 240, rolloff: -24 }).connect(this.textureLowpass);

    // Layer 3: droplets with brighter but still tamed transient detail.
    this.dropletLowpass = new Tone.Filter({ type: "lowpass", frequency: 3200, rolloff: -24 }).connect(this.dropletGain);
    this.dropletHighpass = new Tone.Filter({ type: "highpass", frequency: 480, rolloff: -24 }).connect(this.dropletLowpass);

    this.baseRain = new Tone.Player({
      url: BASE_RAIN_URL,
      loop: true,
      autostart: false,
      fadeIn: 1.5,
      fadeOut: 1.4,
      volume: -30
    }).connect(this.baseLowpass);

    this.textureLayers = TEXTURE_RAIN_URLS.map((url) =>
      new Tone.Player({
        url,
        autostart: false,
        loop: false,
        fadeIn: 0.15,
        fadeOut: 0.25,
        volume: -24
      }).connect(this.textureHighpass)
    );

    this.dropletLayers = DROPLET_URLS.map((url) =>
      new Tone.Player({
        url,
        autostart: false,
        loop: false,
        fadeIn: 0.02,
        fadeOut: 0.08,
        volume: -27
      }).connect(this.dropletHighpass)
    );

    // Fallback layers keep ambience present if custom samples are not yet added.
    this.fallbackBase = new Tone.Noise("pink").connect(this.baseLowpass);
    this.fallbackBase.volume.value = -33;

    this.fallbackTexture = new Tone.NoiseSynth({
      volume: -33,
      noise: { type: "pink" },
      envelope: { attack: 0.01, decay: 0.45, sustain: 0, release: 0.2 }
    }).connect(this.textureHighpass);

    this.fallbackDroplet = new Tone.NoiseSynth({
      volume: -36,
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.05 }
    }).connect(this.dropletHighpass);
  }

  public setEnabled(next: boolean): void {
    this.enabled = next;

    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }

    if (next) {
      this.startLayers();
      this.scheduleTexture();
      this.scheduleDroplets();
      this.scheduleDrift();
      this.rainMasterGain.gain.rampTo(this.volume, 1.6);
      return;
    }

    this.clearSchedulers();
    this.rainMasterGain.gain.rampTo(0, 1.4);

    this.stopTimer = setTimeout(() => {
      if (!this.enabled) {
        this.stopLayers();
      }
    }, 1500);
  }

  public setVolume(next: number): void {
    this.volume = clampVolume(next);

    if (this.enabled) {
      this.rainMasterGain.gain.rampTo(this.volume, 0.28);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public dispose(): void {
    this.clearSchedulers();

    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }

    this.stopLayers();

    this.baseRain.dispose();
    this.textureLayers.forEach((player) => player.dispose());
    this.dropletLayers.forEach((player) => player.dispose());

    this.fallbackBase.dispose();
    this.fallbackTexture.dispose();
    this.fallbackDroplet.dispose();

    this.baseLowpass.dispose();
    this.baseStereo.dispose();
    this.textureHighpass.dispose();
    this.textureLowpass.dispose();
    this.dropletHighpass.dispose();
    this.dropletLowpass.dispose();

    this.baseGain.dispose();
    this.textureGain.dispose();
    this.dropletGain.dispose();

    this.rainBus.dispose();
    this.rainMasterGain.dispose();
  }

  private startLayers(): void {
    if (this.baseRain.loaded) {
      if (this.baseRain.state !== "started") {
        this.baseRain.start();
      }
    } else {
      if (this.fallbackBase.state !== "started") {
        this.fallbackBase.start();
      }
    }
  }

  private stopLayers(): void {
    if (this.baseRain.state === "started") {
      this.baseRain.stop();
    }

    if (this.fallbackBase.state === "started") {
      this.fallbackBase.stop();
    }
  }

  private scheduleTexture(): void {
    if (!this.enabled) {
      return;
    }

    const delayMs = randomInRange(2800, 6200);

    this.textureTimer = setTimeout(() => {
      if (this.enabled) {
        this.triggerTexture();
        this.scheduleTexture();
      }
    }, delayMs);
  }

  private scheduleDroplets(): void {
    if (!this.enabled) {
      return;
    }

    const delayMs = randomInRange(650, 2100);

    this.dropletTimer = setTimeout(() => {
      if (this.enabled) {
        this.triggerDroplet();
        this.scheduleDroplets();
      }
    }, delayMs);
  }

  private scheduleDrift(): void {
    if (!this.enabled) {
      return;
    }

    const delayMs = randomInRange(16000, 28000);

    this.driftTimer = setTimeout(() => {
      if (this.enabled) {
        this.baseGain.gain.rampTo(randomInRange(0.56, 0.72), 6.5);
        this.textureGain.gain.rampTo(randomInRange(0.28, 0.42), 5.5);
        this.dropletGain.gain.rampTo(randomInRange(0.18, 0.3), 4.5);
        this.scheduleDrift();
      }
    }, delayMs);
  }

  private triggerTexture(): void {
    const availableLayers = this.textureLayers.filter((layer) => layer.loaded);

    if (availableLayers.length > 0) {
      const layer = availableLayers[Math.floor(Math.random() * availableLayers.length)];
      layer.playbackRate = randomInRange(0.93, 1.08);
      layer.volume.value = randomInRange(-27, -22);
      layer.start(Tone.now() + randomInRange(0.01, 0.12));
      return;
    }

    this.fallbackTexture.triggerAttackRelease("8n", Tone.now(), randomInRange(0.07, 0.16));
  }

  private triggerDroplet(): void {
    if (Math.random() < 0.12) {
      return;
    }

    const availableLayers = this.dropletLayers.filter((layer) => layer.loaded);

    if (availableLayers.length > 0) {
      const layer = availableLayers[Math.floor(Math.random() * availableLayers.length)];
      layer.playbackRate = randomInRange(0.9, 1.14);
      layer.volume.value = randomInRange(-31, -25);
      layer.start(Tone.now() + randomInRange(0.0, 0.08));
      return;
    }

    this.fallbackDroplet.triggerAttackRelease("32n", Tone.now(), randomInRange(0.05, 0.15));
  }

  private clearSchedulers(): void {
    if (this.textureTimer) {
      clearTimeout(this.textureTimer);
      this.textureTimer = null;
    }

    if (this.dropletTimer) {
      clearTimeout(this.dropletTimer);
      this.dropletTimer = null;
    }

    if (this.driftTimer) {
      clearTimeout(this.driftTimer);
      this.driftTimer = null;
    }
  }
}

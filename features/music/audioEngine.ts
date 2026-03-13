import { MusicPresetId } from "@/config/musicPresets";
import { MusicEngine } from "@/features/music/MusicEngine";
import { TrackInfo, VibeId } from "@/features/music/types";

const PRESET_TO_VIBE: Record<MusicPresetId, VibeId> = {
  "rainy-evening": "lofi",
  "quiet-night": "piano",
  "soft-dawn": "jazz"
};

export class PeacefulMusicEngine {
  private readonly engine: MusicEngine;

  constructor() {
    this.engine = new MusicEngine("lofi");
  }

  public async start(): Promise<void> {
    await this.engine.start();
  }

  public async prepareAudio(): Promise<boolean> {
    return this.engine.prepareAudio();
  }

  public pause(): void {
    this.engine.pause();
  }

  public setPreset(presetId: MusicPresetId): void {
    this.engine.setVibe(PRESET_TO_VIBE[presetId]);
  }

  public setRain(enabled: boolean): void {
    this.engine.setRain(enabled);
  }

  public setCrackle(enabled: boolean): void {
    this.engine.setVinyl(enabled);
  }

  public getTrackInfo(): TrackInfo {
    return this.engine.getTrackInfo();
  }

  public dispose(): void {
    this.engine.dispose();
  }
}

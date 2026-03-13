export type MusicPresetId = "rainy-evening" | "quiet-night" | "soft-dawn";

export type MusicPreset = {
  id: MusicPresetId;
  label: string;
  tempo: number;
  reverbMix: number;
  lowpassHz: number;
  progression: string[];
};

export const MUSIC_PRESETS: MusicPreset[] = [
  {
    id: "rainy-evening",
    label: "Rainy Evening",
    tempo: 62,
    reverbMix: 0.48,
    lowpassHz: 1300,
    progression: ["D3", "F3", "A3", "C4"]
  },
  {
    id: "quiet-night",
    label: "Quiet Night",
    tempo: 54,
    reverbMix: 0.52,
    lowpassHz: 1000,
    progression: ["C3", "E3", "G3", "B3"]
  },
  {
    id: "soft-dawn",
    label: "Soft Dawn",
    tempo: 70,
    reverbMix: 0.38,
    lowpassHz: 1800,
    progression: ["E3", "G3", "B3", "D4"]
  }
];

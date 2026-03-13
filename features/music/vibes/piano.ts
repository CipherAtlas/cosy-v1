import { VibeProfile } from "@/features/music/types";

export const PIANO_VIBE: VibeProfile = {
  id: "piano",
  label: "Piano",
  scale: "major",
  keyPool: ["C", "D", "E", "F", "G", "A"],
  tempoRange: [60, 85],
  progressionPools: [
    [0, 4, 5, 3],
    [0, 5, 1, 4],
    [0, 3, 4, 0]
  ],
  chordVelocity: 0.18,
  melodyDensity: {
    intro: 0.12,
    main: 0.28,
    variation: 0.36,
    break: 0.08
  },
  useSeventhChords: true,
  drumStyle: "none"
};

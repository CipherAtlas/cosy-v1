import { VibeProfile } from "@/features/music/types";

export const JAZZ_VIBE: VibeProfile = {
  id: "jazz",
  label: "Jazz",
  scale: "major",
  keyPool: ["C", "D", "Eb", "F", "G", "A", "Bb"],
  tempoRange: [90, 120],
  progressionPools: [
    [1, 4, 0, 0],
    [0, 5, 1, 4],
    [1, 4, 0, 5]
  ],
  chordVelocity: 0.18,
  melodyDensity: {
    intro: 0.2,
    main: 0.44,
    variation: 0.54,
    break: 0.12
  },
  useSeventhChords: true,
  drumStyle: "brush"
};

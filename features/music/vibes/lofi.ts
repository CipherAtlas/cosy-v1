import { VibeProfile } from "@/features/music/types";

export const LOFI_VIBE: VibeProfile = {
  id: "lofi",
  label: "Lofi",
  scale: "minor",
  keyPool: ["C", "D", "E", "F", "G", "A"],
  tempoRange: [62, 78],
  progressionPools: [
    [0, 5, 3, 4],
    [0, 3, 5, 4],
    [0, 4, 5, 3]
  ],
  chordVelocity: 0.24,
  melodyDensity: {
    intro: 0.2,
    main: 0.45,
    variation: 0.55,
    break: 0.12
  },
  useSeventhChords: false,
  drumStyle: "boom-bap"
};

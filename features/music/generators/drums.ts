import { DrumEvent, TrackSection, VibeProfile } from "@/features/music/types";

const BOOM_BAP_PATTERN: DrumEvent[] = [
  { step: 0, type: "kick", velocity: 0.36 },
  { step: 2, type: "snare", velocity: 0.2 },
  { step: 4, type: "kick", velocity: 0.31 },
  { step: 6, type: "snare", velocity: 0.22 },
  { step: 1, type: "hat", velocity: 0.1 },
  { step: 3, type: "hat", velocity: 0.1 },
  { step: 5, type: "hat", velocity: 0.11 },
  { step: 7, type: "hat", velocity: 0.1 }
];

const BRUSH_PATTERN: DrumEvent[] = [
  { step: 0, type: "kick", velocity: 0.23 },
  { step: 2, type: "hat", velocity: 0.14 },
  { step: 3, type: "snare", velocity: 0.16 },
  { step: 4, type: "kick", velocity: 0.2 },
  { step: 5, type: "hat", velocity: 0.15 },
  { step: 7, type: "snare", velocity: 0.17 }
];

export const generateDrumPattern = (profile: VibeProfile, section: TrackSection): DrumEvent[] => {
  if (profile.drumStyle === "none") {
    return [];
  }

  if (section === "break") {
    if (profile.drumStyle === "brush") {
      return [{ step: 0, type: "hat", velocity: 0.08 }, { step: 4, type: "hat", velocity: 0.07 }];
    }
    return [{ step: 0, type: "hat", velocity: 0.08 }, { step: 4, type: "snare", velocity: 0.1 }];
  }

  if (profile.drumStyle === "brush") {
    return BRUSH_PATTERN;
  }

  return BOOM_BAP_PATTERN;
};

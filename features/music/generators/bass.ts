import { BassEvent, TrackSection, VibeProfile } from "@/features/music/types";

export const generateBassPattern = (
  profile: VibeProfile,
  section: TrackSection,
  bassNote: string,
  chordNotes: string[]
): BassEvent[] => {
  if (section === "break") {
    return [{ step: 0, note: bassNote, duration: "4n", velocity: 0.12 }];
  }

  if (profile.id === "jazz") {
    const walkNote = chordNotes[Math.min(1, chordNotes.length - 1)].replace(/[0-9]/g, "") + "2";

    return [
      { step: 0, note: bassNote, duration: "8n", velocity: 0.21 },
      { step: 2, note: walkNote, duration: "8n", velocity: 0.2 },
      { step: 4, note: bassNote, duration: "8n", velocity: 0.2 },
      { step: 6, note: walkNote, duration: "8n", velocity: 0.19 }
    ];
  }

  return [
    { step: 0, note: bassNote, duration: "4n", velocity: 0.2 },
    { step: 4, note: bassNote, duration: "4n", velocity: 0.18 }
  ];
};

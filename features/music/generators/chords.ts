import { ChordBar, ScaleType, VibeProfile } from "@/features/music/types";

const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const NOTE_INDEX: Record<string, number> = NOTE_NAMES.reduce((acc, note, index) => {
  acc[note] = index;
  return acc;
}, {} as Record<string, number>);
NOTE_INDEX.Db = NOTE_INDEX["C#"];
NOTE_INDEX["D#"] = NOTE_INDEX.Eb;
NOTE_INDEX.Gb = NOTE_INDEX["F#"];
NOTE_INDEX["G#"] = NOTE_INDEX.Ab;
NOTE_INDEX["A#"] = NOTE_INDEX.Bb;

const SCALE_INTERVALS: Record<ScaleType, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10]
};
const PIANO_VOICING_RANGE: [number, number] = [48, 76];

const randomItem = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const noteIndex = (note: string): number => {
  const index = NOTE_NAMES.indexOf(note);
  return index === -1 ? 0 : index;
};

const noteFrom = (index: number): string => NOTE_NAMES[(index + NOTE_NAMES.length) % NOTE_NAMES.length];

const scaleDegreeNote = (scale: string[], degree: number, octave: number): string => {
  const wrappedDegree = ((degree % 7) + 7) % 7;
  const octaveShift = Math.floor(degree / 7);
  return `${scale[wrappedDegree]}${octave + octaveShift}`;
};

const noteToMidi = (note: string): number => {
  const match = note.match(/^([A-G](?:#|b)?)(-?\d+)$/);

  if (!match) {
    return 60;
  }

  const [, noteName, octaveValue] = match;
  const semitone = NOTE_INDEX[noteName];
  const octave = Number(octaveValue);

  if (semitone === undefined || !Number.isFinite(octave)) {
    return 60;
  }

  return (octave + 1) * 12 + semitone;
};

const midiToNote = (midi: number): string => {
  const rounded = Math.round(midi);
  const pitchClass = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  return `${NOTE_NAMES[pitchClass]}${octave}`;
};

const fitToRange = (notes: number[], [minNote, maxNote]: [number, number]): number[] =>
  notes.map((note) => {
    let next = note;

    while (next < minNote) {
      next += 12;
    }

    while (next > maxNote) {
      next -= 12;
    }

    return next;
  });

const normalizeVoicing = (notes: number[]): number[] => [...notes].sort((a, b) => a - b);

const buildVoicingCandidates = (rootPosition: number[]): number[][] => {
  const sorted = normalizeVoicing(rootPosition);
  const candidates = new Set<string>();
  const result: number[][] = [];

  for (let inversion = 0; inversion < sorted.length; inversion += 1) {
    const inverted = [...sorted];

    for (let index = 0; index < inversion; index += 1) {
      inverted[index] += 12;
    }

    const normalizedInversion = normalizeVoicing(inverted);

    [-24, -12, 0, 12, 24].forEach((shift) => {
      const shifted = normalizeVoicing(
        fitToRange(
          normalizedInversion.map((note) => note + shift),
          PIANO_VOICING_RANGE
        )
      );
      const key = shifted.join(",");

      if (!candidates.has(key)) {
        candidates.add(key);
        result.push(shifted);
      }
    });
  }

  return result;
};

const voicingDistance = (previousVoicing: number[], nextVoicing: number[]): number =>
  nextVoicing.reduce((cost, note, index) => {
    const previous = previousVoicing[index] ?? previousVoicing[previousVoicing.length - 1] ?? note;
    const movement = Math.abs(note - previous);
    const jumpPenalty = movement > 7 ? (movement - 7) * 5 : 0;
    return cost + movement + jumpPenalty;
  }, 0);

const chooseBestVoicing = (previousVoicing: number[], candidates: number[][]): number[] =>
  candidates.reduce((best, candidate) =>
    voicingDistance(previousVoicing, candidate) < voicingDistance(previousVoicing, best) ? candidate : best
  );

export const buildScaleNotes = (root: string, scaleType: ScaleType): string[] => {
  const rootIndex = noteIndex(root);
  const intervals = SCALE_INTERVALS[scaleType];

  return intervals.map((interval) => noteFrom(rootIndex + interval));
};

export const generateChordPlan = (profile: VibeProfile) => {
  const keyRoot = randomItem(profile.keyPool);
  const scaleNotes = buildScaleNotes(keyRoot, profile.scale);
  const progressionDegrees = randomItem(profile.progressionPools);
  let previousVoicing: number[] | null = null;

  const chordBars: ChordBar[] = progressionDegrees.map((degree) => {
    const root = scaleDegreeNote(scaleNotes, degree, 3);
    const third = scaleDegreeNote(scaleNotes, degree + 2, 3);
    const fifth = scaleDegreeNote(scaleNotes, degree + 4, 3);
    const seventh = scaleDegreeNote(scaleNotes, degree + 6, 3);
    const rootPosition = profile.useSeventhChords ? [root, third, fifth, seventh] : [root, third, fifth];
    let notes = rootPosition;

    if (profile.id === "piano") {
      const rootPositionMidi = normalizeVoicing(rootPosition.map((note) => noteToMidi(note)));
      const candidates = buildVoicingCandidates(rootPositionMidi);
      const bestVoicing = previousVoicing ? chooseBestVoicing(previousVoicing, candidates) : candidates[0];
      previousVoicing = bestVoicing;
      notes = bestVoicing.map((note) => midiToNote(note));
    }

    return {
      degree,
      notes,
      bassNote: scaleDegreeNote(scaleNotes, degree, 2)
    };
  });

  return {
    keyRoot,
    keyLabel: `${keyRoot} ${profile.scale}`,
    scaleNotes,
    progressionDegrees,
    chordBars
  };
};

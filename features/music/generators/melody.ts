import { MelodyEvent, TrackSection, VibeProfile } from "@/features/music/types";

const MELODY_STEPS = [0, 1, 2, 3, 4, 5, 6, 7];
const BAR_STEPS = 8;

type PianoMotifNote = {
  step: number;
  degree: number;
  duration: "8n" | "4n";
};

type PianoMotifState = {
  notes: PianoMotifNote[];
  transposeInterval: number;
};

const pianoMotifCache = new Map<string, PianoMotifState>();

const randomItem = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const maybe = (probability: number): boolean => Math.random() < probability;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const noteFromScale = (scaleNotes: string[], octave: number): string => `${randomItem(scaleNotes)}${octave}`;

const noteFromDegree = (scaleNotes: string[], degree: number): string => {
  const wrapped = ((degree % 7) + 7) % 7;
  const octaveShift = Math.floor(degree / 7);
  const octave = clamp(4 + octaveShift, 3, 6);
  return `${scaleNotes[wrapped]}${octave}`;
};

const normalizeMotif = (notes: PianoMotifNote[]): PianoMotifNote[] => {
  const seen = new Set<number>();

  return [...notes]
    .sort((a, b) => a.step - b.step)
    .filter((note) => {
      const quantized = Math.round(note.step * 1000);
      if (seen.has(quantized)) {
        return false;
      }
      seen.add(quantized);
      return true;
    })
    .slice(0, 6);
};

const createPianoMotif = (): PianoMotifNote[] => {
  const targetNotes = 4 + Math.floor(Math.random() * 3);
  const notes: PianoMotifNote[] = [];

  let cursor = 0;
  let degree = 3 + Math.floor(Math.random() * 3);

  while (cursor < BAR_STEPS && notes.length < targetNotes) {
    const duration: "8n" | "4n" = cursor <= BAR_STEPS - 2 && maybe(0.4) ? "4n" : "8n";

    notes.push({
      step: cursor,
      degree,
      duration
    });

    const advance = duration === "4n" ? 2 : 1;
    const restGap = cursor + advance < BAR_STEPS - 1 && maybe(0.18) ? 1 : 0;

    cursor += advance + restGap;
    degree = clamp(degree + randomItem([-2, -1, 0, 1, 2]), 1, 12);
  }

  while (notes.length < 4) {
    const fallbackStep = clamp(notes.length * 2, 0, BAR_STEPS - 1);
    notes.push({
      step: fallbackStep,
      degree: clamp(3 + notes.length, 1, 12),
      duration: "8n"
    });
  }

  return normalizeMotif(notes);
};

const getPianoMotif = (cacheKey: string, forceRefresh: boolean): PianoMotifState => {
  const cached = pianoMotifCache.get(cacheKey);

  if (!cached || forceRefresh) {
    const next: PianoMotifState = {
      notes: createPianoMotif(),
      transposeInterval: randomItem([-2, -1, 1, 2])
    };
    pianoMotifCache.set(cacheKey, next);
    return next;
  }

  return cached;
};

const transposeMotif = (motif: PianoMotifNote[], interval: number): PianoMotifNote[] =>
  motif.map((note) => ({
    ...note,
    degree: clamp(note.degree + interval, 0, 13)
  }));

const invertMotif = (motif: PianoMotifNote[]): PianoMotifNote[] => {
  if (motif.length === 0) {
    return motif;
  }

  const pivot = motif[0].degree;

  return motif.map((note) => ({
    ...note,
    degree: clamp(pivot - (note.degree - pivot), 0, 13)
  }));
};

const fragmentMotif = (motif: PianoMotifNote[]): PianoMotifNote[] => {
  if (motif.length <= 3) {
    return motif;
  }

  const sliceLength = clamp(Math.floor(motif.length / 2), 2, 3);
  const fragment = motif.slice(0, sliceLength).map((note) => ({ ...note }));
  const repeatShift = maybe(0.5) ? 1 : 0;

  const repeated = fragment.map((note) => ({
    ...note,
    step: clamp(note.step + 3, 0, BAR_STEPS - 1),
    degree: clamp(note.degree + repeatShift, 0, 13)
  }));

  return normalizeMotif([...fragment, ...repeated]);
};

const rhythmicVariation = (motif: PianoMotifNote[]): PianoMotifNote[] => {
  let lastStep = -1;

  const varied = motif.map((note, index) => {
    const shift = index === 0 ? 0 : randomItem([-1, 0, 0, 1]);
    let nextStep = clamp(note.step + shift, 0, BAR_STEPS - 1);

    if (nextStep <= lastStep) {
      nextStep = clamp(lastStep + 1, 0, BAR_STEPS - 1);
    }

    lastStep = nextStep;

    return {
      step: nextStep,
      degree: note.degree,
      duration: maybe(0.3) ? (note.duration === "8n" ? "4n" : "8n") : note.duration
    };
  });

  return normalizeMotif(varied);
};

const humanizeStep = (step: number): number => clamp(step + (Math.random() * 0.16 - 0.08), 0, 7.9);

export const generateMelodyPhrase = (
  profile: VibeProfile,
  scaleNotes: string[],
  section: TrackSection,
  chordNotes: string[],
  barIndex = 0
): MelodyEvent[] => {
  const density = profile.melodyDensity[section];
  const isPianoMode = profile.id === "piano";

  if (!isPianoMode) {
    if (section === "break" && !maybe(0.6)) {
      return [];
    }

    const events: MelodyEvent[] = [];

    MELODY_STEPS.forEach((step) => {
      if (!maybe(density)) {
        return;
      }

      const noteSource = maybe(0.62) ? chordNotes : [noteFromScale(scaleNotes, 4), noteFromScale(scaleNotes, 5)];
      const note = randomItem(noteSource).replace(/[0-9]/g, "") + (maybe(0.35) ? "5" : "4");

      events.push({
        step,
        note,
        duration: maybe(0.65) ? "8n" : "16n",
        velocity: section === "intro" ? 0.18 : 0.24
      });
    });

    if (events.length === 0 && section !== "break") {
      events.push({
        step: randomItem([0, 2, 4, 6]),
        note: noteFromScale(scaleNotes, 4),
        duration: "8n",
        velocity: 0.18
      });
    }

    return events;
  }

  const motifKey = `${profile.id}:${scaleNotes.join("-")}`;
  const motif = getPianoMotif(motifKey, barIndex === 0);
  const barInCycle = ((barIndex % 4) + 4) % 4;
  const cycleIndex = Math.floor(barIndex / 4);

  let sourceNotes = motif.notes;

  if (barInCycle === 1) {
    sourceNotes = transposeMotif(motif.notes, motif.transposeInterval);
  } else if (barInCycle === 3) {
    if (cycleIndex % 2 === 0) {
      sourceNotes = rhythmicVariation(invertMotif(motif.notes));
    } else {
      sourceNotes = rhythmicVariation(fragmentMotif(motif.notes));
    }
  }

  if (section === "break") {
    sourceNotes = fragmentMotif(sourceNotes).slice(0, 2);
  }

  const restChance = section === "intro" ? 0.28 : section === "break" ? 0.42 : 0.18;
  const baseVelocity = section === "intro" ? 0.16 : section === "variation" ? 0.22 : 0.2;

  const events: MelodyEvent[] = sourceNotes
    .filter((_, index) => index === 0 || !maybe(restChance))
    .map((note) => ({
      step: humanizeStep(note.step),
      note: noteFromDegree(scaleNotes, note.degree),
      duration: note.duration,
      velocity: clamp(baseVelocity + (Math.random() * 0.08 - 0.04), 0.1, 0.32)
    }));

  if (events.length === 0) {
    return [
      {
        step: 0,
        note: noteFromDegree(scaleNotes, 4),
        duration: "4n",
        velocity: 0.16
      }
    ];
  }

  return events;
};

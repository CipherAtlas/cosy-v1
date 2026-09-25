import type { AudioMix } from "./places";

export type ScoreEvent = {
  beat: number;
  duration: number;
  midi: number;
  velocity: number;
  instrument: "piano" | "bass" | "kick" | "brush" | "hat";
};
export const SCORE_VERSION = "village-phrases-1";
const SCALE = [0, 2, 4, 5, 7, 9, 11];
const HARMONY = [
  { bass: 36, notes: [48, 52, 55, 59] }, // Cmaj7
  { bass: 33, notes: [48, 52, 55, 57] }, // Am7
  { bass: 41, notes: [48, 52, 57, 60] }, // Fmaj7
  { bass: 43, notes: [47, 50, 53, 57] }, // G9
  { bass: 38, notes: [48, 53, 57, 60] }, // Dm7
  { bass: 40, notes: [47, 50, 55, 59] }, // Em7
];
const PROGRESSIONS = [
  [0, 0, 1, 1, 2, 4, 3, 0],
  [0, 5, 1, 2, 4, 3, 0, 0],
  [1, 1, 5, 2, 4, 4, 3, 3],
  [2, 0, 1, 5, 4, 3, 0, 0],
  [2, 4, 0, 1, 4, 3, 0, 0],
];

/** Bar plans are reproducible and independent of noise/foley randomness. */
export class VillageScore {
  bar = 0;
  private randomState: number;
  private motif: number[];
  private previousVoicing = [52, 55, 59];
  constructor(readonly seed = 62025) {
    this.randomState = seed >>> 0;
    this.motif = [2, 4, 3, 1].map(n => n + (this.random() > 0.6 ? 1 : 0));
  }
  private random() {
    this.randomState = (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }
  next(vibe: AudioMix["vibe"], settled = false) {
    const section = Math.floor(this.bar / 8) % 5;
    const phraseBar = this.bar % 8;
    const chord = HARMONY[PROGRESSIONS[section][phraseBar]];
    const tempo = vibe === "piano" ? 66 : vibe === "lofi" ? 76 : 84;
    const events: ScoreEvent[] = [];
    const energy = [0.72, 0.88, 0.94, 0.82, 0.56][section] * (settled ? 0.85 : 1);
    const add = (instrument: ScoreEvent["instrument"], beat: number, midi: number, duration: number, velocity: number) => {
      events.push({ instrument, beat: Math.max(0, beat + (this.random() - .5) * .028), midi, duration,
        velocity: velocity * energy * (.94 + this.random() * .12) });
    };
    // Choose each chord inversion near the preceding voicing, in a bounded register.
    const notes = chord.notes.slice(1).map((n, i) => {
      const candidates = [n - 12, n, n + 12].filter(pitch => pitch >= 48 && pitch <= 67);
      return candidates.sort((a, b) => Math.abs(a - this.previousVoicing[i]) - Math.abs(b - this.previousVoicing[i]))[0];
    }).sort((a, b) => a - b);
    this.previousVoicing = notes;
    const cadence = phraseBar === 7;
    const quiet = section === 4 && phraseBar > 5;
    if (vibe === "piano") {
      if (!(quiet && phraseBar === 7)) add("piano", 0, chord.bass + 12, 3.8, .16);
      notes.forEach((n, i) => add("piano", .1 + i * .065, n, cadence ? 4.5 : 3.1, .075));
      if (phraseBar % 2 === 0 && !quiet) add("piano", 2.5, notes[1], 1.8, .055);
    } else {
      add("bass", 0, chord.bass, 1.4, .22);
      if (!quiet) add("bass", vibe === "jazz" ? 2 : 2.5, chord.bass + (phraseBar % 2 ? 7 : 0), 1.15, .17);
      const compBeats = vibe === "jazz" ? [phraseBar % 2 ? .66 : 0, 2.66] : [0, 2.5];
      compBeats.slice(0, quiet ? 1 : 2).forEach(beat => notes.forEach((n, i) => add("piano", beat + i * .025, n, vibe === "lofi" ? 1.3 : 1.8, .065)));
      if (!quiet) {
        if (vibe === "lofi") {
          add("kick", 0, 36, .22, .27); add("kick", 2.5, 36, .18, .18);
          [1, 3].forEach(beat => add("brush", beat, 0, .18, .10));
          [0, .58, 1, 1.58, 2, 2.58, 3, 3.58].forEach((beat, i) => add("hat", beat, 0, .07, i % 2 ? .022 : .035));
        } else {
          [0, 1.67, 2, 3.67].forEach(beat => add("brush", beat, 0, .28, .045));
          [1, 3].forEach(beat => add("hat", beat, 0, .08, .022));
        }
      }
    }
    // Call, answer, development, return, then a genuine resting resolution.
    if (!quiet && phraseBar !== 3 && phraseBar !== 7) {
      const rhythm = vibe === "piano" ? [1, 2.5, 3.25] : vibe === "jazz" ? [.67, 2, 2.67] : [1.58, 2.5, 3.58];
      const count = phraseBar % 2 === 0 ? 3 : 2;
      rhythm.slice(0, count).forEach((beat, i) => {
        let degree = this.motif[(i + (phraseBar % 2 ? 2 : 0)) % this.motif.length];
        if (section === 2) degree = 6 - degree;
        if (section === 1 && i === count - 1) degree -= 1;
        let midi = 60 + SCALE[Math.max(0, Math.min(6, degree))];
        if (i === 0) midi = chord.notes.map(n => n + 12).filter(n => n <= 76).sort((a, b) => Math.abs(a - midi) - Math.abs(b - midi))[0];
        add("piano", beat, midi, i === count - 1 ? 1.8 : .85, vibe === "piano" ? .12 : .085);
      });
    } else if (cadence && !quiet) add("piano", 1, section === 2 ? 62 : 60, 3, .10);
    this.bar++;
    // Develop one motif tone per complete arc while keeping its recognisable contour.
    if (this.bar % 40 === 0) this.motif[2] = 2 + Math.floor(this.random() * 3);
    return { bar: this.bar - 1, section, tempo, events: events.sort((a, b) => a.beat - b.beat) };
  }
}

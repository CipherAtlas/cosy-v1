export type VibeId = "lofi" | "piano" | "jazz";

export type ScaleType = "major" | "minor" | "dorian";

export type TrackSection = "intro" | "main" | "variation" | "break";

export type ArrangementSegment = {
  section: TrackSection;
  bars: number;
  kind?: "section" | "transition";
  transitionTo?: TrackSection;
};

export type ArrangementBarContext = {
  section: TrackSection;
  segmentKind: "section" | "transition";
  transitionTo?: TrackSection;
  isTransitionBar: boolean;
  isSectionIntro: boolean;
  isSectionOutro: boolean;
  barInSegment: number;
  segmentLength: number;
};

export type VibeProfile = {
  id: VibeId;
  label: string;
  scale: ScaleType;
  keyPool: string[];
  tempoRange: [number, number];
  progressionPools: number[][];
  chordVelocity: number;
  melodyDensity: {
    intro: number;
    main: number;
    variation: number;
    break: number;
  };
  useSeventhChords: boolean;
  drumStyle: "none" | "boom-bap" | "brush";
};

export type ChordBar = {
  degree: number;
  notes: string[];
  bassNote: string;
};

export type MelodyEvent = {
  step: number;
  note: string;
  duration: "16n" | "8n" | "4n";
  velocity: number;
};

export type BassEvent = {
  step: number;
  note: string;
  duration: "8n" | "4n";
  velocity: number;
};

export type DrumEvent = {
  step: number;
  type: "kick" | "snare" | "hat";
  velocity: number;
};

export type GeneratedTrack = {
  vibe: VibeId;
  keyRoot: string;
  keyLabel: string;
  scaleNotes: string[];
  tempo: number;
  progressionDegrees: number[];
  chordBars: ChordBar[];
  arrangement: ArrangementSegment[];
};

export type TrackInfo = {
  vibe: VibeId;
  key: string;
  tempo: number;
  section: TrackSection;
};

export type MixLayer = "master" | "outputBoost" | "chords" | "melody" | "bass" | "drums" | "rain" | "vinyl";

export type MixState = Record<MixLayer, number>;

export type VibeMixPreset = {
  volumes: MixState;
  rainEnabled: boolean;
  vinylEnabled: boolean;
};

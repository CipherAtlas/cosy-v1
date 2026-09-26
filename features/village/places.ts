import { HEARTH } from "./environment";

export const PLACES = [
  {
    id: "focus",
    name: "Focus cottage",
    activity: "Focus",
    description: "A warm desk, a quiet mind.",
    position: [5.1, 0, 11],
    camera: [7.8, 2.5, 14.5],
    look: [10, 1.6, 9],
    prompt: "Enter focus cottage",
  },
  {
    id: "music",
    name: "Village hearth",
    activity: "Music",
    description: "Stay a while by the fire.",
    position: [-3, 0, -16],
    camera: [-1.2, 2.8, -13],
    look: [HEARTH.x, .8, HEARTH.z],
    prompt: "Sit by the fire",
  },
  {
    id: "breathe",
    name: "Willow pond",
    activity: "Breathe",
    description: "Follow the water. Find your breath.",
    position: [-19, 0, -7],
    camera: [-19, 2.4, -7],
    look: [-25, 0, -18],
    prompt: "Sit by the pond",
  },
  {
    id: "mood",
    name: "Tea garden",
    activity: "Check in",
    description: "Come exactly as you are.",
    position: [14, 0, -9],
    camera: [16.5, 2.4, -6],
    look: [15, 1.2, -12],
    prompt: "Take a quiet moment",
  },
  {
    id: "gratitude",
    name: "Writing nook",
    activity: "Journal",
    description: "Something small worth keeping.",
    position: [-19.5, 0, 8],
    camera: [-19, 2.8, 10],
    look: [-24, 1.5, 6],
    prompt: "Open your journal",
  },
  {
    id: "compliment",
    name: "Little postbox",
    activity: "A kind note",
    description: "There is something here for you.",
    position: [2.8, 0, 0],
    camera: [4.5, 2.3, 2.5],
    look: [3, 1.5, -1],
    prompt: "Read a kind note",
  },
] as const;
export type PlaceId = (typeof PLACES)[number]["id"];
export const JAPANESE_PLACE_NAMES = ["集中のコテージ", "村の焚き火", "柳の池", "お茶の庭", "書きものの隅", "小さなポスト"];
export type Quality = "auto" | "high" | "low";
export type Weather = "golden" | "dusk" | "rain";
export type AudioMix = {
  music: number;
  rain: number;
  fire: number;
  master: number;
  ambience?: number;
  effects?: number;
  vibe: "piano" | "lofi" | "jazz";
  soundtrack?: "auto" | "village" | "water" | "rest" | "hearth";
};
export const DEFAULT_MIX: AudioMix = {
  music: 0.6,
  rain: 0.12,
  fire: 0.35,
  master: 0.65,
  ambience: 0.5,
  effects: 0.6,
  vibe: "piano",
  soundtrack: "auto",
};

import { HEARTH } from "./environment";

export const PLACES = [
  {
    id: "focus",
    name: "Focus cottage",
    activity: "Focus",
    position: [5.1, 0, 11],
    camera: [7.8, 2.5, 14.5],
    look: [10, 1.6, 9],
    prompt: "Enter focus cottage",
  },
  {
    id: "music",
    name: "Village hearth",
    activity: "Music",
    position: [-3, 0, -16],
    camera: [-1.2, 2.8, -13],
    look: [HEARTH.x, .8, HEARTH.z],
    prompt: "Sit by the fire",
  },
  {
    id: "breathe",
    name: "Willow pond",
    activity: "Breathe",
    position: [-18.3, 0, -4.5],
    camera: [-18.5, 3.7, -2],
    look: [-27, 0, -10],
    prompt: "Sit by the pond",
  },
  {
    id: "mood",
    name: "Tea garden",
    activity: "Check in",
    position: [15.6, 0, -6.8],
    interactionPosition: [14.7, 0, -10],
    camera: [16.5, 2.4, -6],
    look: [15, 1.2, -12],
    prompt: "Sit with Luma",
  },
  {
    id: "gratitude",
    name: "Writing nook",
    activity: "Journal",
    position: [-19.5, 0, 8],
    camera: [-19, 2.8, 10],
    look: [-24, 1.5, 6],
    prompt: "Open your journal",
  },
  {
    id: "compliment",
    name: "Little postbox",
    activity: "A kind note",
    position: [2.8, 0, 0],
    camera: [4.5, 2.3, 2.5],
    look: [3, 1.5, -1],
    prompt: "Read a kind note",
  },
  {
    id: "garden",
    name: "Kitchen garden",
    activity: "Garden",
    position: [24.6, 0, -2.7],
    camera: [30.5, 5.8, 1.5],
    look: [24.7, .6, -7],
  },
  {
    id: "birds",
    name: "Bird clearing",
    activity: "Feed the birds",
    position: [-33.5, 0, 4],
    camera: [-31, 4.5, 11],
    look: [-37, .7, 4],
    prompt: "Scatter sourdough crumbs",
  },
] as const;
export type PlaceId = (typeof PLACES)[number]["id"];
export const JAPANESE_PLACE_NAMES = ["集中のコテージ", "村の焚き火", "柳の池", "お茶の庭", "書きものの隅", "小さなポスト", "小さな菜園", "小鳥の広場"];
export type Quality = "auto" | "high" | "low";
export type Weather = "golden" | "dusk" | "night" | "rain";
export function localTimeWeather(date: Date): Weather {
  const hour = date.getHours();
  return hour >= 7 && hour < 18 ? "golden" : hour >= 5 && hour < 20 ? "dusk" : "night";
}
export type AudioMix = {
  music: number;
  rain: number;
  fire: number;
  river?: number;
  wind?: number;
  master: number;
  ambience?: number;
  effects?: number;
  vibe: "piano" | "lofi" | "jazz";
  soundtrack?: "auto" | "village" | "water" | "rest" | "hearth";
};
export const DEFAULT_MIX: AudioMix = {
  music: 0.15,
  rain: 0.12,
  fire: 0.35,
  river: 1,
  wind: 1,
  master: 0.5,
  ambience: 0.54,
  effects: 0.75,
  vibe: "piano",
  soundtrack: "auto",
};

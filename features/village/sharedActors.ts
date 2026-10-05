import type { PlaceId } from "./places";
import type { PuppyBreed } from "./worldLayout";
import type { PuppyCommand } from "./puppies";
import type { Line } from "./villagers";
import type { Crop } from "./garden";
import type { SharedTown, TownAction } from "./townShared";

export type SharedActor = {
  id: string; kind: "puppy" | "resident" | "horse"; x: number; y: number; z: number; heading: number; speed: number;
  owner: string | null; following: boolean;
  mode: "roam" | "follow" | "hold" | "petApproach" | "pet" | "trick" | "talk" | "approach" | "visit" | "return" | "activity" | "idle" | "ride";
  action: PuppyCommand | null; startedAt: number; until: number; speech: Line | null;
  activity?: PlaceId | null; gesture?: { kind: "water" | "tea" | "horseFeed" | "horsePet"; at: number; horseId?: string };
};
export type MapActor = { id: string; kind: "visitor"; name: string; color: string; x: number; z: number };

export type SharedBirds = {
  phase: "flight" | "ground"; since: number; mealAt: number | null; flightCount?: number;
  queued: boolean; served: boolean; throwAt: number | null; origin: [number, number, number];
};
export type SharedActors = { time: number; epoch: number; actors: SharedActor[]; birds: SharedBirds; pondFeedAt: number | null; gift: { crop: Crop; at: number } | null; town?: SharedTown };
export type SharedInteraction =
  | TownAction
  | { kind: "lookout" }
  | { kind: "mapTravel"; id: string }
  | { kind: "horse"; id: string; action: "mount" | "dismount" }
  | { kind: "puppy"; id: string; action: "hold" | "release" | "pet" | "walk" | "home" | PuppyCommand }
  | { kind: "resident"; id: string; action: "talk" | "walk" | "home" }
  | { kind: "bench"; id: string; index?: 0 | 1 }
  | { kind: "swing"; id: string; index: 0 | 1 }
  | { kind: "activity"; id: PlaceId }
  | { kind: "leave" };
export type InteractionResult = { ok: boolean; reason?: string; lookoutIndex?: number; index?: 0 | 1; position?: [number, number, number] };
export type SharedHorseInput = { forward: number; turn: number; sprint: boolean; brake: boolean };
export const PUPPY_TRICK_SECONDS: Record<PuppyCommand, number> = { sit: 7, dance: 5.2, spin: 3.2, bow: 3.8, wave: 4.2, roll: 4.6 };

// Actor and camera are authored together so the interaction remains visible beside the DOM controls.
export const ACTIVITY_STAGES: Record<PlaceId, { actor: [number,number,number]; yaw: number; camera: [number,number,number]; look: [number,number,number] }> = {
  focus: { actor:[108.65,.15,-.65],yaw:Math.PI,camera:[111.3,2.65,2.5],look:[108.8,1.25,-1.65] },
  music: { actor:[-5.8,.4,-16.1],yaw:Math.PI,camera:[-.9,2.8,-15.5],look:[-5.8,1,-18.1] },
  breathe: { actor:[-23,.24,-5.5],yaw:Math.PI,camera:[-18.5,3.7,-2],look:[-26,.5,-9] },
  mood: { actor:[13.9,.4,-10],yaw:Math.PI/2,camera:[11.6,2.6,-12.2],look:[15.9,1.2,-10] },
  gratitude: { actor:[-18.2,.05,6.6],yaw:-Math.PI/2,camera:[-16.5,2.8,7.7],look:[-19.1,1.2,6.5] },
  compliment: { actor:[3.05,.05,.35],yaw:Math.PI,camera:[5.2,2.4,-3.2],look:[3,1.25,-.4] },
  birds: { actor:[-37,.4,6.5],yaw:Math.PI,camera:[-31,4.5,11],look:[-37,.7,4] },
  garden: { actor:[24.6,.05,-5.4],yaw:Math.PI,camera:[30.5,5.8,1.5],look:[24.7,.6,-7] },
};

export const COMPANION_STAGES: Record<PlaceId, [number, number, number][]> = {
  focus: [[107.6, .1, -.45], [109.8, .1, -.3], [107.3, .1, 1], [109.2, .1, 1.1], [110.6,.1,1.1]],
  music: [[-6.8, .4, -16.1], [-4.8, .4, -16.1], [-5, .4, -21.9], [-6.7, .4, -21.9], [-7.5,.05,-19]],
  breathe: [[-21.9, .24, -5.6], [-20.8, .24, -5.5], [-22.5, .24, -4.9], [-21.2, .24, -4.9], [-20,.1,-5]],
  mood: [[13.9, .4, -10.85], [13.9, .4, -9.15], [16.5, .1, -8.5], [16.5, .1, -11.5], [17,.1,-10]],
  gratitude: [[-18.1, .05, 5.2], [-17, .05, 6.6], [-18.1, .05, 7.8], [-17, .05, 8.1], [-16,.05,7.8]],
  compliment: [[2, .05, .5], [4.1, .05, .5], [2.5, .05, 1.6], [3.8, .05, 1.6], [4.8,.05,1.6]],
  birds: [[-38.5,.1,6.5],[-35.5,.1,6.5],[-39.8,.1,5.9],[-34.2,.1,5.9],[-38,.1,1.5]],
  garden: [[24.4, .05, -7.3], [20, .05, -7.5], [28.3, .05, -7.4], [25, .05, -3], [29,.05,-4]],
};

export const RESIDENT_ROUTES: [number, number][][] = [
      // Cottage lane and the entrance meadow.
      [[1.4, 7], [3.8, 10.8], [4.7, 13.5], [3.8, 19], [1.8, 30], [-.7, 28], [-.8, 18], [-.6, 7]],
      // Cross the bridge, visit the pond approach, then return to the cottages.
      [[-5, 3], [-17.8, 3], [-18.3, 0], [-18.3, -4.5], [-17.1, -5.3], [-18, 0], [-17.8, 3],
        [-5, 3], [-1.5, 4], [2.8, 6], [3.8, 10.8], [1.3, 10], [-1.5, 4]],
      // Northern lane and the riverside verge, outside the hearth seating.
      [[-.7, -8], [-.6, -16], [.1, -24], [1, -31], [-1.2, -32], [-2.5, -25],
        [-2.8, -22], [-3.2, -15], [-5, -13], [-5, -8]],
      // Tea garden, central junction and the open garden perimeter.
      [[13.8, -6.8], [12.8, -7.5], [9, -7.8], [6.5, -7.8], [4, -3], [.5, 1],
        [-1.2, -3], [-.8, -9], [4, -10], [8, -10], [12, -14.5], [18, -14.5], [19, -7.5], [17, -5.8]],
      [[-38, 1.5], [-38.8, 1.8], [-37.5, 2], [-36, 1.5]],
      [[20, -81], [20, -77], [20, -72], [20, -77]],
      [[63, -69], [63, -65], [63, -60], [63, -65]],
      [[88, -55], [88, -51], [88, -46], [88, -51]],
      [[80, 36], [84, 36], [89, 36], [84, 36]],
    ];

export const PUPPY_PATROLS: Record<PuppyBreed, [number, number][]> = {
  corgi: [[0, 0], [7, 2], [16, 6], [10, 9], [2, 6], [-6, 2], [-4, -1]],
  shiba: [[0, 0], [-3.2, -1], [-4.2, -1.7], [-9, -4.2], [-5, -8.7], [1, -8.7], [2, -3.2]],
  beagle: [[0, 0], [-6, -1.5], [-9, -1.5], [-3, -2], [6, 0], [11, 0], [11, -3], [10.7, -7.5], [11, 0], [4, 0]],
  samoyed: [[0, 0], [2, -2], [-.2, -3], [-1.5, 4], [-1.8, 7], [-2.2, 14], [.4, 13], [1.1, 5]],
  collie: [[0, 0], [1, 1.2], [-1, 2.4], [-1.8, .4]],
  shepherd: [[0, 0], [-1.3, .8], [-1.8, 2.4], [.3, 2.7]],
};

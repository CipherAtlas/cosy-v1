import { PLACES, type PlaceId } from "./places";
import { ACTIVITY_STAGES, COMPANION_STAGES } from "./sharedActors";
import { GARDEN_TARGETS } from "./garden";
import { layoutWorldPoint } from "./layoutTransforms";
import type { AuthoredWorld, ResidentId } from "./worldLayout";

const anchors: Record<PlaceId, { asset: string; pivot: [number, number, number]; yaw?: number }> = {
  focus: { asset: "cottage-1", pivot: [10, 0, 11], yaw: -90 },
  music: { asset: "hearth", pivot: [-5.8, 0, -19] },
  breathe: { asset: "dock", pivot: [-21.65, 0, -5.5] },
  mood: { asset: "pergola", pivot: [15.5, 0, -10.5] },
  gratitude: { asset: "activity-furnishings", pivot: [0, 0, 0] },
  compliment: { asset: "postbox", pivot: [3, 0, -1] },
  garden: { asset: "kitchen-garden", pivot: [24, 0, -6] },
  birds: { asset: "bird-clearing-terrace", pivot: [-37, 0, 4] },
};
const originalPlaces = JSON.parse(JSON.stringify(PLACES)) as typeof PLACES;
const originalStages = JSON.parse(JSON.stringify(ACTIVITY_STAGES)) as typeof ACTIVITY_STAGES;
const originalCompanions = JSON.parse(JSON.stringify(COMPANION_STAGES)) as typeof COMPANION_STAGES;
const originalTargets = JSON.parse(JSON.stringify(GARDEN_TARGETS)) as typeof GARDEN_TARGETS;

const visibleAssets = new WeakMap<AuthoredWorld, Set<string>>();
function visibleInLayout(authored: AuthoredWorld, asset: string) {
  let assets = visibleAssets.get(authored);
  if (!assets) { assets = new Set((authored.items ?? []).filter(item => item.visible).map(item => item.asset)); visibleAssets.set(authored, assets); }
  return assets.has(asset);
}

export function activityInLayout(authored: AuthoredWorld, id: PlaceId) {
  return authored.sceneVersion !== 1 || visibleInLayout(authored, anchors[id].asset);
}

export function residentInLayout(authored: AuthoredWorld | undefined, id: ResidentId) {
  return authored?.sceneVersion !== 1 || visibleInLayout(authored, id === "wren" ? "wren-caretaker" : `villager-${id}`);
}

/** Geometry remains authored in local coordinates; public and private interaction anchors follow its saved placement. */
export function configureLayoutInteractions(authored: AuthoredWorld) {
  const transform = (id: PlaceId, point: readonly number[]) => {
    const anchor = anchors[id];
    const item = authored.sceneVersion === 1 ? authored.items?.find(item => item.visible && item.asset === anchor.asset) : undefined;
    if (!item) return [...point] as [number, number, number];
    const rotation: [number, number, number] = [0, item.rotation[1] - (anchor.yaw ?? 0), 0];
    return layoutWorldPoint({ ...item, rotation }, point, anchor.pivot);
  };
  PLACES.forEach((place, index) => {
    const original = originalPlaces[index];
    for (const key of ["position", "camera", "look"] as const) {
      const point = transform(place.id, original[key]);
      (place[key] as unknown as number[]).splice(0, 3, ...point);
    }
    if ("interactionPosition" in place && "interactionPosition" in original)
      (place.interactionPosition as unknown as number[]).splice(0, 3, ...transform(place.id, original.interactionPosition));
    // The interior is private and stays in its separate coordinate system.
    if (place.id === "focus") return;
    const stage = ACTIVITY_STAGES[place.id], baseline = originalStages[place.id];
    stage.actor = transform(place.id, baseline.actor); stage.camera = transform(place.id, baseline.camera); stage.look = transform(place.id, baseline.look);
    const anchor = anchors[place.id], item = authored.sceneVersion === 1 ? authored.items?.find(item => item.visible && item.asset === anchor.asset) : undefined;
    stage.yaw = baseline.yaw + (item ? (item.rotation[1] - (anchor.yaw ?? 0)) * Math.PI / 180 : 0);
    COMPANION_STAGES[place.id] = originalCompanions[place.id].map(point => transform(place.id, point));
  });
  GARDEN_TARGETS.forEach((target, index) => {
    const original = originalTargets[index], id = target.id === "feed" ? "breathe" : target.id === "tea" ? "mood" : "garden";
    const point = transform(id, [original.x, 0, original.z]); target.x = point[0]; target.z = point[2];
  });
}

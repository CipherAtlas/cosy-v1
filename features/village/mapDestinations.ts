import type { AuthoredWorld } from "./worldLayout";
import { towerLookout } from "./towerLookout";
import { farmCrop, townItems, townPoint, trackPoint, TOWN_TRACK_START_ANGLE } from "./townShared";

export type MapDestination = { id: string; name: string; japanese: string; x: number; z: number; kind: "swing" | "field" | "circuit" | "farm" | "owls" | "tower" };

/** Travel anchors come from the same editable objects as the map and Worker. */
export function outdoorMapDestinations(world?: AuthoredWorld): MapDestination[] {
  if (!world) return [];
  const destinations: MapDestination[] = world.swings.map((swing, i) => ({
    id: `swing:${swing.id}`, name: `Meadow swings ${i + 1}`, japanese: `草原のブランコ ${i + 1}`, kind: "swing",
    x: swing.x + Math.sin(swing.yaw) * 3 * swing.scale[2], z: swing.z + Math.cos(swing.yaw) * 3 * swing.scale[2],
  }));
  const lookout = towerLookout(world);
  if (lookout) destinations.push({ id: "tower:watchtower", name: "Watch tower", japanese: "見張り塔", kind: "tower",
    x: lookout.entrance[0], z: lookout.entrance[2] });
  for (const item of townItems(world, "horse-racetrack")) {
    const [x, z] = trackPoint(item, TOWN_TRACK_START_ANGLE, 4);
    destinations.push({ id: `circuit:${item.id}`, name: "Willow circuit", japanese: "ウィロー・サーキット", kind: "circuit", x, z });
  }
  for (const item of townItems(world, "owl-feeding-perch")) {
    const [x, z] = townPoint(item, 0, 1.8);
    destinations.push({ id: `owls:${item.id}`, name: "Owl grove", japanese: "フクロウの木立", kind: "owls", x, z });
  }
  const farms = new Map<string, ReturnType<typeof townItems>>();
  for (const item of townItems(world, "farm-row")) {
    const group = item.id.match(/^(farm-[123])-row-/)?.[1] ?? item.id;
    farms.set(group, [...(farms.get(group) ?? []), item]);
  }
  for (const [id, rows] of farms) {
    const row = rows.find(item => /-row-4$/.test(item.id)) ?? rows[0];
    const crop = farmCrop(row), [x, z] = townPoint(row, 0, 1.6);
    destinations.push({ id: `farm:${id}`, name: crop ? `${crop[0].toUpperCase()}${crop.slice(1)} farm` : row.name ?? "Farm",
      japanese: crop === "carrot" ? "ニンジン畑" : crop === "radish" ? "ラディッシュ畑" : crop === "mint" ? "ミント畑" : "畑", kind: "farm", x, z });
  }
  const animals = ["cow-highland", "cow-highland-girl", "sheep", "lamb"].flatMap(asset => townItems(world, asset));
  if (animals.length) destinations.push({ id: "field:grazing", name: "Grazing field", japanese: "放牧場", kind: "field",
    x: animals.reduce((sum, item) => sum + item.position[0], 0) / animals.length,
    z: animals.reduce((sum, item) => sum + item.position[2], 0) / animals.length });
  return destinations;
}

export function mapArrival(destination: MapDestination, clear: (x: number, z: number) => boolean): [number, number] | null {
  if (clear(destination.x, destination.z)) return [destination.x, destination.z];
  for (let radius = .5; radius <= 4; radius += .5) {
    for (let step = 0; step < 16; step++) {
      const angle = step * Math.PI / 8, x = destination.x + Math.sin(angle) * radius, z = destination.z + Math.cos(angle) * radius;
      if (clear(x, z)) return [x, z];
    }
  }
  return null;
}

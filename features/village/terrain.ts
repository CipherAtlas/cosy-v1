export type TerrainElevation = { version: 1; cellSize: 2; base?: "flat"; samples: [number, number, number][] };
export const TERRAIN_LIMIT = 320;
export const TERRAIN_SAMPLE_LIMIT = 25000;

export function baseGroundHeight(x: number, z: number) {
  const river = Math.abs(x - (-11 + Math.sin(z * .052) * 3));
  const pond = Math.hypot((x + 27) / 9, (z + 14) / 12);
  return Math.min(river < 4 ? -.85 + river * .15 : 0, pond < 1 ? -.72 : 0)
    + Math.sin(x * .18) * Math.sin(z * .12) * .08;
}

export function baseLandscapeHeight(x: number, z: number) {
  const rise = Math.max(0, Math.min(1, (Math.hypot(x, z) - 43) / 48));
  return baseGroundHeight(x, z) + rise * (5 + Math.sin(x * .038) * Math.cos(z * .032) * 5
    + Math.sin(x * .073 + z * .041) * 2.2 + Math.sin(z * .019 - x * .012) * 4);
}

// Water, bridge approaches and fixed activity foundations retain their original grade.
export function terrainEditable(x: number, z: number) {
  if (Math.abs(x) >= TERRAIN_LIMIT - 2 || Math.abs(z) >= TERRAIN_LIMIT - 2) return false;
  if (Math.abs(x - (-11 + Math.sin(z * .052) * 3)) < 7) return false;
  if (Math.hypot((x + 27) / 9, (z + 14) / 12) < 1.85) return false;
  return ![[-37, 4, 10], [-5.8, -19, 7], [-24, -29.5, 8], [0, 3, 6], [15, -10, 9], [24.7, -6, 11], [-22, 6, 7], [5.1, 11, 5]].some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r);
}

export function validateTerrain(value: unknown): TerrainElevation {
  const terrain = value as TerrainElevation;
  if (!terrain || terrain.version !== 1 || terrain.cellSize !== 2 || !Array.isArray(terrain.samples) || terrain.samples.length > TERRAIN_SAMPLE_LIMIT)
    throw Error("Terrain needs a 2 m grid with at most 25,000 edited points.");
  if (terrain.base !== undefined && terrain.base !== "flat") throw Error("Unknown terrain base.");
  const seen = new Set<string>();
  for (const point of terrain.samples) {
    if (!Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite) || !Number.isInteger(point[0]) || !Number.isInteger(point[1]) || Math.abs(point[0]) > 160 || Math.abs(point[1]) > 160 || Math.abs(point[2]) > 60)
      throw Error("Invalid terrain elevation point.");
    const key = `${point[0]},${point[1]}`;
    if (seen.has(key)) throw Error("Terrain elevation points must be unique.");
    if (!terrainEditable(point[0] * 2, point[1] * 2)) throw Error("Water, fixed activity foundations and the world edge cannot be sculpted.");
    const height = terrainBaseHeight(terrain, point[0] * 2, point[1] * 2) + point[2];
    if (height < -.001 || height > 35.001) throw Error("Sculpted terrain must stay between 0 and 35 metres.");
    seen.add(key);
  }
  return terrain;
}

export function terrainBaseHeight(terrain: TerrainElevation | undefined, x: number, z: number) {
  if (terrain?.base !== "flat") return baseLandscapeHeight(x, z);
  const river = Math.abs(x - (-11 + Math.sin(z * .052) * 3));
  const pond = Math.hypot((x + 27) / 9, (z + 14) / 12);
  return Math.min(river < 4 && Math.abs(z) <= 110 ? -.85 + river * .15 : 0, pond < 1 ? -.72 : 0);
}

const grids = new WeakMap<TerrainElevation, Map<string, number>>();
function grid(terrain: TerrainElevation) {
  let result = grids.get(terrain);
  if (!result) { result = new Map(terrain.samples.map(([x, z, delta]) => [`${x},${z}`, delta])); grids.set(terrain, result); }
  return result;
}

export function hasTerrainEditsAt(terrain: TerrainElevation | undefined, x: number, z: number) {
  if (!terrain?.samples.length) return false;
  const gx = Math.floor(x / 2), gz = Math.floor(z / 2), values = grid(terrain);
  return values.has(`${gx},${gz}`) || values.has(`${gx + 1},${gz}`)
    || values.has(`${gx},${gz + 1}`) || values.has(`${gx + 1},${gz + 1}`);
}

export function sampleTerrainHeight(terrain: TerrainElevation | undefined, x: number, z: number) {
  if (!terrain?.samples.length) return terrainBaseHeight(terrain, x, z);
  const gx = Math.floor(x / 2), gz = Math.floor(z / 2), tx = x / 2 - gx, tz = z / 2 - gz;
  const values = grid(terrain);
  if (tx === 0 && tz === 0) return terrainBaseHeight(terrain, x, z) + (values.get(`${gx},${gz}`) ?? 0);
  if (![`${gx},${gz}`, `${gx + 1},${gz}`, `${gx},${gz + 1}`, `${gx + 1},${gz + 1}`].some(key => values.has(key))) return terrainBaseHeight(terrain, x, z);
  const at = (ix: number, iz: number) => terrainBaseHeight(terrain, ix * 2, iz * 2) + (values.get(`${ix},${iz}`) ?? 0);
  // PlaneGeometry splits each cell from its north-east to south-west corner.
  if (tx + tz <= 1) return at(gx, gz) * (1 - tx - tz) + at(gx + 1, gz) * tx + at(gx, gz + 1) * tz;
  return at(gx + 1, gz + 1) * (tx + tz - 1) + at(gx, gz + 1) * (1 - tx) + at(gx + 1, gz) * (1 - tz);
}

export function sculptTerrain(terrain: TerrainElevation | undefined, x: number, z: number, radius: number, strength: number, mode: "raise" | "lower" | "flatten" | "smooth", target: number): TerrainElevation {
  const values = new Map(terrain?.samples.map(([gx, gz, delta]) => [`${gx},${gz}`, delta]) ?? []);
  for (let gx = Math.ceil((x - radius) / 2); gx <= Math.floor((x + radius) / 2); gx++) {
    for (let gz = Math.ceil((z - radius) / 2); gz <= Math.floor((z + radius) / 2); gz++) {
      const px = gx * 2, pz = gz * 2, distance = Math.hypot(px - x, pz - z) / radius;
      if (distance >= 1 || !terrainEditable(px, pz)) continue;
      const weight = (1 - distance * distance) ** 2;
      const current = sampleTerrainHeight(terrain, px, pz);
      const average = mode === "smooth" ? [[-2, 0], [2, 0], [0, -2], [0, 2]].reduce((sum, [dx, dz]) => sum + sampleTerrainHeight(terrain, px + dx, pz + dz), 0) / 4 : target;
      const next = Math.max(0, Math.min(35, mode === "raise" || mode === "lower"
        ? current + (mode === "raise" ? 1 : -1) * strength * weight
        : current + (average - current) * Math.min(1, strength) * weight));
      const key = `${gx},${gz}`, delta = Number((next - terrainBaseHeight(terrain, px, pz)).toFixed(5));
      if (Math.abs(delta) < .00001) values.delete(key);
      else {
        if (!values.has(key) && values.size >= TERRAIN_SAMPLE_LIMIT) throw Error("Terrain reached 25,000 edited points. Undo the stroke or work within existing areas.");
        values.set(key, delta);
      }
    }
  }
  return { version: 1, cellSize: 2, ...(terrain?.base ? { base: terrain.base } : {}), samples: [...values].map(([key, delta]) => [...key.split(",").map(Number), delta] as [number, number, number]) };
}

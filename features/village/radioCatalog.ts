import type { RadioTrack } from "./soundtrack";

export const RADIO_PAGE_SIZE = 40;
export const RADIO_STATIONS = [
  { id: "lofi", en: "Soft lo-fi", ja: "やさしいローファイ", query: "lofi" },
  { id: "jazzhop", en: "Jazzhop", ja: "ジャズホップ", query: "jazzhop" },
  { id: "chillhop", en: "Chillhop", ja: "チルホップ", query: "chillhop" },
  { id: "dreamy", en: "Dreamy", ja: "夢見心地", query: "dreamy lofi" },
] as const;
export type RadioStationId = (typeof RADIO_STATIONS)[number]["id"];
export const isRadioStationId = (value: unknown): value is RadioStationId =>
  RADIO_STATIONS.some(station => station.id === value);

export function isRadioTrack(value: unknown): value is RadioTrack {
  if (!value || typeof value !== "object") return false;
  const track = value as Record<string, unknown>;
  return typeof track.id === "string" && typeof track.title === "string"
    && typeof track.artist === "string" && typeof track.permalink === "string"
    && typeof track.duration === "number";
}

export async function searchRadio(query: string, offset: number, signal: AbortSignal): Promise<{ tracks: RadioTrack[]; hasMore: boolean }> {
  const url = new URL("https://api.audius.co/v1/tracks/search");
  url.searchParams.set("query", query);
  url.searchParams.set("limit", String(RADIO_PAGE_SIZE));
  url.searchParams.set("offset", String(offset));
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Music search returned ${response.status}`);
  const payload: unknown = await response.json();
  const tracks = (payload as { data?: unknown })?.data;
  if (!Array.isArray(tracks)) throw new Error("Music search returned an invalid list");
  const playable = tracks.flatMap((item): RadioTrack[] => {
    if (!item || typeof item !== "object") return [];
    const track = item as Record<string, unknown>;
    const artist = track.user && typeof track.user === "object"
      ? (track.user as Record<string, unknown>).name : null;
    if (track.is_streamable !== true || typeof track.id !== "string"
      || typeof track.title !== "string" || typeof artist !== "string"
      || typeof track.permalink !== "string" || !track.permalink.startsWith("/")
      || typeof track.duration !== "number" || track.duration < 45) return [];
    return [{ id: track.id, title: track.title, artist, permalink: track.permalink, duration: track.duration }];
  });
  return { tracks: [...new Map(playable.map(track => [track.id, track])).values()], hasMore: tracks.length > 0 };
}

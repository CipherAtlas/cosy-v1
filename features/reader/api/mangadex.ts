import { ChapterPages, MangaChapter, MangaSearchResult, MangaSeriesDetail } from "@/features/reader/types";

const API_BASE = "https://api.mangadex.org";
const COVER_BASE = "https://uploads.mangadex.org/covers";
const MANGADEX_PROXY = (process.env.NEXT_PUBLIC_MANGADEX_PROXY ?? "").trim();
const PUBLIC_PROXY_FALLBACKS = ["https://corsproxy.io/?{url}", "https://api.allorigins.win/raw?url={url}"];
let directRequestsLikelyBlocked = false;

const DEFAULT_LANGS = ["en", "ja"];

type LocalizedRecord = Record<string, string>;

type MangaDexTag = {
  attributes?: {
    name?: LocalizedRecord;
  };
};

type MangaDexRelationship = {
  id: string;
  type: string;
  attributes?: {
    fileName?: string;
  };
};

type MangaDexManga = {
  id: string;
  attributes?: {
    title?: LocalizedRecord;
    altTitles?: LocalizedRecord[];
    description?: LocalizedRecord;
    status?: string;
    year?: number;
    tags?: MangaDexTag[];
    originalLanguage?: string;
    contentRating?: string;
  };
  relationships?: MangaDexRelationship[];
};

type MangaDexChapter = {
  id: string;
  attributes?: {
    chapter?: string;
    volume?: string;
    title?: string;
    pages?: number;
    publishAt?: string;
    readableAt?: string;
  };
};

type MangaDexListResponse<T> = {
  data: T[];
  total?: number;
  limit?: number;
  offset?: number;
};

type AtHomeResponse = {
  baseUrl: string;
  chapter: {
    hash: string;
    data: string[];
    dataSaver: string[];
  };
};

const getLocalizedText = (value?: LocalizedRecord, preferred = DEFAULT_LANGS): string => {
  if (!value) {
    return "";
  }

  for (const language of preferred) {
    const localized = value[language];
    if (localized && localized.trim()) {
      return localized.trim();
    }
  }

  const first = Object.values(value).find((item) => item.trim());
  return first?.trim() ?? "";
};

const getBestTitle = (manga: MangaDexManga): string => {
  const primary = getLocalizedText(manga.attributes?.title);
  if (primary) {
    return primary;
  }

  const altTitle = manga.attributes?.altTitles
    ?.map((entry) => getLocalizedText(entry))
    .find((entry) => entry.trim().length > 0);

  return altTitle ?? "Untitled series";
};

const getCoverFileName = (manga: MangaDexManga): string | null => {
  const coverRelation = manga.relationships?.find((relation) => relation.type === "cover_art");
  return coverRelation?.attributes?.fileName ?? null;
};

const buildCoverUrl = (mangaId: string, fileName: string | null, size: "small" | "large" = "small"): string | null => {
  if (!fileName) {
    return null;
  }

  const suffix = size === "small" ? ".256.jpg" : ".512.jpg";
  return `${COVER_BASE}/${mangaId}/${fileName}${suffix}`;
};

const normalizeDescription = (raw: string): string =>
  raw
    .replace(/\s+/g, " ")
    .replace(/\[\/?[^\]]+\]/g, "")
    .trim();

const normalizeManga = (manga: MangaDexManga): MangaSearchResult => {
  const title = getBestTitle(manga);
  const description = normalizeDescription(getLocalizedText(manga.attributes?.description));
  const tags =
    manga.attributes?.tags
      ?.map((tag) => getLocalizedText(tag.attributes?.name))
      .filter((value) => value.length > 0)
      .slice(0, 4) ?? [];

  return {
    id: manga.id,
    title,
    description,
    coverUrl: buildCoverUrl(manga.id, getCoverFileName(manga), "small"),
    status: manga.attributes?.status ?? null,
    year: manga.attributes?.year ?? null,
    tags
  };
};

const parseChapter = (chapter: MangaDexChapter): MangaChapter => ({
  id: chapter.id,
  chapterNumber: chapter.attributes?.chapter ?? null,
  volumeNumber: chapter.attributes?.volume ?? null,
  title: chapter.attributes?.title ?? null,
  pages: chapter.attributes?.pages ?? null,
  publishAt: chapter.attributes?.publishAt ?? null,
  readableAt: chapter.attributes?.readableAt ?? null
});

const chapterSort = (a: MangaChapter, b: MangaChapter): number => {
  const chapterA = Number(a.chapterNumber);
  const chapterB = Number(b.chapterNumber);

  const hasNumericA = Number.isFinite(chapterA);
  const hasNumericB = Number.isFinite(chapterB);

  if (hasNumericA && hasNumericB) {
    if (chapterA !== chapterB) {
      return chapterA - chapterB;
    }
  } else if (hasNumericA) {
    return -1;
  } else if (hasNumericB) {
    return 1;
  }

  const dateA = new Date(a.readableAt ?? a.publishAt ?? 0).getTime();
  const dateB = new Date(b.readableAt ?? b.publishAt ?? 0).getTime();
  return dateA - dateB;
};

const buildProxyUrl = (template: string, targetUrl: string): string => {
  const encoded = encodeURIComponent(targetUrl);
  return template.includes("{url}") ? template.replace("{url}", encoded) : `${template}${encoded}`;
};

const getProxyCandidates = (targetUrl: string): string[] => {
  const candidates = [MANGADEX_PROXY, ...PUBLIC_PROXY_FALLBACKS]
    .map((item) => item.trim())
    .filter((item, index, all) => item.length > 0 && all.indexOf(item) === index);

  return candidates.map((template) => buildProxyUrl(template, targetUrl));
};

const isLikelyCorsFailure = (error: unknown): boolean => {
  if (error instanceof TypeError) {
    return true;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("cors") || message.includes("failed to fetch") || message.includes("networkerror");
};

const requestJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json"
    },
    cache: "no-store",
    credentials: "omit"
  });

  if (!response.ok) {
    throw new Error(`MangaDex request failed: ${response.status}`);
  }

  return (await response.json()) as T;
};

const fetchJson = async <T>(url: string): Promise<T> => {
  if (!directRequestsLikelyBlocked) {
    try {
      return await requestJson<T>(url);
    } catch (directError) {
      if (isLikelyCorsFailure(directError)) {
        directRequestsLikelyBlocked = true;
      } else {
        throw directError;
      }
    }
  }

  for (const proxiedUrl of getProxyCandidates(url)) {
    try {
      return await requestJson<T>(proxiedUrl);
    } catch {
      // Continue trying fallback proxies.
    }
  }

  throw new Error("Could not load MangaDex data. Direct and proxy requests both failed.");
};

export const searchManga = async (query: string, limit = 20): Promise<MangaSearchResult[]> => {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const requestUrl =
    `${API_BASE}/manga?limit=${Math.min(Math.max(limit, 1), 100)}` +
    `&title=${encodeURIComponent(trimmed)}` +
    "&includes[]=cover_art" +
    "&contentRating[]=safe" +
    "&contentRating[]=suggestive" +
    "&order[relevance]=desc";

  const payload = await fetchJson<MangaDexListResponse<MangaDexManga>>(requestUrl);
  return (payload.data ?? []).map(normalizeManga);
};

export const getMangaSeries = async (seriesId: string): Promise<MangaSeriesDetail> => {
  const requestUrl = `${API_BASE}/manga/${encodeURIComponent(seriesId)}?includes[]=cover_art`;
  const payload = await fetchJson<{ data: MangaDexManga }>(requestUrl);

  const normalized = normalizeManga(payload.data);
  return {
    ...normalized,
    coverUrl: buildCoverUrl(payload.data.id, getCoverFileName(payload.data), "large"),
    originalLanguage: payload.data.attributes?.originalLanguage ?? null,
    contentRating: payload.data.attributes?.contentRating ?? null
  };
};

export const getSeriesChapters = async (seriesId: string): Promise<MangaChapter[]> => {
  const chapters: MangaChapter[] = [];
  const pageSize = 100;
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total && offset < 600) {
    const requestUrl =
      `${API_BASE}/chapter?limit=${pageSize}&offset=${offset}` +
      `&manga=${encodeURIComponent(seriesId)}` +
      "&translatedLanguage[]=en" +
      "&includeFutureUpdates=0" +
      "&order[chapter]=asc";

    const payload = await fetchJson<MangaDexListResponse<MangaDexChapter>>(requestUrl);
    const data = payload.data ?? [];

    data.forEach((entry) => {
      chapters.push(parseChapter(entry));
    });

    total = payload.total ?? data.length;
    offset += payload.limit ?? pageSize;

    if (data.length === 0) {
      break;
    }
  }

  return chapters.sort(chapterSort);
};

export const getChapterPages = async (chapterId: string): Promise<ChapterPages> => {
  const requestUrl = `${API_BASE}/at-home/server/${encodeURIComponent(chapterId)}`;
  const payload = await fetchJson<AtHomeResponse>(requestUrl);

  const hash = payload.chapter?.hash;
  const baseUrl = payload.baseUrl;

  if (!baseUrl || !hash) {
    return { pages: [], dataSaverPages: [] };
  }

  return {
    pages: (payload.chapter.data ?? []).map((fileName) => `${baseUrl}/data/${hash}/${fileName}`),
    dataSaverPages: (payload.chapter.dataSaver ?? []).map((fileName) => `${baseUrl}/data-saver/${hash}/${fileName}`)
  };
};

export const formatChapterLabel = (chapter: MangaChapter): string => {
  const chapterPart = chapter.chapterNumber ? `Ch. ${chapter.chapterNumber}` : "Chapter";
  const titlePart = chapter.title?.trim() ? ` · ${chapter.title.trim()}` : "";
  return `${chapterPart}${titlePart}`;
};

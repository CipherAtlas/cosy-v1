import { ChapterPages, MangaChapter, MangaSearchPage, MangaSearchResult, MangaSeriesDetail } from "@/features/reader/types";

const API_BASE = "https://api.mangadex.org";
const COVER_BASE = "https://uploads.mangadex.org/covers";
const MANGADEX_PROXY = (process.env.NEXT_PUBLIC_MANGADEX_PROXY ?? "").trim();
const PUBLIC_PROXY_FALLBACKS = ["https://corsproxy.io/?{url}", "https://api.allorigins.win/raw?url={url}"];
let directRequestsLikelyBlocked = false;
const RESPONSE_CACHE = new Map<string, { expiresAt: number; value: unknown }>();
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_RESPONSE_CACHE_ENTRIES = 220;
const MAX_CHAPTER_PAGES = 240;

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

type FetchJsonOptions = {
  cacheTtlMs?: number;
  forceRefresh?: boolean;
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
    tags,
    englishChapterCount: null
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

const setResponseCache = (url: string, value: unknown, ttlMs: number) => {
  if (ttlMs <= 0) {
    return;
  }

  if (RESPONSE_CACHE.size >= MAX_RESPONSE_CACHE_ENTRIES) {
    const oldestKey = RESPONSE_CACHE.keys().next().value;
    if (oldestKey) {
      RESPONSE_CACHE.delete(oldestKey);
    }
  }

  RESPONSE_CACHE.set(url, {
    expiresAt: Date.now() + ttlMs,
    value
  });
};

const isHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const normalizePageUrls = (urls: string[]): string[] =>
  urls.filter(isHttpUrl).slice(0, MAX_CHAPTER_PAGES);

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

class HttpStatusError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const wait = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });

const requestJson = async <T>(url: string): Promise<T> => {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json"
    },
    cache: "no-store",
    credentials: "omit",
    signal: controller.signal
  }).finally(() => {
    globalThis.clearTimeout(timeout);
  });

  if (!response.ok) {
    throw new HttpStatusError(response.status, `MangaDex request failed: ${response.status}`);
  }

  return (await response.json()) as T;
};

const shouldRetryError = (error: unknown): boolean => {
  if (error instanceof HttpStatusError) {
    return error.status === 429 || error.status >= 500;
  }

  return true;
};

const requestJsonWithRetry = async <T>(url: string, maxAttempts = 3): Promise<T> => {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await requestJson<T>(url);
    } catch (error) {
      lastError = error;

      if (attempt >= maxAttempts || !shouldRetryError(error)) {
        throw error;
      }

      const jitterMs = Math.floor(Math.random() * 120);
      const backoffMs = 120 * attempt + jitterMs;
      await wait(backoffMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed after retries.");
};

const fetchJson = async <T>(url: string, options: FetchJsonOptions = {}): Promise<T> => {
  const { cacheTtlMs = 0, forceRefresh = false } = options;

  if (!forceRefresh && cacheTtlMs > 0) {
    const cached = RESPONSE_CACHE.get(url);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }
  }

  if (!directRequestsLikelyBlocked) {
    try {
      const directResult = await requestJsonWithRetry<T>(url);
      setResponseCache(url, directResult, cacheTtlMs);

      return directResult;
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
      const proxiedResult = await requestJsonWithRetry<T>(proxiedUrl);
      setResponseCache(url, proxiedResult, cacheTtlMs);

      return proxiedResult;
    } catch {
      // Continue trying fallback proxies.
    }
  }

  throw new Error("Could not load MangaDex data. Direct and proxy requests both failed.");
};

export const searchManga = async (query: string, limit = 20, offset = 0): Promise<MangaSearchPage> => {
  const trimmed = query.trim().slice(0, 120);
  if (!trimmed) {
    return {
      items: [],
      total: 0,
      limit: Math.min(Math.max(limit, 1), 100),
      offset: Math.max(offset, 0),
      nextOffset: Math.max(offset, 0),
      hasMore: false
    };
  }

  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const safeOffset = Math.max(offset, 0);

  const requestUrlWithEnglishFilter =
    `${API_BASE}/manga?limit=${safeLimit}&offset=${safeOffset}` +
    `&title=${encodeURIComponent(trimmed)}` +
    "&includes[]=cover_art" +
    "&availableTranslatedLanguage[]=en" +
    "&hasAvailableChapters=true" +
    "&contentRating[]=safe" +
    "&contentRating[]=suggestive" +
    "&order[latestUploadedChapter]=desc" +
    "&order[relevance]=desc";

  const fallbackRequestUrl =
    `${API_BASE}/manga?limit=${safeLimit}&offset=${safeOffset}` +
    `&title=${encodeURIComponent(trimmed)}` +
    "&includes[]=cover_art" +
    "&contentRating[]=safe" +
    "&contentRating[]=suggestive" +
    "&order[relevance]=desc";

  let payload: MangaDexListResponse<MangaDexManga>;
  try {
    payload = await fetchJson<MangaDexListResponse<MangaDexManga>>(requestUrlWithEnglishFilter, { cacheTtlMs: 25_000 });
  } catch {
    payload = await fetchJson<MangaDexListResponse<MangaDexManga>>(fallbackRequestUrl, { cacheTtlMs: 25_000 });
  }

  const items = (payload.data ?? []).map(normalizeManga);
  const responseOffset = payload.offset ?? safeOffset;
  const responseLimit = payload.limit ?? safeLimit;
  const nextOffset = responseOffset + items.length;
  const total = typeof payload.total === "number" ? payload.total : null;
  const hasMore = total !== null ? nextOffset < total : items.length >= responseLimit;

  return {
    items,
    total,
    limit: responseLimit,
    offset: responseOffset,
    nextOffset,
    hasMore
  };
};

export const getMangaSeries = async (seriesId: string): Promise<MangaSeriesDetail> => {
  const requestUrl = `${API_BASE}/manga/${encodeURIComponent(seriesId)}?includes[]=cover_art`;
  const payload = await fetchJson<{ data: MangaDexManga }>(requestUrl, { cacheTtlMs: 120_000 });

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

    const payload = await fetchJson<MangaDexListResponse<MangaDexChapter>>(requestUrl, { cacheTtlMs: 60_000 });
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
  return getChapterPagesWithOptions(chapterId);
};

export const refreshChapterPages = async (chapterId: string): Promise<ChapterPages> => {
  return getChapterPagesWithOptions(chapterId, { forceRefresh: true });
};

const getChapterPagesWithOptions = async (chapterId: string, options: FetchJsonOptions = {}): Promise<ChapterPages> => {
  const requestUrl = `${API_BASE}/at-home/server/${encodeURIComponent(chapterId)}`;
  const payload = await fetchJson<AtHomeResponse>(requestUrl, {
    cacheTtlMs: 15_000,
    forceRefresh: options.forceRefresh
  });

  const hash = payload.chapter?.hash;
  const baseUrl = payload.baseUrl;

  if (!baseUrl || !hash) {
    return { pages: [], dataSaverPages: [] };
  }

  return {
    pages: normalizePageUrls((payload.chapter.data ?? []).map((fileName) => `${baseUrl}/data/${hash}/${fileName}`)),
    dataSaverPages: normalizePageUrls((payload.chapter.dataSaver ?? []).map((fileName) => `${baseUrl}/data-saver/${hash}/${fileName}`))
  };
};

export const getEnglishChapterCount = async (seriesId: string): Promise<number> => {
  const requestUrl =
    `${API_BASE}/chapter?limit=1` +
    `&manga=${encodeURIComponent(seriesId)}` +
    "&translatedLanguage[]=en" +
    "&includeFutureUpdates=0";

  const payload = await fetchJson<MangaDexListResponse<MangaDexChapter>>(requestUrl, { cacheTtlMs: 90_000 });
  return Math.max(0, payload.total ?? payload.data?.length ?? 0);
};

export const getEnglishChapterCounts = async (seriesIds: string[]): Promise<Record<string, number>> => {
  const uniqueIds = [...new Set(seriesIds.filter((id) => id.trim().length > 0))];
  const countsById: Record<string, number> = {};
  const workerCount = 4;
  let index = 0;

  const workers = Array.from({ length: Math.min(workerCount, uniqueIds.length) }, async () => {
    while (index < uniqueIds.length) {
      const currentIndex = index;
      index += 1;
      const seriesId = uniqueIds[currentIndex];

      try {
        countsById[seriesId] = await getEnglishChapterCount(seriesId);
      } catch {
        // Leave missing so caller can treat availability as unknown.
      }
    }
  });

  await Promise.all(workers);
  return countsById;
};

export const formatChapterLabel = (chapter: MangaChapter): string => {
  const chapterPart = chapter.chapterNumber ? `Ch. ${chapter.chapterNumber}` : "Chapter";
  const titlePart = chapter.title?.trim() ? ` · ${chapter.title.trim()}` : "";
  return `${chapterPart}${titlePart}`;
};

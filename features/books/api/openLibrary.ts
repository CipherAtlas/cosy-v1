import { BookSearchItem, BookSearchPage, BookSeriesDetail } from "@/features/books/types";
import { fetchJson } from "@/features/books/api/http";

const OPEN_LIBRARY_BASE = "https://openlibrary.org";
const OPEN_LIBRARY_COVERS = "https://covers.openlibrary.org/b/id";

type OpenLibraryDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  language?: string[];
};

type OpenLibrarySearchResponse = {
  docs?: OpenLibraryDoc[];
  numFound?: number;
  start?: number;
};

type OpenLibraryWorkAuthorRef = {
  author?: {
    key?: string;
  };
};

type OpenLibraryWorkResponse = {
  key?: string;
  title?: string;
  description?: string | { value?: string };
  subjects?: string[];
  authors?: OpenLibraryWorkAuthorRef[];
  first_publish_date?: string;
  covers?: number[];
  languages?: Array<{ key?: string }>;
};

type OpenLibraryAuthorResponse = {
  name?: string;
};

const cleanText = (value: string): string =>
  value
    .replace(/\s+/g, " ")
    .trim();

const parseYear = (raw?: string): number | null => {
  if (!raw) {
    return null;
  }

  const match = raw.match(/(1[5-9]\d{2}|20\d{2}|21\d{2})/);
  return match ? Number(match[1]) : null;
};

const coverFromId = (coverId?: number | null, size: "S" | "M" | "L" = "M"): string | null =>
  coverId ? `${OPEN_LIBRARY_COVERS}/${coverId}-${size}.jpg` : null;

const normalizeOpenLibraryDoc = (doc: OpenLibraryDoc): BookSearchItem | null => {
  const key = doc.key?.trim();
  const title = cleanText(doc.title ?? "");
  if (!key || !title) {
    return null;
  }

  const authorName = cleanText(doc.author_name?.[0] ?? "Unknown author");
  const language = doc.language?.find((entry) => entry === "eng" || entry === "en") ?? doc.language?.[0] ?? null;

  return {
    id: key,
    openLibraryKey: key,
    title,
    authorName,
    coverUrl: coverFromId(doc.cover_i ?? null, "M"),
    firstPublishYear: doc.first_publish_year ?? null,
    language,
    matchStatus: "checking",
    readerSource: null
  };
};

export const searchOpenLibraryBooks = async (query: string, page = 1, limit = 20): Promise<BookSearchPage> => {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      items: [],
      page: Math.max(1, page),
      total: 0,
      hasMore: false
    };
  }

  const safePage = Math.max(1, page);
  const safeLimit = Math.min(50, Math.max(5, limit));

  const requestUrl =
    `${OPEN_LIBRARY_BASE}/search.json?` +
    `q=${encodeURIComponent(trimmed)}` +
    `&language=eng` +
    `&limit=${safeLimit}` +
    `&page=${safePage}` +
    `&fields=key,title,author_name,first_publish_year,cover_i,language`;

  const payload = await fetchJson<OpenLibrarySearchResponse>(requestUrl, { cacheTtlMs: 30_000 });
  const docs = payload.docs ?? [];
  const items = docs.map(normalizeOpenLibraryDoc).filter((item): item is BookSearchItem => Boolean(item));
  const numFound = payload.numFound ?? items.length;
  const start = payload.start ?? (safePage - 1) * safeLimit;
  const hasMore = start + docs.length < numFound;

  return {
    items,
    page: safePage,
    total: numFound,
    hasMore
  };
};

const normalizeDescription = (description: OpenLibraryWorkResponse["description"]): string => {
  if (typeof description === "string") {
    return cleanText(description);
  }

  if (description && typeof description.value === "string") {
    return cleanText(description.value);
  }

  return "";
};

const fetchAuthorName = async (authorKey: string): Promise<string | null> => {
  const requestUrl = `${OPEN_LIBRARY_BASE}${authorKey}.json`;
  try {
    const payload = await fetchJson<OpenLibraryAuthorResponse>(requestUrl, { cacheTtlMs: 120_000 });
    return payload.name ? cleanText(payload.name) : null;
  } catch {
    return null;
  }
};

const getLanguageFromWork = (languages?: Array<{ key?: string }>): string | null => {
  if (!languages || languages.length === 0) {
    return null;
  }

  const mapped = languages
    .map((entry) => entry.key?.split("/").pop()?.toLowerCase() ?? "")
    .filter((entry) => entry.length > 0);

  return mapped.find((entry) => entry === "eng" || entry === "en") ?? mapped[0] ?? null;
};

export const getOpenLibraryWork = async (openLibraryKey: string): Promise<Omit<BookSeriesDetail, "readerSource" | "matchStatus">> => {
  const normalizedKey = openLibraryKey.startsWith("/works/") ? openLibraryKey : `/works/${openLibraryKey.replace(/^\/+/, "")}`;
  const requestUrl = `${OPEN_LIBRARY_BASE}${normalizedKey}.json`;

  const payload = await fetchJson<OpenLibraryWorkResponse>(requestUrl, { cacheTtlMs: 180_000 });
  const authorKey = payload.authors?.[0]?.author?.key ?? "";
  const resolvedAuthor = authorKey ? await fetchAuthorName(authorKey) : null;
  const title = cleanText(payload.title ?? "Untitled");

  return {
    id: payload.key ?? normalizedKey,
    openLibraryKey: payload.key ?? normalizedKey,
    title,
    authorName: resolvedAuthor ?? "Unknown author",
    coverUrl: coverFromId(payload.covers?.[0] ?? null, "L"),
    firstPublishYear: parseYear(payload.first_publish_date),
    description: normalizeDescription(payload.description),
    subjects: (payload.subjects ?? []).slice(0, 16).map(cleanText),
    language: getLanguageFromWork(payload.languages)
  };
};

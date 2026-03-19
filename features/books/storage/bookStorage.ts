import { BookHistoryItem, BookReaderSettings, BookReadingProgress, BookSeriesDetail } from "@/features/books/types";

const HISTORY_KEY = "peaceful-room.books.history";
const PROGRESS_KEY = "peaceful-room.books.progress";
const SETTINGS_KEY = "peaceful-room.books.readerSettings";

const DEFAULT_SETTINGS: BookReaderSettings = {
  theme: "light",
  fontSize: 19,
  lineHeight: 1.7
};

const canUseStorage = (): boolean => typeof window !== "undefined";

const readJson = <T>(key: string, fallback: T): T => {
  if (!canUseStorage()) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeJson = <T>(key: string, value: T): void => {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best-effort only.
  }
};

const sortHistory = (items: BookHistoryItem[]): BookHistoryItem[] =>
  [...items].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);

export const getBookHistory = (): BookHistoryItem[] => sortHistory(readJson(HISTORY_KEY, [] as BookHistoryItem[]));

export const getBookByKey = (openLibraryKey: string): BookHistoryItem | null =>
  getBookHistory().find((item) => item.openLibraryKey === openLibraryKey) ?? null;

export const getLastOpenedBook = (): BookHistoryItem | null => getBookHistory()[0] ?? null;

export const upsertBookHistory = (book: Pick<BookSeriesDetail, "openLibraryKey" | "title" | "authorName" | "coverUrl" | "firstPublishYear" | "readerSource">) => {
  const history = getBookHistory();
  const existing = history.find((item) => item.openLibraryKey === book.openLibraryKey);
  const now = Date.now();

  const nextItem: BookHistoryItem = {
    openLibraryKey: book.openLibraryKey,
    title: book.title,
    authorName: book.authorName,
    coverUrl: book.coverUrl,
    firstPublishYear: book.firstPublishYear,
    hasReaderSource: Boolean(book.readerSource),
    readerSource: book.readerSource ?? null,
    lastOpenedAt: now,
    progressPercent: existing?.progressPercent ?? 0,
    lastLocation: existing?.lastLocation ?? null,
    updatedAt: existing?.updatedAt ?? null
  };

  const nextHistory = sortHistory([nextItem, ...history.filter((item) => item.openLibraryKey !== book.openLibraryKey)]).slice(0, 180);
  writeJson(HISTORY_KEY, nextHistory);
  return nextHistory;
};

export const saveBookProgress = (progress: BookReadingProgress): BookReadingProgress[] => {
  const existing = readJson(PROGRESS_KEY, [] as BookReadingProgress[]);
  const next = [progress, ...existing.filter((entry) => entry.openLibraryKey !== progress.openLibraryKey)].slice(0, 500);
  writeJson(PROGRESS_KEY, next);

  const history = getBookHistory();
  const nextHistory = history.map((item) =>
    item.openLibraryKey === progress.openLibraryKey
      ? {
          ...item,
          progressPercent: progress.progressPercent,
          lastLocation: progress.lastLocation,
          updatedAt: progress.updatedAt,
          lastOpenedAt: Math.max(item.lastOpenedAt, progress.updatedAt)
        }
      : item
  );
  writeJson(HISTORY_KEY, nextHistory);

  return next;
};

export const getBookProgress = (openLibraryKey: string): BookReadingProgress | null => {
  const entries = readJson(PROGRESS_KEY, [] as BookReadingProgress[]);
  return entries.find((entry) => entry.openLibraryKey === openLibraryKey) ?? null;
};

export const getBookReaderSettings = (): BookReaderSettings => {
  const settings = readJson<BookReaderSettings>(SETTINGS_KEY, DEFAULT_SETTINGS);
  return {
    theme: settings.theme === "dark" ? "dark" : "light",
    fontSize: Math.min(28, Math.max(15, Number.isFinite(settings.fontSize) ? settings.fontSize : DEFAULT_SETTINGS.fontSize)),
    lineHeight: Math.min(2.2, Math.max(1.3, Number.isFinite(settings.lineHeight) ? settings.lineHeight : DEFAULT_SETTINGS.lineHeight))
  };
};

export const saveBookReaderSettings = (settings: BookReaderSettings): BookReaderSettings => {
  const normalized: BookReaderSettings = {
    theme: settings.theme === "dark" ? "dark" : "light",
    fontSize: Math.min(28, Math.max(15, settings.fontSize)),
    lineHeight: Math.min(2.2, Math.max(1.3, settings.lineHeight))
  };
  writeJson(SETTINGS_KEY, normalized);
  return normalized;
};

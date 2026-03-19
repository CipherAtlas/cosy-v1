import { ReaderChapterProgress, ReaderHistoryItem, ReaderLibraryImport } from "@/features/reader/types";

const HISTORY_KEY = "peaceful-room.reader.history";
const PROGRESS_KEY = "peaceful-room.reader.progress";
const LIBRARY_KEY = "peaceful-room.reader.library";

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
    // Ignore quota and private-mode issues; feature remains best-effort.
  }
};

const sortHistory = (items: ReaderHistoryItem[]): ReaderHistoryItem[] =>
  [...items].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);

export const getReaderHistory = (): ReaderHistoryItem[] => sortHistory(readJson(HISTORY_KEY, [] as ReaderHistoryItem[]));

export const upsertReaderHistory = (payload: {
  seriesId: string;
  seriesTitle: string;
  coverUrl: string | null;
}): ReaderHistoryItem[] => {
  const history = getReaderHistory();
  const now = Date.now();

  const existing = history.find((item) => item.seriesId === payload.seriesId);
  const nextItem: ReaderHistoryItem = {
    seriesId: payload.seriesId,
    seriesTitle: payload.seriesTitle,
    coverUrl: payload.coverUrl,
    lastOpenedAt: now,
    lastReadChapterId: existing?.lastReadChapterId ?? null,
    lastReadChapterLabel: existing?.lastReadChapterLabel ?? null,
    lastReadAt: existing?.lastReadAt ?? null
  };

  const nextHistory = sortHistory([nextItem, ...history.filter((item) => item.seriesId !== payload.seriesId)]).slice(0, 120);
  writeJson(HISTORY_KEY, nextHistory);
  return nextHistory;
};

export const markLastReadChapter = (payload: {
  seriesId: string;
  seriesTitle: string;
  coverUrl: string | null;
  chapterId: string;
  chapterLabel: string;
}): ReaderHistoryItem[] => {
  const history = getReaderHistory();
  const now = Date.now();

  const existing = history.find((item) => item.seriesId === payload.seriesId);
  const nextItem: ReaderHistoryItem = {
    seriesId: payload.seriesId,
    seriesTitle: payload.seriesTitle,
    coverUrl: payload.coverUrl,
    lastOpenedAt: now,
    lastReadChapterId: payload.chapterId,
    lastReadChapterLabel: payload.chapterLabel,
    lastReadAt: now
  };

  const nextHistory = sortHistory([
    nextItem,
    ...history.filter((item) => item.seriesId !== payload.seriesId),
    ...(existing ? [] : [])
  ]).slice(0, 120);

  writeJson(HISTORY_KEY, nextHistory);
  return nextHistory;
};

export const getSeriesHistory = (seriesId: string): ReaderHistoryItem | null =>
  getReaderHistory().find((item) => item.seriesId === seriesId) ?? null;

export const saveChapterProgress = (progress: ReaderChapterProgress): ReaderChapterProgress[] => {
  const entries = readJson(PROGRESS_KEY, [] as ReaderChapterProgress[]);
  const nextEntries = [
    progress,
    ...entries.filter((entry) => !(entry.seriesId === progress.seriesId && entry.chapterId === progress.chapterId))
  ].slice(0, 500);

  writeJson(PROGRESS_KEY, nextEntries);
  return nextEntries;
};

export const getChapterProgress = (seriesId: string, chapterId: string): ReaderChapterProgress | null => {
  const entries = readJson(PROGRESS_KEY, [] as ReaderChapterProgress[]);
  return entries.find((entry) => entry.seriesId === seriesId && entry.chapterId === chapterId) ?? null;
};

export const getSeriesContinueProgress = (seriesId: string): ReaderChapterProgress | null => {
  const entries = readJson(PROGRESS_KEY, [] as ReaderChapterProgress[])
    .filter((entry) => entry.seriesId === seriesId)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return entries[0] ?? null;
};

export const getLastOpenedSeries = (): ReaderHistoryItem | null => getReaderHistory()[0] ?? null;

export const getReaderLibraryImports = (): ReaderLibraryImport[] =>
  readJson(LIBRARY_KEY, [] as ReaderLibraryImport[])
    .filter((item) => item && item.id)
    .sort((a, b) => b.addedAt - a.addedAt);

export const saveReaderLibraryImports = (files: File[]): ReaderLibraryImport[] => {
  const existing = getReaderLibraryImports();
  const now = Date.now();

  const mapped = files.map((file, index) => ({
    id: `${now}-${index}-${file.name}`,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    addedAt: now
  }));

  const next = [...mapped, ...existing].slice(0, 200);
  writeJson(LIBRARY_KEY, next);
  return next;
};

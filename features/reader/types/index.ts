export type MangaSearchResult = {
  id: string;
  title: string;
  description: string;
  coverUrl: string | null;
  status: string | null;
  year: number | null;
  tags: string[];
};

export type MangaSeriesDetail = MangaSearchResult & {
  originalLanguage: string | null;
  contentRating: string | null;
};

export type MangaChapter = {
  id: string;
  chapterNumber: string | null;
  volumeNumber: string | null;
  title: string | null;
  pages: number | null;
  publishAt: string | null;
  readableAt: string | null;
};

export type ChapterPages = {
  pages: string[];
  dataSaverPages: string[];
};

export type ReaderHistoryItem = {
  seriesId: string;
  seriesTitle: string;
  coverUrl: string | null;
  lastOpenedAt: number;
  lastReadChapterId: string | null;
  lastReadChapterLabel: string | null;
  lastReadAt: number | null;
};

export type ReaderChapterProgress = {
  seriesId: string;
  chapterId: string;
  chapterLabel: string;
  scrollTop: number;
  scrollHeight: number;
  progressRatio: number;
  updatedAt: number;
};

export type ReaderLibraryImport = {
  id: string;
  name: string;
  type: string;
  size: number;
  addedAt: number;
};

export type ReaderUiSettings = {
  pageWidth: "narrow" | "comfortable" | "wide" | "full";
  pageGap: "tight" | "normal" | "airy";
  imageCorners: "soft" | "square";
  showProgressChip: boolean;
  autoHideChrome: boolean;
  tapToToggleChrome: boolean;
  showSettingsHints: boolean;
};

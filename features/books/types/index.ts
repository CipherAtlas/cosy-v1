export type BookReadSource = {
  sourceType: "gutendex";
  sourceBookId: number;
  htmlUrl: string | null;
  textUrl: string | null;
  epubUrl: string | null;
  languages: string[];
};

export type BookSearchItem = {
  id: string;
  openLibraryKey: string;
  title: string;
  authorName: string;
  coverUrl: string | null;
  firstPublishYear: number | null;
  language: string | null;
  matchStatus: "checking" | "readable" | "metadata";
  readerSource: BookReadSource | null;
};

export type BookSearchPage = {
  items: BookSearchItem[];
  page: number;
  total: number;
  hasMore: boolean;
};

export type BookSeriesDetail = {
  id: string;
  openLibraryKey: string;
  title: string;
  authorName: string;
  coverUrl: string | null;
  firstPublishYear: number | null;
  description: string;
  subjects: string[];
  language: string | null;
  readerSource: BookReadSource | null;
  matchStatus: "readable" | "metadata";
};

export type BookHistoryItem = {
  openLibraryKey: string;
  title: string;
  authorName: string;
  coverUrl: string | null;
  firstPublishYear: number | null;
  lastOpenedAt: number;
  hasReaderSource: boolean;
  readerSource: BookReadSource | null;
  progressPercent: number;
  lastLocation: string | null;
  updatedAt: number | null;
};

export type BookReadingProgress = {
  openLibraryKey: string;
  progressPercent: number;
  scrollTop: number;
  scrollHeight: number;
  lastLocation: string | null;
  updatedAt: number;
};

export type BookReaderContent = {
  title: string;
  authorName: string;
  source: BookReadSource;
  htmlContent: string | null;
  plainText: string | null;
  sectionAnchors: { id: string; label: string }[];
  mode: "html" | "text";
};

export type BookReaderSettings = {
  theme: "light" | "dark";
  fontSize: number;
  lineHeight: number;
};

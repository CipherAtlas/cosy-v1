type BookDetailPrefill = {
  title?: string;
  authorName?: string;
  coverUrl?: string | null;
  firstPublishYear?: number | null;
  matchStatus?: "readable" | "metadata" | "checking";
};

export const toBookDetailHref = (openLibraryKey: string, prefill?: BookDetailPrefill): string => {
  const search = new URLSearchParams();
  search.set("key", openLibraryKey);

  if (prefill?.title) {
    search.set("title", prefill.title);
  }
  if (prefill?.authorName) {
    search.set("author", prefill.authorName);
  }
  if (prefill?.coverUrl) {
    search.set("cover", prefill.coverUrl);
  }
  if (typeof prefill?.firstPublishYear === "number") {
    search.set("year", String(prefill.firstPublishYear));
  }
  if (prefill?.matchStatus) {
    search.set("status", prefill.matchStatus);
  }

  return `/books/book?${search.toString()}`;
};

export const toBookReadHref = (openLibraryKey: string): string =>
  `/books/read?key=${encodeURIComponent(openLibraryKey)}`;

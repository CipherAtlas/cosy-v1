"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBookSearch } from "@/features/books/hooks/useBookSearch";
import { toBookDetailHref } from "@/features/books/utils/routes";
import { BOOK_THEME, bookCardStyle, bookControlClassName } from "@/features/books/components/bookTheme";

export const BookSearch = () => {
  const [query, setQuery] = useState("");
  const [readableOnly, setReadableOnly] = useState(false);
  const { debouncedQuery, results, isLoading, isLoadingMore, isMatching, hasMore, readableCount, error, loadMore } = useBookSearch(query);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const checkingCount = useMemo(() => results.filter((item) => item.matchStatus === "checking").length, [results]);

  const visibleResults = useMemo(
    () => (readableOnly ? results.filter((item) => item.matchStatus === "readable" || item.matchStatus === "checking") : results),
    [readableOnly, results]
  );

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !debouncedQuery) {
      return;
    }

    const onScroll = () => {
      if (!hasMore || isLoading || isLoadingMore) {
        return;
      }

      const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
      if (remaining < 320) {
        void loadMore();
      }
    };

    onScroll();
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      element.removeEventListener("scroll", onScroll);
    };
  }, [debouncedQuery, hasMore, isLoading, isLoadingMore, loadMore, visibleResults.length]);

  useEffect(() => {
    if (!debouncedQuery || !readableOnly || visibleResults.length > 0 || !hasMore || isLoading || isLoadingMore) {
      return;
    }

    void loadMore();
  }, [debouncedQuery, hasMore, isLoading, isLoadingMore, loadMore, readableOnly, visibleResults.length]);

  return (
    <div className="space-y-5">
      <label className="block text-[13px] font-medium" style={{ color: BOOK_THEME.textSecondary }}>
        Search Books (English)
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try: Pride and Prejudice, Jane Eyre..."
          className="cozy-outline mt-2 block min-h-11 w-full rounded-2xl border px-4 py-3 text-[16px] outline-none"
          style={{
            borderColor: BOOK_THEME.border,
            background: BOOK_THEME.surface,
            color: BOOK_THEME.textPrimary
          }}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="cozy-outline min-h-10 rounded-full border px-3 py-2 text-[13px] font-medium transition-colors"
          style={{
            borderColor: BOOK_THEME.border,
            background: readableOnly ? `${BOOK_THEME.accentMint}95` : BOOK_THEME.surface,
            color: BOOK_THEME.textPrimary
          }}
          onClick={() => setReadableOnly((value) => !value)}
        >
          {readableOnly ? "Show all" : "Readable only"}
        </button>

        {debouncedQuery ? (
          <p className="text-[13px]" style={{ color: BOOK_THEME.textSecondary }}>
            {readableCount} readable matches
          </p>
        ) : null}
        {debouncedQuery && readableOnly && checkingCount > 0 ? (
          <p className="text-[13px]" style={{ color: BOOK_THEME.textSecondary }}>
            {checkingCount} still being checked
          </p>
        ) : null}
      </div>

      {isLoading ? (
        <p className="text-[15px]" style={{ color: BOOK_THEME.textSecondary }}>
          Searching books...
        </p>
      ) : null}

      {isMatching ? (
        <p className="text-[14px]" style={{ color: BOOK_THEME.textSecondary }}>
          Matching readable sources...
        </p>
      ) : null}

      {error ? (
        <p className="rounded-xl border px-3 py-2 text-[14px]" style={{ ...bookCardStyle, color: BOOK_THEME.textSecondary }}>
          {error}
        </p>
      ) : null}

      {!query.trim() ? (
        <p className="text-[15px]" style={{ color: BOOK_THEME.textSecondary }}>
          Start typing to find a book.
        </p>
      ) : null}

      {debouncedQuery && !isLoading && !error && visibleResults.length === 0 ? (
        <p className="text-[15px]" style={{ color: BOOK_THEME.textSecondary }}>
          {readableOnly
            ? "No readable public-domain matches found for this query yet. Try another title or author."
            : "No books yet for this query. Try a different title or author."}
        </p>
      ) : null}

      <div className="rounded-[1.5rem] border p-3 sm:p-4" style={bookCardStyle}>
        <div ref={scrollRef} className="max-h-[58vh] overflow-y-auto pr-0.5 sm:pr-1">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleResults.map((item) => {
              const isReadable = item.matchStatus === "readable";

              return (
                <article key={item.openLibraryKey} className="rounded-[1.4rem] border p-3" style={bookCardStyle}>
                  <div className="aspect-[3/4] overflow-hidden rounded-xl border" style={{ borderColor: BOOK_THEME.border }}>
                    {item.coverUrl ? (
                      <img
                        src={item.coverUrl}
                        alt={`${item.title} cover`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="grid h-full place-items-center px-3 text-center text-[13px]" style={{ color: BOOK_THEME.textSecondary }}>
                        No cover image
                      </div>
                    )}
                  </div>

                  <h3 className="mt-3 line-clamp-2 text-[18px] font-medium leading-tight" style={{ color: BOOK_THEME.textPrimary }}>
                    {item.title}
                  </h3>
                  <p className="mt-1 line-clamp-1 text-[14px]" style={{ color: BOOK_THEME.textSecondary }}>
                    {item.authorName}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.firstPublishYear ? (
                      <span className="rounded-full border px-2 py-0.5 text-[11px]" style={{ borderColor: BOOK_THEME.border, color: BOOK_THEME.textSecondary }}>
                        {item.firstPublishYear}
                      </span>
                    ) : null}

                    <span
                      className="rounded-full border px-2 py-0.5 text-[11px]"
                      style={{
                        borderColor: BOOK_THEME.border,
                        color: BOOK_THEME.textSecondary,
                        background:
                          item.matchStatus === "checking"
                            ? `${BOOK_THEME.accentBlue}60`
                            : isReadable
                              ? `${BOOK_THEME.accentMint}75`
                              : `${BOOK_THEME.accentPink}75`
                      }}
                    >
                      {item.matchStatus === "checking" ? "Checking" : isReadable ? "Readable" : "Metadata only"}
                    </span>
                  </div>

                  <Link
                    href={toBookDetailHref(item.openLibraryKey, {
                      title: item.title,
                      authorName: item.authorName,
                      coverUrl: item.coverUrl,
                      firstPublishYear: item.firstPublishYear,
                      matchStatus: item.matchStatus
                    })}
                    className={`${bookControlClassName} mt-3 inline-flex`}
                    style={{ borderColor: BOOK_THEME.border, background: `${BOOK_THEME.accentLavender}78`, color: BOOK_THEME.textPrimary }}
                  >
                    Open book
                  </Link>
                </article>
              );
            })}
          </div>

          {isLoadingMore ? (
            <p className="px-1 py-3 text-[13px]" style={{ color: BOOK_THEME.textSecondary }}>
              Loading more books...
            </p>
          ) : null}

          {debouncedQuery && !hasMore && visibleResults.length > 0 ? (
            <p className="px-1 py-3 text-[13px]" style={{ color: BOOK_THEME.textSecondary }}>
              You&apos;ve reached the end of these results.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

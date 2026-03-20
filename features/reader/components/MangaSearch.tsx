"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMangaSearch } from "@/features/reader/hooks/useMangaSearch";
import { toSeriesHref } from "@/features/reader/utils/routes";
import { READER_THEME, readerCardStyle, readerControlClassName } from "@/features/reader/components/readerTheme";

export const MangaSearch = () => {
  const [query, setQuery] = useState("");
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [isControlsOpen, setIsControlsOpen] = useState(true);
  const { debouncedQuery, results, isLoading, isLoadingMore, isAvailabilityLoading, hasMore, readableCount, error, loadMore } =
    useMangaSearch(query);
  const resultsScrollRef = useRef<HTMLDivElement | null>(null);

  const visibleResults = useMemo(() => {
    if (showUnavailable) {
      return results;
    }

    return results.filter((item) => item.englishChapterCount === null || item.englishChapterCount > 0);
  }, [results, showUnavailable]);

  useEffect(() => {
    const scrollElement = resultsScrollRef.current;
    if (!scrollElement || !debouncedQuery) {
      return;
    }

    const handleScroll = () => {
      if (!hasMore || isLoading || isLoadingMore) {
        return;
      }

      const remaining = scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;
      if (remaining < 340) {
        void loadMore();
      }
    };

    handleScroll();
    scrollElement.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      scrollElement.removeEventListener("scroll", handleScroll);
    };
  }, [debouncedQuery, hasMore, isLoading, isLoadingMore, loadMore, visibleResults.length]);

  useEffect(() => {
    if (!debouncedQuery || showUnavailable || visibleResults.length > 0 || !hasMore || isLoading || isLoadingMore) {
      return;
    }

    void loadMore();
  }, [debouncedQuery, hasMore, isLoading, isLoadingMore, loadMore, showUnavailable, visibleResults.length]);

  return (
    <div className="min-w-0 space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-medium uppercase tracking-[0.1em]" style={{ color: READER_THEME.textSecondary }}>
          Search Controls
        </p>
        <button
          type="button"
          className="cozy-outline min-h-10 rounded-full border px-3 py-2 text-[13px] font-medium transition-colors"
          style={{ borderColor: READER_THEME.border, background: `${READER_THEME.accentButter}80`, color: READER_THEME.textPrimary }}
          onClick={() => setIsControlsOpen((value) => !value)}
        >
          {isControlsOpen ? "Collapse" : "Expand"}
        </button>
      </div>

      {isControlsOpen ? (
        <div className="space-y-4">
          <label className="block text-[13px] font-medium" style={{ color: READER_THEME.textSecondary }}>
            Search Manga (English)
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try: Frieren, Blue Box, One Piece..."
              className="cozy-outline mt-2 block min-h-11 w-full rounded-2xl border px-4 py-3 text-[16px] outline-none"
              style={{
                borderColor: READER_THEME.border,
                background: READER_THEME.surface,
                color: READER_THEME.textPrimary
              }}
            />
          </label>

          <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <button
              type="button"
              className="cozy-outline min-h-10 rounded-full border px-3 py-2 text-[13px] font-medium transition-colors"
              style={{
                borderColor: READER_THEME.border,
                background: showUnavailable ? `${READER_THEME.accentLavender}90` : READER_THEME.surface,
                color: READER_THEME.textPrimary
              }}
              onClick={() => setShowUnavailable((value) => !value)}
            >
              {showUnavailable ? "Hide no-chapter titles" : "Show no-chapter titles"}
            </button>

            {debouncedQuery ? (
              <p className="text-[13px]" style={{ color: READER_THEME.textSecondary }}>
                {readableCount} readable English results
              </p>
            ) : null}
          </div>

          {isLoading ? (
            <p className="text-[15px]" style={{ color: READER_THEME.textSecondary }}>
              Searching manga...
            </p>
          ) : null}

          {isAvailabilityLoading ? (
            <p className="text-[14px]" style={{ color: READER_THEME.textSecondary }}>
              Checking English chapter availability...
            </p>
          ) : null}

          {error ? (
            <p className="rounded-xl border px-3 py-2 text-[14px]" style={{ ...readerCardStyle, color: READER_THEME.textSecondary }}>
              {error}
            </p>
          ) : null}

          {!query.trim() ? (
            <p className="text-[15px]" style={{ color: READER_THEME.textSecondary }}>
              Start typing to find a series.
            </p>
          ) : null}

          {debouncedQuery && !isLoading && !error && visibleResults.length === 0 ? (
            <p className="text-[15px]" style={{ color: READER_THEME.textSecondary }}>
              No readable English results yet. Try another title.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex min-h-[320px] max-h-[76dvh] flex-col rounded-[1.4rem] border p-2.5 sm:min-h-[360px] sm:max-h-[70dvh] sm:rounded-[1.5rem] sm:p-4" style={readerCardStyle}>
        <div ref={resultsScrollRef} className="h-full min-h-0 overflow-y-auto pr-0 sm:pr-1">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleResults.map((item) => {
              const chapterCount = item.englishChapterCount;
              const hasEnglishChapters = (chapterCount ?? 0) > 0;

              return (
                <article key={item.id} className="rounded-[1.4rem] border p-3" style={readerCardStyle}>
                  <div className="aspect-[3/4] overflow-hidden rounded-xl border" style={{ borderColor: READER_THEME.border }}>
                    {item.coverUrl ? (
                      <img
                        src={item.coverUrl}
                        alt={`${item.title} cover`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div
                        className="grid h-full place-items-center px-3 text-center text-[13px]"
                        style={{ color: READER_THEME.textSecondary }}
                      >
                        No cover image
                      </div>
                    )}
                  </div>

                  <h3 className="mt-3 line-clamp-2 break-words text-[17px] font-medium leading-tight sm:text-[18px]" style={{ color: READER_THEME.textPrimary }}>
                    {item.title}
                  </h3>

                  <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed" style={{ color: READER_THEME.textSecondary }}>
                    {item.description || "No description provided."}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.year ? (
                      <span
                        className="rounded-full border px-2 py-0.5 text-[11px]"
                        style={{ borderColor: READER_THEME.border, color: READER_THEME.textSecondary }}
                      >
                        {item.year}
                      </span>
                    ) : null}
                    {item.status ? (
                      <span
                        className="rounded-full border px-2 py-0.5 text-[11px]"
                        style={{ borderColor: READER_THEME.border, color: READER_THEME.textSecondary }}
                      >
                        {item.status}
                      </span>
                    ) : null}
                    <span
                      className="rounded-full border px-2 py-0.5 text-[11px]"
                      style={{
                        borderColor: READER_THEME.border,
                        color: READER_THEME.textSecondary,
                        background:
                          chapterCount === null
                            ? `${READER_THEME.accentBlue}60`
                            : hasEnglishChapters
                              ? `${READER_THEME.accentMint}70`
                              : `${READER_THEME.accentPink}70`
                      }}
                    >
                      {chapterCount === null
                        ? "Checking EN chapters..."
                        : hasEnglishChapters
                          ? `${chapterCount} EN chapters`
                          : "No EN chapters"}
                    </span>
                  </div>

                  {hasEnglishChapters || chapterCount === null ? (
                    <Link
                      href={toSeriesHref(item.id)}
                      className={`${readerControlClassName} mt-3 inline-flex w-full justify-center sm:w-auto`}
                      style={{
                        borderColor: READER_THEME.border,
                        background: `${READER_THEME.accentMint}80`,
                        color: READER_THEME.textPrimary
                      }}
                    >
                      Open series
                    </Link>
                  ) : (
                    <span
                      className={`${readerControlClassName} mt-3 inline-flex w-full cursor-not-allowed justify-center opacity-65 sm:w-auto`}
                      style={{ borderColor: READER_THEME.border, background: READER_THEME.surface, color: READER_THEME.textSecondary }}
                    >
                      Unavailable in EN
                    </span>
                  )}
                </article>
              );
            })}
          </div>

          {isLoadingMore ? (
            <p className="px-1 py-3 text-[13px]" style={{ color: READER_THEME.textSecondary }}>
              Loading more results...
            </p>
          ) : null}

          {debouncedQuery && !hasMore && visibleResults.length > 0 ? (
            <p className="px-1 py-3 text-[13px]" style={{ color: READER_THEME.textSecondary }}>
              You&apos;ve reached the end of the results.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

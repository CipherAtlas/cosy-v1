"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMangaSearch } from "@/features/reader/hooks/useMangaSearch";
import { toSeriesHref } from "@/features/reader/utils/routes";
import { READER_THEME, readerCardStyle, readerControlClassName } from "@/features/reader/components/readerTheme";

export const MangaSearch = () => {
  const [query, setQuery] = useState("");
  const [showUnavailable, setShowUnavailable] = useState(false);
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
    <div className="space-y-5">
      <label className="block text-[13px] font-medium" style={{ color: READER_THEME.textSecondary }}>
        Search Manga (English)
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try: Frieren, Blue Box, One Piece..."
          className="mt-2 block min-h-11 w-full rounded-2xl border px-4 py-3 text-[16px] outline-none"
          style={{
            borderColor: READER_THEME.border,
            background: READER_THEME.surface,
            color: READER_THEME.textPrimary
          }}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="min-h-10 rounded-full border px-3 py-2 text-[13px] font-medium transition-colors"
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

      <div className="rounded-[1.5rem] border p-3 sm:p-4" style={readerCardStyle}>
        <div ref={resultsScrollRef} className="max-h-[58vh] overflow-y-auto pr-0.5 sm:pr-1">
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

                  <h3 className="mt-3 line-clamp-2 text-[18px] font-medium leading-tight" style={{ color: READER_THEME.textPrimary }}>
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
                      className={`${readerControlClassName} mt-3 inline-flex`}
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
                      className={`${readerControlClassName} mt-3 inline-flex cursor-not-allowed opacity-65`}
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

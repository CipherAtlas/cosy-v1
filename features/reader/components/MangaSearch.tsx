"use client";

import Link from "next/link";
import { useState } from "react";
import { useMangaSearch } from "@/features/reader/hooks/useMangaSearch";
import { toSeriesHref } from "@/features/reader/utils/routes";
import { READER_THEME, readerCardStyle, readerControlClassName } from "@/features/reader/components/readerTheme";

export const MangaSearch = () => {
  const [query, setQuery] = useState("");
  const { debouncedQuery, results, isLoading, error } = useMangaSearch(query);

  return (
    <div className="space-y-5">
      <label className="block text-[13px] font-medium" style={{ color: READER_THEME.textSecondary }}>
        Search Manga
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

      {isLoading ? (
        <p className="text-[15px]" style={{ color: READER_THEME.textSecondary }}>
          Searching manga...
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

      {debouncedQuery && !isLoading && !error && results.length === 0 ? (
        <p className="text-[15px]" style={{ color: READER_THEME.textSecondary }}>
          No results yet. Try another title.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((item) => (
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
                <div className="grid h-full place-items-center px-3 text-center text-[13px]" style={{ color: READER_THEME.textSecondary }}>
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
                <span className="rounded-full border px-2 py-0.5 text-[11px]" style={{ borderColor: READER_THEME.border, color: READER_THEME.textSecondary }}>
                  {item.year}
                </span>
              ) : null}
              {item.status ? (
                <span className="rounded-full border px-2 py-0.5 text-[11px]" style={{ borderColor: READER_THEME.border, color: READER_THEME.textSecondary }}>
                  {item.status}
                </span>
              ) : null}
            </div>

            <Link
              href={toSeriesHref(item.id)}
              className={`${readerControlClassName} mt-3 inline-flex`}
              style={{ borderColor: READER_THEME.border, background: `${READER_THEME.accentMint}80`, color: READER_THEME.textPrimary }}
            >
              Open series
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
};

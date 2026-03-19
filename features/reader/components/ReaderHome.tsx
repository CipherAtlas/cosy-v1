"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ContinueReadingCard } from "@/features/reader/components/ContinueReadingCard";
import { READER_THEME, readerCardStyle, readerControlClassName } from "@/features/reader/components/readerTheme";
import { getLastOpenedSeries } from "@/features/reader/storage/readerStorage";
import { ReaderHistoryItem } from "@/features/reader/types";

export const ReaderHome = () => {
  const [continueItem, setContinueItem] = useState<ReaderHistoryItem | null>(null);

  useEffect(() => {
    setContinueItem(getLastOpenedSeries());
  }, []);

  return (
    <div className="space-y-5">
      {continueItem ? <ContinueReadingCard item={continueItem} /> : null}

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/reader/search"
          className="rounded-[1.4rem] border p-4"
          style={{ ...readerCardStyle, color: READER_THEME.textPrimary }}
        >
          <h2 className="text-[20px] font-medium">Search manga</h2>
          <p className="mt-1 text-[14px]" style={{ color: READER_THEME.textSecondary }}>
            Find titles via MangaDex public API.
          </p>
        </Link>

        <Link
          href="/reader/history"
          className="rounded-[1.4rem] border p-4"
          style={{ ...readerCardStyle, color: READER_THEME.textPrimary }}
        >
          <h2 className="text-[20px] font-medium">Reading history</h2>
          <p className="mt-1 text-[14px]" style={{ color: READER_THEME.textSecondary }}>
            Continue from your last opened series and chapter.
          </p>
        </Link>
      </section>

      <section className="rounded-[1.4rem] border p-4 sm:p-5" style={readerCardStyle}>
        <h3 className="text-[18px] font-medium">Reader behavior</h3>
        <p className="mt-2 text-[14px] leading-relaxed" style={{ color: READER_THEME.textSecondary }}>
          This reader uses lawful public API data and your own local progress storage. No scraping, no bypassing, and no
          protected-source logic is included.
        </p>

        <div className="mt-3 flex flex-wrap gap-2.5">
          <Link
            href="/reader/search"
            className={readerControlClassName}
            style={{ borderColor: READER_THEME.border, background: `${READER_THEME.accentMint}82`, color: READER_THEME.textPrimary }}
          >
            Start reading
          </Link>
          <Link
            href="/reader/library"
            className={readerControlClassName}
            style={{ borderColor: READER_THEME.border, background: `${READER_THEME.accentButter}70`, color: READER_THEME.textPrimary }}
          >
            Open library scaffold
          </Link>
        </div>
      </section>
    </div>
  );
};

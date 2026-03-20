"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getReaderHistory } from "@/features/reader/storage/readerStorage";
import { ReaderHistoryItem } from "@/features/reader/types";
import { toReadHref, toSeriesHref } from "@/features/reader/utils/routes";
import { READER_THEME, readerCardStyle, readerControlClassName } from "@/features/reader/components/readerTheme";

const formatTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });

export const ReaderHistory = () => {
  const [items, setItems] = useState<ReaderHistoryItem[]>([]);

  useEffect(() => {
    setItems(getReaderHistory());
  }, []);

  if (items.length === 0) {
    return (
      <p className="rounded-[1.4rem] border px-4 py-4 text-[15px]" style={{ ...readerCardStyle, color: READER_THEME.textSecondary }}>
        No reading history yet. Open a series to begin tracking.
      </p>
    );
  }

  return (
    <ul className="min-w-0 space-y-3">
      {items.map((item) => {
        const continueHref = item.lastReadChapterId ? toReadHref(item.seriesId, item.lastReadChapterId) : toSeriesHref(item.seriesId);

        return (
          <li key={item.seriesId} className="rounded-[1.4rem] border p-4" style={readerCardStyle}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words text-[20px] font-medium leading-tight" style={{ color: READER_THEME.textPrimary }}>
                  {item.seriesTitle}
                </h2>
                <p className="mt-1 text-[13px]" style={{ color: READER_THEME.textSecondary }}>
                  Last opened {formatTime(item.lastOpenedAt)}
                </p>
                <p className="mt-1 text-[14px]" style={{ color: READER_THEME.textSecondary }}>
                  {item.lastReadChapterLabel ?? "Open series details"}
                </p>
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
              <Link
                href={continueHref}
                className={`${readerControlClassName} w-full justify-center sm:w-auto`}
                style={{ borderColor: READER_THEME.border, background: `${READER_THEME.accentMint}85`, color: READER_THEME.textPrimary }}
              >
                Continue
              </Link>
              <Link
                href={toSeriesHref(item.seriesId)}
                className={`${readerControlClassName} w-full justify-center sm:w-auto`}
                style={{ borderColor: READER_THEME.border, background: READER_THEME.surface, color: READER_THEME.textPrimary }}
              >
                Series page
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

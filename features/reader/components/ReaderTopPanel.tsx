"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getReaderHistory } from "@/features/reader/storage/readerStorage";
import { ReaderHistoryItem } from "@/features/reader/types";
import { READER_THEME, readerCardStyle, readerControlClassName } from "@/features/reader/components/readerTheme";
import { toReadHref, toSeriesHref } from "@/features/reader/utils/routes";

type ReaderTopPanelProps = {
  seriesId?: string;
};

const navItems = [
  { href: "/reader", label: "Reader Home", tint: "accentMint" as const },
  { href: "/reader/search", label: "Search Manga", tint: "accentBlue" as const },
  { href: "/reader/history", label: "History", tint: "accentLavender" as const },
  { href: "/reader/library", label: "Library", tint: "accentButter" as const },
  { href: "/books", label: "Book Reader", tint: "accentMint" as const }
] as const;

export const ReaderTopPanel = ({ seriesId }: ReaderTopPanelProps) => {
  const pathname = usePathname();
  const normalizedPathname = useMemo(() => {
    if (!pathname) {
      return "/";
    }

    const cleaned = pathname.replace(/\/+$/, "");
    return cleaned.length > 0 ? cleaned : "/";
  }, [pathname]);
  const [history, setHistory] = useState<ReaderHistoryItem[]>([]);

  useEffect(() => {
    setHistory(getReaderHistory());
  }, [pathname, seriesId]);

  const recentItem = history[0] ?? null;
  const currentSeries = useMemo(() => {
    return seriesId ? history.find((item) => item.seriesId === seriesId) ?? null : recentItem;
  }, [history, recentItem, seriesId]);
  const currentSeriesId = seriesId ?? currentSeries?.seriesId ?? null;
  const canContinueCurrent = Boolean(currentSeriesId && currentSeries?.lastReadChapterId);

  return (
    <section className="space-y-3 rounded-[1.5rem] border p-3 sm:p-4" style={readerCardStyle}>
      <nav className="flex flex-wrap gap-2" aria-label="Reader top navigation">
        {navItems.map((item) => {
          const isActive = normalizedPathname === item.href;
          const tint = READER_THEME[item.tint];

          return (
            <Link
              key={item.href}
              href={item.href}
              className={readerControlClassName}
              style={{
                borderColor: isActive ? "rgba(232, 196, 180, 0.82)" : READER_THEME.border,
                background: isActive ? `${tint}B2` : READER_THEME.surface,
                color: READER_THEME.textPrimary
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="grid gap-3 xl:grid-cols-2">
        {currentSeries ? (
          <section className="space-y-2 rounded-[1.2rem] border p-3" style={readerCardStyle}>
            <p className="text-[11px] uppercase tracking-[0.11em]" style={{ color: READER_THEME.textSecondary }}>
              Current series
            </p>
            <h2 className="text-[17px] font-medium leading-tight" style={{ color: READER_THEME.textPrimary }}>
              {currentSeries.seriesTitle}
            </h2>
            <p className="text-[13px]" style={{ color: READER_THEME.textSecondary }}>
              {currentSeries.lastReadChapterLabel ?? "Open chapters to pick where to start."}
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              {currentSeriesId ? (
                <Link
                  href={toSeriesHref(currentSeriesId)}
                  className={readerControlClassName}
                  style={{ borderColor: READER_THEME.border, background: `${READER_THEME.accentBlue}88`, color: READER_THEME.textPrimary }}
                >
                  View chapters
                </Link>
              ) : null}
              {canContinueCurrent && currentSeriesId && currentSeries.lastReadChapterId ? (
                <Link
                  href={toReadHref(currentSeriesId, currentSeries.lastReadChapterId)}
                  className={readerControlClassName}
                  style={{ borderColor: READER_THEME.border, background: `${READER_THEME.accentPeach}98`, color: READER_THEME.textPrimary }}
                >
                  Continue
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}

        {recentItem ? (
          <section className="space-y-2 rounded-[1.2rem] border p-3" style={readerCardStyle}>
            <p className="text-[11px] uppercase tracking-[0.11em]" style={{ color: READER_THEME.textSecondary }}>
              Last opened
            </p>
            <h3 className="text-[15px] font-medium leading-tight" style={{ color: READER_THEME.textPrimary }}>
              {recentItem.seriesTitle}
            </h3>

            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href={toSeriesHref(recentItem.seriesId)}
                className={readerControlClassName}
                style={{ borderColor: READER_THEME.border, background: READER_THEME.surface, color: READER_THEME.textPrimary }}
              >
                Open series
              </Link>
              {recentItem.lastReadChapterId ? (
                <Link
                  href={toReadHref(recentItem.seriesId, recentItem.lastReadChapterId)}
                  className={readerControlClassName}
                  style={{ borderColor: READER_THEME.border, background: `${READER_THEME.accentMint}96`, color: READER_THEME.textPrimary }}
                >
                  Resume
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
};

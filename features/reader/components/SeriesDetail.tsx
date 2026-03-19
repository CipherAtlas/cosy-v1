"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatChapterLabel, getMangaSeries, getSeriesChapters } from "@/features/reader/api/mangadex";
import { markLastReadChapter, upsertReaderHistory, getSeriesHistory } from "@/features/reader/storage/readerStorage";
import { MangaChapter, MangaSeriesDetail } from "@/features/reader/types";
import { toReadHref } from "@/features/reader/utils/routes";
import { READER_THEME, readerCardStyle, readerControlClassName } from "@/features/reader/components/readerTheme";

type SeriesDetailProps = {
  seriesId: string;
};

export const SeriesDetail = ({ seriesId }: SeriesDetailProps) => {
  const [series, setSeries] = useState<MangaSeriesDetail | null>(null);
  const [chapters, setChapters] = useState<MangaChapter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyChapterId, setHistoryChapterId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [seriesData, chapterData] = await Promise.all([getMangaSeries(seriesId), getSeriesChapters(seriesId)]);

        if (cancelled) {
          return;
        }

        setSeries(seriesData);
        setChapters(chapterData);

        upsertReaderHistory({
          seriesId: seriesData.id,
          seriesTitle: seriesData.title,
          coverUrl: seriesData.coverUrl
        });

        const history = getSeriesHistory(seriesId);
        setHistoryChapterId(history?.lastReadChapterId ?? null);
      } catch {
        if (cancelled) {
          return;
        }

        setError("Could not load this series right now. Please try again.");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [seriesId]);

  const continueChapter = useMemo(() => {
    if (!historyChapterId) {
      return null;
    }

    return chapters.find((chapter) => chapter.id === historyChapterId) ?? null;
  }, [chapters, historyChapterId]);

  if (isLoading) {
    return (
      <p className="text-[16px]" style={{ color: READER_THEME.textSecondary }}>
        Loading series...
      </p>
    );
  }

  if (error || !series) {
    return (
      <p className="rounded-xl border px-4 py-3 text-[15px]" style={{ ...readerCardStyle, color: READER_THEME.textSecondary }}>
        {error ?? "Series not found."}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <article className="rounded-[1.6rem] border p-4 sm:p-5" style={readerCardStyle}>
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="mx-auto w-full max-w-[220px] shrink-0">
            <div className="aspect-[3/4] overflow-hidden rounded-xl border" style={{ borderColor: READER_THEME.border }}>
              {series.coverUrl ? (
                <img src={series.coverUrl} alt={`${series.title} cover`} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="grid h-full place-items-center px-3 text-center text-[13px]" style={{ color: READER_THEME.textSecondary }}>
                  No cover image
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-[clamp(1.6rem,4vw,2.4rem)] font-medium leading-tight">{series.title}</h2>
            <p className="mt-3 text-[15px] leading-relaxed" style={{ color: READER_THEME.textSecondary }}>
              {series.description || "No description available."}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {series.status ? (
                <span className="rounded-full border px-2 py-1 text-[12px]" style={{ borderColor: READER_THEME.border, color: READER_THEME.textSecondary }}>
                  {series.status}
                </span>
              ) : null}
              {series.year ? (
                <span className="rounded-full border px-2 py-1 text-[12px]" style={{ borderColor: READER_THEME.border, color: READER_THEME.textSecondary }}>
                  {series.year}
                </span>
              ) : null}
              {series.originalLanguage ? (
                <span className="rounded-full border px-2 py-1 text-[12px]" style={{ borderColor: READER_THEME.border, color: READER_THEME.textSecondary }}>
                  {series.originalLanguage}
                </span>
              ) : null}
            </div>

            {continueChapter ? (
              <Link
                href={toReadHref(series.id, continueChapter.id)}
                className={`${readerControlClassName} mt-4 inline-flex`}
                style={{ borderColor: READER_THEME.border, background: `${READER_THEME.accentPeach}96`, color: READER_THEME.textPrimary }}
              >
                Continue Reading · {formatChapterLabel(continueChapter)}
              </Link>
            ) : null}
          </div>
        </div>
      </article>

      <section className="space-y-3 rounded-[1.6rem] border p-4 sm:p-5" style={readerCardStyle}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[21px] font-medium">Chapters</h3>
          <p className="text-[13px]" style={{ color: READER_THEME.textSecondary }}>
            {chapters.length} chapters
          </p>
        </div>

        {chapters.length === 0 ? (
          <p className="text-[15px]" style={{ color: READER_THEME.textSecondary }}>
            No readable chapters available yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {chapters.map((chapter) => {
              const label = formatChapterLabel(chapter);

              return (
                <li key={chapter.id}>
                  <Link
                    href={toReadHref(series.id, chapter.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition-colors"
                    style={{
                      borderColor: READER_THEME.border,
                      background: chapter.id === historyChapterId ? `${READER_THEME.accentLavender}64` : READER_THEME.surface,
                      color: READER_THEME.textPrimary
                    }}
                    onClick={() => {
                      markLastReadChapter({
                        seriesId: series.id,
                        seriesTitle: series.title,
                        coverUrl: series.coverUrl,
                        chapterId: chapter.id,
                        chapterLabel: label
                      });
                    }}
                  >
                    <span className="min-w-0 text-[15px] font-medium leading-tight">{label}</span>
                    {chapter.pages ? (
                      <span className="shrink-0 text-[12px]" style={{ color: READER_THEME.textSecondary }}>
                        {chapter.pages} pages
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

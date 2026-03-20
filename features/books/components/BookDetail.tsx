"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { findGutendexSource } from "@/features/books/api/gutendex";
import { getOpenLibraryWork } from "@/features/books/api/openLibrary";
import { getBookByKey, getBookProgress, upsertBookHistory } from "@/features/books/storage/bookStorage";
import { BookSeriesDetail } from "@/features/books/types";
import { toBookReadHref } from "@/features/books/utils/routes";
import { BOOK_THEME, bookCardStyle, bookControlClassName } from "@/features/books/components/bookTheme";

export type BookDetailPrefill = {
  title: string;
  authorName: string;
  coverUrl: string | null;
  firstPublishYear: number | null;
  matchStatus: "readable" | "metadata";
};

type BookDetailProps = {
  openLibraryKey: string;
  initialPrefill?: BookDetailPrefill | null;
};

const toPrefillDetail = (openLibraryKey: string, prefill: BookDetailPrefill): BookSeriesDetail => ({
  id: openLibraryKey,
  openLibraryKey,
  title: prefill.title,
  authorName: prefill.authorName,
  coverUrl: prefill.coverUrl,
  firstPublishYear: prefill.firstPublishYear,
  description: "",
  subjects: [],
  language: "en",
  readerSource: null,
  matchStatus: prefill.matchStatus
});

const toHistoryDetail = (openLibraryKey: string, history: NonNullable<ReturnType<typeof getBookByKey>>): BookSeriesDetail => ({
  id: openLibraryKey,
  openLibraryKey,
  title: history.title,
  authorName: history.authorName,
  coverUrl: history.coverUrl,
  firstPublishYear: history.firstPublishYear,
  description: "",
  subjects: [],
  language: "en",
  readerSource: history.readerSource,
  matchStatus: history.hasReaderSource ? "readable" : "metadata"
});

export const BookDetail = ({ openLibraryKey, initialPrefill }: BookDetailProps) => {
  const [detail, setDetail] = useState<BookSeriesDetail | null>(() =>
    initialPrefill ? toPrefillDetail(openLibraryKey, initialPrefill) : null
  );
  const [isLoading, setIsLoading] = useState(!initialPrefill);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (initialPrefill) {
      setDetail((previous) => previous ?? toPrefillDetail(openLibraryKey, initialPrefill));
    }
    setIsLoading(true);
    setError(null);
    setSaveMessage(null);

    const load = async () => {
      try {
        const historyItem = getBookByKey(openLibraryKey);
        if (cancelled) {
          return;
        }

        if (historyItem) {
          setDetail((previous) => previous ?? toHistoryDetail(openLibraryKey, historyItem));
        }

        const openLibraryDetailPromise = getOpenLibraryWork(openLibraryKey);

        const fastTitle = historyItem?.title ?? initialPrefill?.title ?? "";
        const fastAuthor = historyItem?.authorName ?? initialPrefill?.authorName ?? "";
        const fastYear = historyItem?.firstPublishYear ?? initialPrefill?.firstPublishYear ?? null;
        const existingSource = historyItem?.readerSource ?? null;

        const fastSourcePromise =
          !existingSource && fastTitle && fastAuthor
            ? findGutendexSource({
                title: fastTitle,
                authorName: fastAuthor,
                firstPublishYear: fastYear
              })
            : Promise.resolve(null);

        const [openLibraryDetail, fastSource] = await Promise.all([openLibraryDetailPromise, fastSourcePromise]);
        if (cancelled) {
          return;
        }

        const source =
          existingSource ??
          fastSource ??
          (await findGutendexSource({
            title: openLibraryDetail.title,
            authorName: openLibraryDetail.authorName,
            firstPublishYear: openLibraryDetail.firstPublishYear
          }));
        if (cancelled) {
          return;
        }

        const nextDetail: BookSeriesDetail = {
          ...openLibraryDetail,
          readerSource: source,
          matchStatus: source ? "readable" : "metadata"
        };

        setDetail(nextDetail);
        upsertBookHistory(nextDetail);
      } catch {
        if (!cancelled) {
          setError("Could not load this book right now. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [initialPrefill, openLibraryKey]);

  const progress = useMemo(() => getBookProgress(openLibraryKey), [openLibraryKey, detail?.readerSource, detail?.title]);

  const handleSave = () => {
    if (!detail) {
      return;
    }

    upsertBookHistory(detail);
    setSaveMessage("Saved locally.");
    window.setTimeout(() => {
      setSaveMessage(null);
    }, 1800);
  };

  if (!detail) {
    return (
      <div className="rounded-[1.4rem] border p-4" style={bookCardStyle}>
        <p className="text-[15px]" style={{ color: BOOK_THEME.textSecondary }}>
          {error ?? "Loading book details..."}
        </p>
      </div>
    );
  }

  const isReadable = detail.matchStatus === "readable";
  const description = detail.description || "No description available for this title.";
  const continueLabel = progress && progress.progressPercent > 0 ? `Continue reading (${Math.round(progress.progressPercent)}%)` : "Continue reading";

  return (
    <div className="min-w-0 space-y-4">
      <section className="grid gap-4 rounded-[1.4rem] border p-4 md:grid-cols-[180px_minmax(0,1fr)] md:gap-5" style={bookCardStyle}>
        <div className="mx-auto w-[150px] overflow-hidden rounded-xl border md:mx-0 md:w-[180px]" style={{ borderColor: BOOK_THEME.border }}>
          {detail.coverUrl ? (
            <img
              src={detail.coverUrl}
              alt={`${detail.title} cover`}
              className="h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="grid aspect-[3/4] place-items-center px-3 text-center text-[13px]" style={{ color: BOOK_THEME.textSecondary }}>
              No cover image
            </div>
          )}
        </div>

        <div className="min-w-0">
          {error ? (
            <p className="text-[13px]" style={{ color: BOOK_THEME.textSecondary }}>
              Some metadata could not be refreshed right now.
            </p>
          ) : null}
          {isLoading ? (
            <p className="text-[12px] uppercase tracking-[0.08em]" style={{ color: BOOK_THEME.textSecondary }}>
              Refreshing details...
            </p>
          ) : null}
          <h2 className="break-words text-[clamp(1.6rem,4.5vw,2.4rem)] font-medium leading-tight">{detail.title}</h2>
          <p className="mt-1 text-[16px]" style={{ color: BOOK_THEME.textSecondary }}>
            {detail.authorName}
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            {detail.firstPublishYear ? (
              <span className="rounded-full border px-2 py-0.5 text-[12px]" style={{ borderColor: BOOK_THEME.border, color: BOOK_THEME.textSecondary }}>
                {detail.firstPublishYear}
              </span>
            ) : null}

            <span
              className="rounded-full border px-2 py-0.5 text-[12px]"
              style={{
                borderColor: BOOK_THEME.border,
                color: BOOK_THEME.textSecondary,
                background: isReadable ? `${BOOK_THEME.accentMint}72` : `${BOOK_THEME.accentPink}72`
              }}
            >
              {isReadable ? "Readable" : "Metadata only"}
            </span>
          </div>

          <p className="mt-3 text-[15px] leading-relaxed" style={{ color: BOOK_THEME.textSecondary }}>
            {description}
          </p>

          {detail.subjects.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {detail.subjects.slice(0, 10).map((subject) => (
                <span
                  key={subject}
                  className="rounded-full border px-2 py-0.5 text-[12px]"
                  style={{ borderColor: BOOK_THEME.border, color: BOOK_THEME.textSecondary, background: "rgba(255,255,255,0.5)" }}
                >
                  {subject}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-4 grid gap-2.5 sm:flex sm:flex-wrap">
            {isReadable ? (
              <Link
                href={toBookReadHref(detail.openLibraryKey)}
                className={`${bookControlClassName} w-full justify-center sm:w-auto`}
                style={{ borderColor: BOOK_THEME.border, background: `${BOOK_THEME.accentMint}90`, color: BOOK_THEME.textPrimary }}
              >
                Read now
              </Link>
            ) : (
              <span
                className={`${bookControlClassName} w-full justify-center sm:w-auto`}
                style={{ borderColor: BOOK_THEME.border, background: BOOK_THEME.surface, color: BOOK_THEME.textSecondary }}
              >
                Unavailable to read
              </span>
            )}

            <button
              type="button"
              onClick={handleSave}
              className={`${bookControlClassName} w-full justify-center sm:w-auto`}
              style={{ borderColor: BOOK_THEME.border, background: `${BOOK_THEME.accentBlue}86`, color: BOOK_THEME.textPrimary }}
            >
              Save
            </button>

            {isReadable ? (
              <Link
                href={toBookReadHref(detail.openLibraryKey)}
                className={`${bookControlClassName} w-full justify-center sm:w-auto`}
                style={{ borderColor: BOOK_THEME.border, background: `${BOOK_THEME.accentPeach}85`, color: BOOK_THEME.textPrimary }}
              >
                {continueLabel}
              </Link>
            ) : null}
          </div>

          {saveMessage ? (
            <p className="mt-2 text-[13px]" style={{ color: BOOK_THEME.textSecondary }}>
              {saveMessage}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
};

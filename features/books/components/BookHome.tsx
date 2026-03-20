"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLastOpenedBook } from "@/features/books/storage/bookStorage";
import { BookHistoryItem } from "@/features/books/types";
import { toBookDetailHref, toBookReadHref } from "@/features/books/utils/routes";
import { BOOK_THEME, bookCardStyle, bookControlClassName } from "@/features/books/components/bookTheme";

export const BookHome = () => {
  const [recentBook, setRecentBook] = useState<BookHistoryItem | null>(null);

  useEffect(() => {
    setRecentBook(getLastOpenedBook());
  }, []);

  return (
    <div className="min-w-0 space-y-5">
      {recentBook ? (
        <section className="rounded-[1.4rem] border p-4 sm:p-5" style={bookCardStyle}>
          <p className="text-[12px] uppercase tracking-[0.11em]" style={{ color: BOOK_THEME.textSecondary }}>
            Continue reading
          </p>
          <h2 className="mt-2 break-words text-[23px] font-medium leading-tight">{recentBook.title}</h2>
          <p className="mt-1 text-[15px]" style={{ color: BOOK_THEME.textSecondary }}>
            {recentBook.authorName}
          </p>
          <p className="mt-1 text-[13px]" style={{ color: BOOK_THEME.textSecondary }}>
            {Math.round(recentBook.progressPercent)}% completed
          </p>

          <div className="mt-3 grid gap-2.5 sm:flex sm:flex-wrap">
            {recentBook.hasReaderSource ? (
              <Link
                href={toBookReadHref(recentBook.openLibraryKey)}
                className={`${bookControlClassName} w-full justify-center sm:w-auto`}
                style={{ borderColor: BOOK_THEME.border, background: `${BOOK_THEME.accentMint}88`, color: BOOK_THEME.textPrimary }}
              >
                Continue reading
              </Link>
            ) : null}

            <Link
              href={toBookDetailHref(recentBook.openLibraryKey, {
                title: recentBook.title,
                authorName: recentBook.authorName,
                coverUrl: recentBook.coverUrl,
                firstPublishYear: recentBook.firstPublishYear,
                matchStatus: recentBook.hasReaderSource ? "readable" : "metadata"
              })}
              className={`${bookControlClassName} w-full justify-center sm:w-auto`}
              style={{ borderColor: BOOK_THEME.border, background: `${BOOK_THEME.accentBlue}84`, color: BOOK_THEME.textPrimary }}
            >
              Open details
            </Link>
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2">
        <Link href="/books/search" className="rounded-[1.4rem] border p-4" style={{ ...bookCardStyle, color: BOOK_THEME.textPrimary }}>
          <h3 className="text-[20px] font-medium">Search books</h3>
          <p className="mt-1 text-[14px]" style={{ color: BOOK_THEME.textSecondary }}>
            Discover from Open Library, then auto-check readable sources via Gutendex.
          </p>
        </Link>

        <Link href="/books/history" className="rounded-[1.4rem] border p-4" style={{ ...bookCardStyle, color: BOOK_THEME.textPrimary }}>
          <h3 className="text-[20px] font-medium">Reading history</h3>
          <p className="mt-1 text-[14px]" style={{ color: BOOK_THEME.textSecondary }}>
            Keep your last opened books and continue from saved progress.
          </p>
        </Link>
      </section>

      <section className="rounded-[1.4rem] border p-4 sm:p-5" style={bookCardStyle}>
        <h3 className="text-[18px] font-medium">How this works</h3>
        <p className="mt-2 text-[14px] leading-relaxed" style={{ color: BOOK_THEME.textSecondary }}>
          This feature uses legal public APIs only: Open Library for discovery metadata and Gutendex for readable public-domain text.
          Your book progress is stored locally in your browser.
        </p>
      </section>
    </div>
  );
};

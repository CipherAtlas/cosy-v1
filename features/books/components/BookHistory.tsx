"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getBookHistory } from "@/features/books/storage/bookStorage";
import { BookHistoryItem } from "@/features/books/types";
import { toBookDetailHref, toBookReadHref } from "@/features/books/utils/routes";
import { BOOK_THEME, bookCardStyle, bookControlClassName } from "@/features/books/components/bookTheme";

const formatTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });

export const BookHistory = () => {
  const [items, setItems] = useState<BookHistoryItem[]>([]);

  useEffect(() => {
    setItems(getBookHistory());
  }, []);

  if (items.length === 0) {
    return (
      <p className="rounded-[1.4rem] border px-4 py-4 text-[15px]" style={{ ...bookCardStyle, color: BOOK_THEME.textSecondary }}>
        No books opened yet. Search and open a title to start your reading history.
      </p>
    );
  }

  return (
    <ul className="min-w-0 space-y-3">
      {items.map((item) => (
        <li key={item.openLibraryKey} className="rounded-[1.4rem] border p-4" style={bookCardStyle}>
          <h2 className="break-words text-[20px] font-medium leading-tight">{item.title}</h2>
          <p className="mt-1 text-[15px]" style={{ color: BOOK_THEME.textSecondary }}>
            {item.authorName}
          </p>
          <p className="mt-1 text-[13px]" style={{ color: BOOK_THEME.textSecondary }}>
            Last opened {formatTime(item.lastOpenedAt)}
          </p>
          <p className="mt-1 text-[13px]" style={{ color: BOOK_THEME.textSecondary }}>
            {Math.round(item.progressPercent)}% read
          </p>

          <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
            <Link
              href={toBookDetailHref(item.openLibraryKey, {
                title: item.title,
                authorName: item.authorName,
                coverUrl: item.coverUrl,
                firstPublishYear: item.firstPublishYear,
                matchStatus: item.hasReaderSource ? "readable" : "metadata"
              })}
              className={`${bookControlClassName} w-full justify-center sm:w-auto`}
              style={{ borderColor: BOOK_THEME.border, background: BOOK_THEME.surface, color: BOOK_THEME.textPrimary }}
            >
              Open details
            </Link>
            {item.hasReaderSource ? (
              <Link
                href={toBookReadHref(item.openLibraryKey)}
                className={`${bookControlClassName} w-full justify-center sm:w-auto`}
                style={{ borderColor: BOOK_THEME.border, background: `${BOOK_THEME.accentMint}88`, color: BOOK_THEME.textPrimary }}
              >
                Continue
              </Link>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
};

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookFrame } from "@/features/books/components/BookFrame";
import { BookDetail, BookDetailPrefill } from "@/features/books/components/BookDetail";
import { BOOK_THEME, bookCardStyle, bookControlClassName } from "@/features/books/components/bookTheme";

export const BookDetailPageClient = () => {
  const searchParams = useSearchParams();
  const openLibraryKey = searchParams.get("key")?.trim() ?? "";
  const title = searchParams.get("title")?.trim() ?? "";
  const authorName = searchParams.get("author")?.trim() ?? "";
  const coverUrl = searchParams.get("cover")?.trim() ?? "";
  const yearRaw = searchParams.get("year")?.trim() ?? "";
  const statusRaw = searchParams.get("status")?.trim() ?? "";

  const yearNumber = Number(yearRaw);
  const initialPrefill: BookDetailPrefill | null =
    title && authorName
      ? {
          title,
          authorName,
          coverUrl: coverUrl || null,
          firstPublishYear: Number.isFinite(yearNumber) ? yearNumber : null,
          matchStatus: statusRaw === "readable" ? "readable" : "metadata"
        }
      : null;

  return (
    <BookFrame
      title="Book Detail"
      subtitle="View metadata, match status, and continue reading."
      openLibraryKey={openLibraryKey || undefined}
    >
      {openLibraryKey ? (
        <BookDetail openLibraryKey={openLibraryKey} initialPrefill={initialPrefill} />
      ) : (
        <div className="rounded-[1.4rem] border p-4" style={bookCardStyle}>
          <p className="text-[15px]" style={{ color: BOOK_THEME.textSecondary }}>
            Missing book key. Start from search.
          </p>
          <Link
            href="/books/search"
            className={`${bookControlClassName} mt-3 inline-flex`}
            style={{ borderColor: BOOK_THEME.border, background: `${BOOK_THEME.accentBlue}82`, color: BOOK_THEME.textPrimary }}
          >
            Go to search
          </Link>
        </div>
      )}
    </BookFrame>
  );
};

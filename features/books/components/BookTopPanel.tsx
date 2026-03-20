"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getBookHistory } from "@/features/books/storage/bookStorage";
import { BookHistoryItem } from "@/features/books/types";
import { toBookDetailHref, toBookReadHref } from "@/features/books/utils/routes";
import { BOOK_THEME, bookCardStyle, bookControlClassName } from "@/features/books/components/bookTheme";

type BookTopPanelProps = {
  openLibraryKey?: string;
  themeMode?: "light" | "dark";
};

const navItems = [
  { href: "/books", label: "Books Home", tint: "accentMint" as const },
  { href: "/books/search", label: "Search Books", tint: "accentBlue" as const },
  { href: "/books/history", label: "History", tint: "accentLavender" as const },
  { href: "/reader/pdf", label: "Search PDFs", tint: "accentPeach" as const },
  { href: "/reader", label: "Manga Reader", tint: "accentButter" as const }
] as const;

export const BookTopPanel = ({ openLibraryKey, themeMode = "light" }: BookTopPanelProps) => {
  const pathname = usePathname();
  const normalizedPathname = useMemo(() => {
    if (!pathname) {
      return "/";
    }
    const cleaned = pathname.replace(/\/+$/, "");
    return cleaned.length > 0 ? cleaned : "/";
  }, [pathname]);
  const [history, setHistory] = useState<BookHistoryItem[]>([]);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isMetaOpen, setIsMetaOpen] = useState(false);

  useEffect(() => {
    setHistory(getBookHistory());
  }, [pathname, openLibraryKey]);

  const recentItem = history[0] ?? null;
  const currentBook = useMemo(() => {
    return openLibraryKey ? history.find((item) => item.openLibraryKey === openLibraryKey) ?? null : recentItem;
  }, [history, openLibraryKey, recentItem]);
  const currentKey = openLibraryKey ?? currentBook?.openLibraryKey ?? null;
  const canContinue = Boolean(currentKey && currentBook?.hasReaderSource);
  const isDark = themeMode === "dark";
  const borderColor = isDark ? "rgba(255, 226, 179, 0.22)" : BOOK_THEME.border;
  const textPrimary = isDark ? BOOK_THEME.readerDarkText : BOOK_THEME.textPrimary;
  const textSecondary = isDark ? "rgba(242, 231, 209, 0.72)" : BOOK_THEME.textSecondary;
  const panelSurface = isDark ? "rgba(51, 43, 39, 0.88)" : bookCardStyle.background;
  const panelStrong = isDark ? "rgba(31, 27, 24, 0.94)" : BOOK_THEME.surfaceStrong;

  return (
    <section className="space-y-3 rounded-[1.4rem] border p-2.5 sm:rounded-[1.5rem] sm:p-4" style={{ borderColor, background: panelSurface }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.11em]" style={{ color: textSecondary }}>
          Reader Navigation
        </p>
        <button
          type="button"
          className={bookControlClassName}
          style={{ borderColor, background: `${BOOK_THEME.accentButter}8A`, color: textPrimary }}
          onClick={() => setIsNavOpen((value) => !value)}
        >
          {isNavOpen ? "Hide Navigation" : "Show Navigation"}
        </button>
      </div>

      {isNavOpen ? (
        <nav className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Book top navigation">
          {navItems.map((item) => {
            const isActive = normalizedPathname === item.href;
            const tint = BOOK_THEME[item.tint];

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${bookControlClassName} shrink-0 whitespace-nowrap px-3 py-2 text-[13px] sm:px-4 sm:py-2.5 sm:text-[15px]`}
                style={{
                  borderColor: isActive ? (isDark ? "rgba(255, 226, 179, 0.45)" : "rgba(232, 196, 180, 0.82)") : borderColor,
                  background: isActive ? `${tint}B2` : panelStrong,
                  color: textPrimary
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      ) : null}

      <button
        type="button"
        className={bookControlClassName}
        style={{ borderColor, background: `${BOOK_THEME.accentButter}8A`, color: textPrimary }}
        onClick={() => setIsMetaOpen((value) => !value)}
      >
        {isMetaOpen ? "Hide Book Info" : "Show Book Info"}
      </button>

      <div className={`${isMetaOpen ? "grid" : "hidden"} min-w-0 gap-3 xl:grid-cols-2`}>
        {currentBook ? (
          <section className="space-y-2 rounded-[1.2rem] border p-3" style={{ borderColor, background: panelStrong }}>
            <p className="text-[11px] uppercase tracking-[0.11em]" style={{ color: textSecondary }}>
              Current book
            </p>
            <h2 className="text-[17px] font-medium leading-tight" style={{ color: textPrimary }}>
              {currentBook.title}
            </h2>
            <p className="text-[13px]" style={{ color: textSecondary }}>
              {currentBook.authorName}
            </p>
            <p className="text-[12px]" style={{ color: textSecondary }}>
              {Math.round(currentBook.progressPercent)}% read
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              {currentKey ? (
                <Link
                  href={toBookDetailHref(currentKey, {
                    title: currentBook.title,
                    authorName: currentBook.authorName,
                    coverUrl: currentBook.coverUrl,
                    firstPublishYear: currentBook.firstPublishYear,
                    matchStatus: currentBook.hasReaderSource ? "readable" : "metadata"
                  })}
                  className={bookControlClassName}
                  style={{ borderColor, background: `${BOOK_THEME.accentBlue}88`, color: textPrimary }}
                >
                  Book details
                </Link>
              ) : null}
              {canContinue && currentKey ? (
                <Link
                  href={toBookReadHref(currentKey)}
                  className={bookControlClassName}
                  style={{ borderColor, background: `${BOOK_THEME.accentPeach}95`, color: textPrimary }}
                >
                  Continue
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}

        {recentItem ? (
          <section className="space-y-2 rounded-[1.2rem] border p-3" style={{ borderColor, background: panelStrong }}>
            <p className="text-[11px] uppercase tracking-[0.11em]" style={{ color: textSecondary }}>
              Last opened
            </p>
            <h3 className="text-[15px] font-medium leading-tight" style={{ color: textPrimary }}>
              {recentItem.title}
            </h3>
            <p className="text-[12px]" style={{ color: textSecondary }}>
              {recentItem.authorName}
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href={toBookDetailHref(recentItem.openLibraryKey, {
                  title: recentItem.title,
                  authorName: recentItem.authorName,
                  coverUrl: recentItem.coverUrl,
                  firstPublishYear: recentItem.firstPublishYear,
                  matchStatus: recentItem.hasReaderSource ? "readable" : "metadata"
                })}
                className={bookControlClassName}
                style={{ borderColor, background: panelSurface, color: textPrimary }}
              >
                Open book
              </Link>
              {recentItem.hasReaderSource ? (
                <Link
                  href={toBookReadHref(recentItem.openLibraryKey)}
                  className={bookControlClassName}
                  style={{ borderColor, background: `${BOOK_THEME.accentMint}96`, color: textPrimary }}
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

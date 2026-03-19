"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookFrame } from "@/features/books/components/BookFrame";
import { BookReader } from "@/features/books/components/BookReader";
import { BOOK_THEME, bookCardStyle, bookControlClassName } from "@/features/books/components/bookTheme";
import { useAppTheme } from "@/lib/theme";

export const BookReadPageClient = () => {
  const searchParams = useSearchParams();
  const openLibraryKey = searchParams.get("key")?.trim() ?? "";
  const [isImmersive, setIsImmersive] = useState(false);
  const { theme, setTheme } = useAppTheme();

  useEffect(() => {
    setIsImmersive(false);
  }, [openLibraryKey]);

  useEffect(() => {
    if (!isImmersive) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsImmersive(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isImmersive]);

  if (!openLibraryKey) {
    return (
      <BookFrame title="Read" subtitle="Open a book first." fullHeightContent>
        <div className="max-w-[520px] rounded-2xl border p-4" style={bookCardStyle}>
          <p className="text-[15px]" style={{ color: BOOK_THEME.textSecondary }}>
            Missing book key. Open a title from search or history.
          </p>
          <Link
            href="/books/search"
            className={`${bookControlClassName} mt-3 inline-flex`}
            style={{ borderColor: BOOK_THEME.border, background: `${BOOK_THEME.accentBlue}82`, color: BOOK_THEME.textPrimary }}
          >
            Go to search
          </Link>
        </div>
      </BookFrame>
    );
  }

  if (isImmersive) {
    return (
      <section
        className="fixed inset-0 z-50 h-[100dvh]"
        style={{ background: theme === "dark" ? BOOK_THEME.readerDarkBg : BOOK_THEME.background }}
      >
        <BookReader
          openLibraryKey={openLibraryKey}
          isImmersive
          onToggleImmersive={() => setIsImmersive(false)}
          themeMode={theme}
          onThemeChange={setTheme}
        />
      </section>
    );
  }

  return (
    <BookFrame
      title="Read"
      subtitle="Centered reading, soft controls, and local progress restore."
      openLibraryKey={openLibraryKey}
      fullHeightContent
      themeMode={theme}
    >
      <BookReader
        openLibraryKey={openLibraryKey}
        onToggleImmersive={() => setIsImmersive(true)}
        themeMode={theme}
        onThemeChange={setTheme}
      />
    </BookFrame>
  );
};

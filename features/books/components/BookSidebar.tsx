"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAppTheme } from "@/lib/theme";
import { BOOK_THEME, bookControlClassName } from "@/features/books/components/bookTheme";

type BookSidebarProps = {
  themeMode?: "light" | "dark";
  className?: string;
};

const LANGUAGE_KEY = "peaceful-room-language";
type AppLanguage = "en" | "ja";

export const BookSidebar = ({ themeMode = "light", className }: BookSidebarProps) => {
  const { theme, setTheme } = useAppTheme();
  const [language, setLanguage] = useState<AppLanguage>("en");
  const isDark = themeMode === "dark";
  const sidebarBackground = isDark ? "rgba(28, 24, 22, 0.95)" : BOOK_THEME.surfaceStrong;
  const textPrimary = isDark ? BOOK_THEME.readerDarkText : BOOK_THEME.textPrimary;
  const textSecondary = isDark ? "rgba(242, 231, 209, 0.72)" : BOOK_THEME.textSecondary;
  const borderColor = isDark ? "rgba(255, 226, 179, 0.22)" : BOOK_THEME.border;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const saved = window.localStorage.getItem(LANGUAGE_KEY);
    setLanguage(saved === "ja" ? "ja" : "en");
  }, []);

  const handleLanguageChange = (nextLanguage: AppLanguage) => {
    setLanguage(nextLanguage);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_KEY, nextLanguage);
    }
  };

  return (
    <aside
      className={`min-h-0 overflow-y-auto rounded-[1.8rem] border p-4 sm:p-5 ${className ?? ""}`}
      style={{
        borderColor,
        background: sidebarBackground,
        boxShadow: "0 10px 26px rgba(188, 149, 129, 0.08)"
      }}
    >
      <p className="text-[12px] uppercase tracking-[0.14em]" style={{ color: textSecondary }}>
        Reader Settings
      </p>

      <div className="mt-4 space-y-4">
        <Link
          href="/"
          className={`${bookControlClassName} inline-flex w-full justify-center`}
          style={{ borderColor, background: `${BOOK_THEME.accentPeach}95`, color: textPrimary }}
        >
          Cozy Room
        </Link>

        <section className="space-y-2 rounded-[1.2rem] border p-3" style={{ borderColor, background: isDark ? "rgba(44, 38, 35, 0.88)" : BOOK_THEME.surface }}>
          <p className="text-[11px] uppercase tracking-[0.11em]" style={{ color: textSecondary }}>
            Language
          </p>
          <div className="inline-flex rounded-full border p-1" style={{ borderColor, background: isDark ? "rgba(31, 27, 24, 0.94)" : BOOK_THEME.surfaceStrong }}>
            <button
              type="button"
              className="cozy-outline min-h-10 rounded-full px-3 py-1 text-[12px] font-medium"
              style={{
                border: language === "en" ? `1px solid ${borderColor}` : "1px solid transparent",
                background: language === "en" ? `${BOOK_THEME.accentPeach}88` : "transparent",
                color: textPrimary
              }}
              onClick={() => handleLanguageChange("en")}
            >
              English
            </button>
            <button
              type="button"
              className="cozy-outline min-h-10 rounded-full px-3 py-1 text-[12px] font-medium"
              style={{
                border: language === "ja" ? `1px solid ${borderColor}` : "1px solid transparent",
                background: language === "ja" ? `${BOOK_THEME.accentPeach}88` : "transparent",
                color: textPrimary
              }}
              onClick={() => handleLanguageChange("ja")}
            >
              日本語
            </button>
          </div>
        </section>

        <section className="space-y-2 rounded-[1.2rem] border p-3" style={{ borderColor, background: isDark ? "rgba(44, 38, 35, 0.88)" : BOOK_THEME.surface }}>
          <p className="text-[11px] uppercase tracking-[0.11em]" style={{ color: textSecondary }}>
            Mode
          </p>
          <div className="inline-flex rounded-full border p-1" style={{ borderColor, background: isDark ? "rgba(31, 27, 24, 0.94)" : BOOK_THEME.surfaceStrong }}>
            <button
              type="button"
              className="cozy-outline min-h-10 rounded-full px-3 py-1 text-[12px] font-medium"
              style={{
                border: theme === "light" ? `1px solid ${borderColor}` : "1px solid transparent",
                background: theme === "light" ? `${BOOK_THEME.accentLavender}88` : "transparent",
                color: textPrimary
              }}
              onClick={() => setTheme("light")}
            >
              Light
            </button>
            <button
              type="button"
              className="cozy-outline min-h-10 rounded-full px-3 py-1 text-[12px] font-medium"
              style={{
                border: theme === "dark" ? `1px solid ${borderColor}` : "1px solid transparent",
                background: theme === "dark" ? `${BOOK_THEME.accentLavender}88` : "transparent",
                color: textPrimary
              }}
              onClick={() => setTheme("dark")}
            >
              Dark
            </button>
          </div>
        </section>
      </div>
    </aside>
  );
};

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAppTheme } from "@/lib/theme";
import { READER_THEME, readerControlClassName } from "@/features/reader/components/readerTheme";

type ReaderSidebarProps = {
  className?: string;
};

const LANGUAGE_KEY = "peaceful-room-language";
type AppLanguage = "en" | "ja";

export const ReaderSidebar = ({ className }: ReaderSidebarProps) => {
  const { theme, setTheme } = useAppTheme();
  const [language, setLanguage] = useState<AppLanguage>("en");

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
        borderColor: READER_THEME.border,
        background: READER_THEME.surfaceStrong,
        boxShadow: "0 10px 26px rgba(188, 149, 129, 0.08)"
      }}
    >
      <p className="text-[12px] uppercase tracking-[0.14em]" style={{ color: READER_THEME.textSecondary }}>
        Reader Settings
      </p>

      <div className="mt-4 space-y-4">
        <Link
          href="/"
          className={`${readerControlClassName} inline-flex w-full justify-center`}
          style={{ borderColor: READER_THEME.border, background: `${READER_THEME.accentPeach}95`, color: READER_THEME.textPrimary }}
        >
          Cozy Room
        </Link>

        <section className="space-y-2 rounded-[1.2rem] border p-3" style={{ borderColor: READER_THEME.border, background: READER_THEME.surface }}>
          <p className="text-[11px] uppercase tracking-[0.11em]" style={{ color: READER_THEME.textSecondary }}>
            Language
          </p>
          <div className="inline-flex rounded-full border p-1" style={{ borderColor: READER_THEME.border, background: READER_THEME.surfaceStrong }}>
            <button
              type="button"
              className="cozy-outline min-h-10 rounded-full px-3 py-1 text-[12px] font-medium"
              style={{
                border: language === "en" ? `1px solid ${READER_THEME.border}` : "1px solid transparent",
                background: language === "en" ? `${READER_THEME.accentPeach}85` : "transparent",
                color: READER_THEME.textPrimary
              }}
              onClick={() => handleLanguageChange("en")}
            >
              English
            </button>
            <button
              type="button"
              className="cozy-outline min-h-10 rounded-full px-3 py-1 text-[12px] font-medium"
              style={{
                border: language === "ja" ? `1px solid ${READER_THEME.border}` : "1px solid transparent",
                background: language === "ja" ? `${READER_THEME.accentPeach}85` : "transparent",
                color: READER_THEME.textPrimary
              }}
              onClick={() => handleLanguageChange("ja")}
            >
              日本語
            </button>
          </div>
        </section>

        <section className="space-y-2 rounded-[1.2rem] border p-3" style={{ borderColor: READER_THEME.border, background: READER_THEME.surface }}>
          <p className="text-[11px] uppercase tracking-[0.11em]" style={{ color: READER_THEME.textSecondary }}>
            Mode
          </p>
          <div className="inline-flex rounded-full border p-1" style={{ borderColor: READER_THEME.border, background: READER_THEME.surfaceStrong }}>
            <button
              type="button"
              className="cozy-outline min-h-10 rounded-full px-3 py-1 text-[12px] font-medium"
              style={{
                border: theme === "light" ? `1px solid ${READER_THEME.border}` : "1px solid transparent",
                background: theme === "light" ? `${READER_THEME.accentLavender}88` : "transparent",
                color: READER_THEME.textPrimary
              }}
              onClick={() => setTheme("light")}
            >
              Light
            </button>
            <button
              type="button"
              className="cozy-outline min-h-10 rounded-full px-3 py-1 text-[12px] font-medium"
              style={{
                border: theme === "dark" ? `1px solid ${READER_THEME.border}` : "1px solid transparent",
                background: theme === "dark" ? `${READER_THEME.accentLavender}88` : "transparent",
                color: READER_THEME.textPrimary
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

"use client";

import { ReactNode, useState } from "react";
import { BookSidebar } from "@/features/books/components/BookSidebar";
import { BookTopPanel } from "@/features/books/components/BookTopPanel";
import { BOOK_THEME, bookPanelStyle } from "@/features/books/components/bookTheme";
import { useAppTheme } from "@/lib/theme";

type BookFrameProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  openLibraryKey?: string;
  fullHeightContent?: boolean;
  themeMode?: "light" | "dark";
};

export const BookFrame = ({ title, subtitle, children, openLibraryKey, fullHeightContent = false, themeMode }: BookFrameProps) => {
  const { theme: appTheme } = useAppTheme();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const effectiveTheme = themeMode ?? appTheme;
  const isDark = effectiveTheme === "dark";
  const background = isDark
    ? "radial-gradient(circle at 14% 12%, rgba(116, 88, 73, 0.3), transparent 36%), radial-gradient(circle at 82% 18%, rgba(82, 78, 104, 0.26), transparent 34%), radial-gradient(circle at 76% 88%, rgba(76, 96, 117, 0.24), transparent 38%), #151311"
    : "radial-gradient(circle at 14% 12%, rgba(246, 199, 184, 0.35), transparent 36%), radial-gradient(circle at 82% 18%, rgba(220, 207, 246, 0.34), transparent 34%), radial-gradient(circle at 76% 88%, rgba(207, 229, 255, 0.28), transparent 38%), #FFF8F3";
  const panelBackground = isDark ? "rgba(31, 27, 24, 0.94)" : bookPanelStyle.background;
  const borderColor = isDark ? "rgba(255, 226, 179, 0.22)" : BOOK_THEME.border;
  const textPrimary = isDark ? BOOK_THEME.readerDarkText : BOOK_THEME.textPrimary;
  const textSecondary = isDark ? "rgba(242, 231, 209, 0.72)" : BOOK_THEME.textSecondary;

  return (
    <section
      className="min-h-screen overflow-hidden"
      style={{
        background,
        color: textPrimary
      }}
    >
      <button
        type="button"
        className="cozy-outline fixed left-3 top-3 z-40 rounded-full border px-3 py-2 text-[13px] font-medium lg:hidden"
        style={{
          borderColor,
          background: panelBackground,
          color: textPrimary
        }}
        onClick={() => setIsMobileSidebarOpen(true)}
      >
        Reader Settings
      </button>

      {isMobileSidebarOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/35 lg:hidden"
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-label="Close reader settings"
          />
          <div className="fixed inset-y-0 left-0 z-50 w-[min(90vw,360px)] p-3 lg:hidden">
            <BookSidebar themeMode={effectiveTheme} className="h-full" />
          </div>
        </>
      ) : null}

      <div className="mx-auto h-[100dvh] w-full max-w-[1360px] p-3 pt-16 sm:p-5 sm:pt-16 lg:p-7 lg:pt-7">
      <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <BookSidebar themeMode={effectiveTheme} className="hidden lg:block" />

        <div
          className="flex min-h-0 flex-col rounded-[2rem] border p-4 sm:p-6 lg:p-8"
          style={{ ...bookPanelStyle, borderColor, background: panelBackground, color: textPrimary }}
        >
          <header className="flex flex-col gap-4 sm:gap-5">
            <BookTopPanel openLibraryKey={openLibraryKey} themeMode={effectiveTheme} />
            <div>
              <h1 className="text-[clamp(1.55rem,6.2vw,3.1rem)] font-medium tracking-[0.01em]">{title}</h1>
              <p className="mt-2 text-[15px] sm:text-[17px]" style={{ color: textSecondary }}>
                {subtitle}
              </p>
            </div>
          </header>

          <div
            className={fullHeightContent ? "mt-5 min-h-0 flex-1 overflow-hidden" : "mt-6 min-h-0 flex-1 overflow-y-auto sm:mt-8"}
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {children}
          </div>
        </div>
      </div>
      </div>
    </section>
  );
};

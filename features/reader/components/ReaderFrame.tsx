"use client";

import { ReactNode, useState } from "react";
import { ReaderSidebar } from "@/features/reader/components/ReaderSidebar";
import { ReaderTopPanel } from "@/features/reader/components/ReaderTopPanel";
import { READER_THEME, getReaderShellBackground, getReaderThemeCssVars, readerPanelStyle } from "@/features/reader/components/readerTheme";
import { useAppTheme } from "@/lib/theme";

type ReaderFrameProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  compact?: boolean;
  seriesId?: string;
  fullHeightContent?: boolean;
};

export const ReaderFrame = ({
  title,
  subtitle,
  children,
  compact = false,
  seriesId,
  fullHeightContent = false
}: ReaderFrameProps) => {
  const { theme } = useAppTheme();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <section
      className="min-h-screen overflow-x-hidden overflow-y-hidden"
      style={{
        ...getReaderThemeCssVars(theme),
        background: getReaderShellBackground(theme),
        color: READER_THEME.textPrimary
      }}
    >
    <button
      type="button"
      className="cozy-outline fixed left-3 top-3 z-40 rounded-full border px-3 py-2 text-[13px] font-medium lg:hidden"
      style={{
        borderColor: READER_THEME.border,
        background: READER_THEME.surfaceStrong,
        color: READER_THEME.textPrimary
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
          <ReaderSidebar className="h-full" />
        </div>
      </>
    ) : null}

    <div className="mx-auto h-[100dvh] w-full max-w-[1360px] p-2 pt-14 sm:p-5 sm:pt-16 lg:p-7 lg:pt-7">
      <div className="grid h-full min-h-0 min-w-0 gap-2 sm:gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <ReaderSidebar className="hidden lg:block" />

        <div className="flex min-h-0 min-w-0 flex-col rounded-[1.5rem] border p-3 sm:rounded-[2rem] sm:p-6 lg:p-8" style={readerPanelStyle}>
          <header className="flex flex-col gap-3 sm:gap-5">
            <ReaderTopPanel seriesId={seriesId} />
            <div>
              <h1 className="text-[clamp(1.55rem,6.2vw,3.1rem)] font-medium tracking-[0.01em]">{title}</h1>
              <p className="mt-2 text-[15px] sm:text-[17px]" style={{ color: READER_THEME.textSecondary }}>
                {subtitle}
              </p>
            </div>
          </header>

          <div
            className={
              fullHeightContent
                ? "mt-4 min-h-0 min-w-0 flex-1 overflow-hidden sm:mt-5"
                : compact
                  ? "mt-4 min-w-0 overflow-y-auto sm:mt-5"
                  : "mt-5 min-h-0 min-w-0 flex-1 overflow-y-auto sm:mt-8"
            }
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

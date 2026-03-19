"use client";

import { ReactNode } from "react";
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
  return (
    <section
      className="min-h-screen overflow-hidden"
      style={{
        ...getReaderThemeCssVars(theme),
        background: getReaderShellBackground(theme),
        color: READER_THEME.textPrimary
      }}
    >
    <div className="mx-auto h-screen w-full max-w-[1360px] p-3 sm:p-5 lg:p-7">
      <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <ReaderSidebar />

        <div className="flex min-h-0 flex-col rounded-[2rem] border p-4 sm:p-6 lg:p-8" style={readerPanelStyle}>
          <header className="flex flex-col gap-4 sm:gap-5">
            <ReaderTopPanel seriesId={seriesId} />
            <div>
              <h1 className="text-[clamp(2rem,7vw,3.1rem)] font-medium tracking-[0.01em]">{title}</h1>
              <p className="mt-2 text-[15px] sm:text-[17px]" style={{ color: READER_THEME.textSecondary }}>
                {subtitle}
              </p>
            </div>
          </header>

          <div
            className={
              fullHeightContent
                ? "mt-5 min-h-0 flex-1 overflow-hidden"
                : compact
                  ? "mt-5 overflow-y-auto"
                  : "mt-6 min-h-0 flex-1 overflow-y-auto sm:mt-8"
            }
          >
            {children}
          </div>
        </div>
      </div>
    </div>
    </section>
  );
};

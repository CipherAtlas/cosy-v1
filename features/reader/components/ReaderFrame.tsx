import Link from "next/link";
import { ReactNode } from "react";
import { ReaderSidebar } from "@/features/reader/components/ReaderSidebar";
import { READER_THEME, readerPanelStyle } from "@/features/reader/components/readerTheme";

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
}: ReaderFrameProps) => (
  <section
    className="min-h-screen overflow-hidden"
    style={{
      background:
        "radial-gradient(circle at 14% 12%, rgba(246, 199, 184, 0.35), transparent 36%), radial-gradient(circle at 82% 18%, rgba(220, 207, 246, 0.34), transparent 34%), radial-gradient(circle at 76% 88%, rgba(207, 229, 255, 0.28), transparent 38%), #FFF8F3",
      color: READER_THEME.textPrimary
    }}
  >
    <div className="mx-auto h-screen w-full max-w-[1360px] p-3 sm:p-5 lg:p-7">
      <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[290px_minmax(0,1fr)]">
        <ReaderSidebar seriesId={seriesId} />

        <div className="flex min-h-0 flex-col rounded-[2rem] border p-4 sm:p-6 lg:p-8" style={readerPanelStyle}>
          <header className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Link
                href="/reader"
                className="rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors"
                style={{
                  borderColor: READER_THEME.border,
                  background: READER_THEME.surface,
                  color: READER_THEME.textPrimary
                }}
              >
                Reader Home
              </Link>
              <Link
                href="/"
                className="rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors"
                style={{
                  borderColor: READER_THEME.border,
                  background: READER_THEME.surface,
                  color: READER_THEME.textPrimary
                }}
              >
                Cozy App
              </Link>
            </div>

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

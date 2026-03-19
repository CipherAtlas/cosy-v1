"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChapterReader } from "@/features/reader/components/ChapterReader";
import { ReaderFrame } from "@/features/reader/components/ReaderFrame";
import {
  READER_THEME,
  getReaderShellBackground,
  getReaderThemeCssVars,
  readerCardStyle,
  readerControlClassName
} from "@/features/reader/components/readerTheme";
import { useAppTheme } from "@/lib/theme";

export const ReadPageClient = () => {
  const searchParams = useSearchParams();
  const seriesId = searchParams.get("seriesId")?.trim() ?? "";
  const chapterId = searchParams.get("chapterId")?.trim() ?? "";
  const [isImmersive, setIsImmersive] = useState(false);
  const { theme } = useAppTheme();

  useEffect(() => {
    setIsImmersive(false);
  }, [seriesId, chapterId]);

  useEffect(() => {
    if (!isImmersive) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsImmersive(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isImmersive]);

  if (!seriesId || !chapterId) {
    return (
      <ReaderFrame title="Read" subtitle="Open a chapter to start reading." fullHeightContent>
        <div className="max-w-[520px] rounded-2xl border p-4" style={readerCardStyle}>
          <p className="text-[15px]" style={{ color: READER_THEME.textSecondary }}>
            Missing chapter details. Open a chapter from a series page first.
          </p>
          <Link
            href="/reader/search"
            className={`${readerControlClassName} mt-3 inline-flex`}
            style={{ borderColor: READER_THEME.border, background: `${READER_THEME.accentBlue}82`, color: READER_THEME.textPrimary }}
          >
            Go to search
          </Link>
        </div>
      </ReaderFrame>
    );
  }

  if (isImmersive) {
    return (
      <section
        className="fixed inset-0 z-50"
        style={{
          ...getReaderThemeCssVars(theme),
          background: getReaderShellBackground(theme),
          color: READER_THEME.textPrimary
        }}
      >
        <ChapterReader
          seriesId={seriesId}
          chapterId={chapterId}
          isImmersive
          onToggleImmersive={() => setIsImmersive(false)}
        />
      </section>
    );
  }

  return (
    <ReaderFrame
      title="Read"
      subtitle="Smooth vertical reading with progress saved locally. Use Full Screen for webtoon-style panel readability."
      seriesId={seriesId}
      fullHeightContent
    >
      <ChapterReader
        seriesId={seriesId}
        chapterId={chapterId}
        onToggleImmersive={() => setIsImmersive(true)}
      />
    </ReaderFrame>
  );
};

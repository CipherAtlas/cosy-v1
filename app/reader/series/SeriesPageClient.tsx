"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ReaderFrame } from "@/features/reader/components/ReaderFrame";
import { SeriesDetail } from "@/features/reader/components/SeriesDetail";
import { READER_THEME, readerCardStyle, readerControlClassName } from "@/features/reader/components/readerTheme";

export const SeriesPageClient = () => {
  const searchParams = useSearchParams();
  const seriesId = searchParams.get("id")?.trim() ?? "";

  return (
    <ReaderFrame
      title="Series"
      subtitle="Browse chapter list and jump back into your last read spot."
      seriesId={seriesId || undefined}
    >
      {seriesId ? (
        <SeriesDetail seriesId={seriesId} />
      ) : (
        <div className="rounded-[1.4rem] border p-4" style={readerCardStyle}>
          <p className="text-[15px]" style={{ color: READER_THEME.textSecondary }}>
            Missing series ID. Start from search.
          </p>
          <Link
            href="/reader/search"
            className={`${readerControlClassName} mt-3 inline-flex`}
            style={{ borderColor: READER_THEME.border, background: `${READER_THEME.accentBlue}82`, color: READER_THEME.textPrimary }}
          >
            Go to search
          </Link>
        </div>
      )}
    </ReaderFrame>
  );
};

import { Suspense } from "react";
import { ReaderFrame } from "@/features/reader/components/ReaderFrame";
import { READER_THEME, readerCardStyle, readerControlClassName } from "@/features/reader/components/readerTheme";
import { ReadPageClient } from "@/app/reader/read/ReadPageClient";

const ReaderLoadingFallback = () => (
  <ReaderFrame title="Read" subtitle="Opening chapter..." fullHeightContent>
    <div className="max-w-[520px] rounded-2xl border p-4 text-center" style={readerCardStyle}>
      <p className="text-[15px]">Opening reader...</p>
      <span
        className={`${readerControlClassName} mt-3 inline-flex`}
        style={{ borderColor: READER_THEME.border, background: `${READER_THEME.accentBlue}82`, color: READER_THEME.textPrimary }}
      >
        Loading
      </span>
    </div>
  </ReaderFrame>
);

export default function ReaderReadPage() {
  return (
    <Suspense fallback={<ReaderLoadingFallback />}>
      <ReadPageClient />
    </Suspense>
  );
}

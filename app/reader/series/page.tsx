import { Suspense } from "react";
import { ReaderFrame } from "@/features/reader/components/ReaderFrame";
import { SeriesPageClient } from "@/app/reader/series/SeriesPageClient";

export default function ReaderSeriesPage() {
  return (
    <Suspense
      fallback={
        <ReaderFrame title="Series" subtitle="Loading series details...">
          <p className="text-[15px]">Preparing series view...</p>
        </ReaderFrame>
      }
    >
      <SeriesPageClient />
    </Suspense>
  );
}

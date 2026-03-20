import type { PdfSearchResult } from "@/features/pdf-search/types";
import { PdfSearchResultCard } from "@/features/pdf-search/components/PdfSearchResultCard";
import { READER_THEME } from "@/features/reader/components/readerTheme";

type PdfSearchResultsProps = {
  results: PdfSearchResult[];
  isLoading: boolean;
  error: string | null;
  hasSearched: boolean;
};

export const PdfSearchResults = ({ results, isLoading, error, hasSearched }: PdfSearchResultsProps) => {
  if (isLoading) {
    return (
      <p className="rounded-[1.3rem] border px-4 py-4 text-[15px]" style={{ borderColor: READER_THEME.border, background: READER_THEME.surface, color: READER_THEME.textSecondary }}>
        Searching the web for PDF documents...
      </p>
    );
  }

  if (error) {
    return (
      <p className="rounded-[1.3rem] border px-4 py-4 text-[15px]" style={{ borderColor: READER_THEME.border, background: `${READER_THEME.accentPink}3F`, color: READER_THEME.textPrimary }}>
        {error}
      </p>
    );
  }

  if (!hasSearched) {
    return (
      <p className="rounded-[1.3rem] border px-4 py-4 text-[15px]" style={{ borderColor: READER_THEME.border, background: READER_THEME.surface, color: READER_THEME.textSecondary }}>
        Search for a topic to get relevant PDF results.
      </p>
    );
  }

  if (results.length === 0) {
    return (
      <p className="rounded-[1.3rem] border px-4 py-4 text-[15px]" style={{ borderColor: READER_THEME.border, background: READER_THEME.surface, color: READER_THEME.textSecondary }}>
        No PDF results were found for this query. Try a more specific keyword.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {results.map((result) => (
        <PdfSearchResultCard key={result.id} result={result} />
      ))}
    </div>
  );
};

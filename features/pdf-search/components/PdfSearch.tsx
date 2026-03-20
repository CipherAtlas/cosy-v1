"use client";

import { useCallback, useMemo, useState } from "react";
import { PdfSearchInput } from "@/features/pdf-search/components/PdfSearchInput";
import { PdfSearchResults } from "@/features/pdf-search/components/PdfSearchResults";
import { searchPdfDocuments } from "@/features/pdf-search/pdfSearchService";
import type { PdfSearchResult } from "@/features/pdf-search/types";
import { READER_THEME } from "@/features/reader/components/readerTheme";

export const PdfSearch = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PdfSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSearch = useCallback(async () => {
    const normalized = query.trim();
    if (!normalized) {
      setHasSearched(true);
      setResults([]);
      setError("Enter a topic first to search for PDFs.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await searchPdfDocuments(normalized);
      setResults(response.results);
    } catch {
      setResults([]);
      setError("PDF search is temporarily unavailable from your network path. Please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  const directPdfCount = useMemo(() => results.filter((item) => item.isDirectPdf).length, [results]);

  return (
    <section className="min-w-0 space-y-4 sm:space-y-5">
      <PdfSearchInput query={query} onQueryChange={setQuery} onSearch={onSearch} isLoading={isLoading} />

      {hasSearched && !error && !isLoading ? (
        <div className="rounded-[1.2rem] border px-3 py-2" style={{ borderColor: READER_THEME.border, background: READER_THEME.surface }}>
          <p className="text-[13px]" style={{ color: READER_THEME.textSecondary }}>
            {results.length} results · {directPdfCount} direct PDF links
          </p>
        </div>
      ) : null}

      <PdfSearchResults results={results} isLoading={isLoading} error={error} hasSearched={hasSearched} />
    </section>
  );
};

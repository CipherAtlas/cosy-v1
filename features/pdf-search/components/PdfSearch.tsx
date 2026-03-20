"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PdfSearchInput } from "@/features/pdf-search/components/PdfSearchInput";
import { PdfSearchResults } from "@/features/pdf-search/components/PdfSearchResults";
import { buildGooglePdfSearchHref, hasGoogleCseCredentials, searchPdfDocuments } from "@/features/pdf-search/pdfSearchService";
import type { PdfSearchProvider, PdfSearchResult } from "@/features/pdf-search/types";
import { READER_THEME } from "@/features/reader/components/readerTheme";

const GOOGLE_API_KEY_STORAGE = "peaceful-room-pdf-google-api-key";
const GOOGLE_CX_STORAGE = "peaceful-room-pdf-google-cx";
const GOOGLE_PREFER_STORAGE = "peaceful-room-pdf-google-prefer";

export const PdfSearch = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PdfSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<PdfSearchProvider | null>(null);
  const [googleApiKey, setGoogleApiKey] = useState("");
  const [googleCx, setGoogleCx] = useState("");
  const [preferGoogle, setPreferGoogle] = useState(true);
  const [showGoogleSettings, setShowGoogleSettings] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setGoogleApiKey(window.localStorage.getItem(GOOGLE_API_KEY_STORAGE) ?? "");
    setGoogleCx(window.localStorage.getItem(GOOGLE_CX_STORAGE) ?? "");
    const preferStored = window.localStorage.getItem(GOOGLE_PREFER_STORAGE);
    setPreferGoogle(preferStored === null ? true : preferStored === "true");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(GOOGLE_API_KEY_STORAGE, googleApiKey);
  }, [googleApiKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(GOOGLE_CX_STORAGE, googleCx);
  }, [googleCx]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(GOOGLE_PREFER_STORAGE, String(preferGoogle));
  }, [preferGoogle]);

  const onSearch = useCallback(async () => {
    const normalized = query.trim();
    if (!normalized) {
      setHasSearched(true);
      setResults([]);
      setProvider(null);
      setError("Enter a topic first to search for PDFs.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await searchPdfDocuments(normalized, {
        preferGoogle,
        googleApiKey,
        googleCx
      });
      setResults(response.results);
      setProvider(response.provider);
    } catch {
      setResults([]);
      setProvider(null);
      setError("PDF search is temporarily unavailable from your network path. Please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  }, [googleApiKey, googleCx, preferGoogle, query]);

  const directPdfCount = useMemo(() => results.filter((item) => item.isDirectPdf).length, [results]);
  const googleConfigured = useMemo(() => hasGoogleCseCredentials(googleApiKey, googleCx), [googleApiKey, googleCx]);

  const openGoogleInNewTab = () => {
    if (typeof window === "undefined") {
      return;
    }

    window.open(buildGooglePdfSearchHref(query), "_blank", "noopener,noreferrer");
  };

  return (
    <section className="min-w-0 space-y-4 sm:space-y-5">
      <PdfSearchInput query={query} onQueryChange={setQuery} onSearch={onSearch} isLoading={isLoading} />

      <div className="rounded-[1.3rem] border p-3 sm:p-4" style={{ borderColor: READER_THEME.border, background: READER_THEME.surface }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] font-medium uppercase tracking-[0.1em]" style={{ color: READER_THEME.textSecondary }}>
            Google Source
          </p>
          <button
            type="button"
            className="cozy-outline min-h-10 rounded-full border px-3 py-2 text-[13px] font-medium"
            style={{ borderColor: READER_THEME.border, background: `${READER_THEME.accentButter}7D`, color: READER_THEME.textPrimary }}
            onClick={() => setShowGoogleSettings((value) => !value)}
          >
            {showGoogleSettings ? "Hide Settings" : "Show Settings"}
          </button>
        </div>

        <p className="mt-2 text-[13px]" style={{ color: READER_THEME.textSecondary }}>
          Google is preferred when configured. Credentials stay in your browser only.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="cozy-outline min-h-10 rounded-full border px-3 py-2 text-[13px] font-medium"
            style={{
              borderColor: READER_THEME.border,
              background: preferGoogle ? `${READER_THEME.accentMint}8B` : READER_THEME.surface,
              color: READER_THEME.textPrimary
            }}
            onClick={() => setPreferGoogle((value) => !value)}
            aria-pressed={preferGoogle}
          >
            {preferGoogle ? "Google Preferred: On" : "Google Preferred: Off"}
          </button>

          <button
            type="button"
            className="cozy-outline min-h-10 rounded-full border px-3 py-2 text-[13px] font-medium"
            style={{ borderColor: READER_THEME.border, background: `${READER_THEME.accentBlue}83`, color: READER_THEME.textPrimary }}
            onClick={openGoogleInNewTab}
          >
            Open Google PDF Search
          </button>
        </div>

        {!googleConfigured && preferGoogle ? (
          <p className="mt-2 text-[13px]" style={{ color: READER_THEME.textSecondary }}>
            Add Google API key + Search Engine ID below to use Google results inside this app.
          </p>
        ) : null}

        {showGoogleSettings ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-[13px] font-medium" style={{ color: READER_THEME.textSecondary }}>
              Google API Key
              <input
                type="password"
                value={googleApiKey}
                onChange={(event) => setGoogleApiKey(event.target.value)}
                placeholder="AIza..."
                className="cozy-outline mt-1.5 min-h-11 w-full rounded-2xl border px-3 py-2 text-[14px] outline-none"
                style={{ borderColor: READER_THEME.border, background: READER_THEME.surface, color: READER_THEME.textPrimary }}
                aria-label="Google API key for custom search"
              />
            </label>
            <label className="text-[13px] font-medium" style={{ color: READER_THEME.textSecondary }}>
              Search Engine ID (CX)
              <input
                type="text"
                value={googleCx}
                onChange={(event) => setGoogleCx(event.target.value)}
                placeholder="your-cse-id"
                className="cozy-outline mt-1.5 min-h-11 w-full rounded-2xl border px-3 py-2 text-[14px] outline-none"
                style={{ borderColor: READER_THEME.border, background: READER_THEME.surface, color: READER_THEME.textPrimary }}
                aria-label="Google programmable search engine ID"
              />
            </label>
          </div>
        ) : null}
      </div>

      {hasSearched && !error && !isLoading ? (
        <div className="rounded-[1.2rem] border px-3 py-2" style={{ borderColor: READER_THEME.border, background: READER_THEME.surface }}>
          <p className="text-[13px]" style={{ color: READER_THEME.textSecondary }}>
            {results.length} results · {directPdfCount} direct PDF links · Source: {provider === "google-cse" ? "Google" : "Fallback feed"}
          </p>
        </div>
      ) : null}

      <PdfSearchResults results={results} isLoading={isLoading} error={error} hasSearched={hasSearched} />
    </section>
  );
};

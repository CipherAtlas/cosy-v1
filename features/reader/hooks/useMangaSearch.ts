import { useEffect, useState } from "react";
import { searchManga } from "@/features/reader/api/mangadex";
import { MangaSearchResult } from "@/features/reader/types";
import { useDebouncedValue } from "@/features/reader/hooks/useDebouncedValue";

export const useMangaSearch = (query: string) => {
  const debouncedQuery = useDebouncedValue(query.trim(), 340);
  const [results, setResults] = useState<MangaSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    setIsLoading(true);
    setError(null);

    searchManga(debouncedQuery, 24)
      .then((items) => {
        if (cancelled) {
          return;
        }

        setResults(items);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setError("Could not load manga results right now. Please try again.");
      })
      .finally(() => {
        if (cancelled) {
          return;
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  return {
    debouncedQuery,
    results,
    isLoading,
    error
  };
};

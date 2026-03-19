import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveSearchMatches } from "@/features/books/api/gutendex";
import { searchOpenLibraryBooks } from "@/features/books/api/openLibrary";
import { BookSearchItem } from "@/features/books/types";
import { useDebouncedValue } from "@/features/books/hooks/useDebouncedValue";

const PAGE_SIZE = 18;
const MAX_RESULT_ITEMS = 180;

const sortResults = (items: BookSearchItem[]) =>
  [...items].sort((a, b) => {
    const scoreA = a.matchStatus === "readable" ? 2 : a.matchStatus === "checking" ? 1 : 0;
    const scoreB = b.matchStatus === "readable" ? 2 : b.matchStatus === "checking" ? 1 : 0;
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }

    if (a.firstPublishYear && b.firstPublishYear && a.firstPublishYear !== b.firstPublishYear) {
      return b.firstPublishYear - a.firstPublishYear;
    }

    return a.title.localeCompare(b.title);
  });

const applyMatchResults = (items: BookSearchItem[], matches: Record<string, BookSearchItem["readerSource"]>): BookSearchItem[] =>
  items.map((item) => {
    if (!(item.openLibraryKey in matches)) {
      return item;
    }

    const source = matches[item.openLibraryKey];
    return {
      ...item,
      readerSource: source ?? null,
      matchStatus: source ? "readable" : "metadata"
    };
  });

export const useBookSearch = (query: string) => {
  const debouncedQuery = useDebouncedValue(query.trim().slice(0, 120), 320);
  const [results, setResults] = useState<BookSearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextPage, setNextPage] = useState(2);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const pendingMatchCountRef = useRef(0);

  const runMatchBatch = useCallback(async (items: BookSearchItem[], requestId: number) => {
    const checkingItems = items.filter((item) => item.matchStatus === "checking");
    if (checkingItems.length === 0) {
      return;
    }

    pendingMatchCountRef.current += 1;
    setIsMatching(true);

    try {
      const matches = await resolveSearchMatches(checkingItems, { concurrency: 3 });
      if (requestIdRef.current !== requestId) {
        return;
      }

      setResults((previous) => sortResults(applyMatchResults(previous, matches)).slice(0, MAX_RESULT_ITEMS));
    } finally {
      pendingMatchCountRef.current = Math.max(0, pendingMatchCountRef.current - 1);
      setIsMatching(pendingMatchCountRef.current > 0);
    }
  }, []);

  useEffect(() => {
    if (!debouncedQuery) {
      requestIdRef.current += 1;
      setResults([]);
      setIsLoading(false);
      setIsLoadingMore(false);
      setIsMatching(false);
      setHasMore(false);
      setNextPage(2);
      setError(null);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    pendingMatchCountRef.current = 0;

    setIsLoading(true);
    setIsLoadingMore(false);
    setIsMatching(false);
    setError(null);
    setResults([]);
    setHasMore(false);
    setNextPage(2);

    searchOpenLibraryBooks(debouncedQuery, 1, PAGE_SIZE)
      .then((page) => {
        if (requestIdRef.current !== requestId) {
          return;
        }

        const deduped = Array.from(new Map(page.items.map((item) => [item.openLibraryKey, item])).values());
        const sorted = sortResults(deduped).slice(0, MAX_RESULT_ITEMS);
        setResults(sorted);
        setHasMore(page.hasMore);
        setNextPage(2);
        void runMatchBatch(sorted, requestId);
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) {
          return;
        }

        setError("Could not load books right now. Please try again.");
        setResults([]);
        setHasMore(false);
      })
      .finally(() => {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
        }
      });
  }, [debouncedQuery, runMatchBatch]);

  const loadMore = useCallback(async () => {
    if (!debouncedQuery || isLoading || isLoadingMore || !hasMore) {
      return;
    }

    const requestId = requestIdRef.current;
    const pageToLoad = nextPage;
    setIsLoadingMore(true);
    setError(null);

    try {
      const page = await searchOpenLibraryBooks(debouncedQuery, pageToLoad, PAGE_SIZE);
      if (requestIdRef.current !== requestId) {
        return;
      }

      let batchForMatching: BookSearchItem[] = [];
      setResults((previous) => {
        const map = new Map(previous.map((item) => [item.openLibraryKey, item]));
        page.items.forEach((item) => {
          if (!map.has(item.openLibraryKey)) {
            map.set(item.openLibraryKey, item);
            batchForMatching.push(item);
          }
        });

        return sortResults(Array.from(map.values())).slice(0, MAX_RESULT_ITEMS);
      });

      setHasMore(page.hasMore);
      setNextPage(pageToLoad + 1);
      if (batchForMatching.length > 0) {
        void runMatchBatch(batchForMatching, requestId);
      }
    } catch {
      if (requestIdRef.current !== requestId) {
        return;
      }

      setError("Could not load more books right now. Please try again.");
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoadingMore(false);
      }
    }
  }, [debouncedQuery, hasMore, isLoading, isLoadingMore, nextPage, runMatchBatch]);

  const readableCount = useMemo(() => results.filter((item) => item.matchStatus === "readable").length, [results]);

  return {
    debouncedQuery,
    results,
    isLoading,
    isLoadingMore,
    isMatching,
    hasMore,
    readableCount,
    error,
    loadMore
  };
};

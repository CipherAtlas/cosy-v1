import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getEnglishChapterCounts, searchManga } from "@/features/reader/api/mangadex";
import { MangaSearchResult } from "@/features/reader/types";
import { useDebouncedValue } from "@/features/reader/hooks/useDebouncedValue";

const PAGE_SIZE = 18;
const MAX_RESULT_ITEMS = 180;

const getTitleScore = (title: string, query: string): number => {
  const normalizedTitle = title.trim().toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedTitle || !normalizedQuery) {
    return 0;
  }

  if (normalizedTitle === normalizedQuery) {
    return 140;
  }

  if (normalizedTitle.startsWith(normalizedQuery)) {
    return 110;
  }

  if (normalizedTitle.includes(normalizedQuery)) {
    return 70;
  }

  return 20;
};

const compareResults = (query: string) => (a: MangaSearchResult, b: MangaSearchResult): number => {
  const countA = a.englishChapterCount ?? -1;
  const countB = b.englishChapterCount ?? -1;
  const hasChaptersA = countA > 0 ? 1 : 0;
  const hasChaptersB = countB > 0 ? 1 : 0;

  if (hasChaptersA !== hasChaptersB) {
    return hasChaptersB - hasChaptersA;
  }

  const scoreA = getTitleScore(a.title, query);
  const scoreB = getTitleScore(b.title, query);

  if (scoreA !== scoreB) {
    return scoreB - scoreA;
  }

  if (countA !== countB) {
    return countB - countA;
  }

  return a.title.localeCompare(b.title);
};

export const useMangaSearch = (query: string) => {
  const debouncedQuery = useDebouncedValue(query.trim().slice(0, 120), 340);
  const [results, setResults] = useState<MangaSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const activeRequestIdRef = useRef(0);
  const availabilityRequestCountRef = useRef(0);

  const sortByRelevance = useCallback(
    (items: MangaSearchResult[]) => [...items].sort(compareResults(debouncedQuery)),
    [debouncedQuery]
  );

  const enrichEnglishAvailability = useCallback(
    async (seriesIds: string[], requestId: number) => {
      const uniqueSeriesIds = [...new Set(seriesIds.filter((id) => id.trim().length > 0))];
      if (uniqueSeriesIds.length === 0) {
        return;
      }

      availabilityRequestCountRef.current += 1;
      setIsAvailabilityLoading(true);

      try {
        const countsById = await getEnglishChapterCounts(uniqueSeriesIds);
        if (activeRequestIdRef.current !== requestId) {
          return;
        }

        setResults((previousResults) => {
          let changed = false;
          const updated = previousResults.map((item) => {
            const count = countsById[item.id];
            if (typeof count !== "number" || item.englishChapterCount === count) {
              return item;
            }

            changed = true;
            return {
              ...item,
              englishChapterCount: count
            };
          });

          return changed ? sortByRelevance(updated).slice(0, MAX_RESULT_ITEMS) : previousResults;
        });
      } finally {
        availabilityRequestCountRef.current = Math.max(0, availabilityRequestCountRef.current - 1);
        setIsAvailabilityLoading(availabilityRequestCountRef.current > 0);
      }
    },
    [sortByRelevance]
  );

  useEffect(() => {
    if (!debouncedQuery) {
      activeRequestIdRef.current += 1;
      setResults([]);
      setError(null);
      setIsLoading(false);
      setIsLoadingMore(false);
      setIsAvailabilityLoading(false);
      setHasMore(false);
      setNextOffset(0);
      return;
    }

    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;

    setIsLoading(true);
    setIsLoadingMore(false);
    setIsAvailabilityLoading(false);
    availabilityRequestCountRef.current = 0;
    setError(null);
    setHasMore(false);
    setNextOffset(0);
    setResults([]);

    searchManga(debouncedQuery, PAGE_SIZE, 0)
      .then((page) => {
        if (activeRequestIdRef.current !== requestId) {
          return;
        }

        const sortedWithoutCounts = sortByRelevance(page.items).slice(0, MAX_RESULT_ITEMS);
        setResults(sortedWithoutCounts);
        setHasMore(page.hasMore);
        setNextOffset(page.nextOffset);
        void enrichEnglishAvailability(
          sortedWithoutCounts
            .filter((item) => item.englishChapterCount === null)
            .map((item) => item.id),
          requestId
        );
      })
      .catch(() => {
        if (activeRequestIdRef.current !== requestId) {
          return;
        }

        setError("Could not load manga results right now. Please try again.");
        setResults([]);
        setHasMore(false);
        setNextOffset(0);
      })
      .finally(() => {
        if (activeRequestIdRef.current !== requestId) {
          return;
        }

        setIsLoading(false);
        setIsLoadingMore(false);
      });
  }, [debouncedQuery, enrichEnglishAvailability, sortByRelevance]);

  const loadMore = useCallback(async () => {
    if (!debouncedQuery || isLoading || isLoadingMore || !hasMore) {
      return;
    }

    const requestId = activeRequestIdRef.current;
    setIsLoadingMore(true);
    setError(null);

    try {
      const page = await searchManga(debouncedQuery, PAGE_SIZE, nextOffset);
      if (activeRequestIdRef.current !== requestId) {
        return;
      }

      const idsNeedingCounts: string[] = [];
      setResults((previousResults) => {
        const byId = new Map(previousResults.map((item) => [item.id, item]));

        page.items.forEach((item) => {
          const existing = byId.get(item.id);
          if (!existing) {
            byId.set(item.id, item);
            if (item.englishChapterCount === null) {
              idsNeedingCounts.push(item.id);
            }

            return;
          }

          byId.set(item.id, {
            ...item,
            englishChapterCount: existing.englishChapterCount ?? item.englishChapterCount
          });
        });

        return sortByRelevance(Array.from(byId.values())).slice(0, MAX_RESULT_ITEMS);
      });

      const didAdvance = page.nextOffset > nextOffset;
      setHasMore(didAdvance ? page.hasMore : false);
      setNextOffset(didAdvance ? page.nextOffset : nextOffset);
      void enrichEnglishAvailability(idsNeedingCounts, requestId);
    } catch {
      if (activeRequestIdRef.current !== requestId) {
        return;
      }

      setError("Could not load more manga right now. Please try again.");
    } finally {
      if (activeRequestIdRef.current === requestId) {
        setIsLoadingMore(false);
      }
    }
  }, [debouncedQuery, enrichEnglishAvailability, hasMore, isLoading, isLoadingMore, nextOffset, sortByRelevance]);

  const readableCount = useMemo(
    () => results.filter((item) => (item.englishChapterCount ?? 0) > 0).length,
    [results]
  );

  return {
    debouncedQuery,
    results,
    isLoading,
    isLoadingMore,
    isAvailabilityLoading,
    hasMore,
    readableCount,
    error,
    loadMore
  };
};

"use client";

import Link from "next/link";
import { MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { formatChapterLabel, getChapterPages, getMangaSeries, getSeriesChapters, refreshChapterPages } from "@/features/reader/api/mangadex";
import { useReaderProgress } from "@/features/reader/hooks/useReaderProgress";
import { markLastReadChapter } from "@/features/reader/storage/readerStorage";
import { DEFAULT_READER_UI_SETTINGS, readReaderUiSettings, saveReaderUiSettings } from "@/features/reader/storage/readerUiSettings";
import { MangaChapter, MangaSeriesDetail, ReaderUiSettings } from "@/features/reader/types";
import { toReadHref, toSeriesHref } from "@/features/reader/utils/routes";
import { READER_THEME, readerCardStyle, readerControlClassName } from "@/features/reader/components/readerTheme";

type ChapterReaderProps = {
  seriesId: string;
  chapterId: string;
  isImmersive?: boolean;
  onToggleImmersive?: () => void;
};

const UI_TOGGLE_LABELS: { key: keyof Pick<ReaderUiSettings, "showProgressChip" | "autoHideChrome" | "tapToToggleChrome" | "showSettingsHints">; label: string; hint: string }[] = [
  {
    key: "showProgressChip",
    label: "Show Progress Chip",
    hint: "Display reading progress percentage in the top bar."
  },
  {
    key: "autoHideChrome",
    label: "Auto-hide Controls",
    hint: "In full screen, top and bottom bars fade out while you read."
  },
  {
    key: "tapToToggleChrome",
    label: "Tap to Toggle UI",
    hint: "Tap page area in full screen to show or hide controls."
  },
  {
    key: "showSettingsHints",
    label: "Show Reading Hints",
    hint: "Display quick tips below the chapter header."
  }
];

const settingsChipClassName =
  "min-h-10 rounded-full border px-3 py-2 text-[13px] font-medium transition-colors";

const GAP_CLASS_BY_SETTING: Record<ReaderUiSettings["pageGap"], string> = {
  tight: "gap-1.5",
  normal: "gap-3",
  airy: "gap-5"
};
const PAGE_RENDER_BATCH = 18;

const getReaderWidthStyle = (setting: ReaderUiSettings["pageWidth"]): { maxWidth?: string } => {
  switch (setting) {
    case "narrow":
      return { maxWidth: "760px" };
    case "comfortable":
      return { maxWidth: "980px" };
    case "wide":
      return { maxWidth: "1240px" };
    case "full":
    default:
      return {};
  }
};

export const ChapterReader = ({
  seriesId,
  chapterId,
  isImmersive = false,
  onToggleImmersive
}: ChapterReaderProps) => {
  const [series, setSeries] = useState<MangaSeriesDetail | null>(null);
  const [chapters, setChapters] = useState<MangaChapter[]>([]);
  const [pages, setPages] = useState<string[]>([]);
  const [fallbackPages, setFallbackPages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState(0);
  const [failedPagesCount, setFailedPagesCount] = useState(0);
  const [visiblePageCount, setVisiblePageCount] = useState(PAGE_RENDER_BATCH);
  const [scrollPercent, setScrollPercent] = useState(0);
  const [settings, setSettings] = useState<ReaderUiSettings>(DEFAULT_READER_UI_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const autoHideTimerRef = useRef<number | null>(null);
  const retryingPageIndexesRef = useRef<Set<number>>(new Set());
  const pageRetryCountsRef = useRef<Map<number, number>>(new Map());
  const markedHistoryRef = useRef(false);

  const currentChapter = useMemo(() => chapters.find((chapter) => chapter.id === chapterId) ?? null, [chapters, chapterId]);

  const chapterLabel = useMemo(() => {
    if (!currentChapter) {
      return "Chapter";
    }

    return formatChapterLabel(currentChapter);
  }, [currentChapter]);

  const pageGapClassName = GAP_CLASS_BY_SETTING[settings.pageGap];
  const pageContainerStyle = getReaderWidthStyle(settings.pageWidth);
  const imageRoundClassName = settings.imageCorners === "soft" ? "rounded-lg" : "rounded-none";
  const showReaderChrome = !isImmersive || chromeVisible || isSettingsOpen;
  const visiblePages = useMemo(() => pages.slice(0, visiblePageCount), [pages, visiblePageCount]);
  const chromeSurface = READER_THEME.surface;

  const updateSetting = <K extends keyof ReaderUiSettings>(key: K, value: ReaderUiSettings[K]) => {
    setSettings((previous) => {
      const next = { ...previous, [key]: value };
      saveReaderUiSettings(next);
      return next;
    });
  };

  const resetSettings = () => {
    setSettings(DEFAULT_READER_UI_SETTINGS);
    saveReaderUiSettings(DEFAULT_READER_UI_SETTINGS);
  };

  const clearAutoHideTimer = () => {
    if (autoHideTimerRef.current !== null) {
      window.clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
  };

  const scheduleAutoHide = () => {
    clearAutoHideTimer();

    if (!isImmersive || !settings.autoHideChrome || isSettingsOpen) {
      return;
    }

    autoHideTimerRef.current = window.setTimeout(() => {
      setChromeVisible(false);
    }, 2200);
  };

  const markReaderActivity = () => {
    if (!isImmersive) {
      return;
    }

    setChromeVisible(true);
    scheduleAutoHide();
  };

  useReaderProgress({
    containerRef: scrollContainerRef,
    seriesId,
    chapterId,
    chapterLabel,
    canRestore: pages.length > 0 && loadedImages >= Math.min(3, pages.length)
  });

  useEffect(() => {
    setSettings(readReaderUiSettings());
  }, []);

  useEffect(() => {
    setChromeVisible(true);
    setIsSettingsOpen(false);
    markedHistoryRef.current = false;
    setVisiblePageCount(PAGE_RENDER_BATCH);
  }, [seriesId, chapterId, isImmersive]);

  useEffect(() => {
    if (!isImmersive || !settings.autoHideChrome || isSettingsOpen) {
      clearAutoHideTimer();
      setChromeVisible(true);
      return;
    }

    scheduleAutoHide();

    return () => {
      clearAutoHideTimer();
    };
  }, [isImmersive, settings.autoHideChrome, isSettingsOpen]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    let raf = 0;

    const update = () => {
      const maxScrollable = Math.max(1, container.scrollHeight - container.clientHeight);
      setScrollPercent(Math.max(0, Math.min(100, (container.scrollTop / maxScrollable) * 100)));

      if (visiblePageCount < pages.length) {
        const nearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 1200;
        if (nearBottom) {
          setVisiblePageCount((previous) => Math.min(previous + PAGE_RENDER_BATCH, pages.length));
        }
      }
    };

    const handle = () => {
      if (raf) {
        return;
      }

      raf = window.requestAnimationFrame(() => {
        raf = 0;
        update();
        markReaderActivity();
      });
    };

    update();
    container.addEventListener("scroll", handle, { passive: true });

    return () => {
      container.removeEventListener("scroll", handle);
      if (raf) {
        window.cancelAnimationFrame(raf);
      }
    };
  }, [pages.length, visiblePageCount, isImmersive, settings.autoHideChrome, isSettingsOpen]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const handlePointerActivity = () => {
      markReaderActivity();
    };

    container.addEventListener("pointerdown", handlePointerActivity);
    container.addEventListener("mousemove", handlePointerActivity);
    container.addEventListener("touchstart", handlePointerActivity, { passive: true });

    return () => {
      container.removeEventListener("pointerdown", handlePointerActivity);
      container.removeEventListener("mousemove", handlePointerActivity);
      container.removeEventListener("touchstart", handlePointerActivity);
    };
  }, [isImmersive, settings.autoHideChrome, isSettingsOpen]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);
      setLoadedImages(0);
      setFailedPagesCount(0);
      pageRetryCountsRef.current.clear();
      retryingPageIndexesRef.current.clear();

      try {
        const [seriesData, chapterData, pageData] = await Promise.all([
          getMangaSeries(seriesId),
          getSeriesChapters(seriesId),
          getChapterPages(chapterId)
        ]);

        if (cancelled) {
          return;
        }

        setSeries(seriesData);
        setChapters(chapterData);

        const nextPrimaryPages = pageData.pages.length > 0 ? pageData.pages : pageData.dataSaverPages;
        const nextFallbackPages = pageData.dataSaverPages.length > 0 ? pageData.dataSaverPages : pageData.pages;

        setPages(nextPrimaryPages);
        setFallbackPages(nextFallbackPages);
        setVisiblePageCount(Math.min(PAGE_RENDER_BATCH, nextPrimaryPages.length || nextFallbackPages.length || PAGE_RENDER_BATCH));
      } catch {
        if (cancelled) {
          return;
        }

        setError("Could not load chapter pages right now.");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [seriesId, chapterId]);

  useEffect(() => {
    if (!series || loadedImages <= 0 || markedHistoryRef.current) {
      return;
    }

    markedHistoryRef.current = true;
    markLastReadChapter({
      seriesId,
      seriesTitle: series.title,
      coverUrl: series.coverUrl,
      chapterId,
      chapterLabel
    });
  }, [chapterId, chapterLabel, loadedImages, series, seriesId]);

  useEffect(() => {
    return () => {
      clearAutoHideTimer();
    };
  }, []);

  const chapterIndex = currentChapter ? chapters.findIndex((chapter) => chapter.id === currentChapter.id) : -1;
  const previousChapter = chapterIndex > 0 ? chapters[chapterIndex - 1] : null;
  const nextChapter = chapterIndex >= 0 && chapterIndex < chapters.length - 1 ? chapters[chapterIndex + 1] : null;

  const handleReaderAreaClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!isImmersive || !settings.tapToToggleChrome || isSettingsOpen) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest("a,button")) {
      return;
    }

    setChromeVisible((previous) => !previous);
  };

  const handleImageError = async (index: number) => {
    const retryingSet = retryingPageIndexesRef.current;
    if (retryingSet.has(index)) {
      return;
    }

    const currentPageUrl = pages[index];
    const fallbackUrl = fallbackPages[index];
    if (fallbackUrl && currentPageUrl !== fallbackUrl) {
      setPages((previous) => {
        const next = [...previous];
        next[index] = fallbackUrl;
        return next;
      });
      return;
    }

    const currentRetries = pageRetryCountsRef.current.get(index) ?? 0;
    if (currentRetries >= 2) {
      setFailedPagesCount((count) => count + 1);
      return;
    }

    retryingSet.add(index);
    pageRetryCountsRef.current.set(index, currentRetries + 1);

    try {
      const refreshed = await refreshChapterPages(chapterId);
      const refreshedPrimary = refreshed.pages.length > 0 ? refreshed.pages : refreshed.dataSaverPages;
      const refreshedFallback = refreshed.dataSaverPages.length > 0 ? refreshed.dataSaverPages : refreshed.pages;

      if (refreshedFallback.length > 0) {
        setFallbackPages(refreshedFallback);
      }

      if (refreshedPrimary.length > 0) {
        setPages((previous) => {
          const next = [...previous];
          const nextUrl = refreshedPrimary[index] ?? refreshedFallback[index] ?? previous[index];
          if (nextUrl) {
            next[index] = nextUrl;
          }
          return next;
        });
      } else {
        setFailedPagesCount((count) => count + 1);
      }
    } catch {
      setFailedPagesCount((count) => count + 1);
    } finally {
      retryingSet.delete(index);
    }
  };

  const handleReloadChapterPages = async () => {
    try {
      const refreshed = await refreshChapterPages(chapterId);
      const refreshedPrimary = refreshed.pages.length > 0 ? refreshed.pages : refreshed.dataSaverPages;
      const refreshedFallback = refreshed.dataSaverPages.length > 0 ? refreshed.dataSaverPages : refreshed.pages;

      setPages(refreshedPrimary);
      setFallbackPages(refreshedFallback);
      setFailedPagesCount(0);
      setLoadedImages(0);
      setVisiblePageCount(Math.min(PAGE_RENDER_BATCH, refreshedPrimary.length || refreshedFallback.length || PAGE_RENDER_BATCH));
      pageRetryCountsRef.current.clear();
    } catch {
      // Keep existing page state and let user retry.
    }
  };

  if (isLoading) {
    return (
      <section
        className={`grid min-h-0 place-items-center px-4 text-center ${isImmersive ? "h-screen" : "h-full"}`}
        style={readerCardStyle}
      >
        <p className="text-[17px]">Loading chapter...</p>
      </section>
    );
  }

  if (error || !series) {
    return (
      <section
        className={`grid min-h-0 place-items-center px-4 text-center ${isImmersive ? "h-screen" : "h-full"}`}
        style={readerCardStyle}
      >
        <div className="max-w-[520px] rounded-2xl border px-4 py-5" style={{ borderColor: READER_THEME.border, background: READER_THEME.surface }}>
          <p className="text-[16px]" style={{ color: READER_THEME.textSecondary }}>
            {error ?? "This chapter could not be loaded."}
          </p>
          <div className="mt-3">
            <Link
              href={toSeriesHref(seriesId)}
              className={readerControlClassName}
              style={{ borderColor: READER_THEME.border, background: `${READER_THEME.accentBlue}85`, color: READER_THEME.textPrimary }}
            >
              Back to series
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`relative flex min-h-0 min-w-0 flex-col overflow-hidden ${isImmersive ? "h-screen" : "h-full rounded-[1.4rem] border sm:rounded-[1.6rem]"}`}
      style={{
        ...(isImmersive ? { background: READER_THEME.surfaceStrong } : readerCardStyle),
        color: READER_THEME.textPrimary
      }}
    >
      <header
        className={`border-b px-2.5 py-2.5 transition-all duration-200 sm:px-4 ${showReaderChrome ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0 pointer-events-none"}`}
        style={{
          borderColor: READER_THEME.border,
          paddingTop: isImmersive ? "calc(0.6rem + env(safe-area-inset-top))" : undefined
        }}
      >
        <div
          className="flex flex-wrap items-center gap-2 rounded-2xl border px-2.5 py-2 sm:px-3 sm:flex-nowrap sm:justify-between"
          style={{ borderColor: READER_THEME.border, background: chromeSurface }}
        >
          <Link
            href={toSeriesHref(seriesId)}
            className="cozy-outline shrink-0 rounded-full border px-3 py-1 text-[13px] font-medium"
            style={{ borderColor: READER_THEME.border, color: READER_THEME.textPrimary, background: READER_THEME.surfaceStrong }}
          >
            Back
          </Link>

          <div className="order-3 w-full min-w-0 text-left sm:order-none sm:flex-1 sm:text-center">
            <p className="truncate text-[12px]" style={{ color: READER_THEME.textSecondary }}>
              {series.title}
            </p>
            <p className="truncate text-[14px] font-medium">{chapterLabel}</p>
            {settings.showSettingsHints ? (
              <p className="hidden truncate text-[11px] sm:block" style={{ color: READER_THEME.textSecondary }}>
                Adjust width, spacing, and controls with Settings.
              </p>
            ) : null}
          </div>

          <div className="ml-auto flex w-full items-center justify-end gap-2 sm:ml-0 sm:w-auto">
            {settings.showProgressChip ? (
              <div className="rounded-full border px-2.5 py-1 text-[12px]" style={{ borderColor: READER_THEME.border, color: READER_THEME.textSecondary }}>
                {Math.round(scrollPercent)}%
              </div>
            ) : null}
            <button
              type="button"
              className={readerControlClassName}
              style={{ borderColor: READER_THEME.border, background: `${READER_THEME.accentLavender}7D`, color: READER_THEME.textPrimary }}
              onClick={() => {
                setIsSettingsOpen((previous) => !previous);
                setChromeVisible(true);
              }}
            >
              Settings
            </button>
            {onToggleImmersive ? (
              <button
                type="button"
                className={readerControlClassName}
                style={{ borderColor: READER_THEME.border, background: `${READER_THEME.accentBlue}7D`, color: READER_THEME.textPrimary }}
                onClick={onToggleImmersive}
              >
                {isImmersive ? "Exit Full Screen" : "Full Screen"}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {isSettingsOpen ? (
        <aside
          className="absolute left-1/2 top-[72px] z-40 max-h-[calc(100dvh-7rem)] w-[min(96vw,420px)] -translate-x-1/2 overflow-y-auto rounded-[1.2rem] border p-3 sm:left-auto sm:right-4 sm:top-[86px] sm:w-[min(92vw,380px)] sm:translate-x-0"
          style={{
            borderColor: READER_THEME.border,
            background: chromeSurface,
            boxShadow: "0 10px 24px rgba(188, 149, 129, 0.16)"
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[16px] font-medium">Reader Settings</h3>
            <button
              type="button"
              className={settingsChipClassName}
              style={{ borderColor: READER_THEME.border, background: READER_THEME.surface, color: READER_THEME.textPrimary }}
              onClick={() => setIsSettingsOpen(false)}
            >
              Close
            </button>
          </div>

          <div className="mt-3 space-y-2.5">
            <details className="rounded-xl border p-2.5" style={{ borderColor: READER_THEME.border, background: READER_THEME.surface }}>
              <summary className="cursor-pointer list-none text-[12px] font-medium uppercase tracking-[0.12em]" style={{ color: READER_THEME.textSecondary }}>
                Page Width
              </summary>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    ["narrow", "Narrow"],
                    ["comfortable", "Comfortable"],
                    ["wide", "Wide"],
                    ["full", "Full"]
                  ] as const
                ).map(([value, label]) => {
                  const isActive = settings.pageWidth === value;

                  return (
                    <button
                      key={value}
                      type="button"
                      className={settingsChipClassName}
                      style={{
                        borderColor: READER_THEME.border,
                        background: isActive ? `${READER_THEME.accentBlue}A8` : READER_THEME.surface,
                        color: READER_THEME.textPrimary
                      }}
                      onClick={() => updateSetting("pageWidth", value)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </details>

            <details className="rounded-xl border p-2.5" style={{ borderColor: READER_THEME.border, background: READER_THEME.surface }}>
              <summary className="cursor-pointer list-none text-[12px] font-medium uppercase tracking-[0.12em]" style={{ color: READER_THEME.textSecondary }}>
                Panel Spacing
              </summary>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    ["tight", "Tight"],
                    ["normal", "Normal"],
                    ["airy", "Airy"]
                  ] as const
                ).map(([value, label]) => {
                  const isActive = settings.pageGap === value;

                  return (
                    <button
                      key={value}
                      type="button"
                      className={settingsChipClassName}
                      style={{
                        borderColor: READER_THEME.border,
                        background: isActive ? `${READER_THEME.accentMint}A8` : READER_THEME.surface,
                        color: READER_THEME.textPrimary
                      }}
                      onClick={() => updateSetting("pageGap", value)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </details>

            <details className="rounded-xl border p-2.5" style={{ borderColor: READER_THEME.border, background: READER_THEME.surface }}>
              <summary className="cursor-pointer list-none text-[12px] font-medium uppercase tracking-[0.12em]" style={{ color: READER_THEME.textSecondary }}>
                Panel Corners
              </summary>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    ["soft", "Soft"],
                    ["square", "Square"]
                  ] as const
                ).map(([value, label]) => {
                  const isActive = settings.imageCorners === value;

                  return (
                    <button
                      key={value}
                      type="button"
                      className={settingsChipClassName}
                      style={{
                        borderColor: READER_THEME.border,
                        background: isActive ? `${READER_THEME.accentPeach}A8` : READER_THEME.surface,
                        color: READER_THEME.textPrimary
                      }}
                      onClick={() => updateSetting("imageCorners", value)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </details>

            <details className="rounded-xl border p-2.5" style={{ borderColor: READER_THEME.border, background: READER_THEME.surface }}>
              <summary className="cursor-pointer list-none text-[12px] font-medium uppercase tracking-[0.12em]" style={{ color: READER_THEME.textSecondary }}>
                Behavior
              </summary>
              <div className="mt-2 space-y-2">
                {UI_TOGGLE_LABELS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className="w-full rounded-xl border px-3 py-2 text-left transition-colors"
                    style={{
                      borderColor: READER_THEME.border,
                      background: settings[item.key] ? `${READER_THEME.accentLavender}72` : "rgba(255,253,251,0.8)",
                      color: READER_THEME.textPrimary
                    }}
                    onClick={() => updateSetting(item.key, !settings[item.key])}
                  >
                    <p className="text-[14px] font-medium">{item.label}</p>
                    <p className="text-[12px]" style={{ color: READER_THEME.textSecondary }}>
                      {item.hint}
                    </p>
                  </button>
                ))}
              </div>
            </details>

            <button
              type="button"
              className={settingsChipClassName}
              style={{ borderColor: READER_THEME.border, background: `${READER_THEME.accentButter}B0`, color: READER_THEME.textPrimary }}
              onClick={resetSettings}
            >
              Reset to Default
            </button>
          </div>
        </aside>
      ) : null}

      <div
        ref={scrollContainerRef}
        className={`min-h-0 min-w-0 flex-1 overflow-y-auto ${isImmersive ? "px-0 py-2 sm:px-2" : "px-1.5 py-2.5 sm:px-4 sm:py-3"}`}
        onClick={handleReaderAreaClick}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className={`mx-auto flex w-full flex-col ${pageGapClassName}`} style={pageContainerStyle}>
          {failedPagesCount > 0 ? (
            <div className="rounded-xl border px-4 py-3 text-[13px]" style={{ borderColor: READER_THEME.border, background: `${READER_THEME.accentPink}55`, color: READER_THEME.textPrimary }}>
              {failedPagesCount} page{failedPagesCount === 1 ? "" : "s"} failed to load.{" "}
              <button
                type="button"
                className="underline"
                style={{ color: READER_THEME.textPrimary }}
                onClick={handleReloadChapterPages}
              >
                Reload chapter pages
              </button>
            </div>
          ) : null}

          {visiblePages.map((pageUrl, index) => (
            <img
              key={`${chapterId}-${index}`}
              src={pageUrl}
              alt={`${chapterLabel} page ${index + 1}`}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className={`w-full border ${imageRoundClassName}`}
              style={{ borderColor: READER_THEME.border, background: READER_THEME.surface }}
              onLoad={() => setLoadedImages((value) => value + 1)}
              onError={() => {
                void handleImageError(index);
              }}
            />
          ))}

          {pages.length > visiblePages.length ? (
            <div className="rounded-xl border px-4 py-3 text-[13px]" style={{ borderColor: READER_THEME.border, background: READER_THEME.surface, color: READER_THEME.textSecondary }}>
              Showing {visiblePages.length} of {pages.length} pages.
              <button
                type="button"
                className="ml-2 underline"
                style={{ color: READER_THEME.textPrimary }}
                onClick={() => setVisiblePageCount((previous) => Math.min(previous + PAGE_RENDER_BATCH, pages.length))}
              >
                Load more
              </button>
            </div>
          ) : null}

          {pages.length === 0 ? (
            <div className="rounded-xl border px-4 py-4 text-[15px]" style={{ borderColor: READER_THEME.border, background: READER_THEME.surface, color: READER_THEME.textSecondary }}>
              This chapter has no readable image pages yet.
            </div>
          ) : null}
        </div>
      </div>

      <footer
        className={`border-t px-2.5 py-2.5 transition-all duration-200 sm:px-4 ${showReaderChrome ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0 pointer-events-none"}`}
        style={{
          borderColor: READER_THEME.border,
          paddingBottom: isImmersive ? "calc(0.65rem + env(safe-area-inset-bottom))" : undefined
        }}
      >
        <div
          className="mx-auto flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl border px-2.5 py-2 sm:flex-nowrap sm:px-3"
          style={{ borderColor: READER_THEME.border, background: chromeSurface, ...pageContainerStyle }}
        >
          {previousChapter ? (
            <Link
              href={toReadHref(seriesId, previousChapter.id)}
              className={readerControlClassName}
              style={{ borderColor: READER_THEME.border, background: `${READER_THEME.accentLavender}85`, color: READER_THEME.textPrimary }}
            >
              Previous
            </Link>
          ) : (
            <span className="rounded-full border px-3 py-2 text-[13px]" style={{ borderColor: READER_THEME.border, color: READER_THEME.textSecondary }}>
              Start
            </span>
          )}

          {nextChapter ? (
            <Link
              href={toReadHref(seriesId, nextChapter.id)}
              className={readerControlClassName}
              style={{ borderColor: READER_THEME.border, background: `${READER_THEME.accentMint}88`, color: READER_THEME.textPrimary }}
            >
              Next
            </Link>
          ) : (
            <span className="rounded-full border px-3 py-2 text-[13px]" style={{ borderColor: READER_THEME.border, color: READER_THEME.textSecondary }}>
              End
            </span>
          )}
        </div>
      </footer>

      {isImmersive && !showReaderChrome ? (
        <button
          type="button"
          className="absolute bottom-4 right-4 z-50 rounded-full border px-4 py-2 text-[13px] font-medium"
          style={{ borderColor: READER_THEME.border, background: chromeSurface, color: READER_THEME.textPrimary }}
          onClick={() => {
            setChromeVisible(true);
            scheduleAutoHide();
          }}
        >
          Show Controls
        </button>
      ) : null}
    </section>
  );
};

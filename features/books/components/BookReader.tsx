"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { findGutendexSource } from "@/features/books/api/gutendex";
import { getOpenLibraryWork } from "@/features/books/api/openLibrary";
import { loadReaderContent } from "@/features/books/api/content";
import {
  getBookByKey,
  getBookProgress,
  getBookReaderSettings,
  saveBookProgress,
  saveBookReaderSettings,
  upsertBookHistory
} from "@/features/books/storage/bookStorage";
import { BookReaderContent, BookReaderSettings, BookSeriesDetail } from "@/features/books/types";
import { toBookDetailHref } from "@/features/books/utils/routes";
import { BOOK_THEME, bookCardStyle, bookControlClassName } from "@/features/books/components/bookTheme";

type BookReaderProps = {
  openLibraryKey: string;
  isImmersive?: boolean;
  onToggleImmersive?: () => void;
  themeMode?: "light" | "dark";
  onThemeChange?: (theme: "light" | "dark") => void;
};

const renderPlainTextParagraphs = (plainText: string, anchors: { id: string; label: string }[]) => {
  const anchorByLine = new Map<number, string>();
  anchors.forEach((anchor) => {
    const match = anchor.id.match(/^line-(\d+)$/);
    if (match) {
      anchorByLine.set(Number(match[1]), anchor.id);
    }
  });

  return plainText.split(/\r?\n/).map((line, index) => {
    const normalized = line.trim();
    const anchorId = anchorByLine.get(index);
    if (!normalized) {
      return <div key={`space-${index}`} className="h-4" />;
    }

    return (
      <p key={`line-${index}`} id={anchorId} className="my-0">
        {normalized}
      </p>
    );
  });
};

export const BookReader = ({ openLibraryKey, isImmersive = false, onToggleImmersive, themeMode, onThemeChange }: BookReaderProps) => {
  const [detail, setDetail] = useState<BookSeriesDetail | null>(null);
  const [content, setContent] = useState<BookReaderContent | null>(null);
  const [settings, setSettings] = useState<BookReaderSettings>({ theme: "light", fontSize: 19, lineHeight: 1.7 });
  const [isSettingsReady, setIsSettingsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [activeSection, setActiveSection] = useState<string>("");
  const [isControlsOpen, setIsControlsOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const hasRestoredProgressRef = useRef(false);

  useEffect(() => {
    const stored = getBookReaderSettings();
    setSettings({
      ...stored,
      theme: themeMode ?? stored.theme
    });
    setIsSettingsReady(true);
  }, [openLibraryKey, themeMode]);

  useEffect(() => {
    if (!themeMode) {
      return;
    }

    setSettings((previous) => (previous.theme === themeMode ? previous : { ...previous, theme: themeMode }));
  }, [themeMode]);

  useEffect(() => {
    if (!isSettingsReady) {
      return;
    }

    saveBookReaderSettings(settings);
    onThemeChange?.(settings.theme);
  }, [isSettingsReady, onThemeChange, settings]);

  useEffect(() => {
    let cancelled = false;
    hasRestoredProgressRef.current = false;
    setIsLoading(true);
    setError(null);
    setContent(null);
    setDetail(null);
    setProgress(0);
    setActiveSection("");

    const load = async () => {
      try {
        const historyItem = getBookByKey(openLibraryKey);
        const base = historyItem
          ? {
              id: historyItem.openLibraryKey,
              openLibraryKey: historyItem.openLibraryKey,
              title: historyItem.title,
              authorName: historyItem.authorName,
              coverUrl: historyItem.coverUrl,
              firstPublishYear: historyItem.firstPublishYear,
              description: "",
              subjects: [],
              language: "en",
              readerSource: historyItem.readerSource,
              matchStatus: historyItem.hasReaderSource ? ("readable" as const) : ("metadata" as const)
            }
          : null;

        const openLibraryDetail = await getOpenLibraryWork(openLibraryKey);
        if (cancelled) {
          return;
        }

        const source =
          historyItem?.readerSource ??
          (await findGutendexSource({
            title: openLibraryDetail.title,
            authorName: openLibraryDetail.authorName,
            firstPublishYear: openLibraryDetail.firstPublishYear
          }));

        if (cancelled) {
          return;
        }

        const resolvedDetail: BookSeriesDetail = {
          ...(base ?? openLibraryDetail),
          ...openLibraryDetail,
          readerSource: source,
          matchStatus: source ? "readable" : "metadata"
        };
        setDetail(resolvedDetail);
        upsertBookHistory(resolvedDetail);

        if (!source) {
          setError("This title has metadata, but no readable public-domain source was found yet.");
          setIsLoading(false);
          return;
        }

        const loadedContent = await loadReaderContent(source, resolvedDetail.title, resolvedDetail.authorName);
        if (cancelled) {
          return;
        }

        if (!loadedContent) {
          setError("Unable to load text content right now. You can try again in a moment.");
          setIsLoading(false);
          return;
        }

        setContent(loadedContent);
      } catch {
        if (!cancelled) {
          setError("Could not open this book right now. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [openLibraryKey]);

  const getNearestSection = (container: HTMLDivElement): string => {
    if (!content?.sectionAnchors.length) {
      return "";
    }

    let nearest = "";
    for (const section of content.sectionAnchors) {
      const element = container.querySelector<HTMLElement>(`#${section.id}`);
      if (!element) {
        continue;
      }

      if (element.offsetTop <= container.scrollTop + 40) {
        nearest = section.id;
      } else {
        break;
      }
    }

    return nearest;
  };

  const saveProgressSnapshot = () => {
    const container = scrollRef.current;
    if (!container || !detail) {
      return;
    }

    const maxScroll = Math.max(1, container.scrollHeight - container.clientHeight);
    const nextProgress = Math.min(100, Math.max(0, (container.scrollTop / maxScroll) * 100));
    const nearestSection = getNearestSection(container);

    saveBookProgress({
      openLibraryKey: detail.openLibraryKey,
      progressPercent: nextProgress,
      scrollTop: container.scrollTop,
      scrollHeight: container.scrollHeight,
      lastLocation: nearestSection || null,
      updatedAt: Date.now()
    });

    setProgress(nextProgress);
    setActiveSection(nearestSection);
  };

  useEffect(() => {
    if (!content || !isSettingsReady || hasRestoredProgressRef.current) {
      return;
    }

    const progressEntry = getBookProgress(openLibraryKey);
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    hasRestoredProgressRef.current = true;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!container || !progressEntry) {
          return;
        }

        const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
        const fromTop = Math.min(maxScroll, Math.max(0, progressEntry.scrollTop));
        const fromRatio = Math.min(maxScroll, Math.max(0, (progressEntry.progressPercent / 100) * maxScroll));
        const savedTop = Math.abs(fromTop - fromRatio) > 120 ? fromRatio : fromTop;

        container.scrollTo({ top: savedTop, behavior: "auto" });
        setProgress(progressEntry.progressPercent);
        setActiveSection(progressEntry.lastLocation ?? "");
      });
    });
  }, [content, isSettingsReady, openLibraryKey, settings.fontSize, settings.lineHeight]);

  useEffect(() => {
    setIsControlsOpen(false);
  }, [openLibraryKey, isImmersive]);

  useEffect(() => {
    if (!detail) {
      return;
    }

    const handlePageHide = () => {
      saveProgressSnapshot();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveProgressSnapshot();
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      saveProgressSnapshot();
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [detail, content, settings.fontSize, settings.lineHeight]);

  const readingColors = settings.theme === "dark"
    ? {
        background: "rgba(26, 23, 21, 0.96)",
        text: BOOK_THEME.readerDarkText,
        muted: "rgba(242, 231, 209, 0.7)"
      }
    : {
        background: "rgba(253, 248, 238, 0.97)",
        text: BOOK_THEME.readerLightText,
        muted: "rgba(94, 74, 66, 0.7)"
      };
  const chromeColors =
    settings.theme === "dark"
      ? {
          shellBackground: "rgba(24, 21, 19, 0.96)",
          shellBorder: "rgba(255, 226, 179, 0.22)",
          shellText: BOOK_THEME.readerDarkText,
          shellMuted: "rgba(242, 231, 209, 0.72)",
          surface: "rgba(51, 43, 39, 0.88)",
          progressTrack: "rgba(255, 226, 179, 0.14)"
        }
      : {
          shellBackground: bookCardStyle.background,
          shellBorder: BOOK_THEME.border,
          shellText: BOOK_THEME.textPrimary,
          shellMuted: BOOK_THEME.textSecondary,
          surface: BOOK_THEME.surface,
          progressTrack: "rgba(232, 196, 180, 0.35)"
        };

  const onScroll = () => {
    const container = scrollRef.current;
    if (!container || !detail) {
      return;
    }

    const maxScroll = Math.max(1, container.scrollHeight - container.clientHeight);
    const nextProgress = Math.min(100, Math.max(0, (container.scrollTop / maxScroll) * 100));
    setProgress(nextProgress);

    const nearestSection = getNearestSection(container);

    setActiveSection(nearestSection);
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveProgressSnapshot();
    }, 220);
  };

  const onJumpSection = (event: ChangeEvent<HTMLSelectElement>) => {
    const targetId = event.target.value;
    setActiveSection(targetId);
    if (!targetId) {
      return;
    }

    const container = scrollRef.current;
    if (!container) {
      return;
    }

    const sectionNode = container.querySelector<HTMLElement>(`#${targetId}`);
    if (sectionNode) {
      container.scrollTo({ top: Math.max(0, sectionNode.offsetTop - 24), behavior: "smooth" });
    }
  };

  const onFontSizeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value);
    setSettings((previous) => ({ ...previous, fontSize: Math.min(28, Math.max(15, next)) }));
  };

  const onLineHeightChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value);
    setSettings((previous) => ({ ...previous, lineHeight: Math.min(2.2, Math.max(1.3, next)) }));
  };

  const hasReadableContent = Boolean(content?.htmlContent || content?.plainText);

  return (
    <div
      className="flex h-full min-h-0 min-w-0 flex-col rounded-[1.2rem] border sm:rounded-[1.4rem]"
      style={{ ...bookCardStyle, background: chromeColors.shellBackground, borderColor: chromeColors.shellBorder, color: chromeColors.shellText }}
    >
      <header
        className="flex min-w-0 flex-wrap items-center gap-2 border-b px-2.5 py-2.5 sm:px-4 sm:py-3"
        style={{
          borderColor: chromeColors.shellBorder,
          paddingTop: isImmersive ? "calc(0.7rem + env(safe-area-inset-top))" : undefined
        }}
      >
        <Link
          href={toBookDetailHref(openLibraryKey)}
          className={bookControlClassName}
          style={{ borderColor: chromeColors.shellBorder, background: chromeColors.surface, color: chromeColors.shellText }}
        >
          Back
        </Link>

        <button
          type="button"
          onClick={() => setIsControlsOpen((value) => !value)}
          className={`${bookControlClassName} sm:hidden`}
          style={{ borderColor: chromeColors.shellBorder, background: `${BOOK_THEME.accentButter}82`, color: chromeColors.shellText }}
        >
          {isControlsOpen ? "Hide Controls" : "Show Controls"}
        </button>

        <div className="ml-auto flex w-full items-center justify-end gap-2 text-[13px] sm:w-auto" style={{ color: chromeColors.shellMuted }}>
          <span>{Math.round(progress)}%</span>
          {onToggleImmersive ? (
            <button
              type="button"
              onClick={onToggleImmersive}
              className={bookControlClassName}
              style={{ borderColor: chromeColors.shellBorder, background: `${BOOK_THEME.accentBlue}85`, color: chromeColors.shellText }}
            >
              {isImmersive ? "Exit Full Screen" : "Full Screen"}
            </button>
          ) : null}
        </div>

        <div className={`${isControlsOpen ? "grid" : "hidden"} w-full grid-cols-1 gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-3`}>
          <button
            type="button"
            onClick={() => setSettings((previous) => ({ ...previous, theme: previous.theme === "dark" ? "light" : "dark" }))}
            className={bookControlClassName}
            style={{ borderColor: chromeColors.shellBorder, background: `${BOOK_THEME.accentLavender}80`, color: chromeColors.shellText }}
          >
            {settings.theme === "dark" ? "Light mode" : "Dark mode"}
          </button>

          <label className="text-[12px]" style={{ color: chromeColors.shellMuted }}>
            Font size
            <input
              type="range"
              min={15}
              max={28}
              step={1}
              value={settings.fontSize}
              onChange={onFontSizeChange}
              className="mt-1 w-full"
            />
          </label>

          <label className="text-[12px]" style={{ color: chromeColors.shellMuted }}>
            Line height
            <input
              type="range"
              min={1.3}
              max={2.2}
              step={0.05}
              value={settings.lineHeight}
              onChange={onLineHeightChange}
              className="mt-1 w-full"
            />
          </label>

          <label className="text-[12px]" style={{ color: chromeColors.shellMuted }}>
            Jump to section
            <select
              value={activeSection}
              onChange={onJumpSection}
              className="mt-1 min-h-10 w-full rounded-xl border px-2 py-1.5 text-[13px]"
              style={{
                borderColor: chromeColors.shellBorder,
                background: chromeColors.surface,
                color: chromeColors.shellText
              }}
            >
              <option value="">Start</option>
              {(content?.sectionAnchors ?? []).map((section) => (
                <option key={section.id} value={section.id}>
                  {section.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div className="h-1 w-full" style={{ background: chromeColors.progressTrack }}>
        <div
          className="h-full transition-[width] duration-150"
          style={{ width: `${progress}%`, background: BOOK_THEME.accentBlue }}
        />
      </div>

      <div ref={scrollRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto px-1.5 py-3 sm:px-4 sm:py-5" onScroll={onScroll} style={{ WebkitOverflowScrolling: "touch" }}>
        {isLoading ? (
          <p className="text-[15px]" style={{ color: chromeColors.shellMuted }}>
            Opening book...
          </p>
        ) : null}

        {error ? (
          <div
            className="mx-auto max-w-[760px] rounded-[1.2rem] border p-4"
            style={{ ...bookCardStyle, borderColor: chromeColors.shellBorder, background: chromeColors.surface }}
          >
            <p className="text-[15px]" style={{ color: chromeColors.shellMuted }}>
              {error}
            </p>
            {detail?.readerSource?.epubUrl ? (
              <a
                href={detail.readerSource.epubUrl}
                target="_blank"
                rel="noreferrer"
                className={`${bookControlClassName} mt-3 inline-flex`}
                style={{ borderColor: chromeColors.shellBorder, background: `${BOOK_THEME.accentButter}80`, color: chromeColors.shellText }}
              >
                Open EPUB externally
              </a>
            ) : null}
          </div>
        ) : null}

        {!isLoading && !error && hasReadableContent ? (
          <article
            className="mx-auto min-w-0 rounded-[1.2rem] border px-3.5 py-4 sm:rounded-[1.3rem] sm:px-8 sm:py-8"
            style={{
              maxWidth: "760px",
              borderColor: settings.theme === "dark" ? "rgba(255,255,255,0.08)" : BOOK_THEME.border,
              background: readingColors.background,
              color: readingColors.text,
              fontSize: `${settings.fontSize}px`,
              lineHeight: settings.lineHeight
            }}
          >
            <h2 className="text-[clamp(1.5rem,4.5vw,2.2rem)] font-medium leading-tight">{content?.title}</h2>
            <p className="mt-1 text-[16px]" style={{ color: readingColors.muted }}>
              {content?.authorName}
            </p>

            {content?.mode === "html" && content.htmlContent ? (
              <div
                className="mt-6 min-w-0 space-y-5 break-words [&_*]:max-w-full [&_a]:underline [&_blockquote]:border-l [&_blockquote]:pl-4 [&_h1]:mt-8 [&_h1]:text-2xl [&_h2]:mt-7 [&_h2]:text-xl [&_h3]:mt-6 [&_h3]:text-lg [&_img]:h-auto [&_img]:max-w-full [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-5 [&_pre]:whitespace-pre-wrap [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_ul]:list-disc"
                dangerouslySetInnerHTML={{ __html: content.htmlContent }}
              />
            ) : null}

            {content?.mode === "text" && content.plainText ? (
              <div className="mt-6 space-y-5">{renderPlainTextParagraphs(content.plainText, content.sectionAnchors)}</div>
            ) : null}
          </article>
        ) : null}
      </div>
    </div>
  );
};

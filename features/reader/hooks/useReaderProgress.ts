import { RefObject, useEffect, useMemo, useRef } from "react";
import { getChapterProgress, saveChapterProgress } from "@/features/reader/storage/readerStorage";

type UseReaderProgressArgs = {
  containerRef: RefObject<HTMLDivElement | null>;
  seriesId: string;
  chapterId: string;
  chapterLabel: string;
  canRestore: boolean;
};

export const useReaderProgress = ({
  containerRef,
  seriesId,
  chapterId,
  chapterLabel,
  canRestore
}: UseReaderProgressArgs) => {
  const savedProgress = useMemo(() => getChapterProgress(seriesId, chapterId), [seriesId, chapterId]);
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !canRestore || hasRestoredRef.current) {
      return;
    }

    const progress = savedProgress;
    if (!progress) {
      hasRestoredRef.current = true;
      return;
    }

    const apply = () => {
      const maxScrollable = Math.max(0, container.scrollHeight - container.clientHeight);
      if (maxScrollable <= 0) {
        return;
      }

      const fallbackTop = progress.progressRatio > 0 ? progress.progressRatio * maxScrollable : 0;
      const targetTop = Math.max(0, Math.min(maxScrollable, progress.scrollTop || fallbackTop));
      container.scrollTop = targetTop;
      hasRestoredRef.current = true;
    };

    const frame = window.requestAnimationFrame(() => {
      apply();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [canRestore, containerRef, savedProgress]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let raf = 0;

    const handleScroll = () => {
      if (raf) {
        return;
      }

      raf = window.requestAnimationFrame(() => {
        raf = 0;

        const maxScrollable = Math.max(1, container.scrollHeight - container.clientHeight);
        saveChapterProgress({
          seriesId,
          chapterId,
          chapterLabel,
          scrollTop: container.scrollTop,
          scrollHeight: container.scrollHeight,
          progressRatio: Math.max(0, Math.min(1, container.scrollTop / maxScrollable)),
          updatedAt: Date.now()
        });
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (raf) {
        window.cancelAnimationFrame(raf);
      }
    };
  }, [chapterId, chapterLabel, containerRef, seriesId]);
};

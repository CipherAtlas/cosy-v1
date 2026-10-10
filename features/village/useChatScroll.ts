import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { SharedChatEntry } from "./sharedWorld";

export function useChatScroll(open: boolean, entries: SharedChatEntry[], draft: string, language: string) {
  const chatLog = useRef<HTMLDivElement>(null);
  const chatMessages = useRef<HTMLDivElement>(null);
  const scrollToLatest = useCallback(() => {
    const log = chatLog.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, []);

  useLayoutEffect(() => {
    if (open) scrollToLatest();
  }, [open, entries, draft, language, scrollToLatest]);

  useEffect(() => {
    const log = chatLog.current, messages = chatMessages.current;
    if (!open || !log || !messages) return;
    // Resizing, participant changes and late font layout can move the bottom after a React update.
    const observer = new ResizeObserver(scrollToLatest);
    observer.observe(log);
    observer.observe(messages);
    log.addEventListener("scroll", scrollToLatest, { passive: true });
    return () => {
      observer.disconnect();
      log.removeEventListener("scroll", scrollToLatest);
    };
  }, [open, scrollToLatest]);

  return { chatLog, chatMessages, scrollToLatest };
}

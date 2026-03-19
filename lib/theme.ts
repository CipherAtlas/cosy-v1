"use client";

import { useCallback, useEffect, useState } from "react";

export type AppTheme = "light" | "dark";

export const APP_THEME_KEY = "peaceful-room-theme";
const THEME_EVENT = "peaceful-room-theme-change";

const normalizeTheme = (value: string | null | undefined): AppTheme => (value === "dark" ? "dark" : "light");

export const readStoredTheme = (): AppTheme => {
  if (typeof window === "undefined") {
    return "light";
  }

  try {
    return normalizeTheme(window.localStorage.getItem(APP_THEME_KEY));
  } catch {
    return "light";
  }
};

export const applyThemeToDocument = (theme: AppTheme): void => {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.setAttribute("data-theme", theme);
};

export const writeStoredTheme = (theme: AppTheme): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(APP_THEME_KEY, theme);
  } catch {
    // Ignore write failures in private mode.
  }

  applyThemeToDocument(theme);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }));
};

export const useAppTheme = () => {
  const [theme, setThemeState] = useState<AppTheme>("light");

  useEffect(() => {
    const initialTheme = readStoredTheme();
    setThemeState(initialTheme);
    applyThemeToDocument(initialTheme);
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== APP_THEME_KEY) {
        return;
      }

      setThemeState(normalizeTheme(event.newValue));
      applyThemeToDocument(normalizeTheme(event.newValue));
    };

    const onThemeEvent = (event: Event) => {
      const customEvent = event as CustomEvent<AppTheme>;
      const nextTheme = normalizeTheme(customEvent.detail);
      setThemeState(nextTheme);
      applyThemeToDocument(nextTheme);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(THEME_EVENT, onThemeEvent);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(THEME_EVENT, onThemeEvent);
    };
  }, []);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    writeStoredTheme(nextTheme);
  }, []);

  return { theme, setTheme };
};

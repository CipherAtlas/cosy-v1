import type { CSSProperties } from "react";
type AppTheme = "light" | "dark";

export const READER_THEME = {
  background: "var(--reader-background)",
  surface: "var(--reader-surface)",
  surfaceStrong: "var(--reader-surface-strong)",
  border: "var(--reader-border)",
  textPrimary: "var(--reader-text-primary)",
  textSecondary: "var(--reader-text-secondary)",
  accentPeach: "#F6C7B8",
  accentPink: "#F2C6D8",
  accentLavender: "#DCCFF6",
  accentBlue: "#CFE5FF",
  accentMint: "#D8F0E4",
  accentButter: "#F7E7A8"
} as const;

export const readerPanelStyle = {
  background: READER_THEME.surfaceStrong,
  borderColor: READER_THEME.border,
  color: READER_THEME.textPrimary,
  boxShadow: "0 10px 30px rgba(188, 149, 129, 0.08)"
};

export const readerCardStyle = {
  background: READER_THEME.surface,
  borderColor: READER_THEME.border
};

export const readerControlClassName =
  "cozy-outline min-h-11 rounded-2xl border px-4 py-2.5 text-[15px] font-medium tracking-[0.01em] shadow-[0_2px_8px_rgba(188,149,129,0.08)] transition-all duration-150 ease-out hover:-translate-y-[1px] hover:brightness-[1.03] active:translate-y-0 active:brightness-95 sm:px-5 sm:text-[16px]";

export const getReaderThemeCssVars = (theme: AppTheme): CSSProperties => {
  const isDark = theme === "dark";
  return {
    "--reader-background": isDark ? "#151311" : "#FFF8F3",
    "--reader-surface": isDark ? "rgba(51, 43, 39, 0.88)" : "rgba(255, 255, 255, 0.78)",
    "--reader-surface-strong": isDark ? "rgba(31, 27, 24, 0.94)" : "#FFFDFB",
    "--reader-border": isDark ? "rgba(255, 226, 179, 0.24)" : "rgba(232, 196, 180, 0.5)",
    "--reader-text-primary": isDark ? "#F2E7D1" : "#5E4A42",
    "--reader-text-secondary": isDark ? "rgba(242, 231, 209, 0.72)" : "#8A746B"
  } as CSSProperties;
};

export const getReaderShellBackground = (theme: AppTheme): string =>
  theme === "dark"
    ? "radial-gradient(circle at 14% 12%, rgba(116, 88, 73, 0.3), transparent 36%), radial-gradient(circle at 82% 18%, rgba(82, 78, 104, 0.26), transparent 34%), radial-gradient(circle at 76% 88%, rgba(76, 96, 117, 0.24), transparent 38%), #151311"
    : "radial-gradient(circle at 14% 12%, rgba(246, 199, 184, 0.35), transparent 36%), radial-gradient(circle at 82% 18%, rgba(220, 207, 246, 0.34), transparent 34%), radial-gradient(circle at 76% 88%, rgba(207, 229, 255, 0.28), transparent 38%), #FFF8F3";

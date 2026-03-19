import { READER_THEME } from "@/features/reader/components/readerTheme";

export const BOOK_THEME = {
  ...READER_THEME,
  readerLightBg: "#FDF8EE",
  readerLightText: "#4B3E38",
  readerDarkBg: "#1A1715",
  readerDarkText: "#F2E7D1"
} as const;

export const bookPanelStyle = {
  background: BOOK_THEME.surfaceStrong,
  borderColor: BOOK_THEME.border,
  color: BOOK_THEME.textPrimary,
  boxShadow: "0 10px 30px rgba(188, 149, 129, 0.08)"
};

export const bookCardStyle = {
  background: BOOK_THEME.surface,
  borderColor: BOOK_THEME.border
};

export const bookControlClassName =
  "cozy-outline min-h-11 rounded-2xl border px-4 py-2.5 text-[15px] font-medium tracking-[0.01em] shadow-[0_2px_8px_rgba(188,149,129,0.08)] transition-all duration-150 ease-out hover:-translate-y-[1px] hover:brightness-[1.03] active:translate-y-0 active:brightness-95 sm:px-5 sm:text-[16px]";

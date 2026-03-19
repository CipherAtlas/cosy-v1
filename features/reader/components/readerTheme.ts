export const READER_THEME = {
  background: "#FFF8F3",
  surface: "rgba(255, 255, 255, 0.78)",
  surfaceStrong: "#FFFDFB",
  border: "rgba(232, 196, 180, 0.5)",
  textPrimary: "#5E4A42",
  textSecondary: "#8A746B",
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
  "min-h-11 rounded-2xl border px-4 py-2.5 text-[15px] font-medium tracking-[0.01em] shadow-[0_2px_8px_rgba(188,149,129,0.08)] transition-all duration-150 ease-out hover:-translate-y-[1px] hover:brightness-[1.03] active:translate-y-0 active:brightness-95 sm:px-5 sm:text-[16px]";

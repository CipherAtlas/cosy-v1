import type { AppLanguage } from "@/config/translations";
export type PanelId = "focus" | "music" | "breathe" | "mood" | "gratitude" | "compliment" | "reader" | "books" | "pdf";
type AppTheme = "light" | "dark";

type MenuItem = {
  id: PanelId;
  label: string;
  tint: string;
};

type FeatureMenuProps = {
  items: MenuItem[];
  activePanel: PanelId;
  onSelect: (panel: PanelId) => void;
  language: AppLanguage;
  onLanguageChange: (language: AppLanguage) => void;
  brandLabel: string;
  navAriaLabel: string;
  languageLabel: string;
  languageAriaLabel: string;
  themeLabel: string;
  themeAriaLabel: string;
  englishLabel: string;
  japaneseLabel: string;
  lightLabel: string;
  darkLabel: string;
  theme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  className?: string;
};

export const FeatureMenu = ({
  items,
  activePanel,
  onSelect,
  language,
  onLanguageChange,
  brandLabel,
  navAriaLabel,
  languageLabel,
  languageAriaLabel,
  themeLabel,
  themeAriaLabel,
  englishLabel,
  japaneseLabel,
  lightLabel,
  darkLabel,
  theme,
  onThemeChange,
  className
}: FeatureMenuProps) => {
  const isDark = theme === "dark";
  const borderColor = isDark ? "rgba(255, 226, 179, 0.28)" : "rgba(232, 196, 180, 0.45)";
  const surface = isDark ? "rgba(38, 31, 28, 0.88)" : "rgba(255, 255, 255, 0.72)";
  const innerSurface = isDark ? "rgba(51, 43, 39, 0.9)" : "rgba(255, 253, 251, 0.85)";
  const textPrimary = isDark ? "#F2E7D1" : "#5E4A42";
  const textSecondary = isDark ? "rgba(242, 231, 209, 0.68)" : "#8A746B";

  return (
    <aside
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-[2rem] border p-4 sm:p-5 md:p-5 ${className ?? ""}`}
      style={{
        borderColor,
        background: surface
      }}
    >
      <p className="text-[12px] uppercase tracking-[0.16em] md:text-[10px]" style={{ color: textSecondary }}>
        {brandLabel}
      </p>

      <nav className="mt-4 flex min-h-0 flex-col gap-2 sm:mt-5 md:mt-4 md:gap-1.5" aria-label={navAriaLabel}>
        {items.map((item) => {
          const isActive = item.id === activePanel;
          const inactiveTint = `${item.tint}${isDark ? "2B" : "30"}`;
          const activeTint = `${item.tint}${isDark ? "8C" : "C0"}`;
          const itemBorderColor = isActive
            ? isDark
              ? "rgba(255, 226, 179, 0.68)"
              : "rgba(232, 196, 180, 0.88)"
            : isDark
              ? "rgba(255, 226, 179, 0.28)"
              : "rgba(232, 196, 180, 0.45)";

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className="cozy-outline min-h-11 w-full rounded-full border px-4 py-2.5 text-left text-[16px] font-medium tracking-[0.01em] transition-colors duration-200 sm:px-5 sm:text-[17px] md:min-h-9 md:px-4 md:py-1.5 md:text-[14px]"
              style={{
                borderColor: itemBorderColor,
                color: textPrimary,
                background: isActive ? activeTint : `linear-gradient(120deg, ${inactiveTint} 0%, ${innerSurface} 100%)`,
                boxShadow: isActive
                  ? isDark
                    ? "0 4px 12px rgba(10, 8, 8, 0.26)"
                    : "0 4px 10px rgba(188, 149, 129, 0.12)"
                  : "none"
              }}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-3 md:mt-auto">
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-2">
        <div className="min-w-0">
          <p className="text-[12px] font-medium uppercase tracking-[0.12em] md:text-[10px]" style={{ color: textSecondary }}>
            {languageLabel}
          </p>
          <div
            className="mt-1.5 flex w-full rounded-full border p-1"
            style={{
              borderColor,
              background: innerSurface
            }}
            role="group"
            aria-label={languageAriaLabel}
          >
            {(
              [
                { id: "en", label: englishLabel },
                { id: "ja", label: japaneseLabel }
              ] as const
            ).map((item) => {
              const isActive = language === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onLanguageChange(item.id)}
                  className="cozy-outline min-h-11 flex-1 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8A183] md:min-h-8 md:px-2 md:py-1 md:text-[11px]"
                  style={{
                    color: textPrimary,
                    background: isActive ? "rgba(246, 199, 184, 0.72)" : "transparent",
                    border: isActive ? "1px solid rgba(232, 196, 180, 0.72)" : "1px solid transparent"
                  }}
                  aria-pressed={isActive}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-[12px] font-medium uppercase tracking-[0.12em] md:text-[10px]" style={{ color: textSecondary }}>
            {themeLabel}
          </p>
          <div
            className="mt-1.5 flex w-full rounded-full border p-1"
            style={{
              borderColor,
              background: innerSurface
            }}
            role="group"
            aria-label={themeAriaLabel}
          >
            {(
              [
                { id: "light" as const, label: lightLabel },
                { id: "dark" as const, label: darkLabel }
              ] as const
            ).map((item) => {
              const isActive = theme === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onThemeChange(item.id)}
                  className="cozy-outline min-h-11 flex-1 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8A183] md:min-h-8 md:px-2 md:py-1 md:text-[11px]"
                  style={{
                    color: textPrimary,
                    background: isActive ? "rgba(220, 207, 246, 0.74)" : "transparent",
                    border: isActive ? "1px solid rgba(232, 196, 180, 0.72)" : "1px solid transparent"
                  }}
                  aria-pressed={isActive}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
        </div>
      </div>
    </aside>
  );
};

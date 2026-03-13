import type { AppLanguage } from "@/config/translations";
export type PanelId = "focus" | "music" | "breathe" | "mood" | "gratitude" | "compliment";

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
  englishLabel: string;
  japaneseLabel: string;
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
  englishLabel,
  japaneseLabel,
  className
}: FeatureMenuProps) => {
  return (
    <aside
      className={`rounded-[2rem] border p-4 sm:p-5 md:flex md:h-full md:min-h-0 md:flex-col md:p-7 ${className ?? ""}`}
      style={{
        borderColor: "rgba(232, 196, 180, 0.45)",
        background: "rgba(255, 255, 255, 0.72)"
      }}
    >
      <p className="text-[13px] uppercase tracking-[0.18em]" style={{ color: "#8A746B" }}>
        {brandLabel}
      </p>

      <nav className="mt-5 flex flex-col gap-2.5 md:mt-8 md:flex-1" aria-label={navAriaLabel}>
        {items.map((item) => {
          const isActive = item.id === activePanel;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className="min-h-11 rounded-full border px-5 py-3 text-left text-[17px] font-medium tracking-[0.01em] transition-colors duration-200 md:w-full"
              style={{
                borderColor: isActive ? "rgba(232, 196, 180, 0.8)" : "rgba(232, 196, 180, 0.45)",
                color: "#5E4A42",
                background: isActive
                  ? `${item.tint}B8`
                  : "rgba(255, 253, 251, 0.86)"
              }}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-5 md:mt-auto">
        <p className="text-[12px] font-medium uppercase tracking-[0.12em]" style={{ color: "#8A746B" }}>
          {languageLabel}
        </p>
        <div
          className="mt-2 inline-flex rounded-full border p-1"
          style={{
            borderColor: "rgba(232, 196, 180, 0.5)",
            background: "rgba(255, 253, 251, 0.85)"
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
                className="min-h-11 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8A183]"
                style={{
                  color: "#5E4A42",
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
    </aside>
  );
};

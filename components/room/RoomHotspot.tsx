import { CSSProperties } from "react";

type RoomHotspotProps = {
  label: string;
  style: CSSProperties;
  isActive: boolean;
  onClick: () => void;
};

const UI_BACKGROUND = "rgba(255, 230, 200, 0.15)";
const UI_BORDER = "rgba(255, 210, 160, 0.30)";
const UI_TEXT = "#ffe8c6";
const UI_ACCENT = "#ffd48a";

export const RoomHotspot = ({ label, style, isActive, onClick }: RoomHotspotProps) => {
  return (
    <button
      type="button"
      style={style}
      onClick={onClick}
      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-0 py-0 transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffd48a]"
      aria-label={`Open ${label} panel`}
    >
      <span
        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium tracking-wide backdrop-blur-[3px] transition-all duration-200"
        style={{
          background: isActive ? "rgba(255, 230, 200, 0.22)" : UI_BACKGROUND,
          borderColor: isActive ? "rgba(255, 210, 160, 0.46)" : UI_BORDER,
          color: UI_TEXT,
          boxShadow: isActive
            ? "0 4px 18px rgba(34, 19, 10, 0.2)"
            : "0 2px 10px rgba(34, 19, 10, 0.16)"
        }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: UI_ACCENT }} />
        <span>{label}</span>
      </span>
    </button>
  );
};

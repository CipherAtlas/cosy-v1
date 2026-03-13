"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RoomHotspot } from "@/components/room/RoomHotspot";
import { withBasePath } from "@/lib/basePath";

type HotspotId = "mood" | "music" | "focus" | "breathe" | "gratitude" | "compliment";

const UI_BACKGROUND = "rgba(255, 230, 200, 0.15)";
const UI_BORDER = "rgba(255, 210, 160, 0.30)";
const UI_TEXT = "#ffe8c6";
const UI_ACCENT = "#ffd48a";

const HOTSPOTS: {
  id: HotspotId;
  label: string;
  style: { top: string; left: string };
  panelHint: string;
}[] = [
  { id: "mood", label: "Mood", style: { top: "32%", left: "77%" }, panelHint: "Window corner" },
  { id: "music", label: "Music", style: { top: "55%", left: "40%" }, panelHint: "Monitor + speakers" },
  { id: "focus", label: "Focus", style: { top: "74%", left: "35%" }, panelHint: "Desk chair area" },
  { id: "breathe", label: "Breathe", style: { top: "55%", left: "20%" }, panelHint: "Desk lamp" },
  { id: "gratitude", label: "Gratitude", style: { top: "59%", left: "53%" }, panelHint: "Notebook on desk" },
  { id: "compliment", label: "Compliment", style: { top: "42%", left: "59%" }, panelHint: "Shelf notes" }
] as const;

export const RoomScene = () => {
  const [roomImageSrc, setRoomImageSrc] = useState(withBasePath("/assets/anime-room/room-base.svg"));
  const [activeHotspotId, setActiveHotspotId] = useState<HotspotId | null>(null);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  const activeHotspot = HOTSPOTS.find((hotspot) => hotspot.id === activeHotspotId) ?? null;

  return (
    <section className="fixed inset-0 overflow-hidden bg-[#141110]">
      <div className="flex h-full w-full items-center justify-center">
        <div
          className="relative overflow-hidden"
          style={{
            width: "min(100vw, calc(100dvh * 1.5))",
            aspectRatio: "1536 / 1024"
          }}
        >
          <img
            src={roomImageSrc}
            alt="Anime-style peaceful room"
            className="absolute inset-0 h-full w-full object-contain"
            onError={() => setRoomImageSrc(withBasePath("/assets/anime-room/room-base-extracted.png"))}
          />

          <div className="absolute inset-0">
            {HOTSPOTS.map((hotspot) => (
              <RoomHotspot
                key={hotspot.id}
                label={hotspot.label}
                style={hotspot.style}
                isActive={hotspot.id === activeHotspotId}
                onClick={() =>
                  setActiveHotspotId((current) => (current === hotspot.id ? null : hotspot.id))
                }
              />
            ))}
          </div>

          <AnimatePresence>
            {activeHotspot ? (
              <motion.aside
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="absolute bottom-4 left-1/2 w-[min(560px,calc(100%-1.25rem))] -translate-x-1/2 rounded-2xl border px-4 py-3 backdrop-blur-[4px]"
                style={{
                  background: UI_BACKGROUND,
                  borderColor: UI_BORDER,
                  color: UI_TEXT,
                  boxShadow: "0 8px 24px rgba(34, 19, 10, 0.17)"
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: UI_ACCENT }}>
                      {activeHotspot.panelHint}
                    </p>
                    <h2 className="mt-1 text-[13px] font-medium tracking-wide">
                      {activeHotspot.label} space
                    </h2>
                    <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "rgba(255, 232, 198, 0.86)" }}>
                      This panel is a lightweight preview layer. Route wiring can attach here without
                      interrupting the room atmosphere.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveHotspotId(null)}
                    className="rounded-full border px-2.5 py-1 text-[11px] transition-colors duration-200"
                    style={{
                      borderColor: UI_BORDER,
                      color: UI_TEXT,
                      background: "rgba(255, 230, 200, 0.10)"
                    }}
                    aria-label="Close hotspot panel"
                  >
                    Close
                  </button>
                </div>
              </motion.aside>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

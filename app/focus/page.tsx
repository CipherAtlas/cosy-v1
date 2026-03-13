"use client";

import { useEffect, useMemo, useState } from "react";
import { FeatureFrame } from "@/components/ui/FeatureFrame";
import { usePomodoro } from "@/features/focus/usePomodoro";
import { readLocalStorage, writeLocalStorage } from "@/lib/storage";

const SETTINGS_KEY = "peaceful-room-focus-settings";

type FocusSettings = {
  focusMinutes: number;
  breakMinutes: number;
};

const DEFAULT_SETTINGS: FocusSettings = {
  focusMinutes: 25,
  breakMinutes: 5
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

export default function FocusPage() {
  const [settings, setSettings] = useState<FocusSettings>(DEFAULT_SETTINGS);
  const { mode, isRunning, remainingSeconds, start, pause, reset } = usePomodoro(settings);

  useEffect(() => {
    const stored = readLocalStorage<FocusSettings>(SETTINGS_KEY, DEFAULT_SETTINGS);
    setSettings(stored);
  }, []);

  useEffect(() => {
    writeLocalStorage(SETTINGS_KEY, settings);
  }, [settings]);

  const modeLabel = useMemo(() => (mode === "focus" ? "Focus" : "Break"), [mode]);

  const applyPreset = (focusMinutes: number, breakMinutes: number) => {
    setSettings({ focusMinutes, breakMinutes });
  };

  return (
    <FeatureFrame
      title="Focus"
      subtitle="A quiet timer with gentle pacing."
      atmosphereClassName="bg-[radial-gradient(circle_at_28%_25%,rgba(235,185,133,0.14),transparent_40%),radial-gradient(circle_at_70%_80%,rgba(132,152,172,0.12),transparent_48%)]"
    >
      <div className="space-y-7">
        <div className="flex flex-wrap gap-2">
          <button className="control text-sm" type="button" onClick={() => applyPreset(25, 5)}>
            25 / 5
          </button>
          <button className="control text-sm" type="button" onClick={() => applyPreset(50, 10)}>
            50 / 10
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-room-muted">
            Focus minutes
            <input
              type="number"
              min={1}
              max={180}
              value={settings.focusMinutes}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, focusMinutes: Number(event.target.value) || prev.focusMinutes }))
              }
              className="w-full rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-room-text"
            />
          </label>

          <label className="space-y-2 text-sm text-room-muted">
            Break minutes
            <input
              type="number"
              min={1}
              max={60}
              value={settings.breakMinutes}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, breakMinutes: Number(event.target.value) || prev.breakMinutes }))
              }
              className="w-full rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-room-text"
            />
          </label>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-room-muted">{modeLabel}</p>
          <p className="mt-2 text-[clamp(2rem,8vw,4.5rem)] font-extralight tracking-widest text-room-text">
            {formatTime(remainingSeconds)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isRunning ? (
            <button type="button" className="control text-sm" onClick={start}>
              Start
            </button>
          ) : (
            <button type="button" className="control text-sm" onClick={pause}>
              Pause
            </button>
          )}
          <button type="button" className="control text-sm" onClick={reset}>
            Reset
          </button>
          <button type="button" className="control text-sm" aria-label="Ambience selector placeholder">
            Ambience: Soft Room
          </button>
        </div>
      </div>
    </FeatureFrame>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import compliments from "@/data/compliments.json";
import complimentsJa from "@/data/complimentsJa.json";
import { AppLanguage, TRANSLATIONS } from "@/config/translations";
import { BREATHING_PATTERNS, BreathingPattern, useBreathingCycle } from "@/features/breathe/useBreathingCycle";
import { dailyIndex, nextRandomIndex } from "@/features/compliment/rotation";
import { usePomodoro } from "@/features/focus/usePomodoro";
import { GratitudeEntry, deleteGratitudeEntry, readGratitudeEntries, saveGratitudeEntry } from "@/features/gratitude/storage";
import { getSharedMusicEngine } from "@/features/music/musicEngineInstance";
import { MixLayer, MixState, TrackInfo, VibeId } from "@/features/music/types";
import { MoodId, MoodSuggestion } from "@/features/mood/types";
import { readLocalStorage, writeLocalStorage } from "@/lib/storage";
import { FeatureMenu, PanelId } from "@/components/home/FeatureMenu";
import { GoldenDust } from "@/components/home/GoldenDust";

const PANEL_TINTS: Record<PanelId, string> = {
  focus: "#F6C7B8",
  music: "#DCCFF6",
  breathe: "#D8F0E4",
  mood: "#CFE5FF",
  gratitude: "#F2C6D8",
  compliment: "#F7E7A8"
};

const SETTINGS_KEY = "peaceful-room-focus-settings";
const INTENTION_KEY = "peaceful-room-focus-intention";
const LANGUAGE_KEY = "peaceful-room-language";
const DEFAULT_SETTINGS = { focusMinutes: 25, breakMinutes: 5 };
const FOCUS_PRESETS = [
  { id: "light", detail: "25 / 5", focusMinutes: 25, breakMinutes: 5 },
  { id: "deep", detail: "50 / 10", focusMinutes: 50, breakMinutes: 10 }
] as const;
const MOODS: MoodId[] = ["stressed", "tired", "restless", "lonely", "overwhelmed", "okay", "peaceful"];

const HREF_TO_PANEL: Record<MoodSuggestion["href"], PanelId> = {
  "/focus": "focus",
  "/music": "music",
  "/breathe": "breathe",
  "/gratitude": "gratitude",
  "/compliment": "compliment"
};

const COLOR_THEME = {
  background: "#FFF8F3",
  surface: "rgba(255, 255, 255, 0.72)",
  surfaceStrong: "#FFFDFB",
  border: "rgba(232, 196, 180, 0.45)",
  textPrimary: "#5E4A42",
  textSecondary: "#8A746B",
  accentPeach: "#F6C7B8",
  accentPink: "#F2C6D8",
  accentLavender: "#DCCFF6",
  accentBlue: "#CFE5FF",
  accentMint: "#D8F0E4",
  accentButter: "#F7E7A8"
};

const VIBE_ITEMS: { id: VibeId; tint: string }[] = [
  { id: "lofi", tint: COLOR_THEME.accentPeach },
  { id: "piano", tint: COLOR_THEME.accentLavender },
  { id: "jazz", tint: COLOR_THEME.accentBlue }
];

const MIX_GROUPS: {
  title: "global" | "music" | "atmosphere";
  items: { layer: MixLayer }[];
}[] = [
  {
    title: "global",
    items: [
      { layer: "master" },
      { layer: "outputBoost" }
    ]
  },
  {
    title: "music",
    items: [
      { layer: "chords" },
      { layer: "melody" },
      { layer: "bass" },
      { layer: "drums" }
    ]
  },
  {
    title: "atmosphere",
    items: [
      { layer: "rain" },
      { layer: "vinyl" }
    ]
  }
];

const PANEL_STYLE = {
  background: COLOR_THEME.surfaceStrong,
  borderColor: COLOR_THEME.border,
  color: COLOR_THEME.textPrimary,
  boxShadow: "0 10px 30px rgba(188, 149, 129, 0.08)"
};

const SURFACE_STYLE = {
  background: COLOR_THEME.surface,
  borderColor: COLOR_THEME.border
};

const MUTED_COLOR = COLOR_THEME.textSecondary;

const createSoftControlStyle = (tint: string) => ({
  borderColor: COLOR_THEME.border,
  color: COLOR_THEME.textPrimary,
  background: `${tint}26`
});

const createActiveControlStyle = (tint: string) => ({
  borderColor: "rgba(232, 196, 180, 0.86)",
  color: COLOR_THEME.textPrimary,
  background: `${tint}9E`
});

const controlClassName =
  "min-h-11 rounded-2xl border px-4 py-2.5 text-[15px] font-medium tracking-[0.01em] shadow-[0_2px_8px_rgba(188,149,129,0.08)] transition-all duration-150 ease-out hover:-translate-y-[1px] hover:brightness-[1.03] active:translate-y-0 active:brightness-95 sm:px-6 sm:py-3.5 sm:text-[16px]";

const inputClassName =
  "mt-1.5 min-h-11 w-full rounded-2xl border bg-transparent px-4 py-3 text-[15px] font-medium outline-none transition-colors sm:text-[16px]";

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");

  return `${mins}:${secs}`;
};

const formatDate = (iso: string, language: AppLanguage) =>
  new Date(iso).toLocaleDateString(language === "ja" ? "ja-JP" : undefined, {
    month: "short",
    day: "numeric"
  });

type PanelShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  contentClassName?: string;
};

const PanelShell = ({ title, subtitle, children, contentClassName }: PanelShellProps) => (
  <div className="flex h-full min-h-0 flex-col rounded-[2rem] border p-4 sm:rounded-[2.2rem] sm:p-7 lg:p-10" style={PANEL_STYLE}>
    <header>
      <h1 className="text-[clamp(1.75rem,6vw,3rem)] font-medium tracking-[0.01em]" style={{ color: COLOR_THEME.textPrimary }}>
        {title}
      </h1>
      <p className="mt-2 text-[15px] font-normal sm:text-[17px]" style={{ color: MUTED_COLOR }}>
        {subtitle}
      </p>
    </header>

    <div className={contentClassName ?? "mt-5 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-px pr-0 sm:mt-8 sm:pl-px sm:pr-1"}>{children}</div>
  </div>
);

type FocusPanelProps = {
  language: AppLanguage;
  onFocusModeChange?: (isActive: boolean) => void;
};

const FocusPanel = ({ language, onFocusModeChange }: FocusPanelProps) => {
  const t = TRANSLATIONS[language];
  const completionLines = useMemo(() => t.focus.completionLines, [t.focus.completionLines]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [intention, setIntention] = useState("");
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [completionNotice, setCompletionNotice] = useState<{ line: string; minutes: number } | null>(null);
  const { mode, isRunning, remainingSeconds, start, pause, reset } = usePomodoro(settings);
  const previousModeRef = useRef(mode);
  const [engine, setEngine] = useState<ReturnType<typeof getSharedMusicEngine> | null>(null);
  const [musicInfo, setMusicInfo] = useState<TrackInfo>({ vibe: "lofi", key: "—", tempo: 0, section: "intro" });
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [rainEnabled, setRainEnabled] = useState(false);
  const [vinylEnabled, setVinylEnabled] = useState(false);
  const softControlStyle = createSoftControlStyle(COLOR_THEME.accentPeach);
  const activeControlStyle = createActiveControlStyle(COLOR_THEME.accentPeach);
  const musicSoftStyle = createSoftControlStyle(COLOR_THEME.accentLavender);
  const focusControlClassName = `${controlClassName} px-4 sm:px-5`;
  const modeTint = mode === "focus" ? COLOR_THEME.accentPeach : COLOR_THEME.accentBlue;
  const presetId =
    settings.focusMinutes === 25 && settings.breakMinutes === 5 ? "light" : settings.focusMinutes === 50 && settings.breakMinutes === 10 ? "deep" : "custom";
  const modeLabel = mode === "focus" ? t.focus.focusSession : t.focus.breakSession;
  const statusLine = isRunning
    ? mode === "focus"
      ? t.focus.statusFocus
      : t.focus.statusBreak
    : t.focus.statusIdle;

  useEffect(() => {
    onFocusModeChange?.(isFocusMode);
  }, [isFocusMode, onFocusModeChange]);

  useEffect(() => {
    return () => {
      onFocusModeChange?.(false);
    };
  }, [onFocusModeChange]);

  useEffect(() => {
    setSettings(readLocalStorage(SETTINGS_KEY, DEFAULT_SETTINGS));
    setIntention(readLocalStorage<string>(INTENTION_KEY, ""));
  }, []);

  useEffect(() => {
    const shared = getSharedMusicEngine();
    setEngine(shared);
    setMusicInfo(shared.getTrackInfo());
    setMusicPlaying(shared.isPlaying());
    setRainEnabled(shared.isRainEnabled());
    setVinylEnabled(shared.isVinylEnabled());

    return shared.subscribe((nextInfo) => {
      setMusicInfo(nextInfo);
    });
  }, []);

  useEffect(() => {
    writeLocalStorage(SETTINGS_KEY, settings);
  }, [settings]);

  useEffect(() => {
    writeLocalStorage(INTENTION_KEY, intention);
  }, [intention]);

  useEffect(() => {
    const previousMode = previousModeRef.current;

    if (previousMode === "focus" && mode === "break" && isRunning) {
      const line = completionLines[Math.floor(Math.random() * completionLines.length)];
      setCompletionNotice({ line, minutes: settings.focusMinutes });
    }

    previousModeRef.current = mode;
  }, [completionLines, isRunning, mode, settings.focusMinutes]);

  const updateMinutes = (field: "focusMinutes" | "breakMinutes", value: string) => {
    const next = Number(value);
    if (!Number.isFinite(next) || next < 1) {
      return;
    }

    setSettings((previous) => ({ ...previous, [field]: Math.floor(next) }));
  };

  const applyPreset = (focusMinutes: number, breakMinutes: number) => {
    setSettings({ focusMinutes, breakMinutes });
  };

  const toggleMusicPlayback = async () => {
    if (!engine) {
      return;
    }

    if (musicPlaying) {
      engine.pause();
      setMusicPlaying(false);
      return;
    }

    try {
      await engine.start();
      setMusicPlaying(true);
    } catch {
      setMusicPlaying(engine.isPlaying());
    }
  };

  const primeAudio = () => {
    if (!engine) {
      return;
    }

    void engine.prepareAudio();
  };

  const toggleRain = () => {
    if (!engine) {
      return;
    }

    const next = !rainEnabled;
    setRainEnabled(next);
    engine.setRain(next);
  };

  const toggleVinyl = () => {
    if (!engine) {
      return;
    }

    const next = !vinylEnabled;
    setVinylEnabled(next);
    engine.setVinyl(next);
  };

  const setVibe = (nextVibe: VibeId) => {
    if (!engine) {
      return;
    }

    engine.setVibe(nextVibe);
    setMusicInfo(engine.getTrackInfo());
    setRainEnabled(engine.isRainEnabled());
    setVinylEnabled(engine.isVinylEnabled());
  };

  const nextTrack = () => {
    if (!engine) {
      return;
    }

    engine.generateNewTrack();
    setMusicInfo(engine.getTrackInfo());
  };

  const dismissCompletion = () => {
    setCompletionNotice(null);
  };

  const enterFocusMode = () => {
    setIsFocusMode(true);
  };

  const exitFocusMode = () => {
    setIsFocusMode(false);
  };

  const startBreakFromCompletion = () => {
    start();
    setCompletionNotice(null);
  };

  const continueFocusing = () => {
    reset();
    start();
    setCompletionNotice(null);
  };

  const completionCard = completionNotice ? (
    <motion.div
      className="rounded-[1.5rem] border p-4"
      style={{
        borderColor: COLOR_THEME.border,
        background: `linear-gradient(135deg, ${COLOR_THEME.accentMint}44 0%, ${COLOR_THEME.accentButter}3D 100%)`
      }}
      initial={{ opacity: 0, y: 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[14px] font-medium uppercase tracking-[0.12em]" style={{ color: MUTED_COLOR }}>
            {t.focus.completionTitle}
          </p>
          <p className="mt-2 text-[18px] font-medium" style={{ color: COLOR_THEME.textPrimary }}>
            {completionNotice.line}
          </p>
          <p className="mt-1 text-[14px] font-medium" style={{ color: MUTED_COLOR }}>
            {t.focus.completionMinutes.replace("{minutes}", String(completionNotice.minutes))}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={focusControlClassName} style={activeControlStyle} onClick={startBreakFromCompletion}>
          {t.focus.startBreak}
        </button>
        <button type="button" className={focusControlClassName} style={softControlStyle} onClick={continueFocusing}>
          {t.focus.continueFocusing}
        </button>
        <button type="button" className={focusControlClassName} style={softControlStyle} onClick={dismissCompletion}>
          {t.focus.dismiss}
        </button>
      </div>
    </motion.div>
  ) : null;

  return (
    <PanelShell
      title={t.focus.title}
      subtitle={isFocusMode ? t.focus.subtitleFocusMode : t.focus.subtitle}
      contentClassName="mt-5 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-px pr-0 sm:pl-px sm:pr-1 lg:overflow-hidden"
    >
      {isFocusMode ? (
        <div className="flex h-full min-h-0 flex-col justify-between gap-3 overflow-y-auto rounded-[1.8rem] border p-4 sm:rounded-[2rem] sm:p-6 lg:overflow-hidden lg:p-8" style={{ ...SURFACE_STYLE, background: `${modeTint}30` }}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-medium uppercase tracking-[0.12em]" style={{ color: MUTED_COLOR }}>
              {t.focus.modeLabel}
            </p>
            <button type="button" className={focusControlClassName} style={softControlStyle} onClick={exitFocusMode}>
              {t.focus.exit}
            </button>
          </div>

          <div className="grid place-items-center py-2 sm:py-4">
            <motion.div
              className="relative w-full max-w-[640px] overflow-hidden rounded-[1.8rem] border px-4 py-7 text-center sm:rounded-[2.2rem] sm:px-6 sm:py-10"
              style={{ borderColor: COLOR_THEME.border, background: `${modeTint}44` }}
              animate={{ scale: isRunning ? 1.015 : 1 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              {isRunning ? (
                <motion.div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: `radial-gradient(circle at 50% 48%, ${modeTint}66 0%, ${modeTint}2B 36%, transparent 74%)`
                  }}
                  animate={{ opacity: [0.28, 0.52, 0.28], scale: [0.97, 1.02, 0.97] }}
                  transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
                />
              ) : null}
              <div className="relative">
                <p className="text-[13px] uppercase tracking-[0.14em]" style={{ color: MUTED_COLOR }}>
                  {modeLabel}
                </p>
                <p className="mt-4 text-[clamp(3.1rem,16vw,7rem)] font-medium leading-none tracking-[0.08em]" style={{ color: COLOR_THEME.textPrimary }}>
                  {formatTime(remainingSeconds)}
                </p>
                <p className="mt-4 text-[16px] font-medium" style={{ color: MUTED_COLOR }}>
                  {statusLine}
                </p>
              </div>
            </motion.div>
          </div>

          {completionCard}

          <div className="space-y-3 sm:space-y-4">
            <div className="flex flex-wrap justify-center gap-2.5">
                {isRunning ? (
                  <button type="button" className={focusControlClassName} style={activeControlStyle} onClick={pause}>
                    {t.common.pause}
                  </button>
                ) : (
                  <button type="button" className={focusControlClassName} style={activeControlStyle} onClick={start}>
                    {t.common.start}
                  </button>
                )}
                <button type="button" className={focusControlClassName} style={softControlStyle} onClick={reset}>
                  {t.common.reset}
                </button>
              </div>

            <div className="rounded-[1.5rem] border p-4" style={{ ...SURFACE_STYLE, background: `${COLOR_THEME.accentLavender}2A` }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  className={focusControlClassName}
                  style={musicSoftStyle}
                  onPointerDown={primeAudio}
                  onTouchStart={primeAudio}
                  onMouseDown={primeAudio}
                  onKeyDown={primeAudio}
                  onClick={toggleMusicPlayback}
                >
                  {musicPlaying ? t.focus.pauseMusic : t.focus.playMusic}
                </button>
                <div className="flex flex-wrap gap-2">
                  {VIBE_ITEMS.map((item) => (
                    <button
                      key={`focus-mode-${item.id}`}
                      type="button"
                      className={focusControlClassName}
                      style={musicInfo.vibe === item.id ? createActiveControlStyle(item.tint) : createSoftControlStyle(item.tint)}
                      onClick={() => setVibe(item.id)}
                    >
                      {t.vibes[item.id]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 gap-3 sm:gap-4 lg:h-full lg:grid-cols-[1.2fr_1fr]">
          <div className="flex min-h-0 flex-col gap-3 sm:gap-4">
            <motion.div
              className="order-1 relative flex min-h-0 flex-col justify-between overflow-hidden rounded-[1.8rem] border px-4 py-6 text-center sm:rounded-[2rem] sm:px-6 sm:py-7 lg:min-h-0 lg:flex-1"
              style={{ borderColor: COLOR_THEME.border, background: `${modeTint}3D` }}
              animate={{ scale: isRunning ? 1.01 : 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {isRunning ? (
                <motion.div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: `radial-gradient(circle at 50% 44%, ${modeTint}57 0%, ${modeTint}26 34%, transparent 74%)`
                  }}
                  animate={{ opacity: [0.24, 0.46, 0.24], scale: [0.985, 1.015, 0.985] }}
                  transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
                />
              ) : null}
              <div className="relative">
                <p className="text-[13px] uppercase tracking-[0.14em]" style={{ color: MUTED_COLOR }}>
                  {modeLabel}
                </p>
                <p className="mt-4 text-[clamp(2.9rem,15vw,5.4rem)] font-medium leading-none tracking-[0.08em]" style={{ color: COLOR_THEME.textPrimary }}>
                  {formatTime(remainingSeconds)}
                </p>
                <p className="mt-3 text-[15px] font-medium sm:text-[16px]" style={{ color: MUTED_COLOR }}>
                  {statusLine}
                </p>
              </div>

              <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                {isRunning ? (
                  <button type="button" className={focusControlClassName} style={activeControlStyle} onClick={pause}>
                    {t.common.pause}
                  </button>
                ) : (
                  <button type="button" className={focusControlClassName} style={activeControlStyle} onClick={start}>
                    {t.common.start}
                  </button>
                )}
                <button type="button" className={focusControlClassName} style={softControlStyle} onClick={reset}>
                  {t.common.reset}
                </button>
                <button type="button" className={focusControlClassName} style={softControlStyle} onClick={enterFocusMode}>
                  {t.focus.focusModeButton}
                </button>
              </div>
            </motion.div>

            <div className="order-2 rounded-[1.8rem] border p-4 sm:p-5" style={{ ...SURFACE_STYLE, background: `${COLOR_THEME.accentPeach}20` }}>
              <p className="text-[13px] font-medium uppercase tracking-[0.12em]" style={{ color: MUTED_COLOR }}>
                {t.focus.sessionPresets}
              </p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {FOCUS_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={focusControlClassName}
                    style={presetId === preset.id ? activeControlStyle : softControlStyle}
                    onClick={() => applyPreset(preset.focusMinutes, preset.breakMinutes)}
                  >
                    {preset.id === "light" ? t.focus.lightPreset : t.focus.deepPreset} · {preset.detail}
                  </button>
                ))}
                <span
                  className={focusControlClassName}
                  style={presetId === "custom" ? activeControlStyle : softControlStyle}
                  aria-label={t.focus.customPresetAria}
                >
                  {t.common.custom}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-[13px] font-medium" style={{ color: MUTED_COLOR }}>
                  {t.focus.focusMinutes}
                  <input
                    className={inputClassName}
                    style={SURFACE_STYLE}
                    type="number"
                    min={1}
                    max={180}
                    value={settings.focusMinutes}
                    onChange={(event) => updateMinutes("focusMinutes", event.target.value)}
                  />
                </label>
                <label className="text-[13px] font-medium" style={{ color: MUTED_COLOR }}>
                  {t.focus.breakMinutes}
                  <input
                    className={inputClassName}
                    style={SURFACE_STYLE}
                    type="number"
                    min={1}
                    max={60}
                    value={settings.breakMinutes}
                    onChange={(event) => updateMinutes("breakMinutes", event.target.value)}
                  />
                </label>
              </div>

              <label className="mt-3 block text-[13px] font-medium" style={{ color: MUTED_COLOR }}>
                {t.focus.intentionLabel}
                <input
                  className={inputClassName}
                  style={SURFACE_STYLE}
                  value={intention}
                  onChange={(event) => setIntention(event.target.value)}
                  placeholder={t.focus.intentionPlaceholder}
                />
              </label>
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-3 sm:gap-4">
            <div className="rounded-[1.5rem] border p-4" style={{ ...SURFACE_STYLE, background: `${COLOR_THEME.accentBlue}1B` }}>
              <p className="text-[13px] font-medium uppercase tracking-[0.1em]" style={{ color: MUTED_COLOR }}>
                {t.focus.sessionStatusTitle}
              </p>
              <p className="mt-2 text-[16px] font-medium" style={{ color: COLOR_THEME.textPrimary }}>
                {statusLine}
              </p>
              {intention ? (
                <p className="mt-2 text-[14px] font-medium" style={{ color: MUTED_COLOR }}>
                  {t.focus.intentionPrefix}: {intention}
                </p>
              ) : null}
            </div>

            {completionCard}

            <div className="min-h-0 rounded-[1.7rem] border p-4 sm:p-5" style={{ ...SURFACE_STYLE, background: `${COLOR_THEME.accentLavender}26` }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] font-medium uppercase tracking-[0.1em]" style={{ color: MUTED_COLOR }}>
                  {t.focus.cozyAudio}
                </p>
                <p className="text-[13px] font-medium" style={{ color: MUTED_COLOR }}>
                  {t.focus.takeYourTime}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  className={focusControlClassName}
                  style={musicSoftStyle}
                  onPointerDown={primeAudio}
                  onTouchStart={primeAudio}
                  onMouseDown={primeAudio}
                  onKeyDown={primeAudio}
                  onClick={toggleMusicPlayback}
                >
                  {musicPlaying ? t.focus.pauseMusic : t.focus.playMusic}
                </button>
                <button type="button" className={focusControlClassName} style={musicSoftStyle} onClick={nextTrack}>
                  {t.focus.newTrack}
                </button>
                <button type="button" className={focusControlClassName} style={rainEnabled ? activeControlStyle : musicSoftStyle} onClick={toggleRain}>
                  {t.focus.rain} {rainEnabled ? t.common.on : t.common.off}
                </button>
                <button type="button" className={focusControlClassName} style={vinylEnabled ? activeControlStyle : musicSoftStyle} onClick={toggleVinyl}>
                  {t.focus.vinyl} {vinylEnabled ? t.common.on : t.common.off}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {VIBE_ITEMS.map((item) => (
                  <button
                    key={`focus-${item.id}`}
                    type="button"
                    className={focusControlClassName}
                    style={musicInfo.vibe === item.id ? createActiveControlStyle(item.tint) : createSoftControlStyle(item.tint)}
                    onClick={() => setVibe(item.id)}
                  >
                    {t.vibes[item.id]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </PanelShell>
  );
};

type MusicPanelProps = {
  language: AppLanguage;
};

const MusicPanel = ({ language }: MusicPanelProps) => {
  const t = TRANSLATIONS[language];
  const engine = useMemo(() => getSharedMusicEngine(), []);
  const [info, setInfo] = useState<TrackInfo>(() => engine.getTrackInfo());
  const [isPlaying, setIsPlaying] = useState(() => engine.isPlaying());
  const [rainEnabled, setRainEnabled] = useState(() => engine.isRainEnabled());
  const [vinylEnabled, setVinylEnabled] = useState(() => engine.isVinylEnabled());
  const [mix, setMix] = useState<MixState>(() => engine.getMixState());
  const [drumsAvailable, setDrumsAvailable] = useState(() => engine.isLayerAvailable("drums"));
  const softControlStyle = createSoftControlStyle(COLOR_THEME.accentLavender);
  const activeControlStyle = createActiveControlStyle(COLOR_THEME.accentLavender);

  useEffect(() => {
    return engine.subscribe((nextInfo) => {
      setInfo(nextInfo);
    });
  }, [engine]);

  const handlePlay = async () => {
    try {
      await engine.start();
      setIsPlaying(true);
    } catch {
      setIsPlaying(engine.isPlaying());
    }
  };

  const primeAudio = () => {
    void engine.prepareAudio();
  };

  const handlePause = () => {
    engine.pause();
    setIsPlaying(false);
  };

  const handleVibeChange = (nextVibe: VibeId) => {
    engine.setVibe(nextVibe);
    setInfo(engine.getTrackInfo());
    setMix(engine.getMixState());
    setRainEnabled(engine.isRainEnabled());
    setVinylEnabled(engine.isVinylEnabled());
    setDrumsAvailable(engine.isLayerAvailable("drums"));
  };

  const handleNewTrack = () => {
    engine.generateNewTrack();
    setInfo(engine.getTrackInfo());
  };

  const toggleRain = () => {
    const next = !rainEnabled;
    setRainEnabled(next);
    engine.setRain(next);
  };

  const toggleVinyl = () => {
    const next = !vinylEnabled;
    setVinylEnabled(next);
    engine.setVinyl(next);
  };

  const handleMixChange = (layer: MixLayer, rawValue: string) => {
    const next = Math.max(0, Math.min(1, Number(rawValue)));
    if (!Number.isFinite(next)) {
      return;
    }

    setMix((previous) => ({ ...previous, [layer]: next }));
    engine.setLayerVolume(layer, next);
  };

  const handleResetMix = () => {
    engine.resetMix();
    setMix(engine.getMixState());
    setRainEnabled(engine.isRainEnabled());
    setVinylEnabled(engine.isVinylEnabled());
    setDrumsAvailable(engine.isLayerAvailable("drums"));
  };

  const sectionLabel = t.sections[info.section] ?? info.section;
  const vibeLabel = t.vibes[info.vibe];

  return (
    <PanelShell title={t.music.title} subtitle={t.music.subtitle}>
      <div className="space-y-8">
        <div className="space-y-3">
          <p className="text-[13px] font-medium" style={{ color: MUTED_COLOR }}>
            {t.music.vibe}
          </p>
          <div className="flex flex-wrap gap-3">
            {VIBE_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={controlClassName}
                style={info.vibe === item.id ? createActiveControlStyle(item.tint) : createSoftControlStyle(item.tint)}
                onClick={() => handleVibeChange(item.id)}
              >
                {t.vibes[item.id]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {isPlaying ? (
            <button type="button" className={controlClassName} style={activeControlStyle} onClick={handlePause}>
              {t.music.pause}
            </button>
          ) : (
            <button
              type="button"
              className={controlClassName}
              style={activeControlStyle}
              onPointerDown={primeAudio}
              onTouchStart={primeAudio}
              onMouseDown={primeAudio}
              onKeyDown={primeAudio}
              onClick={handlePlay}
            >
              {t.music.play}
            </button>
          )}

          <button type="button" className={controlClassName} style={softControlStyle} onClick={handleNewTrack}>
            {t.music.newTrack}
          </button>

          <button type="button" className={controlClassName} style={rainEnabled ? activeControlStyle : softControlStyle} onClick={toggleRain}>
            {t.music.rain} {rainEnabled ? t.common.on : t.common.off}
          </button>

          <button type="button" className={controlClassName} style={vinylEnabled ? activeControlStyle : softControlStyle} onClick={toggleVinyl}>
            {t.music.vinyl} {vinylEnabled ? t.common.on : t.common.off}
          </button>
        </div>

        <div className="rounded-[1.6rem] border p-5" style={{ ...SURFACE_STYLE, background: `${COLOR_THEME.accentMint}1C` }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] font-medium uppercase tracking-[0.1em]" style={{ color: MUTED_COLOR }}>
              {t.music.mix}
            </p>

            <button type="button" className={controlClassName} style={softControlStyle} onClick={handleResetMix}>
              {t.music.resetMix}
            </button>
          </div>
          <p className="mt-2 text-[13px] font-medium" style={{ color: MUTED_COLOR }}>
            {t.music.mixHelp}
          </p>

          <div className="mt-4 space-y-5">
            {MIX_GROUPS.map((group) => (
              <div key={group.title} className="space-y-3">
                <p className="text-[12px] font-medium uppercase tracking-[0.11em]" style={{ color: MUTED_COLOR }}>
                  {t.music.groups[group.title]}
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  {group.items.map((item) => {
                    const isDisabled = item.layer === "drums" && !drumsAvailable;
                    const value = mix[item.layer];

                    return (
                      <label
                        key={item.layer}
                        className="rounded-xl border px-3 py-2"
                        style={{
                          borderColor: COLOR_THEME.border,
                          background: isDisabled ? "rgba(255,255,255,0.4)" : COLOR_THEME.surface
                        }}
                      >
                        <div className="mb-1.5 flex items-center justify-between text-[13px] font-medium">
                          <span style={{ color: COLOR_THEME.textPrimary }}>{t.music.layers[item.layer]}</span>
                          <span style={{ color: MUTED_COLOR }}>{Math.round(value * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={value}
                          onChange={(event) => handleMixChange(item.layer, event.target.value)}
                          disabled={isDisabled}
                          className="h-3 w-full cursor-pointer touch-pan-x"
                          style={{ accentColor: "#5E4A42", opacity: isDisabled ? 0.45 : 1 }}
                          aria-label={`${t.music.layers[item.layer]} ${t.common.volume}`}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.6rem] border p-5" style={{ ...SURFACE_STYLE, background: `${COLOR_THEME.accentLavender}22` }}>
          <p className="text-[13px] font-medium uppercase tracking-[0.1em]" style={{ color: MUTED_COLOR }}>
            {t.music.nowPlaying}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <p className="text-[16px] font-medium" style={{ color: COLOR_THEME.textPrimary }}>
              {t.music.vibeLabel}: {vibeLabel}
            </p>
            <p className="text-[16px] font-medium" style={{ color: COLOR_THEME.textPrimary }}>
              {t.music.keyLabel}: {info.key}
            </p>
            <p className="text-[16px] font-medium" style={{ color: COLOR_THEME.textPrimary }}>
              {t.music.tempoLabel}: {info.tempo} BPM
            </p>
            <p className="text-[16px] font-medium" style={{ color: COLOR_THEME.textPrimary }}>
              {t.music.sectionLabel}: {sectionLabel}
            </p>
            <p className="text-[16px] font-medium" style={{ color: COLOR_THEME.textPrimary }}>
              {t.music.rainLabel}: {rainEnabled ? t.common.active : t.common.off}
            </p>
            <p className="text-[16px] font-medium" style={{ color: COLOR_THEME.textPrimary }}>
              {t.music.vinylLabel}: {vinylEnabled ? t.common.active : t.common.off}
            </p>
          </div>
        </div>
      </div>
    </PanelShell>
  );
};

type BreathePanelProps = {
  language: AppLanguage;
};

const BreathePanel = ({ language }: BreathePanelProps) => {
  const t = TRANSLATIONS[language];
  const [pattern, setPattern] = useState<BreathingPattern>(BREATHING_PATTERNS[0]);
  const { phase, secondsLeft, isRunning, start, pause, reset } = useBreathingCycle(pattern);
  const phaseScale = isRunning ? (phase === "exhale" ? 0.9 : 1.05) : 1;
  const phaseDuration = phase === "inhale" ? pattern.inhale : phase === "hold" ? pattern.hold : phase === "holdOut" ? pattern.holdAfterExhale ?? 1 : pattern.exhale;
  const phaseLabel = t.breathe.phaseLabels[phase];
  const isAtStart = phase === "inhale" && secondsLeft === pattern.inhale;
  const softControlStyle = createSoftControlStyle(COLOR_THEME.accentMint);
  const activeControlStyle = createActiveControlStyle(COLOR_THEME.accentMint);

  return (
    <PanelShell title={t.breathe.title} subtitle={t.breathe.subtitle}>
      <div className="space-y-7">
        <div className="flex flex-wrap gap-3">
          {BREATHING_PATTERNS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={controlClassName}
              style={item.id === pattern.id ? activeControlStyle : softControlStyle}
              onClick={() => setPattern(item)}
            >
              {t.breathe.patterns[item.id]}
            </button>
          ))}
        </div>

        <div className="grid place-items-center py-3">
          <motion.div
            className="grid h-44 w-44 place-items-center rounded-full border sm:h-52 sm:w-52"
            style={{
              borderColor: COLOR_THEME.border,
              background: `${COLOR_THEME.accentMint}59`
            }}
            animate={{ scale: phaseScale }}
            transition={{ duration: isRunning ? phaseDuration : 0.25, ease: "easeInOut" }}
          >
            <div className="text-center">
              <p className="text-[12px] uppercase tracking-[0.16em]" style={{ color: MUTED_COLOR }}>
                {phaseLabel}
              </p>
              <p className="mt-2 text-[46px] font-medium tracking-[0.05em]" style={{ color: COLOR_THEME.textPrimary }}>
                {secondsLeft}
              </p>
            </div>
          </motion.div>
        </div>

        <div className="flex flex-wrap gap-3">
          {isRunning ? (
            <button type="button" className={controlClassName} style={activeControlStyle} onClick={pause}>
              {t.common.pause}
            </button>
          ) : (
            <button type="button" className={controlClassName} style={activeControlStyle} onClick={start}>
              {isAtStart ? t.common.start : t.common.resume}
            </button>
          )}
          <button type="button" className={controlClassName} style={softControlStyle} onClick={reset}>
            {t.common.reset}
          </button>
        </div>
      </div>
    </PanelShell>
  );
};

type MoodPanelProps = {
  language: AppLanguage;
  onOpenPanel: (panel: PanelId) => void;
};

const MoodPanel = ({ language, onOpenPanel }: MoodPanelProps) => {
  const t = TRANSLATIONS[language];
  const [selectedMood, setSelectedMood] = useState<MoodId | null>(null);
  const softControlStyle = createSoftControlStyle(COLOR_THEME.accentBlue);
  const activeControlStyle = createActiveControlStyle(COLOR_THEME.accentBlue);

  const suggestions = useMemo(() => {
    if (!selectedMood) {
      return [];
    }

    return t.mood.suggestions[selectedMood] ?? [];
  }, [selectedMood, t.mood.suggestions]);

  return (
    <PanelShell title={t.mood.title} subtitle={t.mood.subtitle}>
      <div className="space-y-7">
        <div className="flex flex-wrap gap-3">
          {MOODS.map((mood) => (
            <button
              key={mood}
              type="button"
              className={controlClassName}
              style={selectedMood === mood ? activeControlStyle : softControlStyle}
              onClick={() => setSelectedMood(mood)}
            >
              {t.mood.moods[mood]}
            </button>
          ))}
        </div>

        {selectedMood ? (
          <div className="space-y-3 rounded-[1.6rem] border p-5" style={SURFACE_STYLE}>
            <p className="text-[17px] font-medium" style={{ color: MUTED_COLOR }}>
              {t.mood.prompt}
            </p>

            {suggestions.map((item) => (
              <div
                key={`${selectedMood}-${item.text}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3"
                style={{
                  borderColor: COLOR_THEME.border,
                  background: `${COLOR_THEME.accentBlue}22`
                }}
              >
                <p className="text-[16px] font-normal leading-snug" style={{ color: COLOR_THEME.textPrimary }}>
                  {item.text}
                </p>

                <button
                  type="button"
                  className={controlClassName}
                  style={activeControlStyle}
                  onClick={() => onOpenPanel(HREF_TO_PANEL[item.href])}
                >
                  {t.common.open}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[17px] font-normal" style={{ color: MUTED_COLOR }}>
            {t.mood.emptyState}
          </p>
        )}
      </div>
    </PanelShell>
  );
};

type GratitudePanelProps = {
  language: AppLanguage;
};

const GratitudePanel = ({ language }: GratitudePanelProps) => {
  const t = TRANSLATIONS[language];
  const [value, setValue] = useState("");
  const [entries, setEntries] = useState<GratitudeEntry[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const activeControlStyle = createActiveControlStyle(COLOR_THEME.accentPink);

  useEffect(() => {
    setEntries(readGratitudeEntries());
  }, []);

  const onSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const next = value.trim();
    if (!next) {
      return;
    }

    setEntries(saveGratitudeEntry(next));
    setValue("");
  };

  const onDelete = (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }

    setEntries(deleteGratitudeEntry(id));
    setConfirmDeleteId(null);
  };

  return (
    <PanelShell title={t.gratitude.title} subtitle={t.gratitude.subtitle}>
      <div className="space-y-7">
        <form onSubmit={onSave} className="space-y-3 px-px">
          <label htmlFor="gratitude-text" className="sr-only">
            {t.gratitude.entryLabel}
          </label>
          <textarea
            id="gratitude-text"
            className="block min-h-32 w-full rounded-[1.4rem] border p-4 text-[16px] font-normal outline-none"
            style={{ ...SURFACE_STYLE, color: COLOR_THEME.textPrimary }}
            placeholder={t.gratitude.placeholder}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />

          <button type="submit" className={controlClassName} style={activeControlStyle}>
            {t.gratitude.save}
          </button>
        </form>

        <div className="space-y-3">
          <p className="text-[12px] uppercase tracking-[0.14em]" style={{ color: MUTED_COLOR }}>
            {t.gratitude.recentEntries}
          </p>

          {entries.length === 0 ? (
            <p className="text-[17px] font-normal" style={{ color: MUTED_COLOR }}>
              {t.gratitude.emptyState}
            </p>
          ) : (
            <ul className="space-y-3 px-px">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-2xl border px-4 py-3"
                  style={{
                    borderColor: COLOR_THEME.border,
                    background: `${COLOR_THEME.accentPink}1F`
                  }}
                >
                  <p className="text-[16px] font-normal" style={{ color: COLOR_THEME.textPrimary }}>
                    {entry.text}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-[12px]" style={{ color: MUTED_COLOR }}>
                      {formatDate(entry.createdAt, language)}
                    </p>
                    <div className="flex items-center gap-2">
                      {confirmDeleteId === entry.id ? (
                        <button
                          type="button"
                          className="min-h-11 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors"
                          style={{
                            borderColor: COLOR_THEME.border,
                            background: `${COLOR_THEME.accentPink}4A`,
                            color: COLOR_THEME.textPrimary
                          }}
                          onClick={() => onDelete(entry.id)}
                        >
                          {t.common.confirmDelete}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="min-h-11 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors"
                          style={{
                            borderColor: COLOR_THEME.border,
                            background: `${COLOR_THEME.accentPink}33`,
                            color: MUTED_COLOR
                          }}
                          onClick={() => onDelete(entry.id)}
                        >
                          {t.common.delete}
                        </button>
                      )}
                      {confirmDeleteId === entry.id ? (
                        <button
                          type="button"
                          className="min-h-11 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors"
                          style={{
                            borderColor: COLOR_THEME.border,
                            background: "rgba(255,255,255,0.55)",
                            color: MUTED_COLOR
                          }}
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          {t.common.cancel}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PanelShell>
  );
};

type ComplimentPanelProps = {
  language: AppLanguage;
};

const ComplimentPanel = ({ language }: ComplimentPanelProps) => {
  const t = TRANSLATIONS[language];
  const complimentList = language === "ja" ? complimentsJa : compliments;
  const [index, setIndex] = useState(() => dailyIndex(complimentList.length));
  const activeControlStyle = createActiveControlStyle(COLOR_THEME.accentButter);

  useEffect(() => {
    setIndex(dailyIndex(complimentList.length));
  }, [complimentList.length]);

  return (
    <PanelShell title={t.compliment.title} subtitle={t.compliment.subtitle}>
      <div className="space-y-7">
        <div
          className="relative overflow-hidden rounded-[2.2rem] border p-6 sm:p-7"
          style={{
            borderColor: COLOR_THEME.border,
            background:
              "linear-gradient(145deg, rgba(247,231,168,0.38) 0%, rgba(242,198,216,0.32) 48%, rgba(207,229,255,0.34) 100%)",
            boxShadow: "0 10px 26px rgba(196, 150, 120, 0.14)"
          }}
        >
          <div
            className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(242,198,216,0.45) 0%, rgba(242,198,216,0) 72%)" }}
          />

          <div className="relative mb-5 flex items-center justify-between gap-3">
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-medium tracking-[0.04em]"
              style={{
                borderColor: COLOR_THEME.border,
                background: "rgba(255, 253, 251, 0.72)",
                color: COLOR_THEME.textPrimary
              }}
            >
              <span aria-hidden>❤</span>
              {t.compliment.sweetNote}
            </span>
            <div className="flex items-center gap-2">
              <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium" style={{ borderColor: COLOR_THEME.border, color: MUTED_COLOR, background: `${COLOR_THEME.accentLavender}5C` }}>
                ✦
              </span>
              <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium" style={{ borderColor: COLOR_THEME.border, color: MUTED_COLOR, background: `${COLOR_THEME.accentPink}52` }}>
                ✶
              </span>
            </div>
          </div>

          <blockquote
            className="relative rounded-[1.6rem] border px-6 py-7 text-[clamp(1.25rem,2.45vw,1.62rem)] font-medium leading-[1.6]"
            style={{ ...SURFACE_STYLE, background: "rgba(255, 253, 251, 0.83)" }}
          >
            &ldquo;{complimentList[index]}&rdquo;
            <p className="mt-4 text-[13px] font-medium" style={{ color: MUTED_COLOR }}>
              {t.compliment.keepToday}
            </p>
          </blockquote>
        </div>

        <button
          type="button"
          className={controlClassName}
          style={{
            ...activeControlStyle,
            background: "linear-gradient(120deg, rgba(247,231,168,0.96) 0%, rgba(242,198,216,0.74) 100%)",
            boxShadow: "0 6px 14px rgba(196, 150, 120, 0.18)"
          }}
          onClick={() => setIndex((current) => nextRandomIndex(complimentList.length, current))}
        >
          {t.compliment.showAnother}
        </button>
      </div>
    </PanelShell>
  );
};

const renderActivePanel = (
  panel: PanelId,
  language: AppLanguage,
  onOpenPanel: (next: PanelId) => void,
  onFocusModeChange: (isActive: boolean) => void
) => {
  switch (panel) {
    case "focus":
      return <FocusPanel language={language} onFocusModeChange={onFocusModeChange} />;
    case "music":
      return <MusicPanel language={language} />;
    case "breathe":
      return <BreathePanel language={language} />;
    case "mood":
      return <MoodPanel language={language} onOpenPanel={onOpenPanel} />;
    case "gratitude":
      return <GratitudePanel language={language} />;
    case "compliment":
      return <ComplimentPanel language={language} />;
    default:
      return <FocusPanel language={language} />;
  }
};

export const HomeScreen = () => {
  const [activePanel, setActivePanel] = useState<PanelId>("focus");
  const [language, setLanguage] = useState<AppLanguage>("en");
  const [isFocusModeActive, setIsFocusModeActive] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isSidebarCollapsed = activePanel === "focus" && isFocusModeActive;
  const t = TRANSLATIONS[language];
  const panelItems = useMemo(
    () => [
      { id: "focus" as const, label: t.nav.focus, tint: PANEL_TINTS.focus },
      { id: "music" as const, label: t.nav.music, tint: PANEL_TINTS.music },
      { id: "breathe" as const, label: t.nav.breathe, tint: PANEL_TINTS.breathe },
      { id: "mood" as const, label: t.nav.mood, tint: PANEL_TINTS.mood },
      { id: "gratitude" as const, label: t.nav.gratitude, tint: PANEL_TINTS.gratitude },
      { id: "compliment" as const, label: t.nav.compliment, tint: PANEL_TINTS.compliment }
    ],
    [t]
  );

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

  useEffect(() => {
    const savedLanguage = readLocalStorage<AppLanguage>(LANGUAGE_KEY, "en");
    setLanguage(savedLanguage === "ja" ? "ja" : "en");
  }, []);

  useEffect(() => {
    writeLocalStorage(LANGUAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    const engine = getSharedMusicEngine();
    let listenersAttached = true;

    const handleUnlockAttempt = () => {
      void engine.prepareAudio().then((ready) => {
        if (!ready || !listenersAttached) {
          return;
        }

        listenersAttached = false;
        window.removeEventListener("pointerdown", handleUnlockAttempt);
        window.removeEventListener("touchstart", handleUnlockAttempt);
        window.removeEventListener("touchend", handleUnlockAttempt);
        window.removeEventListener("mousedown", handleUnlockAttempt);
        window.removeEventListener("keydown", handleUnlockAttempt);
      });
    };

    window.addEventListener("pointerdown", handleUnlockAttempt);
    window.addEventListener("touchstart", handleUnlockAttempt, { passive: true });
    window.addEventListener("touchend", handleUnlockAttempt, { passive: true });
    window.addEventListener("mousedown", handleUnlockAttempt);
    window.addEventListener("keydown", handleUnlockAttempt);

    return () => {
      listenersAttached = false;
      window.removeEventListener("pointerdown", handleUnlockAttempt);
      window.removeEventListener("touchstart", handleUnlockAttempt);
      window.removeEventListener("touchend", handleUnlockAttempt);
      window.removeEventListener("mousedown", handleUnlockAttempt);
      window.removeEventListener("keydown", handleUnlockAttempt);
    };
  }, []);

  useEffect(() => {
    if (activePanel !== "focus") {
      setIsFocusModeActive(false);
    }
  }, [activePanel]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [activePanel]);

  const handleSelectPanel = (nextPanel: PanelId) => {
    setActivePanel(nextPanel);
    setIsMobileMenuOpen(false);
  };

  return (
    <section
      className="fixed inset-0 overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 14% 12%, rgba(246, 199, 184, 0.35), transparent 36%), radial-gradient(circle at 82% 18%, rgba(220, 207, 246, 0.34), transparent 34%), radial-gradient(circle at 76% 88%, rgba(207, 229, 255, 0.28), transparent 38%), #FFF8F3",
        color: COLOR_THEME.textPrimary
      }}
    >
      <GoldenDust />

      {!isSidebarCollapsed ? (
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className="fixed left-3 top-3 z-40 grid h-11 w-11 place-items-center rounded-full border sm:hidden"
          style={{
            borderColor: COLOR_THEME.border,
            background: "rgba(255, 253, 251, 0.92)",
            color: COLOR_THEME.textPrimary,
            boxShadow: "0 6px 14px rgba(188, 149, 129, 0.14)"
          }}
          aria-label={t.sidebar.navAriaLabel}
        >
          <span aria-hidden className="text-[18px] leading-none">
            ☰
          </span>
        </button>
      ) : null}

      <AnimatePresence>
        {isMobileMenuOpen && !isSidebarCollapsed ? (
          <>
            <motion.button
              type="button"
              aria-label={t.common.cancel}
              className="fixed inset-0 z-40 sm:hidden"
              style={{ background: "rgba(34, 24, 20, 0.36)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div
              className="fixed inset-y-0 left-0 z-50 w-[min(86vw,340px)] p-3 sm:hidden"
              initial={{ x: "-100%", opacity: 0.85 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0.88 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <FeatureMenu
                className="h-full overflow-y-auto"
                items={panelItems}
                activePanel={activePanel}
                onSelect={handleSelectPanel}
                language={language}
                onLanguageChange={setLanguage}
                brandLabel={t.sidebar.brand}
                navAriaLabel={t.sidebar.navAriaLabel}
                languageLabel={t.sidebar.languageLabel}
                languageAriaLabel={t.sidebar.languageAriaLabel}
                englishLabel={t.sidebar.english}
                japaneseLabel={t.sidebar.japanese}
              />
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <div className={`relative z-10 h-full w-full p-3 sm:p-6 sm:pt-6 lg:p-10 ${!isSidebarCollapsed ? "pt-16" : "pt-3"}`}>
        <div
          className={`mx-auto grid h-full w-full max-w-[1420px] grid-cols-1 gap-4 sm:gap-5 ${
            isSidebarCollapsed ? "sm:grid-cols-[minmax(0,1fr)]" : "sm:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)]"
          }`}
        >
          <AnimatePresence initial={false}>
            {!isSidebarCollapsed ? (
              <motion.div
                key="feature-menu"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="hidden min-h-0 sm:block"
              >
                <FeatureMenu
                  className="h-full"
                  items={panelItems}
                  activePanel={activePanel}
                  onSelect={handleSelectPanel}
                  language={language}
                  onLanguageChange={setLanguage}
                  brandLabel={t.sidebar.brand}
                  navAriaLabel={t.sidebar.navAriaLabel}
                  languageLabel={t.sidebar.languageLabel}
                  languageAriaLabel={t.sidebar.languageAriaLabel}
                  englishLabel={t.sidebar.english}
                  japaneseLabel={t.sidebar.japanese}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="min-h-0 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activePanel}
                className="h-full min-h-0"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                {renderActivePanel(activePanel, language, handleSelectPanel, setIsFocusModeActive)}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};

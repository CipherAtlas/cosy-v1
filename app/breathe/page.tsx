"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { FeatureFrame } from "@/components/ui/FeatureFrame";
import { BREATHING_PATTERNS, BreathingPattern, useBreathingCycle } from "@/features/breathe/useBreathingCycle";

export default function BreathePage() {
  const [pattern, setPattern] = useState<BreathingPattern>(BREATHING_PATTERNS[0]);
  const { phase, secondsLeft, isRunning, start, pause, reset } = useBreathingCycle(pattern);

  const phaseScale = useMemo(() => {
    if (!isRunning) {
      return 1;
    }

    if (phase === "inhale") {
      return 1.05;
    }

    if (phase === "hold") {
      return 1.05;
    }

    return 0.88;
  }, [isRunning, phase]);

  const phaseLabel = phase === "holdOut" ? "Hold" : phase.charAt(0).toUpperCase() + phase.slice(1);
  const phaseDuration = phase === "exhale" ? pattern.exhale : phase === "hold" ? pattern.hold : phase === "holdOut" ? pattern.holdAfterExhale ?? 1 : pattern.inhale;
  const isAtStart = phase === "inhale" && secondsLeft === pattern.inhale;

  return (
    <FeatureFrame
      title="Breathe"
      subtitle="Slow and steady, at your own pace."
      atmosphereClassName="bg-[radial-gradient(circle_at_25%_20%,rgba(239,184,123,0.25),transparent_40%),radial-gradient(circle_at_80%_70%,rgba(133,115,102,0.18),transparent_44%)]"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {BREATHING_PATTERNS.map((option) => (
            <button
              key={option.id}
              type="button"
              className="control text-sm"
              data-active={pattern.id === option.id}
              onClick={() => setPattern(option)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="grid place-items-center py-4">
          <motion.div
            className="grid h-56 w-56 place-items-center rounded-full border border-room-candle/35 bg-room-candle/10 shadow-glow"
            animate={{ scale: phaseScale }}
            transition={{ duration: phaseDuration, ease: "easeInOut" }}
            aria-live="polite"
          >
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-room-muted">{phaseLabel}</p>
              <p className="mt-2 text-4xl font-extralight tracking-[0.08em] text-room-text">{secondsLeft}</p>
            </div>
          </motion.div>
        </div>

        <div className="flex flex-wrap gap-2">
          {isRunning ? (
            <button type="button" className="control text-sm" onClick={pause}>
              Pause
            </button>
          ) : (
            <button type="button" className="control text-sm" onClick={start}>
              {isAtStart ? "Start" : "Resume"}
            </button>
          )}
          <button type="button" className="control text-sm" onClick={reset}>
            Reset cycle
          </button>
          <button type="button" className="control text-sm" aria-label="Warm ambience placeholder">
            Warm ambience
          </button>
        </div>
      </div>
    </FeatureFrame>
  );
}

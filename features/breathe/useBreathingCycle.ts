"use client";

import { useEffect, useMemo, useState } from "react";

export type BreathingPattern = {
  id: "4444" | "446" | "478";
  label: string;
  inhale: number;
  hold: number;
  exhale: number;
  holdAfterExhale?: number;
};

export const BREATHING_PATTERNS: BreathingPattern[] = [
  { id: "4444", label: "Box Breathing (4-4-4-4)", inhale: 4, hold: 4, exhale: 4, holdAfterExhale: 4 },
  { id: "446", label: "Calm Breathing (4-4-6)", inhale: 4, hold: 4, exhale: 6 },
  { id: "478", label: "Deep Relaxation (4-7-8)", inhale: 4, hold: 7, exhale: 8 }
];

type Phase = "inhale" | "hold" | "exhale" | "holdOut";

export const useBreathingCycle = (pattern: BreathingPattern) => {
  const [phase, setPhase] = useState<Phase>("inhale");
  const [secondsLeft, setSecondsLeft] = useState(pattern.inhale);
  const [isRunning, setIsRunning] = useState(false);

  const phaseSeconds = useMemo(
    () => ({ inhale: pattern.inhale, hold: pattern.hold, exhale: pattern.exhale, holdOut: pattern.holdAfterExhale ?? 0 }),
    [pattern]
  );
  const phaseOrder = useMemo<Phase[]>(
    () => (phaseSeconds.holdOut > 0 ? ["inhale", "hold", "exhale", "holdOut"] : ["inhale", "hold", "exhale"]),
    [phaseSeconds.holdOut]
  );

  useEffect(() => {
    setPhase("inhale");
    setSecondsLeft(pattern.inhale);
    setIsRunning(false);
  }, [pattern]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev > 1) {
          return prev - 1;
        }

        const currentIndex = phaseOrder.indexOf(phase);
        const nextPhase = phaseOrder[(currentIndex + 1) % phaseOrder.length];
        setPhase(nextPhase);
        return phaseSeconds[nextPhase];
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isRunning, phase, phaseSeconds]);

  return {
    phase,
    secondsLeft,
    isRunning,
    start: () => setIsRunning(true),
    pause: () => setIsRunning(false),
    reset: () => {
      setPhase("inhale");
      setSecondsLeft(pattern.inhale);
      setIsRunning(false);
    }
  };
};

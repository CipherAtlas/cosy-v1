"use client";

import { useEffect, useMemo, useState } from "react";

export type PomodoroSettings = {
  focusMinutes: number;
  breakMinutes: number;
};

type SessionMode = "focus" | "break";

const toSeconds = (minutes: number) => Math.max(1, Math.floor(minutes)) * 60;

export const usePomodoro = (settings: PomodoroSettings) => {
  const [mode, setMode] = useState<SessionMode>("focus");
  const [isRunning, setIsRunning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(toSeconds(settings.focusMinutes));

  const focusSeconds = useMemo(() => toSeconds(settings.focusMinutes), [settings.focusMinutes]);
  const breakSeconds = useMemo(() => toSeconds(settings.breakMinutes), [settings.breakMinutes]);

  useEffect(() => {
    setMode("focus");
    setIsRunning(false);
    setRemainingSeconds(focusSeconds);
  }, [focusSeconds, breakSeconds]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev > 1) {
          return prev - 1;
        }

        const nextMode = mode === "focus" ? "break" : "focus";
        setMode(nextMode);
        return nextMode === "focus" ? focusSeconds : breakSeconds;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRunning, mode, focusSeconds, breakSeconds]);

  const start = () => setIsRunning(true);
  const pause = () => setIsRunning(false);
  const reset = () => {
    setIsRunning(false);
    setMode("focus");
    setRemainingSeconds(focusSeconds);
  };

  return {
    mode,
    isRunning,
    remainingSeconds,
    start,
    pause,
    reset
  };
};

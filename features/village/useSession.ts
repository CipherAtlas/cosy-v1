import { useEffect, useRef, useState } from "react";
const KEY = "cosy-village-focus";
export function useSession(onComplete: () => void) {
  const [minutes, setMinutes] = useState(25),
    [breakMinutes, setBreakMinutes] = useState(5),
    [intention, setIntention] = useState("");
  const [remaining, setRemaining] = useState(25 * 60),
    [running, setRunning] = useState(false),
    [done, setDone] = useState(false),
    [mode, setMode] = useState<"focus" | "break">("focus");
  const deadline = useRef<number | null>(null),
    loaded = useRef(false),
    complete = useRef(onComplete);
  complete.current = onComplete;
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "null");
      if (raw && Number.isFinite(raw.remaining) && raw.remaining >= 0) {
        setMinutes(Math.min(180, Math.max(1, raw.minutes || 25)));
        setBreakMinutes(Math.min(60, Math.max(1, raw.breakMinutes || 5)));
        setIntention(typeof raw.intention === "string" ? raw.intention : "");
        setMode(raw.mode === "break" ? "break" : "focus");
        if (typeof raw.deadline === "number" && raw.deadline > Date.now()) {
          deadline.current = raw.deadline;
          setRemaining(Math.ceil((raw.deadline - Date.now()) / 1000));
          setRunning(true);
        } else {
          setRemaining(raw.deadline ? 0 : raw.remaining);
          setDone(!!raw.deadline || !!raw.done);
        }
      }
    } catch {
      /* A blocked store still allows a session in memory. */
    }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          minutes,
          breakMinutes,
          intention,
          remaining,
          deadline: deadline.current,
          done,
          mode,
        }),
      );
    } catch {}
  }, [minutes, breakMinutes, intention, remaining, running, done, mode]);
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const r = Math.max(
        0,
        Math.ceil(((deadline.current || Date.now()) - Date.now()) / 1000),
      );
      setRemaining(r);
      if (r === 0) {
        deadline.current = null;
        setRunning(false);
        setDone(true);
        complete.current();
      }
    };
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [running]);
  function toggle() {
    if (running) {
      setRemaining(
        Math.max(
          0,
          Math.ceil(((deadline.current || Date.now()) - Date.now()) / 1000),
        ),
      );
      deadline.current = null;
      setRunning(false);
    } else {
      const value =
        remaining > 0
          ? remaining
          : (mode === "focus" ? minutes : breakMinutes) * 60;
      setRemaining(value);
      deadline.current = Date.now() + value * 1000;
      setDone(false);
      setRunning(true);
    }
  }
  function reset() {
    deadline.current = null;
    setRunning(false);
    setDone(false);
    setRemaining((mode === "focus" ? minutes : breakMinutes) * 60);
  }
  function duration(n: number, b = breakMinutes) {
    const safe = Math.max(1, Math.min(180, n));
    setMinutes(safe);
    setBreakMinutes(b);
    if (!running) {
      setRemaining(safe * 60);
      setMode("focus");
      setDone(false);
    }
  }
  function takeBreak() {
    deadline.current = null;
    setMode("break");
    setRemaining(breakMinutes * 60);
    setRunning(false);
    setDone(false);
  }
  return {
    minutes,
    breakMinutes,
    intention,
    setIntention,
    remaining,
    running,
    done,
    mode,
    toggle,
    reset,
    duration,
    takeBreak,
  };
}
export type FocusSession = ReturnType<typeof useSession>;

"use client";
import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import type { VillageEngine } from "./VillageEngine";

function Thumbstick({ label, onChange }: { label: string; onChange: (x: number, y: number) => void }) {
  const pointer = useRef<number | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const change = useRef(onChange);
  change.current = onChange;
  const reset = useCallback(() => { pointer.current = null; setOffset({ x: 0, y: 0 }); change.current(0, 0); }, []);
  useEffect(() => {
    const hide = () => { if (document.hidden) reset(); };
    window.addEventListener("blur", reset);
    window.addEventListener("resize", reset);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("blur", reset);
      window.removeEventListener("resize", reset);
      document.removeEventListener("visibilitychange", hide);
      change.current(0, 0);
    };
  }, [reset]);
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const radius = rect.width * .3;
    const dx = event.clientX - rect.left - rect.width / 2;
    const dy = event.clientY - rect.top - rect.height / 2;
    const distance = Math.hypot(dx, dy);
    const scale = distance > radius ? radius / distance : 1;
    setOffset({ x: dx * scale, y: dy * scale });
    const strength = Math.max(0, Math.min(1, (distance / radius - .14) / .86));
    onChange(distance ? dx / distance * strength : 0, distance ? dy / distance * strength : 0);
  };
  return <div className="v-thumbstick-group">
    <div className="v-thumbstick" role="group" aria-label={label}
      onPointerDown={event => {
        if (pointer.current !== null || event.button !== 0) return;
        event.preventDefault();
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        move(event);
      }}
      onPointerMove={move}
      onPointerUp={event => { if (pointer.current === event.pointerId) reset(); }}
      onPointerCancel={event => { if (pointer.current === event.pointerId) reset(); }}
      onLostPointerCapture={event => { if (pointer.current === event.pointerId) reset(); }}>
      <span className="v-thumbstick-cross" aria-hidden="true">✦</span>
      <span className="v-thumbstick-knob" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }} />
    </div>
    <span className="v-thumbstick-label">{label}</span>
  </div>;
}

export function TouchControls({ engine, canMove, horse, lookout, t }: {
  engine: RefObject<VillageEngine | null>; canMove: boolean; horse: boolean; lookout: boolean;
  t: (english: string, japanese: string) => string;
}) {
  const [running, setRunning] = useState(false);
  useEffect(() => {
    const stop = () => { engine.current?.setTouchSprint(false); setRunning(false); };
    const hide = () => { if (document.hidden) stop(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") stop(); };
    window.addEventListener("blur", stop);
    window.addEventListener("resize", stop);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("keydown", escape);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("blur", stop);
      window.removeEventListener("resize", stop);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("keydown", escape);
      document.removeEventListener("visibilitychange", hide);
      engine.current?.setTouchSprint(false);
    };
  }, [engine]);
  const toggleRun = () => { engine.current?.setTouchSprint(!running); setRunning(!running); };
  const jumpOrBrake = () => { if (horse) engine.current?.brakeHorse(); else engine.current?.touchJump(); };
  return <div className="v-touch-controls" aria-label={t("Touch controls", "タッチ操作")}>
    {canMove && <div className="v-touch-left"><Thumbstick label={t("Move", "移動")}
      onChange={(x, y) => engine.current?.setTouchMovement(x, y)} /></div>}
    <div className="v-touch-right">
      {canMove && <div className="v-touch-buttons">
        <button aria-pressed={running}
          onPointerDown={event => { if (event.button === 0) { event.preventDefault(); toggleRun(); } }}
          onClick={event => { if (event.detail === 0) toggleRun(); }}>{horse ? t("Canter", "駆ける") : t("Run", "走る")}</button>
        {!lookout && <button
          onPointerDown={event => { if (event.button === 0) { event.preventDefault(); jumpOrBrake(); } }}
          onClick={event => { if (event.detail === 0) jumpOrBrake(); }}>{horse ? t("Brake", "止まる") : t("Jump", "ジャンプ")}</button>}
      </div>}
      <span className="v-touch-look-hint">{t("Drag to look", "ドラッグで見回す")}</span>
    </div>
  </div>;
}

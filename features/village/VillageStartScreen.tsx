import { ArrowRight, GearSix, Translate } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Keycap } from "./KeybindingControls";
import { useVillageMenuNavigation } from "./useVillageMenuNavigation";
import { villageNotice } from "./localization";

export function VillageStartScreen({ language, ready, progress, error, touch, enter, retry, openLanguage, openSettings }: {
  language: "en" | "ja"; ready: boolean; progress: number; error: string; touch: boolean;
  enter: () => void; retry: () => void; openLanguage: () => void; openSettings: () => void;
}) {
  const t = (en: string, ja: string) => language === "ja" ? ja : en;
  const menu = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState<"loading" | "fading" | "menu">("loading");
  useEffect(() => {
    if (!ready && !error) { setPhase("loading"); return; }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPhase(reduced || error ? "menu" : "fading");
    if (reduced || error) return;
    const timer = window.setTimeout(() => setPhase("menu"), 550);
    return () => window.clearTimeout(timer);
  }, [ready, error]);
  useEffect(() => {
    if (phase === "menu") menu.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [phase]);
  useVillageMenuNavigation(phase === "menu", menu);
  return <main className={`v-start v-start-phase-${phase}`} lang={language}>
    {phase !== "menu" && <div className="v-title-loading" role="status" aria-label={t("Loading Hearthwillow", "ハースウィローを準備しています")}>
      <h1>{t("Hearthwillow", "ハースウィロー")}</h1>
      <progress max={100} value={progress} aria-label={t("Loading", "読み込み中")} />
    </div>}
    <div className="v-start-reveal" inert={phase !== "menu"} aria-hidden={phase !== "menu"}>
      <div className="v-start-content">
        <h1>{t("Hearthwillow", "ハースウィロー")}</h1>
        <nav className="v-start-menu" aria-label={t("Main menu", "メインメニュー")} ref={menu}>
          {error ? <button className="v-start-option v-start-enter v-enter-button" onClick={retry}>
            <span>{t("Retry the village", "村をもう一度開く")}</span><ArrowRight size={21} aria-hidden="true" />
          </button> : <button className="v-start-option v-start-enter v-enter-button" disabled={!ready} onClick={enter}>
            <span>{t("Enter Hearthwillow", "ハースウィローに入る")}</span><ArrowRight size={21} aria-hidden="true" />
          </button>}
          <button className="v-start-option" data-start-panel="language" onClick={openLanguage}>
            <Translate size={21} aria-hidden="true" /><span>{t("Language", "言語")}</span><span className="v-start-value" lang={language}>{language === "ja" ? "日本語" : "English"}</span>
          </button>
          <button className="v-start-option" data-start-panel="settings" onClick={openSettings}>
            <GearSix size={21} aria-hidden="true" /><span>{t("Settings", "設定")}</span>
          </button>
        </nav>
        {error && <p className="v-start-error" role="alert">{villageNotice(error, language)}</p>}
      </div>
      <div className="v-start-hint">{touch ? t("Move with the thumbstick · Drag to look around", "スティックで移動 · ドラッグで見回す") : <>
        <span><Keycap>W A S D</Keycap> {t("Move", "移動")}</span><span>{t("Mouse to look", "マウスで見回す")}</span><span><Keycap>E</Keycap> {t("Interact", "調べる")}</span>
      </>}</div>
    </div>
  </main>;
}

import { ArrowRight, GearSix, Translate } from "@phosphor-icons/react";
import type { KeyboardEvent } from "react";
import { Keycap } from "./KeybindingControls";

export function VillageStartScreen({ language, ready, progress, error, touch, enter, retry, openLanguage, openSettings }: {
  language: "en" | "ja"; ready: boolean; progress: number; error: string; touch: boolean;
  enter: () => void; retry: () => void; openLanguage: () => void; openSettings: () => void;
}) {
  const t = (en: string, ja: string) => language === "ja" ? ja : en;
  const navigate = (event: KeyboardEvent<HTMLElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
      : (index + (event.key === "ArrowUp" ? -1 : 1) + buttons.length) % buttons.length;
    event.preventDefault();
    buttons[next]?.focus();
  };
  return <main className="v-start" lang={language}>
    <div className="v-start-content">
      <h1>{t("Hearthwillow", "ハースウィロー")}</h1>
      <nav className="v-start-menu" aria-label={t("Main menu", "メインメニュー")} onKeyDown={navigate}>
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
      {!ready && !error && <div className="v-start-loading" role="status">
        <progress max={100} value={progress} aria-label={t("Opening the village", "村を準備しています")} />
        <span>{t("Opening the village", "村を準備しています")} · {progress}%</span>
      </div>}
      {error && <p className="v-start-error" role="alert">{t("The village couldn't load. You can adjust Settings, then retry.", "村を読み込めませんでした。設定を調整して、もう一度お試しください。")}</p>}
    </div>
    <div className="v-start-hint">{touch ? t("Move with the thumbstick · Drag to look around", "スティックで移動 · ドラッグで見回す") : <>
      <span><Keycap>W A S D</Keycap> {t("Move", "移動")}</span><span>{t("Mouse to look", "マウスで見回す")}</span><span><Keycap>E</Keycap> {t("Interact", "調べる")}</span>
    </>}</div>
  </main>;
}

"use client";
import { useState } from "react";
import { GearSix, Keyboard, SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import { MixSliders, SoundtrackChoices } from "./Activities";
import { KeybindingControls } from "./KeybindingControls";
import { DEFAULT_MIX, localTimeWeather, type Quality, type Weather } from "./places";
import type { useVillagePreferences } from "./useVillagePreferences";
import type { VillageEngine } from "./VillageEngine";
import { withBasePath } from "@/lib/basePath";

export function VillageSettings({ settings, sound, soundLoading, toggleSound, engine, showStats, setShowStats, stats, showTutorial, initial = "experience" }: {
  settings: ReturnType<typeof useVillagePreferences>; sound: boolean; soundLoading: boolean; toggleSound: () => void;
  engine: VillageEngine | null; showStats: boolean; setShowStats: (value: boolean) => void;
  stats: { fps: number; draws: number; triangles: number }; showTutorial: () => void; initial?: "experience" | "sound";
}) {
  const [section, setSection] = useState<"experience" | "sound" | "controls">(initial);
  const [report, setReport] = useState("");
  const { mix, setMix, quality, setQuality, weather, setWeather, weatherMode, setWeatherMode,
    language, setLanguage, dontShowTutorial, setDontShowTutorial, mouseSensitivity, setMouseSensitivity, keybindings, setKeybindings } = settings;
  const t = (en: string, ja: string) => language === "ja" ? ja : en;
  return <div className="v-settings-workspace">
    <nav className="v-settings-tabs" aria-label={t("Settings sections", "設定の種類")}>
      {([
        ["experience", GearSix, t("Experience", "環境")], ["sound", SpeakerHigh, t("Sound", "音")], ["controls", Keyboard, t("Controls", "操作")],
      ] as const).map(([id, Icon, label]) => <button key={id} aria-pressed={section === id} aria-controls="v-settings-content" onClick={() => setSection(id)}><Icon size={18} aria-hidden="true" />{label}</button>)}
    </nav>
    <div id="v-settings-content" className="v-settings-content">
      {section === "experience" && <div className="v-settings-fields">
        <label><span>{t("Time & weather", "時間と天気")}</span>
          <select aria-label={t("Time & weather", "時間と天気")} value={weatherMode === "auto" ? "auto" : weather} onChange={event => {
            setWeatherMode(event.target.value === "auto" ? "auto" : "manual");
            setWeather(event.target.value === "auto" ? localTimeWeather(new Date()) : event.target.value as Weather);
          }}>
            <option value="auto">{t("Follow local time", "現地時間に合わせる")}</option>
            <option value="golden">{t("Golden hour", "夕暮れ")}</option>
            <option value="dusk">{t("Blue hour", "薄暮")}</option>
            <option value="night">{t("Night", "夜")}</option>
            <option value="rain">{t("Rain", "雨")}</option>
          </select>
        </label>
        <label><span>{t("Graphics", "画質")}</span><select aria-label={t("Graphics", "画質")} value={quality} onChange={event => setQuality(event.target.value as Quality)}>
          <option value="low">{t("Low power", "省電力")}</option><option value="high">{t("Detailed", "高画質")}</option><option value="auto">{t("Automatic", "自動")}</option>
        </select></label>
        <label><span>{t("Language", "言語")}</span><select aria-label={t("Language", "言語")} value={language} onChange={event => setLanguage(event.target.value as "en" | "ja")}><option value="en">English</option><option value="ja">日本語</option></select></label>
        <div className="v-tutorial-preference">
          <label className="v-check"><input type="checkbox" checked={dontShowTutorial} onChange={event => setDontShowTutorial(event.target.checked)} />{t("Don't show tutorial", "チュートリアルを表示しない")}</label>
          <button className="v-settings-reset" data-show-tutorial onClick={showTutorial}>{t("Read the village guide", "村のガイドを読む")}</button>
        </div>
        <details className="v-settings-advanced"><summary>{t("Performance", "パフォーマンス")}</summary>
          <label className="v-check"><input type="checkbox" checked={showStats} onChange={event => setShowStats(event.target.checked)} />{t("Show performance", "パフォーマンス表示")}</label>
          {engine && <button className="v-settings-reset" onClick={() => setReport(JSON.stringify({ ...engine.getPerformanceReport(), ...stats }, null, 2))}>{t("Get performance report", "パフォーマンスレポートを表示")}</button>}
          {report && <label className="v-settings-report"><span>{t("Saved here until you choose to share it.", "共有するまでこの端末に保存されます。")}</span><textarea readOnly value={report} onFocus={event => event.target.select()} /></label>}
        </details>
      </div>}
      {section === "sound" && <div className="v-settings-sound">
        <div className="v-settings-section-heading"><h3>{t("Sound balance", "音のバランス")}</h3>
          <button className="v-settings-reset" onClick={() => setMix({ ...DEFAULT_MIX })}>{t("Reset sound", "音を初期設定に戻す")}</button></div>
        <button className="v-button v-primary" disabled={soundLoading} aria-busy={soundLoading} onClick={toggleSound}>
          {sound ? <SpeakerSlash size={18} /> : <SpeakerHigh size={18} />}{soundLoading ? t("Loading sound…", "音を準備中…") : sound ? t("Turn sound off", "音をオフ") : t("Turn sound on", "音をオン")}
        </button>
        <SoundtrackChoices mix={mix} setMix={setMix} language={language} />
        <MixSliders mix={mix} setMix={setMix} language={language} />
        <details className="v-settings-advanced"><summary>{t("River & wind", "川と風")}</summary>
          {(["river", "wind"] as const).map(key => <label className="v-settings-range" key={key}>
            <span>{key === "river" ? t("River", "川") : t("Wind", "風")}<output>{Math.round((mix[key] ?? 1) * 100)}%</output></span>
            <input type="range" aria-label={t(`${key} volume`, key === "river" ? "川の音量" : "風の音量")} min="0" max="1" step=".01" value={mix[key] ?? 1} onChange={event => setMix({ ...mix, [key]: Number(event.target.value) })} />
          </label>)}
        </details>
      </div>}
      {section === "controls" && <div>
        <label className="v-settings-range"><span>{t("Mouse sensitivity", "マウス感度")}<output>{Math.round(mouseSensitivity * 100)}%</output></span>
          <input type="range" aria-label={t("Mouse sensitivity", "マウス感度")} min=".25" max="2" step=".05" value={mouseSensitivity} aria-valuetext={`${Math.round(mouseSensitivity * 100)}%`} onChange={event => setMouseSensitivity(Number(event.target.value))} />
        </label>
        <KeybindingControls bindings={keybindings} setBindings={setKeybindings} language={language} />
      </div>}
    </div>
    <footer className="v-settings-footer"><span>{t("Changes save on this device.", "変更はこの端末に保存されます。")}</span><a href={withBasePath("/village/CREDITS.txt")} target="_blank" rel="noreferrer">{t("Credits", "クレジット")}</a></footer>
  </div>;
}

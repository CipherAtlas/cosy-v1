import { ChatCircle, Compass, GearSix, MapTrifold } from "@phosphor-icons/react";
import { Keycap } from "./KeybindingControls";
import type { useVillagePreferences } from "./useVillagePreferences";

/** The same short guide welcomes visitors and can be reopened from Settings. */
export function VillageTutorial({ settings, touch, entered, done }: {
  settings: ReturnType<typeof useVillagePreferences>; touch: boolean; entered: boolean; done: () => void;
}) {
  const { language, dontShowTutorial, setDontShowTutorial } = settings;
  const t = (en: string, ja: string) => language === "ja" ? ja : en;
  return <><article className="v-tutorial" lang={language}>
    <p className="v-tutorial-intro">{t("A little village to wander, rest and share. There's no hurry here.", "散歩したり、ひと休みしたり。ここでは、急がなくて大丈夫です。")}</p>
    <div className="v-tutorial-sections">
      <section><Compass size={23} aria-hidden="true" /><div><h3>{t("Wander a little", "のんびり歩こう")}</h3>
        <p>{touch ? t("Move with the left thumbstick. Drag the view to look around. Tap nearby actions to interact.", "左のスティックで移動し、画面をドラッグして見回します。近くのボタンをタップすると、ふれあえます。") : <>
          <Keycap className="v-key-group">W A S D</Keycap> {t("to move. Click the view, then move your mouse to look. Use", "で移動。画面をクリックして、マウスで見回します。近くのものには")} <Keycap>E</Keycap> {t("for nearby actions.", "でふれあえます。")}
        </>}</p></div></section>
      <section><MapTrifold size={23} aria-hidden="true" /><div><h3>{t("Follow your curiosity", "気になる場所へ")}</h3>
        <p>{t("Open the map", "地図")} <Keycap>M</Keycap> {t("to find activities. Try the garden, music, breathing or a quiet moment in the focus cottage.", "を開くと、楽しめる場所が見つかります。庭や音楽、深呼吸、集中のコテージで静かな時間をどうぞ。")}</p></div></section>
      <section><ChatCircle size={23} aria-hidden="true" /><div><h3>{t("Say hello", "あいさつしよう")}</h3>
        <p>{touch ? t("Open Village chat to talk with other visitors. Tap a villager's chat button to say hello.", "村のチャットで、ほかの訪問者とおしゃべりできます。村人には、会話ボタンをタップしてあいさつしましょう。") : <>
          <Keycap className="v-key-group">Enter</Keycap> {t("opens chat with other visitors.", "でほかの訪問者とチャット。")} <Keycap>F</Keycap> {t("talks to a nearby villager.", "で近くの村人とおしゃべり。")}
        </>}</p></div></section>
      <section><GearSix size={23} aria-hidden="true" /><div><h3>{t("Make yourself comfortable", "心地よい時間に")}</h3>
        <p>{t("Settings", "設定")} <Keycap>,</Keycap> {t("has weather, visuals, language and sound. Choose what feels right for you.", "で天気、画質、言語、音を調整できます。自分に心地よいものを選んでください。")}</p></div></section>
    </div>
    <p className="v-tutorial-note">{t("The village is shared. The focus cottage is your own quiet space.", "村はみんなで過ごす場所。集中のコテージは、あなた専用の静かな場所です。")}</p>
  </article><div className="v-tutorial-footer">
    <label className="v-check"><input type="checkbox" checked={dontShowTutorial} onChange={event => setDontShowTutorial(event.target.checked)} />{t("Don't show tutorial", "チュートリアルを表示しない")}</label>
    <button className="v-button v-primary v-tutorial-done" data-tutorial-done onClick={done}><Keycap>E</Keycap>{entered ? t("Start wandering", "村を歩いてみる") : t("Back to menu", "メニューに戻る")}</button>
  </div></>;
}

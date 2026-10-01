import { useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { SpeakerHigh, SpeakerSlash, X } from "@phosphor-icons/react";
import { MixSliders, SoundtrackChoices } from "./Activities";
import { VillageMap } from "./VillageMap";
import { HarvestInventory } from "./GardenActivities";
import { SoundPanel, PERSONAL_RADIO_ENABLED, type RadioPreferences } from "./RadioControls";
import { localTimeWeather, type PlaceId, type Quality, type Weather } from "./places";
import type { GardenState } from "./garden";
import type { VillageEngine } from "./VillageEngine";
import type { useVillagePreferences } from "./useVillagePreferences";
import type { RadioStationId } from "./radioCatalog";
import { withBasePath } from "@/lib/basePath";

export type VillagePanel = "places" | "sound" | "settings" | "controls" | "basket" | null;

export function VillageMenus({ panel, setPanel, canvas, engine, settings, garden, place, notice, entered, setEntered, enableSound, openPlace,
  sound, soundLoading, toggleSound, openRadio, radioPrefs, radioLoading, radioError, selectStation, nextRadioTrack, playVillageMusic, showStats, setShowStats, stats }: {
  panel: VillagePanel; setPanel: Dispatch<SetStateAction<VillagePanel>>;
  canvas: RefObject<HTMLDivElement | null>; engine: RefObject<VillageEngine | null>;
  settings: ReturnType<typeof useVillagePreferences>; garden: GardenState;
  place: PlaceId | null; notice: string; entered: boolean; setEntered: (value: boolean) => void;
  enableSound: () => Promise<void>; openPlace: (id: PlaceId) => void;
  sound: boolean; soundLoading: boolean; toggleSound: () => void; openRadio: () => void;
  radioPrefs: RadioPreferences; radioLoading: boolean; radioError: string;
  selectStation: (station: RadioStationId) => void; nextRadioTrack: () => void; playVillageMusic: () => Promise<void>;
  showStats: boolean; setShowStats: (value: boolean) => void; stats: { fps: number; draws: number; triangles: number };
}) {
  const { mix, setMix, quality, setQuality, weather, setWeather, weatherMode, setWeatherMode, language, setLanguage, mouseSensitivity, setMouseSensitivity } = settings;
  const t = (en: string, jp: string) => language === "ja" ? jp : en;
  const [performanceReport, setPerformanceReport] = useState("");
  const readMapPose = () => engine.current?.getPlayerPose() ?? null;
  return (
      <Dialog.Root
        open={panel !== null}
        onOpenChange={(v) => {
          if (!v) setPanel(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={`v-dialog-overlay${PERSONAL_RADIO_ENABLED && panel === "sound" ? " v-radio-overlay" : ""}`} />
          <Dialog.Content
            className={`v-dialog${panel === "places" ? " v-map-dialog" : ""}${PERSONAL_RADIO_ENABLED && panel === "sound" ? " v-radio-dialog" : ""}`}
            onOpenAutoFocus={event => {
              if (panel === "places") {
                event.preventDefault();
                requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".v-map-marker.is-selected")?.focus());
              }
            }}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              canvas.current?.querySelector("canvas")?.focus();
            }}
          >
            <Dialog.Title>
              {panel === "places"
                ? t("Hearthwillow", "ハースウィロー")
                : panel === "sound"
                  ? PERSONAL_RADIO_ENABLED ? t("Sound", "音") : t("A little atmosphere.", "心地よい音を。")
                  : panel === "basket"
                    ? t("Harvest basket", "収穫かご")
                  : panel === "controls"
                    ? t("Getting around", "移動と操作")
                    : t("Make it yours.", "お好みに。")}
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              {panel === "places"
                ? t("Village map. Use WASD or arrow keys to choose a destination, Enter to travel and Escape to close. You can also click a place on the map.", "村の地図。WASDか矢印キーで選び、Enterで移動、Escapeで閉じます。地図の場所をクリックしても移動できます。")
                : panel === "sound"
                  ? PERSONAL_RADIO_ENABLED ? "Choose a radio station and adjust all sound volumes." : "Music and ambience controls."
                  : panel === "basket"
                    ? t("Stored harvests from your garden.", "庭で収穫して保存したもの。")
                  : panel === "controls"
                    ? "Gliding, camera and interaction controls."
                    : "Village appearance and accessibility settings."}
            </Dialog.Description>
            <Dialog.Close
              className="v-dialog-close"
              aria-label={t("Close", "閉じる")}
            >
              <X size={22} />
            </Dialog.Close>
            {panel === "basket" && <HarvestInventory garden={garden} language={language} />}
            {panel === "controls" && (
              <div className="v-control-guide">
                <p>{t("Wander at your own pace, or use the village map to settle into an activity.", "自分のペースでお散歩。村の地図から、好きな場所へすぐに移動できます。")}</p>
                <dl>
                  {[
                    ["W A S D / ↑ ↓ ← →", t("Glide", "浮かんで移動")],
                    [t("Click, then move mouse", "クリックしてマウスを動かす"), t("Look around without holding a button", "ボタンを押さずに見回す")],
                    ["Esc", t("Leave an activity, stand up, get off, or close tricks / a menu", "アクティビティ終了・立ち上がる・降りる・芸やメニューを閉じる")],
                    ["Tab / Shift Tab", t("Choose any control; Enter / Space activates it", "操作を選ぶ（Enter / Spaceで実行）")],
                    ["U", t("Show activity controls / enjoy the view", "操作を表示 / 景色を楽しむ")],
                    ["Space / R", t("In focus or breathing: begin / pause and reset", "集中や呼吸では開始 / 一時停止・リセット")],
                    [t("Touch drag", "タッチでドラッグ"), t("Look around", "見回す")],
                    [t("Click or tap a bench side", "ベンチの左右をクリック・タップ"), t("Sit on that side", "選んだ側に座る")],
                    ["F", t("Scatter crumbs from the birdwatching bench", "野鳥観察のベンチでパンくずを撒く")],
                    [t("Mouse / drag while settled", "ひと休み中にマウス / ドラッグ"), t("Move the camera around your activity", "その場でカメラを動かす")],
                    [t("Scroll", "スクロール"), t("Move the camera closer or farther", "カメラの距離")],
                    ["G", t("Toggle gentle / quick glide", "ゆっくり / 速く")],
                    ["R", t("Move to nearby safe ground if stuck", "動けなくなったら近くの安全な場所へ")],
                    ["Shift", t("Hold to dash", "長押しでダッシュ")],
                    ["Space", t("Jump", "ジャンプ")],
                    ["W / S · ↑ / ↓", t("On a swing: pump forward / back in rhythm to go higher", "ブランコではリズムに合わせて前へ / 後ろへ")],
                    ["Space / E / Esc", t("On a swing: brake / get off / get off", "ブランコではブレーキ / 降りる / 降りる")],
                    ["E", t("Pet a puppy, tend plants, sit, enter an activity, or share harvest over tea with Luma", "子犬をなでる・植物のお世話・座る・近くの場所に入る・ルマと収穫をお茶で分かち合う")],
                    ["P", t("Invite a nearby dog to walk / let that dog go home", "近くの犬と一緒に歩く / 元の場所に戻す")],
                    ["H", t("Send all walking dogs home", "犬たちを元の場所に戻す")],
                    ["T", t("Open / close nearby dog tricks; Esc also closes them", "近くの犬の芸を開く / 閉じる（Escでも閉じる）")],
                    ["Z / X / V / Q / J / K", t("Sit / dance / spin / bow / wave / roll over (even with Tricks closed)", "おすわり / ダンス / まわって / おじぎ / おてて / ごろん（芸を閉じていても使えます）")],
                    ["Enter", t("Message the village", "村のチャットに入力")],
                    ["F", t("Chat with a villager", "村人とおしゃべり")],
                    ["C", t("Invite a nearby villager / say goodbye", "近くの村人を誘う / またね")],
                    ["B", t("Ask Maple for bread crumbs nearby", "近くのメープルにパンくずをもらう")],
                    ["M", t("Village map (WASD / arrows to choose; Enter to go)", "村の地図（WASD / 矢印で選ぶ・Enterで移動）")],
                    ["O / ,", t("Sound / settings", "音 / 設定")],
                  ].map(([key, description]) => <div key={key}><dt><kbd>{key}</kbd></dt><dd>{description}</dd></div>)}
                </dl>
              </div>
            )}
            {panel === "places" && <VillageMap scenery={engine.current?.mapScenery} current={place} position={readMapPose()} language={language} notice={notice} travel={id => {
              if (!entered) void enableSound();
              setEntered(true);
              openPlace(id);
            }} />}
            {panel === "sound" && (
              <>
                <button className="v-button v-primary" disabled={soundLoading} aria-busy={soundLoading} onClick={toggleSound}>
                  {sound ? (
                    <SpeakerSlash size={18} />
                  ) : (
                    <SpeakerHigh size={18} />
                  )}{" "}
                  {soundLoading ? t("Loading sound…", "音を準備中…") : sound
                    ? t("Turn sound off", "音をオフ")
                    : t("Turn sound on", "音をオン")}
                </button>
                {PERSONAL_RADIO_ENABLED ? <SoundPanel station={radioPrefs.station} mode={radioPrefs.mode}
                  track={radioPrefs.mode === "radio" ? radioPrefs.track : null}
                  loading={radioLoading} error={radioError} selectStation={selectStation} next={nextRadioTrack}
                  useVillageMusic={() => { void playVillageMusic(); }}
                  mix={mix} setMix={setMix} language={language} /> : <>
                  <SoundtrackChoices mix={mix} setMix={setMix} language={language} />
                  <MixSliders mix={mix} setMix={setMix} language={language} />
                </>}
              </>
            )}
            {panel === "settings" && (
              <div className="v-settings">
                <button className="v-controls-button" onClick={openRadio}><SpeakerHigh size={18} />{t("Sound & music", "音と音楽")}</button>
                <button className="v-controls-button" onClick={() => setPanel("controls")}>
                  {t("Gliding & camera controls", "移動とカメラの操作")}
                </button>
                <label>
                  {t("Time & weather", "時間と天気")}
                  <select
                    value={weatherMode === "auto" ? "auto" : weather}
                    onChange={(e) => {
                      if (e.target.value === "auto") {
                        setWeatherMode("auto");
                        setWeather(localTimeWeather(new Date()));
                      } else {
                        setWeatherMode("manual");
                        setWeather(e.target.value as Weather);
                      }
                      if (e.target.value === "rain")
                        setMix({ ...mix, rain: 0.5 });
                    }}
                  >
                    <option value="auto">{t("Follow local time", "現地時間に合わせる")}</option>
                    <option value="golden">{t("Golden hour", "夕暮れ")}</option>
                    <option value="dusk">{t("Blue hour", "薄暮")}</option>
                    <option value="night">{t("Starlit night", "星降る夜")}</option>
                    <option value="rain">
                      {t("Rainy afternoon", "雨の午後")}
                    </option>
                  </select>
                </label>
                <label>
                  {t("Graphics", "画質")}
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value as Quality)}
                  >
                    <option value="low">
                      {t("Gentle on battery", "省電力")}
                    </option>
                    <option value="high">{t("Detailed", "高画質")}</option>
                    <option value="auto">{t("Automatic", "自動")}</option>
                  </select>
                </label>
                <label className="v-sensitivity">
                  <span>
                    {t("Mouse sensitivity", "マウス感度")}
                    <output>{Math.round(mouseSensitivity * 100)}%</output>
                  </span>
                  <input
                    type="range"
                    aria-label={t("Mouse sensitivity", "マウス感度")}
                    aria-valuetext={`${Math.round(mouseSensitivity * 100)}%`}
                    min=".25"
                    max="2"
                    step=".05"
                    value={mouseSensitivity}
                    onChange={(e) => setMouseSensitivity(Number(e.target.value))}
                  />
                </label>
                <label>
                  {t("Language", "言語")}
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as "en" | "ja")}
                  >
                    <option value="en">English</option>
                    <option value="ja">日本語</option>
                  </select>
                </label>
                <label className="v-check">
                  <input
                    type="checkbox"
                    checked={showStats}
                    onChange={(e) => setShowStats(e.target.checked)}
                  />
                  {t("Show performance", "パフォーマンス表示")}
                </label>
                {showStats && engine.current && (
                  <div className="v-performance-report">
                    <button type="button" onClick={() => setPerformanceReport(JSON.stringify({
                      ...engine.current?.getPerformanceReport(), ...stats,
                    }, null, 2))}>
                      {t("Get performance report", "パフォーマンスレポートを表示")}
                    </button>
                    {performanceReport && (
                      <label>
                        {t("Share this report when something runs slowly. It stays on this device until you share it.", "動作が遅い場合は、このレポートを共有してください。共有するまで端末内に保存されます。")}
                        <textarea readOnly value={performanceReport} onFocus={e => e.target.select()} />
                      </label>
                    )}
                  </div>
                )}
                <p>
                  {t(
                    "Your device’s reduced-motion setting is respected. Notes stay in this browser.",
                    "端末の視差効果設定に従います。メモはこのブラウザに保存されます。",
                  )}
                </p>
                <a
                  className="v-credits"
                  href={withBasePath("/village/CREDITS.txt")}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("Art & music credits", "アートと音楽のクレジット")}
                </a>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
  );
}

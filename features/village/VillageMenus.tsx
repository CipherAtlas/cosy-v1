import { useCallback, useEffect, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { SpeakerHigh, SpeakerSlash, X } from "@phosphor-icons/react";
import { MixSliders, SoundtrackChoices } from "./Activities";
import { VillageMap } from "./VillageMap";
import { VillageInventory } from "./TownActivityHUD";
import type { ForageInventory } from "./townShared";
import { SoundPanel, PERSONAL_RADIO_ENABLED, type RadioPreferences } from "./RadioControls";
import { type PlaceId } from "./places";
import type { VillageEngine } from "./VillageEngine";
import type { useVillagePreferences } from "./useVillagePreferences";
import type { RadioStationId } from "./radioCatalog";
import { VillageSettings } from "./VillageSettings";
import { Keycap } from "./KeybindingControls";
import { useVillageMenuNavigation } from "./useVillageMenuNavigation";

export type VillagePanel = "places" | "sound" | "settings" | "controls" | "basket" | "language" | null;

export function VillageMenus({ panel, setPanel, canvas, engine, settings, inventory, place, notice, entered, setEntered, enableSound, openPlace, travelOutdoor,
  sound, soundLoading, toggleSound, radioPrefs, radioLoading, radioError, selectStation, nextRadioTrack, playVillageMusic, showStats, setShowStats, stats }: {
  panel: VillagePanel; setPanel: Dispatch<SetStateAction<VillagePanel>>;
  canvas: RefObject<HTMLDivElement | null>; engine: RefObject<VillageEngine | null>;
  settings: ReturnType<typeof useVillagePreferences>; inventory: ForageInventory;
  place: PlaceId | null; notice: string; entered: boolean; setEntered: (value: boolean) => void;
  enableSound: () => Promise<void>; openPlace: (id: PlaceId) => void; travelOutdoor: (id: string) => void;
  sound: boolean; soundLoading: boolean; toggleSound: () => void; openRadio: () => void;
  radioPrefs: RadioPreferences; radioLoading: boolean; radioError: string;
  selectStation: (station: RadioStationId) => void; nextRadioTrack: () => void; playVillageMusic: () => Promise<void>;
  showStats: boolean; setShowStats: (value: boolean) => void; stats: { fps: number; draws: number; triangles: number };
}) {
  useVillageMenuNavigation(entered && panel !== null);
  const { mix, setMix, language } = settings;
  const t = (en: string, jp: string) => language === "ja" ? jp : en;
  // Retain the map during Radix’s exit animation so travel reveals the arrival smoothly.
  const [lastPanel, setLastPanel] = useState(panel);
  useEffect(() => { if (panel !== null) setLastPanel(panel); }, [panel]);
  const displayedPanel = panel ?? lastPanel;
  const settingsWorkspace = displayedPanel === "settings" || displayedPanel === "sound" && !PERSONAL_RADIO_ENABLED;
  const readMapPose = useCallback(() => engine.current?.getPlayerPose() ?? null, [engine]);
  const readMapActors = useCallback(() => engine.current?.getMapActors() ?? [], [engine]);
  return (
      <Dialog.Root
        open={panel !== null}
        onOpenChange={(v) => {
          if (!v) setPanel(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={`v-dialog-overlay${settingsWorkspace || displayedPanel === "language" ? " v-settings-overlay" : ""}${!entered ? " v-start-overlay" : ""}${PERSONAL_RADIO_ENABLED && displayedPanel === "sound" ? " v-radio-overlay" : ""}`} />
          <Dialog.Content
            className={`v-dialog${displayedPanel === "places" ? " v-map-dialog" : ""}${settingsWorkspace || displayedPanel === "language" ? " v-settings-dialog" : ""}${!entered ? " v-start-dialog" : ""}${PERSONAL_RADIO_ENABLED && displayedPanel === "sound" ? " v-radio-dialog" : ""}`}
            onOpenAutoFocus={event => {
              if (panel === "places") {
                event.preventDefault();
                requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".v-map-marker.is-selected")?.focus());
              }
            }}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              if (entered) canvas.current?.querySelector("canvas")?.focus();
              else document.querySelector<HTMLButtonElement>(`[data-start-panel="${displayedPanel}"]`)?.focus();
            }}
          >
            <Dialog.Title>
              {displayedPanel === "places"
                ? t("Hearthwillow", "ハースウィロー")
                : displayedPanel === "sound" && PERSONAL_RADIO_ENABLED
                  ? t("Sound", "音")
                  : displayedPanel === "language"
                    ? t("Language", "言語")
                  : displayedPanel === "basket"
                    ? t("Harvest basket", "収穫かご")
                  : displayedPanel === "controls"
                    ? t("Getting around", "移動と操作")
                    : t("Settings", "設定")}
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              {displayedPanel === "places"
                ? t("Full-screen village map. The gold diamond marks you; blue circles mark other players. Names appear above markers. Click a destination to travel, or use arrow keys and Enter. Press the map key again or Escape to close.", "全画面の村の地図。金色のひし形はあなた、青い丸は他のプレイヤーです。名前はマーカーの上に表示されます。クリック、または矢印キーとEnterで移動し、地図キーかEscapeで閉じます。")
                : displayedPanel === "sound"
                  ? PERSONAL_RADIO_ENABLED ? t("Choose a radio station and adjust all sound volumes.", "ラジオ局を選び、音量を調整します。") : t("Music and ambience controls.", "音楽と環境音の設定。")
                  : displayedPanel === "language"
                    ? t("Choose the language for menus, controls and village conversations.", "メニュー・操作・村での会話の言語を選びます。")
                  : displayedPanel === "basket"
                    ? t("Your saved harvests and woodland treats.", "庭で収穫して保存したもの。")
                  : displayedPanel === "controls"
                    ? t("Gliding, camera and interaction controls.", "移動・カメラ・ふれあいの操作。")
                    : t("Village appearance, sound and personal keyboard settings.", "村の環境・音・個人のキー設定。")}
            </Dialog.Description>
            <Dialog.Close
              className="v-dialog-close"
              aria-label={t("Close", "閉じる")}
            >
              {displayedPanel === "places" && <Keycap aria-hidden="true">Esc</Keycap>}
              <X size={22} />
            </Dialog.Close>
            {displayedPanel === "language" && <div className="v-language-menu">
              <p>{t("Choose your language.", "言語を選んでください。")}</p>
              {([['en', 'English'], ['ja', '日本語']] as const).map(([id, name]) => <button key={id} lang={id}
                aria-pressed={language === id} onClick={() => settings.setLanguage(id)}>
                <span>{name}</span><span aria-hidden="true">{language === id ? "✓" : ""}</span>
              </button>)}
              <footer className="v-settings-footer"><span>{t("Changes save on this device.", "変更はこの端末に保存されます。")}</span></footer>
            </div>}
            {displayedPanel === "basket" && <VillageInventory inventory={inventory} language={language} />}
            {displayedPanel === "controls" && (
              <div className="v-control-guide">
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
                    ["M", t("Open / close the full-screen map (click to travel; WASD / arrows and Enter also work)", "全画面の地図を開く / 閉じる（クリックで移動・WASD / 矢印とEnterでも操作）")],
                    ["I", t("Your inventory", "持ち物")],
                    ["O / ,", t("Sound / settings", "音 / 設定")],
                  ].map(([key, description]) => <div key={key}><dt><Keycap>{key}</Keycap></dt><dd>{description}</dd></div>)}
                </dl>
              </div>
            )}
            {displayedPanel === "places" && <VillageMap scenery={engine.current?.mapScenery} current={place} position={readMapPose()} readPose={readMapPose} readActors={readMapActors} language={language} notice={notice} travelOutdoor={travelOutdoor} travel={id => {
              if (!entered) void enableSound();
              setEntered(true);
              openPlace(id);
            }} />}
            {displayedPanel === "sound" && PERSONAL_RADIO_ENABLED && (
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
            {settingsWorkspace && !entered && notice && <p className="v-settings-help" role="status">{notice}</p>}
            {settingsWorkspace && <VillageSettings key={displayedPanel} settings={settings}
              initial={displayedPanel === "sound" ? "sound" : "experience"} sound={sound} soundLoading={soundLoading} toggleSound={toggleSound}
              engine={engine.current} showStats={showStats} setShowStats={setShowStats} stats={stats} />}

          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
  );
}

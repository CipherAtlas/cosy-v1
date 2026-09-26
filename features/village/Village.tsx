"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  CaretDown,
  GearSix,
  Leaf,
  MapTrifold,
  Timer, Fire, Drop, Coffee, BookOpen, EnvelopeSimple,
  SpeakerHigh,
  SpeakerSlash,
  X,
} from "@phosphor-icons/react";
import {
  PLACES,
  JAPANESE_PLACE_NAMES as japaneseNames,
  DEFAULT_MIX,
  type PlaceId,
  type Quality,
  type Weather,
  type AudioMix,
} from "./places";
import { Activities, MixSliders, SoundtrackChoices } from "./Activities";
import { VillageAudio } from "./audio";
import { useSession } from "./useSession";
import type { ActivityMoment, MovementStatus } from "./environment";
import type { VillageEngine } from "./VillageEngine";
import "./village.css";
import { withBasePath } from "@/lib/basePath";

export function Village() {
  const canvas = useRef<HTMLDivElement>(null),
    engine = useRef<VillageEngine | null>(null),
    audio = useRef<VillageAudio | null>(null);
  const [progress, setProgress] = useState(0),
    [ready, setReady] = useState(false),
    [entered, setEntered] = useState(false),
    [error, setError] = useState(""),
    [simple, setSimple] = useState(false);
  const [place, setPlace] = useState<PlaceId | null>(null),
    [near, setNear] = useState<PlaceId | null>(null),
    [panel, setPanel] = useState<"places" | "sound" | "settings" | "controls" | null>(null);
  const [activityCompact,setActivityCompact]=useState(false);
  const onMoment=useCallback((moment:ActivityMoment)=>engine.current?.setActivityMoment(moment),[]);
  const soundBusy = useRef(false);
  const [movement, setMovement] = useState<MovementStatus>({ stamina: 100, exhausted: false, gait: "idle", running: false });
  const [soundLoading, setSoundLoading] = useState(false);
  const [sound, setSound] = useState(false),
    [mix, setMix] = useState<AudioMix>(DEFAULT_MIX),
    [quality, setQuality] = useState<Quality>("auto"),
    [weather, setWeather] = useState<Weather>("golden"),
    [language, setLanguage] = useState<"en" | "ja">("en"),
    [showStats, setShowStats] = useState(false),
    [stats, setStats] = useState({ fps: 0, draws: 0, triangles: 0 });
  const preferences = useRef({ quality, weather, language });
  preferences.current = { quality, weather, language };
  const [notice, setNotice] = useState("");
  const [performanceReport, setPerformanceReport] = useState("");
  const loaded = useRef(false),
    enterRef = useRef(false);
  const ja = language === "ja",
    t = (en: string, jp: string) => (ja ? jp : en);
  const focus = useSession(() => {
    audio.current?.chime();
    setNotice("Your session is complete. Take a breath.");
  });
  const openPlace = useCallback((id: PlaceId) => {
    setPlace(id);
    setActivityCompact(false);
    setPanel(null);
    engine.current?.travel(id);
    audio.current?.setPlace(id);
  }, []);
  const leave = useCallback(() => {
    setPlace(null);
    engine.current?.setPlace(null);
    audio.current?.setPlace(null);
    const target = canvas.current?.querySelector("canvas")
      ?? canvas.current?.parentElement?.querySelector<HTMLButtonElement>(".v-wordmark");
    target?.focus();
  }, []);
  useEffect(() => {
    audio.current = new VillageAudio(() => setNotice(preferences.current.language === "ja"
      ? "音楽を切り替えられませんでした。音をオフにして、もう一度お試しください。"
      : "The music couldn't change. Turn sound off and on to retry."));
    try {
      const p = JSON.parse(
        localStorage.getItem("cosy-village-preferences") || "null",
      );
      if (p) {
        if (["auto", "high", "low"].includes(p.quality)) setQuality(p.quality);
        if (["golden", "dusk", "rain"].includes(p.weather))
          setWeather(p.weather);
        if (p.language === "ja") setLanguage("ja");
        if (
          p.mix &&
          ["piano", "lofi", "jazz"].includes(p.mix.vibe) &&
          ["music", "rain", "fire", "master"].every(
            (k) =>
              typeof p.mix[k] === "number" && p.mix[k] >= 0 && p.mix[k] <= 1,
          )
        )
          setMix({ ...p.mix,
            soundtrack: ["auto", "village", "water", "rest", "hearth"].includes(p.mix.soundtrack) ? p.mix.soundtrack : "auto",
            ambience: typeof p.mix.ambience === "number" && p.mix.ambience >= 0 && p.mix.ambience <= 1 ? p.mix.ambience : .5,
            effects: typeof p.mix.effects === "number" && p.mix.effects >= 0 && p.mix.effects <= 1 ? p.mix.effects : .6,
          });
      }
    } catch {}
    loaded.current = true;
    return () => audio.current?.dispose();
  }, []);
  useEffect(() => {
    if (!canvas.current || simple) return;
    let cancelled = false;
    let local: VillageEngine | undefined;
    import("./VillageEngine")
      .then(async ({ VillageEngine }) => {
        if (cancelled) return;
        local = new VillageEngine(canvas.current!, {
          progress: setProgress,
          movement: setMovement,
          contact: event => audio.current?.contact(event),
          environment: frame => audio.current?.setEnvironment(frame),
          ready: () => {
            if (!cancelled) setReady(true);
          },
          near: setNear,
          interact: openPlace,
          error: (msg) => {
            setError(msg);
            setSimple(true);
          },
          stats: (fps, draws, triangles) => setStats({ fps, draws, triangles }),
        });
        engine.current = local;
        local.setBlocked(!enterRef.current);
        await local.load();
        if (!cancelled) {
          local.setQuality(preferences.current.quality);
          local.setWeather(preferences.current.weather);
          local.setLanguage(preferences.current.language);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          console.error("Village initialization failed", e);
          setError(
            "The village could not load. You can still enjoy every activity in simple view.",
          );
          setSimple(true);
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
      local?.dispose();
      engine.current = null;
    };
    // Settings are applied independently, without remounting the world.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simple, openPlace]);
  useEffect(() => {
    engine.current?.setBlocked(!entered || panel !== null);
    enterRef.current = entered;
  }, [entered, panel]);
  useEffect(() => {
    document.documentElement.lang = language;
    engine.current?.setLanguage(language);
  }, [language]);
  useEffect(() => {
    engine.current?.setQuality(quality);
  }, [quality]);
  useEffect(() => {
    engine.current?.setWeather(weather);
    audio.current?.setWeather(weather);
  }, [weather]);
  useEffect(() => {
    audio.current?.setMix(mix);
  }, [mix]);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(
        "cosy-village-preferences",
        JSON.stringify({ mix, quality, weather, language }),
      );
    } catch {}
  }, [mix, quality, weather, language]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 7000);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      if (e.key === "Escape" && place && !panel) {
        leave();
      }
      if (e.key.toLowerCase() === "m" && !place && entered)
        setPanel((p) => (p === "places" ? null : "places"));
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [place, entered, panel, leave]);
  async function toggleSound() {
    if (soundBusy.current) return;
    if (sound) {
      audio.current?.stop();
      setSound(false);
    } else {
      try {
        soundBusy.current = true;
        setSoundLoading(true);
        const result = await audio.current?.start();
        setSound(true);
        if (result && !result.ambience) setNotice(t("Some nature recordings could not load. Music is still available; turn sound off and on to retry.", "環境音の一部を読み込めませんでした。音楽は再生できます。音をオフにして再度お試しください。"));
      } catch {
        audio.current?.stop();
        setSound(false);
        setNotice(
          t(
            "Audio could not start. Please try again.",
            "音を再生できませんでした。もう一度お試しください。",
          ),
        );
      } finally {
        soundBusy.current = false;
        setSoundLoading(false);
      }
    }
  }
  const current = PLACES.find((p) => p.id === place),
    nearPlace = PLACES.find((p) => p.id === near);
  const placeName = (id: PlaceId) =>
    ja
      ? japaneseNames[PLACES.findIndex((p) => p.id === id)]
      : PLACES.find((p) => p.id === id)!.name;
  return (
    <div
      className={`village ${entered ? "v-entered" : ""} ${place ? "v-settled" : ""} ${simple ? "v-simple" : ""}`}
      data-weather={weather}
      data-activity={place ?? "explore"}
    >
      <div className="v-canvas" ref={canvas} />
      <div className="v-shade" aria-hidden="true" />
      <header className="v-header">
        <button
          className="v-wordmark"
          onClick={leave}
          aria-label={t("Return to village", "村に戻る")}
        >
          {current ? placeName(current.id) : "Cosy"}
          {!current && <Leaf size={24} weight="light" />}
        </button>
        <nav aria-label={t("Village controls", "村の操作")}>
          {place && (
            <button className="v-leave" onClick={leave}>
              <ArrowLeft size={18} />
              {t("Back to village", "村に戻る")}
            </button>
          )}
          <button
            disabled={!ready && !simple}
            aria-label={t("Places", "場所")}
            onClick={() => setPanel("places")}
          >
            <MapTrifold size={19} />
            <span>{t("Places", "場所")}</span>
          </button>
          <button
            disabled={!ready && !simple}
            aria-label={t("Sound", "音")}
            onClick={() => setPanel("sound")}
          >
            {sound ? <SpeakerHigh size={20} /> : <SpeakerSlash size={20} />}
            <span>{t("Sound", "音")}</span>
          </button>
          <button
            disabled={!ready && !simple}
            aria-label={t("Settings", "設定")}
            onClick={() => setPanel("settings")}
          >
            <GearSix size={20} />
          </button>
        </nav>
      </header>
      {!entered && (
        <div className="v-arrival">
          <div className="v-arrival-content">
            <h1>{t("Somewhere to slow down.", "ゆっくりできる場所。")}</h1>
            <p>
              {t(
                "A quiet village. A little time for yourself.",
                "静かな村で、自分のためのひとときを。",
              )}
            </p>
            {!ready && !simple ? (
              <div className="v-loading">
                <progress max={100} value={progress} />
                <span>
                  {t("Opening the village", "村を準備しています")} · {progress}%
                </span>
              </div>
            ) : (
              <button
                className="v-button v-primary v-enter-button"
                onClick={() => {
                  setEntered(true);
                  setPanel(simple ? "places" : null);
                }}
              >
                {t("Enter the village", "村に入る")}
                <ArrowRight size={19} />
              </button>
            )}
            <button
              className="v-text-button"
              onClick={() => {
                setSimple(true);
                setEntered(true);
                setPanel("places");
              }}
            >
              {t("Open simple view", "シンプル表示を開く")}
            </button>
          </div>
        </div>
      )}
      {entered && !place && !simple && (
        <>
          <div className="v-location">
            <span>{t("The village", "村の入口")}</span>
            <span>
              {weather === "golden"
                ? t("Golden hour", "夕暮れ")
                : weather === "dusk"
                  ? t("Blue hour", "薄暮")
                  : t("A rainy afternoon", "雨の午後")}
            </span>
          </div>
          {nearPlace && (
            <button
              className="v-interact"
              onClick={() => openPlace(nearPlace.id)}
            >
              <kbd>E</kbd>
              {ja ? placeName(nearPlace.id) : nearPlace.prompt}
              <ArrowUpRight size={16} />
            </button>
          )}
          <div className={`v-energy ${movement.stamina < 100 ? "v-energy-visible" : ""}`}>
            <span>{movement.exhausted ? t("Catching your breath", "ひと休み") : t("Energy", "体力")}</span>
            <meter min={0} max={100} value={movement.stamina} aria-label={t("Sprint energy", "ダッシュの体力")} />
          </div>
          <footer className="v-walk-hints">
            <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> {t("Glide", "移動")}</span>
            <span>{t("Drag to look", "ドラッグで見回す")}</span>
            <span>{t("Click to glide", "クリックで移動")}</span>
            <button className="v-controls-button" onClick={() => setPanel("controls")}>
              {t("Controls", "操作方法")}
            </button>
          </footer>
          <div
            className="v-touch-pad"
            aria-label={t("Movement controls", "移動操作")}
          >
            {[
              ["w", ArrowUp],
              ["a", ArrowLeft],
              ["s", ArrowDown],
              ["d", ArrowRight],
            ].map(([key, Icon]) => {
              const I = Icon as typeof ArrowUp;
              return (
                <button
                  key={key as string}
                  aria-label={t(
                    `Glide ${{ w: "forward", a: "left", s: "backward", d: "right" }[key as "w" | "a" | "s" | "d"]}`,
                    `移動 ${{ w: "前", a: "左", s: "後ろ", d: "右" }[key as "w" | "a" | "s" | "d"]}`,
                  )}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    engine.current?.walkKey(key as string, true);
                  }}
                  onPointerUp={() =>
                    engine.current?.walkKey(key as string, false)
                  }
                  onPointerCancel={() => engine.current?.walkKey(key as string, false)}
                  onLostPointerCapture={() => engine.current?.walkKey(key as string, false)}
                >
                  <I size={21} />
                </button>
              );
            })}
          </div>
          <div className="v-touch-actions">
            <button aria-pressed={movement.running} onClick={() => engine.current?.toggleRun()}>{t("Glide faster", "速く移動")}</button>
            <button onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); engine.current?.walkKey("shift", true); }}
              onPointerUp={() => engine.current?.walkKey("shift", false)}
              onPointerCancel={() => engine.current?.walkKey("shift", false)}
              onLostPointerCapture={() => engine.current?.walkKey("shift", false)}>{t("Dash", "ダッシュ")}</button>
            <button onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); engine.current?.walkKey(" ", true); }}
              onPointerUp={() => engine.current?.walkKey(" ", false)}
              onPointerCancel={() => engine.current?.walkKey(" ", false)}
              onLostPointerCapture={() => engine.current?.walkKey(" ", false)}>{t("Jump", "ジャンプ")}</button>
          </div>
        </>
      )}
      {entered && place && (
        <div id="v-activity-panel" hidden={activityCompact && !simple}>
        <Activities
          key={place}
          onMoment={onMoment}
          place={place}
          session={focus}
          mix={mix}
          setMix={setMix}
          sound={sound}
          soundLoading={soundLoading}
          toggleSound={toggleSound}
          travel={openPlace}
          language={language}
        />
        </div>
      )}
      {entered && simple && !place && (
        <section className="v-simple-places">
          <h1>{t("Make yourself at home.", "どうぞ、ごゆっくり。")}</h1>
          {PLACES.map((p) => (
            <button key={p.id} onClick={() => openPlace(p.id)}>
              <span>{placeName(p.id)}</span>
              <ArrowUpRight size={22} />
            </button>
          ))}
        </section>
      )}
      {entered && place && !simple && (
        <button className="v-scene-toggle" aria-controls="v-activity-panel" aria-expanded={!activityCompact} onClick={()=>setActivityCompact(value=>!value)}>
          {activityCompact ? t("Show activity", "操作を表示") : t("Enjoy the view", "景色を楽しむ")}<CaretDown size={16} style={{transform:activityCompact?"rotate(180deg)":undefined}} />
        </button>
      )}
      {entered && focus.running && place !== "focus" && (
        <button className="v-session-mini" onClick={() => openPlace("focus")}>
          <span className="v-live-dot" />
          {Math.floor(focus.remaining / 60)}:
          {String(focus.remaining % 60).padStart(2, "0")} ·{" "}
          {t("Back to focus", "集中に戻る")}
        </button>
      )}
      {error && (
        <div className="v-error" role="status">
          {error}
          <button aria-label="Dismiss message" onClick={() => setError("")}>
            <X size={18} />
          </button>
        </div>
      )}
      {notice && (
        <div className="v-notice" role="status">
          {notice}
        </div>
      )}
      {showStats && (
        <output className="v-stats">
          {stats.fps} fps · {stats.draws} calls ·{" "}
          {Math.round(stats.triangles / 1000)}k triangles
        </output>
      )}
      <Dialog.Root
        open={panel !== null}
        onOpenChange={(v) => {
          if (!v) setPanel(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="v-dialog-overlay" />
          <Dialog.Content
            className="v-dialog"
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              canvas.current?.querySelector("canvas")?.focus();
            }}
          >
            <Dialog.Title>
              {panel === "places"
                ? t("Where would you like to go?", "どこへ行きましょうか？")
                : panel === "sound"
                  ? t("A little atmosphere.", "心地よい音を。")
                  : panel === "controls"
                    ? t("Getting around", "移動と操作")
                    : t("Make it yours.", "お好みに。")}
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              {panel === "places"
                ? "Travel directly to a village activity."
                : panel === "sound"
                  ? "Music and ambience controls."
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
            {panel === "controls" && (
              <div className="v-control-guide">
                <p>{t("Wander at your own pace, or use Places to settle straight into an activity.", "自分のペースでお散歩。場所メニューから、好きな場所へすぐに移動できます。")}</p>
                <dl>
                  {[
                    ["W A S D / ↑ ↓ ← →", t("Glide", "浮かんで移動")],
                    [t("Click / tap", "クリック / タップ"), t("Glide to a spot", "その場所へ移動")],
                    [t("Drag", "ドラッグ"), t("Look around", "見回す")],
                    [t("Scroll", "スクロール"), t("Move the camera closer or farther", "カメラの距離")],
                    ["R", t("Toggle gentle / quick glide", "ゆっくり / 速く")],
                    ["Shift", t("Hold to dash", "長押しでダッシュ")],
                    ["Space", t("Jump", "ジャンプ")],
                    ["E", t("Enjoy a nearby activity", "近くの場所に入る")],
                    ["F", t("Chat with a villager", "村人とおしゃべり")],
                    ["M / Esc", t("Places / close", "場所 / 閉じる")],
                  ].map(([key, description]) => <div key={key}><dt><kbd>{key}</kbd></dt><dd>{description}</dd></div>)}
                </dl>
              </div>
            )}
            {panel === "places" && (
              <div className="v-place-list">
                {PLACES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setEntered(true);
                      openPlace(p.id);
                    }}
                  >
                    <span className="v-place-icon" aria-hidden="true">{[<Timer key="focus" size={23}/>,<Fire key="music" size={23}/>,<Drop key="breathe" size={23}/>,<Coffee key="mood" size={23}/>,<BookOpen key="gratitude" size={23}/>,<EnvelopeSimple key="compliment" size={23}/>][PLACES.findIndex(a=>a.id===p.id)]}</span>
                    <div>
                      <strong>{placeName(p.id)}</strong>
                      <span>
                        {ja
                          ? [
                              "集中",
                              "音楽",
                              "深呼吸",
                              "気持ち",
                              "感謝",
                              "やさしい言葉",
                            ][PLACES.findIndex((a) => a.id === p.id)]
                          : p.description}
                      </span>
                    </div>
                    <ArrowUpRight size={23} />
                  </button>
                ))}
              </div>
            )}
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
                <SoundtrackChoices mix={mix} setMix={setMix} language={language} />
                <MixSliders mix={mix} setMix={setMix} language={language} />
              </>
            )}
            {panel === "settings" && (
              <div className="v-settings">
                <button className="v-controls-button" onClick={() => setPanel("controls")}>
                  {t("Gliding & camera controls", "移動とカメラの操作")}
                </button>
                <label>
                  {t("Time & weather", "時間と天気")}
                  <select
                    value={weather}
                    onChange={(e) => {
                      setWeather(e.target.value as Weather);
                      if (e.target.value === "rain")
                        setMix({ ...mix, rain: 0.5 });
                    }}
                  >
                    <option value="golden">{t("Golden hour", "夕暮れ")}</option>
                    <option value="dusk">{t("Blue hour", "薄暮")}</option>
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
                    <option value="auto">{t("Automatic", "自動")}</option>
                    <option value="high">{t("Detailed", "高画質")}</option>
                    <option value="low">
                      {t("Gentle on battery", "省電力")}
                    </option>
                  </select>
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
                    checked={simple}
                    onChange={(e) => {
                      setSimple(e.target.checked);
                      if (e.target.checked) {
                        setReady(true);
                      } else {
                        setReady(false);
                        setEntered(false);
                        setPlace(null);
                      }
                      setPanel(null);
                    }}
                  />
                  {t("Simple view", "シンプル表示")}
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
    </div>
  );
}

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
  Timer, Fire, Drop, Coffee, BookOpen, EnvelopeSimple, Bird,
  SpeakerHigh,
  SpeakerSlash,
  X,
  UsersThree,
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
import { HarvestInventory } from "./GardenActivities";
import { VillageAudio } from "./audio";
import { useSession } from "./useSession";
import type { ActivityMoment, MovementStatus } from "./environment";
import type { VillageEngine } from "./VillageEngine";
import "./village.css";
import { withBasePath } from "@/lib/basePath";
import type { BirdStatus } from "./birds";
import { VILLAGERS } from "./villagers";
import { GARDEN_KEY, CROP_NAMES, HARVEST_COMPLIMENTS, freshGarden, readGarden, growGarden, gardenAction, gardenActionAllowed, nearbyGardenAction, type GardenAction } from "./garden";
import type { SharedWorldConnection, SharedVisitor } from "./sharedWorld";

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
    [panel, setPanel] = useState<"places" | "sound" | "settings" | "controls" | "friends" | "basket" | null>(null);
  const [birdStatus, setBirdStatus] = useState<BirdStatus>("flying");
  const [nearBench, setNearBench] = useState<string | null>(null);
  const [seatedBench, setSeatedBench] = useState<string | null>(null);
  const [garden, setGarden] = useState(freshGarden);
  const gardenRef = useRef(garden);
  const sharedTrialModeRef = useRef(false);
  const sharedTrialRef = useRef<SharedWorldConnection | null>(null);
  const sharedConnectedRef = useRef(false);
  const sharedVisitorsRef = useRef<SharedVisitor[]>([]);
  const sharedIdentityRef = useRef<Pick<SharedVisitor, "slot" | "color"> | null>(null);
  const [sharedTrialEnabled, setSharedTrialEnabled] = useState(false);
  const [sharedStatus, setSharedStatus] = useState("Connecting…");
  const [sharedPeople, setSharedPeople] = useState<Pick<SharedVisitor, "id" | "name" | "color">[]>([]);
  const [sharedSelfId, setSharedSelfId] = useState("");
  const [sharedChat, setSharedChat] = useState<{ name: string; message: string }[]>([]);
  const [sharedChatHour, setSharedChatHour] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [companions, setCompanions] = useState<string[]>([]);
  const companionsRef = useRef(companions);
  const [activityCompact,setActivityCompact]=useState(false);
  const onMoment=useCallback((moment:ActivityMoment)=>engine.current?.setActivityMoment(moment),[]);
  const soundBusy = useRef(false);
  const [movement, setMovement] = useState<MovementStatus>({ gait: "idle", running: false });
  const [mouseLook, setMouseLook] = useState<"free" | "locked" | "drag">("free");
  const [soundLoading, setSoundLoading] = useState(false);
  const [sound, setSound] = useState(false),
    [mix, setMix] = useState<AudioMix>(DEFAULT_MIX),
    [quality, setQuality] = useState<Quality>("high"),
    [weather, setWeather] = useState<Weather>("golden"),
    [language, setLanguage] = useState<"en" | "ja">("en"),
    [showStats, setShowStats] = useState(false),
    [stats, setStats] = useState({ fps: 0, draws: 0, triangles: 0 });
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const preferences = useRef({ quality, weather, language });
  preferences.current = { quality, weather, language };
  const [notice, setNotice] = useState("");
  const [lumaSpeech, setLumaSpeech] = useState<{ en: string; ja: string } | null>(null);
  const [gardenStorageError, setGardenStorageError] = useState(false);
  const [nearGarden, setNearGarden] = useState<string | null>(null);
  const [performanceReport, setPerformanceReport] = useState("");
  const enterRef = useRef(false);
  const ja = language === "ja",
    t = (en: string, jp: string) => (ja ? jp : en);
  const focus = useSession(() => {
    audio.current?.chime();
    setNotice("Your session is complete. Take a breath.");
  });
  const openPlace = useCallback((id: PlaceId) => {
    setLumaSpeech(null);
    setPlace(id);
    setActivityCompact(false);
    setPanel(null);
    engine.current?.travel(id);
    audio.current?.setPlace(id);
  }, []);
  const leave = useCallback(() => {
    setLumaSpeech(null);
    setPlace(null);
    engine.current?.setPlace(null);
    audio.current?.setPlace(null);
    const target = canvas.current?.querySelector("canvas")
      ?? canvas.current?.parentElement?.querySelector<HTMLButtonElement>(".v-wordmark");
    target?.focus();
  }, []);
  const toggleCompanion = useCallback((id: string) => {
    if (!VILLAGERS.some(v => v.id === id)) return;
    const next = companionsRef.current.includes(id) ? companionsRef.current.filter(value => value !== id) : [...companionsRef.current, id];
    companionsRef.current = next; setCompanions(next); engine.current?.setCompanions(next);
  }, []);
  const onGardenAction = useCallback((action: GardenAction) => {
    if (action.kind === "basket") { setPanel("basket"); return; }
    if (sharedTrialModeRef.current) {
      if (sharedConnectedRef.current && sharedTrialRef.current) sharedTrialRef.current.sendGarden(action);
      else setNotice("The shared village is offline. Reload to reconnect.");
      return;
    }
    if (action.kind === "feedBirds") {
      if (engine.current) { engine.current.gardenAction(action); return; }
      setBirdStatus(current => current === "eating" || current === "happy" ? current : "eating");
      return;
    }
    const previous = growGarden(gardenRef.current);
    if (!gardenActionAllowed(previous, action)) return;
    const next = gardenAction(previous, action);
    gardenRef.current = next; setGarden(next); engine.current?.setGarden(next);
    engine.current?.gardenAction(action);
    if (!engine.current) audio.current?.gardenEffect(action.kind === "drink" || action.kind === "gift" ? "pour" : action.kind === "plant" ? "plant" : action.kind === "water" || action.kind === "flowers" ? "water" : action.kind === "feed" || action.kind === "crumbs" ? "crumbs" : "pluck", [0, 0, 0], true);
    try { localStorage.setItem(GARDEN_KEY, JSON.stringify(next)); setGardenStorageError(false); }
    catch { setGardenStorageError(true); }
    if (action.kind === "birdCrumbs" || action.kind === "crumbs") { setNotice(""); return; }
    if (action.kind === "gift") {
      setNotice("");
      if (!engine.current) setLumaSpeech({ ...HARVEST_COMPLIMENTS[action.crop] });
      return;
    }
    const messages = {
      plant: ["A new little sprout. Water it whenever you like.", "小さな芽が出ました。好きなときに水をどうぞ。"],
      water: ["A little water. Now it can grow while you wander.", "お水を少し。あとは、お散歩している間に育ちます。"],
      harvest: ["Something lovely for your basket.", "かごに小さな収穫を。"],
      flowers: ["A little shower for the flowers.", "お花たちに小さなシャワー。"],
      drink: ["Fresh from your garden. A warm sip, a quiet moment.", "あなたの庭から、あたたかいひと口。ほっとするひととき。"],
      feed: ["Here come the little duckies.", "小さなアヒルたちがやってきました。"],
    };
    setNotice(messages[action.kind][preferences.current.language === "ja" ? 1 : 0]);
  }, []);
  useEffect(() => {
    if (!simple) return;
    if (birdStatus === "flying" || birdStatus === "crumbs") { setBirdStatus(birdStatus === "crumbs" ? "eating" : "waiting"); return; }
    if (birdStatus !== "eating" && birdStatus !== "happy") return;
    if (birdStatus === "happy") audio.current?.gardenEffect("coo", [0, 0, 0], true);
    const timer = setTimeout(() => setBirdStatus(birdStatus === "eating" ? "happy" : "waiting"), birdStatus === "eating" ? 4000 : 6000);
    return () => clearTimeout(timer);
  }, [simple, birdStatus]);
  const interactGarden = useCallback((id: string) => {
    const action = nearbyGardenAction(id, gardenRef.current);
    if (!action) return;
    if (action.kind === "feed" && !gardenRef.current.crumbPouch) { setPanel("friends"); return; }
    if (action.kind === "drink") { openPlace("mood"); }
    onGardenAction(action);
  }, [onGardenAction, openPlace]);
  useEffect(() => {
    audio.current = new VillageAudio(() => setNotice(preferences.current.language === "ja"
      ? "音楽を切り替えられませんでした。音をオフにして、もう一度お試しください。"
      : "The music couldn't change. Turn sound off and on to retry."));
    try { const saved = readGarden(localStorage.getItem(GARDEN_KEY)); gardenRef.current = saved; setGarden(saved); }
    catch { setGardenStorageError(true); }
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
    setPreferencesLoaded(true);
    return () => audio.current?.dispose();
  }, []);
  useEffect(() => {
    const refresh = () => {
      if (sharedTrialModeRef.current) return;
      const next = growGarden(gardenRef.current);
      if (next === gardenRef.current) return;
      gardenRef.current = next; setGarden(next); engine.current?.setGarden(next);
      try { localStorage.setItem(GARDEN_KEY, JSON.stringify(next)); setGardenStorageError(false); }
      catch { setGardenStorageError(true); }
    };
    const interval = setInterval(refresh, 1000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(interval); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  useEffect(() => {
    if (!entered || simple || (process.env.NODE_ENV === "development"
      ? new URLSearchParams(location.search).get("sharedTrial") !== "1"
      : !process.env.NEXT_PUBLIC_SHARED_WORLD_URL)) return;
    let cancelled = false;
    let peopleKey = "", chatKey = "";
    sharedTrialModeRef.current = true;
    setSharedTrialEnabled(true);
    void import("./sharedWorld").then(({ connectSharedWorld }) => connectSharedWorld({
      getPose: () => engine.current?.getPlayerPose() ?? null,
      onState: snapshot => {
        if (cancelled) return;
        sharedConnectedRef.current = true;
        setSharedSelfId(snapshot.selfId);
        const self = snapshot.visitors.find(visitor => visitor.id === snapshot.selfId);
        if (self && (self.slot !== sharedIdentityRef.current?.slot || self.color !== sharedIdentityRef.current?.color)) {
          sharedIdentityRef.current = { slot: self.slot, color: self.color };
          engine.current?.setSharedIdentity(self.slot, self.color);
        }
        if (snapshot.gardenChanged) {
          gardenRef.current = snapshot.garden;
          setGarden(snapshot.garden);
          engine.current?.setGarden(snapshot.garden);
        }
        const visitors = snapshot.visitors.filter(visitor => visitor.id !== snapshot.selfId);
        sharedVisitorsRef.current = visitors;
        engine.current?.setRemoteVisitors(visitors);
        const nextPeopleKey = snapshot.visitors.map(visitor => `${visitor.id}:${visitor.name}:${visitor.color}`).sort().join("|");
        if (nextPeopleKey !== peopleKey) {
          peopleKey = nextPeopleKey;
          setSharedPeople(snapshot.visitors.map(({ id, name, color }) => ({ id, name, color })));
        }
        const nextChatKey = `${snapshot.chatHour}:${JSON.stringify(snapshot.chat)}`;
        if (nextChatKey !== chatKey) {
          chatKey = nextChatKey;
          setSharedChat(snapshot.chat);
          setSharedChatHour(snapshot.chatHour);
        }
        setSharedStatus("Connected");
      },
      onAction: event => { if (!cancelled) engine.current?.gardenAction(event.action, { x: event.x, z: event.z }, event.isSelf); },
      onDisconnect: () => {
        if (cancelled) return;
        sharedConnectedRef.current = false;
        sharedVisitorsRef.current = [];
        engine.current?.setRemoteVisitors([]);
        setSharedPeople([]);
        setSharedStatus("Disconnected");
      },
    })).then(connection => {
      if (cancelled) connection.close();
      else sharedTrialRef.current = connection;
    }).catch(error => { if (!cancelled) setSharedStatus(error instanceof Error ? error.message : "Could not connect"); });
    return () => {
      cancelled = true;
      sharedTrialRef.current?.close();
      sharedTrialRef.current = null;
      sharedVisitorsRef.current = [];
      sharedIdentityRef.current = null;
      sharedTrialModeRef.current = false;
      sharedConnectedRef.current = false;
    };
  }, [entered, simple]);
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
          mouseLook: setMouseLook,
          companion: toggleCompanion,
          crumbs: id => onGardenAction({ kind: id === "wren" ? "birdCrumbs" : "crumbs" }),
          birds: setBirdStatus,
          visitTea: () => openPlace("mood"),
          gardenSound: (kind, position) => audio.current?.gardenEffect(kind, position),
          nearGarden: setNearGarden,
          gardenInteract: interactGarden,
          contact: event => audio.current?.contact(event),
          environment: frame => audio.current?.setEnvironment(frame),
          ready: () => {
            if (!cancelled) setReady(true);
          },
          near: setNear,
          nearBench: setNearBench,
          seat: setSeatedBench,
          scatterBirds: () => onGardenAction({ kind: "feedBirds" }),
          interact: openPlace,
          error: (msg) => {
            setError(msg);
            setSimple(true);
          },
          stats: (fps, draws, triangles) => setStats({ fps, draws, triangles }),
        });
        engine.current = local;
        local.setGarden(gardenRef.current);
        local.setCompanions(companionsRef.current);
        local.setBlocked(!enterRef.current);
        await local.load();
        if (!cancelled) {
          local.setGarden(gardenRef.current);
          if (sharedIdentityRef.current) local.setSharedIdentity(sharedIdentityRef.current.slot, sharedIdentityRef.current.color);
          local.setRemoteVisitors(sharedVisitorsRef.current);
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
    if (!preferencesLoaded) return;
    try {
      localStorage.setItem(
        "cosy-village-preferences",
        JSON.stringify({ mix, quality, weather, language }),
      );
    } catch {}
  }, [mix, quality, weather, language, preferencesLoaded]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 7000);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    if (!lumaSpeech) return;
    const id = setTimeout(() => setLumaSpeech(null), 6000);
    return () => clearTimeout(id);
  }, [lumaSpeech]);
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
  async function enableSound() {
    if (soundBusy.current || sound) return;
    try {
      soundBusy.current = true;
      setSoundLoading(true);
      const result = await audio.current?.start();
      setSound(true);
      if (result && !result.ambience) setNotice(t("Some nature recordings could not load. Music is still available; turn sound off and on to retry.", "環境音の一部を読み込めませんでした。音楽は再生できます。音をオフにして再度お試しください。"));
    } catch {
      audio.current?.stop();
      setSound(false);
      setNotice(t("Audio could not start. Please try again.", "音を再生できませんでした。もう一度お試しください。"));
    } finally {
      soundBusy.current = false;
      setSoundLoading(false);
    }
  }
  function toggleSound() {
    if (soundBusy.current) return;
    if (sound) {
      audio.current?.stop();
      setSound(false);
    } else void enableSound();
  }
  const current = PLACES.find((p) => p.id === place),
    nearPlace = PLACES.find((p) => p.id === near);
  const showWorldInteraction = entered && !place && !simple;
  const nearBirds = nearPlace?.id === "birds" || seatedBench === "bird-clearing-bench";
  const birdMealBusy = birdStatus === "crumbs" || birdStatus === "eating" || birdStatus === "happy";
  const showActivityPanel = entered && place && (!activityCompact || simple);
  const nearbyAction = nearGarden ? nearbyGardenAction(nearGarden, garden) : null;
  const nearbyLabel = nearbyAction?.kind === "plant" ? t(`Plant ${CROP_NAMES[nearbyAction.crop].en.toLowerCase()}`, "種を植える")
    : nearbyAction?.kind === "water" ? t("Water the sprouts", "芽に水をあげる")
    : nearbyAction?.kind === "harvest" ? t("Pick your harvest", "収穫する")
    : nearbyAction?.kind === "basket" ? t("Open harvest basket", "収穫かごを開く")
    : nearbyAction?.kind === "flowers" ? t("Water the irises", "アイリスに水をあげる")
    : nearbyAction?.kind === "feed" ? garden.crumbPouch ? t("Feed the little duckies", "アヒルたちにパンくずをあげる") : t("Ask Maple for bread crumbs", "メープルにパンくずをもらう")
    : t("Enjoy your mint tea", "ミントティーを楽しむ");
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
          {entered && <button aria-label={t("Friends", "仲間")} onClick={() => setPanel("friends")}>
            <UsersThree size={21} /><span>{t("Friends", "仲間")}{companions.length > 0 ? ` · ${companions.length}` : ""}</span>
          </button>}
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
                  void enableSound();
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
                void enableSound();
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
          <footer className="v-walk-hints">
            <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> {t("Glide", "移動")}</span>
            <span>{mouseLook === "locked" ? t("Mouse to look · Esc to release", "マウスで見回す · Escで解除")
              : mouseLook === "drag" ? t("Mouse capture unavailable · drag to look", "マウスを固定できません · ドラッグで見回す")
                : t("Click to look · Esc to release", "クリックで見回す · Escで解除")}</span>
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
        {notice && <div className="v-notice" role="status">{notice}</div>}
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
          gardenControls={{ garden, onGardenAction, birdStatus, language, lumaSpeech: simple ? lumaSpeech : null, travel: openPlace, meetMaple: () => setPanel("friends") }}
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
      {!showActivityPanel && <div className={`v-world-feedback${showWorldInteraction ? " is-walking" : ""}`}>
        {notice && <div className="v-notice" role="status">{notice}</div>}
        {showWorldInteraction && seatedBench && <button className="v-interact" onClick={() => engine.current?.stand()}><kbd>E</kbd>{t("Stand up", "立ち上がる")}</button>}
        {showWorldInteraction && !seatedBench && nearBench && <button className="v-interact" onClick={() => engine.current?.sit(nearBench)}><kbd>E</kbd>{t("Sit on the bench", "ベンチに座る")}</button>}
        {showWorldInteraction && !seatedBench && !nearBench && nearGarden && nearbyAction && <button className="v-interact" onClick={() => interactGarden(nearGarden)}><kbd>E</kbd>{nearbyLabel}<Leaf size={17} /></button>}
        {showWorldInteraction && nearBirds && !nearbyAction && <button className="v-interact" disabled={birdMealBusy} onClick={() => onGardenAction({ kind: "feedBirds" })}>{!nearBench && !seatedBench && <kbd>E</kbd>}{t("Scatter sourdough crumbs", "サワードウのパンくずを撒く")}<Bird size={17} /></button>}
        {showWorldInteraction && nearPlace && nearPlace.id !== "birds" && !nearBench && !seatedBench && !nearbyAction && <button className="v-interact" onClick={() => openPlace(nearPlace.id)}>
          <kbd>E</kbd>{ja ? placeName(nearPlace.id) : nearPlace.prompt}<ArrowUpRight size={16} />
        </button>}
      </div>}
      {gardenStorageError && !sharedTrialEnabled && <div className="v-save-warning" role="status">{t("Your garden works for this visit, but this browser couldn't save it.", "この訪問中は遊べますが、庭をブラウザに保存できませんでした。")}</div>}
      {sharedTrialEnabled && entered && <div className="v-shared-trial">
        <button className="v-shared-toggle" onClick={() => setChatOpen(open => !open)} aria-expanded={chatOpen}>
          <UsersThree size={18} /> {sharedStatus === "Connected" ? `${sharedPeople.length} ${sharedPeople.length === 1 ? "blob" : "blobs"} here` : sharedStatus}
        </button>
        {chatOpen && <section className="v-shared-chat" aria-label="Village chat">
          <div className="v-shared-chat-header"><h2>Village chat</h2><button onClick={() => setChatOpen(false)} aria-label="Close village chat"><X size={18} /></button></div>
          <div className="v-shared-people">{sharedPeople.map(person => <span key={person.id}><i style={{ background: person.color }} />{person.name}{person.id === sharedSelfId ? " (you)" : ""}</span>)}</div>
          <p className="v-shared-chat-note">Everyone is in this village. Messages clear each hour{sharedChatHour ? `, at ${new Date((sharedChatHour + 1) * 3_600_000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}.</p>
          <div className="v-shared-chat-log" role="log" aria-live="polite">{sharedChat.length ? sharedChat.map((entry, index) => <p key={index}><strong>{entry.name}</strong> {entry.message}</p>) : <p className="v-shared-chat-empty">Say hello to the other blobs.</p>}</div>
          <form onSubmit={event => { event.preventDefault(); const message = chatDraft.trim(); if (message && sharedTrialRef.current) { sharedTrialRef.current.sendChat(message); setChatDraft(""); } }}>
            <input aria-label="Message" value={chatDraft} onChange={event => setChatDraft(event.target.value)} onKeyDown={event => event.stopPropagation()} maxLength={180} placeholder="Say something kind…" disabled={sharedStatus !== "Connected"} />
            <button type="submit" disabled={!chatDraft.trim() || sharedStatus !== "Connected"}>Send</button>
          </form>
        </section>}
      </div>}
      {entered && companions.length > 0 && <div className="sr-only" role="status">{t("With you", "一緒にいる仲間")}: {VILLAGERS.filter(v => companions.includes(v.id)).map(v => v.name[language]).join(", ")}</div>}
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
                  : panel === "friends"
                    ? t("A little company.", "誰かと一緒に。")
                  : panel === "basket"
                    ? t("Harvest basket", "収穫かご")
                  : panel === "controls"
                    ? t("Getting around", "移動と操作")
                    : t("Make it yours.", "お好みに。")}
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              {panel === "places"
                ? "Travel directly to a village activity."
                : panel === "sound"
                  ? "Music and ambience controls."
                  : panel === "friends"
                    ? "Invite villagers to walk and share activities."
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
            {panel === "friends" && <div className="v-friends">
              <p>{t("Invite anyone you like, or bring everyone. They'll wander with you and join you when you settle in.", "誰でも、みんなでも。一緒にお散歩して、ひと休みもできます。")}</p>
              <button className="v-button" onClick={() => {
                const next = companions.length === VILLAGERS.length ? [] : VILLAGERS.map(v => v.id);
                companionsRef.current = next; setCompanions(next); engine.current?.setCompanions(next);
              }}>{companions.length === VILLAGERS.length ? t("Let everyone wander", "みんなと別れる") : t("Invite everyone", "みんなを誘う")}</button>
              {VILLAGERS.map(v => <div className="v-friend" key={v.id}>
                <div className="v-friend-name"><span style={{ background: v.color }} aria-hidden="true" /><strong>{v.name[language]}</strong></div>
                <button className="v-button" aria-pressed={companions.includes(v.id)} aria-label={companions.includes(v.id) ? t(`Let ${v.name.en} wander`, `${v.name.ja}と別れる`) : t(`Invite ${v.name.en}`, `${v.name.ja}を誘う`)} onClick={() => toggleCompanion(v.id)}>{companions.includes(v.id) ? t("See you later", "またね") : t("Walk with me", "一緒に歩く")}</button>
                {v.id === "luma" && <button className="v-text-button" onClick={() => openPlace("mood")}>{t("Share your harvest over tea", "収穫を持ってお茶をしよう")}</button>}
                {v.id === "wren" && <div className="v-maple-gift"><p>{t("Wren tends the bird clearing with a little pouch of sourdough crumbs.", "レンはサワードウのパンくずを持って、小鳥の広場のお世話をしています。")}</p>
                  <button className="v-button" onClick={() => onGardenAction({ kind: "birdCrumbs" })}>{t("Chat with Wren · Ask for crumbs", "レンと話してパンくずをもらう")}</button>
                </div>}
                {v.id === "maple" && <div className="v-maple-gift"><p>{t("Our baker has a little something for the duckies.", "パン屋さんから、アヒルたちへ小さな贈りもの。")}</p>
                  <button className="v-button" onClick={() => onGardenAction({ kind: "crumbs" })}>{garden.crumbPouch ? t("A few more crumbs, Maple?", "メープル、もう少しパンくずを？") : t("Ask Maple for bread crumbs", "メープルにパンくずをもらう")}</button>
                  {garden.crumbPouch && <button className="v-text-button" onClick={() => openPlace("breathe")}>{t("Take the crumbs to the pond", "パンくずを池へ持っていく")}</button>}
                </div>}
              </div>)}
            </div>}
            {panel === "controls" && (
              <div className="v-control-guide">
                <p>{t("Wander at your own pace, or use Places to settle straight into an activity.", "自分のペースでお散歩。場所メニューから、好きな場所へすぐに移動できます。")}</p>
                <dl>
                  {[
                    ["W A S D / ↑ ↓ ← →", t("Glide", "浮かんで移動")],
                    [t("Click, then move mouse", "クリックしてマウスを動かす"), t("Look around without holding a button", "ボタンを押さずに見回す")],
                    ["Esc", t("Release the mouse / close", "マウスを解除 / 閉じる")],
                    [t("Touch drag", "タッチでドラッグ"), t("Look around", "見回す")],
                    [t("Drag while settled", "ひと休み中にドラッグ"), t("Move the camera around your activity", "その場でカメラを動かす")],
                    [t("Scroll", "スクロール"), t("Move the camera closer or farther", "カメラの距離")],
                    ["R", t("Toggle gentle / quick glide", "ゆっくり / 速く")],
                    ["Shift", t("Hold to dash", "長押しでダッシュ")],
                    ["Space", t("Jump", "ジャンプ")],
                    ["E", t("Garden / enjoy a nearby activity", "庭のお世話 / 近くの場所に入る")],
                    ["F", t("Chat with a villager", "村人とおしゃべり")],
                    ["C", t("Invite a nearby villager / say goodbye", "近くの村人を誘う / またね")],
                    ["B", t("Ask Maple for bread crumbs nearby", "近くのメープルにパンくずをもらう")],
                    ["M", t("Places", "場所")],
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
                      if (!entered) void enableSound();
                      setEntered(true);
                      openPlace(p.id);
                    }}
                  >
                    <span className="v-place-icon" aria-hidden="true">{[<Timer key="focus" size={23}/>,<Fire key="music" size={23}/>,<Drop key="breathe" size={23}/>,<Coffee key="mood" size={23}/>,<BookOpen key="gratitude" size={23}/>,<EnvelopeSimple key="compliment" size={23}/>,<Leaf key="garden" size={23}/>,<Bird key="birds" size={23}/>][PLACES.findIndex(a=>a.id===p.id)]}</span>
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
                              "野菜、お花とミント",
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

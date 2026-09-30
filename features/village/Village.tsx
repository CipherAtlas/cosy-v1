"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  PawPrint,
} from "@phosphor-icons/react";
import {
  PLACES,
  JAPANESE_PLACE_NAMES as japaneseNames,
  DEFAULT_MIX,
  type PlaceId,
  type Quality,
  type Weather,
  type AudioMix,
  localTimeWeather,
} from "./places";
import { Activities, MixSliders, SoundtrackChoices } from "./Activities";
import { RadioDock, SoundPanel } from "./RadioControls";
import { isRadioStationId, isRadioTrack, RADIO_PAGE_SIZE, RADIO_STATIONS, searchRadio, type RadioStationId } from "./radioCatalog";
import type { RadioTrack } from "./soundtrack";
import { HarvestInventory } from "./GardenActivities";
import { VillageAudio } from "./audio";
import { PUPPY_INFO, PUPPY_TRICKS, puppyCommandForKey, type NearbyPuppy } from "./puppies";
import { useSession } from "./useSession";
import type { ActivityMoment, MovementStatus } from "./environment";
import type { VillageEngine } from "./VillageEngine";
import "./village.css";
import { withBasePath } from "@/lib/basePath";
import type { BirdStatus } from "./birds";
import { VILLAGERS } from "./villagers";
import { GARDEN_KEY, CROP_NAMES, freshGarden, readGarden, growGarden, gardenAction, gardenActionAllowed, nearbyGardenAction, type GardenAction } from "./garden";
import type { SharedChatEntry, SharedWorldConnection, SharedVisitor } from "./sharedWorld";

type RadioPreferences = { mode: "radio" | "village"; station: RadioStationId; track: RadioTrack | null; favorites: RadioTrack[]; queue: RadioTrack[]; paused: boolean };
const INITIAL_RADIO: RadioPreferences = { mode: "radio", station: "lofi", track: null, favorites: [], queue: [], paused: false };
// The personal radio is retained for a later release; the village currently plays its original recordings.
const PERSONAL_RADIO_ENABLED = false;

export function Village() {
  const [isPhone, setIsPhone] = useState<boolean | null>(null);
  useEffect(() => {
    const browser = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
    setIsPhone(browser.userAgentData?.mobile === true || /iPhone|iPod|Android.*Mobile|Windows Phone|IEMobile|Opera Mini/i.test(browser.userAgent));
  }, []);
  if (isPhone === false) return <VillageScene />;
  return <main className="v-device-gate" aria-busy={isPhone === null}>
    <h1>Hearthwillow</h1>
    <p role="status">{isPhone ? "Please open the village on a laptop or PC." : "Opening the village…"}</p>
  </main>;
}

function VillageScene() {
  const canvas = useRef<HTMLDivElement>(null),
    engine = useRef<VillageEngine | null>(null),
    audio = useRef<VillageAudio | null>(null);
  const [progress, setProgress] = useState(0),
    [ready, setReady] = useState(false),
    [entered, setEntered] = useState(false),
    [error, setError] = useState("");
  const [engineAttempt, setEngineAttempt] = useState(0);
  const [place, setPlace] = useState<PlaceId | null>(null),
    [near, setNear] = useState<PlaceId | null>(null),
    [panel, setPanel] = useState<"places" | "sound" | "settings" | "controls" | "basket" | null>(null);
  const [birdStatus, setBirdStatus] = useState<BirdStatus>("flying");
  const [nearBench, setNearBench] = useState<string | null>(null);
  const [seatedBench, setSeatedBench] = useState<string | null>(null);
  const [nearSwing, setNearSwing] = useState<import("./swings").SwingSeat | null>(null);
  const [ridingSwing, setRidingSwing] = useState<import("./swings").SwingSeat | null>(null);
  const [garden, setGarden] = useState(freshGarden);
  const gardenRef = useRef(garden);
  const crumbsReadyRef = useRef(false);
  const sharedTrialModeRef = useRef(false);
  const sharedTrialRef = useRef<SharedWorldConnection | null>(null);
  const sharedConnectedRef = useRef(false);
  const sharedVisitorsRef = useRef<SharedVisitor[]>([]);
  const sharedPeopleRef = useRef<SharedVisitor[]>([]);
  const sharedSelfIdRef = useRef("");
  const sharedIdentityRef = useRef<Pick<SharedVisitor, "slot" | "color"> | null>(null);
  const [sharedTrialEnabled, setSharedTrialEnabled] = useState(false);
  const [sharedStatus, setSharedStatus] = useState("Connecting…");
  const [sharedPeople, setSharedPeople] = useState<Pick<SharedVisitor, "id" | "name" | "color">[]>([]);
  const [sharedSelfId, setSharedSelfId] = useState("");
  const [sharedChat, setSharedChat] = useState<SharedChatEntry[]>([]);
  const [sharedChatHour, setSharedChatHour] = useState(0);
  const [chatOpen, setChatOpen] = useState(true);
  const chatOpenRef = useRef(chatOpen);
  chatOpenRef.current = chatOpen;
  const [chatUnread, setChatUnread] = useState(false);
  const [chatPulse, setChatPulse] = useState(0);
  const [chatDraft, setChatDraft] = useState("");
  const [chatCooldownUntil, setChatCooldownUntil] = useState(0);
  const [, setChatClock] = useState(0);
  const chatInput = useRef<HTMLInputElement>(null);
  const chatLog = useRef<HTMLDivElement>(null);
  const [companions, setCompanions] = useState<string[]>([]);
  const companionsRef = useRef(companions);
  const [activityCompact,setActivityCompact]=useState(false);
  const onMoment=useCallback((moment:ActivityMoment)=>engine.current?.setActivityMoment(moment),[]);
  const soundBusy = useRef(false);
  const [movement, setMovement] = useState<MovementStatus>({ gait: "idle", running: false });
  const [mouseLook, setMouseLook] = useState<"free" | "locked" | "drag">("free");
  const [soundLoading, setSoundLoading] = useState(false);
  const [radioExpanded, setRadioExpanded] = useState(false);
  const [radioPrefs, setRadioPrefs] = useState<RadioPreferences>(INITIAL_RADIO);
  const radioPrefsRef = useRef(radioPrefs);
  radioPrefsRef.current = radioPrefs;
  const radioEnded = useRef<() => void>(() => {});
  const radioChoiceId = useRef(0);
  const [radioLoaded, setRadioLoaded] = useState(false);
  const [radioRequest, setRadioRequest] = useState(0);
  const radioStation = useRef<RadioTrack[]>([]);
  const radioPage = useRef(0);
  const radioHasMore = useRef(false);
  const radioNextBusy = useRef(false);
  const radioNextController = useRef<AbortController | null>(null);
  const [radioLoading, setRadioLoading] = useState(false);
  const [radioError, setRadioError] = useState("");
  const [sound, setSound] = useState(false),
    [mix, setMix] = useState<AudioMix>(DEFAULT_MIX),
    [quality, setQuality] = useState<Quality>("low"),
    [weather, setWeather] = useState<Weather>("golden"),
    [weatherMode, setWeatherMode] = useState<"auto" | "manual">("auto"),
    [language, setLanguage] = useState<"en" | "ja">("en"),
    [mouseSensitivity, setMouseSensitivity] = useState(1),
    [showStats, setShowStats] = useState(false),
    [stats, setStats] = useState({ fps: 0, draws: 0, triangles: 0 });
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const preferences = useRef({ quality, weather, language, mouseSensitivity });
  preferences.current = { quality, weather, language, mouseSensitivity };
  const [notice, setNotice] = useState("");
  const [gardenStorageError, setGardenStorageError] = useState(false);
  const [nearGarden, setNearGarden] = useState<string | null>(null);
  const [nearPuppy, setNearPuppy] = useState<NearbyPuppy | null>(null);
  const [followingPuppies, setFollowingPuppies] = useState<NearbyPuppy[]>([]);
  const [tricksPuppyId, setTricksPuppyId] = useState<string | null>(null);
  const puppyTricksToggle = useRef<HTMLButtonElement>(null);
  const [performanceReport, setPerformanceReport] = useState("");
  const [sceneryLoading, setSceneryLoading] = useState<Weather | null>(null);
  const enterRef = useRef(false);
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
  const toggleCompanion = useCallback((id: string) => {
    if (!VILLAGERS.some(v => v.id === id)) return;
    const next = companionsRef.current.includes(id) ? companionsRef.current.filter(value => value !== id) : [...companionsRef.current, id];
    companionsRef.current = next; setCompanions(next); engine.current?.setCompanions(next);
  }, []);
  const onGardenAction = useCallback((action: GardenAction) => {
    if (action.kind === "basket") { setPanel("basket"); return; }
    if ((action.kind === "feed" || action.kind === "feedBirds") && !crumbsReadyRef.current) {
      setNotice(preferences.current.language === "ja" ? "先にメープルかレンに話しかけて、パンくずをもらいましょう。" : "Talk to Maple or Wren nearby to get crumbs first.");
      return;
    }
    if (action.kind === "crumbs" || action.kind === "birdCrumbs") {
      if (sharedTrialModeRef.current && (!sharedConnectedRef.current || !sharedTrialRef.current)) {
        setNotice(preferences.current.language === "ja" ? "村との接続を待っています。" : "Wait for the village to reconnect.");
        return;
      }
      crumbsReadyRef.current = true;
      const next = { ...gardenRef.current, crumbPouch: true };
      gardenRef.current = next; setGarden(next); engine.current?.setGarden(next);
      setNotice("");
    }
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
  const scatterBenchCrumbs = useCallback(() => {
    if (!engine.current?.sittingAtBirdBench) return;
    if (!crumbsReadyRef.current) onGardenAction({ kind: "birdCrumbs" });
    onGardenAction({ kind: "feedBirds" });
  }, [onGardenAction]);
  const interactGarden = useCallback((id: string) => {
    const action = nearbyGardenAction(id, gardenRef.current);
    if (!action) return;
    if (action.kind === "feed" && !crumbsReadyRef.current) { onGardenAction(action); return; }
    if (action.kind === "drink") { openPlace("mood"); }
    onGardenAction(action);
  }, [onGardenAction, openPlace]);
  useEffect(() => {
    audio.current = new VillageAudio(() => setNotice(preferences.current.language === "ja"
      ? "音楽を切り替えられませんでした。音をオフにして、もう一度お試しください。"
      : "The music couldn't change. Turn sound off and on to retry."), () => radioEnded.current());
    if (PERSONAL_RADIO_ENABLED) try {
      const stored = JSON.parse(localStorage.getItem("cosy-village-radio") || "null");
      if (stored && typeof stored === "object") {
        const saved: RadioPreferences = {
          mode: stored.mode === "village" ? "village" : "radio",
          station: isRadioStationId(stored.station) ? stored.station : "lofi",
          track: isRadioTrack(stored.track) ? stored.track : null,
          favorites: Array.isArray(stored.favorites) ? stored.favorites.filter(isRadioTrack).slice(0, 100) : [],
          queue: Array.isArray(stored.queue) ? stored.queue.filter(isRadioTrack).slice(0, 100) : [],
          paused: stored.paused === true,
        };
        radioPrefsRef.current = saved; setRadioPrefs(saved);
        if (typeof stored.expanded === "boolean") setRadioExpanded(stored.expanded);
        if (saved.mode === "radio" && saved.track) void audio.current.selectRadio(saved.track);
        audio.current.setMusicPaused(saved.paused);
      }
    } catch {}
    if (PERSONAL_RADIO_ENABLED) setRadioLoaded(true);
    try { const saved = { ...readGarden(localStorage.getItem(GARDEN_KEY)), crumbPouch: false }; gardenRef.current = saved; setGarden(saved); }
    catch { setGardenStorageError(true); }
    try {
      const p = JSON.parse(
        localStorage.getItem("cosy-village-preferences") || "null",
      );
      if (p) {
        // Graphics are chosen per visit so older saved Detailed choices cannot raise the default.
        const savedWeather: Weather | null = ["golden", "dusk", "night", "rain"].includes(p.weather) ? p.weather : null;
        // Older preferences saved the default golden scene even if it was never selected.
        if (savedWeather && (p.weatherMode === "manual" || (p.weatherMode === undefined && savedWeather !== "golden"))) {
          setWeather(savedWeather);
          setWeatherMode("manual");
        }
        if (p.language === "ja") setLanguage("ja");
        if (typeof p.mouseSensitivity === "number" && Number.isFinite(p.mouseSensitivity)
          && p.mouseSensitivity >= .25 && p.mouseSensitivity <= 2)
          setMouseSensitivity(p.mouseSensitivity);
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
            river: typeof p.mix.river === "number" && p.mix.river >= 0 && p.mix.river <= 1 ? p.mix.river : 1,
            wind: typeof p.mix.wind === "number" && p.mix.wind >= 0 && p.mix.wind <= 1 ? p.mix.wind : 1,
          });
      }
    } catch {}
    setPreferencesLoaded(true);
    return () => audio.current?.dispose();
  }, []);
  useEffect(() => {
    const refresh = () => {
      const next = growGarden(gardenRef.current);
      if (next === gardenRef.current) return;
      gardenRef.current = next; setGarden(next); engine.current?.setGarden(next);
      if (sharedTrialModeRef.current) return;
      try { localStorage.setItem(GARDEN_KEY, JSON.stringify(next)); setGardenStorageError(false); }
      catch { setGardenStorageError(true); }
    };
    const interval = setInterval(refresh, 1000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(interval); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  useEffect(() => {
    if (!entered || (process.env.NODE_ENV === "development"
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
        sharedSelfIdRef.current = snapshot.selfId;
        sharedPeopleRef.current = snapshot.visitors;
        setSharedSelfId(snapshot.selfId);
        const self = snapshot.visitors.find(visitor => visitor.id === snapshot.selfId);
        if (self && (self.slot !== sharedIdentityRef.current?.slot || self.color !== sharedIdentityRef.current?.color)) {
          sharedIdentityRef.current = { slot: self.slot, color: self.color };
          engine.current?.setSharedIdentity(self.slot, self.color);
        }
        if (snapshot.gardenChanged) {
          const personalGarden = { ...snapshot.garden, crumbPouch: crumbsReadyRef.current };
          gardenRef.current = personalGarden;
          setGarden(personalGarden);
          engine.current?.setGarden(personalGarden);
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
      onChat: entry => {
        if (cancelled) return;
        const selfName = sharedPeopleRef.current.find(visitor => visitor.id === sharedSelfIdRef.current)?.name ?? "";
        engine.current?.showChatBubble(entry, sharedSelfIdRef.current, selfName);
        if (!chatOpenRef.current) { setChatUnread(true); setChatPulse(value => value + 1); }
      },
      onChatModerated: removedMessageIds => engine.current?.removeChatBubbles(removedMessageIds),
      onChatCooldown: until => { if (!cancelled) setChatCooldownUntil(until); },
      onDisconnect: () => {
        if (cancelled) return;
        sharedConnectedRef.current = false;
        crumbsReadyRef.current = false;
        const withoutCrumbs = { ...gardenRef.current, crumbPouch: false };
        gardenRef.current = withoutCrumbs; setGarden(withoutCrumbs); engine.current?.setGarden(withoutCrumbs);
        sharedVisitorsRef.current = [];
        sharedPeopleRef.current = [];
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
      sharedPeopleRef.current = [];
      sharedSelfIdRef.current = "";
      sharedIdentityRef.current = null;
      sharedTrialModeRef.current = false;
      sharedConnectedRef.current = false;
    };
  }, [entered]);
  useEffect(() => {
    if (!canvas.current) return;
    let cancelled = false;
    let local: VillageEngine | undefined;
    import("./VillageEngine")
      .then(async ({ VillageEngine }) => {
        if (cancelled) return;
        setFollowingPuppies([]);
        local = new VillageEngine(canvas.current!, {
          progress: setProgress,
          movement: setMovement,
          recovered: result => setNotice(result === "nearby"
            ? preferences.current.language === "ja" ? "近くの安全な場所に戻りました。" : "Moved to nearby safe ground."
            : result === "entrance"
              ? preferences.current.language === "ja" ? "近くに安全な場所がないため、村の入り口に戻りました。" : "No clear ground nearby, so you returned to the village entrance."
              : preferences.current.language === "ja" ? "安全な場所が見つかりませんでした。" : "Could not find safe ground."),
          mouseLook: setMouseLook,
          companion: toggleCompanion,
          crumbs: id => onGardenAction({ kind: id === "wren" ? "birdCrumbs" : "crumbs" }),
          birds: setBirdStatus,
          visitTea: () => openPlace("mood"),
          gardenSound: (kind, position) => audio.current?.gardenEffect(kind, position),
          nearGarden: setNearGarden,
          gardenInteract: interactGarden,
          nearPuppy: setNearPuppy,
          puppyFollowing: puppies => {
            setFollowingPuppies(puppies);
            setNotice(preferences.current.language === "ja"
              ? puppies.length ? `${puppies.length}匹の犬がいっしょにお散歩します。` : "犬たちはいつもの場所に戻ります。"
              : puppies.length === 1 ? `${puppies[0].name} walks with you.`
                : puppies.length ? `${puppies.length} dogs are walking with you.` : "The dogs head back to their usual spots.");
          },
          puppySound: (breed, position, kind) => audio.current?.puppyEffect(breed, position, kind),
          puppyPetted: puppy => setNotice(preferences.current.language === "ja"
            ? `${puppy.name === PUPPY_INFO[puppy.breed].name ? PUPPY_INFO[puppy.breed].japanese : puppy.name}がなでてもらいに近づいてきます。`
            : `${puppy.name} comes closer for a gentle pet.`),
          puppyCommanded: (puppy, command) => {
            setTricksPuppyId(null);
            if (document.activeElement?.closest(".v-puppy-actions")) canvas.current?.querySelector("canvas")?.focus();
            const action = {
              sit: ["sits down for a little rest.", "はちょこんと座りました。"],
              dance: ["dances with happy little hops!", "は楽しそうに踊っています！"],
              spin: ["twirls around twice!", "はくるくる回っています！"],
              bow: ["does a playful bow.", "は遊ぼうのポーズをしています。"],
              wave: ["sits and waves a little paw!", "は座っておててを振っています！"],
              roll: ["tucks up and rolls over!", "はごろんと転がっています！"],
            }[command];
            setNotice(preferences.current.language === "ja"
              ? `${puppy.name === PUPPY_INFO[puppy.breed].name ? PUPPY_INFO[puppy.breed].japanese : puppy.name}${action[1]}`
              : `${puppy.name} ${action[0]}`);
          },
          contact: event => audio.current?.contact(event),
          environment: frame => audio.current?.setEnvironment(frame),
          ready: () => {
            if (!cancelled) setReady(true);
          },
          near: setNear,
          nearBench: setNearBench,
          seat: setSeatedBench,
          nearSwing: setNearSwing,
          ridingSwing: setRidingSwing,
          scatterBirds: fromBench => fromBench ? scatterBenchCrumbs() : onGardenAction({ kind: "feedBirds" }),
          interact: openPlace,
          error: (msg) => {
            setError(msg);
            setReady(false);
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
          local.setMouseSensitivity(preferences.current.mouseSensitivity);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          console.error("Village initialization failed", e);
          setError(
            "The village could not load. Please retry the 3D village.",
          );
          setReady(false);
        }
      });
    return () => {
      cancelled = true;
      local?.dispose();
      engine.current = null;
    };
    // Settings are applied independently, without remounting the world.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineAttempt, openPlace, scatterBenchCrumbs]);
  useEffect(() => {
    engine.current?.setBlocked(!entered || panel !== null || sceneryLoading !== null);
    enterRef.current = entered;
  }, [entered, panel, sceneryLoading]);
  useEffect(() => {
    document.documentElement.lang = language;
    engine.current?.setLanguage(language);
  }, [language]);
  useEffect(() => {
    engine.current?.setQuality(quality);
  }, [quality]);
  useEffect(() => {
    engine.current?.setMouseSensitivity(mouseSensitivity);
  }, [mouseSensitivity]);
  useEffect(() => {
    audio.current?.setWeather(weather);
    const local = engine.current;
    if (!local) return;
    if (!entered || !ready) { local.setWeather(weather); return; }
    let cancelled = false;
    setSceneryLoading(weather);
    // Let the full-screen state paint before WebGL prepares the new lighting.
    const timer = window.setTimeout(() => {
      void local.prepareWeather(weather).catch(() => {
        if (!cancelled) setNotice(t("The sky could not finish preparing. Try again.", "空の準備が終わりませんでした。もう一度お試しください。"));
      }).finally(() => { if (!cancelled) setSceneryLoading(null); });
    }, 50);
    return () => { cancelled = true; window.clearTimeout(timer); };
    // A weather change is the transition; entry and readiness are handled by load().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weather]);
  useEffect(() => {
    if (!preferencesLoaded || weatherMode !== "auto") return;
    const refresh = () => setWeather(localTimeWeather(new Date()));
    refresh();
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [preferencesLoaded, weatherMode]);
  useEffect(() => {
    audio.current?.setMix(mix);
  }, [mix]);
  useEffect(() => {
    if (!preferencesLoaded) return;
    try {
      localStorage.setItem(
        "cosy-village-preferences",
        JSON.stringify({ mix, weather, weatherMode, language, mouseSensitivity }),
      );
    } catch {}
  }, [mix, weather, weatherMode, language, mouseSensitivity, preferencesLoaded]);
  useEffect(() => {
    if (!PERSONAL_RADIO_ENABLED || !radioLoaded) return;
    try { localStorage.setItem("cosy-village-radio", JSON.stringify({ ...radioPrefs, expanded: radioExpanded })); } catch {}
  }, [radioPrefs, radioExpanded, radioLoaded]);
  const shouldSearchRadio = PERSONAL_RADIO_ENABLED && (entered || panel === "sound");
  useEffect(() => {
    if (!shouldSearchRadio || !radioLoaded || radioPrefs.mode !== "radio") return;
    const controller = new AbortController();
    radioNextController.current?.abort();
    radioStation.current = [];
    radioPage.current = 0;
    radioHasMore.current = false;
    setRadioLoading(true);
    setRadioError("");
    const query = RADIO_STATIONS.find(station => station.id === radioPrefs.station)!.query;
    void searchRadio(query, 0, controller.signal).then(({ tracks, hasMore }) => {
      if (controller.signal.aborted) return;
      radioStation.current = tracks.filter(track => track.duration >= 90 && track.duration <= 600);
      radioHasMore.current = hasMore;
      if (!radioPrefsRef.current.track && radioStation.current.length) void chooseRadioTrack(radioStation.current[0], entered);
      if (!radioStation.current.length) setRadioError(preferences.current.language === "ja" ? "この局の曲を読み込めませんでした。別の局をお試しください。" : "No songs loaded for this station. Try another.");
    }).catch(() => {
      if (!controller.signal.aborted) setRadioError(preferences.current.language === "ja" ? "局を読み込めませんでした。もう一度お試しください。" : "Could not tune the station. Try it again.");
    }).finally(() => { if (!controller.signal.aborted) setRadioLoading(false); });
    return () => { controller.abort(); radioNextController.current?.abort(); };
  }, [shouldSearchRadio, radioLoaded, radioPrefs.mode, radioPrefs.station, radioRequest]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 7000);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    if (chatOpen && chatLog.current) chatLog.current.scrollTop = chatLog.current.scrollHeight;
  }, [sharedChat, chatOpen]);
  useEffect(() => {
    if (!chatCooldownUntil) return;
    const timer = window.setInterval(() => {
      if (Date.now() >= chatCooldownUntil) {
        setChatCooldownUntil(0);
        window.clearInterval(timer);
      } else setChatClock(value => value + 1);
    }, 200);
    return () => window.clearInterval(timer);
  }, [chatCooldownUntil]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLButtonElement && !e.target.closest(".v-puppy-actions, .v-puppy-home, .v-swing-controls")) ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      )
        return;
      if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement) && sharedTrialEnabled && entered && !panel && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setChatOpen(true);
        setChatUnread(false);
        if (document.pointerLockElement) document.exitPointerLock();
        requestAnimationFrame(() => chatInput.current?.focus());
        return;
      }
      if (e.key === "Escape" && place && !panel) {
        leave();
      }
      if (e.key.toLowerCase() === "m" && !place && entered)
        setPanel((p) => (p === "places" ? null : "places"));
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [place, entered, panel, leave, sharedTrialEnabled]);
  async function enableSound() {
    if (soundBusy.current || sound) return;
    try {
      soundBusy.current = true;
      setSoundLoading(true);
      const result = await audio.current?.start();
      setSound(true);
      if (PERSONAL_RADIO_ENABLED && result?.radioFailed) {
        updateRadio(current => ({ ...current, mode: "village", track: null }));
        setNotice(t("The radio could not connect, so village music is playing.", "ラジオに接続できなかったため、村の音楽を再生しています。"));
      }
      if (result && !result.ambience) setNotice(t("Some nature recordings could not load. Music is still available; turn sound off and on to retry.", "環境音の一部を読み込めませんでした。音楽は再生できます。音をオフにして再度お試しください。"));
      else if (result && !result.puppies) setNotice(t("Some puppy sounds could not load. Turn sound off and on to retry.", "子犬の声の一部を読み込めませんでした。音をオフにして再度お試しください。"));
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
  function updateRadio(change: (current: RadioPreferences) => RadioPreferences) {
    const next = change(radioPrefsRef.current);
    radioPrefsRef.current = next;
    setRadioPrefs(next);
  }
  async function chooseRadioTrack(track: RadioTrack, startIfNeeded = true) {
    const choiceId = ++radioChoiceId.current;
    try {
      await audio.current?.selectRadio(track);
      if (choiceId !== radioChoiceId.current) return;
      updateRadio(current => ({ ...current, mode: "radio", track }));
      if (startIfNeeded && !sound) void enableSound();
    } catch {
      setNotice(t("That track could not play. Please choose another.", "この曲は再生できませんでした。別の曲を選んでください。"));
    }
  }
  async function playVillageMusic() {
    const choiceId = ++radioChoiceId.current;
    try {
      await audio.current?.selectRadio(null);
      if (choiceId !== radioChoiceId.current) return;
      updateRadio(current => ({ ...current, mode: "village", track: null }));
    } catch { setNotice(t("Village music could not start.", "村の音楽を再生できませんでした。")); }
  }
  function selectStation(station: RadioStationId) {
    ++radioChoiceId.current;
    radioNextController.current?.abort();
    updateRadio(current => ({ ...current, mode: "radio", station, track: null, paused: false }));
    audio.current?.setMusicPaused(false);
    setRadioRequest(request => request + 1);
  }
  function nextRadioTrack() {
    if (radioPrefsRef.current.mode === "village") { selectStation(radioPrefsRef.current.station); return; }
    if (radioLoading || radioNextBusy.current) return;
    const songs = radioStation.current;
    const index = songs.findIndex(track => track.id === radioPrefsRef.current.track?.id);
    if (index + 1 < songs.length) { void chooseRadioTrack(songs[index + 1]); return; }
    if (!radioHasMore.current) { if (songs.length) void chooseRadioTrack(songs[0]); return; }
    radioNextBusy.current = true;
    setRadioLoading(true);
    const controller = new AbortController();
    radioNextController.current = controller;
    const stationId = radioPrefsRef.current.station;
    const query = RADIO_STATIONS.find(station => station.id === stationId)!.query;
    const offset = radioPage.current + RADIO_PAGE_SIZE;
    void searchRadio(query, offset, controller.signal).then(({ tracks, hasMore }) => {
      if (controller.signal.aborted || radioPrefsRef.current.mode !== "radio" || radioPrefsRef.current.station !== stationId) return;
      radioPage.current = offset;
      radioHasMore.current = hasMore;
      const fresh = tracks.filter(track => track.duration >= 90 && track.duration <= 600 && !songs.some(item => item.id === track.id));
      radioStation.current = [...songs, ...fresh];
      if (fresh.length) void chooseRadioTrack(fresh[0]);
      else if (songs.length) void chooseRadioTrack(songs[0]);
    }).catch(() => {
      if (!controller.signal.aborted) setRadioError(preferences.current.language === "ja" ? "次の曲を読み込めませんでした。" : "Could not load the next song.");
    }).finally(() => {
      if (radioNextController.current === controller) { radioNextController.current = null; radioNextBusy.current = false; setRadioLoading(false); }
    });
  }
  radioEnded.current = nextRadioTrack;
  function toggleMusic() {
    const paused = radioPrefsRef.current.paused;
    const next = sound ? !paused : false;
    updateRadio(current => ({ ...current, paused: next }));
    audio.current?.setMusicPaused(next);
    if (!sound) void enableSound();
  }
  function openRadio() { setPanel("sound"); }
  const current = PLACES.find((p) => p.id === place),
    nearPlace = PLACES.find((p) => p.id === near);
  const showWorldInteraction = entered && !place;
  const chatCooldownSeconds = Math.min(3, Math.ceil(Math.max(0, chatCooldownUntil - Date.now()) / 1000));
  const chatPeople = chatOpen ? [...sharedPeople].sort((a, b) => a.id === sharedSelfId ? -1 : b.id === sharedSelfId ? 1 : 0) : [];
  const chatPeopleList = chatOpen && <div className="v-shared-people-list">{chatPeople.map(person => <span key={person.id}><i style={{ background: person.color }} />{person.name}{person.id === sharedSelfId ? " (you)" : ""}</span>)}</div>;
  const nearBirds = nearPlace?.id === "birds" || seatedBench === "bird-clearing-bench";
  const birdMealBusy = birdStatus === "crumbs" || birdStatus === "eating" || birdStatus === "happy";
  const showActivityPanel = entered && place && !activityCompact;
  const nearbyAction = nearGarden ? nearbyGardenAction(nearGarden, garden) : null;
  const showSwingActions = showWorldInteraction && !!(nearSwing || ridingSwing) && !panel && !sceneryLoading;
  const showPuppyActions = showWorldInteraction && !!nearPuppy && !nearBench && !seatedBench && !showSwingActions && !nearbyAction && !nearBirds && !panel && !sceneryLoading;
  const puppyIsFollowing = followingPuppies.some(puppy => puppy.id === nearPuppy?.id);
  const puppyTricksOpen = showPuppyActions && tricksPuppyId === nearPuppy?.id;
  const showPackHome = followingPuppies.length > 0 && !(showPuppyActions && puppyIsFollowing && followingPuppies.length === 1);
  useEffect(() => {
    setTricksPuppyId(null);
  }, [nearPuppy?.id, showPuppyActions]);
  useEffect(() => {
    if (!showPuppyActions || !nearPuppy) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey ||
        event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        (event.target instanceof HTMLElement && event.target.isContentEditable) ||
        (event.target instanceof HTMLButtonElement && !event.target.closest(".v-puppy-actions, .v-puppy-home"))) return;
      if (event.key.toLowerCase() === "t" || (event.key === "Escape" && puppyTricksOpen)) {
        event.preventDefault();
        setTricksPuppyId(puppyTricksOpen ? null : nearPuppy.id);
        if (document.pointerLockElement) document.exitPointerLock();
        if (puppyTricksOpen) canvas.current?.querySelector("canvas")?.focus();
        else puppyTricksToggle.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showPuppyActions, nearPuppy, puppyTricksOpen]);
  const nearbyLabel = nearbyAction?.kind === "plant" ? t(`Plant ${CROP_NAMES[nearbyAction.crop].en.toLowerCase()}`, "種を植える")
    : nearbyAction?.kind === "water" ? t("Water the sprouts", "芽に水をあげる")
    : nearbyAction?.kind === "harvest" ? t("Pick your harvest", "収穫する")
    : nearbyAction?.kind === "basket" ? t("Open harvest basket", "収穫かごを開く")
    : nearbyAction?.kind === "flowers" ? t("Water the irises", "アイリスに水をあげる")
    : nearbyAction?.kind === "feed" ? garden.crumbPouch ? t("Feed the little duckies", "アヒルたちにパンくずをあげる") : t("Find Maple or Wren for crumbs", "メープルかレンからパンくずをもらう")
    : t("Enjoy your mint tea", "ミントティーを楽しむ");
  const placeName = (id: PlaceId) =>
    ja
      ? japaneseNames[PLACES.findIndex((p) => p.id === id)]
      : PLACES.find((p) => p.id === id)!.name;
  return (
    <div
      className={`village ${entered ? "v-entered" : ""} ${place ? "v-settled" : ""}`}
      data-weather={weather}
      data-activity={place ?? "explore"}
    >
      <div className="v-canvas" ref={canvas} />
      <div className="v-shade" aria-hidden="true" />
      {sceneryLoading && typeof document !== "undefined" && createPortal(<div className="v-scenery-loading" role="status" aria-live="polite" aria-busy="true">
        <div className="v-scenery-loading-content">
          <Leaf size={35} weight="light" aria-hidden="true" />
          <h2>{t("Preparing the sky", "空を準備しています")}</h2>
          <p>{sceneryLoading === "night" ? t("Starlit night", "星降る夜")
            : sceneryLoading === "dusk" ? t("Blue hour", "薄暮")
            : sceneryLoading === "rain" ? t("Rainy afternoon", "雨の午後")
            : t("Golden hour", "夕暮れ")}</p>
          <span className="v-scenery-loading-line" aria-hidden="true" />
        </div>
      </div>, document.body)}
      <header className="v-header">
        <button
          className="v-wordmark"
          onClick={leave}
          aria-label={t("Return to village", "村に戻る")}
        >
          {current ? placeName(current.id) : "Hearthwillow"}
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
            disabled={!ready}
            aria-label={t("Places", "場所")}
            onClick={() => setPanel("places")}
          >
            <MapTrifold size={19} />
            <span>{t("Places", "場所")}</span>
          </button>
          <button
            disabled={!ready}
            aria-label={t("Sound", "音")}
            onClick={openRadio}
          >
            {sound ? <SpeakerHigh size={20} /> : <SpeakerSlash size={20} />}
            <span>{t("Sound", "音")}</span>
          </button>
          <button
            disabled={!ready}
            aria-label={t("Settings", "設定")}
            onClick={() => setPanel("settings")}
          >
            <GearSix size={20} />
          </button>
        </nav>
      </header>
      {PERSONAL_RADIO_ENABLED && entered && <RadioDock expanded={radioExpanded} setExpanded={setRadioExpanded}
        track={radioPrefs.mode === "radio" ? radioPrefs.track : null} mode={radioPrefs.mode} sound={sound} paused={radioPrefs.paused}
        loading={soundLoading} toggleMusic={toggleMusic}
        next={nextRadioTrack} openSound={openRadio} language={language} />}
      {!entered && (
        <div className="v-arrival">
          <div className="v-arrival-content">
            <h1>{t("Welcome to Hearthwillow.", "ハースウィローへようこそ。")}</h1>
            <p>
              {t(
                "A quiet village. A little time for yourself.",
                "静かな村で、自分のためのひとときを。",
              )}
            </p>
            {!ready && !error ? (
              <div className="v-loading">
                <progress max={100} value={progress} />
                <span>
                  {t("Opening the village", "村を準備しています")} · {progress}%
                </span>
              </div>
            ) : error ? (
              <button className="v-button v-primary v-enter-button" onClick={() => { setError(""); setProgress(0); setEngineAttempt(value => value + 1); }}>
                {t("Retry the village", "村をもう一度開く")}<ArrowRight size={19} />
              </button>
            ) : (
              <button
                className="v-button v-primary v-enter-button"
                onClick={() => {
                  void enableSound();
                  setEntered(true);
                  setPanel(null);
                }}
              >
                {t("Enter Hearthwillow", "ハースウィローに入る")}
                <ArrowRight size={19} />
              </button>
            )}
          </div>
        </div>
      )}
      {entered && !place && !ridingSwing && (
        <>
          <footer className="v-walk-hints">
            <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>{t("Move", "移動")}</span>
            <span><kbd>Shift</kbd>{t("Hold to run", "押して走る")}</span>
            <span><kbd>E</kbd>{t("Interact", "調べる")}</span>
            <span><kbd>R</kbd>{t("Recover", "安全な場所へ")}</span>
            <span>{mouseLook === "locked" ? t("Mouse to look · Esc to release", "マウスで見回す · Escで解除")
              : mouseLook === "drag" ? t("Mouse capture unavailable · drag to look", "マウスを固定できません · ドラッグで見回す")
                : t("Click to look · Esc to release", "クリックで見回す · Escで解除")}</span>
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
            <button onClick={() => engine.current?.resetPosition()}>{t("Unstuck", "安全な場所へ")}</button>
          </div>
        </>
      )}
      {entered && place && (
        <div id="v-activity-panel" hidden={activityCompact}>
        {notice && <div className="v-notice" role="status">{notice}</div>}
        <Activities
          key={place}
          onMoment={onMoment}
          place={place}
          session={focus}
          mix={mix}
          setMix={setMix}
          radioEnabled={PERSONAL_RADIO_ENABLED}
          sound={sound}
          toggleSound={toggleSound}
          musicPlaying={sound && !radioPrefs.paused && mix.music > 0 && mix.master > 0}
          soundLoading={soundLoading}
          toggleMusic={toggleMusic}
          openRadio={openRadio}
          language={language}
          gardenControls={{ garden, onGardenAction, birdStatus, language, travel: openPlace }}
        />
        </div>
      )}
      {entered && place && (
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
          {entered && <button onClick={() => { setError(""); setProgress(0); setEngineAttempt(value => value + 1); }}>{t("Retry the village", "村をもう一度開く")}</button>}
        </div>
      )}
      {!showActivityPanel && <div className={`v-world-feedback${showWorldInteraction ? " is-walking" : ""}${showPuppyActions ? " has-puppy-actions" : ""}${showSwingActions ? " has-swing-actions" : ""}${ridingSwing ? " is-swinging" : ""}`}>
        {notice && <div className="v-notice" role="status">{notice}</div>}
        {showSwingActions && <section className="v-swing-controls" aria-label={t("Swing controls", "ブランコの操作")}>
          <h2>{t("Meadow swings", "草原のブランコ")}</h2>
          {ridingSwing ? <>
            <p>{t("Alternate with the arc to swing higher.", "揺れに合わせて前へ・後ろへ。もっと高く！")}</p>
            <div className="v-swing-pump">
              {([['w', 'W', 'Forward', '前へ'], ['s', 'S', 'Back', '後ろへ']] as const).map(([key, shortcut, english, japanese]) =>
                <button key={key} className="v-interact" aria-keyshortcuts={shortcut}
                  onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); engine.current?.swingKey(key, true); }}
                  onPointerUp={() => engine.current?.swingKey(key, false)}
                  onPointerCancel={() => engine.current?.swingKey(key, false)}
                  onLostPointerCapture={() => engine.current?.swingKey(key, false)}
                  onBlur={() => engine.current?.swingKey(key, false)}
                  onClick={event => { if (event.detail === 0) engine.current?.pushSwing(key === 'w' ? 1 : -1); }}>
                  <kbd aria-hidden="true">{shortcut}</kbd>{t(english, japanese)}
                </button>)}
            </div>
            <div className="v-swing-secondary">
              <button className="v-interact" aria-keyshortcuts="Space"
                onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); engine.current?.swingKey(" ", true); }}
                onPointerUp={() => engine.current?.swingKey(" ", false)}
                onPointerCancel={() => engine.current?.swingKey(" ", false)}
                onLostPointerCapture={() => engine.current?.swingKey(" ", false)}
                onBlur={() => engine.current?.swingKey(" ", false)}
                onClick={event => { if (event.detail === 0) engine.current?.brakeSwing(); }}>
                <kbd aria-hidden="true">␣</kbd>{t("Brake", "ブレーキ")}
              </button>
              <button className="v-interact" aria-keyshortcuts="E" onClick={() => { engine.current?.leaveSwing(); canvas.current?.querySelector("canvas")?.focus(); }}>
                <kbd aria-hidden="true">E</kbd>{t("Get off", "降りる")}
              </button>
            </div>
          </> : nearSwing && <div className="v-swing-pump">
            {([0, 1] as const).map(index => <button key={index} className="v-interact" aria-keyshortcuts={nearSwing.index === index ? "E" : undefined}
              onClick={() => { engine.current?.rideSwing(nearSwing.id, index); canvas.current?.querySelector("canvas")?.focus(); }}>
              {nearSwing.index === index && <kbd aria-hidden="true">E</kbd>}{t(index === 0 ? "Left swing" : "Right swing", index === 0 ? "左のブランコ" : "右のブランコ")}
            </button>)}
          </div>}
        </section>}
        {showWorldInteraction && seatedBench && <button className="v-interact" onClick={() => engine.current?.stand()}><kbd>E</kbd>{t("Stand up", "立ち上がる")}</button>}
        {showWorldInteraction && !seatedBench && nearBench && <button className="v-interact" onClick={() => engine.current?.sit(nearBench)}><kbd>E</kbd>{t("Sit on the bench", "ベンチに座る")}</button>}
        {showWorldInteraction && !seatedBench && !nearBench && nearGarden && nearbyAction && <button className="v-interact" onClick={() => interactGarden(nearGarden)}><kbd>E</kbd>{nearbyLabel}<Leaf size={17} /></button>}
        {showWorldInteraction && nearBirds && !nearbyAction && <button className="v-interact v-bird-feed-button" disabled={birdMealBusy}
          aria-keyshortcuts={seatedBench === "bird-clearing-bench" ? "F" : !nearBench && !seatedBench ? "E" : undefined}
          onClick={() => seatedBench === "bird-clearing-bench" ? scatterBenchCrumbs() : onGardenAction({ kind: "feedBirds" })}
          onKeyDown={event => {
            const shortcut = seatedBench === "bird-clearing-bench" ? "f" : !nearBench && !seatedBench ? "e" : null;
            if (shortcut && event.key.toLowerCase() === shortcut && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey) {
              event.preventDefault(); event.stopPropagation();
              if (shortcut === "f") scatterBenchCrumbs(); else onGardenAction({ kind: "feedBirds" });
            }
          }}>
          {seatedBench === "bird-clearing-bench" ? <kbd aria-hidden="true">F</kbd> : !nearBench && !seatedBench && <kbd aria-hidden="true">E</kbd>}
          {seatedBench === "bird-clearing-bench" || garden.crumbPouch ? t("Scatter sourdough crumbs", "サワードウのパンくずを撒く") : t("Find Maple or Wren for crumbs", "メープルかレンからパンくずをもらう")}<Bird size={17} />
        </button>}
        {showWorldInteraction && !showPuppyActions && !showSwingActions && showPackHome && <button className="v-interact v-puppy-home" aria-keyshortcuts="H" onClick={() => engine.current?.sendPuppyHome()}
          onKeyDown={event => {
            if (event.key.toLowerCase() === "h" && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey) {
              event.preventDefault(); event.stopPropagation(); engine.current?.sendPuppyHome();
            }
          }}>
          <kbd aria-hidden="true">H</kbd>{t(followingPuppies.length === 1 ? `Send ${followingPuppies[0].name} home` : `Send all ${followingPuppies.length} dogs home`, "犬たちを元の場所に戻す")}
        </button>}
        {showPuppyActions && nearPuppy && <section className="v-puppy-actions" aria-label={t(`${nearPuppy.name} actions`, `${nearPuppy.name}とのふれあい`)}
          onKeyDown={event => {
            if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
            const key = event.key.toLowerCase();
            const command = puppyCommandForKey(event.key);
            if (!["e", "p", "h"].includes(key) && !command) return;
            event.preventDefault(); event.stopPropagation();
            if (key === "e") {
              canvas.current?.querySelector("canvas")?.focus();
              engine.current?.petPuppy(nearPuppy.id);
            } else if (key === "p") engine.current?.togglePuppyFollow(nearPuppy.id);
            else if (key === "h") engine.current?.sendPuppyHome();
            else if (command) engine.current?.commandPuppy(nearPuppy.id, command);
          }}>
          <div className="v-puppy-heading">
            <h2><PawPrint size={18} aria-hidden="true" />{t(nearPuppy.name, nearPuppy.name === PUPPY_INFO[nearPuppy.breed].name ? PUPPY_INFO[nearPuppy.breed].japanese : nearPuppy.name)}</h2>
          </div>
          <div className="v-puppy-main-actions">
            <button className="v-interact" aria-keyshortcuts="E" aria-label={t(`Pet ${nearPuppy.name}`, `${nearPuppy.name}をなでる`)}
              onClick={() => { canvas.current?.querySelector("canvas")?.focus(); engine.current?.petPuppy(nearPuppy.id); }}>
              <kbd aria-hidden="true">E</kbd>{t("Pet", "なでる")}
            </button>
            <button className="v-interact" aria-keyshortcuts="P" aria-label={t(puppyIsFollowing ? `Let ${nearPuppy.name} go home` : `Walk with ${nearPuppy.name}`, puppyIsFollowing ? `${nearPuppy.name}を元の場所に戻す` : `${nearPuppy.name}と歩く`)}
              onClick={() => engine.current?.togglePuppyFollow(nearPuppy.id)}>
              <kbd aria-hidden="true">P</kbd>{t(puppyIsFollowing ? "Home" : "Walk", puppyIsFollowing ? "おうちへ" : "お散歩")}
            </button>
            <button ref={puppyTricksToggle} className="v-interact v-puppy-tricks-toggle" aria-keyshortcuts="T" aria-expanded={puppyTricksOpen} aria-controls="v-puppy-tricks"
              onClick={() => setTricksPuppyId(puppyTricksOpen ? null : nearPuppy.id)}>
              <kbd aria-hidden="true">T</kbd>{t("Tricks", "芸")}
            </button>
          </div>
          <div id="v-puppy-tricks" className="v-puppy-trick-list" hidden={!puppyTricksOpen}>
            {PUPPY_TRICKS.map(({ command, key, english, japanese }) =>
              <button key={command} className="v-interact" aria-keyshortcuts={key}
                onClick={() => engine.current?.commandPuppy(nearPuppy.id, command)}>
                <kbd aria-hidden="true">{key}</kbd>{t(english, japanese)}
              </button>)}
          </div>
          {showPackHome && <button className="v-interact v-puppy-home" aria-keyshortcuts="H" onClick={() => engine.current?.sendPuppyHome()}>
            <kbd aria-hidden="true">H</kbd>{t(followingPuppies.length === 1 ? `Send ${followingPuppies[0].name} home` : `Send all ${followingPuppies.length} dogs home`, "犬たちを元の場所に戻す")}
          </button>}
        </section>}
        {showWorldInteraction && nearPlace && nearPlace.id !== "birds" && nearPlace.id !== "garden" && !showSwingActions && !nearBench && !seatedBench && !nearbyAction && !nearPuppy && <button className="v-interact" onClick={() => openPlace(nearPlace.id)}>
          <kbd>E</kbd>{ja ? placeName(nearPlace.id) : nearPlace.prompt}<ArrowUpRight size={16} />
        </button>}
      </div>}
      {gardenStorageError && !sharedTrialEnabled && <div className="v-save-warning" role="status">{t("Your garden works for this visit, but this browser couldn't save it.", "この訪問中は遊べますが、庭をブラウザに保存できませんでした。")}</div>}
      {sharedTrialEnabled && entered && <div className="v-shared-trial">
        <button className={`v-shared-toggle${chatUnread && !chatOpen ? " has-new-message" : ""}`} onClick={() => { setChatOpen(open => !open); setChatUnread(false); }} aria-expanded={chatOpen} aria-label={chatOpen ? "Hide Hearthwillow chat" : chatUnread ? "Open Hearthwillow chat, new message" : "Open Hearthwillow chat"}>
          <UsersThree size={18} /> {sharedStatus === "Connected" ? `${sharedPeople.length} ${sharedPeople.length === 1 ? "blob" : "blobs"} here` : sharedStatus}
          {chatUnread && !chatOpen && <span key={chatPulse} className="v-shared-unread" aria-hidden="true" />}
        </button>
        {chatOpen && <section className="v-shared-chat" aria-label="Hearthwillow chat">
          <div className="v-shared-chat-header"><h2>Hearthwillow chat</h2><button onClick={() => setChatOpen(false)} aria-label="Close Hearthwillow chat"><X size={18} /></button></div>
          {chatPeople.length > 0 && <div className="v-shared-people">
            {chatPeople.length > 3 && <details>
              <summary>See everyone here ({chatPeople.length})</summary>
              {chatPeopleList}
            </details>}
            {chatPeople.length <= 3 && chatPeopleList}
          </div>}
          <p className="v-shared-chat-note">Everyone is in Hearthwillow. Messages clear each hour{sharedChatHour ? `, next at ${new Date((sharedChatHour + 1) * 3_600_000).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} your time` : ""}.</p>
          <div className="v-shared-chat-log" ref={chatLog} role="log" aria-live="polite">{sharedChat.length ? sharedChat.map((entry, index) => {
            const sentAt = typeof entry.sentAt === "number" && Number.isFinite(entry.sentAt) ? new Date(entry.sentAt) : null;
            return <p key={index}><strong>{entry.name}</strong> {entry.message}{sentAt && Number.isFinite(sentAt.getTime()) && <time className="v-shared-chat-time" dateTime={sentAt.toISOString()}>{sentAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time>}</p>;
          }) : <p className="v-shared-chat-empty">Say hello to the other blobs.</p>}</div>
          <form onSubmit={event => {
            event.preventDefault();
            const message = chatDraft.trim();
            if (!message || Date.now() < chatCooldownUntil) return;
            if (sharedTrialRef.current?.sendChat(message)) setChatDraft("");
            else setNotice(t("Chat isn't ready yet. Your message is still here.", "チャットの準備ができていません。メッセージは入力欄に残っています。"));
          }}>
            <input ref={chatInput} aria-label="Message" value={chatDraft} onChange={event => setChatDraft(event.target.value)} onKeyDown={event => { event.stopPropagation(); if (event.key === "Enter" && Date.now() < chatCooldownUntil) event.preventDefault(); }} maxLength={180} placeholder='Press "Enter" to type!' disabled={sharedStatus !== "Connected"} />
            <button type="submit" aria-label={chatCooldownSeconds > 0 ? `Send in ${chatCooldownSeconds} seconds` : "Send message"} disabled={!chatDraft.trim() || sharedStatus !== "Connected" || chatCooldownSeconds > 0}>
              <ArrowUp size={20} weight="bold" aria-hidden="true" />
              {chatCooldownSeconds > 0 && <span className="v-shared-send-count" aria-hidden="true">{chatCooldownSeconds}</span>}
            </button>
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
          <Dialog.Overlay className={`v-dialog-overlay${PERSONAL_RADIO_ENABLED && panel === "sound" ? " v-radio-overlay" : ""}`} />
          <Dialog.Content
            className={`v-dialog${PERSONAL_RADIO_ENABLED && panel === "sound" ? " v-radio-dialog" : ""}`}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              canvas.current?.querySelector("canvas")?.focus();
            }}
          >
            <Dialog.Title>
              {panel === "places"
                ? t("Where would you like to go?", "どこへ行きましょうか？")
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
                ? "Travel directly to a village activity."
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
                <p>{t("Wander at your own pace, or use Places to settle straight into an activity.", "自分のペースでお散歩。場所メニューから、好きな場所へすぐに移動できます。")}</p>
                <dl>
                  {[
                    ["W A S D / ↑ ↓ ← →", t("Glide", "浮かんで移動")],
                    [t("Click, then move mouse", "クリックしてマウスを動かす"), t("Look around without holding a button", "ボタンを押さずに見回す")],
                    ["Esc", t("Release the mouse / close", "マウスを解除 / 閉じる")],
                    [t("Touch drag", "タッチでドラッグ"), t("Look around", "見回す")],
                    [t("Click or tap a bench side", "ベンチの左右をクリック・タップ"), t("Sit on that side", "選んだ側に座る")],
                    ["F", t("Scatter crumbs from the birdwatching bench", "野鳥観察のベンチでパンくずを撒く")],
                    [t("Drag while settled", "ひと休み中にドラッグ"), t("Move the camera around your activity", "その場でカメラを動かす")],
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
                      <span>{ja ? ["集中", "音楽", "深呼吸", "気持ち", "感謝", "やさしい言葉", "野菜、お花とミント"][PLACES.findIndex(a => a.id === p.id)] : p.description}</span>
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
    </div>
  );
}

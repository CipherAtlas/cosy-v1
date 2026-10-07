"use client";
import { recipeById, type PicnicContext, type SharedPicnic, type PicnicAction } from "./picnic";
import { readVillageLanguage, villageNotice } from "./localization";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TouchControls } from "./TouchControls";
import { VillageMenus, type VillagePanel } from "./VillageMenus";
import { VillageStartScreen } from "./VillageStartScreen";
import { TownActivityHUD } from "./TownActivityHUD";
import { CookingHUD } from "./PicnicControls";
import type { TownActivityHUDState } from "./townProgress";
import { readInventory, withGardenInventory, type ForageInventory } from "./townShared";
import { KeybindingContext, Keycap, ShortcutButton } from "./KeybindingControls";
import { gameKey } from "./keybindings";
import { useVillagePreferences } from "./useVillagePreferences";
import {
  ArrowCounterClockwise,
  ArrowUp,
  ArrowUpRight,
  CaretDown,
  GearSix,
  Basket,
  Leaf,
  Bird,
  MapTrifold,
  X,
  UsersThree,
  PawPrint,
} from "@phosphor-icons/react";
import {
  PLACES,
  JAPANESE_PLACE_NAMES as japaneseNames,
  type PlaceId,
  type Weather,
} from "./places";
import { Activities } from "./Activities";
import { VillageMinimap } from "./VillageMap";
import { RadioDock, PERSONAL_RADIO_ENABLED } from "./RadioControls";
import { useVillageRadio } from "./useVillageRadio";
import { VillageAudio } from "./audio";
import { PUPPY_INFO, PUPPY_TRICKS, puppyCommandForKey, type NearbyPuppy } from "./puppies";
import { useSession } from "./useSession";
import type { ActivityMoment, MovementStatus } from "./environment";
import type { CottageCatStatus } from "./cottageCat";
import type { VillageEngine } from "./VillageEngine";
import "./village.css";
import type { BirdStatus } from "./birds";
import { VILLAGERS } from "./villagers";
import { GARDEN_KEY, CROP_NAMES, freshGarden, readGarden, growGarden, gardenAction, gardenActionAllowed, nearbyGardenAction, type GardenAction } from "./garden";
import type { SharedChatEntry, SharedWorldConnection, SharedVisitor } from "./sharedWorld";
import type { SwingSeat } from "./swings";
import { installButtonFeedback } from "./buttonFeedback";
import { HorseControls } from "./HorseControls";
import { TownControls } from "./TownControls";
import type { TownContext } from "./townInteractions";
import type { NearbyHorse } from "./horses";


export function Village() {
  const [isPhone, setIsPhone] = useState<boolean | null>(null);
  const [kicked, setKicked] = useState(false);
  const [gateLanguage, setGateLanguage] = useState<"en" | "ja">("en");
  const onKicked = useCallback(() => setKicked(true), []);
  useEffect(() => {
    setGateLanguage(readVillageLanguage());
    const browser = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
    const tablet = /iPad|Tablet|Silk/i.test(browser.userAgent) ||
      (/Macintosh/i.test(browser.userAgent) && browser.maxTouchPoints > 1) ||
      (/Android/i.test(browser.userAgent) && !/Mobile/i.test(browser.userAgent));
    setIsPhone(/iPhone|iPod|Android.*Mobile|Windows Phone|IEMobile|Opera Mini/i.test(browser.userAgent) ||
      (browser.userAgentData?.mobile === true && !tablet));
  }, []);
  if (isPhone === false) return kicked ? <KickedScreen /> : <VillageScene onKicked={onKicked} />;
  return <main className="v-device-gate" lang={gateLanguage} aria-busy={isPhone === null}>
    <h1>{gateLanguage === "ja" ? "ハースウィロー" : "Hearthwillow"}</h1>
    <p role="status">{gateLanguage === "ja" ? isPhone ? "iPad・タブレット・ノートパソコン・PCで村を開いてください。" : "村を準備しています…" : isPhone ? "Please open the village on an iPad, tablet, laptop or PC." : "Opening the village…"}</p>
  </main>;
}

function KickedScreen() {
  const [language, setLanguage] = useState<"en" | "ja">("en");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    setLanguage(readVillageLanguage());
    if (document.pointerLockElement) document.exitPointerLock();
    heading.current?.focus();
  }, []);
  return <main className="v-scenery-loading" lang={language}>
    <div className="v-scenery-loading-content v-kicked-content">
      <Leaf size={35} weight="light" aria-hidden="true" />
      <h1 ref={heading} tabIndex={-1}>{language === "ja" ? "村から一時的に退出しました。" : "You've been kicked from this village."}</h1>
      <p>{language === "ja" ? "しばらくしてから入り直してください。" : "Log back in later!"}</p>
    </div>
  </main>;
}

function VillageScene({ onKicked }: { onKicked: () => void }) {
  const [touchControls, setTouchControls] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(any-pointer: coarse)");
    const update = () => setTouchControls(query.matches || navigator.maxTouchPoints > 1);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const canvas = useRef<HTMLDivElement>(null),
    engine = useRef<VillageEngine | null>(null),
    audio = useRef<VillageAudio | null>(null);
  const readMapPose = useCallback(() => engine.current?.getPlayerPose() ?? null, []);
  const readMapActors = useCallback(() => engine.current?.getMapActors() ?? [], []);
  useEffect(() => {
    const root = canvas.current?.parentElement;
    if (root) return installButtonFeedback(root);
  }, []);
  const [progress, setProgress] = useState(0),
    [ready, setReady] = useState(false),
    [entered, setEntered] = useState(false),
    [error, setError] = useState("");
  const [engineAttempt, setEngineAttempt] = useState(0);
  const [place, setPlace] = useState<PlaceId | null>(null),
    [near, setNear] = useState<PlaceId | null>(null),
    [panel, setPanel] = useState<VillagePanel>(null);
  const [birdStatus, setBirdStatus] = useState<BirdStatus>("flying");
  const [nearBench, setNearBench] = useState<string | null>(null);
  const [seatedBench, setSeatedBench] = useState<string | null>(null);
  const [lookout, setLookout] = useState({ nearby: false, inside: false, pending: false });
  const [nearSwing, setNearSwing] = useState<import("./swings").SwingSeat | null>(null);
  const [ridingSwing, setRidingSwing] = useState<import("./swings").SwingSeat | null>(null);
  const [nearHorse, setNearHorse] = useState<NearbyHorse | null>(null);
  const [ridingHorse, setRidingHorse] = useState<NearbyHorse | null>(null);
  const [townContext, setTownContext] = useState<TownContext | null>(null);
  const [activityHUD, setActivityHUD] = useState<TownActivityHUDState | null>(null);
  const [picnicContext, setPicnicContext] = useState<PicnicContext | null>(null);
  const [picnicState, setPicnicState] = useState<SharedPicnic>();
  const [inventory, setInventory] = useState<ForageInventory>(() => readInventory());
  const inventoryRef = useRef(inventory);
  const [garden, setGarden] = useState(freshGarden);
  const gardenRef = useRef(garden);
  const crumbsReadyRef = useRef(false);
  const scatterAfterCrumbsRef = useRef(false);
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
  const [chatOpen, setChatOpen] = useState(() => navigator.maxTouchPoints === 0 && !window.matchMedia("(any-pointer: coarse)").matches);
  const chatOpenRef = useRef(chatOpen);
  chatOpenRef.current = chatOpen;
  const [chatUnread, setChatUnread] = useState(false);
  const [chatPulse, setChatPulse] = useState(0);
  const [chatDraft, setChatDraft] = useState("");
  const [chatCooldownUntil, setChatCooldownUntil] = useState(0);
  const [, setChatClock] = useState(0);
  const chatComposing = useRef(false);
  const chatInput = useRef<HTMLInputElement>(null);
  const chatLog = useRef<HTMLDivElement>(null);
  const [companions, setCompanions] = useState<string[]>([]);
  const companionsRef = useRef(companions);
  const [activityCompact,setActivityCompact]=useState(false);
  const onMoment=useCallback((moment:ActivityMoment)=>engine.current?.setActivityMoment(moment),[]);
  const soundBusy = useRef(false);
  const soundChosen = useRef(false);
  const [, setMovement] = useState<MovementStatus>({ gait: "idle", running: false });
  const [mouseLook, setMouseLook] = useState<"free" | "locked" | "drag">("free");
  const [soundLoading, setSoundLoading] = useState(false);
  const settings = useVillagePreferences();
  const { mix, setMix, quality, weather, language, mouseSensitivity, keybindings } = settings;
  const [sound, setSound] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState({ fps: 0, draws: 0, triangles: 0 });
  const preferences = useRef({ quality, weather, language, mouseSensitivity, keybindings });
  preferences.current = { quality, weather, language, mouseSensitivity, keybindings };
  const [notice, setNotice] = useState("");
  const [cottageCat, setCottageCat] = useState<CottageCatStatus>("away");
  const [gardenStorageError, setGardenStorageError] = useState(false);
  const [nearGarden, setNearGarden] = useState<string | null>(null);
  const [nearPuppy, setNearPuppy] = useState<NearbyPuppy | null>(null);
  const [followingPuppies, setFollowingPuppies] = useState<NearbyPuppy[]>([]);
  const [tricksPuppyId, setTricksPuppyId] = useState<string | null>(null);
  const [occupiedSwings, setOccupiedSwings] = useState<SwingSeat[]>([]);
  const activityRequestRef = useRef(0);
  const escapeInteraction = useRef(() => {});
  const pendingActivityRef = useRef<number | null>(null);
  const [sceneryLoading, setSceneryLoading] = useState<Weather | null>(null);
  const enterRef = useRef(false);
  const ja = language === "ja",
    t = (en: string, jp: string) => (ja ? jp : en);
  const focus = useSession(() => {
    audio.current?.chime();
    setNotice("Session complete.");
  });
  const openPlace = useCallback((id: PlaceId) => {
    const enter = (index?: number, position?: [number, number, number]) => {
      engine.current?.setActivitySeat(index, position);
      setPlace(id); setActivityCompact(false); setPanel(null);
      engine.current?.travel(id); audio.current?.setPlace(id);
    };
    if (sharedTrialModeRef.current && (id !== "focus" || sharedConnectedRef.current)) {
      if (!sharedConnectedRef.current || !sharedTrialRef.current) { setNotice("Wait for the village to reconnect."); return; }
      if (pendingActivityRef.current !== null) return;
      const request = ++activityRequestRef.current, connection = sharedTrialRef.current;
      pendingActivityRef.current = request;
      void connection.interact({ kind: "activity", id }).then(result => {
        if (request !== activityRequestRef.current || connection !== sharedTrialRef.current) return;
        if (result.ok && sharedConnectedRef.current) enter(result.index, result.position); else setNotice(result.reason ?? "That spot is occupied.");
      }).finally(() => { if (pendingActivityRef.current === request) pendingActivityRef.current = null; });
    } else enter();
  }, []);
  const leave = useCallback(() => {
    activityRequestRef.current++; pendingActivityRef.current = null;
    if (sharedConnectedRef.current) void sharedTrialRef.current?.interact({ kind: "leave" });
    setPlace(null);
    engine.current?.setPlace(null);
    audio.current?.setPlace(null);
    const target = canvas.current?.querySelector("canvas")
      ?? canvas.current?.parentElement?.querySelector<HTMLButtonElement>(".v-wordmark");
    target?.focus();
  }, []);
  escapeInteraction.current = () => {
    if (panel || sceneryLoading) return;
    setTricksPuppyId(null);
    if (place || pendingActivityRef.current !== null) leave();
    else canvas.current?.querySelector("canvas")?.focus();
  };
  const toggleCompanion = useCallback((id: string) => {
    if (!VILLAGERS.some(v => v.id === id)) return;
    if (sharedTrialModeRef.current) {
      if (!sharedConnectedRef.current || !sharedTrialRef.current) { setNotice("Wait for the village to reconnect."); return; }
      void sharedTrialRef.current.interact({ kind: "resident", id, action: companionsRef.current.includes(id) ? "home" : "walk" }).then(result => {
        if (!result.ok) setNotice(result.reason ?? "They are spending time with another visitor.");
      }); return;
    }
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
      if (sharedTrialModeRef.current) { sharedTrialRef.current?.sendGarden(action); return; }
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
    setNotice("");
  }, []);
  const scatterBenchCrumbs = useCallback(() => {
    if (!engine.current?.sittingAtBirdBench) return;
    if (sharedTrialModeRef.current && !crumbsReadyRef.current) {
      scatterAfterCrumbsRef.current = true;
      onGardenAction({ kind: "birdCrumbs" }); return;
    }
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
    try { const saved = { ...readGarden(localStorage.getItem(GARDEN_KEY)), crumbPouch: false }; gardenRef.current = saved; setGarden(saved); }
    catch { setGardenStorageError(true); }
    return () => audio.current?.dispose();
  }, []);
  const { radioExpanded, setRadioExpanded, radioPrefs, radioLoading, radioError, radioEnded,
    updateRadio, playVillageMusic, selectStation, nextRadioTrack, toggleMusic } = useVillageRadio({
      audio, language, entered, panel, sound, enableSound, setNotice,
    });
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
    const controller = new AbortController();
    let peopleKey = "", chatKey = "", swingsKey = "";
    sharedTrialModeRef.current = true;
    setSharedTrialEnabled(true);
    void import("./sharedWorld").then(({ connectSharedWorld }) => connectSharedWorld({
      signal: controller.signal,
      getPose: () => engine.current?.getPlayerPose() ?? null,
      onState: snapshot => {
        if (cancelled) return;
        sharedConnectedRef.current = true;
        sharedSelfIdRef.current = snapshot.selfId;
        sharedPeopleRef.current = snapshot.visitors;
        setSharedSelfId(snapshot.selfId);
        const self = snapshot.visitors.find(visitor => visitor.id === snapshot.selfId);
        if (self) engine.current?.syncSharedSelf(self);
        if (self && (self.slot !== sharedIdentityRef.current?.slot || self.color !== sharedIdentityRef.current?.color)) {
          sharedIdentityRef.current = { slot: self.slot, color: self.color };
          engine.current?.setSharedIdentity(self.slot, self.color);
        }
        if (snapshot.gardenChanged) {
          const personalGarden = withGardenInventory({ ...snapshot.garden, crumbPouch: crumbsReadyRef.current }, inventoryRef.current);
          gardenRef.current = personalGarden;
          setGarden(personalGarden);
          engine.current?.setGarden(personalGarden);
        }
        const visitors = snapshot.visitors.filter(visitor => visitor.id !== snapshot.selfId);
        sharedVisitorsRef.current = visitors;
        engine.current?.setRemoteVisitors(visitors);
        const swings = visitors.flatMap(visitor => visitor.swing ? [{ id: visitor.swing.id, index: visitor.swing.index }] : []);
        const nextSwingsKey = JSON.stringify(swings);
        if (nextSwingsKey !== swingsKey) { swingsKey = nextSwingsKey; setOccupiedSwings(swings); }
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
      onWorld: (world, selfId) => {
        if (cancelled) return;
        engine.current?.setSharedConnected(true);
        engine.current?.setSharedActors(world, selfId);
        setPicnicState(world.picnic);
        const next = world.actors.filter(actor => actor.kind === "resident" && actor.following && actor.owner === selfId).map(actor => actor.id);
        if (next.join("|") !== companionsRef.current.join("|")) {
          companionsRef.current = next; setCompanions(next); engine.current?.setCompanions(next);
        }
      },
      onCrumbs: hasCrumbs => {
        if (cancelled) return;
        crumbsReadyRef.current = hasCrumbs;
        const next = { ...gardenRef.current, crumbPouch: hasCrumbs };
        gardenRef.current = next; setGarden(next); engine.current?.setGarden(next);
        if (scatterAfterCrumbsRef.current) {
          scatterAfterCrumbsRef.current = false;
          if (hasCrumbs && engine.current?.sittingAtBirdBench) sharedTrialRef.current?.sendGarden({ kind: "feedBirds" });
        }
      },
      onForageInventory: inventory => {
        if (cancelled) return;
        inventoryRef.current = inventory; setInventory(inventory);
        engine.current?.setForageInventory(inventory);
        const personalGarden = withGardenInventory(gardenRef.current, inventory);
        gardenRef.current = personalGarden; setGarden(personalGarden); engine.current?.setGarden(personalGarden);
      },
      onRejected: message => { if (!cancelled) { scatterAfterCrumbsRef.current = false; setNotice(message); } },
      onKicked: () => { if (!cancelled) onKicked(); },
      onPuppyTrick: trick => { if (!cancelled) engine.current?.showPuppyTrick(trick); },
      onSwingTaken: () => {
        if (cancelled) return;
        engine.current?.leaveSwing();
        setNotice(preferences.current.language === "ja" ? "そのブランコには、ほかの人が座っています。" : "Someone is already on that swing. Try the other seat.");
      },
      onDisconnect: () => {
        if (cancelled) return;
        sharedConnectedRef.current = false;
        activityRequestRef.current++; pendingActivityRef.current = null;
        engine.current?.setSharedConnected(false);
        if (engine.current?.currentPlace && engine.current.currentPlace !== "focus") {
          setPlace(null); engine.current.setPlace(null); audio.current?.setPlace(null);
        }
        setTricksPuppyId(null); setFollowingPuppies([]);
        crumbsReadyRef.current = false;
        scatterAfterCrumbsRef.current = false;
        const withoutCrumbs = { ...gardenRef.current, crumbPouch: false };
        gardenRef.current = withoutCrumbs; setGarden(withoutCrumbs); engine.current?.setGarden(withoutCrumbs);
        sharedVisitorsRef.current = [];
        sharedPeopleRef.current = [];
        engine.current?.setRemoteVisitors([]);
        setSharedPeople([]);
        setOccupiedSwings([]);
        setSharedStatus("Disconnected");
      },
    })).then(connection => {
      if (cancelled) connection.close();
      else sharedTrialRef.current = connection;
    }).catch(error => { if (!cancelled) setSharedStatus(error instanceof Error ? error.message : "Could not connect"); });
    return () => {
      cancelled = true;
      controller.abort();
      sharedTrialRef.current?.close();
      sharedTrialRef.current = null;
      sharedVisitorsRef.current = [];
      sharedPeopleRef.current = [];
      sharedSelfIdRef.current = "";
      sharedIdentityRef.current = null;
      sharedTrialModeRef.current = false;
      sharedConnectedRef.current = false;
    };
  }, [entered, onKicked]);
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
          escape: () => escapeInteraction.current(),
          companion: toggleCompanion,
          crumbs: id => onGardenAction({ kind: id === "wren" ? "birdCrumbs" : "crumbs" }),
          birds: setBirdStatus,
          visitTea: () => openPlace("mood"),
          gardenSound: (kind, position) => audio.current?.gardenEffect(kind, position),
          nearGarden: setNearGarden,
          gardenInteract: interactGarden,
          picnicContext: setPicnicContext,
          picnicOpen: context => { setPicnicContext(context); setPanel(context.kind); },
          nearPuppy: setNearPuppy,
          cottageCat: setCottageCat,
          puppyFollowing: puppies => {
            setFollowingPuppies(puppies);
            setNotice("");
          },
          puppySound: (breed, position, kind) => audio.current?.puppyEffect(breed, position, kind),
          puppyPetted: () => setNotice(""),
          puppyCommanded: () => setNotice(""),
          contact: event => audio.current?.contact(event),
          environment: frame => audio.current?.setEnvironment(frame),
          ready: () => {
            if (!cancelled) setReady(true);
          },
          near: setNear,
          nearBench: setNearBench,
          seat: setSeatedBench,
          lookout: setLookout,
          nearSwing: setNearSwing,
          ridingSwing: setRidingSwing,
          nearHorse: setNearHorse,
          ridingHorse: setRidingHorse,
          townContext: setTownContext,
          horseSound: event => audio.current?.horseEffect(event),
          townAnimalSound: event => audio.current?.townAnimal(event),
          animalNearby: (sources, walking) => audio.current?.animalNearby(sources, walking),
          activityHUD: setActivityHUD,
          scatterBirds: fromBench => fromBench ? scatterBenchCrumbs() : onGardenAction({ kind: "feedBirds" }),
          interact: openPlace,
          sharedNotice: setNotice,
          error: (msg) => {
            setError(msg);
            setReady(false);
          },
          stats: (fps, draws, triangles) => setStats({ fps, draws, triangles }),
        });
        engine.current = local;
        if (process.env.NEXT_PUBLIC_SHARED_WORLD_URL || new URLSearchParams(location.search).get("sharedTrial") === "1") {
          local.setSharedInteraction(request => sharedTrialRef.current?.interact(request) ?? Promise.resolve({ ok: false, reason: "Wait for the village to reconnect." }));
          local.setHorseInput(input => sharedTrialRef.current?.sendHorseInput(input));
          local.setSharedConnected(sharedConnectedRef.current);
        }
        local.setGarden(gardenRef.current);
        local.setForageInventory(inventoryRef.current);
        local.setCompanions(companionsRef.current);
        local.setBlocked(!enterRef.current);
        local.setTitleScreen(!enterRef.current);
        await local.load();
        if (!cancelled) {
          local.setGarden(gardenRef.current);
          local.setForageInventory(inventoryRef.current);
          if (sharedIdentityRef.current) local.setSharedIdentity(sharedIdentityRef.current.slot, sharedIdentityRef.current.color);
          local.setRemoteVisitors(sharedVisitorsRef.current);
          local.setQuality(preferences.current.quality);
          local.setWeather(preferences.current.weather);
          local.setLanguage(preferences.current.language);
          local.setMouseSensitivity(preferences.current.mouseSensitivity);
          local.setKeybindings(preferences.current.keybindings);
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
    engine.current?.setTitleScreen(!entered);
    engine.current?.setBlocked(!entered || panel !== null || sceneryLoading !== null);
    engine.current?.setMapOpen(panel === "places");
    enterRef.current = entered;
  }, [entered, panel, sceneryLoading]);
  useEffect(() => {
    document.documentElement.lang = language;
    engine.current?.setLanguage(language);
  }, [language]);
  useEffect(() => {
    engine.current?.setQuality(quality);
  }, [quality]);
  useEffect(() => { engine.current?.setKeybindings(keybindings); }, [keybindings]);
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
    audio.current?.setMix(mix);
  }, [mix]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 7000);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    if (!chatOpen) chatComposing.current = false;
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
      if (e.defaultPrevented || e.repeat || e.isComposing) return;
      if (e.key === "Escape" && entered && !panel && !sceneryLoading) {
        e.preventDefault();
        engine.current?.escapeWorld();
        escapeInteraction.current();
        return;
      }
      if (e.key === "Tab" && entered && !panel && !sceneryLoading) {
        const root = canvas.current?.parentElement;
        if (!root) return;
        const controls = [...root.querySelectorAll<HTMLElement>("button, input:not([type='hidden']), textarea, select, summary, a[href]")]
          .filter(control => !control.matches(":disabled, [tabindex='-1']") && control.getClientRects().length > 0 && getComputedStyle(control).visibility !== "hidden");
        if (!controls.length) return;
        const index = controls.indexOf(document.activeElement as HTMLElement);
        const first = place ? controls.findIndex(control => !!control.closest("#v-activity-panel")) : -1;
        const next = index < 0 ? e.shiftKey ? controls.length - 1 : Math.max(0, first)
          : (index + (e.shiftKey ? -1 : 1) + controls.length) % controls.length;
        e.preventDefault();
        controls[next].focus();
        return;
      }
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      )
        return;
      if (e.metaKey || e.ctrlKey || e.altKey || !entered || sceneryLoading) return;
      const key = gameKey(keybindings, e.key);
      if (panel === "places" && key === "m") {
        e.preventDefault();
        setPanel(null);
        return;
      }
      if (panel) return;
      if (e.target instanceof Element && e.target.closest("button, summary, a[href]") && (e.key === "Enter" || e.key === " ")) return;
      if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement) && sharedTrialEnabled && entered && !panel && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setChatOpen(true);
        setChatUnread(false);
        engine.current?.releaseMouseLook();
        requestAnimationFrame(() => chatInput.current?.focus());
        return;
      }
      if (key === "m" || key === "o" || key === "i" || key === ",") {
        e.preventDefault();
        setPanel(key === "m" ? "places" : key === "o" ? "sound" : key === "i" ? "basket" : "settings");
        return;
      }
      if (place && key === "u") {
        e.preventDefault();
        setActivityCompact(value => !value);
        canvas.current?.querySelector("canvas")?.focus();
        return;
      }
      if (place && !(e.target instanceof HTMLButtonElement && (e.key === " " || e.key === "Enter"))) {
        const shortcut = e.key === " " ? "space" : e.key.toLowerCase();
        const button = [...(canvas.current?.parentElement?.querySelectorAll<HTMLButtonElement>("#v-activity-panel button[aria-keyshortcuts]") ?? [])]
          .find(control => !control.disabled && control.getClientRects().length > 0
            && control.getAttribute("aria-keyshortcuts")?.toLowerCase().split(/\s+/).includes(shortcut));
        if (button) { e.preventDefault(); button.click(); }
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [place, entered, panel, sharedTrialEnabled, sceneryLoading, keybindings]);
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
      else if (result && !result.animals) setNotice(t("Some animal sounds could not load. Turn sound off and on to retry.", "動物の声の一部を読み込めませんでした。音をオフにして再度お試しください。"));
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
    soundChosen.current = true;
    if (sound) {
      audio.current?.stop();
      setSound(false);
    } else void enableSound();
  }
  function openRadio() { setPanel("sound"); }
  const current = PLACES.find((p) => p.id === place),
    nearPlace = PLACES.find((p) => p.id === near);
  const showWorldInteraction = entered && !place;
  const chatCooldownSeconds = Math.min(3, Math.ceil(Math.max(0, chatCooldownUntil - Date.now()) / 1000));
  const chatPeople = chatOpen ? [...sharedPeople].sort((a, b) => a.id === sharedSelfId ? -1 : b.id === sharedSelfId ? 1 : 0) : [];
  const picnicAct = async (request: PicnicAction) => {
    const result = await sharedTrialRef.current?.interact(request);
    if (!result?.ok) setNotice(result?.reason ?? "Wait for the village to reconnect.");
    else {
      setNotice(request.action === "eat" ? "Portion eaten." : "");
      if (request.action === "cook") {
        setPanel(null);
        canvas.current?.querySelector("canvas")?.focus();
      }
    }
    return !!result?.ok;
  };
  const localizedNotice = villageNotice(notice, language);
  const chatTime = (time: number) => new Date(time).toLocaleTimeString(ja ? "ja-JP" : "en-US", { hour: "numeric", minute: "2-digit" });
  const puppyName = nearPuppy ? t(nearPuppy.name, nearPuppy.name === PUPPY_INFO[nearPuppy.breed].name ? PUPPY_INFO[nearPuppy.breed].japanese : nearPuppy.name) : "";
  const chatPeopleList = chatOpen && <div className="v-shared-people-list">{chatPeople.map(person => <span key={person.id}><i style={{ background: person.color }} />{person.name}{person.id === sharedSelfId ? t(" (you)", "（あなた）") : ""}</span>)}</div>;
  const nearBirds = nearPlace?.id === "birds" || seatedBench === "bird-clearing-bench";
  const birdMealBusy = birdStatus === "crumbs" || birdStatus === "eating" || birdStatus === "happy";
  const showActivityPanel = entered && place && !activityCompact;
  const nearbyAction = nearGarden ? nearbyGardenAction(nearGarden, garden) : null;
  const showLookout = showWorldInteraction && (lookout.nearby || lookout.inside || lookout.pending) && !panel && !sceneryLoading;
  const showHorseActions = showWorldInteraction && !showLookout && !!(nearHorse || ridingHorse) && !seatedBench && !ridingSwing && !panel && !sceneryLoading;
  const kitchenBusy = picnicContext?.kind === "kitchen" && picnicState?.cooking.some(job => job.kitchen === picnicContext.id && (job.owner === sharedSelfId || job.readyAt > (engine.current?.getSharedNow() ?? Date.now())));
  const showPicnicActions = showWorldInteraction && !!picnicContext && !showLookout && !showHorseActions && !seatedBench && !kitchenBusy;
  const showTownActions = !picnicContext && showWorldInteraction && !showLookout && !!townContext && !showHorseActions && !seatedBench && !ridingSwing && !panel && !sceneryLoading;
  const showSwingActions = showWorldInteraction && !showLookout && !showHorseActions && !showTownActions && !!(nearSwing || ridingSwing) && !panel && !sceneryLoading;
  const showPuppyActions = showWorldInteraction && !showLookout && !showHorseActions && !showTownActions && !!nearPuppy && !nearBench && !seatedBench && !showSwingActions && !nearbyAction && !nearBirds && !panel && !sceneryLoading;
  const puppyIsFollowing = followingPuppies.some(puppy => puppy.id === nearPuppy?.id);
  const puppyBusy = !!nearPuppy?.owner && nearPuppy.owner !== sharedSelfId;
  const puppyTricksOpen = !puppyBusy && showPuppyActions && tricksPuppyId === nearPuppy?.id;
  const showPackHome = followingPuppies.length > 0 && !(showPuppyActions && puppyIsFollowing && followingPuppies.length === 1);
  useEffect(() => {
    setTricksPuppyId(null);
  }, [nearPuppy?.id, showPuppyActions]);
  useEffect(() => {
    engine.current?.setPuppyInteraction(puppyTricksOpen ? nearPuppy?.id ?? null : null);
    return () => engine.current?.setPuppyInteraction(null);
  }, [puppyTricksOpen, nearPuppy?.id, ready]);
  useEffect(() => {
    if (!showPuppyActions || !nearPuppy || puppyBusy) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey ||
        event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        (event.target instanceof HTMLElement && event.target.isContentEditable)) return;
      if (gameKey(keybindings, event.key) === "t") {
        event.preventDefault();
        setTricksPuppyId(puppyTricksOpen ? null : nearPuppy.id);
        canvas.current?.querySelector("canvas")?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showPuppyActions, nearPuppy, puppyTricksOpen, puppyBusy, keybindings]);
  const nearbyLabel = nearbyAction?.kind === "plant" ? t(`Plant ${CROP_NAMES[nearbyAction.crop].en.toLowerCase()}`, "種を植える")
    : nearbyAction?.kind === "water" ? t("Water the sprouts", "芽に水をあげる")
    : nearbyAction?.kind === "harvest" ? t("Pick your harvest", "収穫する")
    : nearbyAction?.kind === "basket" ? t("Open harvest basket", "収穫かごを開く")
    : nearbyAction?.kind === "flowers" ? t("Water the irises", "アイリスに水をあげる")
    : nearbyAction?.kind === "feed" ? garden.crumbPouch ? t("Feed the ducks", "アヒルたちにパンくずをあげる") : t("Find Maple or Wren for crumbs", "メープルかレンからパンくずをもらう")
    : t("Drink mint tea", "ミントティーを飲む");
  const placeName = (id: PlaceId) =>
    ja
      ? japaneseNames[PLACES.findIndex((p) => p.id === id)]
      : PLACES.find((p) => p.id === id)!.name;
  return (
    <KeybindingContext.Provider value={keybindings}><div
      className={`village ${entered ? "v-entered" : ""} ${place ? "v-settled" : ""} ${touchControls ? "v-touch-device" : ""}`}
      data-weather={weather}
      data-activity={place ?? "explore"}
    >
      <div className="v-canvas" ref={canvas} />
      <div className="v-shade" aria-hidden="true" />
      {sceneryLoading && typeof document !== "undefined" && createPortal(<div className="v-scenery-loading" role="status" aria-live="polite" aria-busy="true">
        <div className="v-scenery-loading-content">
          <Leaf size={35} weight="light" aria-hidden="true" />
          <h2>{t("Changing weather", "天気を変更中")}</h2>
          <p>{sceneryLoading === "night" ? t("Night", "夜")
            : sceneryLoading === "dusk" ? t("Blue hour", "薄暮")
            : sceneryLoading === "rain" ? t("Rain", "雨")
            : t("Golden hour", "夕暮れ")}</p>
          <span className="v-scenery-loading-line" aria-hidden="true" />
        </div>
      </div>, document.body)}
      {entered && <header className="v-header">
        <button
          className="v-wordmark"
          onClick={leave}
          aria-label={t("Return to village", "村に戻る")}
        >
          {current ? placeName(current.id) : t("Hearthwillow", "ハースウィロー")}
          {!current && <Leaf size={24} weight="light" />}
        </button>
        <nav aria-label={t("Village controls", "村の操作")}>
          {touchControls && entered && !place && !seatedBench && !ridingSwing && !ridingHorse && !lookout.inside && <ShortcutButton
            aria-label={t("Recover to safe ground", "安全な場所へ戻る")} title={t("Recover to safe ground", "安全な場所へ戻る")}
            aria-keyshortcuts="R" onClick={() => engine.current?.resetPosition()}>
            <Keycap aria-hidden="true">R</Keycap><ArrowCounterClockwise size={20} aria-hidden="true" />
          </ShortcutButton>}
          {ready ? <VillageMinimap scenery={engine.current?.mapScenery} current={place} language={language}
            readPose={readMapPose} readActors={readMapActors} expand={() => setPanel("places")} /> : <ShortcutButton
            disabled={!ready}
            aria-label={t("Village map", "村の地図")}
            aria-keyshortcuts="M"
            onClick={() => setPanel("places")}
          >
            <Keycap aria-hidden="true">M</Keycap><MapTrifold size={19} />
            <span>{t("Map", "地図")}</span>
          </ShortcutButton>}
          <ShortcutButton disabled={!ready} aria-label={t("Your inventory", "持ち物")} aria-keyshortcuts="I" onClick={() => setPanel("basket")}>
            <Keycap aria-hidden="true">I</Keycap><Basket size={20} />
          </ShortcutButton>
          <ShortcutButton
            disabled={!ready}
            aria-label={t("Settings", "設定")}
            aria-keyshortcuts=","
            onClick={() => setPanel("settings")}
          >
            <Keycap aria-hidden="true">,</Keycap><GearSix size={20} />
          </ShortcutButton>
        </nav>
      </header>}
      {PERSONAL_RADIO_ENABLED && entered && <RadioDock expanded={radioExpanded} setExpanded={setRadioExpanded}
        track={radioPrefs.mode === "radio" ? radioPrefs.track : null} mode={radioPrefs.mode} sound={sound} paused={radioPrefs.paused}
        loading={soundLoading} toggleMusic={toggleMusic}
        next={nextRadioTrack} openSound={openRadio} language={language} />}
      {!entered && <VillageStartScreen language={language} ready={ready} progress={progress} error={error} touch={touchControls}
        enter={() => {
          if (!soundChosen.current) void enableSound();
          setEntered(true); setPanel(settings.dontShowTutorial ? null : "tutorial");
          requestAnimationFrame(() => canvas.current?.querySelector("canvas")?.focus());
        }}
        retry={() => { setError(""); setProgress(0); setEngineAttempt(value => value + 1); }}
        openLanguage={() => setPanel("language")} openSettings={() => setPanel("settings")} />}
      {entered && !place && !ridingSwing && !ridingHorse && (
        <>
          <footer className="v-walk-hints">
            <span><Keycap>W</Keycap><Keycap>A</Keycap><Keycap>S</Keycap><Keycap>D</Keycap>{t("Move", "移動")}</span>
            <span><Keycap>Shift</Keycap>{t("Hold to run", "押して走る")}</span>
            <span><Keycap>E</Keycap>{t("Interact", "調べる")}</span>
            <span><Keycap>R</Keycap>{t("Recover", "安全な場所へ")}</span>
            <span><Keycap>Tab</Keycap>{t("Focus next button", "次のボタンにフォーカス")}</span>
            <span>{mouseLook === "locked" ? t("Mouse to look · Esc to leave / release", "マウスで見回す · Escで終了 / 解除")
              : mouseLook === "drag" ? t("Mouse capture unavailable · drag to look", "マウスを固定できません · ドラッグで見回す")
                : t("Click to look · Esc to release", "クリックで見回す · Escで解除")}</span>
          </footer>
        </>
      )}
      {showWorldInteraction && !panel && !sceneryLoading && picnicContext?.kind === "picnic" && mouseLook === "locked" && <span className="v-picnic-reticle" aria-hidden="true" />}
      {touchControls && entered && !panel && !sceneryLoading && <TouchControls
        key={`${place ?? "outdoor"}-${!!seatedBench}-${!!ridingSwing}-${!!ridingHorse}-${lookout.inside}`}
        engine={engine} canMove={!place && !seatedBench && !ridingSwing}
        horse={!!ridingHorse} lookout={lookout.inside} t={t} />}
      {entered && place && (
        <div id="v-activity-panel" hidden={activityCompact}>
        {notice && <div className="v-notice" role="status">{localizedNotice}</div>}
        <div className="v-activity-content">
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
        <ShortcutButton className="v-context-close v-activity-close" aria-label={t("Leave activity", "アクティビティを閉じる")} aria-keyshortcuts="Escape" onClick={leave}><X size={19} aria-hidden="true" /></ShortcutButton>
        </div>
        </div>
      )}
      {entered && place && (
        <div className="v-activity-controls" role="group" aria-label={t("Activity controls", "アクティビティの操作")}>
        <ShortcutButton className="v-interact v-leave" aria-keyshortcuts="Escape" onClick={leave}>
          <Keycap aria-hidden="true">Esc</Keycap>{t("Back to village", "村に戻る")}
        </ShortcutButton>
        <ShortcutButton className="v-interact v-scene-toggle" aria-keyshortcuts="U" aria-controls="v-activity-panel" aria-expanded={!activityCompact} onClick={()=>setActivityCompact(value=>!value)}>
          <Keycap aria-hidden="true">U</Keycap>
          {activityCompact ? t("Show activity", "操作を表示") : t("Hide activity controls", "操作を隠す")}<CaretDown size={16} style={{transform:activityCompact?"rotate(180deg)":undefined}} />
        </ShortcutButton>
        </div>
      )}
      {entered && focus.running && place !== "focus" && (
        <button className="v-session-mini" onClick={() => openPlace("focus")}>
          <span className="v-live-dot" />
          {Math.floor(focus.remaining / 60)}:
          {String(focus.remaining % 60).padStart(2, "0")} ·{" "}
          {t("Back to focus", "集中に戻る")}
        </button>
      )}
      {error && entered && (
        <div className="v-error" role="status">
          {villageNotice(error, language)}
          {entered && <button onClick={() => { setError(""); setProgress(0); setEngineAttempt(value => value + 1); }}>{t("Retry the village", "村をもう一度開く")}</button>}
        </div>
      )}
      {entered && ready && place === "focus" && !panel && cottageCat !== "away" && (
        <div className="v-cottage-cat" role="group" aria-label={t("Cottage cat", "コテージの猫")}>
          <ShortcutButton className="v-interact" disabled={cottageCat === "petting"} aria-keyshortcuts="E"
            onClick={() => { engine.current?.petCottageCat(); canvas.current?.querySelector("canvas")?.focus(); }}>
            <Keycap aria-hidden="true">E</Keycap>{t(cottageCat === "petting" ? "Petting…" : "Pet the cat", cottageCat === "petting" ? "なでています…" : "猫をなでる")}
          </ShortcutButton>
        </div>
      )}
      {!showActivityPanel && <div className={`v-world-feedback${showWorldInteraction ? " is-walking" : ""}${showPuppyActions ? " has-puppy-actions" : ""}${showSwingActions || showHorseActions || showTownActions ? " has-swing-actions" : ""}${ridingSwing ? " is-swinging" : ""}`}>
        {notice && !showPuppyActions && <div className="v-notice" role="status">{localizedNotice}</div>}
        {showLookout && <section className="v-lookout-controls" aria-label={t("Watchtower lookout", "見張り塔の展望台")}>
          <h2>{t("Watchtower lookout", "見張り塔の展望台")}</h2>
          {lookout.inside && <p>{t("WASD / arrows to walk · Mouse to look · Home/End turn, PgUp/PgDn tilt", "WASD・矢印で歩く · マウスで見回す · Home/Endで回転、PgUp/PgDnで上下")}</p>}
          <ShortcutButton className="v-interact" aria-keyshortcuts={lookout.inside ? "Escape" : "E"} disabled={lookout.pending}
            onClick={() => { if (lookout.inside) engine.current?.leaveLookout(); else engine.current?.enterLookout(); canvas.current?.querySelector("canvas")?.focus(); }}>
            <Keycap aria-hidden="true">{lookout.inside ? "Esc" : "E"}</Keycap>{lookout.pending ? t("Entering…", "入場中…") : lookout.inside ? t("Come down", "下に戻る") : t("Go up to the lookout", "展望台へ上がる")}
          </ShortcutButton>
        </section>}
        {showHorseActions && <HorseControls horse={(ridingHorse ?? nearHorse)!} riding={!!ridingHorse}
          busy={!!nearHorse?.owner && nearHorse.owner !== sharedSelfId} engine={engine.current}
          t={t} town={townContext} focus={() => canvas.current?.querySelector("canvas")?.focus()} />}
        {showTownActions && <TownControls context={townContext!} engine={engine.current} focus={() => canvas.current?.querySelector("canvas")?.focus()} />}
        {showSwingActions && <section className="v-swing-controls" aria-label={t("Swing controls", "ブランコの操作")}>
          <h2>{t("Meadow swings", "草原のブランコ")}</h2>
          {ridingSwing && <ShortcutButton className="v-context-close" aria-label={t("Get off the swing", "ブランコを降りる")} aria-keyshortcuts="Escape" onClick={() => { engine.current?.leaveSwing(); canvas.current?.querySelector("canvas")?.focus(); }}><X size={18} aria-hidden="true" /></ShortcutButton>}
          {ridingSwing ? <>
            <div className="v-swing-pump">
              {([['w', 'W', 'Forward', '前へ'], ['s', 'S', 'Back', '後ろへ']] as const).map(([key, shortcut, english, japanese]) =>
                <ShortcutButton key={key} className="v-interact" aria-keyshortcuts={key === "w" ? "W ArrowUp" : "S ArrowDown"}
                  onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); engine.current?.swingKey(key, true); }}
                  onPointerUp={() => engine.current?.swingKey(key, false)}
                  onPointerCancel={() => engine.current?.swingKey(key, false)}
                  onLostPointerCapture={() => engine.current?.swingKey(key, false)}
                  onBlur={() => engine.current?.swingKey(key, false)}
                  onClick={event => { if (event.detail === 0) engine.current?.pushSwing(key === 'w' ? 1 : -1); }}>
                  <Keycap aria-hidden="true">{shortcut}</Keycap>{t(english, japanese)}
                </ShortcutButton>)}
            </div>
            <div className="v-swing-secondary">
              <ShortcutButton className="v-interact" aria-keyshortcuts="Space"
                onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); engine.current?.swingKey(" ", true); }}
                onPointerUp={() => engine.current?.swingKey(" ", false)}
                onPointerCancel={() => engine.current?.swingKey(" ", false)}
                onLostPointerCapture={() => engine.current?.swingKey(" ", false)}
                onBlur={() => engine.current?.swingKey(" ", false)}
                onClick={event => { if (event.detail === 0) engine.current?.brakeSwing(); }}>
                <Keycap aria-hidden="true">␣</Keycap>{t("Brake", "ブレーキ")}
              </ShortcutButton>
              <ShortcutButton className="v-interact" aria-keyshortcuts="E Escape" onClick={() => { engine.current?.leaveSwing(); canvas.current?.querySelector("canvas")?.focus(); }}>
                <Keycap aria-hidden="true">Esc</Keycap>{t("Get off", "降りる")}
              </ShortcutButton>
            </div>
          </> : nearSwing && <div className="v-swing-pump">
            {([0, 1] as const).map(index => <ShortcutButton key={index} className="v-interact" aria-keyshortcuts={nearSwing.index === index ? "E" : undefined}
              disabled={occupiedSwings.some(seat => seat.id === nearSwing.id && seat.index === index)}
              onClick={() => { engine.current?.rideSwing(nearSwing.id, index); canvas.current?.querySelector("canvas")?.focus(); }}>
              {nearSwing.index === index && <Keycap aria-hidden="true">E</Keycap>}{t(index === 0 ? "Left swing" : "Right swing", index === 0 ? "左のブランコ" : "右のブランコ")}
            </ShortcutButton>)}
          </div>}
        </section>}
        {showWorldInteraction && seatedBench && <div className="v-bench-actions">
          <ShortcutButton className="v-interact" aria-keyshortcuts={picnicContext?.kind === "picnic" ? "Escape" : "E Escape"} onClick={() => { engine.current?.stand(); canvas.current?.querySelector("canvas")?.focus(); }}><Keycap aria-hidden="true">Esc</Keycap>{t("Stand up", "立ち上がる")}</ShortcutButton>
          {picnicContext?.kind === "picnic" && <>
            {picnicContext.dish && <ShortcutButton className="v-interact" aria-keyshortcuts="E" onClick={() => engine.current?.interactPicnic()}><Keycap aria-hidden="true">E</Keycap>{t("Eat a portion", "1人分を食べる")}</ShortcutButton>}
            <ShortcutButton className="v-interact" aria-keyshortcuts="F" onClick={() => engine.current?.openPicnicBasket()}><Keycap aria-hidden="true">F</Keycap>{t("Share & eat", "料理を分ける・食べる")}</ShortcutButton>
          </>}
          <button className="v-context-close" aria-label={t("Leave bench", "ベンチを離れる")} onClick={() => { engine.current?.stand(); canvas.current?.querySelector("canvas")?.focus(); }}><X size={18} aria-hidden="true" /></button>
        </div>}
        {showWorldInteraction && !showPicnicActions && !seatedBench && nearBench && <ShortcutButton className="v-interact" aria-keyshortcuts="E" onClick={() => { engine.current?.sit(nearBench); canvas.current?.querySelector("canvas")?.focus(); }}><Keycap aria-hidden="true">E</Keycap>{t("Sit on the bench", "ベンチに座る")}</ShortcutButton>}
        {showWorldInteraction && !showPicnicActions && !showTownActions && !showHorseActions && !seatedBench && !nearBench && nearGarden && nearbyAction && <ShortcutButton className="v-interact" aria-keyshortcuts="E" onClick={() => interactGarden(nearGarden)}><Keycap aria-hidden="true">E</Keycap>{nearbyLabel}<Leaf size={17} /></ShortcutButton>}
        {showWorldInteraction && !showTownActions && !showHorseActions && nearBirds && !nearbyAction && <ShortcutButton className="v-interact v-bird-feed-button" disabled={birdMealBusy}
          aria-keyshortcuts={seatedBench === "bird-clearing-bench" ? "F" : !nearBench && !seatedBench ? "E" : undefined}
          onClick={() => seatedBench === "bird-clearing-bench" ? scatterBenchCrumbs() : onGardenAction({ kind: "feedBirds" })}
          onKeyDown={event => {
            const shortcut = seatedBench === "bird-clearing-bench" ? "f" : !nearBench && !seatedBench ? "e" : null;
            if (shortcut && gameKey(keybindings, event.key) === shortcut && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey) {
              event.preventDefault(); event.stopPropagation();
              if (shortcut === "f") scatterBenchCrumbs(); else onGardenAction({ kind: "feedBirds" });
            }
          }}>
          {seatedBench === "bird-clearing-bench" ? <Keycap aria-hidden="true">F</Keycap> : !nearBench && !seatedBench && <Keycap aria-hidden="true">E</Keycap>}
          {seatedBench === "bird-clearing-bench" || garden.crumbPouch ? t("Scatter sourdough crumbs", "サワードウのパンくずを撒く") : t("Find Maple or Wren for crumbs", "メープルかレンからパンくずをもらう")}<Bird size={17} />
        </ShortcutButton>}
        {showWorldInteraction && !showPuppyActions && !showSwingActions && showPackHome && <ShortcutButton className="v-interact v-puppy-home" aria-keyshortcuts="H" onClick={() => engine.current?.sendPuppyHome()}
          onKeyDown={event => {
            if (gameKey(keybindings, event.key) === "h" && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey) {
              event.preventDefault(); event.stopPropagation(); engine.current?.sendPuppyHome();
            }
          }}>
          <Keycap aria-hidden="true">H</Keycap>{t(followingPuppies.length === 1 ? `Send ${followingPuppies[0].name} home` : `Send all ${followingPuppies.length} dogs home`, "犬たちを元の場所に戻す")}
        </ShortcutButton>}
        {showPuppyActions && nearPuppy && <section className="v-puppy-actions" aria-label={t(`${nearPuppy.name} actions`, `${puppyName}とのふれあい`)}
          onKeyDown={event => {
            if (puppyBusy || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
            const key = gameKey(keybindings, event.key);
            const command = puppyCommandForKey(gameKey(keybindings, event.key));
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
            <PawPrint size={22} aria-hidden="true" />
            <div><h2>{puppyName}</h2>
              <p>{t(puppyBusy ? "Spending time with another visitor" : puppyIsFollowing ? "Walking with you" : PUPPY_INFO[nearPuppy.breed].breed, puppyBusy ? "ほかの人とふれあい中" : puppyIsFollowing ? "一緒にお散歩中" : "小さなお友だち")}</p></div>
            {puppyTricksOpen && <ShortcutButton className="v-context-close" aria-label={t("Close dog tricks", "犬の芸を閉じる")} aria-keyshortcuts="Escape" onClick={() => { setTricksPuppyId(null); canvas.current?.querySelector("canvas")?.focus(); }}><X size={18} aria-hidden="true" /></ShortcutButton>}
          </div>
          <div className="v-puppy-main-actions">
            <ShortcutButton disabled={puppyBusy} className="v-interact" aria-keyshortcuts="E" aria-label={t(`Pet ${nearPuppy.name}`, `${puppyName}をなでる`)}
              onClick={() => { canvas.current?.querySelector("canvas")?.focus(); engine.current?.petPuppy(nearPuppy.id); }}>
              <Keycap aria-hidden="true">E</Keycap>{t("Pet", "なでる")}
            </ShortcutButton>
            <ShortcutButton disabled={puppyBusy} className="v-interact" aria-keyshortcuts="P" aria-label={t(puppyIsFollowing ? `Let ${nearPuppy.name} go home` : `Walk with ${nearPuppy.name}`, puppyIsFollowing ? `${puppyName}を元の場所に戻す` : `${puppyName}と歩く`)}
              onClick={() => engine.current?.togglePuppyFollow(nearPuppy.id)}>
              <Keycap aria-hidden="true">P</Keycap>{t(puppyIsFollowing ? "Home" : "Walk", puppyIsFollowing ? "おうちへ" : "お散歩")}
            </ShortcutButton>
            <ShortcutButton disabled={puppyBusy} className="v-interact v-puppy-tricks-toggle" aria-keyshortcuts={puppyTricksOpen ? "T Escape" : "T"} aria-expanded={puppyTricksOpen} aria-controls="v-puppy-tricks"
              onClick={() => setTricksPuppyId(puppyTricksOpen ? null : nearPuppy.id)}>
              <Keycap aria-hidden="true">T</Keycap>{t("Tricks", "芸")}
              <CaretDown size={12} aria-hidden="true" />
            </ShortcutButton>
          </div>
          <div id="v-puppy-tricks" className="v-puppy-trick-list" hidden={!puppyTricksOpen}>
            {PUPPY_TRICKS.map(({ command, key, english, japanese }) =>
              <ShortcutButton disabled={puppyBusy} key={command} className="v-interact" aria-keyshortcuts={key}
                onClick={() => engine.current?.commandPuppy(nearPuppy.id, command)}>
                <Keycap aria-hidden="true">{key}</Keycap>{t(english, japanese)}
              </ShortcutButton>)}
          </div>
          {showPackHome && <ShortcutButton className="v-interact v-puppy-home" aria-keyshortcuts="H" onClick={() => engine.current?.sendPuppyHome()}>
            <Keycap aria-hidden="true">H</Keycap>{t(followingPuppies.length === 1 ? `Send ${followingPuppies[0].name} home` : `Send all ${followingPuppies.length} dogs home`, "犬たちを元の場所に戻す")}
          </ShortcutButton>}
          {notice && <div className="v-puppy-response" role="status">{localizedNotice}</div>}
        </section>}
        {showPicnicActions && <section className="v-picnic-near">
          {(picnicContext?.kind === "kitchen" || picnicContext?.seatIndex !== undefined || picnicContext?.dish) && <ShortcutButton className="v-interact" aria-keyshortcuts="E" onClick={() => engine.current?.interactPicnic()}><Keycap>E</Keycap>
            {picnicContext?.seatIndex !== undefined ? t(`Sit on cushion ${picnicContext.seatIndex + 1}`, `クッション${picnicContext.seatIndex + 1}に座る`) : picnicContext?.dish ? t(`Eat ${recipeById(picnicContext.dish.recipe)?.name}`, `${recipeById(picnicContext.dish.recipe)?.japanese}を食べる`) : t("Cook in the garden kitchen", "キッチンで料理する")}
          </ShortcutButton>}
          {picnicContext?.kind === "picnic" && <ShortcutButton className="v-interact" aria-keyshortcuts="F" onClick={() => engine.current?.openPicnicBasket()}><Keycap aria-hidden="true">F</Keycap>{t("Open picnic basket", "ピクニックかごを開く")}</ShortcutButton>}
        </section>}
        {showWorldInteraction && !showPicnicActions && !showTownActions && !showHorseActions && nearPlace && nearPlace.id !== "birds" && nearPlace.id !== "garden" && !showSwingActions && !nearBench && !seatedBench && !nearbyAction && !nearPuppy && <ShortcutButton className="v-interact" aria-keyshortcuts="E" onClick={() => openPlace(nearPlace.id)}>
          <Keycap>E</Keycap>{ja ? placeName(nearPlace.id) : nearPlace.prompt}<ArrowUpRight size={16} />
        </ShortcutButton>}
      </div>}
      {showWorldInteraction && !panel && !sceneryLoading && <>
        <TownActivityHUD state={activityHUD} language={language} />
        <CookingHUD context={picnicContext} state={picnicState} selfId={sharedSelfId} language={language} connected={sharedStatus === "Connected"} act={picnicAct} readClock={() => engine.current?.getSharedNow() ?? Date.now()} />
      </>}
      {gardenStorageError && !sharedTrialEnabled && <div className="v-save-warning" role="status">{t("Your garden works for this visit, but this browser couldn't save it.", "この訪問中は遊べますが、庭をブラウザに保存できませんでした。")}</div>}
      {sharedTrialEnabled && entered && <div className="v-shared-trial">
        <button className={`v-shared-toggle${chatUnread && !chatOpen ? " has-new-message" : ""}`} onClick={() => { setChatOpen(open => !open); setChatUnread(false); }} aria-expanded={chatOpen} aria-label={chatOpen ? t("Hide Hearthwillow chat", "村のチャットを隠す") : chatUnread ? t("Open Hearthwillow chat, new message", "村のチャットを開く。新しいメッセージがあります") : t("Open Hearthwillow chat", "村のチャットを開く")}>
          <UsersThree size={18} /> {sharedStatus === "Connected" ? t(`${sharedPeople.length} ${sharedPeople.length === 1 ? "blob" : "blobs"} here`, `${sharedPeople.length}人が村にいます`) : villageNotice(sharedStatus, language)}
          {chatUnread && !chatOpen && <span key={chatPulse} className="v-shared-unread" aria-hidden="true" />}
        </button>
        {chatOpen && <section className="v-shared-chat" aria-label={t("Hearthwillow chat", "村のチャット")}>
          <div className="v-shared-chat-header"><h2>{t("Hearthwillow chat", "村のチャット")}</h2><button onClick={() => setChatOpen(false)} aria-label={t("Close Hearthwillow chat", "村のチャットを閉じる")}><X size={18} /></button></div>
          {chatPeople.length > 0 && <div className="v-shared-people">
            {chatPeople.length > 3 && <details>
              <summary>{t(`See everyone here (${chatPeople.length})`, `村にいるみんなを見る（${chatPeople.length}人）`)}</summary>
              {chatPeopleList}
            </details>}
            {chatPeople.length <= 3 && chatPeopleList}
          </div>}
          <p className="v-shared-chat-note">{t(`Everyone is in Hearthwillow. Messages clear each hour${sharedChatHour ? `, next at ${chatTime((sharedChatHour + 1) * 3_600_000)} your time` : ""}.`, `みんな同じ村にいます。メッセージは毎時消去されます。${sharedChatHour ? `次は端末の時刻で${chatTime((sharedChatHour + 1) * 3_600_000)}です。` : ""}`)}</p>
          <div className="v-shared-chat-log" ref={chatLog} role="log" aria-live="polite">{sharedChat.length ? sharedChat.map((entry, index) => {
            const sentAt = typeof entry.sentAt === "number" && Number.isFinite(entry.sentAt) ? new Date(entry.sentAt) : null;
            return <p key={index}><strong><bdi>{entry.name}</bdi></strong> <bdi>{entry.message}</bdi>{sentAt && Number.isFinite(sentAt.getTime()) && <time className="v-shared-chat-time" dateTime={sentAt.toISOString()}>{chatTime(sentAt.getTime())}</time>}</p>;
          }) : <p className="v-shared-chat-empty">{t("No messages yet.", "まだメッセージはありません。")}</p>}</div>
          <form onSubmit={event => {
            event.preventDefault();
            const message = chatDraft.trim();
            if (chatComposing.current || !message || Date.now() < chatCooldownUntil) return;
            if (sharedTrialRef.current?.sendChat(message)) setChatDraft("");
            else setNotice(t("Chat isn't ready yet. Your message is still here.", "チャットの準備ができていません。メッセージは入力欄に残っています。"));
          }}>
            <input ref={chatInput} aria-label={t("Message", "メッセージ")} value={chatDraft} onCompositionStart={() => { chatComposing.current = true; }} onCompositionEnd={() => { chatComposing.current = false; }} onChange={event => setChatDraft(event.target.value)} onKeyDown={event => {
              event.stopPropagation();
              // IME confirmation must not submit or close chat (Safari also uses keyCode 229).
              if (chatComposing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
                if (event.key === "Enter") event.preventDefault();
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setChatOpen(false);
                canvas.current?.querySelector("canvas")?.focus();
              } else if (event.key === "Enter" && Date.now() < chatCooldownUntil) event.preventDefault();
            }} maxLength={180} placeholder={t('Press "Enter" to type!', "Enterで入力を始める")} disabled={sharedStatus !== "Connected"} />
            <button type="submit" aria-label={chatCooldownSeconds > 0 ? t(`Send in ${chatCooldownSeconds} seconds`, `あと${chatCooldownSeconds}秒で送信できます`) : t("Send message", "メッセージを送信")} disabled={!chatDraft.trim() || sharedStatus !== "Connected" || chatCooldownSeconds > 0}>
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
      <VillageMenus touch={touchControls} panel={panel} setPanel={setPanel} canvas={canvas} engine={engine} settings={settings} inventory={inventory}
        picnicContext={picnicContext} picnicState={picnicState} selfId={sharedSelfId} connected={sharedStatus === "Connected"}
        picnicAct={picnicAct}
        place={place} notice={localizedNotice} entered={entered} setEntered={setEntered} enableSound={enableSound} openPlace={openPlace} travelOutdoor={id => {
          engine.current?.travelToMapDestination(id, () => {
            activityRequestRef.current++; pendingActivityRef.current = null;
            setPlace(null); audio.current?.setPlace(null); setPanel(null); setEntered(true);
            canvas.current?.querySelector("canvas")?.focus();
          });
        }}
        sound={sound} soundLoading={soundLoading} toggleSound={toggleSound} openRadio={openRadio}
        radioPrefs={radioPrefs} radioLoading={radioLoading} radioError={radioError} selectStation={selectStation}
        nextRadioTrack={nextRadioTrack} playVillageMusic={playVillageMusic} showStats={showStats} setShowStats={setShowStats} stats={stats} />
    </div></KeybindingContext.Provider>
  );
}

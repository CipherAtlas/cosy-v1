"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { VillageMenus, type VillagePanel } from "./VillageMenus";
import { useVillagePreferences } from "./useVillagePreferences";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  CaretDown,
  GearSix,
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


export function Village() {
  const [isPhone, setIsPhone] = useState<boolean | null>(null);
  const [kicked, setKicked] = useState(false);
  const onKicked = useCallback(() => setKicked(true), []);
  useEffect(() => {
    const browser = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
    setIsPhone(browser.userAgentData?.mobile === true || /iPhone|iPod|Android.*Mobile|Windows Phone|IEMobile|Opera Mini/i.test(browser.userAgent));
  }, []);
  if (isPhone === false) return kicked ? <KickedScreen /> : <VillageScene onKicked={onKicked} />;
  return <main className="v-device-gate" aria-busy={isPhone === null}>
    <h1>Hearthwillow</h1>
    <p role="status">{isPhone ? "Please open the village on a laptop or PC." : "Opening the village…"}</p>
  </main>;
}

function KickedScreen() {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (document.pointerLockElement) document.exitPointerLock();
    heading.current?.focus();
  }, []);
  return <main className="v-scenery-loading">
    <div className="v-scenery-loading-content v-kicked-content">
      <Leaf size={35} weight="light" aria-hidden="true" />
      <h1 ref={heading} tabIndex={-1}>You've been kicked from this village.</h1>
      <p>Log back in later!</p>
    </div>
  </main>;
}

function VillageScene({ onKicked }: { onKicked: () => void }) {
  const canvas = useRef<HTMLDivElement>(null),
    engine = useRef<VillageEngine | null>(null),
    audio = useRef<VillageAudio | null>(null);
  const readMapPose = useCallback(() => engine.current?.getPlayerPose() ?? null, []);
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
  const [nearSwing, setNearSwing] = useState<import("./swings").SwingSeat | null>(null);
  const [ridingSwing, setRidingSwing] = useState<import("./swings").SwingSeat | null>(null);
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
  const settings = useVillagePreferences();
  const { mix, setMix, quality, weather, language, mouseSensitivity } = settings;
  const [sound, setSound] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState({ fps: 0, draws: 0, triangles: 0 });
  const preferences = useRef({ quality, weather, language, mouseSensitivity });
  preferences.current = { quality, weather, language, mouseSensitivity };
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
    setNotice("Your session is complete. Take a breath.");
  });
  const openPlace = useCallback((id: PlaceId) => {
    const enter = (index?: 0 | 1, position?: [number, number, number]) => {
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
          nearPuppy: setNearPuppy,
          cottageCat: setCottageCat,
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
          local.setSharedConnected(sharedConnectedRef.current);
        }
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
    audio.current?.setMix(mix);
  }, [mix]);
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
      if (e.defaultPrevented || e.repeat || e.isComposing) return;
      if (e.key === "Escape" && entered && !panel && !sceneryLoading) {
        e.preventDefault();
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
      if (e.metaKey || e.ctrlKey || e.altKey || !entered || panel || sceneryLoading) return;
      if (e.target instanceof Element && e.target.closest("button, summary, a[href]") && (e.key === "Enter" || e.key === " ")) return;
      if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement) && sharedTrialEnabled && entered && !panel && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setChatOpen(true);
        setChatUnread(false);
        engine.current?.releaseMouseLook();
        requestAnimationFrame(() => chatInput.current?.focus());
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "m" || key === "o" || e.key === ",") {
        e.preventDefault();
        setPanel(key === "m" ? "places" : key === "o" ? "sound" : "settings");
        return;
      }
      if (place && key === "u") {
        e.preventDefault();
        setActivityCompact(value => !value);
        canvas.current?.querySelector("canvas")?.focus();
        return;
      }
      if (place && !(e.target instanceof HTMLButtonElement && (e.key === " " || e.key === "Enter"))) {
        const shortcut = e.key === " " ? "space" : key;
        const button = [...(canvas.current?.parentElement?.querySelectorAll<HTMLButtonElement>("#v-activity-panel button[aria-keyshortcuts]") ?? [])]
          .find(control => !control.disabled && control.getClientRects().length > 0
            && control.getAttribute("aria-keyshortcuts")?.toLowerCase().split(/\s+/).includes(shortcut));
        if (button) { e.preventDefault(); button.click(); }
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [place, entered, panel, sharedTrialEnabled, sceneryLoading]);
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
      if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        setTricksPuppyId(puppyTricksOpen ? null : nearPuppy.id);
        canvas.current?.querySelector("canvas")?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showPuppyActions, nearPuppy, puppyTricksOpen, puppyBusy]);
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
          {ready ? <VillageMinimap scenery={engine.current?.mapScenery} current={place} language={language}
            readPose={readMapPose} expand={() => setPanel("places")} /> : <button
            disabled={!ready}
            aria-label={t("Village map", "村の地図")}
            aria-keyshortcuts="M"
            onClick={() => setPanel("places")}
          >
            <kbd aria-hidden="true">M</kbd><MapTrifold size={19} />
            <span>{t("Map", "地図")}</span>
          </button>}
          <button
            disabled={!ready}
            aria-label={t("Settings", "設定")}
            aria-keyshortcuts=","
            onClick={() => setPanel("settings")}
          >
            <kbd aria-hidden="true">,</kbd><GearSix size={20} />
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
            <span><kbd>Tab</kbd>{t("Choose controls", "操作を選ぶ")}</span>
            <span>{mouseLook === "locked" ? t("Mouse to look · Esc to leave / release", "マウスで見回す · Escで終了 / 解除")
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
        <button className="v-context-close v-activity-close" aria-label={t("Leave activity", "アクティビティを閉じる")} aria-keyshortcuts="Escape" onClick={leave}><X size={19} aria-hidden="true" /></button>
        </div>
        </div>
      )}
      {entered && place && (
        <div className="v-activity-controls" role="group" aria-label={t("Activity controls", "アクティビティの操作")}>
        <button className="v-interact v-leave" aria-keyshortcuts="Escape" onClick={leave}>
          <kbd aria-hidden="true">Esc</kbd>{t("Back to village", "村に戻る")}
        </button>
        <button className="v-interact v-scene-toggle" aria-keyshortcuts="U" aria-controls="v-activity-panel" aria-expanded={!activityCompact} onClick={()=>setActivityCompact(value=>!value)}>
          <kbd aria-hidden="true">U</kbd>
          {activityCompact ? t("Show activity", "操作を表示") : t("Enjoy the view", "景色を楽しむ")}<CaretDown size={16} style={{transform:activityCompact?"rotate(180deg)":undefined}} />
        </button>
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
      {error && (
        <div className="v-error" role="status">
          {error}
          {entered && <button onClick={() => { setError(""); setProgress(0); setEngineAttempt(value => value + 1); }}>{t("Retry the village", "村をもう一度開く")}</button>}
        </div>
      )}
      {entered && ready && place === "focus" && !panel && cottageCat !== "away" && (
        <div className="v-cottage-cat" role="group" aria-label={t("Cottage cat", "コテージの猫")}>
          <span role="status">{t(cottageCat === "petting" ? "A happy little purr." : "A little company?", cottageCat === "petting" ? "うれしそうにゴロゴロ。" : "なでてくれる？")}</span>
          <button className="v-interact" disabled={cottageCat === "petting"} aria-keyshortcuts="E"
            onClick={() => { engine.current?.petCottageCat(); canvas.current?.querySelector("canvas")?.focus(); }}>
            <kbd aria-hidden="true">E</kbd>{t(cottageCat === "petting" ? "Petting…" : "Pet the cat", cottageCat === "petting" ? "なでています…" : "猫をなでる")}
          </button>
        </div>
      )}
      {!showActivityPanel && <div className={`v-world-feedback${showWorldInteraction ? " is-walking" : ""}${showPuppyActions ? " has-puppy-actions" : ""}${showSwingActions ? " has-swing-actions" : ""}${ridingSwing ? " is-swinging" : ""}`}>
        {notice && !showPuppyActions && <div className="v-notice" role="status">{notice}</div>}
        {showSwingActions && <section className="v-swing-controls" aria-label={t("Swing controls", "ブランコの操作")}>
          <h2>{t("Meadow swings", "草原のブランコ")}</h2>
          {ridingSwing && <button className="v-context-close" aria-label={t("Get off the swing", "ブランコを降りる")} aria-keyshortcuts="Escape" onClick={() => { engine.current?.leaveSwing(); canvas.current?.querySelector("canvas")?.focus(); }}><X size={18} aria-hidden="true" /></button>}
          {ridingSwing ? <>
            <p>{t("Alternate with the arc to swing higher.", "揺れに合わせて前へ・後ろへ。もっと高く！")}</p>
            <div className="v-swing-pump">
              {([['w', 'W', 'Forward', '前へ'], ['s', 'S', 'Back', '後ろへ']] as const).map(([key, shortcut, english, japanese]) =>
                <button key={key} className="v-interact" aria-keyshortcuts={key === "w" ? "W ArrowUp" : "S ArrowDown"}
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
              <button className="v-interact" aria-keyshortcuts="E Escape" onClick={() => { engine.current?.leaveSwing(); canvas.current?.querySelector("canvas")?.focus(); }}>
                <kbd aria-hidden="true">Esc</kbd>{t("Get off", "降りる")}
              </button>
            </div>
          </> : nearSwing && <div className="v-swing-pump">
            {([0, 1] as const).map(index => <button key={index} className="v-interact" aria-keyshortcuts={nearSwing.index === index ? "E" : undefined}
              disabled={occupiedSwings.some(seat => seat.id === nearSwing.id && seat.index === index)}
              onClick={() => { engine.current?.rideSwing(nearSwing.id, index); canvas.current?.querySelector("canvas")?.focus(); }}>
              {nearSwing.index === index && <kbd aria-hidden="true">E</kbd>}{t(index === 0 ? "Left swing" : "Right swing", index === 0 ? "左のブランコ" : "右のブランコ")}
            </button>)}
          </div>}
        </section>}
        {showWorldInteraction && seatedBench && <div className="v-bench-actions">
          <button className="v-interact" aria-keyshortcuts="E Escape" onClick={() => { engine.current?.stand(); canvas.current?.querySelector("canvas")?.focus(); }}><kbd aria-hidden="true">Esc</kbd>{t("Stand up", "立ち上がる")}</button>
          <button className="v-context-close" aria-label={t("Leave bench", "ベンチを離れる")} onClick={() => { engine.current?.stand(); canvas.current?.querySelector("canvas")?.focus(); }}><X size={18} aria-hidden="true" /></button>
        </div>}
        {showWorldInteraction && !seatedBench && nearBench && <button className="v-interact" aria-keyshortcuts="E" onClick={() => { engine.current?.sit(nearBench); canvas.current?.querySelector("canvas")?.focus(); }}><kbd aria-hidden="true">E</kbd>{t("Sit on the bench", "ベンチに座る")}</button>}
        {showWorldInteraction && !seatedBench && !nearBench && nearGarden && nearbyAction && <button className="v-interact" aria-keyshortcuts="E" onClick={() => interactGarden(nearGarden)}><kbd aria-hidden="true">E</kbd>{nearbyLabel}<Leaf size={17} /></button>}
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
            if (puppyBusy || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
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
            <PawPrint size={22} aria-hidden="true" />
            <div><h2>{t(nearPuppy.name, nearPuppy.name === PUPPY_INFO[nearPuppy.breed].name ? PUPPY_INFO[nearPuppy.breed].japanese : nearPuppy.name)}</h2>
              <p>{t(puppyBusy ? "Spending time with another visitor" : puppyIsFollowing ? "Walking with you" : PUPPY_INFO[nearPuppy.breed].breed, puppyBusy ? "ほかの人とふれあい中" : puppyIsFollowing ? "一緒にお散歩中" : "小さなお友だち")}</p></div>
            {puppyTricksOpen && <button className="v-context-close" aria-label={t("Close dog tricks", "犬の芸を閉じる")} aria-keyshortcuts="Escape" onClick={() => { setTricksPuppyId(null); canvas.current?.querySelector("canvas")?.focus(); }}><X size={18} aria-hidden="true" /></button>}
          </div>
          <div className="v-puppy-main-actions">
            <button disabled={puppyBusy} className="v-interact" aria-keyshortcuts="E" aria-label={t(`Pet ${nearPuppy.name}`, `${nearPuppy.name}をなでる`)}
              onClick={() => { canvas.current?.querySelector("canvas")?.focus(); engine.current?.petPuppy(nearPuppy.id); }}>
              <kbd aria-hidden="true">E</kbd>{t("Pet", "なでる")}
            </button>
            <button disabled={puppyBusy} className="v-interact" aria-keyshortcuts="P" aria-label={t(puppyIsFollowing ? `Let ${nearPuppy.name} go home` : `Walk with ${nearPuppy.name}`, puppyIsFollowing ? `${nearPuppy.name}を元の場所に戻す` : `${nearPuppy.name}と歩く`)}
              onClick={() => engine.current?.togglePuppyFollow(nearPuppy.id)}>
              <kbd aria-hidden="true">P</kbd>{t(puppyIsFollowing ? "Home" : "Walk", puppyIsFollowing ? "おうちへ" : "お散歩")}
            </button>
            <button disabled={puppyBusy} className="v-interact v-puppy-tricks-toggle" aria-keyshortcuts={puppyTricksOpen ? "T Escape" : "T"} aria-expanded={puppyTricksOpen} aria-controls="v-puppy-tricks"
              onClick={() => setTricksPuppyId(puppyTricksOpen ? null : nearPuppy.id)}>
              <kbd aria-hidden="true">T</kbd>{t("Tricks", "芸")}
              <CaretDown size={12} aria-hidden="true" />
            </button>
          </div>
          <div id="v-puppy-tricks" className="v-puppy-trick-list" hidden={!puppyTricksOpen}>
            {PUPPY_TRICKS.map(({ command, key, english, japanese }) =>
              <button disabled={puppyBusy} key={command} className="v-interact" aria-keyshortcuts={key}
                onClick={() => engine.current?.commandPuppy(nearPuppy.id, command)}>
                <kbd aria-hidden="true">{key}</kbd>{t(english, japanese)}
              </button>)}
          </div>
          {showPackHome && <button className="v-interact v-puppy-home" aria-keyshortcuts="H" onClick={() => engine.current?.sendPuppyHome()}>
            <kbd aria-hidden="true">H</kbd>{t(followingPuppies.length === 1 ? `Send ${followingPuppies[0].name} home` : `Send all ${followingPuppies.length} dogs home`, "犬たちを元の場所に戻す")}
          </button>}
          {notice && <div className="v-puppy-response" role="status">{notice}</div>}
        </section>}
        {showWorldInteraction && nearPlace && nearPlace.id !== "birds" && nearPlace.id !== "garden" && !showSwingActions && !nearBench && !seatedBench && !nearbyAction && !nearPuppy && <button className="v-interact" aria-keyshortcuts="E" onClick={() => openPlace(nearPlace.id)}>
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
            <input ref={chatInput} aria-label="Message" value={chatDraft} onChange={event => setChatDraft(event.target.value)} onKeyDown={event => {
              event.stopPropagation();
              if (event.key === "Escape") {
                event.preventDefault();
                setChatOpen(false);
                canvas.current?.querySelector("canvas")?.focus();
              } else if (event.key === "Enter" && Date.now() < chatCooldownUntil) event.preventDefault();
            }} maxLength={180} placeholder='Press "Enter" to type!' disabled={sharedStatus !== "Connected"} />
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
      <VillageMenus panel={panel} setPanel={setPanel} canvas={canvas} engine={engine} settings={settings}
        garden={garden} place={place} notice={notice} entered={entered} setEntered={setEntered} enableSound={enableSound} openPlace={openPlace}
        sound={sound} soundLoading={soundLoading} toggleSound={toggleSound} openRadio={openRadio}
        radioPrefs={radioPrefs} radioLoading={radioLoading} radioError={radioError} selectStation={selectStation}
        nextRadioTrack={nextRadioTrack} playVillageMusic={playVillageMusic} showStats={showStats} setShowStats={setShowStats} stats={stats} />
    </div>
  );
}

import { useEffect, useRef, useState, type RefObject } from "react";
import type { VillageAudio } from "./audio";
import { PERSONAL_RADIO_ENABLED, type RadioPreferences } from "./RadioControls";
import { isRadioStationId, isRadioTrack, RADIO_PAGE_SIZE, RADIO_STATIONS, searchRadio, type RadioStationId } from "./radioCatalog";
import type { RadioTrack } from "./soundtrack";

const INITIAL_RADIO: RadioPreferences = { mode: "radio", station: "lofi", track: null, favorites: [], queue: [], paused: false };

/** Keeps the deferred personal-radio lifecycle separate from shared village controls. */
export function useVillageRadio({ audio, language, entered, panel, sound, enableSound, setNotice }: {
  audio: RefObject<VillageAudio | null>; language: "en" | "ja"; entered: boolean;
  panel: string | null; sound: boolean; enableSound: () => Promise<void>; setNotice: (notice: string) => void;
}) {
  const languageRef = useRef(language); languageRef.current = language;
  const t = (en: string, jp: string) => language === "ja" ? jp : en;
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
  useEffect(() => {
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
        if (saved.mode === "radio" && saved.track) void audio.current?.selectRadio(saved.track);
        audio.current?.setMusicPaused(saved.paused);
      }
    } catch {}
    if (PERSONAL_RADIO_ENABLED) setRadioLoaded(true);
  }, [audio]);
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
      if (!radioStation.current.length) setRadioError(languageRef.current === "ja" ? "この局の曲を読み込めませんでした。別の局をお試しください。" : "No songs loaded for this station. Try another.");
    }).catch(() => {
      if (!controller.signal.aborted) setRadioError(languageRef.current === "ja" ? "局を読み込めませんでした。もう一度お試しください。" : "Could not tune the station. Try it again.");
    }).finally(() => { if (!controller.signal.aborted) setRadioLoading(false); });
    return () => { controller.abort(); radioNextController.current?.abort(); };
  }, [shouldSearchRadio, radioLoaded, radioPrefs.mode, radioPrefs.station, radioRequest]);
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
      if (!controller.signal.aborted) setRadioError(languageRef.current === "ja" ? "次の曲を読み込めませんでした。" : "Could not load the next song.");
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
  return { radioExpanded, setRadioExpanded, radioPrefs, radioLoading, radioError, radioEnded,
    updateRadio, playVillageMusic, selectStation, nextRadioTrack, toggleMusic };
}

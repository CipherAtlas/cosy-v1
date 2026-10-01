import { MusicNotes, Pause, Play, Radio, SkipForward, SlidersHorizontal, X } from "@phosphor-icons/react";
import { MixSliders } from "./Activities";
import { RADIO_STATIONS, type RadioStationId } from "./radioCatalog";
import type { AudioMix } from "./places";
import type { RadioTrack } from "./soundtrack";
import "./radio.css";

export type RadioPreferences = { mode: "radio" | "village"; station: RadioStationId; track: RadioTrack | null; favorites: RadioTrack[]; queue: RadioTrack[]; paused: boolean };
// Retained for a later release; the village currently plays its original recordings.
export const PERSONAL_RADIO_ENABLED = false;

type Language = "en" | "ja";

export function RadioDock({ expanded, setExpanded, track, mode, sound, paused, loading, toggleMusic, next, openSound, language }: {
  expanded: boolean; setExpanded: (open: boolean) => void; track: RadioTrack | null;
  mode: "radio" | "village"; sound: boolean; paused: boolean; loading: boolean;
  toggleMusic: () => void; next: () => void; openSound: () => void; language: Language;
}) {
  const ja = language === "ja", playing = sound && !paused;
  return <div className={`v-radio-dock${expanded ? " is-open" : ""}`}>
    {!expanded ? <button className="v-radio-open" onClick={() => setExpanded(true)} aria-label={ja ? "ラジオを表示" : "Show radio"} title={ja ? "ラジオを表示" : "Show radio"}>
      <Radio size={22} weight={playing ? "fill" : "regular"} /><span className="sr-only">{ja ? "ラジオ" : "Radio"}</span>
    </button> : <div className="v-radio-player" role="group" aria-label={ja ? "あなたのラジオ" : "Your radio"}>
      <button className="v-radio-main" onClick={toggleMusic} disabled={loading} aria-label={playing ? (ja ? "音楽を一時停止" : "Pause music") : (ja ? "音楽を再生" : "Play music")}>
        {playing ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
      </button>
      <button className="v-radio-next" onClick={next} disabled={loading} aria-label={ja ? "次の曲" : "Next song"}><SkipForward size={19} weight="fill" /></button>
      <button className="v-radio-now" onClick={openSound} aria-label={ja ? "音楽と音量を開く" : "Open music and volume"}>
        <strong>{track?.title ?? (mode === "radio" ? (ja ? "ラジオを合わせています…" : "Tuning radio…") : (ja ? "村の音楽" : "Village music"))}</strong><span>{track?.artist ?? (ja ? "ハースウィロー" : "Hearthwillow")}</span>
      </button>
      <button className="v-radio-sound" onClick={openSound} aria-label={ja ? "音量を調整" : "Adjust all sounds"} title={ja ? "音量を調整" : "Adjust all sounds"}><SlidersHorizontal size={20} /></button>
      <button className="v-radio-hide" onClick={() => setExpanded(false)} aria-label={ja ? "ラジオを隠す" : "Hide radio"}><X size={17} /></button>
    </div>}
  </div>;
}

export function SoundPanel({ track, station, mode, loading, error, selectStation, next, useVillageMusic, mix, setMix, language }: {
  track: RadioTrack | null; station: RadioStationId; mode: "radio" | "village";
  loading: boolean; error: string; selectStation: (station: RadioStationId) => void;
  next: () => void; useVillageMusic: () => void; mix: AudioMix; setMix: (mix: AudioMix) => void; language: Language;
}) {
  const ja = language === "ja";
  return <div className="v-radio-panel">
    <div className="v-radio-current"><MusicNotes size={22} /><div><strong>{track?.title ?? (mode === "radio" ? (ja ? "ラジオを合わせています…" : "Tuning radio…") : (ja ? "村の音楽" : "Village music"))}</strong><span>{track?.artist ?? "Hearthwillow"}</span></div>{track && <a href={`https://audius.co${track.permalink}`} target="_blank" rel="noreferrer">Audius ↗</a>}</div>
    <section className="v-radio-stations" aria-label={ja ? "ラジオ局" : "Radio stations"}>
      <h3>{ja ? "ラジオ局" : "Radio station"}</h3>
      <div className="v-radio-station-list">
        {RADIO_STATIONS.map(item => <button key={item.id} aria-pressed={mode === "radio" && station === item.id} onClick={() => selectStation(item.id)}>{ja ? item.ja : item.en}</button>)}
        <button aria-pressed={mode === "village"} onClick={useVillageMusic}>{ja ? "村の音楽" : "Village music"}</button>
      </div>
      <button className="v-radio-skip" onClick={next} disabled={loading}><SkipForward size={17} />{ja ? "次の曲" : "Next song"}</button>
      {loading && <p className="v-radio-status" role="status">{ja ? "ラジオを合わせています…" : "Tuning the radio…"}</p>}
      {error && <p className="v-radio-error" role="status">{error}</p>}
    </section>
    <section className="v-radio-mixer" aria-label={ja ? "すべての音量" : "All sound volumes"}>
      <h3>{ja ? "音量" : "Volume"}</h3>
      <MixSliders mix={mix} setMix={setMix} language={language} extended />
    </section>
    <p className="v-radio-source">{ja ? "ラジオの曲は Audius のアーティストから配信されています。選択と音量は、このブラウザだけに保存されます。" : "Radio music streams from artists on Audius. Your station and volumes stay in this browser."}</p>
  </div>;
}

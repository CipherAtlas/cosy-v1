"use client";
import { useEffect, useRef, useState } from "react";
import {
  Pause,
  Play,
  ArrowLeft,
  ArrowRight,
  ArrowCounterClockwise,
  Heart,
  Check,
} from "@phosphor-icons/react";
import type { AudioMix, PlaceId } from "./places";
import type { ActivityMoment } from "./environment";
import type { FocusSession } from "./useSession";
import { deleteGratitudeEntry, exportGratitudeText, importGratitudeText, readGratitudeEntries, saveGratitudeEntry, type GratitudeEntry } from "@/features/gratitude/storage";
import { BirdActivity, GardenActivity, MintTea, PondFeeding, type GardenControls } from "./GardenActivities";

type Props = {
  place: PlaceId;
  session: FocusSession;
  mix: AudioMix;
  setMix: (m: AudioMix) => void;
  radioEnabled: boolean;
  sound: boolean;
  toggleSound: () => void;
  musicPlaying: boolean;
  soundLoading: boolean;
  toggleMusic: () => void;
  openRadio: () => void;
  language: "en" | "ja";
  onMoment: (moment: ActivityMoment) => void;
  gardenControls: GardenControls;
};
const phrases = [
  "You are allowed to rest without earning it.",
  "Your quiet effort still counts.",
  "You do not have to solve everything today.",
  "There is room for you here, exactly as you are.",
  "It is okay to take your time.",
  "You can begin again, gently.",
  "One small thing is enough for now.",
  "You deserve the same care you give to others.",
];
const phrasesJa = [
  "休むために、何かを成し遂げる必要はありません。",
  "静かな努力にも、ちゃんと意味があります。",
  "今日、すべてを解決しなくても大丈夫です。",
  "ここには、ありのままのあなたの居場所があります。",
  "ゆっくりで大丈夫です。",
  "やさしく、もう一度始められます。",
  "今は、小さなことひとつで十分です。",
  "あなたも、誰かに向けるのと同じやさしさを受け取っていい。",
];
export function Activities(p: Props) {
  const ja = p.language === "ja",
    t = (en: string, jp: string) => (ja ? jp : en);
  const { place, session, onMoment } = p;
  const musicPlaying = p.radioEnabled ? p.musicPlaying : p.sound;
  const duration=(session.mode === "focus" ? session.minutes : session.breakMinutes)*60;
  useEffect(() => {
    if (place === "focus") onMoment({kind:"focus",running:session.running,progress:Math.max(0,Math.min(1,1-session.remaining/duration))});
    if (place === "music") onMoment({kind:"music",playing:musicPlaying});
  }, [place,session.running,session.remaining,duration,musicPlaying,onMoment]);
  if (p.place === "birds") return <BirdActivity {...p.gardenControls} />;
  if (p.place === "focus")
    return (
      <section
        className="v-activity v-focus"
        aria-label={t("Focus session", "集中セッション")}
      >
        {!p.session.done && <h2>{t(p.session.mode === "break" ? "A moment by the window." : "Settle into your own rhythm.", p.session.mode === "break" ? "窓辺でひと休み。" : "自分のペースで。")}</h2>}
        {p.session.done ? (
          <>
            <h2>{t("A little space, well spent.", "おつかれさまでした。")}</h2>
            <p>
              {t(
                "Take a breath. There is no hurry.",
                "ひと息ついて、ゆっくり。",
              )}
            </p>
          </>
        ) : (
          <>
            <div
              className="v-timer"
              aria-label={`${Math.floor(p.session.remaining / 60)} minutes ${p.session.remaining % 60} seconds`}
            >
              {String(Math.floor(p.session.remaining / 60)).padStart(2, "0")}
              <span>:</span>
              {String(p.session.remaining % 60).padStart(2, "0")}
            </div>
            <p className="v-intention">
              {p.session.intention ||
                t(
                  p.session.mode === "break"
                    ? "A moment to rest."
                    : "One thing at a time.",
                  p.session.mode === "break"
                    ? "ひと休みしましょう。"
                    : "ひとつずつ、ゆっくり。",
                )}
            </p>
          </>
        )}
        {!p.session.running && !p.session.done && <div className="v-preset-row" role="group" aria-label={t("Focus and break length", "集中と休憩の長さ")}>
          {[[25, 5], [50, 10], [10, 2]].map(([minutes, rest], i) => <button key={minutes} className="v-chip" aria-keyshortcuts={String(i + 1)} aria-pressed={p.session.minutes === minutes && p.session.breakMinutes === rest} onClick={() => p.session.duration(minutes, rest)}>
            <kbd aria-hidden="true">{i + 1}</kbd>
            {minutes} {t("min focus", "分集中")} · {rest} {t("rest", "分休憩")}
          </button>)}
        </div>}
        <div className="v-actions">
          <button className="v-button v-primary" aria-keyshortcuts="Space" onClick={p.session.toggle}>
            <kbd aria-hidden="true">␣</kbd>
            {p.session.running ? (
              <Pause size={17} weight="fill" />
            ) : (
              <Play size={17} weight="fill" />
            )}
            {p.session.running
              ? t("Pause", "一時停止")
              : p.session.remaining ===
                  (p.session.mode === "focus"
                    ? p.session.minutes
                    : p.session.breakMinutes) *
                    60
                ? t("Begin", "始める")
                : p.session.done
                  ? t("Begin again", "もう一度始める")
                  : t("Resume", "再開")}
          </button>
          <button className="v-button" aria-keyshortcuts="R" onClick={p.session.reset}>
            <kbd aria-hidden="true">R</kbd>
            <ArrowCounterClockwise size={17} />
            {t("Reset", "リセット")}
          </button>
          {p.session.done && p.session.mode === "focus" && (
            <button className="v-button" aria-keyshortcuts="B" onClick={p.session.takeBreak}>
              <kbd aria-hidden="true">B</kbd>
              {t("Take a break", "休憩する")}
            </button>
          )}
        </div>
        {p.session.done && p.session.mode === "break" && (
          <button
            className="v-button"
            aria-keyshortcuts="B"
            onClick={() =>
              p.session.duration(p.session.minutes, p.session.breakMinutes)
            }
          >
            <kbd aria-hidden="true">B</kbd>
            {t("Back to focus", "集中に戻る")}
          </button>
        )}
        {!p.session.running && (
          <details className="v-session-options">
            <summary>{t("Session settings", "セッション設定")}</summary>
            <label>
              {t("Focus minutes", "集中時間（分）")}
              <input
                type="number"
                min="1"
                max="180"
                value={p.session.minutes}
                onChange={(e) =>
                  p.session.duration(Number(e.target.value) || 1)
                }
              />
            </label>
            <label>
              {t("Your intention", "今日のひとこと")}
              <input
                maxLength={100}
                value={p.session.intention}
                onChange={(e) => p.session.setIntention(e.target.value)}
                placeholder={t(
                  "What would you like to give time to?",
                  "何に時間を使いたいですか？",
                )}
              />
            </label>
          </details>
        )}
      </section>
    );
  if (p.place === "music")
    return (
      <section className="v-activity v-music">
        <div className={`v-music-waves ${musicPlaying ? "is-playing" : ""}`} aria-hidden="true">{[0,1,2,3,4,5,6].map(i=><i key={i} style={{animationDelay:`${i*-.19}s`}} />)}</div>
        <h2>{t("Stay a little longer.", "もう少し、ここで。")}</h2>
        <p>
          {t(
            "Soft music. A fire. Nowhere else to be.",
            "やさしい音楽と、あたたかな火。",
          )}
        </p>
        <button className="v-button v-primary" aria-keyshortcuts="Space" disabled={p.soundLoading} aria-busy={p.soundLoading} onClick={p.radioEnabled ? p.toggleMusic : p.toggleSound}>
          <kbd aria-hidden="true">␣</kbd>
          {musicPlaying ? <Pause size={18} /> : <Play size={18} weight="fill" />}
          {p.soundLoading ? t("Loading sound…", "音を準備中…") : musicPlaying
            ? t("Pause music", "音楽を止める")
            : t("Play music", "音楽を流す")}
        </button>
        {p.radioEnabled ? <button className="v-button" onClick={p.openRadio}>{t("Open your radio", "ラジオを開く")}</button> : <>
          <SoundtrackChoices mix={p.mix} setMix={p.setMix} language={p.language} />
          <details className="v-mix-details"><summary>{t("Balance the sounds", "音のバランス")}</summary><MixSliders mix={p.mix} setMix={p.setMix} language={p.language} /></details>
        </>}
      </section>
    );
  if (p.place === "garden") return <GardenActivity {...p.gardenControls} />;
  if (p.place === "breathe") return <Breathing language={p.language} onMoment={p.onMoment} gardenControls={p.gardenControls} />;
  if (p.place === "mood")
    return <TeaGarden language={p.language} gardenControls={p.gardenControls} />;
  if (p.place === "gratitude") return <Journal language={p.language} onMoment={p.onMoment} />;
  return <KindNote language={p.language} onMoment={p.onMoment} />;
}
export function SoundtrackChoices({ mix, setMix, language }: {
  mix: AudioMix; setMix: (mix: AudioMix) => void; language: "en" | "ja";
}) {
  const choices = [
    ["auto", "Follow the scenery", "景色に合わせる"],
    ["village", "Village paths", "村の小道"],
    ["water", "Pond & tea garden", "池とお茶の庭"],
    ["rest", "Quiet cottage", "静かなコテージ"],
    ["hearth", "By the hearth", "焚き火のそば"],
  ] as const;
  return <label className="v-soundtrack">
    <span>{language === "ja" ? "音楽" : "Soundtrack"}</span>
    <select value={mix.soundtrack ?? "auto"} onChange={event => setMix({ ...mix, soundtrack: event.target.value as AudioMix["soundtrack"] })}>
      {choices.map(([value,en,ja]) => <option key={value} value={value}>{language === "ja" ? ja : en}</option>)}
    </select>
    <small>{language === "ja" ? "Holizna 作曲の録音音楽。" : "Recorded music by Holizna."}</small>
  </label>;
}
export function MixSliders({
  mix,
  setMix,
  language,
  extended = false,
}: {
  mix: AudioMix;
  setMix: (m: AudioMix) => void;
  language: "en" | "ja";
  extended?: boolean;
}) {
  return (
    <div className="v-mix">
      {(extended ? ["master", "music", "fire", "river", "wind", "rain", "ambience", "effects"] as const
        : ["music", "ambience", "effects", "rain", "fire", "master"] as const).map((key, i) => (
        <label key={key}>
          <span>
            {language === "ja"
              ? (extended ? ["全体", "音楽", "暖炉", "川", "風", "雨", "環境音", "効果音"] : ["音楽", "環境音", "効果音", "雨", "暖炉", "全体"])[i]
              : (extended ? ["Master", "Music", "Fire", "River", "Wind", "Rain", "Nature", "Effects"] : ["Music", "World", "Spirit & details", "Rain", "Fire", "Volume"])[i]}
          </span>
          <input
            aria-label={key + " volume"}
            type="range"
            min="0"
            max="1"
            step=".01"
            value={mix[key] ?? (key === "effects" ? .6 : .5)}
            onChange={(e) => setMix({ ...mix, [key]: Number(e.target.value) })}
          />
          <output>{Math.round((mix[key] ?? (key === "effects" ? .6 : .5)) * 100)}%</output>
        </label>
      ))}
    </div>
  );
}
function Breathing({ language, onMoment, gardenControls }: { language: "en" | "ja"; onMoment: Props["onMoment"]; gardenControls: GardenControls }) {
  const ja = language === "ja";
  const [pattern, setPattern] = useState(0),
    [running, setRunning] = useState(false),
    [elapsed, setElapsed] = useState(0);
  const patterns = [
    { name: "Calm", ja: "ゆったり", times: [4, 4, 6, 0] },
    { name: "Box", ja: "ボックス", times: [4, 4, 4, 4] },
    { name: "Slow", ja: "ゆっくり", times: [4, 7, 8, 0] },
  ];
  const times = patterns[pattern].times;
  const total = times.reduce((a, b) => a + b, 0);
  let cycle = elapsed % total,
    phase = 0;
  while (cycle >= times[phase] && phase < 3) {
    cycle -= times[phase];
    phase++;
  }
  const label = (
    ja
      ? ["吸って", "止めて", "吐いて", "止めて"]
      : ["Breathe in", "Hold gently", "Breathe out", "Rest"]
  )[phase];
  useEffect(() => {
    if (!running) return;
    const start = Date.now() - elapsed * 1000;
    const id = setInterval(
      () => setElapsed((Date.now() - start) / 1000),
      100,
    );
    return () => clearInterval(id); // Capture elapsed only at start/resume.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, pattern]);
  const amount=phase===0?cycle/times[phase]:phase===1?1:phase===2?1-cycle/times[phase]:0;
  useEffect(()=>{onMoment({kind:"breathe",active:running,amount});},[running,amount,onMoment]);
  return (
    <section className="v-activity v-breathe">
      <h2>{ja ? "水辺で、ひと呼吸。" : "A breath by the water."}</h2>
      <PondFeeding {...gardenControls} />
      <div className={`v-breath-orbit ${running ? "is-running" : ""}`} style={{"--breath-scale":1+amount*.12} as React.CSSProperties}>
        <svg className="v-breath-ring" viewBox="0 0 160 160" aria-hidden="true">
          <circle cx="80" cy="80" r="70" />
          <circle cx="80" cy="80" r="70" pathLength="100" strokeDasharray={`${running?(1-cycle/times[phase])*100:100} 100`} />
        </svg>
        <span className="v-breath-label" aria-hidden={running}>{running?label:ja?"ゆっくりと":"At your own pace"}</span>
        <div className="v-breath-count" aria-hidden="true">{running?Math.ceil(times[phase]-cycle):"~"}</div>
      </div>
      <p role="status" className="sr-only">
        {running ? label : ""}
      </p>
      <div className="v-actions">
        <button
          className="v-button v-primary"
          aria-keyshortcuts="Space"
          onClick={() => setRunning((v) => !v)}
        >
          <kbd aria-hidden="true">␣</kbd>
          {running ? <Pause size={18} /> : <Play size={18} />}{" "}
          {running ? (ja ? "一時停止" : "Pause") : ja ? "始める" : "Begin"}
        </button>
        <button
          className="v-button"
          aria-keyshortcuts="R"
          onClick={() => {
            setRunning(false);
            setElapsed(0);
          }}
        >
          <kbd aria-hidden="true">R</kbd>
          {ja ? "リセット" : "Reset"}
        </button>
      </div>
      <div className="v-preset-row">
        {patterns.map((p, i) => (
          <button
            className="v-chip"
            key={p.name}
            aria-keyshortcuts={String(i + 1)}
            aria-pressed={pattern === i}
            onClick={() => {
              setRunning(false);
              setElapsed(0);
              setPattern(i);
            }}
          >
            <kbd aria-hidden="true">{i + 1}</kbd>
            {ja ? p.ja : p.name} · {p.times.filter(Boolean).join("–")}
          </button>
        ))}
      </div>
    </section>
  );
}
function TeaGarden({
  language,
  gardenControls,
}: {
  gardenControls: GardenControls;
  language: "en" | "ja";
}) {
  const ja = language === "ja";
  return (
    <section className="v-activity v-paper v-tea">
      <h2>{ja ? "今、どんな気持ちですか？" : "How are you arriving?"}</h2>
      <p>
        {ja
          ? "どんな気持ちでも、ここにいて大丈夫。"
          : "Take a sip of tea. There is room for all of it."}
      </p>
      <MintTea {...gardenControls} />
    </section>
  );
}
function Journal({ language, onMoment }: { language: "en" | "ja"; onMoment: Props["onMoment"] }) {
  const ja = language === "ja";
  const importInput = useRef<HTMLInputElement>(null);
  const historyButton = useRef<HTMLButtonElement>(null);
  const viewHeading = useRef<HTMLHeadingElement>(null);
  const noteList = useRef<HTMLDivElement>(null);
  const listScroll = useRef(0);
  const previousView = useRef<"write" | "list" | "note">("write");
  const [text, setText] = useState(""),
    [entries, setEntries] = useState<GratitudeEntry[]>([]),
    [status, setStatus] = useState(""),
    [readFailed, setReadFailed] = useState(false),
    [view, setView] = useState<"write" | "list" | "note">("write"),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [remove, setRemove] = useState<string | null>(null);
  const selectedEntry = entries.find((entry) => entry.id === selectedId);
  const showNote = view === "note" && selectedEntry !== undefined;
  const formatDate = (createdAt: string) => new Date(createdAt).toLocaleDateString(
    ja ? "ja-JP" : "en-GB",
    { day: "numeric", month: "long", year: "numeric" },
  );
  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([exportGratitudeText()], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "hearthwillow-notes.txt";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(ja ? "メモをテキストファイルに保存しました。" : "Notes saved as a text file.");
    } catch {
      setStatus(ja ? "メモをダウンロードできませんでした。" : "Could not download your notes.");
    }
  };
  useEffect(() => {
    try {
      setEntries(readGratitudeEntries());
      setReadFailed(false);
    } catch {
      setReadFailed(true);
      setStatus(ja
        ? "保存済みのメモを読み込めませんでした。データは変更していません。"
        : "Saved notes could not be read. Your stored data has not been changed.");
    }
  }, [ja]);
  useEffect(() => {
    if (previousView.current === view) return;
    previousView.current = view;
    if (view === "write") historyButton.current?.focus();
    else {
      if (view === "list" && noteList.current) noteList.current.scrollTop = listScroll.current;
      viewHeading.current?.focus();
    }
  }, [view]);
  return (
    <section className={`v-activity v-paper v-journal${view !== "write" ? " v-journal-library" : ""}`}>
      {view === "write" ? (
        <>
          <h2>{ja ? "今日、心に残ったこと。" : "Something worth keeping."}</h2>
          <p>{ja ? "小さなことでも、十分です。" : "A small thing is enough."}</p>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            try {
              setEntries(saveGratitudeEntry(text.trim()));
              setReadFailed(false);
              setText("");
              onMoment({kind:"save"});
              setStatus(ja ? "この端末に保存しました。" : "Kept safely on this device.");
            } catch {
              setStatus(ja
                ? "保存できませんでした。文章をコピーしてください。保存済みのメモは変更していません。"
                : "This browser could not save. Please copy your note. Stored notes were not changed.");
            }
          }}>
            <div className="v-journal-entry">
              <label htmlFor="v-note">
                {ja ? "今日、ありがとうと思ったことは？" : "What brought a little warmth to your day?"}
              </label>
              <textarea id="v-note" value={text} maxLength={10000} onKeyDown={event => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.altKey && !event.repeat && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  event.currentTarget.form?.querySelector<HTMLButtonElement>(".v-journal-save")?.click();
                }
              }} onChange={(e) => {
                setText(e.target.value);
                onMoment({kind:"write"});
                if (!readFailed) setStatus("");
              }} />
            </div>
            <div className="v-journal-actions">
              <button disabled={!text.trim()} className="v-button v-primary v-journal-save" aria-keyshortcuts="Control+Enter Meta+Enter" type="submit">
                <kbd aria-hidden="true">⌘/Ctrl ↵</kbd>
                {ja ? "残す" : "Keep this thought"}
              </button>
              <button ref={historyButton} className="v-journal-history" type="button" onClick={() => {
                if (!readFailed) setStatus("");
                setView("list");
              }}>
                <span>{ja ? "これまでのメモ" : "Past notes"}</span>
                <span className="v-journal-count">{entries.length}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </form>
        </>
      ) : (
        <>
          <button className="v-journal-back" type="button" onClick={() => {
            if (!readFailed) setStatus("");
            if (showNote) {
              setSelectedId(null);
              setRemove(null);
              setView("list");
            } else setView("write");
          }}>
            <ArrowLeft size={17} aria-hidden="true" />
            {showNote ? (ja ? "メモ一覧へ" : "All notes") : (ja ? "書く画面へ" : "Back to writing")}
          </button>
          <div className="v-journal-library-heading">
            <h2 ref={viewHeading} tabIndex={-1}>{showNote ? (ja ? "残したメモ" : "A kept thought.") : (ja ? "これまでのメモ" : "Past notes")}</h2>
            {!showNote && <span className="v-journal-count">{entries.length}</span>}
          </div>
          {showNote ? (
            <>
              <article className="v-journal-open-note">
                <p>{selectedEntry.text}</p>
                <time dateTime={selectedEntry.createdAt}>{formatDate(selectedEntry.createdAt)}</time>
              </article>
              <div className="v-journal-delete">
                {remove === selectedEntry.id ? (
                  <>
                    <span>{ja ? "このメモを削除しますか？" : "Delete this note?"}</span>
                    <button type="button" onClick={() => {
                      try {
                        setEntries(deleteGratitudeEntry(selectedEntry.id));
                        setRemove(null);
                        setSelectedId(null);
                        setView("list");
                        setStatus(ja ? "メモを削除しました。" : "Note deleted.");
                      } catch {
                        setStatus(ja
                          ? "メモを削除できませんでした。保存済みのメモは変更していません。"
                          : "Could not delete this note. Stored notes were not changed.");
                      }
                    }}>{ja ? "削除する" : "Delete"}</button>
                    <button type="button" onClick={() => setRemove(null)}>{ja ? "戻る" : "Keep"}</button>
                  </>
                ) : (
                  <button type="button" onClick={() => setRemove(selectedEntry.id)}>{ja ? "このメモを削除" : "Remove this note"}</button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="v-journal-list" ref={noteList} onScroll={(event) => {
                listScroll.current = event.currentTarget.scrollTop;
              }}>
                {entries.length === 0 && !readFailed ? (
                  <p>{ja ? "最初のメモをここに。" : "Your first thought can live here."}</p>
                ) : (
                  entries.map((entry) => (
                    <button className="v-journal-note-row" key={entry.id} type="button" onClick={() => {
                      if (!readFailed) setStatus("");
                      listScroll.current = noteList.current?.scrollTop ?? 0;
                      setSelectedId(entry.id);
                      setView("note");
                    }}>
                      <span className="v-journal-note-preview">{entry.text.trimStart().split(/\r\n|\r|\n/)[0]}</span>
                      <span className="v-journal-note-date">{formatDate(entry.createdAt)}</span>
                      <ArrowRight size={17} aria-hidden="true" />
                    </button>
                  ))
                )}
              </div>
              <div className="v-journal-backups">
                <button className="v-button" type="button" onClick={download}>{ja ? "メモをダウンロード" : "Download notes"}</button>
                <button className="v-button" type="button" onClick={() => importInput.current?.click()}>{ja ? "バックアップを復元" : "Restore backup"}</button>
                <input ref={importInput} className="sr-only" type="file" accept=".txt,text/plain" aria-label={ja ? "メモのバックアップファイル" : "Notes backup file"} onChange={async event => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  try {
                    const restored = importGratitudeText(await file.text());
                    setEntries(restored);
                    setReadFailed(false);
                    setStatus(ja ? "バックアップを復元しました。既存のメモも残っています。" : "Backup restored. Existing notes were kept.");
                  } catch {
                    setStatus(ja ? "バックアップを復元できませんでした。保存済みのメモは変更していません。" : "Could not restore this backup. Stored notes were not changed.");
                  }
                }} />
              </div>
            </>
          )}
        </>
      )}
      <p className="v-save-status" role="status">{status}</p>
    </section>
  );
}
function KindNote({ language, onMoment }: { language: "en" | "ja"; onMoment: Props["onMoment"] }) {
  const ja = language === "ja";
  const [index, setIndex] = useState(
      () => Math.floor(Date.now() / 86400000) % phrases.length,
    ),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      const value = localStorage.getItem("cosy-kept-note");
      const savedIndex = phrases.indexOf(value || "");
      if (savedIndex >= 0) {
        setIndex(savedIndex);
        setSaved(true);
      }
    } catch {}
  }, []);
  return (
    <section className="v-activity v-letter">
      <h2>{ja ? "あなたへ。" : "A little note for you."}</h2>
      <blockquote key={index}>“{(ja ? phrasesJa : phrases)[index]}”</blockquote>
      <div className="v-actions">
        <button
          className="v-button"
          aria-keyshortcuts="E"
          onClick={() => {
            setIndex((i) => (i + 1) % phrases.length);
            setSaved(false);
            onMoment({kind:"letter"});
          }}
        >
          <kbd aria-hidden="true">E</kbd>
          {ja ? "もうひとつ" : "Another note"}
          <ArrowRight size={17} />
        </button>
        <button
          className="v-button"
          aria-pressed={saved}
          aria-keyshortcuts="K"
          onClick={() => {
            try {
              localStorage.setItem("cosy-kept-note", phrases[index]);
              setSaved(true);
              onMoment({kind:"keep"});
            } catch {
              setSaved(false);
            }
          }}
        >
          <kbd aria-hidden="true">K</kbd>
          {saved ? <Check size={18} /> : <Heart size={18} />}{" "}
          {saved ? (ja ? "残しました" : "Kept") : ja ? "残す" : "Keep"}
        </button>
      </div>
    </section>
  );
}

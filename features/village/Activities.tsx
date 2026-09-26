"use client";
import { useEffect, useState } from "react";
import {
  Pause,
  Play,
  ArrowRight,
  ArrowCounterClockwise,
  Heart,
  Check,
  SpeakerHigh,
  SpeakerSlash,
} from "@phosphor-icons/react";
import type { AudioMix, PlaceId } from "./places";
import type { ActivityMoment } from "./environment";
import type { FocusSession } from "./useSession";

type Props = {
  place: PlaceId;
  session: FocusSession;
  mix: AudioMix;
  setMix: (m: AudioMix) => void;
  sound: boolean;
  soundLoading: boolean;
  toggleSound: () => void;
  travel: (id: PlaceId) => void;
  language: "en" | "ja";
  onMoment: (moment: ActivityMoment) => void;
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
  const { place, session, sound, onMoment } = p;
  const duration=(session.mode === "focus" ? session.minutes : session.breakMinutes)*60;
  useEffect(() => {
    if (place === "focus") onMoment({kind:"focus",running:session.running,progress:Math.max(0,Math.min(1,1-session.remaining/duration))});
    if (place === "music") onMoment({kind:"music",playing:sound});
  }, [place,session.running,session.remaining,duration,sound,onMoment]);
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
        <div className="v-actions">
          <button className="v-button v-primary" onClick={p.session.toggle}>
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
          <button className="v-button" onClick={p.session.reset}>
            <ArrowCounterClockwise size={17} />
            {t("Reset", "リセット")}
          </button>
          {p.session.done && p.session.mode === "focus" && (
            <button className="v-button" onClick={p.session.takeBreak}>
              {t("Take a break", "休憩する")}
            </button>
          )}
        </div>
        {p.session.done && p.session.mode === "break" && (
          <button
            className="v-button"
            onClick={() =>
              p.session.duration(p.session.minutes, p.session.breakMinutes)
            }
          >
            {t("Back to focus", "集中に戻る")}
          </button>
        )}
        {!p.session.running && (
          <details className="v-session-options">
            <summary>{t("Session settings", "セッション設定")}</summary>
            <div className="v-preset-row">
              {[
                [25, 5],
                [50, 10],
                [10, 2],
              ].map(([n, b]) => (
                <button
                  key={n}
                  className="v-chip"
                  aria-pressed={p.session.minutes === n}
                  onClick={() => p.session.duration(n, b)}
                >
                  {n} {t("min", "分")} · {b} {t("rest", "休憩")}
                </button>
              ))}
            </div>
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
        <div className={`v-music-waves ${p.sound ? "is-playing" : ""}`} aria-hidden="true">{[0,1,2,3,4,5,6].map(i=><i key={i} style={{animationDelay:`${i*-.19}s`}} />)}</div>
        <h2>{t("Stay a little longer.", "もう少し、ここで。")}</h2>
        <p>
          {t(
            "Soft music. A fire. Nowhere else to be.",
            "やさしい音楽と、あたたかな火。",
          )}
        </p>
        <button className="v-button v-primary" disabled={p.soundLoading} aria-busy={p.soundLoading} onClick={p.toggleSound}>
          {p.sound ? <Pause size={18} /> : <Play size={18} weight="fill" />}
          {p.soundLoading ? t("Loading sound…", "音を準備中…") : p.sound
            ? t("Pause music", "音楽を止める")
            : t("Play music", "音楽を流す")}
        </button>
        <SoundtrackChoices mix={p.mix} setMix={p.setMix} language={p.language} />
        <details className="v-mix-details"><summary>{t("Balance the sounds", "音のバランス")}</summary><MixSliders mix={p.mix} setMix={p.setMix} language={p.language} /></details>
      </section>
    );
  if (p.place === "breathe") return <Breathing language={p.language} onMoment={p.onMoment} />;
  if (p.place === "mood")
    return <Mood travel={p.travel} language={p.language} onMoment={p.onMoment} />;
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
}: {
  mix: AudioMix;
  setMix: (m: AudioMix) => void;
  language: "en" | "ja";
}) {
  return (
    <div className="v-mix">
      {(["music", "ambience", "effects", "rain", "fire", "master"] as const).map((key, i) => (
        <label key={key}>
          <span>
            {language === "ja"
              ? ["音楽", "環境音", "効果音", "雨", "暖炉", "全体"][i]
              : ["Music", "World", "Spirit & details", "Rain", "Fire", "Volume"][i]}
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
function Breathing({ language, onMoment }: { language: "en" | "ja"; onMoment: Props["onMoment"] }) {
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
          onClick={() => setRunning((v) => !v)}
        >
          {running ? <Pause size={18} /> : <Play size={18} />}{" "}
          {running ? (ja ? "一時停止" : "Pause") : ja ? "始める" : "Begin"}
        </button>
        <button
          className="v-button"
          onClick={() => {
            setRunning(false);
            setElapsed(0);
          }}
        >
          {ja ? "リセット" : "Reset"}
        </button>
      </div>
      <div className="v-preset-row">
        {patterns.map((p, i) => (
          <button
            className="v-chip"
            key={p.name}
            aria-pressed={pattern === i}
            onClick={() => {
              setRunning(false);
              setElapsed(0);
              setPattern(i);
            }}
          >
            {ja ? p.ja : p.name} · {p.times.filter(Boolean).join("–")}
          </button>
        ))}
      </div>
    </section>
  );
}
function Mood({
  travel,
  language,
  onMoment,
}: {
  onMoment: Props["onMoment"];
  travel: (id: PlaceId) => void;
  language: "en" | "ja";
}) {
  const [selected, setSelected] = useState<number | null>(null),
    ja = language === "ja";
  const moods = [
    ["A little tired", "少し疲れた", "breathe"],
    ["Restless", "落ち着かない", "breathe"],
    ["Overwhelmed", "いっぱいいっぱい", "music"],
    ["Lonely", "さみしい", "compliment"],
    ["Doing okay", "ふつう", "focus"],
    ["Peaceful", "穏やか", "gratitude"],
  ] as const;
  return (
    <section className="v-activity v-paper">
      <h2>{ja ? "今、どんな気持ちですか？" : "How are you arriving?"}</h2>
      <p>
        {ja
          ? "どんな気持ちでも、ここにいて大丈夫。"
          : "Take a sip of tea. There is room for all of it."}
      </p>
      <div className="v-moods">
        {moods.map((m, i) => (
          <button
            key={m[0]}
            className="v-chip"
            aria-pressed={selected === i}
            onClick={() => { setSelected(i); onMoment({kind:"tea"}); }}
          >
            {m[ja ? 1 : 0]}
          </button>
        ))}
      </div>
      {selected !== null && (
        <div className="v-suggestion" role="status">
          <p>
            {ja
              ? "少しゆっくりしてみませんか。"
              : ["Let the pond set a slower pace.","A few breaths by the water might help.","There is a warm seat by the fire.","A kind note is waiting at the postbox.","The cottage is ready when you are.","Keep a little of this feeling in your journal."][selected]}
          </p>
          <button
            className="v-button v-primary"
            onClick={() => travel(moods[selected][2])}
          >
            {ja ? "行ってみる" : "Take me there"}
            <ArrowRight size={17} />
          </button>
        </div>
      )}
    </section>
  );
}
type Entry = { id: string; text: string; createdAt: string };
function Journal({ language, onMoment }: { language: "en" | "ja"; onMoment: Props["onMoment"] }) {
  const ja = language === "ja";
  const [text, setText] = useState(""),
    [entries, setEntries] = useState<Entry[]>([]),
    [status, setStatus] = useState(""),
    [history, setHistory] = useState(false),
    [remove, setRemove] = useState<string | null>(null);
  useEffect(() => {
    try {
      const v = JSON.parse(
        localStorage.getItem("peaceful-room-gratitude-entries") || "[]",
      );
      if (Array.isArray(v))
        setEntries(
          v.filter(
            (e) =>
              typeof e?.text === "string" &&
              typeof e?.createdAt === "string" &&
              typeof e?.id === "string",
          ),
        );
    } catch {}
  }, []);
  function persist(next: Entry[]) {
    try {
      localStorage.setItem(
        "peaceful-room-gratitude-entries",
        JSON.stringify(next),
      );
      setEntries(next);
      return true;
    } catch {
      setStatus(
        ja
          ? "保存できませんでした。文章をコピーしてください。"
          : "This browser could not save. Please copy your note.",
      );
      return false;
    }
  }
  return (
    <section className="v-activity v-paper v-journal">
      <h2>{ja ? "今日、心に残ったこと。" : "Something worth keeping."}</h2>
      <p>{ja ? "小さなことでも、十分です。" : "A small thing is enough."}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          if (
            persist([
              {
                id: crypto.randomUUID(),
                text: text.trim(),
                createdAt: new Date().toISOString(),
              },
              ...entries,
            ])
          ) {
            setText("");
            onMoment({kind:"save"});
            setStatus(
              ja ? "この端末に保存しました。" : "Kept safely on this device.",
            );
          }
        }}
      >
        <label className="sr-only" htmlFor="v-note">
          {ja ? "感謝のメモ" : "Gratitude note"}
        </label>
        <textarea
          id="v-note"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onMoment({kind:"write"});
            setStatus("");
          }}
          maxLength={10000}
          placeholder={
            ja
              ? "今日、ありがとうと思ったこと…"
              : "What brought a little warmth to your day?"
          }
        />
        <div className="v-actions">
          <button
            disabled={!text.trim()}
            className="v-button v-primary"
            type="submit"
          >
            {ja ? "残す" : "Keep this thought"}
          </button>
          <button
            className="v-text-button"
            type="button"
            onClick={() => setHistory(!history)}
          >
            {ja ? "これまでのメモ" : "Past notes"}
            {entries.length > 0 ? ` (${entries.length})` : ""}
          </button>
        </div>
      </form>
      <p className="v-save-status" role="status">
        {status}
      </p>
      {history && (
        <div className="v-notes">
          {entries.length === 0 ? (
            <p>
              {ja
                ? "最初のメモをここに。"
                : "Your first thought can live here."}
            </p>
          ) : (
            entries.map((e) => (
              <article key={e.id}>
                <p>{e.text}</p>
                <footer>
                  <time>
                    {new Date(e.createdAt).toLocaleDateString(
                      ja ? "ja-JP" : "en-GB",
                      { day: "numeric", month: "short" },
                    )}
                  </time>
                  {remove === e.id ? (
                    <span>
                      <button
                        onClick={() => {
                          persist(entries.filter((n) => n.id !== e.id));
                          setRemove(null);
                        }}
                      >
                        {ja ? "削除する" : "Delete"}
                      </button>
                      <button onClick={() => setRemove(null)}>
                        {ja ? "戻る" : "Keep"}
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => setRemove(e.id)}>
                      {ja ? "削除" : "Remove"}
                    </button>
                  )}
                </footer>
              </article>
            ))
          )}
        </div>
      )}
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
          onClick={() => {
            setIndex((i) => (i + 1) % phrases.length);
            setSaved(false);
            onMoment({kind:"letter"});
          }}
        >
          {ja ? "もうひとつ" : "Another note"}
          <ArrowRight size={17} />
        </button>
        <button
          className="v-button"
          aria-pressed={saved}
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
          {saved ? <Check size={18} /> : <Heart size={18} />}{" "}
          {saved ? (ja ? "残しました" : "Kept") : ja ? "残す" : "Keep"}
        </button>
      </div>
    </section>
  );
}

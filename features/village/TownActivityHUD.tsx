import { RECIPES } from "./picnic";
import type { TownActivityHUDState } from "./townProgress";
import type { ForageInventory } from "./townShared";
import { readInventory } from "./townShared";

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function TownActivityHUD({ state, language }: { state: TownActivityHUDState | null; language: "en" | "ja" }) {
  if (!state || state.kind === "farm") return null;
  const t = (en: string, ja: string) => language === "ja" ? ja : en;
  const title = state.phase === "countdown" ? t("Ready for your lap?", "準備はいい？") : state.phase === "cancelled" ? t("Race ended", "レース終了")
    : state.phase === "finished" ? state.result === "visitor" ? t("You won!", "あなたの勝ち！") : state.result === "tie" ? t("A tie!", "引き分け！") : t("Lap complete!", "ゴール！") : t("Race Rowan", "ローワンと競走");
  return <section className="v-town-progress v-race-progress" aria-label={t("Race progress", "レースの進み具合")}>
    <strong>{title}</strong>
    {state.phase === "cancelled" ? null : state.phase === "countdown" ? <span className="v-race-countdown" role="timer" aria-live="polite">{state.countdown || t("Go!", "スタート！")}</span>
      : <>
        <span className="v-race-clock" role="timer">{state.phase === "racing" ? clock(state.remaining) : t(`${state.elapsed.toFixed(1)}s`, `${state.elapsed.toFixed(1)}秒`)}</span>
        <div className="v-race-statistics"><span>{t(`${state.checkpoints} / 8 flags`, `旗 ${state.checkpoints} / 8`)}</span><span>{t(`Lap ${state.elapsed.toFixed(1)}s`, `タイム ${state.elapsed.toFixed(1)}秒`)}</span></div>
        <div className="v-race-positions" aria-label={t("Lap positions", "コース上の位置")}>
          <label>{t("You", "あなた")}<progress max={8} value={state.checkpoints} /></label>
          <label>{t("Rowan", "ローワン")}<progress max={1} value={state.rivalProgress} /></label>
        </div>
        {state.phase === "racing" && <p>{state.nextGateDistance === undefined ? t("Next gate", "次の旗へ") : t(`Next gate ${state.nextGateDistance}m`, `次の旗まで${state.nextGateDistance}m`)}</p>}
      </>}
  </section>;
}

export function VillageInventory({ inventory, language }: { inventory: ForageInventory; language: "en" | "ja" }) {
  const t = (en: string, ja: string) => language === "ja" ? ja : en;
  const items = readInventory(inventory);
  return <div className="v-harvest-inventory v-local-inventory">
    <dl>{([
      ["apples", t("Apples", "リンゴ")], ["mushrooms", t("Mushrooms", "キノコ")], ["carrots", t("Carrots", "ニンジン")], ["radishes", t("Radishes", "ラディッシュ")], ["mint", t("Mint leaves", "ミントの葉")],
      ["daisies", t("Daisies", "デイジー")], ["sunflowers", t("Sunflowers", "ヒマワリ")], ["mintTea", t("Mint tea", "ミントティー")],
      ...RECIPES.map(recipe => [recipe.id, language === "ja" ? recipe.japanese : recipe.name] as const),
    ] as const).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{items[key]}</dd></div>)}</dl>
  </div>;
}

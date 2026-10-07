import { villageNotice } from "./localization";
import { useEffect, useState } from "react";
import { Keycap, ShortcutButton } from "./KeybindingControls";
import { RECIPES, canCook, recipeById, type PicnicAction, type PicnicContext, type SharedPicnic } from "./picnic";
import { readInventory, type ForageInventory } from "./townShared";

type CookingProps = {
  context: PicnicContext | null; state?: SharedPicnic; selfId: string; language: "en" | "ja";
  readClock: () => number; connected: boolean; act: (request: PicnicAction) => Promise<boolean>;
};

function useCookingClock(readClock: () => number) {
  const [now, setNow] = useState(readClock);
  useEffect(() => { const timer = window.setInterval(() => setNow(readClock()), 100); return () => window.clearInterval(timer); }, [readClock]);
  return now;
}

export function CookingHUD({ context, state, selfId, language, connected, act, readClock }: CookingProps) {
  const now = useCookingClock(readClock);
  const [pending, setPending] = useState(false);
  const own = state?.cooking.find(job => job.owner === selfId);
  const job = own ?? state?.cooking.find(job => context?.kind === "kitchen" && job.kitchen === context.id && job.readyAt > now);
  if (!job) return null;
  const t = (en: string, ja: string) => language === "ja" ? ja : en;
  const recipe = recipeById(job.recipe);
  const ready = job.readyAt <= now;
  const progress = Math.min(1, Math.max(0, (now - job.startedAt) / (job.readyAt - job.startedAt)));
  const stage = progress < .32 ? t("Preparing", "下ごしらえ") : progress < .72 ? t("Cooking", "調理中") : t("Finishing", "仕上げ中");
  return <section className={`v-cooking-hud${ready ? " is-ready" : ""}`} aria-label={t("Cooking status", "調理の状態")}>
    <div className={`v-cooking-pot${ready ? "" : " is-stirring"}`} aria-hidden="true"><i /><i /><i /><b /></div>
    <div className="v-cooking-hud-info">
      <strong>{ready ? t("Ready to pack", "受け取り可能") : own ? stage : t("Stove in use", "調理台を使用中")}</strong>
      <span>{language === "ja" ? recipe?.japanese : recipe?.name}</span>
      {!ready && <div className="v-cooking-time"><progress aria-label={t("Cooking progress", "調理の進み具合")} max={1} value={progress} /><span>{Math.max(1, Math.ceil((job.readyAt - now) / 1000))}{t("s", "秒")}</span></div>}
      {ready && context?.kind === "kitchen" && context.id === job.kitchen && own ? <ShortcutButton aria-keyshortcuts="E" disabled={pending || !connected} onClick={async () => {
        if (pending) return; setPending(true);
        try { await act({ kind: "picnic", action: "pack", id: job.kitchen }); } finally { setPending(false); }
      }}><Keycap>E</Keycap>{pending ? t("Packing…", "受け取り中…") : t("Pack into basket", "かごに入れる")}</ShortcutButton> : ready && <span>{t("Return to the kitchen to pack.", "キッチンに戻って受け取ってください。")}</span>}
    </div>
  </section>;
}

export function PicnicControls({ context, state, selfId, inventory, language, connected, act, sit, notice, readClock }: CookingProps & {
  inventory: ForageInventory; sit: (id: string) => void; notice: string;
}) {
  const now = useCookingClock(readClock);
  const [pending, setPending] = useState<PicnicAction | null>(null);
  const t = (en: string, ja: string) => language === "ja" ? ja : en;
  const items = readInventory(inventory);
  const own = state?.cooking.find(job => job.owner === selfId);
  const cooking = state?.cooking.find(job => job.kitchen === context?.id && job.readyAt > now);
  const run = async (request: PicnicAction) => { if (pending) return; setPending(request); try { await act(request); } finally { setPending(null); } };
  const ingredientNames: Record<string, string> = { carrots: t("Carrot", "ニンジン"), radishes: t("Radish", "ラディッシュ"), mint: t("Mint", "ミント"), apples: t("Apple", "リンゴ"), mushrooms: t("Mushroom", "キノコ") };
  if (!context) return <p>{t("Come closer to the kitchen or a picnic mat.", "キッチンかピクニックマットに近づいてください。")}</p>;
  const served = state?.dishes.filter(dish => dish.mat === context.id) ?? [];
  return <div className="v-picnic-menu">
    <p>{context.kind === "kitchen" ? t("Choose a recipe. Each dish serves 3.", "料理を選んでください。各料理は3人分です。") : t("Place a dish to share. Click food on the mat to eat. Five cushions are available.", "料理を置いて共有できます。マットの料理をクリックすると食べられます。クッションは5席です。")}</p>
    {!connected && <p role="status">{t("Waiting for the village to reconnect…", "村への再接続を待っています…")}</p>}
    {context.kind === "kitchen" && own && <div className="v-cooking-status" role="status">
      <strong>{own.readyAt > now ? t("Cooking in progress", "調理中") : t("Ready to pack", "受け取り可能")}</strong>
      <span>{language === "ja" ? recipeById(own.recipe)?.japanese : recipeById(own.recipe)?.name}</span>
      {own.readyAt <= now && own.kitchen === context.id && <button disabled={!!pending || !connected} onClick={() => run({ kind: "picnic", action: "pack", id: context.id })}>{t("Pack into basket", "かごに入れる")}</button>}
      {own.kitchen !== context.id && <span>{t("Return to the kitchen where you cooked it.", "料理を作ったキッチンに戻ってください。")}</span>}
    </div>}
    {context.kind === "kitchen" && !own && cooking && <p role="status">{t("Stove in use. Wait for cooking to finish.", "調理中です。終了までお待ちください。")}</p>}
    <div className="v-picnic-recipes">{RECIPES.map(recipe => <article key={recipe.id}>
      <div className="v-recipe-heading"><span className="v-recipe-icon" aria-hidden="true">{recipe.icon}</span><h3>{language === "ja" ? recipe.japanese : recipe.name}</h3></div>
      {context.kind === "kitchen" ? <><ul className="v-recipe-ingredients">{Object.entries(recipe.ingredients).map(([key, count]) => <li key={key} className={items[key as keyof typeof items] < count ? "is-missing" : ""}><span>{ingredientNames[key]}</span><span>{items[key as keyof typeof items]}/{count}</span></li>)}</ul>
        <button disabled={!connected || !!pending || !!own || !!cooking || !canCook(items, recipe.id)} onClick={() => run({ kind: "picnic", action: "cook", id: context.id, recipe: recipe.id })}>{pending?.action === "cook" && pending.recipe === recipe.id ? t("Starting…", "調理開始中…") : canCook(items, recipe.id) ? t("Cook", "作る") : t("Need ingredients", "食材が不足")}</button></>
      : <><span className="v-recipe-count">{t(`${items[recipe.id]} in basket`, `かごに${items[recipe.id]}個`)}</span><button disabled={!connected || !!pending || items[recipe.id] < 1 || served.length >= 4} onClick={() => run({ kind: "picnic", action: "place", id: context.id, recipe: recipe.id })}>{pending?.action === "place" && pending.recipe === recipe.id ? t("Placing…", "配置中…") : t("Place on mat", "マットに置く")}</button></>}
    </article>)}</div>
    {context.kind === "picnic" && <>{served.length > 0 && <div className="v-picnic-served">{served.map(dish => <button key={dish.id} disabled={!!pending || !connected} onClick={() => run({ kind: "picnic", action: "eat", id: context.id, dishId: dish.id })}>
      {recipeById(dish.recipe)?.icon} {t("Eat", "食べる")} {language === "ja" ? recipeById(dish.recipe)?.japanese : recipeById(dish.recipe)?.name} · {t(`${dish.portions} left`, `残り${dish.portions}人分`)}
    </button>)}</div>}<button disabled={!connected || !!pending} onClick={() => sit(context.id)}>{t("Sit on a picnic cushion", "クッションに座る")}</button></>}
    {notice && <p role="status">{villageNotice(notice, language)}</p>}
  </div>;
}

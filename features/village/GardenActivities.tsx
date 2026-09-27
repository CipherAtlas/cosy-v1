"use client";
import { useEffect, useState } from "react";
import { Drop, Leaf, Flower, Coffee } from "@phosphor-icons/react";
import { CROP_NAMES, GROWTH_MS, MINT_BED, growthProgress, growthTimeLeft, type GardenAction, type GardenState } from "./garden";
import type { PlaceId } from "./places";

export type GardenControls = {
  garden: GardenState;
  onGardenAction: (action: GardenAction) => void;
  language: "en" | "ja";
  travel: (id: PlaceId) => void;
  meetMaple: () => void;
};

export function GardenActivity(p: GardenControls) {
  const [tab, setTab] = useState<"vegetables" | "flowers">("vegetables");
  const [now, setNow] = useState(Date.now);
  const growing = p.garden.beds.some(bed => bed.stage === "growing");
  useEffect(() => {
    if (!growing) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [growing]);
  const ja = p.language === "ja", t = (en: string, jp: string) => ja ? jp : en;
  const bedCard = (i: number) => {
    const bed = p.garden.beds[i], mint = i === MINT_BED;
    const cropName = CROP_NAMES[bed.crop][p.language], minutes = GROWTH_MS[bed.crop] / 60_000;
    return <div className="v-garden-bed" key={i}>
      <div className="v-garden-bed-heading"><div><strong>{mint ? t("Mint · Tea leaves", "ミント・お茶の葉") : bed.stage === "empty" ? t("A patch of soil", "ふかふかの土") : cropName}</strong>
        <span>{bed.stage === "empty" ? t("Seeds are on the house", "種はいつでもどうぞ")
          : bed.stage === "sprout" ? t(`A little water, then about ${minutes} minutes`, `水をあげたら、約${minutes}分で育ちます`)
          : bed.stage === "growing" ? t("Growing quietly. Go enjoy the village.", "のんびり成長中。村でゆっくりしてね。")
          : t("Ready whenever you are", "好きなときに収穫してね")}</span></div>
        {bed.stage === "growing" && <div className="v-growth-clock" role="img" aria-label={t(`${cropName}: ${growthTimeLeft(bed, now)} until ready`, `${cropName}：収穫まで ${growthTimeLeft(bed, now)}`)}>
          <svg viewBox="0 0 56 56" aria-hidden="true"><circle className="v-growth-track" cx="28" cy="28" r="24" />
            <circle className="v-growth-progress" cx="28" cy="28" r="24" pathLength="1" strokeDasharray={`${growthProgress(bed, now)} 1`} transform="rotate(-90 28 28)" /></svg>
          <span aria-hidden="true">{growthTimeLeft(bed, now)}</span>
        </div>}
      </div>
      <div className="v-garden-bed-actions">
        {bed.stage === "empty" ? (mint ? ["mint"] as const : ["carrot", "radish"] as const).map(crop => <button key={crop} className="v-button"
          aria-label={t(`Plant ${crop} in ${mint ? "the mint patch" : `bed ${i + 1}`}`, `${mint ? "ミントの花壇" : `花壇${i + 1}`}に${CROP_NAMES[crop].ja}を植える`)}
          onClick={() => p.onGardenAction({ kind: "plant", bed: i, crop })}>{CROP_NAMES[crop][p.language]}</button>)
          : bed.stage !== "growing" && <button className="v-button"
            aria-label={t(`${bed.stage === "sprout" ? "Water" : "Harvest"} ${mint ? "mint" : `bed ${i + 1}`}`, `${mint ? "ミント" : `花壇${i + 1}`}${bed.stage === "sprout" ? "に水をあげる" : "を収穫する"}`)}
            onClick={() => p.onGardenAction({ kind: bed.stage === "sprout" ? "water" : "harvest", bed: i })}>
            {bed.stage === "sprout" ? <Drop size={17} /> : <Leaf size={17} />}{bed.stage === "sprout" ? t("Water", "水をあげる") : t("Pick", "摘む")}
          </button>}
      </div>
    </div>;
  };
  const harvest = p.garden.carrots + p.garden.radishes + p.garden.mint;
  return <section className="v-activity v-garden" aria-label={t("Kitchen garden", "小さな菜園")}>
    <h2>{t("A little patch of green.", "小さな緑のひととき。")}</h2>
    <p>{t("Water once, then let things grow. Radishes take 2 minutes, mint 3 and carrots 5. Nothing wilts, even while you're away.", "一度お水をあげたら、のんびり。ラディッシュは2分、ミントは3分、ニンジンは5分。留守でも枯れません。")}</p>
    <div className="v-garden-tabs" role="group" aria-label={t("Garden beds", "庭の種類")}>
      <button className="v-chip" aria-pressed={tab === "vegetables"} onClick={() => setTab("vegetables")}>{t("Vegetables", "野菜")}</button>
      <button className="v-chip" aria-pressed={tab === "flowers"} onClick={() => setTab("flowers")}>{t("Flowers & mint", "お花とミント")}</button>
    </div>
    {tab === "vegetables" ? <div className="v-garden-beds">{[0, 1, 2, 3].map(bedCard)}</div>
      : <div className="v-garden-flowers">
        {bedCard(MINT_BED)}
        <p>{t("A little shower for the sunflowers, daisies and irises.", "ひまわり、デイジー、アイリスに小さなシャワー。")}</p>
        <button className="v-button" onClick={() => p.onGardenAction({ kind: "flowers" })}><Flower size={20} />{t("Water the flowers", "お花に水をあげる")}</button>
      </div>}
    {harvest > 0 && <div className="v-garden-ritual">
      <p className="v-basket">{t(`In your basket · ${p.garden.carrots} carrots, ${p.garden.radishes} radishes, ${p.garden.mint} mint`, `かごの中 · ニンジン ${p.garden.carrots}本、ラディッシュ ${p.garden.radishes}個、ミント ${p.garden.mint}枝`)}</p>
      <button className="v-button v-primary" onClick={() => p.travel("mood")}><Coffee size={18} />{t("Bring your harvest to Luma", "収穫をルマに届ける")}</button>
    </div>}
  </section>;
}

export function PondFeeding(p: GardenControls) {
  const ja = p.language === "ja";
  return <div className="v-garden-ritual">
    <button className="v-button" onClick={() => p.garden.crumbPouch ? p.onGardenAction({ kind: "feed" }) : p.meetMaple()}>
      {p.garden.crumbPouch ? (ja ? "アヒルたちにパンくずをあげる" : "Feed the little duckies") : (ja ? "メープルにパンくずをもらう" : "Ask Maple for bread crumbs")}
    </button>
    <p>{p.garden.crumbPouch ? (ja ? "メープルの小さな袋。いつでももう少し。" : "Maple’s little pouch always has a few more.") : (ja ? "パン屋のメープルに会ってみよう。" : "Maple, our baker, has a little pouch to share.")}</p>
  </div>;
}

export function MintTea(p: GardenControls) {
  const ja = p.language === "ja", t = (en: string, jp: string) => ja ? jp : en;
  return <div className="v-garden-ritual">
    <p>{t("Luma is here to share a cup and admire your garden.", "ルマとお茶を飲みながら、庭を眺めましょう。")}</p>
    <div className="v-garden-bed-actions">
      {p.garden.carrots > 0 && <button className="v-button" onClick={() => p.onGardenAction({ kind: "gift", crop: "carrot" })}>{t("Give Luma a carrot", "ルマにニンジンを渡す")}</button>}
      {p.garden.radishes > 0 && <button className="v-button" onClick={() => p.onGardenAction({ kind: "gift", crop: "radish" })}>{t("Give Luma a radish", "ルマにラディッシュを渡す")}</button>}
      {p.garden.mint > 0 && <button className="v-button" onClick={() => p.onGardenAction({ kind: "gift", crop: "mint" })}><Leaf size={18} />{t("Give Luma mint for special tea", "ルマにミントを渡して特別なお茶に")}</button>}
    </div>
    {p.garden.mintTea > 0 && <><button className="v-button v-primary" onClick={() => p.onGardenAction({ kind: "drink" })}><Coffee size={18} />{t("Drink your special mint tea", "特別なミントティーを飲む")}</button>
      <p>{t(`${p.garden.mintTea} cup${p.garden.mintTea === 1 ? "" : "s"} waiting for you.`, `${p.garden.mintTea}杯のお茶が待っています。`)}</p></>}
    {p.garden.carrots + p.garden.radishes + p.garden.mint === 0 && <button className="v-text-button" onClick={() => p.travel("garden")}>{t("Visit the kitchen garden", "菜園に行く")}</button>}
  </div>;
}

"use client";
import { useEffect, useState } from "react";
import { Drop, Leaf, Flower, Coffee, Basket } from "@phosphor-icons/react";
import { CROP_NAMES, CROP_INVENTORY, GROWTH_MS, MINT_BED, DAISY_BED, SUNFLOWER_BED, cropsForBed, growthProgress, growthTimeLeft, type GardenAction, type GardenState } from "./garden";
import type { BirdStatus } from "./birds";
import type { PlaceId } from "./places";

export type GardenControls = {
  garden: GardenState;
  birdStatus: BirdStatus;
  onGardenAction: (action: GardenAction) => void;
  language: "en" | "ja";
  travel: (id: PlaceId) => void;
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
    const bed = p.garden.beds[i], mint = i === MINT_BED, daisy = i === DAISY_BED, sunflower = i === SUNFLOWER_BED;
    const cropName = CROP_NAMES[bed.crop][p.language], minutes = GROWTH_MS[bed.crop] / 60_000;
    return <div className="v-garden-bed" key={i}>
      <div className="v-garden-bed-heading"><div><strong>{mint ? t("Mint · Tea leaves", "ミント・お茶の葉") : bed.stage === "empty" && !daisy && !sunflower ? t("A patch of soil", "ふかふかの土") : cropName}</strong>
        <span>{bed.stage === "empty" ? t("Seeds are on the house", "種はいつでもどうぞ")
          : bed.stage === "sprout" ? t(`A little water, then about ${minutes} minutes`, `水をあげたら、約${minutes}分で育ちます`)
          : bed.stage === "growing" ? t("Growing quietly. Go enjoy the village.", "のんびり成長中。村でゆっくりしてね。")
          : t("Ready whenever you are", "好きなときに収穫してね")}</span></div>
        {bed.stage === "growing" && growthProgress(bed, now) < 1 && <div className="v-growth-clock" role="img" aria-label={t(`${cropName}: ${growthTimeLeft(bed, now)} until ready`, `${cropName}：収穫まで ${growthTimeLeft(bed, now)}`)}>
          <svg viewBox="0 0 56 56" aria-hidden="true"><circle className="v-growth-track" cx="28" cy="28" r="24" />
            <circle className="v-growth-progress" cx="28" cy="28" r="24" pathLength="1" strokeDasharray={`${growthProgress(bed, now)} 1`} transform="rotate(-90 28 28)" /></svg>
          <span aria-hidden="true">{growthTimeLeft(bed, now)}</span>
        </div>}
      </div>
      <div className="v-garden-bed-actions">
        {bed.stage === "empty" ? cropsForBed(i).map(crop => <button key={crop} className="v-button"
          aria-label={t(`Plant ${crop} in ${mint ? "the mint patch" : daisy ? "the daisy bed" : sunflower ? "the sunflower row" : `bed ${i + 1}`}`, `${mint ? "ミントの花壇" : daisy ? "デイジーの花壇" : sunflower ? "ひまわりの花壇" : `花壇${i + 1}`}に${CROP_NAMES[crop].ja}を植える`)}
          onClick={() => p.onGardenAction({ kind: "plant", bed: i, crop })}>{CROP_NAMES[crop][p.language]}</button>)
          : bed.stage !== "growing" && <button className="v-button"
            aria-label={t(`${bed.stage === "sprout" ? "Water" : "Harvest"} ${mint ? "mint" : daisy ? "daisies" : sunflower ? "sunflowers" : `bed ${i + 1}`}`, `${mint ? "ミント" : daisy ? "デイジー" : sunflower ? "ひまわり" : `花壇${i + 1}`}${bed.stage === "sprout" ? "に水をあげる" : "を収穫する"}`)}
            onClick={() => p.onGardenAction({ kind: bed.stage === "sprout" ? "water" : "harvest", bed: i })}>
            {bed.stage === "sprout" ? <Drop size={17} /> : <Leaf size={17} />}{bed.stage === "sprout" ? t("Water", "水をあげる") : t("Pick", "摘む")}
          </button>}
      </div>
    </div>;
  };
  const harvest = p.garden.carrots + p.garden.radishes + p.garden.mint + p.garden.daisies + p.garden.sunflowers;
  return <section className="v-activity v-garden" aria-label={t("Kitchen garden", "小さな菜園")}>
    <h2>{t("A little patch of green.", "小さな緑のひととき。")}</h2>
    <p>{t("Water once, then let things grow. Radishes take 2 minutes, mint and daisies 3, and carrots and sunflowers 5. Nothing wilts, even while you're away.", "一度お水をあげたら、のんびり。ラディッシュは2分、ミントとデイジーは3分、ニンジンとひまわりは5分。留守でも枯れません。")}</p>
    <div className="v-garden-tabs" role="group" aria-label={t("Garden beds", "庭の種類")}>
      <button className="v-chip" aria-pressed={tab === "vegetables"} onClick={() => setTab("vegetables")}>{t("Vegetables", "野菜")}</button>
      <button className="v-chip" aria-pressed={tab === "flowers"} onClick={() => setTab("flowers")}>{t("Flowers & mint", "お花とミント")}</button>
    </div>
    {tab === "vegetables" ? <div className="v-garden-beds">{[0, 1, 2, 3].map(bedCard)}</div>
      : <div className="v-garden-flowers">
        {bedCard(MINT_BED)}
        {bedCard(DAISY_BED)}
        {bedCard(SUNFLOWER_BED)}
        <p>{t("A little shower for the irises.", "アイリスに小さなシャワー。")}</p>
        <button className="v-button" onClick={() => p.onGardenAction({ kind: "flowers" })}><Flower size={20} />{t("Water the irises", "アイリスに水をあげる")}</button>
      </div>}
    <div className="v-garden-ritual">
      <button className="v-button" aria-label={t("View harvest basket", "収穫かごを見る")} onClick={() => p.onGardenAction({ kind: "basket" })}><Basket size={18} />{t("Harvest basket", "収穫かご")} · {harvest}</button>
      {harvest > 0 && <button className="v-text-button" onClick={() => p.travel("mood")}><Coffee size={18} />{t("Bring your harvest to Luma", "収穫をルマに届ける")}</button>}
    </div>
  </section>;
}

export function HarvestInventory({ garden, language }: Pick<GardenControls, "garden" | "language">) {
  const total = garden.carrots + garden.radishes + garden.mint + garden.daisies + garden.sunflowers;
  return <div className="v-harvest-inventory">
    <p>{language === "ja" ? (total ? "収穫したものは、自動でここに入ります。" : "かごはまだ空っぽ。収穫したものは、自動でここに入ります。")
      : total ? "Everything you pick is stored here automatically." : "Your basket is empty. Everything you pick will be stored here."}</p>
    <dl>{(["carrot", "radish", "mint", "daisy", "sunflower"] as const).map(crop => <div key={crop}>
      <dt>{CROP_NAMES[crop][language]}</dt><dd>{garden[CROP_INVENTORY[crop]]}</dd>
    </div>)}</dl>
  </div>;
}

export function BirdActivity(p: GardenControls) {
  const ja = p.language === "ja", t = (en: string, jp: string) => ja ? jp : en;
  const busy = p.birdStatus === "crumbs" || p.birdStatus === "eating" || p.birdStatus === "happy";
  const status = {
    flying: t("The flock is making a little round of the village. They'll land after about 30 seconds in the sky.", "鳥たちは村をひと回り。約30秒飛んだら降りてきます。"),
    crumbs: t("Your crumbs are waiting. Here they come, after one little lap.", "パンくずを撒きました。ひと回りしたら降りてきます。"),
    waiting: t("Twelve little beaks, ready for a picnic.", "十二の小さなくちばし。ピクニックの準備ができました。"),
    eating: t("A little peck, a happy flutter…", "ついばんで、うれしく羽ばたいて…"),
    happy: t("Coo coo~ (Thank you~)", "クークー〜（ありがとう〜）"),
  };
  return <section className="v-activity v-bird-activity" aria-label={t("Feed the birds", "小鳥にパンくずをあげる")}>
    <h2>{t("A picnic for little wings.", "小さな翼のピクニック。")}</h2>
    <p role="status">{status[p.birdStatus]}</p>
    <div className="v-garden-bed-actions">
      <button className="v-button v-primary" disabled={busy || !p.garden.crumbPouch} onClick={() => p.onGardenAction({ kind: "feedBirds" })}>{t("Scatter sourdough crumbs", "サワードウのパンくずを撒く")}</button>
    </div>
    <p>{p.garden.crumbPouch ? t("You have crumbs. The birds will be delighted.", "パンくずを持っています。鳥たちもきっと喜びます。") : t("Find Maple or Wren in the village and ask for crumbs first.", "まず村のメープルかレンに会って、パンくずをもらいましょう。")}</p>
  </section>;
}

export function PondFeeding(p: GardenControls) {
  const ja = p.language === "ja";
  return <div className="v-garden-ritual">
    {p.garden.crumbPouch && <button className="v-button" onClick={() => p.onGardenAction({ kind: "feed" })}>{ja ? "アヒルたちにパンくずをあげる" : "Feed the little duckies"}</button>}
    <p>{p.garden.crumbPouch ? (ja ? "パンくずの袋を持っています。" : "You have a pouch of crumbs.") : (ja ? "村のメープルかレンに会って、パンくずをもらいましょう。" : "Find Maple or Wren in the village and ask for crumbs first.")}</p>
  </div>;
}

export function MintTea(p: GardenControls) {
  const ja = p.language === "ja", t = (en: string, jp: string) => ja ? jp : en;
  return <div className="v-garden-ritual">
    <p>{t("Luma is here to share a cup and admire your garden.", "ルマとお茶を飲みながら、庭を眺めましょう。")}</p>
    <div className="v-garden-bed-actions">
      {p.garden.carrots > 0 && <button className="v-button" onClick={() => p.onGardenAction({ kind: "gift", crop: "carrot" })}>{t("Give Luma a carrot", "ルマにニンジンを渡す")}</button>}
      {p.garden.radishes > 0 && <button className="v-button" onClick={() => p.onGardenAction({ kind: "gift", crop: "radish" })}>{t("Give Luma a radish", "ルマにラディッシュを渡す")}</button>}
      {p.garden.sunflowers > 0 && <button className="v-button" onClick={() => p.onGardenAction({ kind: "gift", crop: "sunflower" })}><Flower size={18} />{t("Give Luma a sunflower", "ルマにひまわりを渡す")}</button>}
      {p.garden.daisies > 0 && <button className="v-button" onClick={() => p.onGardenAction({ kind: "gift", crop: "daisy" })}><Flower size={18} />{t("Give Luma a daisy", "ルマにデイジーを渡す")}</button>}
      {p.garden.mint > 0 && <button className="v-button" onClick={() => p.onGardenAction({ kind: "gift", crop: "mint" })}><Leaf size={18} />{t("Give Luma mint for special tea", "ルマにミントを渡して特別なお茶に")}</button>}
    </div>
    {p.garden.mintTea > 0 && <><button className="v-button v-primary" onClick={() => p.onGardenAction({ kind: "drink" })}><Coffee size={18} />{t("Drink your special mint tea", "特別なミントティーを飲む")}</button>
      <p>{t(`${p.garden.mintTea} cup${p.garden.mintTea === 1 ? "" : "s"} waiting for you.`, `${p.garden.mintTea}杯のお茶が待っています。`)}</p></>}
    {p.garden.carrots + p.garden.radishes + p.garden.mint + p.garden.daisies + p.garden.sunflowers === 0 && <button className="v-text-button" onClick={() => p.travel("garden")}>{t("Visit the kitchen garden", "菜園に行く")}</button>}
  </div>;
}

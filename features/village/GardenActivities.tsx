"use client";
import { Keycap, ShortcutButton } from "./KeybindingControls";
import { useEffect, useState } from "react";
import { Drop, Leaf, Flower, Coffee, Basket } from "@phosphor-icons/react";
import { CROP_NAMES, CROP_INVENTORY, MINT_BED, DAISY_BED, SUNFLOWER_BED, cropsForBed, growthProgress, growthTimeLeft, type GardenAction, type GardenState } from "./garden";
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
    const cropName = CROP_NAMES[bed.crop][p.language];
    return <div className="v-garden-bed" key={i}>
      <div className="v-garden-bed-heading"><div><strong>{mint ? t("Mint · Tea leaves", "ミント・お茶の葉") : bed.stage === "empty" && !daisy && !sunflower ? t("Empty bed", "空の花壇") : cropName}</strong>
        <span>{bed.stage === "sprout" ? t("Needs water", "水が必要") : bed.stage === "growing" ? t("Growing", "成長中") : bed.stage === "grown" ? t("Ready to pick", "収穫できます") : ""}</span></div>
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
    <h2>{t("Kitchen garden", "菜園")}</h2>
    <div className="v-garden-tabs" role="group" aria-label={t("Garden beds", "庭の種類")}>
      <button className="v-chip" aria-pressed={tab === "vegetables"} onClick={() => setTab("vegetables")}>{t("Vegetables", "野菜")}</button>
      <button className="v-chip" aria-pressed={tab === "flowers"} onClick={() => setTab("flowers")}>{t("Flowers & mint", "お花とミント")}</button>
    </div>
    {tab === "vegetables" ? <div className="v-garden-beds">{[0, 1, 2, 3].map(bedCard)}</div>
      : <div className="v-garden-flowers">
        {bedCard(MINT_BED)}
        {bedCard(DAISY_BED)}
        {bedCard(SUNFLOWER_BED)}
        <button className="v-button" onClick={() => p.onGardenAction({ kind: "flowers" })}><Flower size={20} />{t("Water the irises", "アイリスに水をあげる")}</button>
      </div>}
    <div className="v-garden-ritual">
      <button className="v-button" aria-label={t("View harvest basket", "収穫かごを見る")} onClick={() => p.onGardenAction({ kind: "basket" })}><Basket size={18} />{t("Harvest basket", "収穫かご")} · {harvest}</button>
      {harvest > 0 && <button className="v-text-button" onClick={() => p.travel("mood")}><Coffee size={18} />{t("Bring your harvest to Luma", "収穫をルマに届ける")}</button>}
    </div>
  </section>;
}

export function HarvestInventory({ garden, language }: Pick<GardenControls, "garden" | "language">) {
  return <div className="v-harvest-inventory">
    <dl>{(["carrot", "radish", "mint", "daisy", "sunflower"] as const).map(crop => <div key={crop}>
      <dt>{CROP_NAMES[crop][language]}</dt><dd>{garden[CROP_INVENTORY[crop]]}</dd>
    </div>)}</dl>
  </div>;
}

export function BirdActivity(p: GardenControls) {
  const ja = p.language === "ja", t = (en: string, jp: string) => ja ? jp : en;
  const busy = p.birdStatus === "crumbs" || p.birdStatus === "eating" || p.birdStatus === "happy";
  const status = {
    flying: t("Flying", "飛行中"), crumbs: t("Crumbs scattered", "パンくずを撒きました"),
    waiting: t("Ready to feed", "餌をあげられます"), sad: t("Waiting", "待機中"),
    eating: t("Eating", "食事中"), happy: t("Fed", "食事済み"),
  };
  return <section className="v-activity v-bird-activity" aria-label={t("Feed the birds", "小鳥にパンくずをあげる")}>
    <h2>{t("Bird clearing", "小鳥の広場")}</h2>
    <p role="status">{status[p.birdStatus]}</p>
    <div className="v-garden-bed-actions">
      <ShortcutButton className="v-button v-primary" aria-keyshortcuts="F" disabled={busy || !p.garden.crumbPouch} onClick={() => p.onGardenAction({ kind: "feedBirds" })}><Keycap aria-hidden="true">F</Keycap>{t("Scatter sourdough crumbs", "サワードウのパンくずを撒く")}</ShortcutButton>
    </div>
  </section>;
}

export function PondFeeding(p: GardenControls) {
  const ja = p.language === "ja";
  return <div className="v-garden-ritual">
    {p.garden.crumbPouch && <ShortcutButton className="v-button" aria-keyshortcuts="F" onClick={() => p.onGardenAction({ kind: "feed" })}><Keycap aria-hidden="true">F</Keycap>{ja ? "アヒルたちにパンくずをあげる" : "Feed the little duckies"}</ShortcutButton>}
  </div>;
}

export function MintTea(p: GardenControls) {
  const ja = p.language === "ja", t = (en: string, jp: string) => ja ? jp : en;
  return <div className="v-garden-ritual">
    <div className="v-garden-bed-actions">
      {p.garden.carrots > 0 && <ShortcutButton className="v-button v-gift" data-crop="carrot" aria-keyshortcuts="1" onClick={() => p.onGardenAction({ kind: "gift", crop: "carrot" })}><Keycap aria-hidden="true">1</Keycap>{t("Give Luma a carrot", "ルマにニンジンを渡す")}</ShortcutButton>}
      {p.garden.radishes > 0 && <ShortcutButton className="v-button v-gift" data-crop="radish" aria-keyshortcuts="2" onClick={() => p.onGardenAction({ kind: "gift", crop: "radish" })}><Keycap aria-hidden="true">2</Keycap>{t("Give Luma a radish", "ルマにラディッシュを渡す")}</ShortcutButton>}
      {p.garden.sunflowers > 0 && <ShortcutButton className="v-button v-gift" data-crop="sunflower" aria-keyshortcuts="C" onClick={() => p.onGardenAction({ kind: "gift", crop: "sunflower" })}><Keycap aria-hidden="true">C</Keycap><Flower size={18} />{t("Give Luma a sunflower", "ルマにひまわりを渡す")}</ShortcutButton>}
      {p.garden.daisies > 0 && <ShortcutButton className="v-button v-gift" data-crop="daisy" aria-keyshortcuts="B" onClick={() => p.onGardenAction({ kind: "gift", crop: "daisy" })}><Keycap aria-hidden="true">B</Keycap><Flower size={18} />{t("Give Luma a daisy", "ルマにデイジーを渡す")}</ShortcutButton>}
      {p.garden.mint > 0 && <ShortcutButton className="v-button v-gift" data-crop="mint" aria-keyshortcuts="3" onClick={() => p.onGardenAction({ kind: "gift", crop: "mint" })}><Keycap aria-hidden="true">3</Keycap><Leaf size={18} />{t("Give Luma mint for special tea", "ルマにミントを渡して特別なお茶に")}</ShortcutButton>}
    </div>
    {p.garden.mintTea > 0 && <><ShortcutButton className="v-button v-primary" aria-keyshortcuts="E" onClick={() => p.onGardenAction({ kind: "drink" })}><Keycap aria-hidden="true">E</Keycap><Coffee size={18} />{t("Drink your special mint tea", "特別なミントティーを飲む")}</ShortcutButton></>}
    {p.garden.carrots + p.garden.radishes + p.garden.mint + p.garden.daisies + p.garden.sunflowers === 0 && <button className="v-text-button" onClick={() => p.travel("garden")}>{t("Visit the kitchen garden", "菜園に行く")}</button>}
  </div>;
}

import { Keycap, ShortcutButton } from "./KeybindingControls";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, X } from "@phosphor-icons/react";
import type { VillageEngine } from "./VillageEngine";
import type { NearbyHorse } from "./horses";
import type { TownContext } from "./townInteractions";
import { TownActions } from "./TownControls";

export function HorseControls({ horse, riding, busy, engine, focus, t, town }: {
  horse: NearbyHorse; riding: boolean; busy: boolean; engine: VillageEngine | null; focus: () => void;
  t: (en: string, ja: string) => string;
  town?: TownContext | null;
}) {
  const hold = (key: string) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => { event.currentTarget.setPointerCapture(event.pointerId); engine?.horseKey(key, true); },
    onPointerUp: () => engine?.horseKey(key, false),
    onPointerCancel: () => engine?.horseKey(key, false),
    onLostPointerCapture: () => engine?.horseKey(key, false),
    onBlur: () => engine?.horseKey(key, false),
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); engine?.horseKey(key, true); }
    },
    onKeyUp: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); engine?.horseKey(key, false); }
    },
  });
  return <section className="v-swing-controls v-horse-controls" aria-label={t("Horse riding", "乗馬")}>
    <h2>{horse.name}</h2>
    {riding ? <>
      <ShortcutButton className="v-context-close" aria-label={t("Dismount", "馬を降りる")} aria-keyshortcuts="Escape" onClick={() => { engine?.leaveHorse(); focus(); }}><X size={18} aria-hidden="true" /></ShortcutButton>
      <div className="v-horse-directions">
        {([
          ["w", "W", t("Forward", "前へ"), ArrowUp], ["s", "S", t("Back", "後ろへ"), ArrowDown],
          ["a", "A", t("Left", "左へ"), ArrowLeft], ["d", "D", t("Right", "右へ"), ArrowRight],
        ] as const).map(([key, label, title, Icon]) => <ShortcutButton key={key} className="v-interact" title={title} aria-label={title} aria-keyshortcuts={label} {...hold(key)}>
          <Keycap aria-hidden="true">{label}</Keycap><Icon size={18} aria-hidden="true" />
        </ShortcutButton>)}
      </div>
      <div className="v-swing-secondary">
        <ShortcutButton className="v-interact" aria-keyshortcuts="Shift" {...hold("shift")}><Keycap aria-hidden="true">Shift</Keycap>{t("Canter", "駆ける")}</ShortcutButton>
        <ShortcutButton className="v-interact" aria-keyshortcuts="Space" {...hold(" ")}><Keycap aria-hidden="true">Space</Keycap>{t("Brake", "止まる")}</ShortcutButton>
      </div>
      <ShortcutButton className="v-interact" aria-keyshortcuts="E Escape" onClick={() => { engine?.leaveHorse(); focus(); }}><Keycap aria-hidden="true">E</Keycap>{t("Dismount", "馬を降りる")}</ShortcutButton>
    </> : <ShortcutButton className="v-interact" disabled={busy || horse.mode === "hold"} aria-keyshortcuts="E" onClick={() => { engine?.mountHorse(horse.id); focus(); }}>
      <Keycap aria-hidden="true">E</Keycap>{horse.mode === "hold" ? t("Eating hay…", "干し草を食べています…") : busy ? t("Already being ridden", "ほかの人が乗っています") : t("Ride", "乗る")}
    </ShortcutButton>}
    {town && <TownActions context={town} engine={engine} focus={focus} />}
  </section>;
}

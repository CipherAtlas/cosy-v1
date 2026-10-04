import type { TownActivityHUDState } from "./townProgress";
import type { ForageInventory } from "./townShared";
import { readInventory } from "./townShared";

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function TownActivityHUD({ state }: { state: TownActivityHUDState | null }) {
  if (!state) return null;
  if (state.kind === "farm") return <section className="v-town-progress v-farm-progress" aria-label={`${state.title} growth`}>
    <strong>{state.crop.charAt(0).toUpperCase() + state.crop.slice(1)}</strong>
    <span role="timer">{state.remaining === null ? "Needs water" : state.remaining === 0 ? "Ready to pick" : clock(state.remaining)}</span>
    <progress max={1} value={state.progress} aria-label={`${state.crop} growth`} />
  </section>;
  const title = state.phase === "countdown" ? "Ready for your lap?" : state.phase === "cancelled" ? "Race ended"
    : state.phase === "finished" ? state.result === "visitor" ? "You won!" : state.result === "tie" ? "A tie!" : "Lap complete!" : "Race Rowan";
  return <section className="v-town-progress v-race-progress" aria-label="Race progress">
    <strong>{title}</strong>
    {state.phase === "cancelled" ? null : state.phase === "countdown" ? <span className="v-race-countdown" role="timer" aria-live="polite">{state.countdown || "Go!"}</span>
      : <>
        <span className="v-race-clock" role="timer">{state.phase === "racing" ? clock(state.remaining) : `${state.elapsed.toFixed(1)}s`}</span>
        <div className="v-race-statistics"><span>{state.checkpoints} / 8 flags</span><span>Lap {state.elapsed.toFixed(1)}s</span></div>
        <div className="v-race-positions" aria-label="Lap positions">
          <label>You<progress max={8} value={state.checkpoints} /></label>
          <label>Rowan<progress max={1} value={state.rivalProgress} /></label>
        </div>
        {state.phase === "racing" && <p>{state.nextGateDistance === undefined ? "Next gate" : `Next gate ${state.nextGateDistance}m`}</p>}
      </>}
  </section>;
}

export function VillageInventory({ inventory }: { inventory: ForageInventory }) {
  const items = readInventory(inventory);
  return <div className="v-harvest-inventory v-local-inventory">
    <dl>{([
      ["apples", "Apples"], ["mushrooms", "Mushrooms"], ["carrots", "Carrots"], ["radishes", "Radishes"], ["mint", "Mint leaves"],
      ["daisies", "Daisies"], ["sunflowers", "Sunflowers"], ["mintTea", "Mint tea"],
    ] as const).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{items[key]}</dd></div>)}</dl>
  </div>;
}

import { Keycap, ShortcutButton } from "./KeybindingControls";
import type { VillageEngine } from "./VillageEngine";
import type { TownContext } from "./townInteractions";

export function TownActions({ context, engine, focus }: { context: TownContext; engine: VillageEngine | null; focus: () => void }) {
  return <div className="v-town-actions">
    {!context.minorOnly && <><h2>{context.title}</h2>{context.detail && <p role="status">{context.detail}</p>}</>}
    {context.actions.map(action => <ShortcutButton key={action.request.action + (action.request.crop ?? "")} className="v-interact"
      disabled={action.disabled} aria-keyshortcuts={action.key} onClick={() => { engine?.townAction(action.request); focus(); }}>
      <Keycap aria-hidden="true">{action.key}</Keycap>{action.label}
    </ShortcutButton>)}
  </div>;
}

export function TownControls(props: { context: TownContext; engine: VillageEngine | null; focus: () => void }) {
  return <section className="v-swing-controls v-town-controls" data-activity={props.context.kind} aria-label={props.context.title}><TownActions {...props} /></section>;
}

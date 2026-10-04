import type { SharedTown } from "./townShared";
import { TOWN_CHECKPOINTS, TOWN_RIVAL_LAP_MS } from "./townShared";
import type { TownContext } from "./townInteractions";

export type TownActivityHUDState =
  | { kind: "race"; phase: "countdown" | "racing" | "finished" | "cancelled"; countdown: number; remaining: number; elapsed: number;
      checkpoints: number; nextGateDistance?: number; rivalProgress: number; result: "visitor" | "rival" | "tie" | null }
  | { kind: "farm"; title: string; crop: string; remaining: number | null; progress: number };

export function townActivityHUD(town: SharedTown | undefined, selfId: string, context: TownContext | null, now: number): TownActivityHUDState | null {
  const race = town?.race;
  if (race?.owner === selfId && (race.phase === "countdown" || race.phase === "racing" || context?.kind === "race")) {
    const elapsed = Math.max(0, ((race.playerFinishAt ?? now) - race.goAt) / 1000);
    return { kind: "race", phase: race.phase, countdown: Math.max(0, Math.ceil((race.goAt - now) / 1000)),
      remaining: Math.max(0, Math.ceil((race.until - now) / 1000)), elapsed,
      checkpoints: Math.min(TOWN_CHECKPOINTS, race.nextCheckpoint - 1), nextGateDistance: context?.nextGateDistance,
      rivalProgress: Math.min(1, Math.max(0, (now - race.goAt) / TOWN_RIVAL_LAP_MS)), result: race.result };
  }
  if (context?.kind === "farm" && context.growth) {
    const remaining = context.growth.readyAt === null ? null : Math.max(0, Math.ceil((context.growth.readyAt - now) / 1000));
    return { kind: "farm", title: context.title, crop: context.growth.crop, remaining,
      progress: remaining === null ? 0 : Math.max(0, Math.min(1, 1 - remaining * 1000 / context.growth.duration)) };
  }
  return null;
}

import { VibeId, VibeProfile } from "@/features/music/types";
import { JAZZ_VIBE } from "@/features/music/vibes/jazz";
import { LOFI_VIBE } from "@/features/music/vibes/lofi";
import { PIANO_VIBE } from "@/features/music/vibes/piano";

export const VIBE_PROFILES: Record<VibeId, VibeProfile> = {
  lofi: LOFI_VIBE,
  piano: PIANO_VIBE,
  jazz: JAZZ_VIBE
};

export const getVibeProfile = (vibe: VibeId): VibeProfile => VIBE_PROFILES[vibe];

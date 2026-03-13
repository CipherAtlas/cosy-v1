import { MusicEngine } from "@/features/music/MusicEngine";

let sharedEngine: MusicEngine | null = null;

export const getSharedMusicEngine = (): MusicEngine => {
  if (!sharedEngine) {
    sharedEngine = new MusicEngine("lofi");
  }

  return sharedEngine;
};

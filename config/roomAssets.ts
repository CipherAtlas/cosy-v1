import { withBasePath } from "@/lib/basePath";

export const ROOM_ASSETS = {
  room: {
    background: withBasePath("/assets/anime-room/room/background.svg"),
    furniture: withBasePath("/assets/anime-room/room/furniture.svg"),
    lightingOverlay: withBasePath("/assets/anime-room/room/lighting-overlay.svg"),
    atmosphereOverlay: withBasePath("/assets/anime-room/room/atmosphere-overlay.svg")
  },
  window: {
    main: withBasePath("/assets/anime-room/window/main.svg")
  },
  breathe: {
    main: withBasePath("/assets/anime-room/breathe/main.svg")
  },
  desk: {
    main: withBasePath("/assets/anime-room/desk/main.svg"),
    lamp: withBasePath("/assets/anime-room/desk/lamp.svg")
  },
  recordPlayer: {
    main: withBasePath("/assets/anime-room/record-player/main.svg")
  },
  ui: {
    journal: withBasePath("/assets/anime-room/ui/journal.svg"),
    postcard: withBasePath("/assets/anime-room/ui/postcard.svg")
  }
} as const;

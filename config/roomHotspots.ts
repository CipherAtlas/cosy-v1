import { RoomHotspot } from "@/types/room";

export const ROOM_HOTSPOTS: RoomHotspot[] = [
  {
    id: "breathe",
    label: "Breathe",
    href: "/breathe",
    position: { top: "56%", left: "18%", width: "20%", height: "30%" },
    transitionOrigin: "28% 74%"
  },
  {
    id: "window",
    label: "Window",
    href: "/mood",
    position: { top: "14%", left: "56%", width: "24%", height: "32%" },
    transitionOrigin: "68% 24%"
  },
  {
    id: "record-player",
    label: "Record player",
    href: "/music",
    position: { top: "60%", left: "60%", width: "18%", height: "16%" },
    transitionOrigin: "70% 72%"
  },
  {
    id: "desk",
    label: "Desk",
    href: "/focus",
    position: { top: "58%", left: "34%", width: "23%", height: "28%" },
    transitionOrigin: "45% 76%"
  },
  {
    id: "journal",
    label: "Journal",
    href: "/gratitude",
    position: { top: "66%", left: "44%", width: "11%", height: "10%" },
    transitionOrigin: "50% 80%"
  },
  {
    id: "postcard",
    label: "Postcard note",
    href: "/compliment",
    position: { top: "36%", left: "78%", width: "10%", height: "11%" },
    transitionOrigin: "80% 42%"
  }
];

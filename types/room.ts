export type RoomHotspot = {
  id: "fireplace" | "window" | "record-player" | "desk" | "journal" | "postcard";
  label: string;
  href: "/breathe" | "/mood" | "/music" | "/focus" | "/gratitude" | "/compliment";
  position: {
    top: string;
    left: string;
    width: string;
    height: string;
  };
  transitionOrigin: string;
};

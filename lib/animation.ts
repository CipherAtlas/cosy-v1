export const MOTION = {
  hoverFast: 0.18,
  pageTransition: 0.4,
  ease: [0.22, 1, 0.36, 1] as const
};

export const ROUTE_ORIGINS: Record<string, string> = {
  "/": "50% 58%",
  "/breathe": "30% 74%",
  "/mood": "68% 25%",
  "/music": "70% 72%",
  "/focus": "45% 76%",
  "/gratitude": "50% 80%",
  "/compliment": "80% 42%"
};

export const ROOM_TRANSITION_ORIGIN_KEY = "peaceful-room-transition-origin";

import { ROOM_TRANSITION_ORIGIN_KEY, ROUTE_ORIGINS } from "@/lib/animation";

export const setTransitionOrigin = (origin: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(ROOM_TRANSITION_ORIGIN_KEY, origin);
};

export const consumeTransitionOrigin = (pathname: string): string => {
  if (typeof window === "undefined") {
    return ROUTE_ORIGINS[pathname] ?? "50% 50%";
  }

  const stored = window.sessionStorage.getItem(ROOM_TRANSITION_ORIGIN_KEY);
  if (stored) {
    window.sessionStorage.removeItem(ROOM_TRANSITION_ORIGIN_KEY);
    return stored;
  }

  return ROUTE_ORIGINS[pathname] ?? "50% 50%";
};

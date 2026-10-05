import { useContext, useEffect, type RefObject } from "react";
import { KeybindingContext } from "./KeybindingControls";
import { gameKey } from "./keybindings";

/** Apply the displayed game bindings to menu controls without taking over form editing. */
export function useVillageMenuNavigation(enabled: boolean, menu?: RefObject<HTMLElement | null>) {
  const bindings = useContext(KeybindingContext);
  useEffect(() => {
    if (!enabled) return;
    const navigate = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      // Text entry, sliders, native selects and key capture retain their own keys.
      if (target?.closest("input, textarea, select, [contenteditable='true']") || document.querySelector(".is-capturing")) return;
      const dialog = document.querySelector<HTMLElement>(".v-dialog[data-state='open']");
      const root = dialog ?? menu?.current;
      if (!root) return;
      const key = gameKey(bindings, event.key);
      const previous = ["w", "a"].includes(key) || !dialog && event.key === "ArrowUp";
      const next = ["s", "d"].includes(key) || !dialog && event.key === "ArrowDown";
      const edge = !dialog && ["Home", "End"].includes(event.key);
      if (!previous && !next && !edge && key !== "e") return;
      const controls = [...root.querySelectorAll<HTMLElement>("button:not(:disabled), summary, input:not(:disabled), select:not(:disabled)")]
        .filter(control => control.getClientRects().length > 0);
      const index = controls.indexOf(document.activeElement as HTMLElement);
      event.preventDefault();
      if (key === "e") {
        if (!event.repeat) (controls[index] ?? controls[0])?.click();
        return;
      }
      const selection = event.key === "Home" ? 0 : event.key === "End" ? controls.length - 1
        : (index + (previous ? -1 : 1) + controls.length) % controls.length;
      controls[selection]?.focus();
    };
    window.addEventListener("keydown", navigate);
    return () => window.removeEventListener("keydown", navigate);
  }, [enabled, menu, bindings]);
}

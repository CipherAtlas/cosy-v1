/** Covers React controls, portalled menus and the scene's native NPC buttons. */
export function installButtonFeedback(root: HTMLElement) {
  const animations = new Map<HTMLButtonElement, Animation>();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const visible = (button: HTMLButtonElement) => !button.disabled && button.getClientRects().length > 0
    && getComputedStyle(button).visibility !== "hidden";
  const feedback = (button: HTMLButtonElement) => {
    if (!visible(button)) return;
    const previous = animations.get(button);
    // Native keyboard clicks follow keydown; give each press just one animation.
    if (previous && Number(previous.currentTime) < 80) return;
    previous?.cancel();
    const animation = button.animate(reducedMotion.matches
      ? [{ filter: "brightness(1.18)" }, { filter: "brightness(1.18)" }]
      : [{ scale: "1", filter: "brightness(1)" }, { scale: ".96", filter: "brightness(1.18)" }, { scale: "1", filter: "brightness(1)" }],
    { duration: 180, easing: "ease-out" });
    animations.set(button, animation);
    animation.onfinish = () => animations.delete(button);
  };
  const buttonAt = (target: EventTarget | null) => {
    const button = target instanceof Element ? target.closest("button") : null;
    return button instanceof HTMLButtonElement && (root.contains(button) || button.closest(".v-dialog")) ? button : null;
  };
  const pointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const button = buttonAt(event.target);
    if (button) feedback(button);
  };
  const click = (event: MouseEvent) => {
    const button = buttonAt(event.target);
    if (button && event.detail === 0) feedback(button);
  };
  const keyDown = (event: KeyboardEvent) => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
    const target = event.target;
    if (target instanceof Element && target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) return;
    const focused = buttonAt(target);
    const swingBrake = event.key === " " && focused?.closest(".v-swing-controls")
      && root.querySelector(".v-swing-controls button[aria-keyshortcuts='Space']");
    if (focused && (event.key === "Enter" || (event.key === " " && !swingBrake))) { feedback(focused); return; }
    if (document.querySelector(".v-dialog")) return;
    // Focused dog controls handle their own shortcuts; scene shortcuts follow engine priority.
    const buttons = root.querySelectorAll<HTMLButtonElement>("button");
    const candidates = [...(focused?.closest(".v-puppy-actions")?.querySelectorAll<HTMLButtonElement>("button") ?? []),
      ...root.querySelectorAll<HTMLButtonElement>(".v-swing-controls button, .v-bird-feed-button"),
      ...root.querySelectorAll<HTMLButtonElement>(".v-villager-actions button[data-tea]"), ...buttons];
    const key = event.key === " " ? "space" : event.key.toLowerCase();
    const button = candidates.find(candidate => {
      if (!visible(candidate)) return false;
      const shortcuts = candidate.getAttribute("aria-keyshortcuts") ?? candidate.querySelector("kbd")?.textContent ?? "";
      return shortcuts.toLowerCase().split(/\s+/).includes(key);
    });
    if (button) feedback(button);
  };
  document.addEventListener("pointerdown", pointerDown, true);
  document.addEventListener("click", click, true);
  document.addEventListener("keydown", keyDown, true);
  return () => {
    document.removeEventListener("pointerdown", pointerDown, true);
    document.removeEventListener("click", click, true);
    document.removeEventListener("keydown", keyDown, true);
    animations.forEach(animation => animation.cancel());
    animations.clear();
  };
}

type Rect = { left: number; top: number; right: number; bottom: number };
const HUD = ".v-header > button, .v-header nav > *, .v-shared-chat, .v-shared-toggle, .v-activity, .v-activity-controls, .v-walk-hints, .v-puppy-actions, .v-swing-controls, .v-horse-controls, .v-lookout-controls, .v-town-actions, .v-picnic-near, .v-bench-actions, .v-town-progress, .v-touch-left, .v-touch-right, .v-session-mini, .v-cottage-cat";
const layouts = new WeakMap<HTMLElement, BubbleLayout>();
const intersects = (a: Rect, b: Rect, gap = 8) => a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;

/** Shared screen space for NPC, animal and visitor speech; React owns the HUD. */
class BubbleLayout {
  private owners = new Set<object>();
  private placed: Rect[] = [];
  private hud: Rect[] = [];
  private measuredAt = -Infinity;
  constructor(private host: HTMLElement) {}

  beginFrame() { this.owners.clear(); this.placed.length = 0; }

  begin(owner: object) {
    if (this.owners.has(owner)) this.beginFrame();
    this.owners.add(owner);
    const now = performance.now();
    if (now - this.measuredAt < 160) return;
    this.measuredAt = now;
    const bounds = this.host.getBoundingClientRect();
    const root = this.host.closest(".village") ?? this.host.parentElement ?? this.host;
    this.hud = [];
    for (const element of root.querySelectorAll<HTMLElement>(HUD)) {
      if (element.closest("[hidden]") || !element.getClientRects().length) continue;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      this.hud.push({ left: rect.left - bounds.left, top: rect.top - bounds.top, right: rect.right - bounds.left, bottom: rect.bottom - bounds.top });
    }
  }

  place(x: number, y: number, width: number, height: number, viewportWidth: number, viewportHeight: number, relocate = true) {
    if (width > viewportWidth - 24 || height > viewportHeight - 24) return;
    const preferredLeft = x - width / 2, preferredTop = y - height - 14;
    const candidates = relocate ? [[preferredLeft, preferredTop], [x + 20, preferredTop], [x - width - 20, preferredTop],
      [preferredLeft, y + 18], [preferredLeft, preferredTop - height - 12]] : [[preferredLeft, preferredTop]];
    if (relocate) {
      const preferred = { left: preferredLeft, top: preferredTop, right: preferredLeft + width, bottom: preferredTop + height };
      // A full chat or activity panel can be wider than the short anchor offsets above.
      for (const blocked of [...this.hud, ...this.placed]) if (intersects(preferred, blocked)) {
        candidates.push([blocked.right + 12, preferredTop], [blocked.left - width - 12, preferredTop],
          [preferredLeft, blocked.top - height - 20], [preferredLeft, blocked.bottom + 12]);
      }
    }
    for (const [rawLeft, rawTop] of candidates) {
      const left = Math.min(viewportWidth - width - 12, Math.max(12, rawLeft));
      const top = Math.min(viewportHeight - height - 20, Math.max(12, rawTop));
      const rect = { left, top, right: left + width, bottom: top + height + 8 };
      if (this.hud.some(other => intersects(rect, other)) || this.placed.some(other => intersects(rect, other))) continue;
      this.placed.push(rect); return rect;
    }
  }
}

export function bubbleLayout(host: HTMLElement) {
  let layout = layouts.get(host);
  if (!layout) { layout = new BubbleLayout(host); layouts.set(host, layout); }
  return layout;
}

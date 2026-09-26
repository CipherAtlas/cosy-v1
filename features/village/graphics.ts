import type { Quality } from "./places";

export const GRAPHICS_TIERS = {
  detailed: { pixels: 1920 * 1080, pixelRatio: 1.25, shadowSize: 2048, trees: 32, vegetation: 1 },
  battery: { pixels: 1280 * 720, pixelRatio: 0.85, shadowSize: 1024, trees: 22, vegetation: 0.58 },
  minimal: { pixels: 960 * 540, pixelRatio: 0.65, shadowSize: 0, trees: 16, vegetation: 0.35 },
};
export type GraphicsTier = keyof typeof GRAPHICS_TIERS;

export function initialGraphicsTier(quality: Quality): GraphicsTier {
  return quality === "low" ? "battery" : "detailed";
}

export function graphicsPixelRatio(tier: GraphicsTier, width: number, height: number, deviceRatio: number) {
  const budget = GRAPHICS_TIERS[tier];
  // A DPR cap alone still renders millions of unnecessary pixels on large monitors.
  return Math.min(deviceRatio, budget.pixelRatio, Math.sqrt(budget.pixels / Math.max(1, width * height)));
}

export function slowerGraphicsTier(tier: GraphicsTier): GraphicsTier {
  return tier === "detailed" ? "battery" : "minimal";
}

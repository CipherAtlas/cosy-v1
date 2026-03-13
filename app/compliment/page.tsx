"use client";

import { useState } from "react";
import { FeatureFrame } from "@/components/ui/FeatureFrame";
import compliments from "@/data/compliments.json";
import { dailyIndex, nextRandomIndex } from "@/features/compliment/rotation";

export default function ComplimentPage() {
  const [index, setIndex] = useState(() => dailyIndex(compliments.length));

  return (
    <FeatureFrame
      title="Compliment"
      subtitle="A grounded, gentle note for today."
      atmosphereClassName="bg-[radial-gradient(circle_at_78%_26%,rgba(236,190,154,0.16),transparent_45%),radial-gradient(circle_at_15%_72%,rgba(163,147,175,0.13),transparent_45%)]"
    >
      <div className="space-y-5">
        <blockquote className="rounded-2xl border border-white/12 bg-black/20 p-6 text-[clamp(1rem,2.6vw,1.35rem)] font-light leading-relaxed text-room-text">
          “{compliments[index]}”
        </blockquote>

        <button
          type="button"
          className="control text-sm"
          onClick={() => setIndex((prev) => nextRandomIndex(compliments.length, prev))}
        >
          Show another
        </button>
      </div>
    </FeatureFrame>
  );
}

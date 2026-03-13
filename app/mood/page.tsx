"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FeatureFrame } from "@/components/ui/FeatureFrame";
import moodSuggestions from "@/config/moodSuggestions.json";
import { MoodId, MoodSuggestion } from "@/features/mood/types";

const moods: MoodId[] = ["stressed", "tired", "restless", "lonely", "overwhelmed", "okay", "peaceful"];

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export default function MoodPage() {
  const [selectedMood, setSelectedMood] = useState<MoodId | null>(null);

  const suggestions = useMemo(() => {
    if (!selectedMood) {
      return [];
    }

    return (moodSuggestions[selectedMood] ?? []) as MoodSuggestion[];
  }, [selectedMood]);

  return (
    <FeatureFrame
      title="Mood"
      subtitle="How are you arriving right now?"
      atmosphereClassName="bg-[radial-gradient(circle_at_62%_22%,rgba(148,178,200,0.22),transparent_45%),radial-gradient(circle_at_12%_80%,rgba(217,172,132,0.12),transparent_45%)]"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {moods.map((mood) => (
            <button
              key={mood}
              type="button"
              className="control text-sm"
              data-active={selectedMood === mood}
              onClick={() => setSelectedMood(mood)}
            >
              {capitalize(mood)}
            </button>
          ))}
        </div>

        {selectedMood ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm text-room-muted">You could try:</p>
            <div className="mt-3 grid gap-2">
              {suggestions.map((item) => (
                <Link key={item.text} href={item.href} className="control text-sm">
                  {item.text}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-room-muted">Select a mood and we will offer a gentle next place.</p>
        )}
      </div>
    </FeatureFrame>
  );
}

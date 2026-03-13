"use client";

import { useEffect, useRef, useState } from "react";
import { FeatureFrame } from "@/components/ui/FeatureFrame";
import { MUSIC_PRESETS, MusicPresetId } from "@/config/musicPresets";
import { PeacefulMusicEngine } from "@/features/music/audioEngine";

export default function MusicPage() {
  const engineRef = useRef<PeacefulMusicEngine | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [preset, setPreset] = useState<MusicPresetId>("rainy-evening");
  const [rainEnabled, setRainEnabled] = useState(true);
  const [crackleEnabled, setCrackleEnabled] = useState(false);

  useEffect(() => {
    const engine = new PeacefulMusicEngine();
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setPreset(preset);
  }, [preset]);

  useEffect(() => {
    engineRef.current?.setRain(rainEnabled);
  }, [rainEnabled]);

  useEffect(() => {
    engineRef.current?.setCrackle(crackleEnabled);
  }, [crackleEnabled]);

  const togglePlayback = async () => {
    if (!engineRef.current) {
      return;
    }

    if (isPlaying) {
      engineRef.current.pause();
      setIsPlaying(false);
      return;
    }

    await engineRef.current.start();
    setIsPlaying(true);
  };

  return (
    <FeatureFrame
      title="Music"
      subtitle="Warm procedural layers from the record player."
      atmosphereClassName="bg-[radial-gradient(circle_at_70%_20%,rgba(171,199,217,0.16),transparent_42%),radial-gradient(circle_at_18%_80%,rgba(223,165,114,0.14),transparent_40%)]"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="control text-sm" onClick={togglePlayback}>
            {isPlaying ? "Pause" : "Play"}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {MUSIC_PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="control text-sm"
              data-active={preset === item.id}
              onClick={() => setPreset(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className="control text-sm"
            data-active={rainEnabled}
            onClick={() => setRainEnabled((prev) => !prev)}
          >
            Rain {rainEnabled ? "On" : "Off"}
          </button>
          <button
            type="button"
            className="control text-sm"
            data-active={crackleEnabled}
            onClick={() => setCrackleEnabled((prev) => !prev)}
          >
            Vinyl crackle {crackleEnabled ? "On" : "Off"}
          </button>
        </div>

        <p className="text-sm text-room-muted">
          Procedural scaffold: soft synth chords, tempo shaping, rain texture, and optional vinyl crackle.
        </p>
      </div>
    </FeatureFrame>
  );
}

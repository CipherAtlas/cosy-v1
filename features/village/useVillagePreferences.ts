import { useEffect, useState } from "react";
import { DEFAULT_KEYBINDINGS, readKeybindings } from "./keybindings";
import { DEFAULT_MIX, localTimeWeather, type AudioMix, type Quality, type Weather } from "./places";

/** Personal settings stay in this browser; graphics default to battery mode. */
export function useVillagePreferences() {
  const [keybindings, setKeybindings] = useState({ ...DEFAULT_KEYBINDINGS });
  const [mix, setMix] = useState<AudioMix>(DEFAULT_MIX);
  const [quality, setQuality] = useState<Quality>("low");
  const [weather, setWeather] = useState<Weather>("golden");
  const [weatherMode, setWeatherMode] = useState<"auto" | "manual">("auto");
  const [language, setLanguage] = useState<"en" | "ja">("en");
  const [mouseSensitivity, setMouseSensitivity] = useState(1);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  useEffect(() => {
    try {
      const p = JSON.parse(
        localStorage.getItem("cosy-village-preferences") || "null",
      );
      if (p) {
        setKeybindings(readKeybindings(p.keybindings));
        if (["low", "high", "auto"].includes(p.quality)) setQuality(p.quality);
        const savedWeather: Weather | null = ["golden", "dusk", "night", "rain"].includes(p.weather) ? p.weather : null;
        if (savedWeather && p.weatherMode === "manual") {
          setWeather(savedWeather);
          setWeatherMode("manual");
        }
        if (p.language === "ja") setLanguage("ja");
        if (typeof p.mouseSensitivity === "number" && Number.isFinite(p.mouseSensitivity)
          && p.mouseSensitivity >= .25 && p.mouseSensitivity <= 2)
          setMouseSensitivity(p.mouseSensitivity);
        if (
          p.mix &&
          ["piano", "lofi", "jazz"].includes(p.mix.vibe) &&
          ["music", "rain", "fire", "master"].every(
            (k) =>
              typeof p.mix[k] === "number" && p.mix[k] >= 0 && p.mix[k] <= 1,
          )
        )
          setMix({ ...p.mix,
            soundtrack: ["auto", "village", "water", "rest", "hearth"].includes(p.mix.soundtrack) ? p.mix.soundtrack : "auto",
            ambience: typeof p.mix.ambience === "number" && p.mix.ambience >= 0 && p.mix.ambience <= 1 ? p.mix.ambience : DEFAULT_MIX.ambience,
            effects: typeof p.mix.effects === "number" && p.mix.effects >= 0 && p.mix.effects <= 1 ? p.mix.effects : DEFAULT_MIX.effects,
            river: typeof p.mix.river === "number" && p.mix.river >= 0 && p.mix.river <= 1 ? p.mix.river : 1,
            wind: typeof p.mix.wind === "number" && p.mix.wind >= 0 && p.mix.wind <= 1 ? p.mix.wind : 1,
          });
      }
    } catch {}
    setPreferencesLoaded(true);
  }, []);
  useEffect(() => {
    if (!preferencesLoaded || weatherMode !== "auto") return;
    const refresh = () => setWeather(localTimeWeather(new Date()));
    refresh();
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [preferencesLoaded, weatherMode]);
  useEffect(() => {
    if (!preferencesLoaded) return;
    try {
      localStorage.setItem(
        "cosy-village-preferences",
        JSON.stringify({ mix, weather, weatherMode, language, mouseSensitivity, keybindings, quality }),
      );
    } catch {}
  }, [mix, weather, weatherMode, language, mouseSensitivity, keybindings, quality, preferencesLoaded]);
  return { keybindings, setKeybindings, mix, setMix, quality, setQuality, weather, setWeather,
    weatherMode, setWeatherMode, language, setLanguage, mouseSensitivity, setMouseSensitivity };
}

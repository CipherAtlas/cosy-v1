import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { withBasePath } from "@/lib/basePath";

export function useVillageLoadingProgress(progress: number) {
  const [displayed, setDisplayed] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    const target = Math.min(100, Math.max(0, progress));
    const from = current.current;
    if (target <= from || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      current.current = target;
      setDisplayed(target);
      return;
    }
    // Smooth real progress jumps so the flame finishes before the willow starts.
    const duration = Math.max(240, (target - from) * 9);
    const start = performance.now();
    let frame: number;
    const advance = (now: number) => {
      const elapsed = Math.min(1, (now - start) / duration);
      current.current = elapsed === 1 ? target : from + (target - from) * elapsed;
      setDisplayed(current.current);
      if (elapsed < 1) frame = requestAnimationFrame(advance);
    };
    frame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(frame);
  }, [progress]);
  return displayed;
}

export function VillageLoadingScreen({ language, progress, displayed = progress }: { language: "en" | "ja"; progress: number; displayed?: number }) {
  const id = useId();
  const flame = Math.min(1, Math.max(0, displayed / 30));
  const willow = Math.min(1, Math.max(0, (displayed - 30) / 70));
  const logo = withBasePath("/hearthwillow-logo.png");
  return <div className="v-title-loading" role="status" aria-label={language === "ja" ? "ハースウィローを準備しています" : "Loading Hearthwillow"}>
    <div className="v-loading-logo" aria-hidden="true" data-flame={flame} data-willow={willow}>
      <Image className="v-loading-logo-dim" src={logo} alt="" width={560} height={560} priority />
      <svg className="v-loading-logo-lit" viewBox="0 0 560 560" focusable="false">
        <defs>
          {/* Amber has more red than green; the willow has more green than red. */}
          <filter id={`${id}-flame`} colorInterpolationFilters="sRGB">
            <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  8 -8 0 0 0" result="amber" />
            <feComposite in="SourceGraphic" in2="amber" operator="in" />
          </filter>
          <filter id={`${id}-willow`} colorInterpolationFilters="sRGB">
            <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  8 -8 0 0 0" result="amber" />
            <feComposite in="SourceGraphic" in2="amber" operator="out" />
          </filter>
          <clipPath id={`${id}-flame-fill`}><rect x="0" y={494 - 138 * flame} width="560" height={138 * flame} /></clipPath>
          <clipPath id={`${id}-willow-fill`}><rect x="0" y={560 * (1 - willow)} width="560" height={560 * willow} /></clipPath>
        </defs>
        <g clipPath={`url(#${id}-willow-fill)`}>
          <image href={logo} width="560" height="560" filter={`url(#${id}-willow)`} />
        </g>
        <g className="v-loading-flame" clipPath={`url(#${id}-flame-fill)`}>
          <image href={logo} width="560" height="560" filter={`url(#${id}-flame)`} />
        </g>
      </svg>
    </div>
    <progress className="sr-only" max={100} value={progress} aria-label={language === "ja" ? "読み込み中" : "Loading"} />
  </div>;
}

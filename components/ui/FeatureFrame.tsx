import Link from "next/link";
import { PropsWithChildren } from "react";

type FeatureFrameProps = PropsWithChildren<{
  title: string;
  subtitle: string;
  atmosphereClassName?: string;
}>;

export const FeatureFrame = ({ title, subtitle, atmosphereClassName, children }: FeatureFrameProps) => {
  return (
    <section className="feature-shell">
      <div className="feature-card soft-panel relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-80">
          <div className={`h-full w-full ${atmosphereClassName ?? ""}`} />
        </div>

        <div className="relative z-10 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[clamp(1.5rem,3.8vw,2.1rem)] font-light tracking-[0.015em] text-room-text">{title}</h1>
            <p className="mt-2 text-sm text-room-muted">{subtitle}</p>
          </div>
          <Link href="/" className="control text-xs" aria-label="Return to room">
            Return to room
          </Link>
        </div>

        <div className="relative z-10 mt-8">{children}</div>
      </div>
    </section>
  );
};

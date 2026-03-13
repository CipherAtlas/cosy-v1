const DUST_PARTICLES = [
  { left: "7%", top: "84%", size: 8, duration: 26, delay: 0, driftX: -10, opacity: 0.2, color: "rgba(246, 199, 184, 0.55)" },
  { left: "15%", top: "70%", size: 6, duration: 22, delay: 2, driftX: 9, opacity: 0.15, color: "rgba(242, 198, 216, 0.5)" },
  { left: "22%", top: "90%", size: 10, duration: 28, delay: 1, driftX: -7, opacity: 0.18, color: "rgba(220, 207, 246, 0.5)" },
  { left: "30%", top: "82%", size: 7, duration: 24, delay: 3, driftX: 8, opacity: 0.16, color: "rgba(207, 229, 255, 0.55)" },
  { left: "38%", top: "76%", size: 9, duration: 27, delay: 0.6, driftX: -9, opacity: 0.14, color: "rgba(246, 199, 184, 0.45)" },
  { left: "46%", top: "88%", size: 7, duration: 25, delay: 1.6, driftX: 7, opacity: 0.17, color: "rgba(242, 198, 216, 0.46)" },
  { left: "54%", top: "91%", size: 8, duration: 30, delay: 2.2, driftX: 11, opacity: 0.13, color: "rgba(220, 207, 246, 0.5)" },
  { left: "62%", top: "80%", size: 9, duration: 24, delay: 0.9, driftX: -8, opacity: 0.16, color: "rgba(207, 229, 255, 0.5)" },
  { left: "70%", top: "86%", size: 6, duration: 22, delay: 1.3, driftX: 8, opacity: 0.18, color: "rgba(246, 199, 184, 0.5)" },
  { left: "78%", top: "92%", size: 8, duration: 27, delay: 3.1, driftX: -7, opacity: 0.15, color: "rgba(242, 198, 216, 0.5)" },
  { left: "86%", top: "84%", size: 10, duration: 26, delay: 0.2, driftX: -8, opacity: 0.14, color: "rgba(220, 207, 246, 0.46)" },
  { left: "93%", top: "75%", size: 7, duration: 28, delay: 4.4, driftX: 7, opacity: 0.16, color: "rgba(207, 229, 255, 0.52)" }
] as const;

export const GoldenDust = () => {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {DUST_PARTICLES.map((particle, index) => (
        <span
          key={`${particle.left}-${particle.top}-${index}`}
          className="dust-particle"
          style={{
            left: particle.left,
            top: particle.top,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            background: particle.color,
            animationDuration: `${particle.duration}s`,
            animationDelay: `${particle.delay}s`,
            // CSS variables are used by keyframes for cheap transform-based movement.
            ["--dust-drift-x" as string]: `${particle.driftX}px`,
            ["--dust-opacity" as string]: `${particle.opacity}`
          }}
        />
      ))}

      <style jsx>{`
        .dust-particle {
          position: absolute;
          border-radius: 999px;
          filter: blur(0.8px);
          opacity: 0;
          will-change: transform, opacity;
          animation-name: dust-float;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        @keyframes dust-float {
          0% {
            transform: translate3d(0px, 0px, 0);
            opacity: 0;
          }

          14% {
            opacity: var(--dust-opacity);
          }

          82% {
            opacity: calc(var(--dust-opacity) * 0.55);
          }

          100% {
            transform: translate3d(var(--dust-drift-x), -170px, 0);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        room: {
          bg: "#1f1918",
          panel: "#2f2724",
          text: "#f1e7db",
          muted: "#c7b9aa",
          accent: "#d59a68",
          accentSoft: "#9c7662",
          candle: "#f9bf78"
        }
      },
      boxShadow: {
        glow: "0 0 40px rgba(213, 154, 104, 0.25)",
        soft: "0 10px 40px rgba(0, 0, 0, 0.22)"
      },
      keyframes: {
        flicker: {
          "0%, 100%": { opacity: "0.48", transform: "scale(1)" },
          "50%": { opacity: "0.74", transform: "scale(1.04)" }
        },
        rain: {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "-36px 140px" }
        },
        drift: {
          "0%, 100%": { transform: "translateX(0px)" },
          "50%": { transform: "translateX(5px)" }
        },
        breathePulse: {
          "0%, 100%": { transform: "scale(0.9)" },
          "50%": { transform: "scale(1.08)" }
        }
      },
      animation: {
        flicker: "flicker 2.4s ease-in-out infinite",
        rain: "rain 5.5s linear infinite",
        drift: "drift 7s ease-in-out infinite",
        breathePulse: "breathePulse 6s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;

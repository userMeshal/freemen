import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0B0B0C", soft: "#1A1A1C", mute: "#55534E" },
        paper: { DEFAULT: "#F5F1E8", deep: "#EBE5D6", card: "#FBF9F3" },
        lime: { DEFAULT: "#D7FF3E", deep: "#B6E000" },
        coral: "#FF4B2B",
        line: "rgba(11,11,12,0.12)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        accent: ["var(--font-accent)"],
      },
      borderRadius: { tile: "1.75rem", pill: "999px" },
      transitionTimingFunction: {
        expo: "cubic-bezier(0.16, 1, 0.3, 1)",
        "in-out-quart": "cubic-bezier(0.76, 0, 0.24, 1)",
      },
      keyframes: {
        marquee: { to: { transform: "translate3d(50%,0,0)" } },
        floaty: {
          "0%,100%": { transform: "translate3d(0,0,0) rotate(var(--r,0deg))" },
          "50%": { transform: "translate3d(0,-14px,0) rotate(calc(var(--r,0deg) + 1.5deg))" },
        },
        spinSlow: { to: { transform: "rotate(360deg)" } },
      },
      animation: {
        marquee: "marquee var(--marquee-duration,28s) linear infinite",
        floaty: "floaty 6s ease-in-out infinite",
        "spin-slow": "spinSlow 14s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;

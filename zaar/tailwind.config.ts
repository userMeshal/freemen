import type { Config } from "tailwindcss";

/** الألوان متغيرات CSS (ثلاثيات RGB) حتى يبدّلها كل متجر بلوحته دون إعادة بناء */
const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: v("--ink"),
        paper: v("--paper"),
        accent: v("--accent"),
        "on-accent": v("--on-accent"),
        coral: "#FF4B2B",
        line: "rgb(var(--ink) / 0.12)",
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
        floaty: {
          "0%,100%": { transform: "translate3d(0,0,0) rotate(var(--r,0deg))" },
          "50%": { transform: "translate3d(0,-14px,0) rotate(calc(var(--r,0deg) + 1.5deg))" },
        },
        spinSlow: { to: { transform: "rotate(360deg)" } },
      },
      animation: {
        floaty: "floaty 6s ease-in-out infinite",
        "spin-slow": "spinSlow 14s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;

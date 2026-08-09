import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // ── Legacy palette (dark theme) ─────────────────────────
        // Kept for components not yet migrated to the new design
        // system (JobsPanel, CV document chrome, landing page).
        espresso: "#2b1d14",
        coffee: "#4a3022",
        cream: "#f5ede1",
        amber: {
          DEFAULT: "#c9842f",
          bright: "#e0993f",
        },
        // ── New design system (light-first) ─────────────────────
        ink: "#12131A", // primary text
        paper: "#F6F5F2", // page background
        cloud: "#FFFFFF", // card surface
        signal: "#5B4FE8", // product/AI actions: buttons, active nav, CTA
        "signal-tint": "#EEEDFE", // signal's light background tone (badge/hover)
        grid: "#2EA043", // GitHub-derived data only: score bars, tech radar, contributions
        "grid-tint": "#EAF3DE", // grid's light background tone
        slate: "#6B7280", // secondary text
        line: "#E5E3DD", // hairline border
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "var(--font-jetbrains)",
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      borderRadius: {
        // Cards use a consistent 12px radius with hairline borders.
        card: "12px",
      },
    },
  },
  plugins: [],
} satisfies Config;

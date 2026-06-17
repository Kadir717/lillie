import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        espresso: "#2b1d14",
        coffee: "#4a3022",
        cream: "#f5ede1",
        paper: "#fbf7f0",
        amber: {
          DEFAULT: "#c9842f",
          bright: "#e0993f",
        },
        ink: "#1f1611",
      },
    },
  },
  plugins: [],
} satisfies Config;

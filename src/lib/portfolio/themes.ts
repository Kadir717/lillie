/**
 * LILLIE — Portfolio Themes
 *
 * Deterministic theme registry for generated personal websites / portfolios.
 * Each theme is a pure data object: colors, fonts, layout and radius. Themes
 * are renderer-agnostic — both the HTML export builder (export.ts) and any
 * future React preview consume the same registry.
 */

export interface PortfolioTheme {
  id: string;
  name: string;
  description: string;
  /** Dark background? affects default text color choices. */
  dark: boolean;
  colors: {
    bg: string;
    surface: string;
    text: string;
    muted: string;
    accent: string;
    border: string;
  };
  font: string;
  /** Layout shape for the generated page. */
  layout: "single" | "split" | "cards";
  radius: string;
}

export const PORTFOLIO_THEMES: PortfolioTheme[] = [
  {
    id: "minimal",
    name: "Minimal",
    description: "Clean white canvas, single column, one accent color.",
    dark: false,
    colors: {
      bg: "#ffffff",
      surface: "#fafafa",
      text: "#111111",
      muted: "#6b7280",
      accent: "#2563eb",
      border: "#e5e7eb",
    },
    font: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    layout: "single",
    radius: "6px",
  },
  {
    id: "developer",
    name: "Developer",
    description: "Dark terminal-inspired theme with a green accent.",
    dark: true,
    colors: {
      bg: "#0d1117",
      surface: "#161b22",
      text: "#e6edf3",
      muted: "#8b949e",
      accent: "#3fb950",
      border: "#30363d",
    },
    font: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    layout: "split",
    radius: "8px",
  },
  {
    id: "bold",
    name: "Bold",
    description: "High-contrast cards with a vivid accent.",
    dark: true,
    colors: {
      bg: "#0b0f19",
      surface: "#151b2b",
      text: "#f5f7fa",
      muted: "#9aa5b5",
      accent: "#f97316",
      border: "#2a3245",
    },
    font: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    layout: "cards",
    radius: "12px",
  },
  {
    id: "elegant",
    name: "Elegant",
    description: "Soft serif headings, muted palette, refined spacing.",
    dark: false,
    colors: {
      bg: "#faf7f2",
      surface: "#ffffff",
      text: "#1f2933",
      muted: "#6b7280",
      accent: "#7c3aed",
      border: "#e8e0d8",
    },
    font: "Georgia, 'Times New Roman', serif",
    layout: "single",
    radius: "4px",
  },
  {
    id: "sunrise",
    name: "Sunrise",
    description: "Warm gradient accents on a light canvas.",
    dark: false,
    colors: {
      bg: "#fffaf5",
      surface: "#ffffff",
      text: "#27272a",
      muted: "#71717a",
      accent: "#e11d48",
      border: "#f1e6dd",
    },
    font: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    layout: "cards",
    radius: "10px",
  },
];

const THEME_BY_ID = new Map(PORTFOLIO_THEMES.map((t) => [t.id, t]));

/**
 * Returns the theme if valid, or `null` if unknown.
 * Use at every API boundary — never trust `?theme=` directly.
 */
export function validateTheme(value: string | null): PortfolioTheme | null {
  if (!value) return null;
  return THEME_BY_ID.get(value) ?? null;
}

export function getDefaultTheme(): PortfolioTheme {
  return PORTFOLIO_THEMES[0];
}

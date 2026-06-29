/**
 * Design tokens — the single source of visual truth.
 *
 * These values are intentionally kept in sync with the DOCX templates
 * (src/lib/templates/shared.ts: ACCENT_COLOR, TEXT_GRAY, etc.) so the
 * React preview and the downloaded .docx never visually diverge.
 *
 * If you change a color/spacing here for design reasons, mirror the
 * change in src/lib/templates/shared.ts as well.
 */

export const colors = {
  accent: "#2E5E8C",      // muted professional blue — matches ACCENT_COLOR in docx templates
  textPrimary: "#1A1A1A",
  textGray: "#444444",
  textMuted: "#888888",
  textFaint: "#AAAAAA",
  border: "#DDDDDD",
  statBg: "#F4F7FA",      // matches docx statBoxCell shading
  paper: "#FAF6EF",       // classic_professional page background
  darkBg: "#1A1A2E",      // developer_card header background
  cardBg: "#F0F4FA",      // developer_card project card background
  creamText: "#E8E8F0",   // text on dark background
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const typography = {
  fontFamily: "'Calibri', 'Segoe UI', Arial, sans-serif",
  sizes: {
    name: 28,       // ~size:48 (half-points) in docx -> px equivalent for screen
    bio: 15,
    heading: 17,
    body: 14,
    label: 10,
    statValue: 20,
    footer: 10,
  },
  weights: {
    regular: 400,
    semibold: 600,
    bold: 700,
  },
} as const;

/** A4-like page dimensions for the print/preview surface (in px @ 96dpi approximation). */
export const page = {
  width: 794,   // ~210mm
  minHeight: 1123, // ~297mm
  padding: 48,
} as const;

export const tokens = { colors, spacing, typography, page };
export type DesignTokens = typeof tokens;

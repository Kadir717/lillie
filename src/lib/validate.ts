/**
 * Input validation helpers for API route parameters.
 *
 * Every user-supplied parameter MUST be validated at the boundary.
 * Never trust `searchParams.get("locale") as CvLocale` without runtime
 * validation — a malformed value will cause a runtime crash downstream.
 */

import type { CvLocale } from "./cv-strings";

const VALID_LOCALES = new Set<string>([
  "en",
  "tr",
  "de",
  "fr",
  "es",
  "pt",
  "ja",
  "ko",
  "zh",
  "ru",
  "ar",
]);

const VALID_TEMPLATES = new Set<string>([
  "classic_professional",
  "developer_card",
  "minimal",
]);

/**
 * Returns the locale if valid, or `null` if invalid/missing.
 */
export function validateLocale(value: string | null): CvLocale | null {
  if (!value) return null;
  return VALID_LOCALES.has(value) ? (value as CvLocale) : null;
}

/**
 * Returns the template ID if valid, or `null` if invalid/missing.
 */
export function validateTemplate(value: string | null): string | null {
  if (!value) return null;
  return VALID_TEMPLATES.has(value) ? value : null;
}

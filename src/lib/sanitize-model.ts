import type { CvModel } from "./cv-model";

/**
 * Model snapshot sanitizer.
 *
 * The share/versions POST routes accept a CvModel snapshot from the
 * client. That snapshot is later rendered by <CvPreview> — including
 * project URLs as real <a href> links. React escapes text content but
 * does NOT sanitize href attributes, so an attacker-controlled
 * `project.url` of `javascript:...` would execute on the public page.
 *
 * This module:
 *   1. Validates the snapshot shape (rejects null/array header/stats
 *      that typeof checks would let through).
 *   2. Rebuilds a clean CvModel, keeping only the fields the renderers
 *      actually consume.
 *   3. Strips any URL that is not http(s) — project URLs always come
 *      from GitHub's `html_url`, which is https-only.
 *
 * Returns null when the payload is not a usable CvModel.
 */

const SAFE_URL_RE = /^https?:\/\//i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return SAFE_URL_RE.test(trimmed) ? trimmed : "";
}

function sanitizeText(value: unknown, maxLength = 500): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function sanitizeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sanitizeStringArray(value: unknown, maxItems = 30): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .slice(0, maxItems)
    .map((item) => sanitizeText(item, 200))
    .filter(Boolean);
}

export function sanitizeShareModel(input: unknown): CvModel | null {
  if (!isRecord(input)) return null;

  const header = input.header;
  const stats = input.stats;
  if (!isRecord(header) || !isRecord(stats)) return null;

  const name = sanitizeText(header.name, 200);
  if (!name) return null;

  const languages = Array.isArray(input.languages)
    ? input.languages
        .filter(isRecord)
        .slice(0, 20)
        .map((lang) => ({
          name: sanitizeText(lang.name, 100),
          percent: sanitizeNumber(lang.percent),
        }))
        .filter((lang) => lang.name)
    : [];

  const projects = Array.isArray(input.projects)
    ? input.projects
        .filter(isRecord)
        .slice(0, 50)
        .map((project) => ({
          name: sanitizeText(project.name, 200),
          url: sanitizeUrl(project.url),
          stars: sanitizeNumber(project.stars),
          forks: sanitizeNumber(project.forks),
          description: sanitizeText(project.description, 1000) || undefined,
          language: sanitizeText(project.language, 100) || undefined,
          topics: sanitizeStringArray(project.topics, 20),
        }))
        .filter((project) => project.name)
    : [];

  return {
    header: {
      name,
      bio: sanitizeText(header.bio, 500) || undefined,
      contacts: sanitizeStringArray(header.contacts, 20),
    },
    stats: {
      repos: sanitizeNumber(stats.repos),
      stars: sanitizeNumber(stats.stars),
      forks: sanitizeNumber(stats.forks),
      years: sanitizeNumber(stats.years),
    },
    languages,
    projects,
  };
}

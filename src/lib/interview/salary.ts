/**
 * Deterministic salary estimator.
 *
 * Rule-based estimate from role + experience + location signal. The output
 * is deliberately a RANGE with an explicit disclaimer — LILLIE does not
 * have live market data, so this is an indicative guide, not a quote.
 * (The AI layer could later enrich this with live data behind the same
 * contract.)
 */

import type { GithubProfile } from "../github";
import type { SalaryEstimate } from "./types";

/** Base annual USD range by role family (junior → senior). */
const ROLE_BASE: Record<string, { low: number; high: number }> = {
  software_engineer: { low: 55_000, high: 130_000 },
  frontend: { low: 50_000, high: 120_000 },
  backend: { low: 55_000, high: 135_000 },
  fullstack: { low: 55_000, high: 130_000 },
  devops: { low: 60_000, high: 145_000 },
  data_scientist: { low: 65_000, high: 150_000 },
  mobile: { low: 55_000, high: 130_000 },
  intern: { low: 25_000, high: 60_000 },
};

const DEFAULT_ROLE = "software_engineer";

/** Rough per-year experience multiplier (bounded). */
function experienceMultiplier(years: number): number {
  if (years <= 0) return 0.7;
  if (years <= 2) return 0.85;
  if (years <= 5) return 1.0;
  if (years <= 8) return 1.15;
  return 1.3;
}

/**
 * Detects a location factor from the GitHub profile location string.
 * Known tech hubs get an uplift; unknown locations stay at 1.0.
 */
function locationFactor(location: string | null): { factor: number; label: string } {
  if (!location) return { factor: 1.0, label: "no location on profile" };
  const loc = location.toLowerCase();
  const hubs: Array<{ match: string; factor: number; label: string }> = [
    { match: "san francisco", factor: 1.35, label: "SF Bay Area" },
    { match: "new york", factor: 1.25, label: "New York" },
    { match: "seattle", factor: 1.2, label: "Seattle" },
    { match: "london", factor: 1.2, label: "London" },
    { match: "berlin", factor: 1.1, label: "Berlin" },
    { match: "amsterdam", factor: 1.1, label: "Amsterdam" },
    { match: "remote", factor: 1.05, label: "remote" },
  ];
  for (const hub of hubs) {
    if (loc.includes(hub.match)) return { factor: hub.factor, label: hub.label };
  }
  return { factor: 1.0, label: "non-hub location" };
}

/**
 * Estimates an annual USD salary range.
 *
 * @param role    Role family key (defaults to software_engineer).
 * @param years   Years of experience (from GitHub contribution years).
 * @param profile GitHub profile (for location signal).
 */
export function estimateSalary(
  role: string,
  years: number,
  profile: Pick<GithubProfile, "location">
): SalaryEstimate {
  const base = ROLE_BASE[role] ?? ROLE_BASE[DEFAULT_ROLE];
  const loc = locationFactor(profile.location);
  const exp = experienceMultiplier(years);

  const rangeLow = Math.round((base.low * exp * loc.factor) / 1000) * 1000;
  const rangeHigh = Math.round((base.high * exp * loc.factor) / 1000) * 1000;

  const factors = [
    `Role: ${role}`,
    `Experience: ${years} year${years === 1 ? "" : "s"} on GitHub (×${exp.toFixed(2)})`,
    `Location: ${loc.label} (×${loc.factor.toFixed(2)})`,
  ];

  return {
    role,
    rangeLow,
    rangeHigh,
    yearsExperience: years,
    locationFactor: loc.factor,
    factors,
    disclaimer:
      "Indicative range based on public averages — not a job offer. Verify with live market data before relying on it.",
  };
}

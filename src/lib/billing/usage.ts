/**
 * LILLIE — Usage limits
 *
 * Counts a user's current usage against their entitlements. Enforcement is
 * additive and non-destructive: limits gate NEW creations (a profile, a
 * job, an export), they never delete or block existing data.
 *
 * All counts are computed in the database (count queries) — no row scans.
 *
 * ── Known limitation (documented) ──────────────────────────────
 * Enforcement is check-then-create: `checkLimit` reads, then the caller
 * inserts. Two concurrent requests could each pass the check and over-create
 * by one. At MVP scale (in-memory rate limiting, single instance) this is
 * acceptable; the future hardening path is a DB-level guard (transaction /
 * unique constraint / advisory lock).
 */

import { prisma } from "../db";
import type { Entitlements } from "./entitlements";

/** Start of the current calendar month (UTC). */
function monthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export interface UsageSnapshot {
  profiles: number;
  jobs: number;
  /** Portfolio exports (json/html/markdown/website) this calendar month. */
  monthlyExports: number;
}

/** Counts a user's current usage in one pass. */
export async function getUsage(userId: string): Promise<UsageSnapshot> {
  const since = monthStart();
  const [profiles, jobs, monthlyExports] = await Promise.all([
    prisma.cvProfile.count({ where: { userId } }),
    prisma.job.count({ where: { userId } }),
    prisma.analyticsEvent.count({
      where: {
        userId,
        type: { in: ["portfolio_export", "portfolio_website"] },
        createdAt: { gte: since },
      },
    }),
  ]);
  return { profiles, jobs, monthlyExports };
}

export type LimitKind = "profiles" | "jobs" | "monthlyExports";

/**
 * Maps a limit kind to the entitlements field that holds its cap.
 * Narrowed to the numeric limit fields so indexing yields `number`
 * (a broad `keyof Entitlements` would widen to a union incl. PlanConfig/Date).
 */
const LIMIT_FIELD: Record<
  LimitKind,
  "maxProfiles" | "maxJobs" | "maxMonthlyExports"
> = {
  profiles: "maxProfiles",
  jobs: "maxJobs",
  monthlyExports: "maxMonthlyExports",
};

export interface LimitCheck {
  allowed: boolean;
  kind: LimitKind;
  current: number;
  limit: number;
}

/**
 * Checks a single limit. `allowed` is false only when blocked by the cap.
 */
export async function checkLimit(
  userId: string,
  kind: LimitKind,
  entitlements: Entitlements,
  usage?: UsageSnapshot
): Promise<LimitCheck> {
  const snapshot = usage ?? (await getUsage(userId));
  const current = snapshot[kind];
  const limit = entitlements[LIMIT_FIELD[kind]];

  return {
    kind,
    current,
    limit,
    allowed: current < limit,
  };
}

/** Human-readable guidance for a blocked limit. */
export function limitMessage(kind: LimitKind, check: LimitCheck): string {
  const label: Record<LimitKind, string> = {
    profiles: "CV profiles",
    jobs: "tracked jobs",
    monthlyExports: "portfolio exports this month",
  };
  return `Your ${label[kind]} limit (${check.limit}) is reached. Upgrade your plan to add more.`;
}

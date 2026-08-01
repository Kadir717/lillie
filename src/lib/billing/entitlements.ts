/**
 * LILLIE — Entitlements
 *
 * Pure resolver: a persisted User row → the entitlements that row grants.
 * The app reads entitlements (never raw plan strings) so feature code stays
 * provider-independent: `if (entitlements.premiumTemplates)` instead of
 * `if (user.plan === "premium")`.
 *
 * Entitlements are resolved fresh on every request from the database — the
 * plan is NOT baked into the JWT, so subscription changes (upgrades,
 * cancellations, webhook updates) take effect immediately without waiting
 * for a 7-day session to expire.
 *
 * `resolveEntitlements` stays a pure function. `getUserEntitlements` is the
 * single I/O wrapper every API route uses to load a user's entitlements — it
 * centralizes the plan/status/role select shape so routes never duplicate it.
 */

import type { User } from "@prisma/client";
import { prisma } from "../db";
import { getPlan, isPlanUsable, isValidPlanId, type PlanId, type PlanConfig, type PlanStatus } from "./plans";

/** What a user is entitled to, derived from their persisted row. */
export interface Entitlements {
  /** The plan id currently in force (free when status is not usable). */
  planId: PlanId;
  planConfig: PlanConfig;
  /** Lifecycle status from the provider (never grant access on its own). */
  status: PlanStatus;
  /** True when the subscription period is currently active/usable. */
  active: boolean;
  /** Expiry of the current paid period (null for free). */
  expiresAt: Date | null;
  /** Internal role: user | admin. */
  role: string;

  // ── Feature flags / limits (what feature code checks) ─────────
  maxProfiles: number;
  maxJobs: number;
  maxMonthlyExports: number;
  premiumTemplates: boolean;
  aiCreditsPerMonth: number;
  analyticsRetentionDays: number;
}

/** Row shape the resolver needs (subset of the Prisma User model). */
export type EntitlementUserRow = Pick<
  User,
  "plan" | "planStatus" | "planExpiresAt" | "role"
>;

/**
 * Resolves entitlements from a persisted user row.
 * Pure — no I/O. A canceled/expired plan falls back to free limits.
 */
export function resolveEntitlements(user: EntitlementUserRow): Entitlements {
  const status = (user.planStatus ?? "none") as PlanStatus;
  const statusUsable = isPlanUsable(status);

  // Expiry check: a past expiry disables the paid plan.
  const notExpired =
    user.planExpiresAt === null ||
    user.planExpiresAt === undefined ||
    user.planExpiresAt.getTime() > Date.now();

  // Validate the plan string — a malformed/stale value (e.g. from a future
  // provider mapping bug) must never surface as an entitlement id.
  const effectivePlanId: PlanId =
    statusUsable && notExpired && isValidPlanId(user.plan) ? user.plan : "free";

  const config = getPlan(effectivePlanId);

  return {
    planId: effectivePlanId,
    planConfig: config,
    status,
    active: statusUsable && notExpired && effectivePlanId !== "free",
    expiresAt: user.planExpiresAt ?? null,
    role: user.role,
    maxProfiles: config.maxProfiles,
    maxJobs: config.maxJobs,
    maxMonthlyExports: config.maxMonthlyExports,
    premiumTemplates: config.premiumTemplates,
    aiCreditsPerMonth: config.aiCreditsPerMonth,
    analyticsRetentionDays: config.analyticsRetentionDays,
  };
}

/**
 * Convenience: does this user row have admin role?
 * Reserved for role-based access control (admin-only routes); no consumer
 * yet — exported so future admin surfaces use the canonical check.
 */
export function isAdmin(user: EntitlementUserRow): boolean {
  return user.role === "admin";
}

/**
 * Loads a user's entitlements by GitHub id — the single centralized query.
 * Returns null when the user row doesn't exist (caller decides the 404).
 */
export async function getUserEntitlements(
  githubId: number
): Promise<{ id: string; entitlements: Entitlements } | null> {
  const row = await prisma.user.findUnique({
    where: { githubId },
    select: {
      id: true,
      plan: true,
      planStatus: true,
      planExpiresAt: true,
      role: true,
    },
  });
  if (!row) return null;
  return { id: row.id, entitlements: resolveEntitlements(row) };
}

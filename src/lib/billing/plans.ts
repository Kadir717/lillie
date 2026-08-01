/**
 * LILLIE — Plans catalog
 *
 * Provider-independent entitlement plans. The catalog is STATIC config
 * (not a database table) because plans change rarely and the data model
 * must not be coupled to a payment provider's SKU/price id format.
 *
 * Mapping is:  User.plan  →  PlanConfig (limits)  →  feature access.
 * Payment providers (Stripe, Lemon Squeezy, Paddle, ...) only ever produce
 * a `plan` string + a lifecycle status — they are NEVER referenced by the
 * rest of the app. See src/lib/billing/provider.ts.
 *
 * ── Design note (founder in Uzbekistan) ──────────────────────────
 * Stripe is deliberately NOT assumed. The checkout/webhook layer is
 * provider-independent so a provider that supports Uzbekistan (e.g.
 * Lemon Squeezy, Paddle, Paystack-style gateways) can be plugged in
 * without touching feature code.
 */

export type PlanId = "free" | "pro" | "premium";

/** Subscription lifecycle states (provider-agnostic). */
export type PlanStatus =
  | "none"
  | "active"
  | "trialing"
  | "past_due"
  | "canceled";

export const PLAN_IDS: PlanId[] = ["free", "pro", "premium"];

/** Feature limits per plan. Add fields here as features ship. */
export interface PlanConfig {
  id: PlanId;
  name: string;
  /** Max CV profiles the user can keep. */
  maxProfiles: number;
  /** Max tracked jobs. */
  maxJobs: number;
  /** Max portfolio exports (json/html/markdown/website) per calendar month. */
  maxMonthlyExports: number;
  /** Whether premium template ids (src/lib/billing/templates.ts) unlock. */
  premiumTemplates: boolean;
  /** Future: AI tool calls per month. Reserved — not enforced yet. */
  aiCreditsPerMonth: number;
  /** Future: analytics retention window (days). Reserved. */
  analyticsRetentionDays: number;
  /** Short marketing line shown in the UI. */
  tagline: string;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    maxProfiles: 3,
    maxJobs: 3,
    maxMonthlyExports: 5,
    premiumTemplates: false,
    aiCreditsPerMonth: 0,
    analyticsRetentionDays: 30,
    tagline: "Everything you need to get started.",
  },
  pro: {
    id: "pro",
    name: "Pro",
    maxProfiles: 20,
    maxJobs: 100,
    maxMonthlyExports: 100,
    premiumTemplates: true,
    aiCreditsPerMonth: 50,
    analyticsRetentionDays: 365,
    tagline: "For active job seekers and creators.",
  },
  premium: {
    id: "premium",
    name: "Premium",
    maxProfiles: 100,
    maxJobs: 500,
    maxMonthlyExports: 1000,
    premiumTemplates: true,
    aiCreditsPerMonth: 500,
    analyticsRetentionDays: 730,
    tagline: "Maximum power for career growth.",
  },
};

/** Safely resolves a plan id (unknown → free). */
export function getPlan(plan: string | null | undefined): PlanConfig {
  if (plan && plan in PLANS) return PLANS[plan as PlanId];
  return PLANS.free;
}

/**
 * True when a subscription is currently paid/usable.
 * `trialing` and `active` grant entitlements; `past_due` keeps access for
 * a grace period; `canceled`/`none` fall back to free.
 */
export function isPlanUsable(status: PlanStatus): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}

export function isValidPlanId(value: string | null | undefined): value is PlanId {
  return !!value && value in PLANS;
}

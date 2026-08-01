/**
 * LILLIE — Premium templates
 *
 * Which template ids are gated behind Pro/Premium. The gate is applied at
 * every API boundary that accepts a template id (validate + entitlement
 * check), never inside the renderers.
 *
 * ── Current state ───────────────────────────────────────────────
 * The set is intentionally EMPTY: the three shipping templates
 * (classic_professional, developer_card, minimal) stay free so existing
 * users are never broken. When a premium template ships, add its id here
 * (and to VALID_TEMPLATES in src/lib/validate.ts) — every consumer is
 * already wired through `templateAllowed`.
 *
 * ── Future gate points ──────────────────────────────────────────
 * POST /api/profiles/[id]/versions persists locale/template snapshots and
 * must also be gated when the first premium template ships (it is a
 * template-accepting boundary like PATCH and share).
 */

const PREMIUM_TEMPLATES = new Set<string>([]);

/** True when the template id is a premium-only template. */
export function isPremiumTemplate(templateId: string): boolean {
  return PREMIUM_TEMPLATES.has(templateId);
}

/**
 * True when the user may use this template.
 * Entitlements are the source of truth for the plan's `premiumTemplates`
 * flag; this helper combines it with the registry.
 */
export function templateAllowed(
  templateId: string,
  entitlements: { premiumTemplates: boolean }
): boolean {
  return !isPremiumTemplate(templateId) || entitlements.premiumTemplates;
}

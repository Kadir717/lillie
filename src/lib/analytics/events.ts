/**
 * LILLIE — Analytics events
 *
 * Fire-and-forget event tracking. Every tracker:
 *   - NEVER throws (errors are swallowed + logged) so a DB hiccup can never
 *     break a download, a public page render, or an export.
 *   - Records a single row in `AnalyticsEvent`.
 *   - Accepts an optional `visitorHash` (salted IP hash) for public/anonymous
 *     events so unique visitors can be estimated without storing raw IPs.
 *
 * Call sites: /api/generate-cv (download), /r/[token] (public view),
 * /api/portfolio/export + /api/portfolio/website (exports),
 * /api/profiles/[id]/share (share toggles).
 */

import { createHash } from "node:crypto";
import { prisma } from "../db";
import { AnalyticsEventMetadata, AnalyticsEventType } from "./types";

/**
 * Records an analytics event. Resolves with the created id or `null` when
 * the write fails (never rejects).
 */
export async function trackEvent(input: {
  type: AnalyticsEventType;
  userId?: string | null;
  profileId?: string | null;
  metadata?: AnalyticsEventMetadata | null;
  visitorHash?: string | null;
}): Promise<string | null> {
  try {
    const row = await prisma.analyticsEvent.create({
      data: {
        type: input.type,
        userId: input.userId ?? null,
        profileId: input.profileId ?? null,
        metadata: input.metadata ?? undefined,
        visitorHash: input.visitorHash ?? null,
      },
      select: { id: true },
    });
    return row.id;
  } catch (err) {
    // Analytics must never break product flows.
    console.error(`Analytics: failed to record ${input.type} event:`, err);
    return null;
  }
}

/** Convenience: record a CV download event. */
export function trackCvDownload(input: {
  userId: string;
  locale: string;
  template: string;
  profileId?: string | null;
}): Promise<string | null> {
  return trackEvent({
    type: "cv_download",
    userId: input.userId,
    profileId: input.profileId ?? null,
    metadata: { locale: input.locale, template: input.template },
  });
}

/**
 * Convenience: record a public resume view (anonymous visitor).
 *
 * `userId` is the OWNER of the profile being viewed (resolved from the
 * token lookup, not from a session — the visitor stays anonymous). Recording
 * the owner id is what lets the per-user report attribute public views; the
 * visitor's identity is represented only by the salted `visitorHash`.
 */
export function trackResumeView(input: {
  userId: string;
  profileId: string;
  visitorHash?: string | null;
  referrer?: string | null;
}): Promise<string | null> {
  return trackEvent({
    type: "resume_view",
    userId: input.userId,
    profileId: input.profileId,
    visitorHash: input.visitorHash ?? null,
    metadata: input.referrer ? { referrer: input.referrer } : null,
  });
}

/** Convenience: record a portfolio export (json/html/markdown). */
export function trackPortfolioExport(input: {
  userId: string;
  format: string;
  theme?: string | null;
}): Promise<string | null> {
  return trackEvent({
    type: "portfolio_export",
    userId: input.userId,
    metadata: { format: input.format, theme: input.theme ?? undefined },
  });
}

/** Convenience: record a portfolio website view/generation. */
export function trackPortfolioWebsite(input: {
  userId: string;
  theme?: string | null;
}): Promise<string | null> {
  return trackEvent({
    type: "portfolio_website",
    userId: input.userId,
    metadata: { theme: input.theme ?? undefined },
  });
}

/** Convenience: record a share enable/disable action. */
export function trackProfileShare(input: {
  userId: string;
  profileId: string;
  enabled: boolean;
}): Promise<string | null> {
  return trackEvent({
    type: "profile_share",
    userId: input.userId,
    profileId: input.profileId,
    metadata: { enabled: input.enabled },
  });
}

/**
 * Best-effort salted visitor hash from an IP address.
 * Salted so a shared IP prefix cannot be reversed, and stable enough that
 * repeat visits from the same IP count as one visitor for estimation.
 *
 * Set ANALYTICS_SALT in production to keep the hash meaningful — without a
 * secret salt the hash is effectively reversible for common IPs. This module
 * is server-only (it imports prisma), so the top-level node:crypto import is
 * safe; importing it from a client component would fail the build loudly.
 */
export function hashVisitor(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const salt = process.env.ANALYTICS_SALT || "lillie-visitor";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

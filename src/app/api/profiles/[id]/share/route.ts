import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateLocale, validateTemplate } from "@/lib/validate";
import { sanitizeShareModel } from "@/lib/sanitize-model";
import { trackProfileShare } from "@/lib/analytics/events";
import { getUserEntitlements } from "@/lib/billing/entitlements";
import { templateAllowed } from "@/lib/billing/templates";

/**
 * GET /api/profiles/[id]/share
 *
 * Returns the current public-share state for a profile.
 *
 * Responses:
 *   200 — { enabled: boolean, shareUrl: string | null }
 *   401 — not authenticated
 *   404 — profile not found or not owned
 *   500 — unexpected failure
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const profile = await prisma.cvProfile.findUnique({
      where: { id },
      include: { user: { select: { githubId: true } } },
    });

    if (!profile || profile.user.githubId !== session.githubId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({
      enabled: profile.shareEnabled,
      shareUrl:
        profile.shareEnabled && profile.shareToken
          ? buildShareUrl(request, profile.shareToken)
          : null,
    });
  } catch (err) {
    console.error("Failed to fetch share state:", err);
    return NextResponse.json({ error: "Failed to load share state" }, { status: 500 });
  }
}

/**
 * POST /api/profiles/[id]/share
 *
 * Enables or disables the public resume link.
 *
 * Request body (enable):
 *   { enabled: true, model: CvModel, locale: string, template: string }
 *
 * Request body (disable):
 *   { enabled: false }
 *
 * When enabling, the current CvModel is snapshotted into the profile so
 * the public page (/r/:token) can render without any GitHub or session
 * access. The unguessable share token is generated server-side and the
 * profile's locale/template are updated so the snapshot renders exactly
 * as previewed.
 *
 * Responses:
 *   200 — { enabled: boolean, shareUrl: string | null }
 *   400 — invalid body (missing model/locale/template when enabling)
 *   401 — not authenticated
 *   404 — profile not found or not owned
 *   500 — unexpected failure
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }

  const enabled = body.enabled;
  if (typeof enabled !== "boolean") {
    return NextResponse.json(
      { error: "enabled must be a boolean" },
      { status: 400 }
    );
  }

  try {
    const profile = await prisma.cvProfile.findUnique({
      where: { id },
      include: { user: { select: { githubId: true } } },
    });

    if (!profile || profile.user.githubId !== session.githubId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (!enabled) {
      await prisma.cvProfile.update({
        where: { id },
        data: { shareEnabled: false },
      });
      // ── Record share-disable analytics (fire-and-forget) ────────
      void trackProfileShare({ userId: profile.userId, profileId: id, enabled: false });
      return NextResponse.json({ enabled: false, shareUrl: null });
    }

    // ── Enabling: validate the snapshot payload ──────────────────
    const locale = validateLocale(
      typeof body.locale === "string" ? body.locale : null
    );
    if (!locale) {
      return NextResponse.json(
        { error: "Invalid or missing locale" },
        { status: 400 }
      );
    }

    const template = validateTemplate(
      typeof body.template === "string" ? body.template : null
    );
    if (!template) {
      return NextResponse.json(
        { error: "Invalid or missing template" },
        { status: 400 }
      );
    }

    // ── Entitlement: premium template gate ───────────────────────
    // Sharing writes the template onto the profile row, so it must go
    // through the same gate as PATCH — otherwise enabling a share could
    // be used to unlock a premium template on a free plan.
    const billing = await getUserEntitlements(session.githubId);
    if (billing && !templateAllowed(template, billing.entitlements)) {
      return NextResponse.json(
        { error: "This template requires a paid plan." },
        { status: 403 }
      );
    }

    // Validate AND sanitize the snapshot. The public page renders this
    // model (project URLs become <a href>), so dangerous schemes like
    // javascript: must never reach the database.
    const model = sanitizeShareModel(body.model);
    if (!model) {
      return NextResponse.json(
        { error: "Invalid model snapshot (expected CvModel with header + stats)" },
        { status: 400 }
      );
    }

    // Reuse the existing token if the profile was shared before;
    // otherwise generate a fresh unguessable token.
    const shareToken =
      profile.shareToken && profile.shareEnabled
        ? profile.shareToken
        : randomBytes(24).toString("base64url");

    await prisma.cvProfile.update({
      where: { id },
      data: {
        shareEnabled: true,
        shareToken,
        shareModel: model,
        locale,
        template,
      },
    });

    // ── Record share-enable analytics (fire-and-forget) ───────────
    void trackProfileShare({ userId: profile.userId, profileId: id, enabled: true });

    return NextResponse.json({
      enabled: true,
      shareUrl: buildShareUrl(request, shareToken),
    });
  } catch (err) {
    console.error("Failed to update share state:", err);
    return NextResponse.json(
      { error: "Failed to update share state" },
      { status: 500 }
    );
  }
}

/**
 * Builds the public share URL for a token.
 * Prefers NEXT_PUBLIC_APP_URL (canonical domain) and falls back to the
 * request origin so local development works without extra config.
 */
function buildShareUrl(request: NextRequest, token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  return `${base.replace(/\/$/, "")}/r/${token}`;
}

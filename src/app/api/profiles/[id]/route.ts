import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateLocale, validateTemplate } from "@/lib/validate";
import { getUserEntitlements } from "@/lib/billing/entitlements";
import { templateAllowed } from "@/lib/billing/templates";

/**
 * GET /api/profiles/[id]
 *
 * Returns a single CV profile by ID. Only the owning user can access it.
 *
 * Responses:
 *   200 — { profile: CvProfile }
 *   401 — not authenticated
 *   404 — profile not found or not owned by user
 *   500 — unexpected failure
 */
export async function GET(
  _request: NextRequest,
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
      include: {
        user: { select: { githubId: true } },
      },
    });

    if (!profile || profile.user.githubId !== session.githubId) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    const { user: _user, ...safeProfile } = profile;
    return NextResponse.json({ profile: safeProfile });
  } catch (err) {
    console.error("Failed to fetch profile:", err);
    return NextResponse.json(
      { error: "Failed to load profile" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/profiles/[id]
 *
 * Updates a CV profile's title, locale, or template.
 * Only the owning user can update it.
 *
 * Request body (partial):
 *   { title?: string, locale?: string, template?: string }
 *
 * Responses:
 *   200 — { profile: CvProfile }
 *   400 — invalid field value
 *   401 — not authenticated
 *   404 — profile not found or not owned
 *   409 — duplicate title
 *   500 — unexpected failure
 */
export async function PATCH(
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

  // ── Build updates ───────────────────────────────────────────────
  const updates: Record<string, string> = {};

  if (body.title !== undefined) {
    const title =
      typeof body.title === "string" ? body.title.trim() : undefined;
    if (!title || title.length < 1 || title.length > 100) {
      return NextResponse.json(
        { error: "Title must be between 1 and 100 characters" },
        { status: 400 }
      );
    }
    updates.title = title;
  }

  if (body.locale !== undefined) {
    const locale = validateLocale(body.locale as string);
    if (!locale) {
      return NextResponse.json(
        {
          error: `Invalid locale. Supported: en, tr, de, fr, es, pt, ja, ko, zh, ru, ar`,
        },
        { status: 400 }
      );
    }
    updates.locale = locale;
  }

  let requestedTemplate: string | null = null;
  if (body.template !== undefined) {
    const template = validateTemplate(body.template as string);
    if (!template) {
      return NextResponse.json(
        {
          error: `Invalid template. Supported: classic_professional, developer_card, minimal`,
        },
        { status: 400 }
      );
    }
    updates.template = template;
    requestedTemplate = template;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update. Supported: title, locale, template" },
      { status: 400 }
    );
  }

  try {
    // Verify ownership first
    const existing = await prisma.cvProfile.findUnique({
      where: { id },
      include: { user: { select: { githubId: true } } },
    });

    if (!existing || existing.user.githubId !== session.githubId) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // ── Entitlement: premium template gate ───────────────────────
    // Mirrors POST /api/profiles so PATCH can't be used to unlock a
    // premium template on a free plan.
    if (requestedTemplate) {
      const billing = await getUserEntitlements(session.githubId);
      if (billing && !templateAllowed(requestedTemplate, billing.entitlements)) {
        return NextResponse.json(
          { error: "This template requires a paid plan." },
          { status: 403 }
        );
      }
    }

    const profile = await prisma.cvProfile.update({
      where: { id },
      data: updates,
      select: {
        id: true,
        title: true,
        locale: true,
        template: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ profile });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: `A profile with that title already exists` },
        { status: 409 }
      );
    }

    console.error("Failed to update profile:", err);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/profiles/[id]
 *
 * Deletes a CV profile. Only the owning user can delete it.
 *
 * Responses:
 *   200 — { success: true }
 *   401 — not authenticated
 *   404 — profile not found or not owned
 *   500 — unexpected failure
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.cvProfile.findUnique({
      where: { id },
      include: { user: { select: { githubId: true } } },
    });

    if (!existing || existing.user.githubId !== session.githubId) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    await prisma.cvProfile.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete profile:", err);
    return NextResponse.json(
      { error: "Failed to delete profile" },
      { status: 500 }
    );
  }
}

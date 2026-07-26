import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateLocale, validateTemplate } from "@/lib/validate";

/**
 * GET /api/profile
 *
 * Returns the authenticated user's safe profile data and preferences.
 *
 * Responses:
 *   200 — { user: { id, login, name, avatarUrl, email, locale, template } }
 *   401 — not authenticated
 *   404 — user not found in database
 *   500 — unexpected failure
 *
 * Never returns:
 *   - GitHub access token
 *   - JWT
 *   - secrets
 *   - OAuth credentials
 */
export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { githubId: session.githubId },
      select: {
        id: true,
        githubId: true,
        login: true,
        name: true,
        avatarUrl: true,
        email: true,
        locale: true,
        template: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found. Try signing out and back in." },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (err) {
    console.error("Profile fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to load profile" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/profile
 *
 * Updates user preferences. Currently supports:
 *   - locale    — CV locale code (e.g. "en", "fr", "ja")
 *   - template  — CV template ID (e.g. "classic_professional", "developer_card")
 *
 * Only provided fields are updated. Invalid values return 400.
 * Authentication required.
 *
 * Request body (partial):
 *   { "locale": "fr", "template": "developer_card" }
 *
 * Responses:
 *   200 — { user: { locale, template } }
 *   400 — invalid field value
 *   401 — not authenticated
 *   404 — user not found
 *   500 — unexpected failure
 */
export async function PATCH(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }

  // ── Validate and build updates ─────────────────────────────────
  const updates: Record<string, string> = {};

  if (body.locale !== undefined) {
    const locale = validateLocale(body.locale as string);
    if (!locale) {
      return NextResponse.json(
        {
          error: `Invalid locale: "${body.locale}". Supported: en, tr, de, fr, es, pt, ja, ko, zh, ru, ar`,
        },
        { status: 400 }
      );
    }
    updates.locale = locale;
  }

  if (body.template !== undefined) {
    const template = validateTemplate(body.template as string);
    if (!template) {
      return NextResponse.json(
        {
          error: `Invalid template: "${body.template}". Supported: classic_professional, developer_card`,
        },
        { status: 400 }
      );
    }
    updates.template = template;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update. Supported: locale, template" },
      { status: 400 }
    );
  }

  try {
    const user = await prisma.user.update({
      where: { githubId: session.githubId },
      data: updates,
      select: {
        locale: true,
        template: true,
      },
    });

    return NextResponse.json({ user });
  } catch (err) {
    console.error("Profile update failed:", err);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}

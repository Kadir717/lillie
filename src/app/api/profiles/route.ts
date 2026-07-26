import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateLocale, validateTemplate } from "@/lib/validate";

/**
 * GET /api/profiles
 *
 * Returns all CV profiles for the authenticated user.
 *
 * Responses:
 *   200 — { profiles: CvProfile[] }
 *   401 — not authenticated
 *   500 — unexpected failure
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { githubId: session.githubId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ profiles: [] });
    }

    const profiles = await prisma.cvProfile.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        locale: true,
        template: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ profiles });
  } catch (err) {
    console.error("Failed to fetch profiles:", err);
    return NextResponse.json(
      { error: "Failed to load profiles" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/profiles
 *
 * Creates a new CV profile for the authenticated user.
 *
 * Request body:
 *   { title: string, locale?: string, template?: string }
 *
 * Responses:
 *   201 — { profile: CvProfile }
 *   400 — invalid title, locale, or template
 *   401 — not authenticated
 *   500 — unexpected failure
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

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

  // ── Validate title ──────────────────────────────────────────────
  const title =
    typeof body.title === "string" ? body.title.trim() : undefined;
  if (!title || title.length < 1 || title.length > 100) {
    return NextResponse.json(
      { error: "Title must be between 1 and 100 characters" },
      { status: 400 }
    );
  }

  // ── Validate optional fields ────────────────────────────────────
  let locale = "en";
  if (body.locale !== undefined) {
    const validated = validateLocale(body.locale as string);
    if (!validated) {
      return NextResponse.json(
        {
          error: `Invalid locale. Supported: en, tr, de, fr, es, pt, ja, ko, zh, ru, ar`,
        },
        { status: 400 }
      );
    }
    locale = validated;
  }

  let template = "classic_professional";
  if (body.template !== undefined) {
    const validated = validateTemplate(body.template as string);
    if (!validated) {
      return NextResponse.json(
        {
          error: `Invalid template. Supported: classic_professional, developer_card`,
        },
        { status: 400 }
      );
    }
    template = validated;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { githubId: session.githubId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found. Try signing out and back in." },
        { status: 404 }
      );
    }

    const profile = await prisma.cvProfile.create({
      data: {
        userId: user.id,
        title,
        locale,
        template,
      },
      select: {
        id: true,
        title: true,
        locale: true,
        template: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ profile }, { status: 201 });
  } catch (err: unknown) {
    // Prisma unique constraint violation (duplicate title for same user)
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: `A profile named "${title}" already exists` },
        { status: 409 }
      );
    }

    console.error("Failed to create profile:", err);
    return NextResponse.json(
      { error: "Failed to create profile" },
      { status: 500 }
    );
  }
}

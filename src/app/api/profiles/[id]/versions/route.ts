import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateLocale, validateTemplate } from "@/lib/validate";
import { sanitizeShareModel } from "@/lib/sanitize-model";

/**
 * GET /api/profiles/[id]/versions
 *
 * Lists all saved versions for a profile (without the heavy model JSON —
 * use GET /api/profiles/[id]/versions/[versionId] for the full snapshot).
 *
 * Responses:
 *   200 — { versions: [{ id, label, locale, template, createdAt }] }
 *   401 — not authenticated
 *   404 — profile not found or not owned
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
      include: { user: { select: { githubId: true } } },
    });

    if (!profile || profile.user.githubId !== session.githubId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const versions = await prisma.cvVersion.findMany({
      where: { profileId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        label: true,
        locale: true,
        template: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ versions });
  } catch (err) {
    console.error("Failed to fetch versions:", err);
    return NextResponse.json({ error: "Failed to load versions" }, { status: 500 });
  }
}

/**
 * POST /api/profiles/[id]/versions
 *
 * Saves an immutable snapshot of the current CV as a new version.
 *
 * Request body:
 *   { label?: string, locale: string, template: string, model: CvModel }
 *
 * Responses:
 *   201 — { version }
 *   400 — invalid label/locale/template/model
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

  // ── Validate label (optional) ──────────────────────────────────
  let label: string | null = null;
  if (body.label !== undefined && body.label !== null) {
    if (typeof body.label !== "string") {
      return NextResponse.json({ error: "Label must be a string" }, { status: 400 });
    }
    const trimmed = body.label.trim();
    if (trimmed.length > 100) {
      return NextResponse.json(
        { error: "Label must be 100 characters or fewer" },
        { status: 400 }
      );
    }
    label = trimmed || null;
  }

  // ── Validate locale ────────────────────────────────────────────
  const locale = validateLocale(
    typeof body.locale === "string" ? body.locale : null
  );
  if (!locale) {
    return NextResponse.json(
      { error: "Invalid or missing locale" },
      { status: 400 }
    );
  }

  // ── Validate template ──────────────────────────────────────────
  const template = validateTemplate(
    typeof body.template === "string" ? body.template : null
  );
  if (!template) {
    return NextResponse.json(
      { error: "Invalid or missing template" },
      { status: 400 }
    );
  }

  // ── Validate + sanitize model snapshot ──────────────────────────
  // Versions can be restored into the live preview, so keep the same
  // sanitization guarantees as the share route.
  const model = sanitizeShareModel(body.model);
  if (!model) {
    return NextResponse.json(
      { error: "Invalid model snapshot (expected CvModel with header + stats)" },
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

    const version = await prisma.cvVersion.create({
      data: {
        profileId: id,
        label,
        locale,
        template,
        model,
      },
      select: {
        id: true,
        label: true,
        locale: true,
        template: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ version }, { status: 201 });
  } catch (err) {
    console.error("Failed to save version:", err);
    return NextResponse.json(
      { error: "Failed to save version" },
      { status: 500 }
    );
  }
}

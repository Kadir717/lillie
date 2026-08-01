import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/profiles/[id]/versions/[versionId]
 *
 * Returns the full immutable snapshot (including the CvModel JSON) for a
 * saved version. Used by Resume Comparison and version restore.
 *
 * Responses:
 *   200 — { version: { id, label, locale, template, model, createdAt } }
 *   401 — not authenticated
 *   404 — profile or version not found / not owned
 *   500 — unexpected failure
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id, versionId } = await params;

  try {
    const profile = await prisma.cvProfile.findUnique({
      where: { id },
      include: { user: { select: { githubId: true } } },
    });

    if (!profile || profile.user.githubId !== session.githubId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const version = await prisma.cvVersion.findFirst({
      where: { id: versionId, profileId: id },
      select: {
        id: true,
        label: true,
        locale: true,
        template: true,
        model: true,
        createdAt: true,
      },
    });

    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    return NextResponse.json({ version });
  } catch (err) {
    console.error("Failed to fetch version:", err);
    return NextResponse.json({ error: "Failed to load version" }, { status: 500 });
  }
}

/**
 * DELETE /api/profiles/[id]/versions/[versionId]
 *
 * Permanently removes a saved version. Only the owning user can delete it.
 *
 * Responses:
 *   200 — { success: true }
 *   401 — not authenticated
 *   404 — profile or version not found / not owned
 *   500 — unexpected failure
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id, versionId } = await params;

  try {
    const profile = await prisma.cvProfile.findUnique({
      where: { id },
      include: { user: { select: { githubId: true } } },
    });

    if (!profile || profile.user.githubId !== session.githubId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const version = await prisma.cvVersion.findFirst({
      where: { id: versionId, profileId: id },
      select: { id: true },
    });

    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    await prisma.cvVersion.delete({ where: { id: versionId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete version:", err);
    return NextResponse.json({ error: "Failed to delete version" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildAnalyticsReport } from "@/lib/analytics/report";

/**
 * GET /api/analytics
 *
 * Returns the authenticated user's usage analytics (downloads, public
 * resume views, portfolio exports, shares, GitHub growth) aggregated into
 * chart-ready series. All data is scoped to the session user.
 *
 * Responses:
 *   200 — { report: AnalyticsReport }
 *   401 — not authenticated
 *   500 — unexpected failure
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Resolve the persisted user id (session carries githubId).
    const user = await prisma.user.findUnique({
      where: { githubId: session.githubId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const report = await buildAnalyticsReport(user.id);
    return NextResponse.json({ report });
  } catch (err) {
    console.error("Analytics report failed:", err);
    return NextResponse.json(
      { error: "Failed to load analytics" },
      { status: 500 }
    );
  }
}

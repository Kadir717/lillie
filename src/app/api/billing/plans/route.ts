import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PLANS, PLAN_IDS } from "@/lib/billing/plans";
import { resolveEntitlements } from "@/lib/billing/entitlements";

/**
 * GET /api/billing/plans
 *
 * Returns the public plan catalog. When authenticated, also returns the
 * caller's current plan id so the UI can highlight their tier.
 *
 * Responses:
 *   200 — { plans: PlanConfig[], currentPlan?: "free"|"pro"|"premium" }
 *   500 — unexpected failure
 */
export async function GET() {
  try {
    const plans = PLAN_IDS.map((id) => PLANS[id]);

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ plans });
    }

    const user = await prisma.user.findUnique({
      where: { githubId: session.githubId },
      select: { plan: true, planStatus: true, planExpiresAt: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ plans });
    }

    const entitlements = resolveEntitlements(user);
    return NextResponse.json({ plans, currentPlan: entitlements.planId });
  } catch (err) {
    console.error("Failed to load plans:", err);
    return NextResponse.json({ error: "Failed to load plans" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUserEntitlements } from "@/lib/billing/entitlements";
import { getUsage } from "@/lib/billing/usage";

/**
 * GET /api/billing/entitlements
 *
 * Returns the authenticated user's entitlements (plan, feature flags,
 * limits) plus their current usage against those limits.
 *
 * Responses:
 *   200 — { entitlements, usage }
 *   401 — not authenticated
 *   404 — user not found
 *   500 — unexpected failure
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const billing = await getUserEntitlements(session.githubId);
    if (!billing) {
      return NextResponse.json(
        { error: "User not found. Try signing out and back in." },
        { status: 404 }
      );
    }

    const usage = await getUsage(billing.id);

    return NextResponse.json({ entitlements: billing.entitlements, usage });
  } catch (err) {
    console.error("Failed to load entitlements:", err);
    return NextResponse.json(
      { error: "Failed to load entitlements" },
      { status: 500 }
    );
  }
}

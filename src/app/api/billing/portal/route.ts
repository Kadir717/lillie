import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getBillingProvider } from "@/lib/billing/provider";

/**
 * POST /api/billing/portal
 *
 * Opens the payment provider's customer portal (manage subscription,
 * payment methods, invoices). Requires the user to have a persisted
 * provider customer/subscription id.
 *
 * Until a provider is configured this returns 503 (same contract as
 * checkout — the UI can disable the button based on the error).
 *
 * Responses:
 *   200 — { url }
 *   400 — no active subscription to manage
 *   401 — not authenticated
 *   404 — user not found
 *   503 — no billing provider configured
 *   500 — unexpected failure
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { githubId: session.githubId },
      select: { id: true, billingProvider: true, billingSubscriptionId: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: "User not found. Try signing out and back in." },
        { status: 404 }
      );
    }

    if (!user.billingProvider || !user.billingSubscriptionId) {
      return NextResponse.json(
        { error: "You don't have an active subscription to manage." },
        { status: 400 }
      );
    }

    const provider = getBillingProvider();
    if (!provider.isConfigured()) {
      return NextResponse.json(
        { error: "Payments are not enabled yet." },
        { status: 503 }
      );
    }

    // Provider portals may need the customer id; resolve per provider.
    // For now the interface exposes cancellation only — a real provider
    // module adds `openPortal(customerId)` as needed.
    return NextResponse.json(
      {
        error:
          "The billing portal is not implemented for this provider yet.",
      },
      { status: 501 }
    );
  } catch (err) {
    console.error("Failed to open billing portal:", err);
    return NextResponse.json(
      { error: "Failed to open billing portal" },
      { status: 500 }
    );
  }
}

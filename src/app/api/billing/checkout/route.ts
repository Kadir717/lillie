import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getBillingProvider,
  BillingNotConfiguredError,
} from "@/lib/billing/provider";
import { isValidPlanId } from "@/lib/billing/plans";

/**
 * POST /api/billing/checkout
 *
 * Creates a payment-provider checkout session for the given plan.
 *
 * Request body:
 *   { plan: "pro" | "premium", successUrl?: string, cancelUrl?: string }
 *
 * The provider is resolved via getBillingProvider() — the app never
 * hardcodes one. Until a provider is configured (BILLING_PROVIDER + its
 * credentials), this returns 503 with a clear message.
 *
 * Responses:
 *   200 — { url, sessionId }
 *   400 — invalid plan or URLs
 *   401 — not authenticated
 *   404 — user not found
 *   503 — no billing provider configured
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

  const plan = body.plan;
  if (typeof plan !== "string" || !isValidPlanId(plan) || plan === "free") {
    return NextResponse.json(
      { error: "Invalid plan. Expected: pro or premium" },
      { status: 400 }
    );
  }

  const origin = request.nextUrl.origin;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || origin).replace(/\/$/, "");
  const successUrl =
    typeof body.successUrl === "string" && body.successUrl.startsWith("/")
      ? `${appUrl}${body.successUrl}`
      : `${appUrl}/settings?upgrade=success`;
  const cancelUrl =
    typeof body.cancelUrl === "string" && body.cancelUrl.startsWith("/")
      ? `${appUrl}${body.cancelUrl}`
      : `${appUrl}/settings?upgrade=canceled`;

  try {
    const user = await prisma.user.findUnique({
      where: { githubId: session.githubId },
      select: { id: true, email: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: "User not found. Try signing out and back in." },
        { status: 404 }
      );
    }

    const provider = getBillingProvider();
    if (!provider.isConfigured()) {
      return NextResponse.json(
        {
          error:
            "Payments are not enabled yet. Set BILLING_PROVIDER and its credentials to accept payments.",
        },
        { status: 503 }
      );
    }

    const checkout = await provider.createCheckoutSession({
      planId: plan,
      userId: user.id,
      email: user.email,
      successUrl,
      cancelUrl,
    });

    return NextResponse.json(checkout);
  } catch (err) {
    if (err instanceof BillingNotConfiguredError) {
      return NextResponse.json(
        { error: "Payments are not enabled yet." },
        { status: 503 }
      );
    }
    console.error("Failed to create checkout session:", err);
    return NextResponse.json(
      { error: "Failed to start checkout" },
      { status: 500 }
    );
  }
}

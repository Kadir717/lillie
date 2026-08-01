import { NextRequest, NextResponse } from "next/server";
import { getBillingProvider } from "@/lib/billing/provider";

/**
 * POST /api/billing/webhook
 *
 * Provider webhook entry point. Deliberately has NO session auth — the
 * provider verifies the signature via its own secret. The provider module
 * parses the payload and maps lifecycle events (checkout completed,
 * subscription canceled, invoice past due, ...) onto the User's
 * plan/planStatus/expiry fields.
 *
 * Until a provider is configured, this returns 200 (treated as an
 * unrelated/ping event) so provider dashboard "send test event" flows do
 * not error out — the noop provider's parseWebhook returns null.
 *
 * Responses:
 *   200 — { received: true, handled: boolean }
 *   400 — invalid body
 *   500 — unexpected failure
 */
export async function POST(request: NextRequest) {
  const payload = await request.text();
  if (!payload) {
    return NextResponse.json(
      { error: "Empty webhook payload" },
      { status: 400 }
    );
  }

  try {
    const signature = request.headers.get("x-webhook-signature");
    const provider = getBillingProvider();
    const event = await provider.parseWebhook(payload, signature);

    // A real provider maps `event` → prisma.user.update (plan fields).
    // Until then, nothing to apply.
    return NextResponse.json({ received: true, handled: event !== null });
  } catch (err) {
    console.error("Billing webhook failed:", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

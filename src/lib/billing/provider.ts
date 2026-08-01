/**
 * LILLIE — Billing provider abstraction
 *
 * The ONLY file that knows about payment providers. Feature code never
 * imports a provider SDK — it calls this module and receives a
 * `BillingProvider` that implements the interface below.
 *
 * ── Why provider-independent ────────────────────────────────────
 * The founder is based in Uzbekistan, where Stripe is not reliably
 * available. By keeping every provider behind this interface, a provider
 * that works locally (Lemon Squeezy, Paddle, Paystack-style gateways,
 * etc.) can be plugged in by implementing 5 methods — no feature code
 * changes, no hardcoded `if (stripePayment === true)` anywhere.
 *
 * ── Current state ───────────────────────────────────────────────
 * No provider is wired yet. `getBillingProvider()` returns the Noop
 * provider (checkout/webhook return 503/501) until `BILLING_PROVIDER`
 * is set AND a provider implementation is registered below.
 *
 * ── Provider responsibilities ───────────────────────────────────
 * A real implementation must translate its own product/session/webhook
 * concepts into the canonical `plan` string + `PlanStatus` lifecycle —
 * never the other way around.
 */

export interface CheckoutRequest {
  /** Which plan to subscribe to ("pro" | "premium"). */
  planId: string;
  userId: string;
  email?: string | null;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  /** URL to redirect the user to (provider-hosted checkout). */
  url: string;
  /** Provider checkout session id (for status polling). */
  sessionId: string;
}

export interface BillingEvent {
  /** The provider's event type (e.g. "checkout.session.completed"). */
  type: string;
  /**
   * Provider-specific payload. A real implementation maps this to the
   * canonical `plan`/`status` fields and calls the provided handlers.
   */
  raw: unknown;
}

export interface BillingProvider {
  /** Stable id, e.g. "stripe" | "lemon_squeezy" | "none". */
  readonly id: string;
  /** Returns true when this provider is fully configured. */
  isConfigured(): boolean;
  /** Create a checkout session for the given plan. */
  createCheckoutSession(req: CheckoutRequest): Promise<CheckoutResult>;
  /** Cancel the current subscription. */
  cancelSubscription(subscriptionId: string): Promise<void>;
  /**
   * Verify + parse a webhook payload. Throws on invalid signature.
   * Returns the normalized event (or null when the event is unrelated,
   * e.g. a ping).
   */
  parseWebhook(
    payload: string,
    signature: string | null
  ): Promise<BillingEvent | null>;
}

/** Thrown when no billing provider is configured. */
export class BillingNotConfiguredError extends Error {
  constructor() {
    super("Billing is not configured. Set BILLING_PROVIDER and its credentials.");
    this.name = "BillingNotConfiguredError";
  }
}

/**
 * Default provider: no payments. Checkout → 503 (via the error), webhook
 * → returns null (unrelated event). Lets the app ship without a provider
 * while the API surface stays stable.
 */
export const noopBillingProvider: BillingProvider = {
  id: "none",
  isConfigured: () => false,
  async createCheckoutSession() {
    throw new BillingNotConfiguredError();
  },
  async cancelSubscription() {
    throw new BillingNotConfiguredError();
  },
  async parseWebhook() {
    // Without a provider there is nothing to verify; treat as unrelated.
    return null;
  },
};

/** Registered provider implementations (empty until a provider is wired). */
const PROVIDERS: Record<string, BillingProvider> = {};

/**
 * Returns the configured billing provider, or the noop provider when none
 * is configured. Safe to call on every request (cheap object lookup).
 */
export function getBillingProvider(): BillingProvider {
  const name = process.env.BILLING_PROVIDER;
  if (name && name in PROVIDERS) return PROVIDERS[name];
  return noopBillingProvider;
}

/**
 * Registers a provider implementation. Called once at module load of a
 * provider module (e.g. a future `src/lib/billing/stripe.ts`).
 */
export function registerBillingProvider(provider: BillingProvider): void {
  PROVIDERS[provider.id] = provider;
}

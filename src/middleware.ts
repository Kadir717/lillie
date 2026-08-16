import { NextRequest, NextResponse } from "next/server";
import { InMemoryRateLimiter } from "@/lib/rate-limit";

/**
 * Lightweight API rate limiting middleware.
 *
 * Protects every `/api/*` route with per-IP sliding-window limits:
 *   - `/api/auth/*` and `/api/recruiter-auth/*` → 20 req/min  (brute-force protection)
 *   - `/api/generate-cv`      → 10 req/min  (heavy: ~35 upstream GitHub calls)
 *   - everything else `/api/*` → 60 req/min
 *
 * Exceeded limits return HTTP 429 with a JSON error and `Retry-After`.
 *
 * ── Limitations (documented) ─────────────────────────────────────
 * Counters are in-memory per server instance / edge isolate. On
 * multi-instance deploys (Vercel serverless / edge) this is best-effort,
 * not a global quota. A Redis-backed limiter is the future upgrade path
 * (see src/lib/rate-limit.ts). Local `npm run dev` uses a single
 * instance, so limits are exact there.
 *
 * ── Why middleware instead of per-route code ─────────────────────
 * One file covers all current and future routes. Individual handlers
 * stay clean and cannot forget to rate-limit.
 */

const AUTH_LIMITER = new InMemoryRateLimiter(20, 60_000);
const GENERATE_LIMITER = new InMemoryRateLimiter(10, 60_000);
const AI_LIMITER = new InMemoryRateLimiter(10, 60_000); // LLM calls cost money
const INTERVIEW_LIMITER = new InMemoryRateLimiter(20, 60_000); // each call hits GitHub
const PORTFOLIO_LIMITER = new InMemoryRateLimiter(20, 60_000); // each call hits GitHub
// /api/billing/* → 20 req/min (checkout/webhook abuse protection).
// NOTE: when a real payment provider is wired, its webhooks arrive from
// shared provider IPs across many users and could trip this limiter —
// exempt the webhook path (/api/billing/webhook) at that point.
const BILLING_LIMITER = new InMemoryRateLimiter(20, 60_000);
const DEFAULT_LIMITER = new InMemoryRateLimiter(60, 60_000);

/**
 * Best-effort client IP detection. Works behind common proxies (Vercel,
 * NGINX) via x-forwarded-for; falls back to x-real-ip, then a constant
 * for localhost. Never trust the header blindly — it is only a limiter
 * key, not a security boundary.
 */
function getClientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "local";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/api/")) return NextResponse.next();

  let limiter = DEFAULT_LIMITER;
  if (pathname.startsWith("/api/auth/") || pathname.startsWith("/api/recruiter-auth/"))
    limiter = AUTH_LIMITER;
  else if (pathname === "/api/generate-cv") limiter = GENERATE_LIMITER;
  else if (pathname.startsWith("/api/ai/")) limiter = AI_LIMITER;
  else if (pathname.startsWith("/api/interview/")) limiter = INTERVIEW_LIMITER;
  else if (pathname.startsWith("/api/portfolio/")) limiter = PORTFOLIO_LIMITER;
  else if (pathname.startsWith("/api/billing/")) limiter = BILLING_LIMITER;

  const result = limiter.check(getClientKey(request));

  if (!result.allowed) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((result.resetAt - Date.now()) / 1000)
    );
    return NextResponse.json(
      {
        error: "Too many requests. Please wait a moment and try again.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
          "X-RateLimit-Limit": String(limiter.maxRequests),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};

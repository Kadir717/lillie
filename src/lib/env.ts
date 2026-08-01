/**
 * Server-side environment variable validation.
 *
 * This module MUST only be imported by server code (API routes, server components,
 * server actions). It is NOT safe for client components — browser bundles cannot
 * access process.env at runtime for secret values anyway, but importing this in a
 * client component would cause a build error since we reference NODE_ENV checks
 * that the client bundler may try to inline.
 *
 * Design decision: validate at module-import time (once per server instance) rather
 * than on every request. If a required variable is missing in production, the
 * server process fails fast on first import.
 */

const IS_PRODUCTION = process.env.NODE_ENV === "production";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    if (IS_PRODUCTION) {
      throw new Error(
        `❌ LILLIE: Missing required environment variable "${name}".\n` +
          `   Set it in your Vercel project dashboard or .env file before deploying.`
      );
    }
    console.warn(
      `⚠️  LILLIE: Environment variable "${name}" is not set.\n` +
        `   The app may still work in development, but this MUST be set for production.`
    );
    return "";
  }
  return value;
}

let _validated = false;

/**
 * Call once at app startup to validate critical environment variables.
 * In production, missing variables throw immediately.
 * In development, missing variables log warnings.
 */
export function validateEnv(): void {
  if (_validated) return;
  _validated = true;

  // --- GitHub OAuth (all required) ---
  requireEnv("GITHUB_CLIENT_ID");
  requireEnv("GITHUB_CLIENT_SECRET");
  requireEnv("GITHUB_REDIRECT_URI");

  // --- Session secret (required in production) ---
  if (IS_PRODUCTION && !process.env.SESSION_SECRET) {
    throw new Error(
      `❌ LILLIE: SESSION_SECRET is not set and is required in production.\n` +
        `   Generate one: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"\n` +
        `   Then add SESSION_SECRET to your Vercel environment variables.`
    );
  }

  // --- Not required, but warn if missing ---
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    console.warn(
      "⚠️  LILLIE: NEXT_PUBLIC_APP_URL is not set. Redirect URLs may be incorrect.\n" +
        "   Set it to your production domain (e.g. https://lillie.dev)."
    );
  }

  // --- AI services (optional — the AI layer degrades to 503) ---
  if (!process.env.AI_API_KEY) {
    console.warn(
      "⚠️  LILLIE: AI_API_KEY is not set. /api/ai/* endpoints will return 503.\n" +
        "   Set AI_API_KEY (and optionally AI_PROVIDER/AI_MODEL/AI_BASE_URL) to enable AI tools."
    );
  }
}

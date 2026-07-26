/**
 * Authentication and session management for LILLIE.
 *
 * ── Architecture Decisions ──────────────────────────────────────
 *
 * 1. Stateless JWT sessions (no database session store)
 *    At LILLIE's current scale, server-side session storage (Redis, DB) is
 *    unnecessary overhead. Signed JWTs stored in httpOnly cookies provide
 *    secure, stateless authentication. The trade-off: individual sessions
 *    cannot be revoked server-side — only the client cookie or the signing
 *    secret rotation invalidates them.
 *
 *    If revocation becomes necessary in the future, the signing secret can
 *    be rotated (invalidating all sessions, requiring re-login) or a
 *    server-side session store can be introduced at that point.
 *
 * 2. GitHub access token in JWT payload
 *    The JWT contains the user's GitHub access token so server-side code
 *    (API routes, server components) can make authenticated GitHub API
 *    calls without a separate database lookup. The token is scoped to
 *    read-only public data (read:user, public_repo).
 *
 *    SECURITY: The token is stored in an httpOnly cookie — client-side JS
 *    cannot read it. If the cookie is stolen via XSS or physical access,
 *    the attacker has GitHub access until the session expires (7 days) or
 *    the user logs out. The limited GitHub scope mitigates damage.
 *
 * 3. User identity vs. session
 *    The JWT establishes "who is making this request" but does NOT persist
 *    user data between sessions. User profile data (preferences, etc.) is
 *    stored separately via the database (see src/lib/db.ts). On each login,
 *    the user is upserted from fresh GitHub data.
 *
 * 4. Separate GitHub OAuth from session
 *    The GitHub OAuth state token (lillie_oauth_state) is independent of
 *    the session cookie. The state cookie has a 10-minute TTL and is
 *    deleted after the OAuth callback. The session cookie has a 7-day TTL.
 *
 * ── Environment Variables ──────────────────────────────────────
 *   SESSION_SECRET         — 64-char hex string for signing JWTs (REQUIRED in prod)
 *   GITHUB_CLIENT_ID       — GitHub OAuth App client ID
 *   GITHUB_CLIENT_SECRET   — GitHub OAuth App client secret
 *   GITHUB_REDIRECT_URI    — OAuth callback URL (must match GitHub App config)
 *   NEXT_PUBLIC_APP_URL    — Public root URL for redirects (optional, falls back to request origin)
 *
 * ── Cookie Security ────────────────────────────────────────────
 *   - httpOnly: true      → Not accessible from JS (prevents XSS token theft)
 *   - secure: true        → Sent over HTTPS only (production)
 *   - sameSite: "lax"     → Allows OAuth redirect, blocks cross-site CSRF
 *   - path: "/"           → Available across the app
 *   - maxAge: 7 days      → Session duration
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { validateEnv } from "./env";

// Validate critical env vars at module import time.
// This covers API routes (like login) that import auth.ts but not db.ts.
validateEnv();

const SESSION_COOKIE = "lillie_session";

/**
 * Returns the signing secret for JWT tokens.
 *
 * In production: SESSION_SECRET is required — missing it throws immediately.
 * In development: a deterministic fallback is acceptable for local testing.
 *
 * This is a function (not a const) so the environment variable is read
 * lazily — the module can be imported without crashing if the env var
 * hasn't been set yet, as long as the function is only called at runtime
 * when the app has loaded its environment.
 */
function getSigningSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_SECRET is required in production.\n" +
          "Generate one: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"\n" +
          "Then add it to your Vercel environment variables."
      );
    }
    console.warn(
      "⚠️  LILLIE: SESSION_SECRET not set. Using dev-only fallback.\n" +
        "   This is INSECURE for production. Set SESSION_SECRET in your .env.local file."
    );
    return new TextEncoder().encode("dev-only-insecure-secret-change-me");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Session payload stored inside the JWT.
 *
 * NOTE: The GitHub access token is included here so server-side code
 * can call the GitHub API without a database lookup. This is a design
 * trade-off: the token is exposed if the JWT cookie is stolen, but the
 * cookie is httpOnly (not readable by JS) and the token scope is limited.
 *
 * Future: If we persist the access token in the database (for long-lived
 * background jobs), we can remove it from the JWT payload.
 */
export interface SessionPayload {
  githubAccessToken: string;
  githubUsername: string;
  githubAvatarUrl: string;
  githubId: number;
}

/**
 * Builds the GitHub OAuth authorization URL with CSRF state parameter.
 *
 * Requested scopes:
 *   - read:user    — Read user profile (name, email, avatar, bio, etc.)
 *   - public_repo  — Read public repository metadata (stars, forks, languages)
 *
 * Note: `repo:status` was intentionally removed — it grants commit status
 * access to private repos, which LILLIE does not need. If we add private
 * repo support as a paid tier feature later, we can add it back conditionally.
 */
export function buildGithubAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: process.env.GITHUB_REDIRECT_URI!,
    scope: "read:user public_repo",
    state,
    allow_signup: "true",
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Structured GitHub user data returned from the OAuth callback.
 * Only the fields LILLIE needs — avoids pulling raw `any` data.
 */
export interface GithubUserData {
  login: string;
  name: string | null;
  avatar_url: string;
  id: number;
  email: string | null;
}

/**
 * Exchanges the OAuth `code` for a GitHub access token.
 * Called by the callback route after the user authorizes the app.
 *
 * Throws on network failure, non-ok response, or missing access_token.
 */
export async function exchangeCodeForToken(code: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_REDIRECT_URI,
      }),
    });
  } catch (err) {
    throw new Error(
      `GitHub token exchange network failure: ${(err as Error).message}`
    );
  }

  if (!res.ok) {
    throw new Error(`GitHub token exchange failed: ${res.status}`);
  }

  const data: Record<string, unknown> = await res.json();

  if (data.error) {
    throw new Error(
      `GitHub OAuth error: ${(data.error_description as string) || (data.error as string)}`
    );
  }

  if (typeof data.access_token !== "string" || !data.access_token) {
    throw new Error("GitHub token exchange returned no access token");
  }

  return data.access_token;
}

/**
 * Fetches the authenticated user's basic profile from GitHub.
 * Used during OAuth callback to build the session and upsert the user.
 *
 * Returns a typed GithubUserData instead of raw JSON so callers
 * don't need unsafe `as` casts.
 */
export async function fetchGithubUser(
  accessToken: string
): Promise<GithubUserData> {
  let res: Response;
  try {
    res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  } catch (err) {
    throw new Error(
      `GitHub user fetch network failure: ${(err as Error).message}`
    );
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch GitHub user: ${res.status}`);
  }

  const data: Record<string, unknown> = await res.json();

  return {
    login: data.login as string,
    name: (data.name as string) ?? null,
    avatar_url: data.avatar_url as string,
    id: data.id as number,
    email: (data.email as string) ?? null,
  };
}

/**
 * Creates a signed, httpOnly session cookie containing minimal user identity.
 * The JWT payload includes the GitHub access token for server-side API calls.
 *
 * The token NEVER reaches client-side JavaScript — only server components
 * and route handlers can read it via getSession().
 */
export async function createSession(payload: SessionPayload) {
  const secret = getSigningSecret();
  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

/**
 * Reads and verifies the session cookie, returning the payload or null.
 *
 * - If the JWT is expired or malformed, returns null (not throwing).
 * - Callers should redirect unauthenticated users or return 401.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const secret = getSigningSecret();
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Destroys the session by deleting the cookie on the client.
 *
 * Note: The JWT itself remains valid until its 7-day expiry — the server
 * has no session store to invalidate. Any party holding the cookie value
 * can still use it until expiry. This is a known trade-off of stateless
 * JWT sessions (see architecture note at the top of this file).
 */
export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

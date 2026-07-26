import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { buildGithubAuthorizeUrl } from "@/lib/auth";

/**
 * GET /api/auth/login
 *
 * Initiates GitHub OAuth flow:
 *   1. Generate a CSRF state token
 *   2. Store it in an httpOnly cookie (10-min TTL)
 *   3. Redirect to GitHub authorization page
 *
 * Fails fast with 500 if GitHub OAuth env vars are missing.
 */
export async function GET() {
  // Fail fast if env vars are missing — redirecting to GitHub with a
  // bad client_id would show the user a confusing GitHub error page.
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_REDIRECT_URI) {
    console.error(
      "Missing GITHUB_CLIENT_ID or GITHUB_REDIRECT_URI — cannot start OAuth flow."
    );
    return NextResponse.json(
      { error: "Server configuration error — authentication is unavailable." },
      { status: 500 }
    );
  }

  const state = randomBytes(16).toString("hex");

  const cookieStore = await cookies();
  cookieStore.set("lillie_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10 minutes — just long enough for the OAuth round trip
  });

  return NextResponse.redirect(buildGithubAuthorizeUrl(state));
}

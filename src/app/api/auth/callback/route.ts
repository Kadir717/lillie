import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  exchangeCodeForToken,
  fetchGithubUser,
  createSession,
  type GithubUserData,
} from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/auth/callback
 *
 * Handles the GitHub OAuth callback:
 *   1. Validates CSRF state token
 *   2. Exchanges code for access token
 *   3. Fetches GitHub user profile
 *   4. Creates session (JWT cookie)
 *   5. Upserts user in database (best-effort)
 *
 * Session creation happens BEFORE the DB upsert so login works even
 * if the database is temporarily unavailable.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  if (error) {
    return NextResponse.redirect(`${baseUrl}/?error=github_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/?error=missing_params`);
  }

  // ── CSRF protection ────────────────────────────────────────────
  // Verify the state matches what we set in /api/auth/login
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("lillie_oauth_state")?.value;
  cookieStore.delete("lillie_oauth_state");

  if (!expectedState || expectedState !== state) {
    return NextResponse.redirect(`${baseUrl}/?error=invalid_state`);
  }

  try {
    // ── Exchange code for token ──────────────────────────────────
    const accessToken = await exchangeCodeForToken(code);
    const githubUser: GithubUserData = await fetchGithubUser(accessToken);

    // ── Create session first ─────────────────────────────────────
    // Session is created BEFORE the DB upsert so login succeeds even
    // if the database is temporarily unavailable. The upsert is a
    // best-effort persistence of the user identity.
    await createSession({
      githubAccessToken: accessToken,
      githubUsername: githubUser.login,
      githubAvatarUrl: githubUser.avatar_url,
      githubId: githubUser.id,
    });

    // ── Persist user in database ─────────────────────────────────
    // Upsert by GitHub ID: creates on first login, updates on subsequent.
    // The access token is NOT stored here — it lives in the JWT session.
    // Storing it in the DB would be appropriate for background job access.
    try {
      await prisma.user.upsert({
        where: { githubId: githubUser.id },
        update: {
          login: githubUser.login,
          name: githubUser.name,
          avatarUrl: githubUser.avatar_url,
          email: githubUser.email,
        },
        create: {
          githubId: githubUser.id,
          login: githubUser.login,
          name: githubUser.name,
          avatarUrl: githubUser.avatar_url,
          email: githubUser.email,
        },
      });
    } catch (dbErr) {
      console.error("Failed to persist user (login still succeeded):", dbErr);
    }

    return NextResponse.redirect(`${baseUrl}/dashboard`);
  } catch (err) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(`${baseUrl}/?error=auth_failed`);
  }
}

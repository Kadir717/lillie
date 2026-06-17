import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  exchangeCodeForToken,
  fetchGithubUser,
  createSession,
} from "@/lib/auth";

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

  // CSRF protection: verify the state matches what we set in /api/auth/login
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("lillie_oauth_state")?.value;
  cookieStore.delete("lillie_oauth_state");

  if (!expectedState || expectedState !== state) {
    return NextResponse.redirect(`${baseUrl}/?error=invalid_state`);
  }

  try {
    const accessToken = await exchangeCodeForToken(code);
    const githubUser = await fetchGithubUser(accessToken);

    await createSession({
      githubAccessToken: accessToken,
      githubUsername: githubUser.login,
      githubAvatarUrl: githubUser.avatar_url,
      githubId: githubUser.id,
    });

    return NextResponse.redirect(`${baseUrl}/dashboard`);
  } catch (err) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(`${baseUrl}/?error=auth_failed`);
  }
}

import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

/**
 * POST /api/auth/logout
 *
 * Destroys the session cookie and redirects to the landing page.
 * Errors during session destruction are logged but don't prevent
 * the redirect — the cookie deletion is best-effort.
 */
export async function POST(request: Request) {
  try {
    await destroySession();
  } catch (err) {
    console.error("Session destruction failed (redirecting anyway):", err);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  return NextResponse.redirect(`${baseUrl}/`, { status: 303 });
}

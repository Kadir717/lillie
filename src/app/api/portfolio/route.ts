import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadPortfolioSource } from "@/lib/portfolio/load";
import { buildPortfolioBundle } from "@/lib/portfolio/generator";
import { validateTheme } from "@/lib/portfolio/themes";

/**
 * GET /api/portfolio
 *
 * Returns the full portfolio bundle (bios, about, portfolio content)
 * composed from the shared CvModel + GitHub analytics data.
 *
 * Query params:
 *   ?theme=minimal|developer|bold|elegant|sunrise   (invalid → 400)
 *
 * Responses:
 *   200 — { bundle: { bios, about, portfolio } }
 *   400 — invalid theme
 *   401 — not authenticated
 *   429 — GitHub API rate limited
 *   500 — unexpected failure
 *   502 — GitHub API failure
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const themeId = request.nextUrl.searchParams.get("theme");
  let theme = null;
  if (themeId !== null) {
    theme = validateTheme(themeId);
    if (!theme) {
      return NextResponse.json({ error: "Invalid theme" }, { status: 400 });
    }
  }

  try {
    const source = await loadPortfolioSource(
      session.githubAccessToken,
      session.githubUsername
    );
    const bundle = buildPortfolioBundle(source, theme ?? undefined);

    return NextResponse.json({ bundle });
  } catch (err: unknown) {
    const error = err as Error & { status?: number };
    if (error.name === "GithubAuthError") {
      return NextResponse.json(
        { error: "GitHub authorization failed" },
        { status: 502 }
      );
    }
    if (error.name === "GithubRateLimitError") {
      return NextResponse.json(
        { error: "GitHub API rate limit reached" },
        { status: 429 }
      );
    }
    console.error("Portfolio failed:", err);
    return NextResponse.json(
      { error: "Failed to generate portfolio" },
      { status: 500 }
    );
  }
}

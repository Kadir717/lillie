import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadPortfolioSource } from "@/lib/portfolio/load";
import { generateAbout, generateBioVariants } from "@/lib/portfolio/generator";

/**
 * GET /api/portfolio/bio
 *
 * Returns the bio variants + long-form About copy for the signed-in user.
 * Responses: 200 / 401 / 429 / 500 / 502 (GitHub error mapping).
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const source = await loadPortfolioSource(
      session.githubAccessToken,
      session.githubUsername
    );

    return NextResponse.json({
      bios: generateBioVariants(source),
      about: generateAbout(source),
    });
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
    console.error("Portfolio bio failed:", err);
    return NextResponse.json(
      { error: "Failed to generate bio" },
      { status: 500 }
    );
  }
}

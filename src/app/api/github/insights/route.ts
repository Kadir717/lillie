import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchGithubAggregate } from "@/lib/github";
import { computeGithubAnalytics, fetchTopReadmes } from "@/lib/github-analytics";

/**
 * GET /api/github/insights
 *
 * Returns extended GitHub analytics derived from the aggregate data
 * already fetched for the CV (plus README content for the top repos).
 * Computed server-side via the shared `computeGithubAnalytics` module —
 * the same code path the dashboard uses, so there is no duplicated
 * computation logic to keep in sync.
 *
 * Responses:
 *   200 — { insights: GithubAnalyticsData }
 *   401 — not authenticated
 *   429 — GitHub API rate limited
 *   500 — unexpected failure
 *   502 — GitHub API failure
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const data = await fetchGithubAggregate(
      session.githubAccessToken,
      session.githubUsername
    );

    // README content for the top repos (degraded to null on 404/failure).
    const readmes = await fetchTopReadmes(
      session.githubAccessToken,
      session.githubUsername,
      data.topRepos
    );

    const insights = computeGithubAnalytics(data, readmes);

    return NextResponse.json({ insights });
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
    console.error("GitHub insights failed:", err);
    return NextResponse.json(
      { error: "Failed to load GitHub insights" },
      { status: 500 }
    );
  }
}

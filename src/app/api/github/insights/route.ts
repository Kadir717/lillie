import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchGithubAggregate } from "@/lib/github";

/**
 * GET /api/github/insights
 *
 * Returns extended GitHub statistics derived from the aggregate data
 * already fetched for the CV. These are computed server-side and
 * returned as a separate payload so the dashboard can display them
 * without re-fetching the full CvModel.
 *
 * Responses:
 *   200 — { insights: GithubInsights }
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

    const { profile, topRepos, languages, totalStars, totalForks } = data;

    // ── Contribution summary ──────────────────────────────────────
    const contributionSummary = {
      totalRepos: profile.publicRepos,
      totalStars,
      totalForks,
      yearsActive: data.contributionYears,
    };

    // ── Repository health ─────────────────────────────────────────
    // Note: topRepos is already filtered to non-forks in fetchGithubAggregate,
    // so forked count is not computed here. The full repo list would be
    // needed for an accurate fork ratio.
    const starredRepos = topRepos.filter((r) => r.stargazersCount > 0).length;
    const avgStars =
      topRepos.length > 0
        ? Math.round(totalStars / topRepos.length)
        : 0;
    const repoHealth = {
      starredRepos,
      avgStars,
      recentlyActive:
        topRepos.filter(
          (r) =>
            new Date(r.pushedAt).getTime() >
            Date.now() - 365 * 24 * 60 * 60 * 1000
        ).length,
    };

    // ── Language distribution ─────────────────────────────────────
    const totalBytes = Object.values(languages).reduce((a, b) => a + b, 0);
    const languageDistribution = Object.entries(languages)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, bytes]) => ({
        name,
        bytes,
        percent: totalBytes > 0 ? Math.round((bytes / totalBytes) * 100) : 0,
      }));

    // ── Project maturity ──────────────────────────────────────────
    const now = Date.now();
    const yearMs = 365 * 24 * 60 * 60 * 1000;
    const projectMaturity = {
      total: topRepos.length,
      recent: topRepos.filter(
        (r) => new Date(r.pushedAt).getTime() > now - yearMs
      ).length,
      stale: topRepos.filter(
        (r) =>
          new Date(r.pushedAt).getTime() < now - 2 * yearMs
      ).length,
      mostRecentUpdate:
        topRepos.length > 0
          ? topRepos.sort(
              (a, b) =>
                new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime()
            )[0].pushedAt
          : null,
    };

    return NextResponse.json({
      insights: {
        contributionSummary,
        repoHealth,
        languageDistribution,
        projectMaturity,
      },
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
    console.error("GitHub insights failed:", err);
    return NextResponse.json(
      { error: "Failed to load GitHub insights" },
      { status: 500 }
    );
  }
}

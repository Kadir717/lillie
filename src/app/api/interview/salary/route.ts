import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchGithubAggregate } from "@/lib/github";
import { estimateSalary } from "@/lib/interview/salary";

/** Role families supported by the estimator (fall back to software_engineer). */
const SUPPORTED_ROLES = [
  "software_engineer",
  "frontend",
  "backend",
  "fullstack",
  "devops",
  "data_scientist",
  "mobile",
  "intern",
] as const;

/**
 * GET /api/interview/salary
 *
 * Returns an indicative annual USD salary range based on role, GitHub
 * contribution years, and the profile's location signal. Deterministic —
 * a guide, not a quote (disclaimer included).
 *
 * Query params:
 *   role — one of: software_engineer, frontend, backend, fullstack,
 *          devops, data_scientist, mobile, intern (default software_engineer)
 *
 * Responses:
 *   200 — { estimate: SalaryEstimate }
 *   400 — invalid role
 *   401 — not authenticated
 *   429 — GitHub API rate limited
 *   502 — GitHub API failure
 *   500 — unexpected failure
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rawRole = request.nextUrl.searchParams.get("role")?.trim() || "software_engineer";
  if (!SUPPORTED_ROLES.includes(rawRole as (typeof SUPPORTED_ROLES)[number])) {
    return NextResponse.json(
      { error: `Invalid role. Supported: ${SUPPORTED_ROLES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const data = await fetchGithubAggregate(
      session.githubAccessToken,
      session.githubUsername
    );

    const estimate = estimateSalary(
      rawRole,
      data.contributionYears,
      data.profile
    );

    return NextResponse.json({ estimate });
  } catch (err: unknown) {
    const error = err as Error & { status?: number };
    if (error.name === "GithubAuthError") {
      return NextResponse.json(
        { error: "GitHub authorization failed — your session may have expired." },
        { status: 502 }
      );
    }
    if (error.name === "GithubRateLimitError") {
      return NextResponse.json(
        { error: "GitHub API rate limit reached. Please wait a few minutes and try again." },
        { status: 429 }
      );
    }
    if (error.name === "GithubApiError") {
      return NextResponse.json(
        { error: "GitHub API is temporarily unavailable." },
        { status: 502 }
      );
    }
    console.error("Salary estimation failed:", err);
    return NextResponse.json({ error: "Failed to estimate salary" }, { status: 500 });
  }
}

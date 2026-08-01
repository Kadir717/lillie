import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchGithubAggregate } from "@/lib/github";
import { mapGithubToCvModel } from "@/lib/cv-model";
import { computeGithubAnalytics } from "@/lib/github-analytics";
import { generateQuestions } from "@/lib/interview/questions";
import { buildMockSession } from "@/lib/interview/feedback";

/**
 * GET /api/interview/mock
 *
 * Assembles a full mock-interview session (questions + instructions +
 * pacing) tailored to the user's GitHub profile.
 *
 * Query params:
 *   role — optional role hint (e.g. "software_engineer")
 *   count — optional question count (default 10, capped at 12)
 *
 * Responses:
 *   200 — { session: MockSession }
 *   400 — invalid count
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

  const rawRole = request.nextUrl.searchParams.get("role")?.trim() || undefined;
  const rawCount = request.nextUrl.searchParams.get("count");
  let count = 10;
  if (rawCount) {
    const parsed = Number(rawCount);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
      return NextResponse.json(
        { error: "count must be an integer between 1 and 12" },
        { status: 400 }
      );
    }
    count = parsed;
  }

  try {
    const data = await fetchGithubAggregate(
      session.githubAccessToken,
      session.githubUsername
    );
    const model = mapGithubToCvModel(data);
    const analytics = computeGithubAnalytics(data);

    const role = rawRole ?? "software_engineer";
    const questions = generateQuestions(model, analytics, role).slice(0, count);
    const session_ = buildMockSession(role, questions);

    return NextResponse.json({ session: session_ });
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
    console.error("Mock interview generation failed:", err);
    return NextResponse.json({ error: "Failed to create mock interview" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchGithubAggregate } from "@/lib/github";
import { mapGithubToCvModel } from "@/lib/cv-model";
import { computeGithubAnalytics } from "@/lib/github-analytics";
import { generateQuestions } from "@/lib/interview/questions";

/**
 * GET /api/interview/questions
 *
 * Generates a tailored interview question set from the user's GitHub
 * profile: skills (from analytics), top languages, and optional role.
 * Deterministic — no AI.
 *
 * Query params:
 *   role — optional role hint (e.g. "software_engineer", "senior")
 *   count — optional max questions (default 10, capped at 12)
 *
 * Responses:
 *   200 — { questions: InterviewQuestion[], role }
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

    const all = generateQuestions(model, analytics, rawRole);
    const questions = all.slice(0, count);

    return NextResponse.json({ questions, role: rawRole ?? null });
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
    console.error("Question generation failed:", err);
    return NextResponse.json({ error: "Failed to generate questions" }, { status: 500 });
  }
}

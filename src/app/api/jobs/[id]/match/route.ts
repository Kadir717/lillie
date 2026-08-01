import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchGithubAggregate } from "@/lib/github";
import { mapGithubToCvModel } from "@/lib/cv-model";
import { analyzeJob } from "@/lib/jobs/analyze";
import type { JobMatchResult } from "@/lib/jobs/types";

/**
 * GET /api/jobs/[id]/match
 *
 * Computes the full job analysis (keywords, match score, ATS optimization,
 * resume optimization, internship mode, cover letter) against the user's
 * live GitHub data, and caches it on the Job row so the list/detail views
 * can show scores without recomputing.
 *
 * Responses:
 *   200 — { analysis: JobAnalysis, matchScore: number }
 *   401 — not authenticated
 *   404 — job not found or not owned
 *   429 — GitHub API rate limited
 *   502 — GitHub API failure
 *   500 — unexpected failure
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const user = await prisma.user.findUnique({
      where: { githubId: session.githubId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const job = await prisma.job.findFirst({ where: { id, userId: user.id } });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // ── Fetch GitHub data once, derive the CvModel ───────────────
    const githubData = await fetchGithubAggregate(
      session.githubAccessToken,
      session.githubUsername
    );
    const model = mapGithubToCvModel(githubData);

    const analysis = analyzeJob(
      model,
      job.company,
      job.title,
      job.description ?? undefined,
      job.url ?? undefined
    );

    // ── Cache the score + snapshot for the list/detail views ─────
    const matchSnapshot: JobMatchResult = analysis.match;
    await prisma.job.update({
      where: { id },
      data: { matchScore: matchSnapshot.score, matchJson: analysis as unknown as object },
    });

    return NextResponse.json({
      analysis,
      matchScore: matchSnapshot.score,
    });
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
    console.error("Job match failed:", err);
    return NextResponse.json({ error: "Failed to analyze job" }, { status: 500 });
  }
}

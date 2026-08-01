import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchGithubAggregate } from "@/lib/github";
import { mapGithubToCvModel } from "@/lib/cv-model";
import { optimizeResumeForJob, internshipMode } from "@/lib/jobs/analyze";
import { extractCompanyKeywords } from "@/lib/jobs/keywords";

/**
 * GET /api/jobs/[id]/resume
 *
 * Returns a job-optimized CvModel (projects re-ranked, languages re-ordered
 * to match the posting) ready for the existing preview/DOCX renderers.
 *
 * Query params:
 *   mode — "standard" (default) | "internship"
 *
 * Responses:
 *   200 — { model: CvModel, suggestions: string[], mode }
 *   401 — not authenticated
 *   404 — job not found or not owned
 *   429 — GitHub API rate limited
 *   502 — GitHub API failure
 *   500 — unexpected failure
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const mode = request.nextUrl.searchParams.get("mode");
  if (mode !== null && mode !== "standard" && mode !== "internship") {
    return NextResponse.json(
      { error: "Invalid mode. Supported: standard, internship" },
      { status: 400 }
    );
  }

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

    const githubData = await fetchGithubAggregate(
      session.githubAccessToken,
      session.githubUsername
    );
    const baseModel = mapGithubToCvModel(githubData);

    if (mode === "internship") {
      const result = internshipMode(baseModel);
      return NextResponse.json({ model: result.model, suggestions: result.suggestions, mode: "internship" });
    }

    const keywords = extractCompanyKeywords(job.description ?? "");
    const result = optimizeResumeForJob(baseModel, keywords);
    return NextResponse.json({ model: result.model, suggestions: result.suggestions, mode: "standard" });
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
    console.error("Job resume optimization failed:", err);
    return NextResponse.json({ error: "Failed to optimize resume" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchGithubAggregate } from "@/lib/github";
import { mapGithubToCvModel } from "@/lib/cv-model";
import { generateCoverLetter } from "@/lib/jobs/analyze";

/**
 * GET /api/jobs/[id]/cover-letter
 *
 * Generates a deterministic, template-based cover letter for the job
 * from the user's live GitHub profile. The AI layer is intentionally NOT
 * used — this is rule-based and explainable; an AI version can supersede
 * it later behind the same output contract.
 *
 * Responses:
 *   200 — { coverLetter: CoverLetter }
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

    const githubData = await fetchGithubAggregate(
      session.githubAccessToken,
      session.githubUsername
    );
    const model = mapGithubToCvModel(githubData);

    const coverLetter = generateCoverLetter(
      model,
      job.company,
      job.title,
      job.url ?? undefined
    );

    return NextResponse.json({ coverLetter });
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
    console.error("Cover letter generation failed:", err);
    return NextResponse.json({ error: "Failed to generate cover letter" }, { status: 500 });
  }
}

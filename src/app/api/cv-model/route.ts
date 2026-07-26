import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchGithubAggregate } from "@/lib/github";
import { mapGithubToCvModel } from "@/lib/cv-model";

/**
 * GET /api/cv-model
 *
 * Returns the CvModel (the same intermediate representation used by the
 * DOCX renderer) as plain JSON. Locale and template are NOT applied here —
 * CvModel is locale/template-agnostic by design. The client picks locale/
 * template and re-renders instantly via <CvPreview>, with zero extra
 * network round-trips per selector change.
 *
 * Responses:
 *   200 — { model: CvModel }
 *   401 — not authenticated
 *   429 — GitHub API rate limited
 *   500 — unexpected internal failure
 *   502 — GitHub API failure (auth or upstream error)
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
    const model = mapGithubToCvModel(data);
    return NextResponse.json({ model });
  } catch (err: unknown) {
    const error = err as Error & { status?: number };

    // GitHub upstream errors
    if (error.name === "GithubAuthError") {
      return NextResponse.json(
        {
          error:
            "GitHub authorization failed — your session may have expired. Try signing out and back in.",
        },
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
        { error: "GitHub API is temporarily unavailable. Please try again." },
        { status: 502 }
      );
    }

    // Unexpected internal error
    console.error("CV model fetch failed:", error);
    return NextResponse.json({ error: "Failed to load CV data" }, { status: 500 });
  }
}

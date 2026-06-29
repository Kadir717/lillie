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
 */
export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const data = await fetchGithubAggregate(session.githubAccessToken, session.githubUsername);
    const model = mapGithubToCvModel(data);
    return NextResponse.json({ model });
  } catch (err) {
    console.error("CV model fetch failed:", err);
    return NextResponse.json({ error: "Failed to load CV data" }, { status: 500 });
  }
}

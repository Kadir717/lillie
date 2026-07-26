import { NextRequest, NextResponse } from "next/server";
import { Packer } from "docx";
import { getSession } from "@/lib/auth";
import { fetchGithubAggregate } from "@/lib/github";
import { buildCvDocument } from "@/lib/cv-builder";
import { templates } from "@/lib/templates";
import { validateLocale, validateTemplate } from "@/lib/validate";
import type { CvLocale } from "@/lib/cv-strings";

/**
 * GET /api/generate-cv
 *
 * Generates and downloads a .docx CV from the user's GitHub data.
 *
 * Query params:
 *   locale    — locale code (default "en", validated against allowed set)
 *   template  — template ID (default "classic_professional", validated)
 *
 * Responses:
 *   200 — .docx file stream
 *   400 — invalid locale or template
 *   401 — not authenticated
 *   429 — GitHub API rate limited
 *   500 — unexpected generation failure
 *   502 — GitHub API failure (auth or upstream error)
 */
export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  // ── Validate query params ──────────────────────────────────────
  const rawLocale = request.nextUrl.searchParams.get("locale");
  const rawTemplate = request.nextUrl.searchParams.get("template");

  // Declare with `let` so TypeScript can narrow through if/else control flow.
  // Ternary + const would leave `CvLocale | null` as the inferred type even
  // after the validation guard below.
  let locale: CvLocale;
  if (rawLocale) {
    const validated = validateLocale(rawLocale);
    if (!validated) {
      return NextResponse.json(
        {
          error: `Invalid locale: "${rawLocale}". Supported: en, tr, de, fr, es, pt, ja, ko, zh, ru, ar`,
        },
        { status: 400 }
      );
    }
    locale = validated;
  } else {
    locale = "en";
  }

  let templateId: string;
  if (rawTemplate) {
    const validated = validateTemplate(rawTemplate);
    if (!validated) {
      return NextResponse.json(
        {
          error: `Invalid template: "${rawTemplate}". Supported: classic_professional, developer_card`,
        },
        { status: 400 }
      );
    }
    templateId = validated;
  } else {
    templateId = "classic_professional";
  }

  const template = templates[templateId as keyof typeof templates] ?? templates.classic_professional;

  try {
    // ── Fetch & build ────────────────────────────────────────────
    const data = await fetchGithubAggregate(
      session.githubAccessToken,
      session.githubUsername
    );

    const doc = buildCvDocument(data, locale, template);
    const buffer = await Packer.toBuffer(doc);

    // ── Stream the .docx ─────────────────────────────────────────
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${session.githubUsername}-cv.docx"`,
      },
    });
  } catch (err: unknown) {
    const error = err as Error & { status?: number };

    // GitHub upstream errors
    if (error.name === "GithubAuthError") {
      return NextResponse.json(
        { error: "GitHub authorization failed — your session may have expired. Try signing out and back in." },
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
    console.error("CV generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate CV" },
      { status: 500 }
    );
  }
}

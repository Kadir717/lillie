import { NextRequest, NextResponse } from "next/server";
import { Packer } from "docx";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchGithubAggregate } from "@/lib/github";
import { mapGithubToCvModel } from "@/lib/cv-model";
import { buildCvDocumentFromModel } from "@/lib/cv-builder";
import { templates } from "@/lib/templates";
import { validateLocale, validateTemplate } from "@/lib/validate";
import { optimizeResumeForJob, internshipMode } from "@/lib/jobs/analyze";
import { extractCompanyKeywords } from "@/lib/jobs/keywords";
import type { CvLocale } from "@/lib/cv-strings";

/**
 * GET /api/jobs/[id]/resume/download
 *
 * Downloads a .docx resume optimized for a specific job. Reuses the SAME
 * render engine as the normal CV (`buildCvDocumentFromModel`) — only the
 * CvModel differs (job-optimized ordering), so there is no duplicated
 * generation logic.
 *
 * Query params:
 *   mode      — "standard" (default) | "internship"
 *   locale    — locale code (default "en", validated)
 *   template  — template ID (default "classic_professional", validated)
 *
 * Responses:
 *   200 — .docx file stream
 *   400 — invalid mode/locale/template
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

  // ── Validate query params ──────────────────────────────────────
  const mode = request.nextUrl.searchParams.get("mode");
  if (mode !== null && mode !== "standard" && mode !== "internship") {
    return NextResponse.json(
      { error: "Invalid mode. Supported: standard, internship" },
      { status: 400 }
    );
  }

  let locale: CvLocale;
  const rawLocale = request.nextUrl.searchParams.get("locale");
  if (rawLocale) {
    const validated = validateLocale(rawLocale);
    if (!validated) {
      return NextResponse.json(
        { error: `Invalid locale: "${rawLocale}". Supported: en, tr, de, fr, es, pt, ja, ko, zh, ru, ar` },
        { status: 400 }
      );
    }
    locale = validated;
  } else {
    locale = "en";
  }

  let templateId: string;
  const rawTemplate = request.nextUrl.searchParams.get("template");
  if (rawTemplate) {
    const validated = validateTemplate(rawTemplate);
    if (!validated) {
      return NextResponse.json(
        { error: `Invalid template: "${rawTemplate}". Supported: classic_professional, developer_card, minimal` },
        { status: 400 }
      );
    }
    templateId = validated;
  } else {
    templateId = "classic_professional";
  }

  const template = templates[templateId as keyof typeof templates] ?? templates.classic_professional;

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

    // ── Build the job-optimized model ────────────────────────────
    const githubData = await fetchGithubAggregate(
      session.githubAccessToken,
      session.githubUsername
    );
    const baseModel = mapGithubToCvModel(githubData);

    const model =
      mode === "internship"
        ? internshipMode(baseModel).model
        : optimizeResumeForJob(baseModel, extractCompanyKeywords(job.description ?? "")).model;

    // ── Render via the SHARED engine ─────────────────────────────
    const doc = buildCvDocumentFromModel(model, locale, template);
    const buffer = await Packer.toBuffer(doc);

    const safeCompany = job.company.replace(/[^a-zA-Z0-9-_]+/g, "-").toLowerCase();
    const filename = `${session.githubUsername}-${safeCompany}-resume.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
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
    console.error("Job resume download failed:", err);
    return NextResponse.json({ error: "Failed to generate resume" }, { status: 500 });
  }
}

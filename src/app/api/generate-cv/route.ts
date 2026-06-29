import { NextRequest, NextResponse } from "next/server";
import { Packer } from "docx";
import { getSession } from "@/lib/auth";
import { fetchGithubAggregate } from "@/lib/github";
import { buildCvDocument } from "@/lib/cv-builder";
import { templates } from "@/lib/templates";
import type { CvLocale } from "@/lib/cv-strings";

export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  try {
    // -------------------------
    // QUERY PARAMS
    // -------------------------
    const locale =
      (request.nextUrl.searchParams.get("locale") as CvLocale) || "en";

    const templateId =
      request.nextUrl.searchParams.get("template") || "classic_professional";

    const template =
      templates[templateId as keyof typeof templates] ??
      templates.classic_professional;

    // -------------------------
    // DATA FETCH
    // -------------------------
    const data = await fetchGithubAggregate(
      session.githubAccessToken,
      session.githubUsername
    );

    // -------------------------
    // BUILD CV
    // -------------------------
    const doc = buildCvDocument(data, locale, template);
    const buffer = await Packer.toBuffer(doc);

    // -------------------------
    // RESPONSE
    // -------------------------
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${session.githubUsername}-cv.docx"`,
      },
    });
  } catch (err) {
    console.error("CV generation failed:", err);

    return NextResponse.json(
      { error: "Failed to generate CV" },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { Packer } from "docx";
import { getSession } from "@/lib/auth";
import { fetchGithubAggregate } from "@/lib/github";
import { buildCvDocument, type CvLocale } from "@/lib/cv-builder";

export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const locale = (request.nextUrl.searchParams.get("locale") as CvLocale) || "en";

  try {
    const data = await fetchGithubAggregate(session.githubAccessToken, session.githubUsername);
    const doc = buildCvDocument(data, locale);
    const buffer = await Packer.toBuffer(doc);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${session.githubUsername}-cv.docx"`,
      },
    });
  } catch (err) {
    console.error("CV generation failed:", err);
    return NextResponse.json({ error: "Failed to generate CV" }, { status: 500 });
  }
}

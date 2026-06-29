import { NextRequest, NextResponse } from "next/server";
import { Packer } from "docx";
import mammoth from "mammoth";
import { getSession } from "@/lib/auth";
import { fetchGithubAggregate } from "@/lib/github";
import { buildCvDocument } from "@/lib/cv-builder";
import { templates } from "@/lib/templates";
import type { CvLocale } from "@/lib/cv-strings";

export async function GET(request: NextRequest) {
    const session = await getSession();

    if (!session) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    try {
        const locale = (request.nextUrl.searchParams.get("locale") as CvLocale) || "en";
        const templateId = request.nextUrl.searchParams.get("template") || "classic_professional";
        const template = templates[templateId as keyof typeof templates] ?? templates.classic_professional;

        const data = await fetchGithubAggregate(session.githubAccessToken, session.githubUsername);

        const doc = buildCvDocument(data, locale, template);
        const buffer = await Packer.toBuffer(doc);

        // Convert the generated docx buffer directly to HTML for live preview.
        // This guarantees the preview matches the real downloadable file,
        // since it's the exact same buffer mammoth is reading.
        const { value: html } = await mammoth.convertToHtml({ buffer });

        return NextResponse.json({ html });
    } catch (err) {
        console.error("CV preview generation failed:", err);
        return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 });
    }
}
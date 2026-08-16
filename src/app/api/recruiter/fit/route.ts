import { NextRequest, NextResponse } from "next/server";
import { getRecruiterSession } from "@/lib/recruiter-auth";
import { recruiterFit } from "@/lib/ai/services";
import { isAiConfigured } from "@/lib/ai/provider";
import { MAX_CV_TEXT_CHARS } from "@/lib/cv-parse";
import {
  AiError,
  AiInputError,
  AiNotConfiguredError,
  AiParseError,
  AiProviderError,
} from "@/lib/ai/errors";

/**
 * POST /api/recruiter/fit
 *
 * Recruiter-side AI: takes the raw text of a candidate's uploaded CV
 * (extracted by Sprint B's /api/recruiter/cv-parse) plus a job description
 * and returns tailored application advice — fitScore, matchedStrengths,
 * gaps, talkingPoints, coverNote (the same TailorResult shape the
 * candidate-side `tailor` tool produces, via the same buildTailorPrompt).
 *
 *   Body: { cvText: string, jobDescription: string, locale?: string }
 *
 * Deliberately NO result cache and NO database writes: the candidate is a
 * third party with no LILLIE account, so every conversation is ephemeral
 * (privacy by default). The only trimming applied is the shared
 * MAX_CV_TEXT_CHARS cap before the text reaches the AI prompt.
 *
 * Responses:
 *   200 — { ok: true, result: TailorResult }
 *   400 — invalid JSON body / missing cvText or jobDescription
 *   401 — not authenticated (recruiter session required)
 *   429 — AI provider rate limited (shared Gemini quota)
 *   502 — AI provider or parse failure
 *   503 — AI not configured (AI_API_KEY missing)
 *   500 — unexpected failure
 */
export async function POST(request: NextRequest) {
  // ── Auth: recruiter session (NOT the GitHub OAuth user session) ──
  const session = await getRecruiterSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // ── Parse + shape the body ───────────────────────────────────────
  let body: { cvText?: unknown; jobDescription?: unknown; locale?: unknown };
  try {
    const parsed = await request.json();
    if (typeof parsed !== "object" || parsed === null) {
      return NextResponse.json(
        { error: "Request body must be a JSON object" },
        { status: 400 }
      );
    }
    body = parsed as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const cvText =
    typeof body.cvText === "string" ? body.cvText.trim() : "";
  const jobDescription =
    typeof body.jobDescription === "string" ? body.jobDescription.trim() : "";
  const locale =
    typeof body.locale === "string" && body.locale.trim() ? body.locale : undefined;

  // Cap the CV text at the same limit used by the CV parser — the text
  // goes straight into the AI prompt, so this bounds prompt cost / abuse.
  const trimmedCv = cvText.slice(0, MAX_CV_TEXT_CHARS);

  // Fail fast before any provider round-trip: a deployment without
  // AI_API_KEY should never cost a call or surface a provider error.
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI is not configured on this deployment.", status: "ai_unavailable" },
      { status: 503 }
    );
  }

  try {
    const result = await recruiterFit(trimmedCv, jobDescription, locale);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    if (err instanceof AiInputError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof AiNotConfiguredError) {
      return NextResponse.json(
        { error: "AI is not configured on this deployment.", status: "ai_unavailable" },
        { status: 503 }
      );
    }
    if (err instanceof AiProviderError) {
      console.error("AI provider error for recruiter fit:", err.message);
      // Pass through upstream rate limits so clients can retry sensibly.
      const status = err.status === 429 ? 429 : 502;
      return NextResponse.json(
        { error: status === 429 ? "AI provider rate limited" : "AI provider request failed" },
        { status }
      );
    }
    if (err instanceof AiParseError) {
      return NextResponse.json(
        { error: "AI returned an unparseable response. Please retry." },
        { status: 502 }
      );
    }
    if (err instanceof AiError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    console.error("Recruiter fit failed:", err);
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}

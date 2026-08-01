import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateFeedback } from "@/lib/interview/feedback";
import type { QuestionType } from "@/lib/interview/types";

/**
 * POST /api/interview/feedback
 *
 * Produces a recruiter-style feedback report from a set of evaluated
 * answers (readiness score, strengths, growth areas, recommendation,
 * per-category averages). Deterministic — no AI.
 *
 * Request body:
 *   {
 *     results: [
 *       {
 *         type: "technical" | "behavioral" | "system-design" | "role-fit",
 *         evaluation: { score, strengths, improvements, ... }
 *       }
 *     ]
 *   }
 *
 * Responses:
 *   200 — { feedback: RecruiterFeedback }
 *   400 — invalid body
 *   401 — not authenticated
 *   500 — unexpected failure
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }

  const rawResults = (body as { results?: unknown }).results;
  if (!Array.isArray(rawResults)) {
    return NextResponse.json(
      { error: "Body must include a `results` array" },
      { status: 400 }
    );
  }

  const VALID_TYPES: QuestionType[] = ["technical", "behavioral", "system-design", "role-fit"];

  const strArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  const items = rawResults.flatMap((r) => {
    if (typeof r !== "object" || r === null) return [];
    const { type, evaluation } = r as { type?: unknown; evaluation?: unknown };
    if (
      typeof type !== "string" ||
      !VALID_TYPES.includes(type as QuestionType) ||
      typeof evaluation !== "object" ||
      evaluation === null ||
      typeof (evaluation as { score?: unknown }).score !== "number"
    ) {
      return [];
    }
    const e = evaluation as Record<string, unknown>;
    return [
      {
        type: type as QuestionType,
        evaluation: {
          score: e.score as number,
          // Carry through the real per-answer feedback so the aggregated
          // report reflects actual strengths/gaps (not empty lists).
          strengths: strArray(e.strengths),
          improvements: strArray(e.improvements),
          coveredKeywords: strArray(e.coveredKeywords),
          missingKeywords: strArray(e.missingKeywords),
          verdict: typeof e.verdict === "string" ? e.verdict : "",
        },
      },
    ];
  });

  if (items.length === 0) {
    return NextResponse.json(
      { error: "results must contain at least one valid { type, evaluation } entry" },
      { status: 400 }
    );
  }

  const feedback = generateFeedback(items);

  return NextResponse.json({ feedback });
}

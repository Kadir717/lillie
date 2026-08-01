import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { evaluateAnswer } from "@/lib/interview/evaluation";
import type { AnswerSubmission, QuestionType } from "@/lib/interview/types";

/**
 * POST /api/interview/evaluate
 *
 * Scores a written answer against a question's expected keywords (plus a
 * STAR check for behavioral answers). Deterministic — no AI.
 *
 * Request body:
 *   {
 *     question: { type, topic, difficulty, expectedKeywords },
 *     answer: string
 *   }
 *
 * Responses:
 *   200 — { evaluation: AnswerEvaluation }
 *   400 — invalid body / missing fields
 *   401 — not authenticated
 *   500 — unexpected failure
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: AnswerSubmission;
  try {
    const parsed = await request.json();
    if (typeof parsed !== "object" || parsed === null) {
      return NextResponse.json(
        { error: "Request body must be a JSON object" },
        { status: 400 }
      );
    }
    body = parsed as AnswerSubmission;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const q = body?.question;
  if (typeof q !== "object" || q === null || typeof q.topic !== "string") {
    return NextResponse.json(
      { error: "Body must include a `question` object with a `topic`" },
      { status: 400 }
    );
  }

  const VALID_TYPES: QuestionType[] = ["technical", "behavioral", "system-design", "role-fit"];
  if (typeof q.type !== "string" || !VALID_TYPES.includes(q.type as QuestionType)) {
    return NextResponse.json(
      { error: `Invalid question.type. Supported: ${VALID_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const VALID_DIFFICULTIES = ["junior", "mid", "senior"] as const;
  if (
    q.difficulty !== undefined &&
    (typeof q.difficulty !== "string" ||
      !VALID_DIFFICULTIES.includes(q.difficulty as (typeof VALID_DIFFICULTIES)[number]))
  ) {
    return NextResponse.json(
      { error: "question.difficulty must be one of: junior, mid, senior" },
      { status: 400 }
    );
  }

  if (!Array.isArray(q.expectedKeywords)) {
    return NextResponse.json(
      { error: "question.expectedKeywords must be an array" },
      { status: 400 }
    );
  }

  if (typeof body.answer !== "string") {
    return NextResponse.json(
      { error: "Body must include an `answer` string" },
      { status: 400 }
    );
  }

  const evaluation = evaluateAnswer({
    question: {
      type: q.type as QuestionType,
      topic: q.topic,
      difficulty:
        q.difficulty === "junior" || q.difficulty === "senior" ? q.difficulty : "mid",
      expectedKeywords: (q.expectedKeywords as unknown[]).filter(
        (k): k is string => typeof k === "string"
      ),
    },
    answer: body.answer,
  });

  return NextResponse.json({ evaluation });
}

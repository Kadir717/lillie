/**
 * Recruiter-style feedback generator + mock-session assembler.
 *
 * Given per-answer evaluation scores, produces a recruiter-style summary
 * (readiness score, strengths, growth areas, recommendation, per-category
 * averages). Deterministic and explainable — no AI.
 */

import type { AnswerEvaluation, MockSession, QuestionType, RecruiterFeedback } from "./types";

/** An evaluation tagged with the question type it belongs to. */
export interface TaggedEvaluation {
  type: QuestionType;
  evaluation: AnswerEvaluation;
}

/**
 * Assembles a recruiter-style feedback report from evaluated answers.
 *
 * @param items One tagged evaluation per answered question.
 */
export function generateFeedback(items: TaggedEvaluation[]): RecruiterFeedback {
  if (items.length === 0) {
    return {
      overallImpression: "No answers evaluated yet.",
      readinessScore: 0,
      strengths: [],
      growthAreas: ["Answer at least a few questions to get feedback."],
      recommendation: "Complete the mock interview first.",
      byCategory: [],
    };
  }

  const average = (nums: number[]) =>
    nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;

  const evaluations = items.map((i) => i.evaluation);
  const overall = average(evaluations.map((e) => e.score));

  // Aggregate strengths/improvements (dedup, cap).
  const strengths = [...new Set(evaluations.flatMap((e) => e.strengths))].slice(0, 5);
  const growthAreas = [...new Set(evaluations.flatMap((e) => e.improvements))].slice(0, 5);

  // Per-category averages.
  const byType = new Map<QuestionType, number[]>();
  for (const { type, evaluation } of items) {
    const list = byType.get(type) ?? [];
    list.push(evaluation.score);
    byType.set(type, list);
  }
  const byCategory: RecruiterFeedback["byCategory"] = [...byType.entries()]
    .map(([type, scores]) => ({
      type,
      averageScore: average(scores),
      count: scores.length,
    }))
    .sort((a, b) => b.averageScore - a.averageScore);

  const recommendation =
    overall >= 80
      ? "Interview-ready — focus on consistency under pressure."
      : overall >= 55
        ? "Almost there — sharpen the specific gaps listed below before applying."
        : "Keep practicing — review the improvement areas and re-run the mock session.";

  const overallImpression =
    overall >= 80
      ? `Strong performance across the board (${overall}/100).`
      : overall >= 55
        ? `Solid foundation with clear, fixable gaps (${overall}/100).`
        : `Early-stage readiness (${overall}/100) — targeted practice will move this quickly.`;

  return {
    overallImpression,
    readinessScore: overall,
    strengths,
    growthAreas,
    recommendation,
    byCategory,
  };
}

/** Builds a MockSession object from a question list + role context. */
export function buildMockSession(
  role: string,
  questions: MockSession["questions"]
): MockSession {
  const technicalCount = questions.filter((q) => q.type !== "behavioral").length;
  const durationMinutes = Math.max(15, Math.min(60, questions.length * 6));

  return {
    id: `mock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    role,
    questions,
    durationMinutes,
    instructions: [
      `You have ${questions.length} questions (${technicalCount} technical, ${questions.length - technicalCount} behavioral).`,
      `Answer in writing or out loud — aim for ${Math.max(2, Math.round(durationMinutes / questions.length))} minutes per question.`,
      "Use the STAR structure for behavioral questions (Situation, Task, Action, Result).",
      "Be specific: name technologies, decisions, and measurable outcomes.",
      "After each answer, the evaluation engine will show covered vs missing keywords.",
    ],
    generatedAt: new Date().toISOString(),
  };
}

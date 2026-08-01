/**
 * Deterministic answer evaluation engine.
 *
 * Scores a written answer against a question's expected keywords, plus a
 * STAR-structure check for behavioral answers. Rule-based and explainable
 * (no AI — the AI layer stays dormant until production approval).
 */

import type { AnswerEvaluation, AnswerSubmission } from "./types";

/** Case-insensitive word-boundary keyword test (same approach as jobs). */
function includesKeyword(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const last = keyword[keyword.length - 1] ?? "";
  const trailing = /\w/.test(last) ? "\\b" : "";
  return new RegExp(`\\b${escaped}${trailing}`, "i").test(text);
}

/** STAR element markers (behavioral answers). */
const STAR_MARKERS = {
  situation: ["situation", "context", "at the time", "i was working", "project involved", "our team"],
  task: ["task", "goal", "needed to", "my responsibility", "i had to", "objective"],
  action: ["i did", "i built", "i created", "i implemented", "i led", "my approach", "i decided", "we shipped", "action"],
  result: ["result", "outcome", "in the end", "as a result", "improved", "increased", "reduced", "learned", "afterwards"],
} as const;

function detectStarElements(text: string): {
  situation: boolean;
  task: boolean;
  action: boolean;
  result: boolean;
} {
  const lower = text.toLowerCase();
  return {
    situation: STAR_MARKERS.situation.some((m) => lower.includes(m)),
    task: STAR_MARKERS.task.some((m) => lower.includes(m)),
    action: STAR_MARKERS.action.some((m) => lower.includes(m)),
    result: STAR_MARKERS.result.some((m) => lower.includes(m)),
  };
}

/**
 * Evaluates a single answer.
 *
 * Scoring:
 *   - technical/system-design/role-fit: keyword coverage (70%) + answer
 *     depth (length + sentence structure, 30%).
 *   - behavioral: STAR completeness (60%) + keyword coverage (40%).
 */
export function evaluateAnswer(submission: AnswerSubmission): AnswerEvaluation {
  const { question, answer } = submission;
  const text = answer?.trim() ?? "";
  const keywords = question.expectedKeywords ?? [];

  if (!text) {
    return {
      score: 0,
      coveredKeywords: [],
      missingKeywords: keywords,
      strengths: [],
      improvements: ["Your answer was empty — try writing at least a few sentences."],
      verdict: "No answer provided.",
    };
  }

  const covered = keywords.filter((k) => includesKeyword(text, k));
  const missing = keywords.filter((k) => !includesKeyword(text, k));
  const coverage = keywords.length ? Math.round((covered.length / keywords.length) * 100) : 60;

  // Depth: longer, sentence-rich answers score higher (capped).
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const depth = Math.min(100, Math.round((wordCount / 120) * 100));

  const strengths: string[] = [];
  const improvements: string[] = [];

  let score: number;
  let starElements: AnswerEvaluation["starElements"];

  if (question.type === "behavioral") {
    const star = detectStarElements(text);
    const starCount = Object.values(star).filter(Boolean).length;
    const starScore = Math.round((starCount / 4) * 100);
    score = Math.round(starScore * 0.6 + coverage * 0.4);
    starElements = star;

    if (starCount === 4) strengths.push("Strong STAR structure — situation, task, action and result are all present");
    else if (starCount >= 3) strengths.push("Good STAR structure; a small gap remains");
    else improvements.push("Structure your answer as STAR (Situation → Task → Action → Result)");
    if (!star.action) improvements.push("Make your own actions explicit — what did YOU do?");
    if (!star.result) improvements.push("Always end with the result or what you learned");
  } else {
    score = Math.round(coverage * 0.7 + depth * 0.3);
  }

  if (coverage >= 70) strengths.push(`Strong keyword coverage (${covered.length}/${keywords.length})`);
  else if (coverage > 0) improvements.push(`Mention the missing topics: ${missing.slice(0, 4).join(", ")}`);
  else improvements.push("Your answer misses the core topics this question targets");

  if (depth < 30) improvements.push("Expand your answer — give concrete details and examples");
  else if (depth >= 70) strengths.push("Detailed, well-developed answer");

  if (improvements.length === 0) strengths.push("Well-rounded answer");

  const verdict =
    score >= 80
      ? "Strong answer — interview-ready."
      : score >= 55
        ? "Solid answer with room to sharpen specifics."
        : "Needs work — review the suggested improvements before the real interview.";

  return {
    score,
    coveredKeywords: covered,
    missingKeywords: missing,
    starElements,
    strengths,
    improvements,
    verdict,
  };
}

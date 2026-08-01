/**
 * Shared types for LILLIE's interview-prep feature set.
 *
 * Everything is DETERMINISTIC — the AI layer stays dormant until production
 * approval, so question banks, evaluation and salary estimation are
 * rule-based and explainable (same philosophy as the job toolkit).
 */

/** Question families. */
export type QuestionType =
  | "technical"
  | "behavioral"
  | "system-design"
  | "role-fit";

/** Difficulty ladder used for question selection + evaluation. */
export type Difficulty = "junior" | "mid" | "senior";

/** A generated interview question. */
export interface InterviewQuestion {
  id: string;
  type: QuestionType;
  /** Which skill/category this question targets (e.g. "React", "SQL"). */
  topic: string;
  text: string;
  difficulty: Difficulty;
  /** Keywords a strong answer should touch (used by the evaluation engine). */
  expectedKeywords: string[];
  /** One-line coaching hint shown after answering. */
  hint: string;
}

/** A full mock-interview session assembled for a developer. */
export interface MockSession {
  id: string;
  /** Role context used to tailor questions (e.g. "software_engineer"). */
  role: string;
  questions: InterviewQuestion[];
  /** Suggested pacing in minutes. */
  durationMinutes: number;
  /** Instructions shown to the user. */
  instructions: string[];
  generatedAt: string;
}

/** A user's answer to one question, submitted for evaluation. */
export interface AnswerSubmission {
  question: Pick<InterviewQuestion, "type" | "topic" | "expectedKeywords" | "difficulty">;
  answer: string;
}

/** Scores for a single evaluated answer. */
export interface AnswerEvaluation {
  /** 0-100 overall. */
  score: number;
  /** Which of the expected keywords were covered. */
  coveredKeywords: string[];
  /** Expected keywords not covered. */
  missingKeywords: string[];
  /** For behavioral answers: which STAR elements were detected. */
  starElements?: { situation: boolean; task: boolean; action: boolean; result: boolean };
  strengths: string[];
  improvements: string[];
  verdict: string;
}

/** A salary estimate band for a role/location. */
export interface SalaryEstimate {
  role: string;
  /** Annual USD range (junior–senior). */
  rangeLow: number;
  rangeHigh: number;
  /** Experience in years used for the estimate. */
  yearsExperience: number;
  /** Detected location factor (0.6–1.3). */
  locationFactor: number;
  /** Factors that influenced the estimate. */
  factors: string[];
  disclaimer: string;
}

/** Recruiter-style feedback for a completed mock session. */
export interface RecruiterFeedback {
  overallImpression: string;
  /** 0-100 readiness score. */
  readinessScore: number;
  strengths: string[];
  growthAreas: string[];
  recommendation: string;
  /** Per-category averages. */
  byCategory: { type: QuestionType; averageScore: number; count: number }[];
}

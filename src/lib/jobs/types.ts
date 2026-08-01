/**
 * Shared types for LILLIE's job-search feature set.
 *
 * Everything here is deterministic (no AI — the AI layer is intentionally
 * dormant until production approval). These types describe both the persisted
 * Job row (via Prisma) and the computed analysis payloads.
 */

import type { CvModel } from "../cv-model";

/** Application pipeline stages. */
export type JobStatus =
  | "saved"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected"
  | "archived";

export const JOB_STATUSES: JobStatus[] = [
  "saved",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "archived",
];

/** User-assigned priority. */
export type JobPriority = "low" | "medium" | "high";

export const JOB_PRIORITIES: JobPriority[] = ["low", "medium", "high"];

/** A single keyword detected in a job description. */
export interface JobKeywordHit {
  term: string;
  category: string;
  count: number;
}

/** Cached match analysis stored on the Job row (`matchJson`). */
export interface JobMatchResult {
  /** 0-100 overall fit. */
  score: number;
  /** Job keywords that appear in the developer's profile. */
  matchedKeywords: string[];
  /** Job keywords missing from the profile (opportunity to add). */
  missingKeywords: string[];
  /** Projects ranked by relevance to this job. */
  recommendedProjects: { name: string; relevance: number; matchedTerms: string[] }[];
  /** Languages that best align with the job's stack. */
  recommendedLanguages: string[];
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  explanation: string;
}

/** ATS-style breakdown computed against a specific job description. */
export interface JobAtsResult {
  overall: number;
  breakdown: {
    keywords: number;
    summary: number;
    skills: number;
    experience: number;
  };
  missingKeywords: string[];
  suggestions: string[];
}

/** Resume-optimization output: a reordered model + advice. */
export interface ResumeOptimizationResult {
  /** The CvModel with projects/languages reordered for this job. */
  model: CvModel;
  suggestions: string[];
}

/** Internship-mode output: a reordered model + internship advice. */
export interface InternshipModeResult {
  model: CvModel;
  suggestions: string[];
}

/** Cover letter generated deterministically from profile + job. */
export interface CoverLetter {
  subject: string;
  greeting: string;
  opening: string;
  body: string[];
  closing: string;
  signoff: string;
}

/** Full analysis payload produced by `analyzeJob`. */
export interface JobAnalysis {
  keywords: JobKeywordHit[];
  match: JobMatchResult;
  ats: JobAtsResult;
  optimization: ResumeOptimizationResult;
  internship: InternshipModeResult;
  coverLetter: CoverLetter;
  computedAt: string;
}

/**
 * ALL prompts for LILLIE's AI services, separated from business logic.
 *
 * Every function in this file is a PURE function: model text + params in,
 * `AiMessage[]` out. No I/O, no validation, no parsing — services.ts owns
 * those concerns. Keeping prompts here means:
 *   - prompts can be tuned/reviewed without touching code paths
 *   - services stay provider-agnostic
 *   - the same prompt set works with any AiProvider implementation
 *
 * Note: the existing AI profile endpoint (`/api/ai/profile`) is still a
 * "coming soon" placeholder — none of these prompts replace it.
 */

import type { AiMessage } from "./types";

/** Generic JSON-only instruction appended to every system prompt. */
const JSON_ONLY =
  'Respond with ONLY a single valid JSON object. Do NOT wrap it in markdown fences, do NOT add commentary before or after.';

/** Maps the app's 11 supported locales to natural language names. */
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  tr: "Turkish",
  de: "German",
  fr: "French",
  es: "Spanish",
  pt: "Portuguese",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ru: "Russian",
  ar: "Arabic",
};

/**
 * Returns a locale instruction for the system prompt, or "" for English
 * (the default output language).
 */
function localeInstruction(locale?: string): string {
  if (!locale || locale === "en") return "";
  const name = LANGUAGE_NAMES[locale] ?? locale;
  return `Write every human-readable field of your response in ${name}.`;
}

/** Serialized CV text + tool params → the `user` message body. */
function userText(cvText: string, extra = ""): string {
  return [
    "Analyze the following developer profile / CV data:",
    "```",
    cvText,
    "```",
    extra,
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

/** Joins system prompt parts, dropping empty ones. */
function system(...parts: (string | undefined)[]): string {
  return parts.filter((p): p is string => Boolean(p)).join("\n");
}

const RESUME_REVIEW_SCHEMA = `{
  "overallScore": number (0-100),
  "summary": string (1-2 sentence overall impression),
  "strengths": string[],
  "weaknesses": string[],
  "improvements": string[] (concrete, prioritized suggestions)
}`;

/**
 * Resume Review — qualitative critique of the CV (structure, impact,
 * wording, gaps) with a 0-100 score and prioritized improvements.
 */
export function buildResumeReviewPrompt(cvText: string, locale?: string): AiMessage[] {
  return [
    {
      role: "system",
      content: system(
        "You are an expert resume reviewer and senior technical recruiter.",
        "Evaluate the developer profile as if it were a resume for a software engineering role.",
        `Return JSON exactly matching this schema: ${RESUME_REVIEW_SCHEMA}`,
        "Be specific and constructive. Weaknesses must be factual, not generic.",
        localeInstruction(locale),
        JSON_ONLY
      ),
    },
    {
      role: "user",
      content: userText(
        cvText,
        "Review this profile. Score it honestly — average profiles should score 50-70."
      ),
    },
  ];
}

const ATS_SCHEMA = `{
  "overall": number (0-100),
  "breakdown": {
    "contactInfo": number,
    "summary": number,
    "skills": number,
    "experience": number,
    "education": number,
    "achievements": number
  },
  "strengths": string[],
  "weaknesses": string[],
  "missingKeywords": string[],
  "suggestions": string[]
}`;

/**
 * ATS Score — role-specific keyword coverage and section scoring,
 * mirroring the deterministic /api/ats-score contract so a future UI
 * widget can consume either source.
 */
export function buildAtsScorePrompt(cvText: string, role: string, locale?: string): AiMessage[] {
  return [
    {
      role: "system",
      content: system(
        "You are an ATS (Applicant Tracking System) optimization expert.",
        `The target role is: ${role}.`,
        "Score how well the profile would pass an ATS screen for that role.",
        "Contact info = GitHub handle + any location/email/blog present. Education is rarely available from GitHub data — score it low but explain why.",
        `Return JSON exactly matching this schema: ${ATS_SCHEMA}`,
        localeInstruction(locale),
        JSON_ONLY
      ),
    },
    {
      role: "user",
      content: userText(cvText, "Score this profile for the target role."),
    },
  ];
}

const REWRITE_SCHEMA = `{
  "sections": [
    {
      "section": string ("summary" | "projects" | "languages" | "achievements"),
      "original": string,
      "rewritten": string,
      "rationale": string
    }
  ]
}`;

/**
 * Resume Rewrite — rewrites weak sections (bio, project descriptions,
 * language presentation) with measurable-impact language.
 */
export function buildResumeRewritePrompt(cvText: string, locale?: string): AiMessage[] {
  return [
    {
      role: "system",
      content: system(
        "You are an expert resume writer specializing in developer resumes.",
        "Rewrite weak or generic sections using strong, quantifiable language.",
        "Keep every rewrite factual — never invent metrics that are not in the data.",
        "For projects, emphasize outcome/impact phrasing over feature-listing.",
        `Return JSON exactly matching this schema: ${REWRITE_SCHEMA}`,
        localeInstruction(locale),
        JSON_ONLY
      ),
    },
    {
      role: "user",
      content: userText(cvText, "Rewrite the sections that need the most improvement."),
    },
  ];
}

const SKILL_RECOMMENDATION_SCHEMA = `{
  "currentSkills": string[],
  "recommendedSkills": [
    { "skill": string, "reason": string, "priority": "high" | "medium" | "low" }
  ],
  "suggestedProjects": string[]
}`;

/**
 * Skill Recommendation — suggests skills to learn next, grounded in the
 * existing stack and top languages.
 */
export function buildSkillRecommendationPrompt(cvText: string, locale?: string): AiMessage[] {
  return [
    {
      role: "system",
      content: system(
        "You are a career advisor for software developers.",
        "Recommend the next skills this developer should learn, based ONLY on their current stack and project history.",
        "Skills must be concrete and learnable (frameworks, tools, practices). Rank by relevance to their current trajectory.",
        "suggestedProjects = small practice projects that would exercise the recommended skills.",
        `Return JSON exactly matching this schema: ${SKILL_RECOMMENDATION_SCHEMA}`,
        localeInstruction(locale),
        JSON_ONLY
      ),
    },
    {
      role: "user",
      content: userText(cvText, "Recommend skills to learn next for this developer."),
    },
  ];
}

const SKILL_GAP_SCHEMA = `{
  "targetRole": string,
  "gaps": [
    { "skill": string, "importance": "high" | "medium" | "low", "howToLearn": string }
  ],
  "overallFit": number (0-100),
  "advice": string
}`;

/**
 * Skill Gap Analysis — compares the profile against a target role and
 * lists missing skills with learning paths.
 */
export function buildSkillGapPrompt(cvText: string, role: string, locale?: string): AiMessage[] {
  return [
    {
      role: "system",
      content: system(
        "You are a technical hiring expert.",
        `Analyze how well this developer's profile fits the target role: ${role}.`,
        "List the most important skills for that role that are MISSING or weakly evidenced in the profile.",
        "howToLearn must be a concrete path (course, resource type, or project).",
        `Return JSON exactly matching this schema: ${SKILL_GAP_SCHEMA}`,
        localeInstruction(locale),
        JSON_ONLY
      ),
    },
    {
      role: "user",
      content: userText(cvText, `Identify the skill gaps for the role: ${role}.`),
    },
  ];
}

const TAILOR_SCHEMA = `{
  "fitScore": number (0-100),
  "matchedStrengths": string[],
  "gaps": string[],
  "talkingPoints": string[],
  "coverNote": string
}`;

/**
 * Tailor — application advice for a SPECIFIC job posting. Compares the
 * candidate's profile against the posted requirements and returns what to
 * emphasize, what's missing, and a ready-to-send cover note opening.
 */
export function buildTailorPrompt(
  cvText: string,
  jobDescription: string,
  locale?: string
): AiMessage[] {
  return [
    {
      role: "system",
      content: system(
        "You are a senior technical recruiter helping a job seeker apply for one specific position.",
        "Analyze how the candidate's profile fits the job description provided by the user.",
        "Ground every point in the candidate's actual profile data AND the specific job description text — never invent metrics, never give generic advice that could apply to any posting.",
        "matchedStrengths = profile strengths that directly address THIS posting's requirements.",
        "gaps = requirements in the posting that are missing or weakly evidenced in the profile.",
        "talkingPoints = concrete, interview-ready points the candidate can emphasize in the application/interview.",
        "coverNote = a 2-3 sentence application message / cover letter opening draft, written in the candidate's voice.",
        `Return JSON exactly matching this schema: ${TAILOR_SCHEMA}`,
        localeInstruction(locale),
        JSON_ONLY
      ),
    },
    {
      role: "user",
      content: userText(
        cvText,
        `The job posting to tailor this application for:\n"""\n${jobDescription}\n"""`
      ),
    },
  ];
}

const CAREER_COACH_SCHEMA = `{
  "careerDirection": string,
  "advice": string[],
  "quickWins": string[],
  "longTerm": string[]
}`;

/**
 * Career Coach — strategic career guidance grounded in the profile,
 * split into immediate quick wins and long-term direction.
 */
export function buildCareerCoachPrompt(cvText: string, locale?: string): AiMessage[] {
  return [
    {
      role: "system",
      content: system(
        "You are a senior career coach for software developers.",
        "Give practical, grounded advice based ONLY on this developer's actual data.",
        "quickWins = actions achievable in days-to-weeks. longTerm = 6-24 month direction.",
        "Avoid generic platitudes; tie every point to something visible in the profile.",
        `Return JSON exactly matching this schema: ${CAREER_COACH_SCHEMA}`,
        localeInstruction(locale),
        JSON_ONLY
      ),
    },
    {
      role: "user",
      content: userText(cvText, "Coach this developer on their career trajectory."),
    },
  ];
}

const ROADMAP_SCHEMA = `{
  "phases": [
    {
      "title": string,
      "timeframe": string,
      "focus": string[],
      "outcome": string
    }
  ]
}`;

/**
 * Roadmap Generator — a phased learning/career roadmap with timelines,
 * derived from the current skill set.
 */
export function buildRoadmapPrompt(cvText: string, locale?: string): AiMessage[] {
  return [
    {
      role: "system",
      content: system(
        "You are a career roadmap planner for software developers.",
        "Design a 12-month phased roadmap (3-4 phases) building on the developer's CURRENT skills.",
        "Each phase must have a clear focus, realistic timeframe, and measurable outcome.",
        `Return JSON exactly matching this schema: ${ROADMAP_SCHEMA}`,
        localeInstruction(locale),
        JSON_ONLY
      ),
    },
    {
      role: "user",
      content: userText(cvText, "Create a 12-month career roadmap for this developer."),
    },
  ];
}

const LEARNING_SCHEMA = `{
  "recommendations": [
    {
      "topic": string,
      "resource": string,
      "type": "course" | "book" | "practice" | "community",
      "why": string
    }
  ]
}`;

/**
 * Learning Recommendation — concrete learning resources tailored to the
 * developer's stack and optional stated interest.
 */
export function buildLearningPrompt(cvText: string, interest?: string, locale?: string): AiMessage[] {
  const extra = interest
    ? `The developer is specifically interested in: ${interest}.`
    : "";
  return [
    {
      role: "system",
      content: system(
        "You are a technical learning-curriculum designer.",
        "Recommend concrete, well-known learning resources (courses, books, practice platforms, communities) that fit this developer's current level.",
        "Resources must be real and reputable. Tailor difficulty to their experience.",
        `Return JSON exactly matching this schema: ${LEARNING_SCHEMA}`,
        localeInstruction(locale),
        JSON_ONLY
      ),
    },
    {
      role: "user",
      content: userText(cvText, extra || "Recommend learning resources for this developer."),
    },
  ];
}

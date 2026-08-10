/**
 * Reusable AI services — business logic for LILLIE's AI tools.
 *
 * Every service follows the same pipeline:
 *   1. validate + serialize the CvModel into plain text
 *   2. build the prompt (prompts.ts — pure, provider-agnostic)
 *   3. call the provider (provider.ts)
 *   4. parse + shape-validate the JSON reply
 *
 * Services never import prompts' internals and never know which provider
 * is active. Adding a new AI feature = add a prompt + a service + register
 * it in `aiTools`.
 */

import type { CvModel } from "../cv-model";
import type { AiMessage, AiToolRequest } from "./types";
import { AiInputError, AiParseError } from "./errors";
import { createAiProvider } from "./provider";
import {
  buildResumeReviewPrompt,
  buildAtsScorePrompt,
  buildResumeRewritePrompt,
  buildSkillRecommendationPrompt,
  buildSkillGapPrompt,
  buildTailorPrompt,
  buildCareerCoachPrompt,
  buildRoadmapPrompt,
  buildLearningPrompt,
} from "./prompts";

/* ────────────────────────────────────────────────────────────────────
 * Model serialization — turns a CvModel into compact prompt text.
 * ──────────────────────────────────────────────────────────────────── */

function serializeModel(model: CvModel): string {
  const lines: string[] = [];

  lines.push(`Name: ${model.header.name || "—"}`);
  if (model.header.bio) lines.push(`Bio: ${model.header.bio}`);
  if (model.header.contacts.length > 0)
    lines.push(`Contacts: ${model.header.contacts.join(" | ")}`);

  lines.push(
    `Stats: ${model.stats.repos} repos, ${model.stats.stars} stars, ` +
      `${model.stats.forks} forks, ${model.stats.years} years`
  );

  if (model.languages.length > 0) {
    lines.push(
      `Languages: ${model.languages
        .map((l) => `${l.name} (${l.percent}%)`)
        .join(", ")}`
    );
  }

  if (model.projects.length > 0) {
    lines.push("Projects:");
    for (const p of model.projects.slice(0, 12)) {
      const parts = [`- ${p.name}`];
      if (p.language) parts.push(`[${p.language}]`);
      if (p.stars > 0) parts.push(`stars=${p.stars}`);
      if (p.forks > 0) parts.push(`forks=${p.forks}`);
      if (p.description) parts.push(`desc="${p.description.slice(0, 160)}"`);
      if (p.topics && p.topics.length > 0) parts.push(`topics=${p.topics.slice(0, 6).join(",")}`);
      lines.push(parts.join(" "));
    }
  }

  return lines.join("\n");
}

/* ────────────────────────────────────────────────────────────────────
 * Shared request handling
 * ──────────────────────────────────────────────────────────────────── */

/**
 * Validates the incoming tool request and returns the CvModel.
 * The model is intentionally taken from the request body (the client
 * already fetched it) — no server-side GitHub round-trip per AI call.
 */
function extractModel(body: AiToolRequest): CvModel {
  const model = body?.model;
  if (typeof model !== "object" || model === null) {
    throw new AiInputError("Body must include a `model` object.");
  }
  const m = model as Record<string, unknown>;
  const header = m.header as Record<string, unknown> | undefined;
  if (typeof header !== "object" || header === null || typeof header.name !== "string") {
    throw new AiInputError("Model is missing a valid `header.name`.");
  }
  // Coerce stats defensively WITHOUT mutating the caller's body object.
  // A primitive (string/number/boolean) must not reach an assignment that
  // would throw — malformed input should fail cleanly, not 500.
  const rawStats: Record<string, unknown> =
    typeof m.stats === "object" && m.stats !== null
      ? (m.stats as Record<string, unknown>)
      : {};
  const stats = {
    repos: typeof rawStats.repos === "number" ? rawStats.repos : 0,
    stars: typeof rawStats.stars === "number" ? rawStats.stars : 0,
    forks: typeof rawStats.forks === "number" ? rawStats.forks : 0,
    years: typeof rawStats.years === "number" ? rawStats.years : 0,
  };
  const languages = Array.isArray(m.languages) ? m.languages : [];
  const projects = Array.isArray(m.projects) ? m.projects : [];
  return {
    header: {
      name: header.name,
      bio: typeof header.bio === "string" ? header.bio : undefined,
      contacts: Array.isArray(header.contacts)
        ? (header.contacts as unknown[]).filter((c): c is string => typeof c === "string")
        : [],
    },
    stats,
    languages: languages.slice(0, 8).map((l) => {
      // Elements can be null/primitives from a malformed client — never
      // read properties off a non-object (same rule as the stats guard).
      const lang: Record<string, unknown> =
        typeof l === "object" && l !== null ? (l as Record<string, unknown>) : {};
      return {
        name: typeof lang.name === "string" ? lang.name : "unknown",
        percent: typeof lang.percent === "number" ? lang.percent : 0,
      };
    }),
    projects: projects.slice(0, 12).map((p) => {
      const proj: Record<string, unknown> =
        typeof p === "object" && p !== null ? (p as Record<string, unknown>) : {};
      return {
        name: typeof proj.name === "string" ? proj.name : "unnamed",
        url: typeof proj.url === "string" ? proj.url : "",
        stars: typeof proj.stars === "number" ? proj.stars : 0,
        forks: typeof proj.forks === "number" ? proj.forks : 0,
        description: typeof proj.description === "string" ? proj.description : undefined,
        language: typeof proj.language === "string" ? proj.language : undefined,
        topics: Array.isArray(proj.topics)
          ? (proj.topics as unknown[]).filter((t): t is string => typeof t === "string")
          : [],
      };
    }),
  };
}

/** Runs a prompt through the provider and parses a JSON object reply. */
async function completeJson<T>(
  messages: AiMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<T> {
  const provider = createAiProvider();
  const raw = await provider.complete(messages, { ...options, json: true });
  // Strip accidental markdown fences some models add despite instructions.
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new AiParseError("AI returned invalid JSON.");
  }
  return parsed as T;
}

function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new AiParseError(`AI response missing array "${field}".`);
  return value;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new AiParseError(`AI response missing string "${field}".`);
  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number") throw new AiParseError(`AI response missing number "${field}".`);
  return value;
}

function stringArray(value: unknown): string[] {
  return requireArray(value, "array").filter((v): v is string => typeof v === "string");
}

/* ────────────────────────────────────────────────────────────────────
 * Result types + services
 * ──────────────────────────────────────────────────────────────────── */

export interface ResumeReviewResult {
  overallScore: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
}

export async function resumeReview(body: AiToolRequest): Promise<ResumeReviewResult> {
  const model = extractModel(body);
  const raw = await completeJson<Record<string, unknown>>(
    buildResumeReviewPrompt(serializeModel(model), body.locale),
    { temperature: 0.3, maxTokens: 1200 }
  );
  return {
    overallScore: requireNumber(raw.overallScore, "overallScore"),
    summary: requireString(raw.summary, "summary"),
    strengths: stringArray(raw.strengths),
    weaknesses: stringArray(raw.weaknesses),
    improvements: stringArray(raw.improvements),
  };
}

export interface AtsScoreResult {
  overall: number;
  breakdown: {
    contactInfo: number;
    summary: number;
    skills: number;
    experience: number;
    education: number;
    achievements: number;
  };
  strengths: string[];
  weaknesses: string[];
  missingKeywords: string[];
  suggestions: string[];
}

export async function atsScore(body: AiToolRequest): Promise<AtsScoreResult> {
  const model = extractModel(body);
  const role = typeof body.role === "string" && body.role.trim() ? body.role.trim() : "software engineer";
  const raw = await completeJson<Record<string, unknown>>(
    buildAtsScorePrompt(serializeModel(model), role, body.locale),
    { temperature: 0.2, maxTokens: 1400 }
  );
  const breakdownRaw = raw.breakdown as Record<string, unknown> | undefined;
  if (typeof breakdownRaw !== "object" || breakdownRaw === null) {
    throw new AiParseError('AI response missing object "breakdown".');
  }
  const breakdownField = (key: string) => requireNumber(breakdownRaw[key], `breakdown.${key}`);
  return {
    overall: requireNumber(raw.overall, "overall"),
    breakdown: {
      contactInfo: breakdownField("contactInfo"),
      summary: breakdownField("summary"),
      skills: breakdownField("skills"),
      experience: breakdownField("experience"),
      education: breakdownField("education"),
      achievements: breakdownField("achievements"),
    },
    strengths: stringArray(raw.strengths),
    weaknesses: stringArray(raw.weaknesses),
    missingKeywords: stringArray(raw.missingKeywords),
    suggestions: stringArray(raw.suggestions),
  };
}

export interface RewriteSection {
  section: string;
  original: string;
  rewritten: string;
  rationale: string;
}

export interface ResumeRewriteResult {
  sections: RewriteSection[];
}

export async function resumeRewrite(body: AiToolRequest): Promise<ResumeRewriteResult> {
  const model = extractModel(body);
  const raw = await completeJson<Record<string, unknown>>(
    buildResumeRewritePrompt(serializeModel(model), body.locale),
    { temperature: 0.4, maxTokens: 1800 }
  );
  const sections = requireArray(raw.sections, "sections").map((s) => {
    const sec = s as Record<string, unknown>;
    return {
      section: requireString(sec.section, "section.section"),
      original: requireString(sec.original, "section.original"),
      rewritten: requireString(sec.rewritten, "section.rewritten"),
      rationale: requireString(sec.rationale, "section.rationale"),
    };
  });
  return { sections };
}

export interface SkillRecommendationResult {
  currentSkills: string[];
  recommendedSkills: { skill: string; reason: string; priority: string }[];
  suggestedProjects: string[];
}

export async function skillRecommendation(body: AiToolRequest): Promise<SkillRecommendationResult> {
  const model = extractModel(body);
  const raw = await completeJson<Record<string, unknown>>(
    buildSkillRecommendationPrompt(serializeModel(model), body.locale),
    { temperature: 0.4, maxTokens: 1500 }
  );
  const recommended = requireArray(raw.recommendedSkills, "recommendedSkills").map((r) => {
    const rec = r as Record<string, unknown>;
    return {
      skill: requireString(rec.skill, "recommendedSkills[].skill"),
      reason: requireString(rec.reason, "recommendedSkills[].reason"),
      priority: requireString(rec.priority, "recommendedSkills[].priority"),
    };
  });
  return {
    currentSkills: stringArray(raw.currentSkills),
    recommendedSkills: recommended,
    suggestedProjects: stringArray(raw.suggestedProjects),
  };
}

export interface SkillGapResult {
  targetRole: string;
  gaps: { skill: string; importance: string; howToLearn: string }[];
  overallFit: number;
  advice: string;
}

export async function skillGap(body: AiToolRequest): Promise<SkillGapResult> {
  const model = extractModel(body);
  const role = typeof body.role === "string" && body.role.trim() ? body.role.trim() : "software engineer";
  const raw = await completeJson<Record<string, unknown>>(
    buildSkillGapPrompt(serializeModel(model), role, body.locale),
    { temperature: 0.3, maxTokens: 1500 }
  );
  const gaps = requireArray(raw.gaps, "gaps").map((g) => {
    const gap = g as Record<string, unknown>;
    return {
      skill: requireString(gap.skill, "gaps[].skill"),
      importance: requireString(gap.importance, "gaps[].importance"),
      howToLearn: requireString(gap.howToLearn, "gaps[].howToLearn"),
    };
  });
  return {
    targetRole: requireString(raw.targetRole, "targetRole"),
    gaps,
    overallFit: requireNumber(raw.overallFit, "overallFit"),
    advice: requireString(raw.advice, "advice"),
  };
}

export interface TailorResult {
  fitScore: number;
  matchedStrengths: string[];
  gaps: string[];
  talkingPoints: string[];
  coverNote: string;
}

/**
 * Tailor — application advice for a specific job posting. Requires the
 * posting text (jobDescription); throws AiInputError when it's missing so
 * the route returns a clean 400 instead of a confusing 502.
 */
export async function tailorApplication(body: AiToolRequest): Promise<TailorResult> {
  const model = extractModel(body);
  const jobDescription =
    typeof body.jobDescription === "string" ? body.jobDescription.trim() : "";
  if (!jobDescription) {
    throw new AiInputError("A job description is required.");
  }
  const raw = await completeJson<Record<string, unknown>>(
    buildTailorPrompt(serializeModel(model), jobDescription, body.locale),
    { temperature: 0.3, maxTokens: 1500 }
  );
  return {
    fitScore: requireNumber(raw.fitScore, "fitScore"),
    matchedStrengths: stringArray(raw.matchedStrengths),
    gaps: stringArray(raw.gaps),
    talkingPoints: stringArray(raw.talkingPoints),
    coverNote: requireString(raw.coverNote, "coverNote"),
  };
}

export interface CareerCoachResult {
  careerDirection: string;
  advice: string[];
  quickWins: string[];
  longTerm: string[];
}

export async function careerCoach(body: AiToolRequest): Promise<CareerCoachResult> {
  const model = extractModel(body);
  const raw = await completeJson<Record<string, unknown>>(
    buildCareerCoachPrompt(serializeModel(model), body.locale),
    { temperature: 0.5, maxTokens: 1500 }
  );
  return {
    careerDirection: requireString(raw.careerDirection, "careerDirection"),
    advice: stringArray(raw.advice),
    quickWins: stringArray(raw.quickWins),
    longTerm: stringArray(raw.longTerm),
  };
}

export interface RoadmapPhase {
  title: string;
  timeframe: string;
  focus: string[];
  outcome: string;
}

export interface RoadmapResult {
  phases: RoadmapPhase[];
}

export async function roadmap(body: AiToolRequest): Promise<RoadmapResult> {
  const model = extractModel(body);
  const raw = await completeJson<Record<string, unknown>>(
    buildRoadmapPrompt(serializeModel(model), body.locale),
    { temperature: 0.5, maxTokens: 1800 }
  );
  const phases = requireArray(raw.phases, "phases").map((p) => {
    const phase = p as Record<string, unknown>;
    return {
      title: requireString(phase.title, "phases[].title"),
      timeframe: requireString(phase.timeframe, "phases[].timeframe"),
      focus: stringArray(phase.focus),
      outcome: requireString(phase.outcome, "phases[].outcome"),
    };
  });
  return { phases };
}

export interface LearningRecommendation {
  topic: string;
  resource: string;
  type: string;
  why: string;
}

export interface LearningResult {
  recommendations: LearningRecommendation[];
}

export async function learning(body: AiToolRequest): Promise<LearningResult> {
  const model = extractModel(body);
  const interest = typeof body.interest === "string" && body.interest.trim()
    ? body.interest.trim()
    : undefined;
  const raw = await completeJson<Record<string, unknown>>(
    buildLearningPrompt(serializeModel(model), interest, body.locale),
    { temperature: 0.5, maxTokens: 1800 }
  );
  const recommendations = requireArray(raw.recommendations, "recommendations").map((r) => {
    const rec = r as Record<string, unknown>;
    return {
      topic: requireString(rec.topic, "recommendations[].topic"),
      resource: requireString(rec.resource, "recommendations[].resource"),
      type: requireString(rec.type, "recommendations[].type"),
      why: requireString(rec.why, "recommendations[].why"),
    };
  });
  return { recommendations };
}

/* ────────────────────────────────────────────────────────────────────
 * Tool registry — drives POST /api/ai/[tool]
 * ──────────────────────────────────────────────────────────────────── */

export interface AiToolDefinition {
  /** Short human-readable description (used in docs/registry). */
  description: string;
  run: (body: AiToolRequest) => Promise<unknown>;
}

export const aiTools = {
  "resume-review": {
    description: "Qualitative resume critique with a 0-100 score and improvements.",
    run: resumeReview,
  },
  ats: {
    description: "Role-specific ATS score with keyword coverage and section scores.",
    run: atsScore,
  },
  rewrite: {
    description: "Rewrites weak CV sections with strong, factual language.",
    run: resumeRewrite,
  },
  "skill-recommendation": {
    description: "Recommends next skills to learn, grounded in the current stack.",
    run: skillRecommendation,
  },
  "skill-gap": {
    description: "Compares the profile against a target role and lists missing skills.",
    run: skillGap,
  },
  tailor: {
    description: "Tailored application advice for a specific job posting: fit score, strengths, gaps, talking points, cover note.",
    run: tailorApplication,
  },
  "career-coach": {
    description: "Strategic career guidance: direction, quick wins, long-term plan.",
    run: careerCoach,
  },
  roadmap: {
    description: "Phased 12-month career/learning roadmap.",
    run: roadmap,
  },
  learning: {
    description: "Concrete learning resources tailored to the developer's level.",
    run: learning,
  },
} as const satisfies Record<string, AiToolDefinition>;

export type AiToolName = keyof typeof aiTools;
export const AI_TOOL_NAMES = Object.keys(aiTools) as AiToolName[];

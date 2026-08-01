/**
 * Deterministic job analysis: matching, ATS optimization, resume
 * optimization, internship mode and cover letter generation.
 *
 * Every function is PURE (CvModel + job description → analysis). The AI
 * layer is intentionally NOT used — these features are rule-based and
 * explainable, matching the existing ATS/analytics approach.
 *
 * Integration with the Resume Engine: optimization and internship mode
 * produce a REORDERED CvModel — the exact same shape consumed by
 * `buildCvDocumentFromModel` (DOCX) and `<CvPreview>` (React). No
 * second data model, no duplicated generation logic.
 */

import type { CvModel } from "../cv-model";
import { extractCompanyKeywords } from "./keywords";
import type { JobKeywordHit } from "./types";
import type {
  CoverLetter,
  InternshipModeResult,
  JobAnalysis,
  JobAtsResult,
  JobMatchResult,
  ResumeOptimizationResult,
} from "./types";

/* ────────────────────────────────────────────────────────────────────
 * Shared text helpers
 * ──────────────────────────────────────────────────────────────────── */

/** Lowercased textual corpus of a CvModel for keyword matching. */
function modelCorpus(model: CvModel): string {
  return [
    model.header.name,
    model.header.bio,
    ...model.header.contacts,
    ...model.languages.map((l) => l.name),
    ...model.projects.flatMap((p) => [
      p.name,
      p.description,
      p.language,
      ...(p.topics ?? []),
    ]),
  ]
    .filter((s): s is string => Boolean(s))
    .join(" ")
    .toLowerCase();
}

function includesTerm(corpus: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}`, "i").test(corpus);
}

/* ────────────────────────────────────────────────────────────────────
 * Job matching
 * ──────────────────────────────────────────────────────────────────── */

/**
 * Ranks the developer's projects by relevance to the job's keywords.
 * Returns projects with a 0-100 relevance score and the matched terms.
 */
function rankProjects(model: CvModel, keywords: JobKeywordHit[]): {
  name: string;
  relevance: number;
  matchedTerms: string[];
}[] {
  return model.projects
    .map((p) => {
      const text = [p.name, p.description, p.language, ...(p.topics ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchedTerms = keywords
        .filter((k) => includesTerm(text, k.term))
        .map((k) => k.term);
      // Keyword overlap dominates; stars add a small popularity bump.
      const overlap = matchedTerms.length / Math.max(keywords.length, 1);
      const stars = Math.min(1, p.stars / 100) * 0.2;
      const relevance = Math.round(Math.min(100, overlap * 100 + stars * 100));
      return { name: p.name, relevance, matchedTerms };
    })
    .sort((a, b) => b.relevance - a.relevance);
}

/** Builds a JobMatchResult from a CvModel + job keywords. */
export function computeJobMatch(
  model: CvModel,
  keywords: JobKeywordHit[]
): JobMatchResult {
  const corpus = modelCorpus(model);
  const terms = keywords.map((k) => k.term);

  const matchedKeywords = terms.filter((t) => includesTerm(corpus, t));
  const missingKeywords = terms.filter((t) => !includesTerm(corpus, t));

  const keywordScore = terms.length
    ? Math.round((matchedKeywords.length / terms.length) * 100)
    : 0;

  const ranked = rankProjects(model, keywords);

  // Language alignment: how many of the job's language keywords are present.
  const jobLanguages = keywords
    .filter((k) => k.category === "language")
    .map((k) => k.term);
  const matchedLanguages = jobLanguages.filter((t) => includesTerm(corpus, t));
  const languageScore = jobLanguages.length
    ? Math.round((matchedLanguages.length / jobLanguages.length) * 100)
    : 50; // neutral when the job lists no languages

  // Overall: keywords 60%, language fit 25%, top-project relevance 15%.
  const topProject = ranked[0];
  const projectScore = topProject ? topProject.relevance : 0;
  const score = Math.round(
    keywordScore * 0.6 + languageScore * 0.25 + projectScore * 0.15
  );

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const suggestions: string[] = [];

  if (keywordScore >= 70) strengths.push(`Strong keyword alignment (${matchedKeywords.length}/${terms.length} matched)`);
  else if (keywordScore >= 40) weaknesses.push(`Partial keyword alignment — ${matchedKeywords.length}/${terms.length} job keywords found`);
  else weaknesses.push(`Low keyword alignment — only ${matchedKeywords.length}/${terms.length} job keywords appear in your profile`);

  if (matchedLanguages.length > 0 && matchedLanguages.length === jobLanguages.length)
    strengths.push("Your language stack matches the job's requirements");
  else if (matchedLanguages.length > 0)
    weaknesses.push(`Some required languages missing: ${jobLanguages.filter((t) => !matchedLanguages.includes(t)).join(", ")}`);
  else if (jobLanguages.length > 0)
    weaknesses.push("None of the job's required languages appear in your profile");

  if (topProject && topProject.relevance >= 50)
    strengths.push(`${topProject.name} is a strong fit for this role`);
  else if (topProject)
    suggestions.push("Consider creating or highlighting a project closer to this job's stack");

  if (missingKeywords.length > 0)
    suggestions.push(
      `Add these keywords to your bio or project descriptions: ${missingKeywords.slice(0, 8).join(", ")}`
    );

  if (score >= 70) strengths.push("Overall: strong fit");
  else if (score >= 40) suggestions.push("Overall: moderate fit — optimize your CV for this role");
  else suggestions.push("Overall: weak fit — consider whether this role matches your stack");

  if (suggestions.length === 0 && weaknesses.length === 0)
    strengths.push("No obvious gaps detected");

  const explanation = `Match ${score}/100 — ${matchedKeywords.length}/${terms.length} keywords matched, language fit ${languageScore}/100.`;

  return {
    score,
    matchedKeywords,
    missingKeywords: missingKeywords.slice(0, 15),
    recommendedProjects: ranked.slice(0, 3),
    // Languages that actually match the job's required stack — NOT every
    // profile language (modelCorpus already embeds language names, so
    // matching against the corpus would always pass).
    recommendedLanguages: model.languages
      .filter((l) => jobLanguages.some((j) => l.name.toLowerCase() === j.toLowerCase()))
      .map((l) => l.name)
      .slice(0, 5),
    strengths,
    weaknesses,
    suggestions,
    explanation,
  };
}

/* ────────────────────────────────────────────────────────────────────
 * ATS optimization (job-specific)
 * ──────────────────────────────────────────────────────────────────── */

/**
 * ATS-style analysis against a SPECIFIC job description (vs the generic
 * role-based /api/ats-score). Keyword coverage is the dominant signal.
 */
export function computeJobAts(
  model: CvModel,
  keywords: JobKeywordHit[]
): JobAtsResult {
  const corpus = modelCorpus(model);
  const terms = keywords.map((k) => k.term);
  const matched = terms.filter((t) => includesTerm(corpus, t));
  const missing = terms.filter((t) => !includesTerm(corpus, t));

  const keywordScore = terms.length ? Math.round((matched.length / terms.length) * 100) : 0;
  const summaryScore = model.header.bio
    ? model.header.bio.length > 80 ? 80 : model.header.bio.length > 30 ? 60 : 40
    : 10;
  const skillsScore = model.languages.length >= 3 ? 80 : model.languages.length >= 1 ? 50 : 20;
  const experienceScore = model.projects.length >= 3 ? 70 : model.projects.length >= 1 ? 40 : 10;

  const overall = Math.round(
    keywordScore * 0.5 + summaryScore * 0.15 + skillsScore * 0.2 + experienceScore * 0.15
  );

  const suggestions: string[] = [];
  if (missing.length > 0)
    suggestions.push(`Missing job keywords — add: ${missing.slice(0, 8).join(", ")}`);
  if (summaryScore < 60) suggestions.push("Expand your bio into a keyword-rich professional summary");
  if (skillsScore < 50) suggestions.push("List more skills/languages relevant to this role");
  if (experienceScore < 40) suggestions.push("Showcase more projects relevant to the position");

  return {
    overall,
    breakdown: { keywords: keywordScore, summary: summaryScore, skills: skillsScore, experience: experienceScore },
    missingKeywords: missing.slice(0, 15),
    suggestions,
  };
}

/* ────────────────────────────────────────────────────────────────────
 * Resume optimization — reordered CvModel (same shape as source)
 * ──────────────────────────────────────────────────────────────────── */

/**
 * Produces a job-specific CvModel: projects re-ranked by relevance to the
 * job's keywords and languages re-ordered by job-stack alignment. The
 * output is the SAME CvModel shape, so it flows straight into the existing
 * DOCX / React renderers — no new generation path.
 */
export function optimizeResumeForJob(
  model: CvModel,
  keywords: JobKeywordHit[]
): ResumeOptimizationResult {
  const ranked = rankProjects(model, keywords);

  // Language order: job-listed languages first, then by profile share.
  const jobLanguageTerms = keywords
    .filter((k) => k.category === "language")
    .map((k) => k.term.toLowerCase());
  const languages = [...model.languages].sort((a, b) => {
    const aJob = jobLanguageTerms.includes(a.name.toLowerCase()) ? -1 : 0;
    const bJob = jobLanguageTerms.includes(b.name.toLowerCase()) ? -1 : 0;
    return aJob - bJob || b.percent - a.percent;
  });

  const projectOrder = new Map(ranked.map((r, i) => [r.name, i]));
  const projects = [...model.projects].sort(
    (a, b) =>
      (projectOrder.get(a.name) ?? 999) - (projectOrder.get(b.name) ?? 999)
  );

  const suggestions: string[] = [];
  if (ranked.length > 0 && ranked[0].relevance >= 50)
    suggestions.push(`Lead with ${ranked[0].name} — it best matches this job`);
  if (ranked.length > 1 && ranked[1].relevance >= 50)
    suggestions.push(`Feature ${ranked[1].name} as a secondary project`);
  if (keywords.length > 0 && projectOrder.size === 0)
    suggestions.push("Add more projects with topics/descriptions that match this job");

  return {
    model: { ...model, languages, projects },
    suggestions,
  };
}

/* ────────────────────────────────────────────────────────────────────
 * Internship mode
 * ──────────────────────────────────────────────────────────────────── */

/**
 * Internship-oriented model: emphasizes learning-oriented languages,
 * surfaces beginner-friendly/recent projects first, and returns tailored
 * advice (no invented data — only reordering + guidance).
 */
export function internshipMode(model: CvModel): InternshipModeResult {
  // Sort by stars ascending so personal/learning projects (which interns
  // typically have) float to the top of the preview — internships value
  // initiative over GitHub popularity.
  const projects = [...model.projects].sort((a, b) => a.stars - b.stars);

  const languages = [...model.languages].sort(
    (a, b) => b.percent - a.percent
  );

  const suggestions = [
    "Internship roles value learning ability — lead with languages you are actively using",
    "Include a short 'learning goals' or coursework note in your bio if relevant",
    "Highlight personal projects even with modest stars — they show initiative",
  ];

  return { model: { ...model, languages, projects }, suggestions };
}

/* ────────────────────────────────────────────────────────────────────
 * Cover letter (deterministic template)
 * ──────────────────────────────────────────────────────────────────── */

/**
 * Generates a simple, honest cover letter from the profile + job details.
 * Template-based and deterministic — a future AI version can supersede it
 * once the AI layer ships, but the output contract stays the same.
 */
export function generateCoverLetter(
  model: CvModel,
  company: string,
  jobTitle: string,
  url?: string
): CoverLetter {
  const name = model.header.name || "the candidate";
  const topLang = model.languages[0]?.name;
  const topProject = model.projects[0];
  const years = model.stats.years;
  const stars = model.stats.stars;

  const opening = topLang
    ? `I am ${name}, a developer who works primarily with ${topLang} and enjoys turning ideas into working software.`
    : `I am ${name}, a developer who enjoys turning ideas into working software.`;

  const body: string[] = [];
  if (topProject) {
    body.push(
      `My work on ${topProject.name} (${topProject.stars} stars on GitHub${
        topProject.description ? ` — ${topProject.description}` : ""
      }) demonstrates my ability to build and ship.`
    );
  }
  if (years > 0 || stars > 0) {
    body.push(
      `Across my GitHub profile I have accumulated ${stars} stars over ${years} year${
        years === 1 ? "" : "s"
      } of contributions.`
    );
  }
  body.push(
    `I am applying for the ${jobTitle} position because it aligns with the work I enjoy doing. I would welcome the chance to discuss how my skills can contribute to ${company}.`
  );

  return {
    subject: `Application for ${jobTitle} — ${name}`,
    greeting: `Dear Hiring Team at ${company},`,
    opening,
    body,
    closing: url
      ? `You can review my portfolio and projects at ${url}.`
      : "Thank you for your time and consideration.",
    signoff: "Best regards,\n" + name,
  };
}

/* ────────────────────────────────────────────────────────────────────
 * Orchestrator
 * ──────────────────────────────────────────────────────────────────── */

/** Computes the full analysis payload for a job against a profile. */
export function analyzeJob(
  model: CvModel,
  company: string,
  jobTitle: string,
  description?: string,
  url?: string
): JobAnalysis {
  const keywords = extractCompanyKeywords(description ?? "");
  const match = computeJobMatch(model, keywords);
  const ats = computeJobAts(model, keywords);
  const optimization = optimizeResumeForJob(model, keywords);
  const internship = internshipMode(model);
  const coverLetter = generateCoverLetter(model, company, jobTitle, url);

  return {
    keywords,
    match,
    ats,
    optimization,
    internship,
    coverLetter,
    computedAt: new Date().toISOString(),
  };
}



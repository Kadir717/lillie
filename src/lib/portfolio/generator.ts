/**
 * LILLIE — Portfolio Generator
 *
 * Deterministic, explainable portfolio content composed from the
 * SINGLE-SOURCE-OF-TRUTH data already fetched for the CV:
 *   - CvModel (src/lib/cv-model.ts)
 *   - GithubAnalyticsData (src/lib/github-analytics.ts)
 *
 * No generator re-implements logic that already exists elsewhere — best
 * repos, project descriptions, achievements, skills and tech stack all
 * come from `computeGithubAnalytics`. This module only RE-ARRANGES and
 * WRITES copy around them. Pure functions — no network I/O, safe to
 * import type-only from client components.
 */

import type { CvModel } from "../cv-model";
import type { GithubAnalyticsData } from "../github-analytics";
import {
  AboutContent,
  BioVariant,
  PortfolioContent,
  PortfolioHero,
  PortfolioSource,
} from "./types";
import { PortfolioTheme, getDefaultTheme } from "./themes";
import { featuredProjects, topSkills } from "./generator-shared";

// ═══════════════════════════════════════════════════════════════════
// Pure helpers
// ═══════════════════════════════════════════════════════════════════

function headlineFromAnalytics(
  analytics: GithubAnalyticsData,
  years: number
): string {
  // Category → role label, derived from detected skills (languages carry
  // the most weight). Deterministic: first-match wins, with a safe default.
  const categories = new Set(analytics.skills.map((s) => s.category));
  let role = "Software Developer";
  if (categories.has("frontend") && categories.has("backend")) {
    role = "Full-Stack Developer";
  } else if (categories.has("frontend")) {
    role = "Frontend Developer";
  } else if (categories.has("backend")) {
    role = "Backend Developer";
  } else if (categories.has("mobile")) {
    role = "Mobile Developer";
  } else if (categories.has("data")) {
    role = "Data Engineer";
  } else if (categories.has("devops")) {
    role = "DevOps Engineer";
  }

  const topSkills = analytics.skills
    .filter((s) => s.confidence >= 0.7)
    .slice(0, 3)
    .map((s) => s.name);
  const suffix = topSkills.length > 0 ? ` | ${topSkills.join(", ")}` : "";
  const experience = years > 0 ? ` with ${years}+ years on GitHub` : "";
  return `${role}${experience}${suffix}`.slice(0, 120);
}

function aboutContent(
  hero: PortfolioHero,
  model: CvModel,
  analytics: GithubAnalyticsData
): AboutContent {
  const { profileReview, achievements, bestRepos } = analytics;
  const earned = achievements.filter((a) => a.earned);
  const focusAreas = analytics.skills
    .filter((s) => s.confidence >= 0.7)
    .slice(0, 5)
    .map((s) => s.name);

  const paragraphs: string[] = [];

  if (hero.bio) {
    paragraphs.push(hero.bio);
  } else {
    paragraphs.push(
      `${hero.name} is a software developer who builds with ${
        model.languages.slice(0, 3).map((l) => l.name).join(", ") || "modern technology"
      }.`
    );
  }

  const strongest = bestRepos[0];
  const achievementsText =
    earned.length > 0
      ? ` Across ${model.stats.repos} public repositories and ${model.stats.years} years on GitHub, notable highlights include ${earned
          .slice(0, 3)
          .map((a) => a.title.toLowerCase())
          .join(", ")}.`
      : ` Across ${model.stats.repos} public repositories and ${model.stats.years} years on GitHub.`;

  paragraphs.push(
    `Focus areas: ${focusAreas.join(", ") || "software engineering"}.${achievementsText}${
      strongest
        ? ` The strongest project is ${strongest.name} (${strongest.reasons[0] ?? "solid fundamentals"}).`
        : ""
    }`
  );

  const highlights = [
    ...(earned.length > 0 ? earned.slice(0, 3).map((a) => a.title) : []),
    ...profileReview.present.slice(0, 2),
  ];

  return { paragraphs, focusAreas, highlights };
}

function buildHero(
  source: PortfolioSource,
  model: CvModel
): PortfolioHero {
  const { profile } = source;
  const name = profile.name ?? profile.login;
  return {
    name,
    login: profile.login,
    headline: headlineFromAnalytics(source.analytics, model.stats.years),
    bio: profile.bio ?? "",
    avatarUrl: profile.avatarUrl,
    location: profile.location,
    website: profile.blog,
    followers: profile.followers,
    contacts: model.header.contacts,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════

/** Three tone variants of a short professional bio. */
export function generateBioVariants(
  source: PortfolioSource
): BioVariant[] {
  const { model, analytics, profile } = source;
  const name = profile.name ?? profile.login;
  const langs = model.languages.slice(0, 3).map((l) => l.name).join(", ");
  const topSkills = analytics.skills.slice(0, 4).map((s) => s.name).join(", ");
  const years = model.stats.years;

  const concise =
    profile.bio ||
    `${name} — software developer${langs ? ` working with ${langs}` : ""} for ${years}+ years.`;

  const professional =
    `${name} is a developer with ${years}+ years of open-source activity. ` +
    `Skilled in ${topSkills || "modern software engineering"}; ` +
    `${model.stats.stars} GitHub stars across ${model.stats.repos} public repositories.`;

  const creative =
    `${name} turns ideas into ${langs || "software"} — ` +
    `${model.stats.stars} stars and counting on GitHub. ${profile.bio ?? "Building in public."}`;

  return [
    { id: "concise", label: "Concise", text: concise },
    { id: "professional", label: "Professional", text: professional },
    { id: "creative", label: "Creative", text: creative },
  ];
}

/** Long-form About section. */
export function generateAbout(
  source: PortfolioSource
): AboutContent {
  const model = source.model;
  const hero = buildHero(source, model);
  return aboutContent(hero, model, source.analytics);
}

/** Full portfolio payload for a given theme. */
export function buildPortfolioContent(
  source: PortfolioSource,
  theme: PortfolioTheme = getDefaultTheme()
): PortfolioContent {
  const model = source.model;
  const hero = buildHero(source, model);

  return {
    hero,
    stats: {
      repos: model.stats.repos,
      stars: model.stats.stars,
      forks: model.stats.forks,
      years: model.stats.years,
    },
    about: aboutContent(hero, model, source.analytics),
    skills: topSkills(source.analytics),
    featuredProjects: featuredProjects(model, source.analytics),
    achievements: source.analytics.achievements,
    techStack: source.analytics.techStack,
    profileReview: source.analytics.profileReview,
    themeId: theme.id,
    generatedAt: new Date().toISOString(),
  };
}

/** Convenience: build bio + about + full content in one call. */
export function buildPortfolioBundle(
  source: PortfolioSource,
  theme: PortfolioTheme = getDefaultTheme()
): {
  bios: BioVariant[];
  about: AboutContent;
  portfolio: PortfolioContent;
} {
  return {
    bios: generateBioVariants(source),
    about: generateAbout(source),
    portfolio: buildPortfolioContent(source, theme),
  };
}

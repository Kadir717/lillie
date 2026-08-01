/**
 * Shared types for LILLIE's portfolio feature set.
 *
 * Everything here is deterministic (no AI — the AI layer is intentionally
 * dormant until production approval). Portfolio content is COMPOSED from
 * existing single-source-of-truth data:
 *   - CvModel (src/lib/cv-model.ts) — profile, stats, languages, projects
 *   - GithubAnalyticsData (src/lib/github-analytics.ts) — skills, achievements,
 *     best repos, project descriptions, profile review, tech stack
 * No generator re-implements logic that already exists in those modules.
 */

import type { CvModel } from "../cv-model";
import type { GithubAnalyticsData } from "../github-analytics";

/** A condensed personal summary, generated in a few tone variants. */
export interface BioVariant {
  id: "concise" | "professional" | "creative";
  label: string;
  text: string;
}

/** Long-form "About" section composed from profile + analytics. */
export interface AboutContent {
  paragraphs: string[];
  focusAreas: string[];
  highlights: string[];
}

/** Hero block of a portfolio site. */
export interface PortfolioHero {
  name: string;
  login: string;
  headline: string;
  bio: string;
  avatarUrl: string | null;
  location: string | null;
  website: string | null;
  followers: number;
  contacts: string[];
}

/** A featured project card for the portfolio. */
export interface PortfolioProject {
  name: string;
  url: string;
  description: string;
  language: string | null;
  topics: string[];
  stars: number;
  forks: number;
  highlight: string;
}

/** A skill shown on the portfolio, with category + confidence. */
export interface PortfolioSkill {
  name: string;
  category: string;
  confidence: number;
}

/** Full portfolio payload — the renderer-agnostic "site content". */
export interface PortfolioContent {
  hero: PortfolioHero;
  stats: {
    repos: number;
    stars: number;
    forks: number;
    years: number;
  };
  about: AboutContent;
  skills: PortfolioSkill[];
  featuredProjects: PortfolioProject[];
  achievements: GithubAnalyticsData["achievements"];
  techStack: GithubAnalyticsData["techStack"];
  profileReview: GithubAnalyticsData["profileReview"];
  themeId: string;
  generatedAt: string;
}

/** LinkedIn optimization payload. */
export interface LinkedinOptimization {
  headline: string;
  about: string[];
  skills: PortfolioSkill[];
  featuredProjects: PortfolioProject[];
  tips: string[];
}

/** Accepted export formats for the personal-website builder. */
export type PortfolioExportFormat = "json" | "html" | "markdown";

export const PORTFOLIO_EXPORT_FORMATS: PortfolioExportFormat[] = [
  "json",
  "html",
  "markdown",
];

/** The input bundle every portfolio generator consumes. */
export interface PortfolioSource {
  model: CvModel;
  analytics: GithubAnalyticsData;
  profile: {
    login: string;
    name: string | null;
    avatarUrl: string | null;
    bio: string | null;
    location: string | null;
    blog: string | null;
    followers: number;
    publicRepos: number;
  };
}

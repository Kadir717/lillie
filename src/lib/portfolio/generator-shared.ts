/**
 * LILLIE — Portfolio shared helpers
 *
 * The ONE ranking source for portfolio surfaces. Both the portfolio
 * generator (generator.ts) and the LinkedIn optimizer (linkedin.ts) import
 * `topSkills` and `featuredProjects` from here, so a project or skill never
 * ranks differently depending on which surface renders it.
 *
 * Pure functions — no network I/O.
 */

import type { CvModel } from "../cv-model";
import type { GithubAnalyticsData } from "../github-analytics";
import { PortfolioProject, PortfolioSkill } from "./types";

/** Top N detected skills, ranked by confidence (already sorted upstream). */
export function topSkills(
  analytics: GithubAnalyticsData,
  limit = 12
): PortfolioSkill[] {
  return analytics.skills
    .slice(0, limit)
    .map((s) => ({
      name: s.name,
      category: s.category,
      confidence: s.confidence,
    }));
}

/**
 * Top N featured projects. Project descriptions come from the analytics
 * module (projectDescriptions) when available — the same generator the CV
 * pipeline uses — and `bestRepos` marks the top picks. Never re-implements
 * project scoring.
 */
export function featuredProjects(
  model: CvModel,
  analytics: GithubAnalyticsData,
  limit = 6
): PortfolioProject[] {
  const descriptions = new Map(
    analytics.projectDescriptions.map((d) => [d.repo, d.description])
  );
  const bestNames = new Set(analytics.bestRepos.map((b) => b.name));

  return model.projects
    .slice(0, limit)
    .map((p) => ({
      name: p.name,
      url: p.url,
      description: descriptions.get(p.name) ?? p.description ?? "",
      language: p.language ?? null,
      topics: p.topics ?? [],
      stars: p.stars,
      forks: p.forks,
      highlight: bestNames.has(p.name)
        ? "Top project — ranked by health, stars and documentation."
        : "Featured project from your repository list.",
    }));
}

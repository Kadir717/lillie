/**
 * LILLIE — LinkedIn Optimization
 *
 * Deterministic LinkedIn profile copy composed from the same
 * single-source-of-truth data as the portfolio (CvModel + analytics).
 * Produces a headline, about paragraphs, a skill list and featured
 * projects — all ready to paste into LinkedIn. No AI.
 */

import { LinkedinOptimization, PortfolioSource } from "./types";
import { featuredProjects, topSkills } from "./generator-shared";

/**
 * Builds the LinkedIn optimization payload.
 * Reuses the SAME project selection and skill ranking as the portfolio
 * generator (via generator-shared) — one ranking, many surfaces.
 */
export function buildLinkedinOptimization(
  source: PortfolioSource
): LinkedinOptimization {
  const { model, analytics, profile } = source;

  // Headline: role + experience + top skills (same derivation as hero).
  const categories = new Set(analytics.skills.map((s) => s.category));
  let role = "Software Developer";
  if (categories.has("frontend") && categories.has("backend")) role = "Full-Stack Developer";
  else if (categories.has("frontend")) role = "Frontend Developer";
  else if (categories.has("backend")) role = "Backend Developer";
  else if (categories.has("mobile")) role = "Mobile Developer";
  else if (categories.has("data")) role = "Data Engineer";
  else if (categories.has("devops")) role = "DevOps Engineer";

  const topSkillNames = analytics.skills
    .filter((s) => s.confidence >= 0.7)
    .slice(0, 3)
    .map((s) => s.name);
  const experience = model.stats.years > 0 ? ` with ${model.stats.years}+ years on GitHub` : "";
  const headline = `${role}${experience} | ${topSkillNames.join(", ") || "Software Engineering"}`.slice(0, 120);

  // About: 2–3 short paragraphs optimized for LinkedIn scanning.
  const earned = analytics.achievements.filter((a) => a.earned);
  const langs = model.languages.slice(0, 4).map((l) => l.name).join(", ");

  const about: string[] = [];
  about.push(
    `${role} building with ${langs || "modern technology"}. ` +
      `${model.stats.stars}+ GitHub stars across ${model.stats.repos} public repositories.`
  );
  if (profile.bio) about.push(profile.bio);
  about.push(
    `What I bring: ${topSkillNames.slice(0, 5).join(", ") || "clean code and shipped projects"}.` +
      (earned.length > 0
        ? ` Recognized for ${earned.slice(0, 3).map((a) => a.title.toLowerCase()).join(", ")}.`
        : "")
  );

  const tips = [
    "Use the headline above as-is, or shorten it to the role + top two skills.",
    "Paste the About section, then trim to the first two paragraphs if your profile needs to be under 2,600 characters.",
    "Pin your top featured project to your profile — recruiters open the first project they see.",
    "Add the skills list to your 'Skills' section so recruiters can endorse you.",
    "Keep your GitHub link in your contact info — it is the strongest signal of shipped work.",
  ];

  return {
    headline,
    about,
    skills: topSkills(analytics),
    featuredProjects: featuredProjects(model, analytics, 3),
    tips,
  };
}

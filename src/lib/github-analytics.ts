/**
 * LILLIE — GitHub Analytics
 *
 * Deterministic, explainable analytics computed from the ALREADY-FETCHED
 * GithubAggregateData (src/lib/github.ts). Every score carries a
 * human-readable `explanation` so the UI can always say *why*.
 *
 * ── API usage ────────────────────────────────────────────────────
 * The only extra upstream call is README content for the top N repos
 * (`fetchTopReadmes`, server-side only, Promise.allSettled — a 404 or
 * rate limit degrades to `null` instead of failing the request).
 * Everything else is pure computation over data the CV pipeline already
 * fetched, so the dashboard pays one aggregate fetch + ≤3 readmes.
 *
 * ── Purity ───────────────────────────────────────────────────────
 * computeGithubAnalytics is a pure function (data in → analytics out).
 * It imports ONLY types from github.ts, so this module is safe to
 * import type-only from client components.
 */

import type { GithubAggregateData, RepoSummary } from "./github";
import { GithubAuthError, GithubRateLimitError, GithubApiError } from "./github";

const GITHUB_API = "https://api.github.com";
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

export interface ContributionAnalysis {
  totalRepos: number;
  nonForkRepos: number;
  totalStars: number;
  totalForks: number;
  yearsActive: number;
  avgStarsPerRepo: number;
  topStarredRepo: { name: string; stars: number } | null;
  mostRecentPush: string | null;
  /** % of sampled repos pushed within the last year. */
  recentActivityPct: number;
  explanation: string;
}

export interface RepoHealthScore {
  name: string;
  score: number;
  stars: number;
  forks: number;
  isRecent: boolean;
  hasDescription: boolean;
  /** null = README not checked for this repo. */
  hasReadme: boolean | null;
  topicCount: number;
  language: string | null;
  explanation: string;
  suggestions: string[];
}

export interface BestRepo {
  name: string;
  url: string;
  score: number;
  stars: number;
  forks: number;
  reasons: string[];
}

export interface ReadmeReview {
  repo: string;
  hasReadme: boolean;
  score: number;
  length: number;
  sections: string[];
  suggestions: string[];
  explanation: string;
}

export interface ProjectDescription {
  repo: string;
  description: string;
  keywords: string[];
}

export interface ProfileReview {
  score: number;
  present: string[];
  missing: string[];
  suggestions: string[];
  explanation: string;
}

export interface Achievement {
  id: string;
  title: string;
  icon: string;
  description: string;
  earned: boolean;
  metric: string;
}

export interface TechStackEntry {
  name: string;
  category: string;
  percent: number;
}

export interface DetectedSkill {
  name: string;
  category: string;
  confidence: number;
  source: "language-stats" | "topics" | "bio";
}

export interface AnalyticsExplanations {
  contribution: string;
  repoHealth: string;
  bestRepo: string;
  profile: string;
  skills: string;
}

export interface GithubAnalyticsData {
  // ── Existing sections (backward compatible) ────────────────────
  contributionSummary: {
    totalRepos: number;
    totalStars: number;
    totalForks: number;
    yearsActive: number;
  };
  repoHealth: {
    starredRepos: number;
    avgStars: number;
    recentlyActive: number;
  };
  languageDistribution: Array<{ name: string; bytes: number; percent: number }>;
  projectMaturity: {
    total: number;
    recent: number;
    stale: number;
    mostRecentUpdate: string | null;
  };

  // ── New sections ───────────────────────────────────────────────
  contribution: ContributionAnalysis;
  repoHealthScores: RepoHealthScore[];
  bestRepos: BestRepo[];
  readmeReviews: ReadmeReview[];
  projectDescriptions: ProjectDescription[];
  profileReview: ProfileReview;
  achievements: Achievement[];
  techStack: TechStackEntry[];
  skills: DetectedSkill[];
  explanation: AnalyticsExplanations;
}

export interface ReadmeMap {
  /** repo short name → raw README text, or null (missing / failed). */
  [repo: string]: string | null;
}

// ═══════════════════════════════════════════════════════════════════
// README fetching (server-side only)
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetches raw README text for the top `limit` repos.
 * 404 → null (no README). Any other failure → null (degraded, not fatal).
 * Uses the raw media type so we skip base64 decoding.
 */
export async function fetchTopReadmes(
  accessToken: string,
  username: string,
  repos: RepoSummary[],
  limit = 3
): Promise<ReadmeMap> {
  const targets = repos.slice(0, limit);
  const results = await Promise.allSettled(
    targets.map(async (repo) => {
      const res = await fetch(
        `${GITHUB_API}/repos/${username}/${repo.name}/readme`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.raw+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );
      if (res.status === 404) return null;
      if (!res.ok) {
        if (res.status === 401) throw new GithubAuthError();
        if (res.status === 403 || res.status === 429)
          throw new GithubRateLimitError();
        throw new GithubApiError(
          `README fetch failed (${res.status}): ${repo.name}`,
          res.status
        );
      }
      return await res.text();
    })
  );

  const map: ReadmeMap = {};
  results.forEach((result, i) => {
    map[targets[i].name] =
      result.status === "fulfilled" ? result.value : null;
  });
  return map;
}

// ═══════════════════════════════════════════════════════════════════
// Pure helpers
// ═══════════════════════════════════════════════════════════════════

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, (Date.now() - t) / (24 * 60 * 60 * 1000));
}

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

const LANGUAGE_CATEGORY: Record<string, string> = {
  typescript: "frontend",
  javascript: "frontend",
  html: "frontend",
  css: "frontend",
  scss: "frontend",
  "c#": "backend",
  "c++": "backend",
  c: "backend",
  python: "backend",
  java: "backend",
  go: "backend",
  php: "backend",
  ruby: "backend",
  rust: "backend",
  swift: "mobile",
  kotlin: "mobile",
  dart: "mobile",
  "objective-c": "mobile",
  sql: "data",
  r: "data",
  julia: "data",
  shell: "devops",
  powershell: "devops",
  dockerfile: "devops",
  hcl: "devops",
  makefile: "devops",
};

const TOPIC_SKILLS: Record<string, string> = {
  react: "React",
  "next.js": "Next.js",
  "nextjs": "Next.js",
  vue: "Vue.js",
  angular: "Angular",
  svelte: "Svelte",
  "node.js": "Node.js",
  nodejs: "Node.js",
  express: "Express",
  fastapi: "FastAPI",
  django: "Django",
  flask: "Flask",
  "spring-boot": "Spring Boot",
  docker: "Docker",
  kubernetes: "Kubernetes",
  terraform: "Terraform",
  "github-actions": "GitHub Actions",
  "ci/cd": "CI/CD",
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  mongodb: "MongoDB",
  redis: "Redis",
  sqlite: "SQLite",
  graphql: "GraphQL",
  websockets: "WebSockets",
  "machine-learning": "Machine Learning",
  "deep-learning": "Deep Learning",
  "natural-language-processing": "NLP",
  "computer-vision": "Computer Vision",
  "react-native": "React Native",
  flutter: "Flutter",
  testing: "Testing",
  jest: "Jest",
  cypress: "Cypress",
  playwright: "Playwright",
  "data-visualization": "Data Visualization",
  etl: "ETL",
  apis: "REST APIs",
  rest: "REST APIs",
};

/**
 * Topic → radar category. LANGUAGE_CATEGORY only knows language names,
 * so frameworks/tools need their own map (react→frontend, docker→devops,
 * postgresql→data, …) to show up on the tech stack radar.
 */
const TOPIC_CATEGORY: Record<string, string> = {
  react: "frontend",
  "next.js": "frontend",
  nextjs: "frontend",
  vue: "frontend",
  vuejs: "frontend",
  angular: "frontend",
  svelte: "frontend",
  tailwindcss: "frontend",
  "node.js": "backend",
  nodejs: "backend",
  express: "backend",
  fastapi: "backend",
  django: "backend",
  flask: "backend",
  "spring-boot": "backend",
  graphql: "backend",
  docker: "devops",
  kubernetes: "devops",
  terraform: "devops",
  "github-actions": "devops",
  "ci/cd": "devops",
  postgresql: "data",
  mysql: "data",
  mongodb: "data",
  redis: "data",
  sqlite: "data",
  typescript: "frontend",
  javascript: "frontend",
  python: "backend",
  go: "backend",
  rust: "backend",
  "react-native": "mobile",
  flutter: "mobile",
  swift: "mobile",
  kotlin: "mobile",
};

const BIO_SKILLS: Record<string, string> = [
  "full-stack",
  "full stack",
  "frontend",
  "front-end",
  "backend",
  "back-end",
  "devops",
  "machine learning",
  "data science",
  "data engineer",
  "mobile",
  "open source",
  "cloud",
  "security",
].reduce<Record<string, string>>((acc, kw) => {
  acc[kw] = kw
    .split(" ")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
  return acc;
}, {});

const README_SECTIONS: Array<{ key: string; patterns: RegExp[] }> = [
  { key: "Badges", patterns: [/shields\.io/i, /![^\]]*\([^)]*badge/i] },
  { key: "Installation", patterns: [/^#{1,2}\s*installation/im, /^#{1,2}\s*getting started/im, /\bnpm install\b/i, /\bpip install\b/i] },
  { key: "Usage", patterns: [/^#{1,2}\s*usage/im, /^#{1,2}\s*examples?/im, /^#{1,2}\s*how to use/im] },
  { key: "Contributing", patterns: [/^#{1,2}\s*contributing/im, /^#{1,2}\s*development/im, /^#{1,2}\s*building from source/im] },
  { key: "License", patterns: [/^#{1,2}\s*license/im, /\bmit license\b/i, /\bapache license\b/i, /\bgpl\b/i] },
  { key: "Documentation", patterns: [/^#{1,2}\s*api/im, /^#{1,2}\s*reference/im, /^#{1,2}\s*documentation/im] },
];

// ═══════════════════════════════════════════════════════════════════
// Feature computations
// ═══════════════════════════════════════════════════════════════════

function computeContribution(data: GithubAggregateData): ContributionAnalysis {
  const { profile, topRepos, totalStars, totalForks, contributionYears } = data;
  const nonForkRepos = topRepos.length;
  const avgStarsPerRepo = nonForkRepos > 0 ? Math.round(totalStars / nonForkRepos) : 0;

  const topStarred =
    topRepos.length > 0
      ? topRepos.reduce((best, r) =>
          r.stargazersCount > best.stargazersCount ? r : best
        )
      : null;

  const pushedDates = topRepos
    .map((r) => r.pushedAt)
    .filter((d): d is string => typeof d === "string" && d.length > 0);
  const mostRecentPush =
    pushedDates.length > 0
      ? pushedDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
      : null;

  const recentlyActive = topRepos.filter((r) => {
    const days = daysSince(r.pushedAt);
    return days !== null && days <= 365;
  }).length;

  const recentActivityPct = pct(recentlyActive, nonForkRepos);

  const explanation =
    nonForkRepos === 0
      ? "No non-fork repositories found to analyze."
      : `${nonForkRepos} projects, ${totalStars} stars and ${totalForks} forks over ${contributionYears} year${
          contributionYears === 1 ? "" : "s"
        }. ` +
        `${recentActivityPct}% of projects were updated in the last year` +
        (topStarred ? `; ${topStarred.name} leads with ${topStarred.stargazersCount} stars.` : ".");

  return {
    totalRepos: profile.publicRepos,
    nonForkRepos,
    totalStars,
    totalForks,
    yearsActive: contributionYears,
    avgStarsPerRepo,
    topStarredRepo: topStarred
      ? { name: topStarred.name, stars: topStarred.stargazersCount }
      : null,
    mostRecentPush,
    recentActivityPct,
    explanation,
  };
}

function computeRepoHealth(
  repos: RepoSummary[],
  readmes: ReadmeMap
): RepoHealthScore[] {
  return repos.map((repo) => {
    let score = 0;
    const suggestions: string[] = [];
    const bits: string[] = [];

    // Stars — up to 30 points (diminishing returns after ~30 stars)
    const starPts = Math.min(30, repo.stargazersCount);
    score += starPts;
    if (repo.stargazersCount > 0)
      bits.push(`${repo.stargazersCount} stars`);

    // Recency — up to 25 points
    const days = daysSince(repo.pushedAt);
    const isRecent = days !== null && days <= 365;
    if (days === null) {
      score += 4;
      bits.push("unknown activity");
    } else if (days <= 90) {
      score += 25;
      bits.push("updated recently");
    } else if (days <= 365) {
      score += 18;
      bits.push("updated within the last year");
    } else if (days <= 730) {
      score += 10;
      bits.push("last updated 1–2 years ago");
    } else {
      score += 4;
      bits.push("dormant for 2+ years");
      suggestions.push("Consider reviving this project or archiving it.");
    }

    // Description — 15 points
    if (repo.description) {
      score += 15;
      bits.push("has a description");
    } else {
      suggestions.push("Add a one-line description to this repository.");
    }

    // README — 15 points (only when we actually checked).
    // NOTE: fetchTopReadmes only fetches the repos being scored, so every
    // scored repo is either true/false (checked) or null (map has no key).
    const readmeText = readmes[repo.name];
    const hasReadme =
      repo.name in readmes
        ? typeof readmeText === "string" && readmeText.length > 0
        : null;
    if (hasReadme === true) {
      score += 15;
      bits.push("has a README");
    } else if (hasReadme === false) {
      suggestions.push("Add a README so visitors understand the project.");
    } else {
      bits.push("README not checked");
    }

    // Topics — up to 10 points
    const topicPts = Math.min(10, repo.topics.length * 2);
    score += topicPts;
    if (repo.topics.length === 0)
      suggestions.push("Add topics to help people discover this repository.");

    // Language — 5 points
    if (repo.language) score += 5;

    score = Math.min(100, score);

    const explanation = `Health ${score}/100 — ${bits.join(", ") || "no data yet"}.`;

    return {
      name: repo.name,
      score,
      stars: repo.stargazersCount,
      forks: repo.forksCount,
      isRecent,
      hasDescription: Boolean(repo.description),
      hasReadme,
      topicCount: repo.topics.length,
      language: repo.language,
      explanation,
      suggestions,
    };
  });
}

function computeBestRepos(
  repos: RepoSummary[],
  healthScores: RepoHealthScore[]
): BestRepo[] {
  const scored = repos.map((repo) => {
    const health = healthScores.find((h) => h.name === repo.name);
    let score = 0;
    const reasons: string[] = [];

    // Stars — 40 points (log-ish scale)
    const starScore = Math.min(40, repo.stargazersCount);
    score += starScore;
    if (starScore > 0)
      reasons.push(`top visibility with ${repo.stargazersCount} stars`);
    else reasons.push("no stars yet — early-stage project");

    // Forks — 15 points
    score += Math.min(15, repo.forksCount);
    if (repo.forksCount > 0)
      reasons.push(`${repo.forksCount} forks show community interest`);

    // Recency — 20 points
    const days = daysSince(repo.pushedAt);
    if (days !== null && days <= 365) {
      score += 20;
      reasons.push("actively maintained in the last year");
    } else if (days !== null) {
      score += 8;
    }

    // Documentation — 25 points (description + README + topics)
    if (repo.description) score += 10;
    if (health?.hasReadme === true) score += 10;
    else if (health?.hasReadme === null) reasons.push("README not checked");
    score += Math.min(5, repo.topics.length);
    if (repo.description && (health?.hasReadme === true) && repo.topics.length > 0)
      reasons.push("well documented with description, README and topics");

    return { repo, score: Math.min(100, score), reasons };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ repo, score, reasons }) => ({
      name: repo.name,
      url: repo.htmlUrl,
      score,
      stars: repo.stargazersCount,
      forks: repo.forksCount,
      reasons:
        reasons.length > 0
          ? reasons
          : ["consistent project with solid fundamentals"],
    }));
}

function reviewReadme(repo: string, text: string | null | undefined): ReadmeReview {
  if (!text || text.trim().length === 0) {
    return {
      repo,
      hasReadme: false,
      score: 0,
      length: 0,
      sections: [],
      suggestions: ["Add a README — it is the first thing recruiters and users read."],
      explanation: "No README detected for this repository.",
    };
  }

  const length = text.length;
  const sections = README_SECTIONS.filter((s) =>
    s.patterns.some((p) => p.test(text))
  ).map((s) => s.key);

  // Length — up to 30 points
  let lengthPts = 0;
  if (length >= 2000) lengthPts = 30;
  else if (length >= 1000) lengthPts = 24;
  else if (length >= 400) lengthPts = 16;
  else lengthPts = 8;

  // Sections — up to 50 points (~8.3 each)
  const sectionPts = Math.round((sections.length / README_SECTIONS.length) * 50);

  // Badges bonus — 20 points (counted in sections already if "Badges" found;
  // give a small extra bump when shields.io badges exist)
  const badgeBonus = /shields\.io/i.test(text) ? 20 : 0;

  const score = Math.min(100, lengthPts + sectionPts + badgeBonus);

  const suggestions: string[] = [];
  if (length < 400) suggestions.push("README is very short — expand it with setup and usage instructions.");
  if (!sections.includes("Installation")) suggestions.push("Add an Installation section so others can run the project.");
  if (!sections.includes("Usage")) suggestions.push("Add a Usage/Examples section.");
  if (!sections.includes("License")) suggestions.push("Add a License section — many employers check this.");
  if (!sections.includes("Contributing")) suggestions.push("Consider a Contributing section to invite collaboration.");
  if (!/shields\.io/i.test(text)) suggestions.push("Add badges (build status, license, stars) via shields.io for a professional look.");

  const explanation = `README quality ${score}/100 — ${sections.length}/${README_SECTIONS.length} standard sections detected${sections.length ? ` (${sections.join(", ")})` : ""}.`;

  return { repo, hasReadme: true, score, length, sections, suggestions, explanation };
}

function generateProjectDescription(repo: RepoSummary): ProjectDescription {
  const name = repo.name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const parts: string[] = [];
  if (repo.description) {
    parts.push(repo.description.replace(/\.$/, ""));
  } else {
    const base = `${name}${repo.language ? ` — a ${repo.language} project` : ""}`;
    parts.push(base);
  }

  const details: string[] = [];
  if (repo.topics.length > 0)
    details.push(`built around ${repo.topics.slice(0, 3).join(", ")}`);
  if (repo.stargazersCount > 0)
    details.push(`${repo.stargazersCount} stars on GitHub`);
  const days = daysSince(repo.pushedAt);
  if (days !== null && days <= 365) details.push("actively maintained");

  const description = details.length
    ? `${parts[0]} — ${details.join(", ")}.`
    : `${parts[0]}.`;

  return {
    repo: repo.name,
    description,
    keywords: [repo.language, ...repo.topics].filter((k): k is string => Boolean(k)),
  };
}

function computeProfileReview(
  data: GithubAggregateData,
  readmes: ReadmeMap
): ProfileReview {
  const { profile, topRepos } = data;
  let score = 0;
  const present: string[] = [];
  const missing: string[] = [];

  if (profile.bio) { score += 20; present.push("bio"); }
  else missing.push("bio");
  if (profile.email) { score += 10; present.push("email"); }
  else missing.push("email");
  if (profile.location) { score += 10; present.push("location"); }
  else missing.push("location");
  if (profile.blog) { score += 10; present.push("website/blog"); }
  else missing.push("website/blog");
  if (profile.company) { score += 10; present.push("company"); }
  else missing.push("company");
  if (profile.followers >= 10) { score += 10; present.push("10+ followers"); }
  else missing.push("more followers");
  if (profile.publicRepos >= 3) { score += 10; present.push("3+ public repositories"); }
  else missing.push("more public repositories");

  const readmeCount = topRepos.filter((r) => {
    const t = readmes[r.name];
    return typeof t === "string" && t.length > 0;
  }).length;
  if (readmeCount >= 1) { score += 20; present.push("documented repositories"); }
  else missing.push("documented repositories (READMEs)");

  const suggestions: string[] = [];
  if (missing.includes("bio"))
    suggestions.push("Add a bio that summarizes what you build and care about.");
  if (missing.includes("website/blog"))
    suggestions.push("Link a personal site or blog — it adds credibility.");
  if (missing.includes("more followers"))
    suggestions.push("Engage with the community (stars, issues, PRs) to grow your reach.");
  if (missing.includes("documented repositories (READMEs)"))
    suggestions.push("Add READMEs to your top repositories.");
  if (suggestions.length === 0)
    suggestions.push("Profile looks complete — great job!");

  return {
    score,
    present,
    missing,
    suggestions,
    explanation: `Profile completeness ${score}/100 — ${present.length} of 8 checkpoints met.`,
  };
}

function computeAchievements(
  data: GithubAggregateData,
  readmes: ReadmeMap
): Achievement[] {
  const { totalStars, totalForks, contributionYears, topRepos, languages } = data;
  const distinctLanguages = Object.keys(languages).length;
  const recentActive = topRepos.filter((r) => {
    const d = daysSince(r.pushedAt);
    return d !== null && d <= 365;
  }).length;
  const documentedRepos = topRepos.filter((r) => {
    const t = readmes[r.name];
    return typeof t === "string" && t.length > 0;
  }).length;

  const achievements: Array<Omit<Achievement, "earned" | "metric"> & { earned: boolean; metric: string }> = [
    {
      id: "star-collector",
      title: "Star Collector",
      icon: "⭐",
      description: "Earned 100+ stars across your repositories.",
      earned: totalStars >= 100,
      metric: `${totalStars} stars`,
    },
    {
      id: "polyglot",
      title: "Polyglot",
      icon: "🗣️",
      description: "Worked in 5+ programming languages.",
      earned: distinctLanguages >= 5,
      metric: `${distinctLanguages} languages`,
    },
    {
      id: "early-adopter",
      title: "Early Adopter",
      icon: "🌅",
      description: "Coding on GitHub for 5+ years.",
      earned: contributionYears >= 5,
      metric: `${contributionYears} years`,
    },
    {
      id: "active-maintainer",
      title: "Active Maintainer",
      icon: "🔧",
      description: "Updated 3+ repositories in the last year.",
      earned: recentActive >= 3,
      metric: `${recentActive} active repos`,
    },
    {
      id: "open-source-citizen",
      title: "Open Source Citizen",
      icon: "🌍",
      description: "Published 10+ public repositories.",
      earned: data.profile.publicRepos >= 10,
      metric: `${data.profile.publicRepos} repos`,
    },
    {
      id: "documentation-advocate",
      title: "Documentation Advocate",
      icon: "📖",
      description: "Maintained READMEs on multiple repositories.",
      earned: documentedRepos >= 2,
      metric: `${documentedRepos} documented repos`,
    },
    {
      id: "community-builder",
      title: "Community Builder",
      icon: "🤝",
      description: "Your projects received 50+ forks.",
      earned: totalForks >= 50,
      metric: `${totalForks} forks`,
    },
  ];

  return achievements;
}

function computeTechStack(data: GithubAggregateData): TechStackEntry[] {
  const { languages, topRepos } = data;
  const totalBytes = Object.values(languages).reduce((a, b) => a + b, 0);

  const categoryBytes: Record<string, number> = {};
  for (const [lang, bytes] of Object.entries(languages)) {
    const category = LANGUAGE_CATEGORY[lang.toLowerCase()] ?? "other";
    categoryBytes[category] = (categoryBytes[category] ?? 0) + bytes;
  }

  // Fold framework/tool topics into the radar when they map to a category.
  // TOPIC_CATEGORY (not LANGUAGE_CATEGORY) because topics like react,
  // docker and kubernetes are not language names.
  const topicCategoryBytes: Record<string, number> = {};
  for (const repo of topRepos) {
    for (const topic of repo.topics) {
      // Language-as-topic tags (java, c++, sql, …) fall back to LANGUAGE_CATEGORY.
      const category =
        TOPIC_CATEGORY[topic.toLowerCase()] ??
        LANGUAGE_CATEGORY[topic.toLowerCase()];
      if (category && category !== "other") {
        topicCategoryBytes[category] = (topicCategoryBytes[category] ?? 0) + 1;
      }
    }
  }

  const entries: TechStackEntry[] = [];
  for (const [category, bytes] of Object.entries(categoryBytes)) {
    entries.push({
      name: category[0].toUpperCase() + category.slice(1),
      category,
      percent: pct(bytes, totalBytes),
    });
  }
  // Topic signal: +8 radar share per recognized category, capped at 40.
  // Frameworks/tools therefore show up even for very small codebases.
  // NOTE: `percent` here is a relative weight (byte share + topic boosts),
  // not an exact byte share — it is a radar indicator, not a histogram.
  for (const [category, count] of Object.entries(topicCategoryBytes)) {
    const existing = entries.find((e) => e.category === category);
    const boost = Math.min(40, count * 8);
    if (existing) {
      existing.percent = Math.min(100, existing.percent + boost);
    } else {
      entries.push({
        name: category[0].toUpperCase() + category.slice(1),
        category,
        percent: boost,
      });
    }
  }

  entries.sort((a, b) => b.percent - a.percent);
  return entries;
}

function detectSkills(data: GithubAggregateData): DetectedSkill[] {
  const { languages, topRepos, profile } = data;
  const skills = new Map<string, DetectedSkill>();

  // Languages — high confidence from byte stats
  const totalBytes = Object.values(languages).reduce((a, b) => a + b, 0);
  for (const [lang, bytes] of Object.entries(languages)) {
    if (totalBytes > 0 && bytes / totalBytes >= 0.03) {
      skills.set(lang, {
        name: lang,
        category: LANGUAGE_CATEGORY[lang.toLowerCase()] ?? "language",
        confidence: 0.9,
        source: "language-stats",
      });
    }
  }

  // Topics — medium confidence
  for (const repo of topRepos) {
    for (const topic of repo.topics) {
      const skill = TOPIC_SKILLS[topic.toLowerCase()];
      if (skill && !skills.has(skill)) {
        skills.set(skill, {
          name: skill,
          category: "tool",
          confidence: 0.7,
          source: "topics",
        });
      }
    }
  }

  // Bio keywords — lower confidence
  if (profile.bio) {
    const bio = profile.bio.toLowerCase();
    for (const [kw, label] of Object.entries(BIO_SKILLS)) {
      if (bio.includes(kw) && !skills.has(label)) {
        skills.set(label, {
          name: label,
          category: "concept",
          confidence: 0.5,
          source: "bio",
        });
      }
    }
  }

  return [...skills.values()]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 15);
}

// ═══════════════════════════════════════════════════════════════════
// Orchestrator
// ═══════════════════════════════════════════════════════════════════

/**
 * Computes the full analytics payload from already-fetched aggregate data.
 * Pure — no network I/O. README content (if any) is passed in via `readmes`.
 */
export function computeGithubAnalytics(
  data: GithubAggregateData,
  readmes: ReadmeMap = {}
): GithubAnalyticsData {
  const { profile, topRepos, languages, totalStars, totalForks } = data;

  const contribution = computeContribution(data);
  const repoHealthScores = computeRepoHealth(topRepos, readmes);
  const bestRepos = computeBestRepos(topRepos, repoHealthScores);
  // Review exactly the repos whose READMEs were actually fetched — no magic
  // number to drift from fetchTopReadmes' limit.
  const readmeReviews = topRepos
    .filter((r) => r.name in readmes)
    .map((r) => reviewReadme(r.name, readmes[r.name]));
  const projectDescriptions = topRepos.slice(0, 3).map(generateProjectDescription);
  const profileReview = computeProfileReview(data, readmes);
  const achievements = computeAchievements(data, readmes);
  const techStack = computeTechStack(data);
  const skills = detectSkills(data);

  // ── Existing sections, kept for backward compatibility ─────────
  const totalBytes = Object.values(languages).reduce((a, b) => a + b, 0);
  const languageDistribution = Object.entries(languages)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([name, bytes]) => ({ name, bytes, percent: pct(bytes, totalBytes) }));

  const starredRepos = topRepos.filter((r) => r.stargazersCount > 0).length;
  const avgStars = topRepos.length > 0 ? Math.round(totalStars / topRepos.length) : 0;
  const recentlyActive = topRepos.filter((r) => {
    const d = daysSince(r.pushedAt);
    return d !== null && d <= 365;
  }).length;

  const now = Date.now();
  const projectMaturity = {
    total: topRepos.length,
    recent: topRepos.filter((r) => new Date(r.pushedAt).getTime() > now - YEAR_MS).length,
    stale: topRepos.filter((r) => new Date(r.pushedAt).getTime() < now - 2 * YEAR_MS).length,
    mostRecentUpdate:
      topRepos.length > 0
        ? topRepos.sort(
            (a, b) => new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime()
          )[0].pushedAt
        : null,
  };

  const explanation: AnalyticsExplanations = {
    contribution: contribution.explanation,
    repoHealth:
      repoHealthScores.length === 0
        ? "No repositories to score."
        : `Average repository health is ${Math.round(
            repoHealthScores.reduce((a, h) => a + h.score, 0) / repoHealthScores.length
          )}/100 across ${repoHealthScores.length} repositories.`,
    bestRepo:
      bestRepos.length === 0
        ? "No repositories to rank."
        : `${bestRepos[0].name} is your strongest repository — ${bestRepos[0].reasons.join(", ")}.`,
    profile: profileReview.explanation,
    skills:
      skills.length === 0
        ? "No skills detected yet."
        : `Detected ${skills.length} skills from languages, topics and your bio.`,
  };

  return {
    contributionSummary: {
      totalRepos: profile.publicRepos,
      totalStars,
      totalForks,
      yearsActive: data.contributionYears,
    },
    repoHealth: { starredRepos, avgStars, recentlyActive },
    languageDistribution,
    projectMaturity,

    contribution,
    repoHealthScores,
    bestRepos,
    readmeReviews,
    projectDescriptions,
    profileReview,
    achievements,
    techStack,
    skills,
    explanation,
  };
}

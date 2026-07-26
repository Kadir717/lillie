/**
 * Aggregates GitHub data needed to build a CV or progress dashboard.
 * Uses the authenticated user's token so private repo stats can be included
 * later if we add that as a paid tier feature.
 *
 * ── Error Types ──────────────────────────────────────────────────
 * All functions in this module throw typed errors:
 *   - GithubAuthError      → token expired/invalid (HTTP 401)
 *   - GithubRateLimitError → rate limited (HTTP 403/429)
 *   - GithubApiError       → any other GitHub API failure
 *   - Error                → unexpected internal failures
 *
 * API routes should catch these and return appropriate HTTP status codes:
 *   - GithubAuthError      → 502 (upstream auth failure)
 *   - GithubRateLimitError → 429
 *   - GithubApiError       → 502 (bad gateway)
 *   - Error                → 500
 */

const GITHUB_API = "https://api.github.com";

// ── Custom Error Types ───────────────────────────────────────────

export class GithubApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "GithubApiError";
  }
}

export class GithubAuthError extends GithubApiError {
  constructor(message = "GitHub token expired or invalid") {
    super(message, 401);
    this.name = "GithubAuthError";
  }
}

export class GithubRateLimitError extends GithubApiError {
  constructor(message = "GitHub API rate limit exceeded") {
    super(message, 429);
    this.name = "GithubRateLimitError";
  }
}

// ── HTTP Client ──────────────────────────────────────────────────

function headers(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/**
 * Wrapped fetch that throws typed errors on non-2xx responses.
 * Distinguishes auth failures, rate limits, and generic errors.
 */
async function fetchJson(url: string, accessToken: string): Promise<unknown> {
  const res = await fetch(url, { headers: headers(accessToken) });

  if (!res.ok) {
    if (res.status === 401) {
      throw new GithubAuthError();
    }
    if (res.status === 403 || res.status === 429) {
      throw new GithubRateLimitError(
        `GitHub API rate limit exceeded (${res.status}): ${url}`
      );
    }
    throw new GithubApiError(
      `GitHub API request failed (${res.status}): ${url}`,
      res.status
    );
  }

  return res.json();
}

// ── Types ────────────────────────────────────────────────────────

export interface GithubProfile {
  login: string;
  name: string | null;
  bio: string | null;
  avatarUrl: string;
  location: string | null;
  blog: string | null;
  email: string | null;
  company: string | null;
  followers: number;
  publicRepos: number;
  createdAt: string;
}

export interface RepoSummary {
  name: string;
  description: string | null;
  htmlUrl: string;
  language: string | null;
  stargazersCount: number;
  forksCount: number;
  topics: string[];
  pushedAt: string;
  fork: boolean;
}

export interface LanguageStats {
  [language: string]: number; // bytes of code, used to compute percentages
}

export interface GithubAggregateData {
  profile: GithubProfile;
  topRepos: RepoSummary[];
  languages: LanguageStats;
  totalStars: number;
  totalForks: number;
  contributionYears: number;
}

// ── Data Functions ───────────────────────────────────────────────

export async function fetchGithubProfile(accessToken: string): Promise<GithubProfile> {
  const data = (await fetchJson(`${GITHUB_API}/user`, accessToken)) as Record<string, unknown>;
  return {
    login: data.login as string,
    name: (data.name as string) ?? null,
    bio: (data.bio as string) ?? null,
    avatarUrl: data.avatar_url as string,
    location: (data.location as string) ?? null,
    blog: (data.blog as string) ?? null,
    email: (data.email as string) ?? null,
    company: (data.company as string) ?? null,
    followers: (data.followers as number) ?? 0,
    publicRepos: (data.public_repos as number) ?? 0,
    createdAt: data.created_at as string,
  };
}

export async function fetchUserRepos(
  accessToken: string,
  username: string
): Promise<RepoSummary[]> {
  // Sorted by most recently pushed; first 100 is plenty for CV purposes
  const data = (await fetchJson(
    `${GITHUB_API}/users/${username}/repos?sort=pushed&direction=desc&per_page=100`,
    accessToken
  )) as Array<Record<string, unknown>>;

  return data.map((repo) => ({
    name: repo.name as string,
    description: (repo.description as string) ?? null,
    htmlUrl: repo.html_url as string,
    language: (repo.language as string) ?? null,
    stargazersCount: (repo.stargazers_count as number) ?? 0,
    forksCount: (repo.forks_count as number) ?? 0,
    topics: ((repo.topics as string[]) ?? []) as string[],
    pushedAt: repo.pushed_at as string,
    fork: (repo.fork as boolean) ?? false,
  }));
}

/**
 * Builds a language-byte-count map across all (non-fork) repos.
 * This is what powers the "Top Languages" section in both the CV and dashboard.
 */
export async function fetchLanguageStats(
  accessToken: string,
  repos: RepoSummary[]
): Promise<LanguageStats> {
  const nonForkRepos = repos.filter((r) => !r.fork).slice(0, 30); // cap to avoid rate limits
  const aggregated: LanguageStats = {};

  // GitHub rate-limits aggressively; run in small batches rather than all at once
  const BATCH_SIZE = 5;
  for (let i = 0; i < nonForkRepos.length; i += BATCH_SIZE) {
    const batch = nonForkRepos.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((repo) =>
        // Use the shared headers() helper which already includes
        // Authorization, Accept, and X-GitHub-Api-Version.
        fetch(`${GITHUB_API}/repos/${repo.name}/languages`, {
          headers: headers(accessToken),
        }).then((r) => (r.ok ? r.json() : {}))
      )
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        for (const [lang, bytes] of Object.entries(result.value as Record<string, number>)) {
          aggregated[lang] = (aggregated[lang] || 0) + bytes;
        }
      }
    }
  }

  return aggregated;
}

/**
 * Full aggregation used by both the CV generator and the dashboard SVG.
 * Owner-qualified repo names are required for the languages endpoint, so
 * we rebuild full_name on the repos before passing them down.
 */
export async function fetchGithubAggregate(
  accessToken: string,
  username: string
): Promise<GithubAggregateData> {
  const profile = await fetchGithubProfile(accessToken);
  const rawRepos = await fetchUserRepos(accessToken, username);

  // fetchUserRepos returns `name` only; languages endpoint needs `owner/repo`
  const reposWithFullName = rawRepos.map((r) => ({
    ...r,
    name: `${username}/${r.name}`,
  }));

  const languages = await fetchLanguageStats(accessToken, reposWithFullName);

  const topRepos = [...rawRepos]
    .filter((r) => !r.fork)
    .sort((a, b) => b.stargazersCount - a.stargazersCount)
    .slice(0, 6);

  const totalStars = rawRepos.reduce((sum, r) => sum + r.stargazersCount, 0);
  const totalForks = rawRepos.reduce((sum, r) => sum + r.forksCount, 0);
  const contributionYears =
    new Date().getFullYear() - new Date(profile.createdAt).getFullYear() + 1;

  return {
    profile,
    topRepos,
    languages,
    totalStars,
    totalForks,
    contributionYears,
  };
}

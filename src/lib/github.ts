/**
 * Aggregates GitHub data needed to build a CV or progress dashboard.
 * Uses the authenticated user's token so private repo stats can be included
 * later if we add that as a paid tier feature.
 */

const GITHUB_API = "https://api.github.com";

function headers(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

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

async function fetchJson(url: string, accessToken: string) {
  const res = await fetch(url, { headers: headers(accessToken) });
  if (!res.ok) {
    throw new Error(`GitHub API request failed (${res.status}): ${url}`);
  }
  return res.json();
}

export async function fetchGithubProfile(accessToken: string): Promise<GithubProfile> {
  const data = await fetchJson(`${GITHUB_API}/user`, accessToken);
  return {
    login: data.login,
    name: data.name,
    bio: data.bio,
    avatarUrl: data.avatar_url,
    location: data.location,
    blog: data.blog,
    email: data.email,
    company: data.company,
    followers: data.followers,
    publicRepos: data.public_repos,
    createdAt: data.created_at,
  };
}

export async function fetchUserRepos(
  accessToken: string,
  username: string
): Promise<RepoSummary[]> {
  // Sorted by most recently pushed; first 100 is plenty for CV purposes
  const data = await fetchJson(
    `${GITHUB_API}/users/${username}/repos?sort=pushed&direction=desc&per_page=100`,
    accessToken
  );

  return (data as Array<Record<string, unknown>>).map((repo) => ({
    name: repo.name as string,
    description: repo.description as string | null,
    htmlUrl: repo.html_url as string,
    language: repo.language as string | null,
    stargazersCount: repo.stargazers_count as number,
    forksCount: repo.forks_count as number,
    topics: (repo.topics as string[]) || [],
    pushedAt: repo.pushed_at as string,
    fork: repo.fork as boolean,
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
        fetch(`${GITHUB_API}/repos/${repo.name}/languages`, {
          headers: headers(accessToken),
        }).then((r) => (r.ok ? r.json() : {}))
      )
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        for (const [lang, bytes] of Object.entries(result.value)) {
          aggregated[lang] = (aggregated[lang] || 0) + (bytes as number);
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

  return { profile, topRepos, languages, totalStars, totalForks, contributionYears };
}

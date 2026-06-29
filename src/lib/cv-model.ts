import type { GithubAggregateData } from "./github";

/**
 * CvModel — pure data shape for a CV, independent of rendering library.
 * No docx imports here. Any renderer (docx, PDF, HTML) can consume this.
 */
export type CvModel = {
    header: {
        name: string;
        bio?: string;
        contacts: string[];
    };
    stats: {
        repos: number;
        stars: number;
        forks: number;
        years: number;
    };
    languages: { name: string; percent: number }[];
    projects: {
        name: string;
        url: string;
        stars: number;
        forks: number;
        description?: string;
        language?: string;
        topics?: string[];
    }[];
};

function computeLanguagePercentages(
    languages: Record<string, number>,
    max = 5
): { name: string; percent: number }[] {
    const total = Object.values(languages).reduce((a, b) => a + b, 0);
    if (total === 0) return [];

    return Object.entries(languages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, max)
        .map(([name, bytes]) => ({
            name,
            percent: Math.round((bytes / total) * 100),
        }));
}

function buildContacts(profile: GithubAggregateData["profile"]): string[] {
    const contacts: string[] = [];
    if (profile.location) contacts.push(profile.location);
    if (profile.email) contacts.push(profile.email);
    contacts.push(`github.com/${profile.login}`);
    if (profile.blog) contacts.push(profile.blog);
    return contacts;
}

/**
 * Maps raw GitHub aggregate data into the template-agnostic CvModel.
 * This is the ONLY place that knows about GithubAggregateData shape.
 */
export function mapGithubToCvModel(data: GithubAggregateData): CvModel {
    const { profile, topRepos, languages, totalStars, totalForks, contributionYears } = data;

    return {
        header: {
            name: profile.name || profile.login,
            bio: profile.bio || undefined,
            contacts: buildContacts(profile),
        },
        stats: {
            repos: profile.publicRepos,
            stars: totalStars,
            forks: totalForks,
            years: contributionYears,
        },
        languages: computeLanguagePercentages(languages),
        projects: topRepos.map((repo) => ({
            name: repo.name.split("/").pop() || repo.name,
            url: repo.htmlUrl,
            stars: repo.stargazersCount,
            forks: repo.forksCount,
            description: repo.description || undefined,
            language: repo.language || undefined,
            topics: repo.topics.length > 0 ? repo.topics : undefined,
        })),
    };
}
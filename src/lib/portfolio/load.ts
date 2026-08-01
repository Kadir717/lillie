/**
 * LILLIE — Portfolio loader (server-side only)
 *
 * Centralizes the data fetch every portfolio route needs. Each route calls
 * `loadPortfolioSource(session)` instead of re-implementing the GitHub
 * aggregate + README + analytics + CvModel pipeline — one place to fetch,
 * one place to map, consistent error typing.
 */

import { fetchGithubAggregate } from "../github";
import { computeGithubAnalytics, fetchTopReadmes } from "../github-analytics";
import { mapGithubToCvModel } from "../cv-model";
import { PortfolioSource } from "./types";

/**
 * Fetches aggregate GitHub data (cached per request by React `cache()` in
 * the fetch layer), plus READMEs for the top repos, and maps everything
 * into the `PortfolioSource` bundle the generators consume.
 *
 * Throws the same typed GitHub errors (GithubAuthError,
 * GithubRateLimitError, GithubApiError) as the rest of the app — routes
 * map them to HTTP status codes.
 */
export async function loadPortfolioSource(
  accessToken: string,
  username: string
): Promise<PortfolioSource> {
  const data = await fetchGithubAggregate(accessToken, username);

  // README content for the top repos (degraded to null on 404/failure).
  const readmes = await fetchTopReadmes(accessToken, username, data.topRepos);

  const model = mapGithubToCvModel(data);
  const analytics = computeGithubAnalytics(data, readmes);

  return {
    model,
    analytics,
    profile: {
      login: data.profile.login,
      name: data.profile.name,
      avatarUrl: data.profile.avatarUrl ?? null,
      bio: data.profile.bio ?? null,
      location: data.profile.location ?? null,
      blog: data.profile.blog ?? null,
      followers: data.profile.followers,
      publicRepos: data.profile.publicRepos,
    },
  };
}

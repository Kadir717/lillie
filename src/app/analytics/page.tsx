import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { fetchGithubAggregate } from "@/lib/github";
import {
  computeGithubAnalytics,
  fetchTopReadmes,
  type GithubAnalyticsData,
} from "@/lib/github-analytics";
import AppShell from "@/components/AppShell";
import GitHubAnalyticsPanel from "@/components/GitHubAnalyticsPanel";

/**
 * /analytics — dedicated full-width GitHub Analytics page.
 *
 * Uses the same shared computation pipeline as the dashboard
 * (fetchGithubAggregate → fetchTopReadmes → computeGithubAnalytics), so
 * there is no duplicated analytics logic to keep in sync.
 *
 * NOTE: the daily growth snapshot (upsertGithubSnapshot) intentionally runs
 * ONLY on the dashboard — it is not recorded here so a single daily snapshot
 * is never written twice.
 *
 * If the GitHub fetch fails, `insights` is null and GitHubAnalyticsPanel
 * renders its own fallback (nothing) — no extra error UI needed.
 */
export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  let insights: GithubAnalyticsData | null = null;

  try {
    const githubData = await fetchGithubAggregate(
      session.githubAccessToken,
      session.githubUsername
    );

    // README content for the top repos (degraded to null on 404/failure).
    const readmes = await fetchTopReadmes(
      session.githubAccessToken,
      session.githubUsername,
      githubData.topRepos
    );

    insights = computeGithubAnalytics(githubData, readmes);
  } catch {
    // Panel renders its own fallback for null insights.
  }

  return (
    <AppShell active="analytics" username={session.githubUsername} contentWidth="full">
      <GitHubAnalyticsPanel initialData={insights} />
    </AppShell>
  );
}

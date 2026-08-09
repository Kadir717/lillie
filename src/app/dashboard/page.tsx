import { redirect } from "next/navigation";
import Image from "next/image";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchGithubAggregate } from "@/lib/github";
import { mapGithubToCvModel } from "@/lib/cv-model";
import {
  computeGithubAnalytics,
  fetchTopReadmes,
  type GithubAnalyticsData,
} from "@/lib/github-analytics";
import { upsertGithubSnapshot } from "@/lib/analytics/growth";
import AppShell from "@/components/AppShell";
import CvPreviewPanel from "@/components/CvPreviewPanel";
import GitHubInsights from "@/components/GitHubInsights";
import GitHubAnalyticsPanel from "@/components/GitHubAnalyticsPanel";
import type { CvProfileData } from "@/components/ProfileSelector";
import {
  AISummaryCard,
  SkillsCard,
  AchievementsCard,
} from "@/components/ai";

// Note: all analytics computation now lives in src/lib/github-analytics.ts
// (computeGithubAnalytics) — shared by the dashboard AND /api/github/insights,
// so there is no duplicated computation logic to keep in sync.

export default async function Dashboard() {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  // ── Fetch user identity ─────────────────────────────────────────
  const user = await prisma.user.findUnique({
    where: { githubId: session.githubId },
    select: {
      id: true,
      locale: true,
      template: true,
    },
  });

  // ── Fetch saved preferences ─────────────────────────────────────
  let initialPrefs: { locale: string; template: string } | null = null;
  if (user) {
    initialPrefs = { locale: user.locale, template: user.template };
  }

  // ── Fetch profiles ──────────────────────────────────────────────
  let profiles: CvProfileData[] = [];
  if (user) {
    try {
      const rows = await prisma.cvProfile.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          locale: true,
          template: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      profiles = rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }));
    } catch {
      // Profiles unavailable — component will use defaults
    }
  }

  // ── Fetch GitHub data once, derive model + analytics ───────────
  let cvModel: ReturnType<typeof mapGithubToCvModel> | null = null;
  let insights: GithubAnalyticsData | null = null;

  try {
    const githubData = await fetchGithubAggregate(
      session.githubAccessToken,
      session.githubUsername
    );
    cvModel = mapGithubToCvModel(githubData);

    // README content for the top repos (degraded to null on 404/failure).
    const readmes = await fetchTopReadmes(
      session.githubAccessToken,
      session.githubUsername,
      githubData.topRepos
    );

    insights = computeGithubAnalytics(githubData, readmes);

    // ── Record daily GitHub growth snapshot (fire-and-forget) ───
    if (user) {
      void upsertGithubSnapshot({
        userId: user.id,
        stars: githubData.totalStars,
        repos: githubData.profile.publicRepos,
        forks: githubData.totalForks,
        followers: githubData.profile.followers,
      });
    }
  } catch {
    // Components will show their fallback error states
  }

  return (
    <AppShell active="dashboard" username={session.githubUsername}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar: insights + user card */}
        <aside className="lg:col-span-1 space-y-6">
          {/* User card */}
          <div className="bg-cloud border border-line rounded-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <Image
                src={session.githubAvatarUrl}
                alt={session.githubUsername}
                width={48}
                height={48}
                className="w-12 h-12 rounded-full border border-line"
              />
              <div>
                <p className="font-medium text-sm text-ink">
                  {session.githubUsername}
                </p>
                <p className="text-xs text-slate">Signed in with GitHub</p>
              </div>
            </div>
            <a
              href="/settings"
              className="inline-block text-xs text-signal hover:text-signal/80 transition-colors"
            >
              Edit profile settings →
            </a>
          </div>

          {/* GitHub Insights — data provided server-side, no client fetch */}
          <GitHubInsights initialData={insights} />
        </aside>

        {/* Main: CV preview */}
        <section className="lg:col-span-2">
          <CvPreviewPanel
            initialPrefs={initialPrefs}
            initialProfiles={profiles}
            initialModel={cvModel}
          />
        </section>
      </div>

      {/* ── GitHub Analytics — full width, below the sidebar grid ── */}
      {insights && (
        <div className="mt-10">
          <GitHubAnalyticsPanel initialData={insights} />
        </div>
      )}

      {/* ── AI Insights Section ────────────────────────────── */}
      <section className="mt-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-ink flex items-center gap-2">
            <span>AI Insights</span>
            <span className="text-[10px] uppercase tracking-widest text-signal bg-signal-tint px-2 py-0.5 rounded-full">
              Coming Soon
            </span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AISummaryCard />
          <SkillsCard />
          <AchievementsCard />
        </div>
      </section>
    </AppShell>
  );
}

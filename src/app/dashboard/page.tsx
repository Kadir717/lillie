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
    <main className="min-h-screen bg-ink text-cream">
      {/* Top navigation bar */}
      <header className="border-b border-coffee/20 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-lg font-semibold tracking-tight text-amber">
              LILLIE
            </span>
          </div>
          <nav className="flex items-center gap-4">
            <a
              href="/dashboard"
              className="text-sm text-cream/60 hover:text-cream transition-colors"
            >
              Dashboard
            </a>
            <a
              href="/jobs"
              className="text-sm text-cream/40 hover:text-cream transition-colors"
            >
              Jobs
            </a>
            <a
              href="/settings"
              className="text-sm text-cream/40 hover:text-cream transition-colors"
            >
              Settings
            </a>
            <span className="text-sm text-cream/30">|</span>
            <span className="text-sm text-cream/50">{session.githubUsername}</span>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="text-sm text-cream/40 hover:text-cream/70 transition-colors"
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar: insights + user card */}
          <aside className="lg:col-span-1 space-y-6">
            {/* User card */}
            <div className="bg-coffee/10 border border-coffee/20 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <Image
                  src={session.githubAvatarUrl}
                  alt={session.githubUsername}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full border border-coffee"
                />
                <div>
                  <p className="font-medium text-sm">{session.githubUsername}</p>
                  <p className="text-xs text-cream/40">Signed in with GitHub</p>
                </div>
              </div>
              <a
                href="/settings"
                className="inline-block text-xs text-cream/40 hover:text-cream/70 transition-colors"
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

            {/* ── GitHub Analytics — explainable, computed server-side ── */}
            {insights && (
              <div className="mt-10">
                <GitHubAnalyticsPanel initialData={insights} />
              </div>
            )}

            {/* ── AI Insights Section ────────────────────────────── */}
            <section className="mt-10">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-cream flex items-center gap-2">
                  <span>AI Insights</span>
                  <span className="text-[10px] uppercase tracking-widest text-amber/60 bg-amber/10 px-2 py-0.5 rounded-full">
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
          </section>
        </div>
      </div>
    </main>
  );
}

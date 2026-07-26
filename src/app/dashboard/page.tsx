import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import CvPreviewPanel from "@/components/CvPreviewPanel";
import GitHubInsights from "@/components/GitHubInsights";
import type { CvProfileData } from "@/components/ProfileSelector";

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
      // Prisma returns Date for DateTime fields; CvProfileData expects strings.
      // Next.js serializes Date objects when passing server→client props, but
      // TypeScript requires an explicit conversion for strict compatibility.
      profiles = rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }));
    } catch {
      // Profiles unavailable — component will use defaults
    }
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
                <img
                  src={session.githubAvatarUrl}
                  alt={session.githubUsername}
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

            {/* GitHub Insights */}
            <GitHubInsights />
          </aside>

          {/* Main: CV preview */}
          <section className="lg:col-span-2">
            <CvPreviewPanel
              initialPrefs={initialPrefs}
              initialProfiles={profiles}
            />
          </section>
        </div>
      </div>
    </main>
  );
}

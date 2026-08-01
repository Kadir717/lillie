import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import JobsPanel, { type JobListItem } from "@/components/JobsPanel";
import type { JobStatus, JobPriority } from "@/lib/jobs/types";

/**
 * Jobs page — job application tracking.
 *
 * Server component: authenticates, loads the user's tracked jobs via Prisma
 * (same shape as GET /api/jobs) and passes them to the client <JobsPanel>,
 * which handles all mutations through the existing jobs API. No fake data,
 * no placeholders — the list is always the user's real rows.
 */
export default async function JobsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  let jobs: JobListItem[] = [];
  let loadError = false;

  try {
    const user = await prisma.user.findUnique({
      where: { githubId: session.githubId },
      select: { id: true },
    });
    if (user) {
      const rows = await prisma.job.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          company: true,
          title: true,
          url: true,
          status: true,
          priority: true,
          matchScore: true,
          appliedAt: true,
          deadline: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      jobs = rows.map((j) => ({
        ...j,
        status: j.status as JobStatus,
        priority: j.priority as JobPriority,
        appliedAt: j.appliedAt?.toISOString() ?? null,
        deadline: j.deadline?.toISOString() ?? null,
        createdAt: j.createdAt.toISOString(),
        updatedAt: j.updatedAt.toISOString(),
      }));
    }
  } catch {
    // DB unavailable — panel shows its error state
    loadError = true;
  }

  return (
    <main className="min-h-screen bg-ink text-cream">
      {/* Top navigation bar */}
      <header className="border-b border-coffee/20 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a
              href="/dashboard"
              className="text-lg font-semibold tracking-tight text-amber"
            >
              LILLIE
            </a>
          </div>
          <nav className="flex items-center gap-4">
            <a
              href="/dashboard"
              className="text-sm text-cream/60 hover:text-cream transition-colors"
            >
              Dashboard
            </a>
            <span className="text-sm text-cream">Jobs</span>
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
        <JobsPanel initialJobs={jobs} initialError={loadError} />
      </div>
    </main>
  );
}

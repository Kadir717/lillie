import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchGithubAggregate } from "@/lib/github";
import { mapGithubToCvModel } from "@/lib/cv-model";
import AppShell from "@/components/AppShell";
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

  // Fetch the CvModel once (same pattern as the dashboard, minus the
  // analytics computation) so the client JobsPanel can pass it to the
  // tailor AI tool. No snapshot write here — the dashboard owns that.
  let cvModel: ReturnType<typeof mapGithubToCvModel> | null = null;
  try {
    const githubData = await fetchGithubAggregate(
      session.githubAccessToken,
      session.githubUsername
    );
    cvModel = mapGithubToCvModel(githubData);
  } catch {
    // Model unavailable — the AI advice button degrades gracefully.
  }

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
          description: true,
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
    <AppShell active="jobs" username={session.githubUsername}>
      <JobsPanel initialJobs={jobs} initialError={loadError} model={cvModel} />
    </AppShell>
  );
}

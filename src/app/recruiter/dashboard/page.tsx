import { redirect } from "next/navigation";
import { getRecruiterSession } from "@/lib/recruiter-auth";
import { prisma } from "@/lib/db";
import RecruiterFitPanel, {
  RecruiterSignOutButton,
} from "@/components/RecruiterFitPanel";

/**
 * Recruiter dashboard.
 *
 * Server component: guards the route with a recruiter session (redirects
 * to /recruiter/login when absent) and renders the client-side
 * <RecruiterFitPanel>, passing the recruiter's identity from the database.
 *
 * The header is deliberately minimal (a title + sign out) — the shared
 * <AppShell> is not used here because it is GitHub-OAuth-User specific
 * (fixed nav links, username prop).
 */
export default async function RecruiterDashboardPage() {
  const session = await getRecruiterSession();
  if (!session) {
    redirect("/recruiter/login");
  }

  // ── Identity for the header + panel ─────────────────────────────
  // The JWT payload only carries email; companyName lives in the DB.
  // Best-effort: if the DB is unavailable, fall back to the session email.
  let email = session.email;
  let companyName: string | null = null;
  try {
    const recruiter = await prisma.recruiter.findUnique({
      where: { id: session.recruiterId },
      select: { email: true, companyName: true },
    });
    if (recruiter) {
      email = recruiter.email;
      companyName = recruiter.companyName;
    }
  } catch {
    // DB unavailable — fall back to session identity
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line bg-cloud">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <p className="font-semibold tracking-tight">LILLIE Recruiter</p>
          <div className="flex items-center gap-4">
            <span className="hidden sm:block text-sm text-slate">{email}</span>
            <RecruiterSignOutButton />
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <RecruiterFitPanel email={email} companyName={companyName} />
      </div>
    </main>
  );
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { fetchGithubAggregate } from "@/lib/github";
import CvPreviewPanel from "@/components/CvPreviewPanel";

export default async function Dashboard() {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  let hasData = true;
  let loadError = false;
  try {
    await fetchGithubAggregate(session.githubAccessToken, session.githubUsername);
  } catch {
    hasData = false;
    loadError = true;
  }

  return (
    <main className="min-h-screen bg-ink text-cream px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <img
              src={session.githubAvatarUrl}
              alt={session.githubUsername}
              className="w-10 h-10 rounded-full border border-coffee"
            />
            <div>
              <p className="font-medium">{session.githubUsername}</p>
              <p className="text-xs text-cream/40">Signed in with GitHub</p>
            </div>
          </div>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="text-sm text-cream/50 hover:text-cream/80 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>

        {loadError && (
          <div className="bg-coffee/30 border border-coffee rounded-xl p-6 text-center mb-8">
            <p className="text-amber-bright font-medium mb-1">
              Couldn&apos;t load your GitHub data
            </p>
            <p className="text-sm text-cream/60">
              GitHub might be rate-limiting us — give it a minute and refresh.
            </p>
          </div>
        )}

        <CvPreviewPanel hasData={hasData} />
      </div>
    </main>
  );
}
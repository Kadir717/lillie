import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { fetchGithubAggregate } from "@/lib/github";
import DownloadButton from "@/components/DownloadButton";

export default async function Dashboard() {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  let data;
  let loadError = false;

  try {
    data = await fetchGithubAggregate(session.githubAccessToken, session.githubUsername);
  } catch {
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

        {data && (
          <div className="bg-paper text-ink rounded-2xl shadow-2xl shadow-black/40 p-8 sm:p-10 mb-8">
            <div className="flex items-center justify-between mb-6 border-b border-coffee/15 pb-4">
              <div>
                <p className="font-display text-2xl font-semibold">
                  {data.profile.name || data.profile.login}
                </p>
                {data.profile.bio && (
                  <p className="text-sm text-coffee/70 italic">{data.profile.bio}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-6">
              {[
                [String(data.profile.publicRepos), "Repos"],
                [String(data.totalStars), "Stars"],
                [String(data.totalForks), "Forks"],
                [String(data.contributionYears), "Years"],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="bg-cream/60 rounded-lg py-3 text-center border border-coffee/10"
                >
                  <p className="font-display text-xl font-bold text-amber">{value}</p>
                  <p className="text-[10px] uppercase tracking-wide text-coffee/60">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-xs uppercase tracking-wide text-coffee/50 mb-2">
              Top Projects
            </p>
            <ul className="space-y-1">
              {data.topRepos.slice(0, 4).map((repo) => (
                <li key={repo.name} className="text-sm text-coffee/80">
                  <span className="font-medium text-amber">
                    {repo.name.split("/").pop()}
                  </span>{" "}
                  — {repo.description || "No description"}
                </li>
              ))}
            </ul>
          </div>
        )}

        <DownloadButton disabled={!data} />
      </div>
    </main>
  );
}

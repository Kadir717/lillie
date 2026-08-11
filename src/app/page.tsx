import Link from "next/link";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const errorMessages: Record<string, string> = {
    github_denied: "You declined GitHub access — no worries, try again whenever.",
    invalid_state: "That login link expired. Please try signing in again.",
    auth_failed: "Something went wrong talking to GitHub. Please try again.",
    missing_params: "That didn't look like a valid login attempt.",
  };

  const params = await searchParams;
  const error = params?.error ? errorMessages[params.error] : null;

  return (
    <main className="min-h-screen bg-ink text-cream overflow-hidden">
      {/* Subtle grain/texture backdrop */}
      <div className="relative">
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #c9842f 0%, transparent 35%), radial-gradient(circle at 80% 60%, #e0993f 0%, transparent 30%)",
          }}
        />

        <section className="relative max-w-3xl mx-auto px-6 pt-24 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-coffee/60 text-amber-bright text-xs tracking-wide uppercase mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-bright" />
            Built for developers, by a developer
          </div>

          <h1 className="font-display text-5xl sm:text-6xl leading-[1.05] tracking-tight mb-6">
            Your GitHub already
            <br />
            <span className="text-amber-bright">wrote your story.</span>
            <br />
            We just tell it better.
          </h1>

          <p className="text-lg text-cream/70 max-w-xl mx-auto mb-10 leading-relaxed">
            Sign in with GitHub, and LILLIE turns your real commits, repos, and
            languages into a polished CV — then goes further: match your profile
            to real job postings, track applications, and get AI-powered advice
            at every step. No forms. No fluff.
          </p>

          {error && (
            <p className="mb-6 text-sm text-amber-bright/90 bg-coffee/30 border border-coffee rounded-lg px-4 py-3 max-w-md mx-auto">
              {error}
            </p>
          )}

          <Link
            href="/api/auth/login"
            className="inline-flex items-center gap-3 bg-amber hover:bg-amber-bright transition-colors text-ink font-semibold px-8 py-4 rounded-xl text-lg shadow-lg shadow-amber/20"
          >
            <GithubMark />
            Continue with GitHub
          </Link>

          <p className="mt-4 text-xs text-cream/40">
            Free preview, no credit card. We only read public profile data.
          </p>
        </section>

        {/* Preview mockup: a "torn page" CV preview to anchor the promise visually */}
        <section className="relative max-w-2xl mx-auto px-6 pb-28">
          <div className="bg-paper text-ink rounded-2xl shadow-2xl shadow-black/50 p-8 sm:p-10 -rotate-1 border border-coffee/10">
            <div className="flex items-center justify-between mb-6 border-b border-coffee/15 pb-4">
              <div>
                <p className="font-display text-2xl font-semibold">Ada Lovelace</p>
                <p className="text-sm text-coffee/70 italic">
                  Backend engineer who ships in Rust and regrets nothing
                </p>
              </div>
              <span className="text-xs text-coffee/40">github.com/ada</span>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-6">
              {[
                ["42", "Repos"],
                ["1.2k", "Stars"],
                ["318", "Forks"],
                ["6", "Years"],
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
              Top Languages
            </p>
            <p className="text-sm text-coffee/80 mb-6">
              Rust (48%) · TypeScript (27%) · Python (15%) · Go (10%)
            </p>

            <p className="text-xs uppercase tracking-wide text-coffee/50 mb-2">
              Featured Project
            </p>
            <p className="text-sm font-medium text-amber">analytical-engine</p>
            <p className="text-sm text-coffee/70">
              A distributed task scheduler with zero-downtime deploys.
            </p>
          </div>
          <p className="text-center text-xs text-cream/30 mt-4">
            This is what shows up in your downloaded .docx — real data, real fast.
          </p>
        </section>
      </div>
    </main>
  );
}

function GithubMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.332-1.756-1.332-1.756-1.09-.744.083-.729.083-.729 1.205.084 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.776.42-1.305.763-1.605-2.665-.303-5.467-1.332-5.467-5.93 0-1.31.469-2.382 1.236-3.222-.124-.303-.535-1.523.118-3.176 0 0 1.008-.322 3.302 1.23a11.5 11.5 0 016.005 0c2.293-1.552 3.3-1.23 3.3-1.23.654 1.653.243 2.873.12 3.176.77.84 1.235 1.912 1.235 3.222 0 4.61-2.807 5.624-5.479 5.92.43.37.814 1.1.814 2.218 0 1.602-.015 2.892-.015 3.286 0 .322.218.694.825.576C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

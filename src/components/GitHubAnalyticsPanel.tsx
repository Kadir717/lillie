"use client";

import type { GithubAnalyticsData, Achievement } from "@/lib/github-analytics";

/**
 * GitHubAnalyticsPanel — rich, explainable GitHub analytics.
 *
 * Pure presentation: receives the already-computed analytics payload via
 * props (from the dashboard server component) and renders it. No fetching,
 * no business logic, no duplicate computation. Every section shows the
 * human-readable `explanation` the backend attached, so numbers always
 * come with a reason.
 *
 * The compact summary cards (contribution summary, repo health, languages,
 * maturity) remain in the sidebar `GitHubInsights` widget; this panel adds
 * the deeper sections: health scores, best repos, contribution analysis,
 * tech stack radar, skill detection, achievements, profile review, README
 * reviews and generated project descriptions.
 */
export default function GitHubAnalyticsPanel({
  initialData,
}: {
  initialData: GithubAnalyticsData | null;
}) {
  if (!initialData) return null;

  const { explanation } = initialData;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-cream flex items-center gap-2">
          <span>GitHub Analytics</span>
          <span className="text-[10px] uppercase tracking-widest text-amber/60 bg-amber/10 px-2 py-0.5 rounded-full">
            Explainable
          </span>
        </h2>
      </div>

      {/* ── Explainability: why these numbers ─────────────────── */}
      <div className="bg-coffee/10 border border-coffee/20 rounded-xl p-5 space-y-2">
        <h3 className="text-xs uppercase tracking-wide text-cream/40 mb-2">
          At a glance
        </h3>
        {[
          explanation.contribution,
          explanation.repoHealth,
          explanation.bestRepo,
          explanation.skills,
        ]
          .filter(Boolean)
          .map((line) => (
            <p key={line} className="text-sm text-cream/70 leading-relaxed">
              {line}
            </p>
          ))}
      </div>

      {/* ── Repository Health Scores ──────────────────────────── */}
      {initialData.repoHealthScores.length > 0 && (
        <Card title="Repository Health Score">
          <div className="space-y-3">
            {initialData.repoHealthScores.map((repo) => (
              <div key={repo.name} className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-cream/80 truncate">
                    {repo.name}
                  </span>
                  <span
                    className={`text-sm font-bold shrink-0 ${
                      repo.score >= 70
                        ? "text-emerald-400"
                        : repo.score >= 40
                          ? "text-amber"
                          : "text-red-400"
                    }`}
                  >
                    {repo.score}/100
                  </span>
                </div>
                <div className="h-1.5 bg-coffee/30 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      repo.score >= 70
                        ? "bg-emerald-400"
                        : repo.score >= 40
                          ? "bg-amber"
                          : "bg-red-400"
                    }`}
                    style={{ width: `${repo.score}%` }}
                  />
                </div>
                <p className="text-[11px] text-cream/40">{repo.explanation}</p>
                {repo.suggestions.length > 0 && (
                  <ul className="pl-4 list-disc space-y-0.5">
                    {repo.suggestions.map((s) => (
                      <li key={s} className="text-[11px] text-cream/50">
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Best Repositories ─────────────────────────────────── */}
      {initialData.bestRepos.length > 0 && (
        <Card title="Best Repositories">
          <div className="space-y-3">
            {initialData.bestRepos.map((repo, i) => (
              <div
                key={repo.name}
                className="bg-ink/40 border border-coffee/20 rounded-lg p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg shrink-0">
                      {["🥇", "🥈", "🥉"][i] ?? "⭐"}
                    </span>
                    <a
                      href={repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-amber hover:text-amber-bright truncate transition-colors"
                    >
                      {repo.name}
                    </a>
                  </div>
                  <span className="text-xs text-cream/50 shrink-0">
                    {repo.score}/100
                  </span>
                </div>
                <p className="text-[11px] text-cream/50 mt-1">
                  {repo.reasons.join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Contribution Analysis ─────────────────────────────── */}
      <Card title="Contribution Analysis">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <StatBox label="Avg stars/repo" value={initialData.contribution.avgStarsPerRepo} />
          <StatBox label="Active (1yr)" value={`${initialData.contribution.recentActivityPct}%`} />
          <StatBox label="Years active" value={initialData.contribution.yearsActive} />
          <StatBox
            label="Top starred"
            value={initialData.contribution.topStarredRepo?.stars ?? 0}
          />
        </div>
        {initialData.contribution.topStarredRepo && (
          <p className="text-xs text-cream/60">
            Strongest project:{" "}
            <span className="text-amber">
              {initialData.contribution.topStarredRepo.name}
            </span>{" "}
            with {initialData.contribution.topStarredRepo.stars} stars.
          </p>
        )}
        {initialData.contribution.mostRecentPush && (
          <p className="text-xs text-cream/40 mt-1">
            Last push: {new Date(initialData.contribution.mostRecentPush).toLocaleDateString()}
          </p>
        )}
      </Card>

      {/* ── Tech Stack Radar ──────────────────────────────────── */}
      {initialData.techStack.length > 0 && (
        <Card title="Tech Stack Radar">
          <div className="space-y-2">
            {initialData.techStack.map((entry) => (
              <div key={entry.name} className="flex items-center gap-3">
                <span className="text-sm text-cream/80 w-24 truncate shrink-0">
                  {entry.name}
                </span>
                <div className="flex-1 h-2 bg-coffee/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(entry.percent, 2)}%` }}
                  />
                </div>
                <span className="text-xs text-cream/50 w-10 text-right shrink-0">
                  {entry.percent}%
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Skill Detection ───────────────────────────────────── */}
      {initialData.skills.length > 0 && (
        <Card title="Detected Skills">
          <div className="flex flex-wrap gap-2">
            {initialData.skills.map((skill) => (
              <span
                key={skill.name}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs transition-colors"
                style={{
                  borderColor:
                    skill.confidence >= 0.8
                      ? "rgba(201,132,47,0.5)"
                      : skill.confidence >= 0.6
                        ? "rgba(201,132,47,0.3)"
                        : "rgba(201,132,47,0.15)",
                  color: skill.confidence >= 0.8 ? "#e0993f" : "rgba(245,237,225,0.7)",
                }}
              >
                {skill.name}
                <span className="text-[9px] opacity-50">
                  {Math.round(skill.confidence * 100)}%
                </span>
              </span>
            ))}
          </div>
          <p className="text-[11px] text-cream/40 mt-2">
            Confidence: languages (90%) · topics (70%) · bio (50%)
          </p>
        </Card>
      )}

      {/* ── Achievements ──────────────────────────────────────── */}
      <Card title="Achievements">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {initialData.achievements.map((a: Achievement) => (
            <div
              key={a.id}
              className={`rounded-lg border p-3 text-center transition-colors ${
                a.earned
                  ? "bg-amber/10 border-amber/30"
                  : "bg-ink/30 border-coffee/20 opacity-50"
              }`}
            >
              <p className="text-xl mb-1">{a.icon}</p>
              <p className="text-xs font-semibold text-cream">{a.title}</p>
              <p className="text-[10px] text-cream/50 mt-0.5">
                {a.metric}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* ── GitHub Profile Review ─────────────────────────────── */}
      <Card title="GitHub Profile Review">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl font-bold text-amber">
            {initialData.profileReview.score}
          </span>
          <span className="text-xs text-cream/50">
            /100 · {initialData.profileReview.present.length} of 8 checkpoints met
          </span>
        </div>
        {initialData.profileReview.missing.length > 0 && (
          <p className="text-xs text-cream/60 mb-2">
            Missing:{" "}
            <span className="text-cream/40">
              {initialData.profileReview.missing.join(", ")}
            </span>
          </p>
        )}
        <ul className="pl-4 list-disc space-y-1">
          {initialData.profileReview.suggestions.map((s) => (
            <li key={s} className="text-xs text-cream/60">
              {s}
            </li>
          ))}
        </ul>
      </Card>

      {/* ── README Review ─────────────────────────────────────── */}
      {initialData.readmeReviews.length > 0 && (
        <Card title="README Review">
          <div className="space-y-3">
            {initialData.readmeReviews.map((review) => (
              <div key={review.repo} className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-cream/80 truncate">
                    {review.repo}
                  </span>
                  <span
                    className={`text-sm font-bold shrink-0 ${
                      review.score >= 70
                        ? "text-emerald-400"
                        : review.score >= 40
                          ? "text-amber"
                          : "text-red-400"
                    }`}
                  >
                    {review.hasReadme ? `${review.score}/100` : "No README"}
                  </span>
                </div>
                {review.hasReadme ? (
                  <>
                    <p className="text-[11px] text-cream/40">
                      {review.explanation}
                    </p>
                    {review.sections.length > 0 && (
                      <p className="text-[11px] text-cream/50">
                        Sections: {review.sections.join(", ")}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] text-cream/40">
                    {review.suggestions[0]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Project Description Generator ─────────────────────── */}
      {initialData.projectDescriptions.length > 0 && (
        <Card title="Generated Project Descriptions">
          <div className="space-y-3">
            {initialData.projectDescriptions.map((pd) => (
              <div key={pd.repo} className="space-y-1">
                <p className="text-sm text-cream/80 font-medium">{pd.repo}</p>
                <p className="text-xs text-cream/60 leading-relaxed">
                  {pd.description}
                </p>
                {pd.keywords.length > 0 && (
                  <p className="text-[11px] text-cream/40">
                    Keywords: {pd.keywords.join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </section>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-coffee/10 border border-coffee/20 rounded-xl p-5">
      <h3 className="text-xs uppercase tracking-wide text-cream/40 mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-ink/40 border border-coffee/20 rounded-lg px-3 py-2">
      <p className="text-lg font-bold text-amber">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-cream/40">
        {label}
      </p>
    </div>
  );
}

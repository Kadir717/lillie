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
 * Design tokens: GitHub-derived data is always `grid` (green) — score bars,
 * tech-stack radar, contribution stats. `signal` (purple) is reserved for
 * user-triggered actions and appears nowhere in this panel.
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
        <h2 className="text-base font-semibold text-ink flex items-center gap-2">
          <span>GitHub Analytics</span>
          <span className="text-[10px] uppercase tracking-widest text-grid bg-grid-tint px-2 py-0.5 rounded-full">
            Explainable
          </span>
        </h2>
      </div>

      {/* ── Explainability: why these numbers ─────────────────── */}
      <div className="bg-paper border border-line rounded-card p-5 space-y-2">
        <h3 className="text-xs uppercase tracking-wide text-slate mb-2">
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
            <p key={line} className="text-sm text-slate leading-relaxed">
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
                  <span className="text-sm text-ink truncate">{repo.name}</span>
                  <span className="text-sm font-bold font-mono text-grid shrink-0">
                    {repo.score}/100
                  </span>
                </div>
                <ScoreBar value={repo.score} />
                <p className="text-[11px] text-slate">{repo.explanation}</p>
                {repo.suggestions.length > 0 && (
                  <ul className="pl-4 list-disc space-y-0.5">
                    {repo.suggestions.map((s) => (
                      <li key={s} className="text-[11px] text-slate">
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
                className="bg-paper border border-line rounded-lg p-3"
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
                      className="text-sm text-ink font-medium hover:text-signal truncate transition-colors"
                    >
                      {repo.name}
                    </a>
                  </div>
                  <span className="text-xs font-semibold font-mono text-grid shrink-0">
                    {repo.score}/100
                  </span>
                </div>
                <ScoreBar value={repo.score} className="mt-1.5" />
                <p className="text-[11px] text-slate mt-1.5">
                  {repo.reasons.join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Contribution Analysis ─────────────────────────────── */}
      <Card title="Contribution Analysis">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <StatBox label="Avg stars/repo" value={initialData.contribution.avgStarsPerRepo} />
          <StatBox label="Years active" value={initialData.contribution.yearsActive} />
          <StatBox
            label="Top starred"
            value={initialData.contribution.topStarredRepo?.stars ?? 0}
          />
        </div>
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate">Active in the last year</span>
            <span className="text-xs font-semibold font-mono text-grid">
              {initialData.contribution.recentActivityPct}%
            </span>
          </div>
          <ScoreBar value={initialData.contribution.recentActivityPct} />
        </div>
        {initialData.contribution.topStarredRepo && (
          <p className="text-xs text-slate">
            Strongest project:{" "}
            <span className="text-ink font-medium">
              {initialData.contribution.topStarredRepo.name}
            </span>{" "}
            with {initialData.contribution.topStarredRepo.stars} stars.
          </p>
        )}
        {initialData.contribution.mostRecentPush && (
          <p className="text-xs text-slate mt-1 font-mono">
            Last push:{" "}
            {new Date(initialData.contribution.mostRecentPush).toLocaleDateString()}
          </p>
        )}
      </Card>

      {/* ── Tech Stack Radar ──────────────────────────────────── */}
      {initialData.techStack.length > 0 && (
        <Card title="Tech Stack Radar">
          <div className="space-y-2">
            {initialData.techStack.map((entry) => (
              <div key={entry.name} className="flex items-center gap-3">
                <span className="text-sm text-ink w-24 truncate shrink-0">
                  {entry.name}
                </span>
                <div className="flex-1 h-2 bg-line rounded-full overflow-hidden">
                  <div
                    className="h-full bg-grid rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(entry.percent, 2)}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-slate w-10 text-right shrink-0">
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
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-line bg-paper text-xs text-ink"
              >
                {skill.name}
                <span className="text-[9px] font-mono text-grid font-semibold">
                  {Math.round(skill.confidence * 100)}%
                </span>
              </span>
            ))}
          </div>
          <p className="text-[11px] text-slate mt-2">
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
                  ? "bg-grid-tint border-grid/30"
                  : "bg-paper border-line opacity-50"
              }`}
            >
              <p className="text-xl mb-1">{a.icon}</p>
              <p className="text-xs font-semibold text-ink">{a.title}</p>
              <p className="text-[10px] text-slate mt-0.5">{a.metric}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ── GitHub Profile Review ─────────────────────────────── */}
      <Card title="GitHub Profile Review">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl font-bold font-mono text-grid">
            {initialData.profileReview.score}
          </span>
          <span className="text-xs text-slate">
            /100 · {initialData.profileReview.present.length} of 8 checkpoints met
          </span>
        </div>
        <ScoreBar value={initialData.profileReview.score} className="mb-3" />
        {initialData.profileReview.missing.length > 0 && (
          <p className="text-xs text-slate mb-2">
            Missing: <span className="text-slate/70">
              {initialData.profileReview.missing.join(", ")}
            </span>
          </p>
        )}
        <ul className="pl-4 list-disc space-y-1">
          {initialData.profileReview.suggestions.map((s) => (
            <li key={s} className="text-xs text-slate">
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
                  <span className="text-sm text-ink truncate">{review.repo}</span>
                  <span className="text-sm font-bold font-mono text-grid shrink-0">
                    {review.hasReadme ? `${review.score}/100` : "No README"}
                  </span>
                </div>
                {review.hasReadme ? (
                  <>
                    <ScoreBar value={review.score} />
                    <p className="text-[11px] text-slate">{review.explanation}</p>
                    {review.sections.length > 0 && (
                      <p className="text-[11px] text-slate">
                        Sections: {review.sections.join(", ")}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] text-slate">{review.suggestions[0]}</p>
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
                <p className="text-sm text-ink font-medium">{pd.repo}</p>
                <p className="text-xs text-slate leading-relaxed">
                  {pd.description}
                </p>
                {pd.keywords.length > 0 && (
                  <p className="text-[11px] text-slate">
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
    <div className="bg-cloud border border-line rounded-card p-5">
      <h3 className="text-xs uppercase tracking-wide text-slate mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

/** Visual score bar — always `grid` (GitHub-derived data). */
function ScoreBar({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  return (
    <div
      className={`h-1.5 bg-line rounded-full overflow-hidden ${className}`}
    >
      <div
        className="h-full bg-grid rounded-full transition-all duration-500"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-paper border border-line rounded-lg px-3 py-2">
      <p className="text-lg font-bold font-mono text-grid">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-slate">
        {label}
      </p>
    </div>
  );
}

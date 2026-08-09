"use client";
import { useState, useEffect } from "react";

export interface GitHubInsightsData {
  contributionSummary: {
    totalRepos: number;
    totalStars: number;
    totalForks: number;
    yearsActive: number;
  };
  repoHealth: {
    starredRepos: number;
    avgStars: number;
    recentlyActive: number;
  };
  languageDistribution: Array<{
    name: string;
    bytes: number;
    percent: number;
  }>;
  projectMaturity: {
    total: number;
    recent: number;
    stale: number;
    mostRecentUpdate: string | null;
  };
}

export default function GitHubInsights({
  initialData,
  onError,
}: {
  initialData?: GitHubInsightsData | null;
  onError?: (msg: string) => void;
}) {
  const [data, setData] = useState<GitHubInsightsData | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(false);

  useEffect(() => {
    // If initialData was provided, skip the fetch entirely
    if (initialData) return;

    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/github/insights");
        if (!res.ok) throw new Error("Failed to load insights");
        const json = await res.json();
        if (!cancelled) setData(json.insights);
      } catch {
        if (!cancelled) {
          setError(true);
          onError?.("Couldn't load GitHub insights");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [onError, initialData]);

  if (loading) {
    return (
      <div className="bg-cloud border border-line rounded-card p-5 animate-pulse">
        <div className="h-4 bg-line rounded w-1/3 mb-4" />
        <div className="h-3 bg-line rounded w-2/3 mb-2" />
        <div className="h-3 bg-line rounded w-1/2" />
      </div>
    );
  }

  if (error || !data) return null;

  return (
    <div className="space-y-6">
      {/* Contribution Summary */}
      <div className="bg-cloud border border-line rounded-card p-5">
        <h3 className="text-sm font-semibold text-ink mb-4">
          Contribution Summary
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <StatBox label="Repos" value={data.contributionSummary.totalRepos} />
          <StatBox label="Stars" value={data.contributionSummary.totalStars} />
          <StatBox label="Forks" value={data.contributionSummary.totalForks} />
          <StatBox
            label="Years Active"
            value={data.contributionSummary.yearsActive}
          />
        </div>
      </div>

      {/* Repository Health */}
      <div className="bg-cloud border border-line rounded-card p-5">
        <h3 className="text-sm font-semibold text-ink mb-4">
          Repository Health
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <StatBox
            label="Active (1yr)"
            value={data.repoHealth.recentlyActive}
          />
          <StatBox
            label="Starred Repos"
            value={data.repoHealth.starredRepos}
          />
          <StatBox label="Avg Stars" value={data.repoHealth.avgStars} />
          {/* Fork count excluded — topRepos already filters out forks,
               so the stat would always be 0 and misleading. */}
        </div>
      </div>

      {/* Language Distribution */}
      {data.languageDistribution.length > 0 && (
        <div className="bg-cloud border border-line rounded-card p-5">
          <h3 className="text-sm font-semibold text-ink mb-4">Languages</h3>
          <div className="space-y-2">
            {data.languageDistribution.map((lang) => (
              <div key={lang.name} className="flex items-center gap-3">
                <span className="text-sm text-ink w-24 truncate shrink-0">
                  {lang.name}
                </span>
                <div className="flex-1 h-2 bg-line rounded-full overflow-hidden">
                  <div
                    className="h-full bg-grid rounded-full transition-all duration-500"
                    style={{ width: `${lang.percent}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-slate w-10 text-right shrink-0">
                  {lang.percent}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Project Maturity */}
      <div className="bg-cloud border border-line rounded-card p-5">
        <h3 className="text-sm font-semibold text-ink mb-4">
          Project Maturity
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <StatBox label="Recent" value={data.projectMaturity.recent} />
          <StatBox label="Stale (2yr+)" value={data.projectMaturity.stale} />
          <StatBox
            label="Total Tracked"
            value={data.projectMaturity.total}
          />
        </div>
        {data.projectMaturity.mostRecentUpdate && (
          <p className="text-xs text-slate mt-3 font-mono">
            Last push:{" "}
            {new Date(
              data.projectMaturity.mostRecentUpdate
            ).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-paper border border-line rounded-lg px-3 py-2">
      <p className="text-lg font-bold font-mono text-grid">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-slate">
        {label}
      </p>
    </div>
  );
}

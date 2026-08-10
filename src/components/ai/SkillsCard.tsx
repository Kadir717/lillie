"use client";

import type { CvModel } from "@/lib/cv-model";
import type { SkillRecommendationResult } from "@/lib/ai/services";
import AIInsightsCard from "./AIInsightsCard";
import EmptyState from "./EmptyState";
import { SkillsSkeleton } from "./LoadingState";
import { useAiTool, toInsightsStatus } from "./useAiTool";

export default function SkillsCard({ model }: { model: CvModel | null }) {
  const state = useAiTool<SkillRecommendationResult>(
    "skill-recommendation",
    model
  );

  return (
    <AIInsightsCard title="Top Skills" icon="⚡" status={toInsightsStatus(state)}>
      {state.status === "idle" && (
        <EmptyState
          variant="no_data"
          title="No CV data yet"
          description="Connect GitHub and generate a CV to unlock AI insights."
        />
      )}

      {state.status === "loading" && <SkillsSkeleton />}

      {state.status === "unconfigured" && (
        <EmptyState
          variant="not_generated"
          title="AI not configured"
          description="AI insights are not enabled in this environment yet."
        />
      )}

      {state.status === "error" && (
        <EmptyState
          variant="error"
          title="Could not analyze skills"
          description={state.message}
        />
      )}

      {state.status === "ready" && (
        <div className="space-y-3">
          {state.result.currentSkills.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate mb-1.5">
                Current
              </p>
              <div className="flex flex-wrap gap-1.5">
                {state.result.currentSkills.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-line bg-paper text-xs text-ink"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {state.result.recommendedSkills.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate mb-1.5">
                Recommended next
              </p>
              <ul className="space-y-1.5">
                {state.result.recommendedSkills.map((r) => (
                  <li key={r.skill} className="text-xs text-slate leading-relaxed">
                    <span className="text-ink font-medium">{r.skill}</span>
                    {r.reason ? ` — ${r.reason}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state.result.suggestedProjects.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate mb-1.5">
                Suggested projects
              </p>
              <ul className="space-y-1">
                {state.result.suggestedProjects.map((p) => (
                  <li key={p} className="flex items-start gap-1.5 text-xs text-slate">
                    <span className="text-grid mt-0.5" aria-hidden>
                      ✓
                    </span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </AIInsightsCard>
  );
}

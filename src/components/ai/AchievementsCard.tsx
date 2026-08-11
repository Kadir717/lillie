"use client";

import type { CvModel } from "@/lib/cv-model";
import type { CareerCoachResult } from "@/lib/ai/services";
import AIInsightsCard from "./AIInsightsCard";
import EmptyState from "./EmptyState";
import RegenerateButton from "./RegenerateButton";
import { AchievementsSkeleton } from "./LoadingState";
import { useAiTool, toInsightsStatus } from "./useAiTool";

export default function AchievementsCard({
  model,
  delayMs = 0,
}: {
  model: CvModel | null;
  delayMs?: number;
}) {
  // career-coach is the best fit for "Key Achievements": its `quickWins`
  // are concrete, near-term wins — closer to achievements than the phased
  // roadmap output. (roadmap stays unused to keep the mapping one-to-one.)
  const { state, isRegenerating, regenerate } = useAiTool<CareerCoachResult>(
    "career-coach",
    model,
    delayMs
  );

  return (
    <AIInsightsCard
      title="Key Achievements"
      icon="🏆"
      status={toInsightsStatus(state)}
    >
      {state.status === "idle" && (
        <EmptyState
          variant="no_data"
          title="No CV data yet"
          description="Connect GitHub and generate a CV to unlock AI insights."
        />
      )}

      {state.status === "loading" && <AchievementsSkeleton />}

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
          title="Could not generate achievements"
          description={state.message}
        />
      )}

      {state.status === "ready" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <RegenerateButton
              onClick={regenerate}
              isRegenerating={isRegenerating}
            />
          </div>
          {state.result.careerDirection && (
            <p className="text-sm text-slate leading-relaxed">
              <span className="text-ink font-medium">Direction: </span>
              {state.result.careerDirection}
            </p>
          )}

          {state.result.quickWins.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate mb-1.5">
                Quick wins
              </p>
              <ul className="space-y-1">
                {state.result.quickWins.map((w) => (
                  <li key={w} className="flex items-start gap-1.5 text-xs text-slate">
                    <span className="text-grid mt-0.5" aria-hidden>
                      ✓
                    </span>
                    <span>{w}</span>
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

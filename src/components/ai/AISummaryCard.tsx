"use client";

import type { CvModel } from "@/lib/cv-model";
import type { ResumeReviewResult } from "@/lib/ai/services";
import AIInsightsCard from "./AIInsightsCard";
import EmptyState from "./EmptyState";
import RegenerateButton from "./RegenerateButton";
import { SummarySkeleton } from "./LoadingState";
import { useAiTool, toInsightsStatus } from "./useAiTool";

export default function AISummaryCard({
  model,
  delayMs = 0,
}: {
  model: CvModel | null;
  delayMs?: number;
}) {
  const { state, isRegenerating, regenerate } = useAiTool<ResumeReviewResult>(
    "resume-review",
    model,
    delayMs
  );

  return (
    <AIInsightsCard
      title="Professional Summary"
      icon="📝"
      status={toInsightsStatus(state)}
    >
      {state.status === "idle" && (
        <EmptyState
          variant="no_data"
          title="No CV data yet"
          description="Connect GitHub and generate a CV to unlock AI insights."
        />
      )}

      {state.status === "loading" && <SummarySkeleton />}

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
          title="Could not generate summary"
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
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-grid">
              {state.result.overallScore}
            </span>
            <span className="text-xs text-slate">/100</span>
          </div>
          <p className="text-sm text-slate leading-relaxed">
            {state.result.summary}
          </p>

          {state.result.strengths.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate mb-1.5">
                Strengths
              </p>
              <ul className="space-y-1">
                {state.result.strengths.map((s) => (
                  <li key={s} className="flex items-start gap-1.5 text-xs text-slate">
                    <span className="text-grid mt-0.5" aria-hidden>
                      ✓
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state.result.weaknesses.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate mb-1.5">
                Areas to improve
              </p>
              <ul className="space-y-1">
                {state.result.weaknesses.map((w) => (
                  <li key={w} className="flex items-start gap-1.5 text-xs text-slate">
                    <span className="text-red-400 mt-0.5" aria-hidden>
                      ✗
                    </span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state.result.improvements.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate mb-1.5">
                Suggestions
              </p>
              <ul className="space-y-1">
                {state.result.improvements.map((s) => (
                  <li key={s} className="flex items-start gap-1.5 text-xs text-slate">
                    <span className="text-signal mt-0.5" aria-hidden>
                      →
                    </span>
                    <span>{s}</span>
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

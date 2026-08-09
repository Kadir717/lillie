"use client";

import AIInsightsCard from "./AIInsightsCard";

export default function SkillsCard() {
  return (
    <AIInsightsCard
      title="Top Skills"
      icon="⚡"
      status="coming_soon"
    >
      <p className="text-sm text-slate leading-relaxed">
        Your most prominent skills will be listed here, identified by
        analyzing your repositories, languages, and contributions.
      </p>
    </AIInsightsCard>
  );
}

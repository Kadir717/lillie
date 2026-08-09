"use client";

import AIInsightsCard from "./AIInsightsCard";

export default function AchievementsCard() {
  return (
    <AIInsightsCard
      title="Key Achievements"
      icon="🏆"
      status="coming_soon"
    >
      <p className="text-sm text-slate leading-relaxed">
        Notable achievements from your open-source work will be highlighted
        here, including starred projects, significant contributions, and
        community impact.
      </p>
    </AIInsightsCard>
  );
}

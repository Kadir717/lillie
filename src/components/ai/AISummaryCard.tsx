"use client";

import AIInsightsCard from "./AIInsightsCard";

export default function AISummaryCard() {
  return (
    <AIInsightsCard
      title="Professional Summary"
      icon="📝"
      status="coming_soon"
    >
      <p className="text-sm text-slate leading-relaxed">
        An AI-generated professional summary will appear here. It will
        highlight your expertise, years of experience, and career narrative
        based on your GitHub profile and CV data.
      </p>
    </AIInsightsCard>
  );
}

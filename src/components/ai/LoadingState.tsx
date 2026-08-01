"use client";

export function SummarySkeleton() {
  return (
    <div className="bg-coffee/10 border border-coffee/20 rounded-xl p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-6 h-6 bg-coffee/20 rounded" />
        <div className="h-4 bg-coffee/20 rounded w-1/3" />
        <div className="ml-auto h-3 bg-coffee/20 rounded w-20" />
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-coffee/20 rounded w-full" />
        <div className="h-3 bg-coffee/20 rounded w-5/6" />
        <div className="h-3 bg-coffee/20 rounded w-4/6" />
        <div className="h-3 bg-coffee/20 rounded w-3/6" />
      </div>
    </div>
  );
}

export function SkillsSkeleton() {
  return (
    <div className="bg-coffee/10 border border-coffee/20 rounded-xl p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-6 h-6 bg-coffee/20 rounded" />
        <div className="h-4 bg-coffee/20 rounded w-1/4" />
        <div className="ml-auto h-3 bg-coffee/20 rounded w-20" />
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="h-6 bg-coffee/20 rounded w-16" />
        <div className="h-6 bg-coffee/20 rounded w-24" />
        <div className="h-6 bg-coffee/20 rounded w-20" />
        <div className="h-6 bg-coffee/20 rounded w-14" />
        <div className="h-6 bg-coffee/20 rounded w-28" />
        <div className="h-6 bg-coffee/20 rounded w-18" />
      </div>
    </div>
  );
}

export function AchievementsSkeleton() {
  return (
    <div className="bg-coffee/10 border border-coffee/20 rounded-xl p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-6 h-6 bg-coffee/20 rounded" />
        <div className="h-4 bg-coffee/20 rounded w-1/3" />
        <div className="ml-auto h-3 bg-coffee/20 rounded w-20" />
      </div>
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <div className="w-4 h-4 bg-coffee/20 rounded mt-0.5 shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="h-3 bg-coffee/20 rounded w-full" />
            <div className="h-3 bg-coffee/20 rounded w-3/4" />
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-4 h-4 bg-coffee/20 rounded mt-0.5 shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="h-3 bg-coffee/20 rounded w-full" />
            <div className="h-3 bg-coffee/20 rounded w-2/3" />
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-4 h-4 bg-coffee/20 rounded mt-0.5 shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="h-3 bg-coffee/20 rounded w-full" />
            <div className="h-3 bg-coffee/20 rounded w-4/5" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AILoadingSection() {
  return (
    <div className="space-y-4">
      <SummarySkeleton />
      <SkillsSkeleton />
      <AchievementsSkeleton />
    </div>
  );
}

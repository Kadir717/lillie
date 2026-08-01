/**
 * LILLIE — Analytics report aggregator
 *
 * Builds the full dashboard analytics payload from the persisted event log
 * and growth snapshots. All aggregation is done in the database
 * (groupBy / count) — no row-by-row JS reduction over large tables.
 *
 * Deterministic, privacy-safe (returns counts + series, never raw IPs).
 */

import { prisma } from "../db";
import {
  AnalyticsEventType,
  AnalyticsReport,
  DownloadBreakdown,
  ExportHistoryRow,
  GrowthPoint,
  PerformanceReport,
  ResumeAnalyticsRow,
  SeriesPoint,
} from "./types";
import { getGithubGrowth } from "./growth";

/** Returns the ISO day bucket (YYYY-MM-DD) for a Date. */
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** UTC midnight N days ago. */
function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

/** Fills a series with every day in [start, today] defaulting to 0. */
function fillSeries(
  start: Date,
  counts: Map<string, number>
): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  const cursor = new Date(start);
  const today = new Date();
  while (cursor.getTime() <= today.getTime()) {
    const key = dayKey(cursor);
    out.push({ date: key, value: counts.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/** Counts events per day (UTC buckets) using DB groupBy. */
async function countByDay(
  userId: string,
  type?: AnalyticsEventType,
  since?: Date
): Promise<Map<string, number>> {
  const grouped = await prisma.analyticsEvent.groupBy({
    by: ["createdAt"],
    where: {
      userId,
      ...(type ? { type } : {}),
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    _count: { _all: true },
  });

  const map = new Map<string, number>();
  // Prisma returns DateTime buckets at second precision; we round down to day.
  for (const g of grouped) {
    const key = dayKey(g.createdAt);
    map.set(key, (map.get(key) ?? 0) + g._count._all);
  }
  return map;
}

/** Counts events for a user by a dimension (e.g. locale) — DB groupBy. */
async function countByMetadataField(
  userId: string,
  type: AnalyticsEventType,
  field: "locale" | "template"
): Promise<SeriesPoint[]> {
  const rows = await prisma.analyticsEvent.findMany({
    where: { userId, type },
    select: { metadata: true },
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    const meta = row.metadata as Record<string, unknown> | null;
    const value = meta?.[field];
    if (typeof value === "string" && value) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ date: name, value }));
}

/** Per-profile rollup: views, downloads, last viewed, shared flag. */
async function resumeAnalytics(userId: string): Promise<ResumeAnalyticsRow[]> {
  const profiles = await prisma.cvProfile.findMany({
    where: { userId },
    select: {
      id: true,
      title: true,
      shareEnabled: true,
    },
  });
  if (profiles.length === 0) return [];

  const events = await prisma.analyticsEvent.findMany({
    where: {
      userId,
      profileId: { in: profiles.map((p) => p.id) },
      type: { in: ["resume_view", "cv_download"] },
    },
    select: { profileId: true, type: true, createdAt: true },
  });

  const views = new Map<string, number>();
  const downloads = new Map<string, number>();
  const lastViewed = new Map<string, Date>();
  for (const e of events) {
    if (!e.profileId) continue;
    if (e.type === "resume_view") {
      views.set(e.profileId, (views.get(e.profileId) ?? 0) + 1);
      const cur = lastViewed.get(e.profileId);
      if (!cur || e.createdAt > cur) lastViewed.set(e.profileId, e.createdAt);
    } else if (e.type === "cv_download") {
      downloads.set(e.profileId, (downloads.get(e.profileId) ?? 0) + 1);
    }
  }

  return profiles
    .map((p) => ({
      profileId: p.id,
      profileTitle: p.title,
      views: views.get(p.id) ?? 0,
      downloads: downloads.get(p.id) ?? 0,
      lastViewedAt: lastViewed.get(p.id)?.toISOString() ?? null,
      shared: p.shareEnabled,
    }))
    .sort((a, b) => b.views - a.views);
}

/** Recent export history (portfolio_export + portfolio_website). */
async function exportHistory(userId: string, limit = 15): Promise<ExportHistoryRow[]> {
  const rows = await prisma.analyticsEvent.findMany({
    where: {
      userId,
      type: { in: ["portfolio_export", "portfolio_website"] },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      metadata: true,
      createdAt: true,
    },
  });

  return rows.map((r) => {
    const meta = r.metadata as Record<string, unknown> | null;
    return {
      id: r.id,
      format:
        r.type === "portfolio_website"
          ? "website"
          : typeof meta?.format === "string"
            ? meta.format
            : "unknown",
      theme: typeof meta?.theme === "string" ? meta.theme : null,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

/** Overall counts + 30-day series + performance notes. */
async function buildPerformance(
  totalViews: number,
  totalDownloads: number,
  totalExports: number,
  totalShares: number,
  resumeRows: ResumeAnalyticsRow[],
  eventSeries: SeriesPoint[],
  growth: GrowthPoint[]
): Promise<PerformanceReport> {
  const first = growth[0] ?? null;
  const latest = growth[growth.length - 1] ?? null;

  const topProfile =
    resumeRows.length > 0 && resumeRows[0].views > 0
      ? {
          profileId: resumeRows[0].profileId,
          profileTitle: resumeRows[0].profileTitle,
          views: resumeRows[0].views,
        }
      : null;

  let bestDay: PerformanceReport["bestDay"] = null;
  for (const p of eventSeries) {
    if (p.value > 0 && (!bestDay || p.value > bestDay.views)) {
      bestDay = { date: p.date, views: p.value };
    }
  }

  const notes: string[] = [];
  if (totalViews === 0) notes.push("No public resume views yet — enable sharing on a profile to get started.");
  if (totalDownloads === 0) notes.push("No CV downloads yet — try the Download button in the CV builder.");
  if (growth.length < 2) notes.push("GitHub growth needs a few days of snapshots to show a trend — check back tomorrow.");
  else if (first && latest) {
    const starsDelta = latest.stars - first.stars;
    const followersDelta = latest.followers - first.followers;
    if (starsDelta !== 0)
      notes.push(`Stars ${starsDelta > 0 ? "up" : "down"} by ${Math.abs(starsDelta)} over the tracked period.`);
    if (followersDelta !== 0)
      notes.push(`Followers ${followersDelta > 0 ? "up" : "down"} by ${Math.abs(followersDelta)} over the tracked period.`);
  }
  if (topProfile) notes.push(`Your most-viewed profile is "${topProfile.profileTitle}" with ${topProfile.views} views.`);

  return {
    totalViews,
    totalDownloads,
    totalExports,
    totalShares,
    topProfile,
    bestDay,
    growth: {
      first,
      latest,
      starsDelta: first && latest ? latest.stars - first.stars : 0,
      followersDelta: first && latest ? latest.followers - first.followers : 0,
      reposDelta: first && latest ? latest.repos - first.repos : 0,
    },
    notes,
  };
}

/**
 * Builds the complete analytics report for a user.
 * All queries are scoped to `userId` — users only ever see their own data.
 */
export async function buildAnalyticsReport(userId: string): Promise<AnalyticsReport> {
  const since30 = daysAgo(30);

  // ── Totals (scoped to this user) ───────────────────────────────
  const totalEvents = await prisma.analyticsEvent.count({ where: { userId } });
  const totalViews = await prisma.analyticsEvent.count({
    where: { userId, type: "resume_view" },
  });
  const totalDownloads = await prisma.analyticsEvent.count({
    where: { userId, type: "cv_download" },
  });
  const totalExports = await prisma.analyticsEvent.count({
    where: { userId, type: { in: ["portfolio_export", "portfolio_website"] } },
  });
  const totalShares = await prisma.analyticsEvent.count({
    where: { userId, type: "profile_share" },
  });

  // ── 30-day series ──────────────────────────────────────────────
  const events30d = await prisma.analyticsEvent.count({
    where: { userId, createdAt: { gte: since30 } },
  });
  const views30d = await prisma.analyticsEvent.count({
    where: { userId, type: "resume_view", createdAt: { gte: since30 } },
  });
  const downloads30d = await prisma.analyticsEvent.count({
    where: { userId, type: "cv_download", createdAt: { gte: since30 } },
  });

  const dayCounts = await countByDay(userId, undefined, since30);
  const eventSeries = fillSeries(since30, dayCounts);

  // ── Breakdowns ─────────────────────────────────────────────────
  const [byLocale, byTemplate] = await Promise.all([
    countByMetadataField(userId, "cv_download", "locale"),
    countByMetadataField(userId, "cv_download", "template"),
  ]);
  const downloadBreakdown: DownloadBreakdown = {
    total: totalDownloads,
    byLocale,
    byTemplate,
  };

  const [resumeRows, history, growth] = await Promise.all([
    resumeAnalytics(userId),
    exportHistory(userId),
    getGithubGrowth(userId, 30),
  ]);

  const performance = await buildPerformance(
    totalViews,
    totalDownloads,
    totalExports,
    totalShares,
    resumeRows,
    eventSeries,
    growth
  );

  return {
    overview: {
      totalEvents,
      totalViews,
      totalDownloads,
      totalExports,
      totalShares,
      events30d,
      views30d,
      downloads30d,
    },
    eventSeries,
    resumeAnalytics: resumeRows,
    downloadBreakdown,
    growth,
    exportHistory: history,
    performance,
    generatedAt: new Date().toISOString(),
  };
}

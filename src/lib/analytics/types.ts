/**
 * LILLIE — Analytics types
 *
 * Shared contracts for the usage-analytics layer. Analytics are recorded as
 * discrete events (downloads, public views, exports, shares) plus daily
 * GitHub stat snapshots, then aggregated into chart-ready series for the
 * dashboard. Deterministic — no AI, no third-party analytics SDK.
 */

/** All tracked event types. Keep in sync with the Prisma `type` strings. */
export const ANALYTICS_EVENT_TYPES = [
  "resume_view",
  "cv_download",
  "portfolio_export",
  "portfolio_website",
  "profile_share",
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

/** Metadata attached to a tracked event. */
export interface AnalyticsEventMetadata {
  locale?: string;
  template?: string;
  format?: string;
  theme?: string;
  referrer?: string;
  [key: string]: string | boolean | undefined;
}

/** A single point in a time series (chart-ready). */
export interface SeriesPoint {
  /** ISO date (YYYY-MM-DD), UTC day bucket. */
  date: string;
  value: number;
}

/** Breakdown of downloads by a dimension (locale / template). */
export interface DownloadBreakdown {
  total: number;
  byLocale: SeriesPoint[];
  byTemplate: SeriesPoint[];
}

/** Per-profile usage rollup. */
export interface ResumeAnalyticsRow {
  profileId: string;
  profileTitle: string;
  views: number;
  downloads: number;
  lastViewedAt: string | null;
  shared: boolean;
}

/** GitHub growth series point. */
export interface GrowthPoint {
  date: string;
  stars: number;
  repos: number;
  forks: number;
  followers: number;
}

/** Recent export history row. */
export interface ExportHistoryRow {
  id: string;
  format: string;
  theme: string | null;
  createdAt: string;
}

/** Human + machine readable performance summary. */
export interface PerformanceReport {
  totalViews: number;
  totalDownloads: number;
  totalExports: number;
  totalShares: number;
  topProfile: { profileId: string; profileTitle: string; views: number } | null;
  bestDay: { date: string; views: number } | null;
  growth: {
    first: GrowthPoint | null;
    latest: GrowthPoint | null;
    starsDelta: number;
    followersDelta: number;
    reposDelta: number;
  };
  notes: string[];
}

/** Full payload returned by GET /api/analytics. */
export interface AnalyticsReport {
  overview: {
    totalEvents: number;
    totalViews: number;
    totalDownloads: number;
    totalExports: number;
    totalShares: number;
    events30d: number;
    views30d: number;
    downloads30d: number;
  };
  /** Daily event volume, last 30 days (chart-ready). */
  eventSeries: SeriesPoint[];
  /** Per-profile visitor analytics. */
  resumeAnalytics: ResumeAnalyticsRow[];
  downloadBreakdown: DownloadBreakdown;
  /** Daily GitHub growth snapshots (chart-ready). */
  growth: GrowthPoint[];
  /** Recent portfolio export history. */
  exportHistory: ExportHistoryRow[];
  /** Performance summary + notes. */
  performance: PerformanceReport;
  generatedAt: string;
}

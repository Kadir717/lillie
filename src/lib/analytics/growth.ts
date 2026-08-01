/**
 * LILLIE — GitHub growth snapshots
 *
 * Daily snapshots of a user's public GitHub stats (stars, repos, forks,
 * followers), upserted once per UTC day. Growth charts are built from these
 * rows — one row per user per day, so trends are cheap to query and the
 * dashboard never re-derives history from live GitHub data.
 */

import { prisma } from "../db";
import { GrowthPoint } from "./types";

/** UTC midnight of "today" — the day bucket key. */
export function todayBucket(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Upserts today's snapshot for a user. Idempotent per user per day — calling
 * it repeatedly within the same day updates the same row (latest wins).
 * Never rejects: growth tracking must not break the dashboard.
 */
export async function upsertGithubSnapshot(input: {
  userId: string;
  stars: number;
  repos: number;
  forks: number;
  followers: number;
  now?: Date;
}): Promise<void> {
  try {
    await prisma.githubSnapshot.upsert({
      where: {
        userId_date: {
          userId: input.userId,
          date: todayBucket(input.now),
        },
      },
      create: {
        userId: input.userId,
        date: todayBucket(input.now),
        stars: input.stars,
        repos: input.repos,
        forks: input.forks,
        followers: input.followers,
      },
      update: {
        stars: input.stars,
        repos: input.repos,
        forks: input.forks,
        followers: input.followers,
      },
    });
  } catch (err) {
    // Growth tracking must never break the dashboard render.
    console.error("Analytics: failed to upsert GitHub snapshot:", err);
  }
}

/**
 * Returns the growth series for a user, oldest → newest.
 * `limit` caps the number of points (e.g. last 30 days).
 */
export async function getGithubGrowth(
  userId: string,
  limit = 30
): Promise<GrowthPoint[]> {
  try {
    const rows = await prisma.githubSnapshot.findMany({
      where: { userId },
      orderBy: { date: "asc" },
      take: limit,
      select: {
        date: true,
        stars: true,
        repos: true,
        forks: true,
        followers: true,
      },
    });
    return rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      stars: r.stars,
      repos: r.repos,
      forks: r.forks,
      followers: r.followers,
    }));
  } catch (err) {
    console.error("Analytics: failed to load GitHub growth:", err);
    return [];
  }
}

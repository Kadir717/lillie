/**
 * Best-effort AI result cache (24h TTL).
 *
 * Why it exists: the dashboard fires up to 3 AI tools in parallel on every
 * page load, and the same user may refresh the page several times a day.
 * On Gemini's free tier (~10-15 RPM) that burns the quota in minutes.
 * Caching per (user, tool, input-hash) means repeat requests within 24h
 * are served from the database with ZERO LLM calls.
 *
 * Design rules:
 *  - Every function here is best-effort: any DB error is logged and the
 *    caller proceeds as if there was no cache. The cache NEVER blocks an
 *    AI call or breaks the feature.
 *  - Rows are scoped to the authenticated user (no cross-user leakage).
 *  - The cache key is a SHA-256 of the tool + serialized request body, so
 *    a different job posting (tailor) or a different target role (ATS)
 *    automatically gets its own entry.
 *  - Expired rows are treated as a miss and deleted lazily on read/write.
 */

import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { AiToolRequest } from "./types";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Builds a stable, user-scoped cache key from tool + request input. */
export function aiCacheKey(tool: string, body: AiToolRequest): string {
  // `regenerate` is a control flag, not input — it must not change the key.
  const { regenerate: _regenerate, ...input } = body;
  return createHash("sha256")
    .update(`${tool}\n${JSON.stringify(input)}`)
    .digest("hex");
}

/**
 * Resolves the DB user id for a session (GitHub id → User.id).
 * Returns null on lookup failure so callers can safely skip caching.
 */
export async function resolveAiCacheUserId(
  githubId: number
): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { githubId },
      select: { id: true },
    });
    return user?.id ?? null;
  } catch (err) {
    console.error("AI cache: failed to resolve user id:", err);
    return null;
  }
}

/** Returns the cached result when fresh, otherwise null (a cache miss). */
export async function getCachedAiResult<T>(
  userId: string,
  tool: string,
  key: string
): Promise<T | null> {
  try {
    const row = await prisma.aiResultCache.findUnique({
      where: { userId_tool_inputHash: { userId, tool, inputHash: key } },
    });
    if (!row) return null;
    if (row.expiresAt.getTime() <= Date.now()) {
      // Expired — treat as a miss and clean up lazily.
      await prisma.aiResultCache
        .delete({ where: { id: row.id } })
        .catch(() => {});
      return null;
    }
    return row.result as T;
  } catch (err) {
    console.error(`AI cache read failed (tool="${tool}"):`, err);
    return null; // best-effort — proceed as a miss
  }
}

/** Stores (or refreshes) a successful tool result with a 24h TTL. */
export async function setCachedAiResult(
  userId: string,
  tool: string,
  key: string,
  result: unknown
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
    const data: Pick<Prisma.AiResultCacheCreateInput, "result" | "expiresAt"> = {
      result: result as Prisma.InputJsonValue,
      expiresAt,
    };
    await prisma.aiResultCache.upsert({
      where: { userId_tool_inputHash: { userId, tool, inputHash: key } },
      create: { userId, tool, inputHash: key, ...data },
      update: data,
    });
    // Opportunistic cleanup: drop this user's expired rows for this tool.
    await prisma.aiResultCache
      .deleteMany({
        where: { userId, tool, expiresAt: { lt: new Date() } },
      })
      .catch(() => {});
  } catch (err) {
    console.error(`AI cache write failed (tool="${tool}"):`, err);
    // Best-effort — the fresh AI result is still returned to the client.
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { aiTools, AI_TOOL_NAMES } from "@/lib/ai/services";
import type { AiToolRequest } from "@/lib/ai/types";
import { isAiConfigured } from "@/lib/ai/provider";
import {
  aiCacheKey,
  getCachedAiResult,
  resolveAiCacheUserId,
  setCachedAiResult,
} from "@/lib/ai/cache";
import {
  AiError,
  AiInputError,
  AiNotConfiguredError,
  AiParseError,
  AiProviderError,
} from "@/lib/ai/errors";

/**
 * POST /api/ai/[tool]
 *
 * Runs one of the registered AI tools (see `aiTools` in
 * src/lib/ai/services.ts). The request body carries the already-fetched
 * CvModel, so the AI layer never re-fetches GitHub data:
 *
 *   { model: CvModel, role?: string, interest?: string, locale?: string, regenerate?: boolean }
 *
 * Results are cached per (user, tool, input-hash) for 24h (see
 * src/lib/ai/cache.ts) so repeat dashboard loads do not burn LLM quota.
 * Send `regenerate: true` to bypass the cache and force a fresh call
 * (the fresh result still refreshes the cached copy). Cache failures are
 * best-effort and never block the AI call.
 *
 * Responses:
 *   200 — { result: <tool-specific result>, cached?: true }
 *   400 — invalid JSON body / missing model / unknown tool
 *   401 — not authenticated
 *   429 — GitHub API rate limited (via middleware)
 *   502 — AI provider or parse failure
 *   503 — AI not configured (AI_API_KEY missing)
 *   500 — unexpected failure
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tool: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { tool } = await params;

  const definition = (aiTools as Record<string, { run: (b: AiToolRequest) => Promise<unknown> }>)[tool];
  if (!definition) {
    return NextResponse.json(
      {
        error: `Unknown AI tool. Available: ${AI_TOOL_NAMES.join(", ")}`,
      },
      { status: 400 }
    );
  }

  let body: AiToolRequest;
  try {
    const parsed = await request.json();
    if (typeof parsed !== "object" || parsed === null) {
      return NextResponse.json(
        { error: "Request body must be a JSON object" },
        { status: 400 }
      );
    }
    body = parsed as AiToolRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Result cache (24h TTL) ────────────────────────────────────────
  // Same user + tool + input → serve the stored result instead of calling
  // the LLM again. Cache failures are logged and treated as a miss, so a
  // DB hiccup never breaks the feature. `regenerate: true` skips the read
  // but still refreshes the stored copy below. Resolve the DB user id once
  // and reuse it for both the read and the write-back (one query total).
  const cacheKey = aiCacheKey(tool, body);
  const userId = await resolveAiCacheUserId(session.githubId);
  if (!body.regenerate && userId) {
    const cached = await getCachedAiResult<unknown>(userId, tool, cacheKey);
    if (cached !== null) {
      return NextResponse.json({ result: cached, cached: true });
    }
  }

  // Fail fast before calling the provider: a deployment without AI_API_KEY
  // should never cost a round-trip or surface a provider error. (Cached
  // results above are still served — they need no key.)
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI is not configured on this deployment.", status: "ai_unavailable" },
      { status: 503 }
    );
  }

  try {
    const result = await definition.run(body);
    // Best-effort write-back: never block the response on a cache failure.
    if (userId) {
      await setCachedAiResult(userId, tool, cacheKey, result);
    }
    return NextResponse.json({ result });
  } catch (err) {
    if (err instanceof AiInputError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof AiNotConfiguredError) {
      return NextResponse.json(
        { error: "AI is not configured on this deployment.", status: "ai_unavailable" },
        { status: 503 }
      );
    }
    if (err instanceof AiProviderError) {
      console.error(`AI provider error for tool "${tool}":`, err.message);
      // Pass through upstream rate limits so clients can retry sensibly.
      const status = err.status === 429 ? 429 : 502;
      return NextResponse.json(
        { error: status === 429 ? "AI provider rate limited" : "AI provider request failed" },
        { status }
      );
    }
    if (err instanceof AiParseError) {
      return NextResponse.json(
        { error: "AI returned an unparseable response. Please retry." },
        { status: 502 }
      );
    }
    if (err instanceof AiError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    console.error(`AI tool "${tool}" failed:`, err);
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}

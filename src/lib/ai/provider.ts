/**
 * AI provider implementations.
 *
 * Zero new dependencies: both providers use the platform `fetch` to call a
 * standard REST API, so LILLIE does not need an AI SDK. Two providers are
 * built in, selected by the `AI_PROVIDER` environment variable:
 *
 *   AI_PROVIDER=openai  (default)
 *     - OpenAI-compatible Chat Completions API
 *     - env: AI_API_KEY, AI_BASE_URL (default https://api.openai.com/v1),
 *            AI_MODEL (default gpt-4o-mini)
 *   AI_PROVIDER=gemini
 *     - Google Gemini generateContent API
 *     - env: AI_API_KEY, AI_MODEL (default gemini-1.5-flash)
 *
 * Both implement the same `AiProvider` interface from types.ts, so services
 * and prompts never know which provider is in use. If `AI_API_KEY` is not
 * set, `createAiProvider()` throws AiNotConfiguredError — routes map that
 * to a clean 503 instead of a stack trace.
 *
 * ── Server-only ───────────────────────────────────────────────────
 * This module touches process.env and performs network I/O. It must NEVER
 * be imported from client components. AI routes / server code only.
 */

import { createHash } from "node:crypto";
import { AiMessage, AiCompletionOptions, AiProvider } from "./types";
import { AiNotConfiguredError, AiProviderError, AiParseError } from "./errors";

/* ────────────────────────────────────────────────────────────────────
 * Burst protection: in-memory response cache + rate-limit retry.
 *
 * 1. Response cache — module-level Map with a 10-minute TTL. The key is a
 *    SHA-256 of the fully serialized request (messages + generation
 *    options), which deterministically includes the tool's system prompt
 *    AND the serialized CvModel — so the same tool + same input within 10
 *    minutes is served with zero LLM calls. The LLM reply is a pure
 *    function of the request, so sharing a hit across identical requests
 *    is safe; different users' data serializes differently, so nothing
 *    user-specific ever leaks (per-user 24h caching already lives in the
 *    route layer, src/lib/ai/cache.ts). Resets on cold start — expected.
 *
 * 2. 429 retry — transient provider rate limits are retried with
 *    exponential backoff (1s, then 3s) before giving up with a typed
 *    AiProviderError(status 429), which the route maps to a clean 429.
 * ──────────────────────────────────────────────────────────────────── */

const RESPONSE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_RETRY_DELAYS_MS = [1_000, 3_000];
const MAX_RATE_LIMIT_ATTEMPTS = RATE_LIMIT_RETRY_DELAYS_MS.length + 1;
// Upper bound on live entries (each holds ~5-10 KB of LLM text) so the Map
// cannot grow without limit in a long-running process. Vercel serverless
// resets per invocation; self-hosted does not — mirror the opportunistic
// cleanup the DB cache layer already performs.
const MAX_CACHE_ENTRIES = 200;

interface CachedCompletion {
  data: string;
  expiresAt: number;
}

const responseCache = new Map<string, CachedCompletion>();

/** Deterministic, key-order-independent stringify (cache keys must be stable). */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`)
    .join(",")}}`;
}

/** SHA-256 cache key for a complete request (messages + generation options). */
function requestCacheKey(messages: AiMessage[], options: AiCompletionOptions): string {
  const payload = {
    messages,
    json: options.json ?? false,
    temperature: options.temperature ?? null,
    maxTokens: options.maxTokens ?? null,
  };
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

/** Wraps a provider so successful completions are cached for 10 minutes. */
function withResponseCache(provider: AiProvider): AiProvider {
  return {
    name: provider.name,
    async complete(messages, options = {}) {
      const key = requestCacheKey(messages, options);
      const hit = responseCache.get(key);
      if (hit && hit.expiresAt > Date.now()) {
        console.debug(`[ai] serving cached completion for provider ${provider.name}`);
        return hit.data;
      }
      const data = await provider.complete(messages, options);
      // Opportunistic eviction on write: when the Map is saturated, drop
      // expired entries first; if it is still full, skip caching rather
      // than growing past the cap.
      if (responseCache.size >= MAX_CACHE_ENTRIES) {
        const now = Date.now();
        for (const [k, v] of responseCache) {
          if (v.expiresAt <= now) responseCache.delete(k);
        }
      }
      if (responseCache.size < MAX_CACHE_ENTRIES) {
        responseCache.set(key, { data, expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS });
      }
      return data;
    },
  };
}

/**
 * Retries a provider fetch up to 3 attempts on HTTP 429 (rate limited),
 * sleeping 1s then 3s between attempts. When the limit persists, throws a
 * typed AiProviderError(status 429) so routes can surface a clean 429.
 */
async function fetchWithRateLimitRetry(
  performFetch: () => Promise<Response>
): Promise<Response> {
  for (let attempt = 0; attempt < MAX_RATE_LIMIT_ATTEMPTS; attempt++) {
    const response = await performFetch();
    if (response.status !== 429) return response;
    // Release the discarded response body so its connection can be reused.
    if (response.body) {
      void response.body.cancel().catch(() => {});
    }
    if (attempt < RATE_LIMIT_RETRY_DELAYS_MS.length) {
      const delayMs = RATE_LIMIT_RETRY_DELAYS_MS[attempt];
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new AiProviderError(
    `AI provider rate limited after ${MAX_RATE_LIMIT_ATTEMPTS} attempts`,
    429
  );
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new AiNotConfiguredError();
  return value;
}

/** Response envelope shared by OpenAI-compatible chat endpoints. */
interface ChatCompletionResponse {
  choices?: { message?: { content?: unknown } }[];
}

/**
 * OpenAI-compatible Chat Completions provider.
 * Works with OpenAI, OpenRouter, Together, Groq, and any compatible proxy.
 */
class OpenAiCompatibleProvider implements AiProvider {
  readonly name = "openai-compatible";

  async complete(
    messages: AiMessage[],
    options: AiCompletionOptions = {}
  ): Promise<string> {
    const apiKey = requiredEnv("AI_API_KEY");
    const baseUrl = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    const model = process.env.AI_MODEL || "gpt-4o-mini";

    let response: Response;
    try {
      response = await fetchWithRateLimitRetry(() =>
        fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: options.temperature ?? 0.4,
            max_tokens: options.maxTokens ?? 1500,
            // Only request strict JSON when the caller asked for it.
            ...(options.json ? { response_format: { type: "json_object" } } : {}),
          }),
          signal: AbortSignal.timeout(60_000),
        })
      );
    } catch (err) {
      // Preserve a typed rate-limit error (status 429) — wrapping it here
      // would strip the status the route maps to a clean 429 response.
      if (err instanceof AiProviderError) throw err;
      throw new AiProviderError(
        `AI provider request failed: ${err instanceof Error ? err.message : "network error"}`
      );
    }

    if (!response.ok) {
      throw new AiProviderError(
        `AI provider returned HTTP ${response.status}`,
        response.status
      );
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new AiParseError("AI provider returned an empty response.");
    }
    return content;
  }
}

/** Response envelope for the Gemini generateContent API. */
interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

/**
 * Google Gemini provider.
 * Uses the native generateContent REST API (no SDK).
 */
class GeminiProvider implements AiProvider {
  readonly name = "gemini";

  async complete(
    messages: AiMessage[],
    options: AiCompletionOptions = {}
  ): Promise<string> {
    const apiKey = requiredEnv("AI_API_KEY");
    const model = process.env.AI_MODEL || "gemini-1.5-flash";

    // Gemini has no "system" role — fold system messages into the first user part.
    const system = messages.filter((m) => m.role === "system").map((m) => m.content);
    const userParts = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ text: m.content }));

    let response: Response;
    try {
      response = await fetchWithRateLimitRetry(() =>
        fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              contents: [{ role: "user", parts: userParts }],
              ...(system.length > 0
                ? { systemInstruction: { parts: [{ text: system.join("\n\n") }] } }
                : {}),
              generationConfig: {
                temperature: options.temperature ?? 0.4,
                maxOutputTokens: options.maxTokens ?? 1500,
                ...(options.json ? { responseMimeType: "application/json" } : {}),
              },
            }),
            signal: AbortSignal.timeout(60_000),
          }
        )
      );
    } catch (err) {
      // Preserve a typed rate-limit error (status 429) — wrapping it here
      // would strip the status the route maps to a clean 429 response.
      if (err instanceof AiProviderError) throw err;
      throw new AiProviderError(
        `AI provider request failed: ${err instanceof Error ? err.message : "network error"}`
      );
    }

    if (!response.ok) {
      throw new AiProviderError(
        `AI provider returned HTTP ${response.status}`,
        response.status
      );
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string" || text.trim().length === 0) {
      throw new AiParseError("AI provider returned an empty response.");
    }
    return text;
  }
}

let cachedProvider: AiProvider | null = null;

/**
 * Returns a singleton provider selected by AI_PROVIDER.
 * Throws AiNotConfiguredError when AI_API_KEY is missing.
 */
export function createAiProvider(): AiProvider {
  if (cachedProvider) return cachedProvider;
  const kind = (process.env.AI_PROVIDER || "openai").toLowerCase();
  const raw =
    kind === "gemini" ? new GeminiProvider() : new OpenAiCompatibleProvider();
  // Both providers share the same burst-protection wrapper: 10-min response
  // cache first, then the raw LLM call (with 429 backoff inside each class).
  cachedProvider = withResponseCache(raw);
  return cachedProvider;
}

/** True when the AI layer can be used (API key present). */
export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY);
}

/**
 * Clears the cached provider AND the in-memory response cache.
 * Utility for tests and hot-reload scenarios; not called by app code.
 */
export function resetAiProvider(): void {
  cachedProvider = null;
  responseCache.clear();
}

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

import { AiMessage, AiCompletionOptions, AiProvider } from "./types";
import { AiNotConfiguredError, AiProviderError, AiParseError } from "./errors";

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
      response = await fetch(`${baseUrl}/chat/completions`, {
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
      });
    } catch (err) {
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
      response = await fetch(
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
      );
    } catch (err) {
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
  cachedProvider =
    kind === "gemini" ? new GeminiProvider() : new OpenAiCompatibleProvider();
  return cachedProvider;
}

/** True when the AI layer can be used (API key present). */
export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY);
}

/**
 * Clears the cached provider.
 * Utility for tests and hot-reload scenarios; not called by app code.
 */
export function resetAiProvider(): void {
  cachedProvider = null;
}

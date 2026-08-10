/**
 * Shared types for LILLIE's reusable AI service layer.
 *
 * The layer is provider-agnostic: business logic lives in `services.ts`,
 * prompts live in `prompts.ts`, and the actual LLM call happens through a
 * thin `AiProvider` interface implemented in `provider.ts`. Swapping
 * providers (OpenAI, Gemini, a local model, ...) never touches services
 * or prompts.
 */

/** A single chat message sent to the LLM. */
export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Options accepted by every provider implementation. */
export interface AiCompletionOptions {
  /** Sampling temperature. Lower = more deterministic. */
  temperature?: number;
  /** Maximum number of output tokens. */
  maxTokens?: number;
  /**
   * When true, the provider is asked to return a strict JSON object.
   * Providers expose this differently (OpenAI response_format vs Gemini
   * responseMimeType), so the interface hides the difference.
   */
  json?: boolean;
}

/**
 * Minimal contract every LLM provider must satisfy.
 * Implementations MUST be server-only (never imported from client code).
 */
export interface AiProvider {
  /** Stable identifier used in logs. */
  readonly name: string;
  /** Sends a message list and returns the model's text reply. */
  complete(messages: AiMessage[], options?: AiCompletionOptions): Promise<string>;
}

/** Input envelope accepted by the AI routes (client sends the model it already has). */
export interface AiToolRequest {
  /** The CvModel to analyze. Already-fetched — no server-side GitHub round-trip. */
  model: unknown;
  /** Optional target role for role-aware tools (ATS, gap, recommendations). */
  role?: string;
  /** Optional user interest for learning recommendations. */
  interest?: string;
  /** Optional job posting text for tailoring tools (tailor). */
  jobDescription?: string;
  /** Optional locale hint for the output language (e.g. "tr", "ar"). */
  locale?: string;
}

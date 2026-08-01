/**
 * Typed errors for the AI service layer.
 *
 * Every failure mode is a distinct class so route handlers can map them to
 * proper HTTP status codes without leaking internal details:
 *
 *   AiNotConfiguredError → 503 (AI not set up)
 *   AiProviderError      → 502 (upstream LLM failure)
 *   AiParseError         → 502 (unparseable LLM output)
 *   AiInputError         → 400 (bad request body)
 */

/** Base class for all AI-layer errors. */
export class AiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiError";
  }
}

/** Thrown when the AI provider is not configured (no API key / provider). */
export class AiNotConfiguredError extends AiError {
  constructor() {
    super("AI is not configured. Set AI_PROVIDER and AI_API_KEY to enable.");
    this.name = "AiNotConfiguredError";
  }
}

/** Thrown when the upstream LLM request fails (network, auth, 5xx). */
export class AiProviderError extends AiError {
  constructor(
    message: string,
    /** Upstream HTTP status, if one was returned. */
    public readonly status?: number
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

/** Thrown when the LLM reply is not valid JSON / fails shape validation. */
export class AiParseError extends AiError {
  constructor(message = "AI returned an unparseable response.") {
    super(message);
    this.name = "AiParseError";
  }
}

/** Thrown when the request body fails input validation. */
export class AiInputError extends AiError {
  constructor(message: string) {
    super(message);
    this.name = "AiInputError";
  }
}

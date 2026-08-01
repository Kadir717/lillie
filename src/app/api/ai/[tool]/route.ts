import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { aiTools, AI_TOOL_NAMES } from "@/lib/ai/services";
import type { AiToolRequest } from "@/lib/ai/types";
import { isAiConfigured } from "@/lib/ai/provider";
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
 *   { model: CvModel, role?: string, interest?: string, locale?: string }
 *
 * Responses:
 *   200 — { result: <tool-specific result> }
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

  // Fail fast before reading the body: a deployment without AI_API_KEY
  // should never cost a round-trip or surface a provider error.
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI is not configured on this deployment.", status: "ai_unavailable" },
      { status: 503 }
    );
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

  try {
    const result = await definition.run(body);
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

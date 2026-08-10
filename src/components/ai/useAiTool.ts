"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CvModel } from "@/lib/cv-model";

/**
 * useAiTool — shared hook that POSTs the already-fetched CvModel to
 * POST /api/ai/[tool] and tracks the request lifecycle.
 *
 * The server component owns the CvModel (no GitHub re-fetch); this hook
 * only serializes it into the AI endpoint. States:
 *   idle         — model prop is null (nothing to analyze)
 *   loading      — fetch in flight
 *   ready        — 200, `result` holds the tool's typed payload
 *   unconfigured — 503 (AI_API_KEY missing on this deployment) — treated
 *                  as a friendly notice, NOT as an error/panic
 *   error        — any other failure (502/500/network), `message` is safe
 *                  to show to the user
 */

export type AiToolState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; result: T }
  | { status: "unconfigured" }
  | { status: "error"; message: string };

export type AiInsightsStatus =
  | "ready"
  | "coming_soon"
  | "loading"
  | "error"
  | "empty";

export function useAiTool<T>(
  tool: string,
  model: CvModel | null
): AiToolState<T> {
  const [state, setState] = useState<AiToolState<T>>(() =>
    model ? { status: "loading" } : { status: "idle" }
  );

  useEffect(() => {
    if (!model) {
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    fetch(`/api/ai/${tool}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    })
      .then(async (res) => {
        if (cancelled) return;
        const data = await res.json().catch(() => null);

        if (res.status === 503) {
          setState({ status: "unconfigured" });
          return;
        }
        if (!res.ok) {
          setState({
            status: "error",
            message: data?.error ?? "AI request failed.",
          });
          return;
        }
        setState({ status: "ready", result: (data?.result ?? null) as T });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "error", message: "Network error — please try again." });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tool, model]);

  return state;
}

/**
 * useAiToolAction — like useAiTool, but the fetch is triggered by a user
 * action (button click) instead of firing on mount, and the request body
 * can carry extra tool-specific fields (e.g. { jobDescription } for the
 * tailor tool). Shares the exact same state machine as useAiTool.
 */
export function useAiToolAction<T>(
  tool: string,
  model: CvModel | null,
  extra: Record<string, unknown> = {}
): { state: AiToolState<T>; run: () => void } {
  const [state, setState] = useState<AiToolState<T>>({ status: "idle" });
  const [nonce, setNonce] = useState(0);

  // Keep the latest `extra` in a ref so the effect only re-runs when the
  // user actually triggers it (nonce bump), not on every parent re-render
  // with a freshly-allocated `extra` object.
  const extraRef = useRef(extra);
  extraRef.current = extra;

  useEffect(() => {
    if (nonce === 0) return; // not triggered yet
    if (!model) {
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    fetch(`/api/ai/${tool}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, ...extraRef.current }),
    })
      .then(async (res) => {
        if (cancelled) return;
        const data = await res.json().catch(() => null);

        if (res.status === 503) {
          setState({ status: "unconfigured" });
          return;
        }
        if (!res.ok) {
          setState({
            status: "error",
            message: data?.error ?? "AI request failed.",
          });
          return;
        }
        setState({ status: "ready", result: (data?.result ?? null) as T });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "error", message: "Network error — please try again." });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tool, model, nonce]);

  const run = useCallback(() => setNonce((n) => n + 1), []);

  return { state, run };
}

/** Maps the hook state onto the AIInsightsCard status prop. */
export function toInsightsStatus<T>(state: AiToolState<T>): AiInsightsStatus {
  switch (state.status) {
    case "ready":
      return "ready";
    case "loading":
      return "loading";
    case "error":
      return "error";
    default:
      // idle + unconfigured render custom children without a badge.
      return "empty";
  }
}

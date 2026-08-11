"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CvModel } from "@/lib/cv-model";

/**
 * useAiTool — shared hook that POSTs the already-fetched CvModel to
 * POST /api/ai/[tool] and tracks the request lifecycle.
 *
 * The server component owns the CvModel (no GitHub re-fetch); this hook
 * only serializes it into the AI endpoint. The API route caches results
 * per (user, tool, input) for 24h, so repeat mounts are served from the
 * database with zero LLM calls; `regenerate()` forces a fresh call.
 *
 * States:
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
  model: CvModel | null,
  /**
   * Stagger the initial mount fetch (regenerate always starts immediately).
   * The three dashboard cards pass 0 / 600 / 1200 ms so their parallel burst
   * becomes sequential — Gemini free tier is ~10-15 RPM, so firing 3 LLM
   * calls at once is what exhausts the budget after a few page loads.
   */
  delayMs = 0
): {
  state: AiToolState<T>;
  /** True while a regenerate request is in flight (old result stays visible). */
  isRegenerating: boolean;
  /** Bypasses the 24h result cache and refetches from the LLM. */
  regenerate: () => void;
} {
  const [state, setState] = useState<AiToolState<T>>(() =>
    model ? { status: "loading" } : { status: "idle" }
  );
  const [nonce, setNonce] = useState(0);
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    if (!model) {
      setState({ status: "idle" });
      setIsRegenerating(false);
      return;
    }

    let cancelled = false;
    // nonce 0 = initial mount (skeleton). nonce > 0 = regenerate — keep the
    // previous result visible while the fresh copy is being fetched.
    const regenerating = nonce > 0;

    const startFetch = () => {
      if (cancelled) return;
      if (regenerating) {
        setIsRegenerating(true);
      } else {
        setState({ status: "loading" });
      }

      fetch(`/api/ai/${tool}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(regenerating ? { model, regenerate: true } : { model }),
      })
        .then(async (res) => {
          if (cancelled) return;
          const data = await res.json().catch(() => null);

          if (res.status === 503) {
            setState({ status: "unconfigured" });
            return;
          }
          if (res.status === 429) {
            setState({
              status: "error",
              message: "AI is busy — try again in a moment.",
            });
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
        })
        .finally(() => {
          if (!cancelled) setIsRegenerating(false);
        });
    };

    // Stagger only the initial mount fetch (see delayMs doc above).
    const delay = nonce === 0 ? delayMs : 0;
    if (delay > 0) {
      const timer = setTimeout(startFetch, delay);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }

    startFetch();
    return () => {
      cancelled = true;
    };
  }, [tool, model, nonce, delayMs]);

  const regenerate = useCallback(() => setNonce((n) => n + 1), []);

  return { state, isRegenerating, regenerate };
}

/**
 * useAiToolAction — like useAiTool, but the fetch is triggered by a user
 * action (button click) instead of firing on mount, and the request body
 * can carry extra tool-specific fields (e.g. { jobDescription } for the
 * tailor tool). Shares the exact same state machine as useAiTool.
 *
 * The first trigger (nonce 1) may be served from the 24h cache; passing
 * `regenerate: true` to `run()` bypasses the cache for an explicit refresh.
 */
export function useAiToolAction<T>(
  tool: string,
  model: CvModel | null,
  extra: Record<string, unknown> = {}
): { state: AiToolState<T>; run: (opts?: { regenerate?: boolean }) => void } {
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
      // `regenerate: true` is merged into extraRef.current by run() when
      // the user explicitly asks for a fresh result — it is sent as-is and
      // excluded from the cache key server-side.
      body: JSON.stringify({ model, ...extraRef.current }),
    })
      .then(async (res) => {
        if (cancelled) return;
        const data = await res.json().catch(() => null);

        if (res.status === 503) {
          setState({ status: "unconfigured" });
          return;
        }
        if (res.status === 429) {
          setState({
            status: "error",
            message: "AI is busy — try again in a moment.",
          });
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

  const run = useCallback(
    (opts?: { regenerate?: boolean }) => {
      if (opts?.regenerate) {
        extraRef.current = { ...extraRef.current, regenerate: true };
      }
      setNonce((n) => n + 1);
    },
    []
  );

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

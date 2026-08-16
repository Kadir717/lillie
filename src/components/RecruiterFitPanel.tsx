"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";


/**
 * Recruiter candidate-fit panel.
 *
 * Two-step flow against the Sprint B/C backend (no new API code here):
 *   1. POST /api/recruiter/cv-parse      — upload the candidate's CV file,
 *                                          get back extracted plain text.
 *   2. POST /api/recruiter/fit           — send that text + the job
 *                                          description, get a TailorResult.
 *
 * State machine: idle → uploading → parsed → analyzing → result (error can
 * be entered from any async step and allows retry with the same inputs).
 *
 * ── PRIVACY / EPHEMERAL ─────────────────────────────────────────
 * NOTHING is persisted anywhere. The candidate is a third party with no
 * LILLIE account: the CV text, job description, and the AI result exist
 * only in this component's state. Refreshing the page or clicking
 * "Analyze another candidate" discards everything — this is intentional.
 *
 * The sign-out button lives here too (same "use client" file) so the
 * dashboard page stays a thin server component and the diff stays small.
 */

/** Mirrors the API's TailorResult shape (src/lib/ai/services.ts). */
interface FitResult {
  fitScore: number;
  matchedStrengths: string[];
  gaps: string[];
  talkingPoints: string[];
  coverNote: string;
}

type Phase = "idle" | "uploading" | "parsed" | "analyzing" | "result" | "error";

interface RecruiterFitPanelProps {
  email: string;
  companyName: string | null;
}

export default function RecruiterFitPanel({
  email,
  companyName,
}: RecruiterFitPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FitResult | null>(null);
  const [copied, setCopied] = useState(false);

  const busy =
    phase === "uploading" || phase === "parsed" || phase === "analyzing";
  const canAnalyze = file !== null && jobDescription.trim().length > 0 && !busy;

  /**
   * Runs the whole flow from one button: upload+parse the CV, then (only
   * after that succeeds) fire the AI fit analysis with both inputs.
   */
  async function handleAnalyze() {
    if (!file || !jobDescription.trim() || busy) return;
    setError(null);
    setResult(null);
    setCopied(false);

    // ── Step 1: upload + parse the CV file ───────────────────────
    setPhase("uploading");
    let cvText = "";
    try {
      const formData = new FormData();
      formData.append("file", file);
      const parseRes = await fetch("/api/recruiter/cv-parse", {
        method: "POST",
        body: formData,
      });
      const parseData = (await parseRes.json().catch(() => null)) as
        | { text?: string; error?: string }
        | null;

      // Surface the API's own descriptive message (format, size, scanned…).
      if (!parseRes.ok) {
        setError(parseData?.error ?? "Couldn't process the file. Please try again.");
        setPhase("error");
        return;
      }
      cvText = parseData?.text ?? "";
      if (!cvText) {
        setError("No text could be extracted from this file. Please try a different one.");
        setPhase("error");
        return;
      }
    } catch {
      setError("Network error while uploading the file. Please try again.");
      setPhase("error");
      return;
    }

    // ── Step 2: AI fit analysis (automatic — no second click) ────
    setPhase("parsed");
    setPhase("analyzing");
    try {
      const fitRes = await fetch("/api/recruiter/fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cvText, jobDescription: jobDescription.trim() }),
      });
      const fitData = (await fitRes.json().catch(() => null)) as
        | { result?: FitResult; error?: string }
        | null;

      if (!fitRes.ok) {
        setError(fitData?.error ?? "Analysis failed. Please try again.");
        setPhase("error");
        return;
      }
      if (!fitData?.result) {
        setError("The analysis returned an empty result. Please try again.");
        setPhase("error");
        return;
      }
      setResult(fitData.result);
      setPhase("result");
    } catch {
      setError("Network error during analysis. Please try again.");
      setPhase("error");
    }
  }

  /** Full reset — discards the file, the text, and any result (ephemeral). */
  function handleReset() {
    setFile(null);
    setJobDescription("");
    setResult(null);
    setError(null);
    setCopied(false);
    setPhase("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(f: File | null) {
    setFile(f);
    // Picking a new file after a result/error starts a fresh analysis.
    if (phase === "result" || phase === "error") {
      setResult(null);
      setError(null);
      setPhase("idle");
    }
  }

  async function handleCopyCoverNote() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.coverNote);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permissions/context) — leave state unchanged.
    }
  }

  const buttonLabel = (() => {
    if (phase === "uploading") return "Uploading…";
    if (phase === "parsed" || phase === "analyzing") return "Analyzing…";
    return "Analyze fit";
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Candidate fit analysis</h1>
        <p className="mt-1 text-sm text-slate">
          Signed in as {email}
          {companyName ? ` · ${companyName}` : ""} — upload a candidate&apos;s CV
          and paste the job description to get AI-powered application advice.
        </p>
      </div>

      {/* ── Input card: file + job description ─────────────────── */}
      {phase !== "result" && (
        <div className="bg-cloud border border-line rounded-card p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Candidate CV
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx"
              disabled={busy}
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-ink file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-signal file:text-white file:font-medium file:text-sm hover:file:bg-signal/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            />
            <p className="mt-1.5 text-xs text-slate">
              PDF or DOCX, up to 5MB. The file is parsed for text only — nothing is stored.
            </p>
          </div>

          <div>
            <label htmlFor="job-description" className="block text-sm font-medium text-ink mb-1.5">
              Job description
            </label>
            <textarea
              id="job-description"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              disabled={busy}
              rows={6}
              placeholder="Paste the job description here…"
              className="w-full bg-paper text-ink border border-line rounded-lg px-3 py-2 text-sm placeholder:text-slate/70 focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal disabled:opacity-40 disabled:cursor-not-allowed resize-y"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3"
            >
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            className="w-full sm:w-auto bg-signal hover:bg-signal/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white font-semibold px-6 py-2.5 rounded-lg text-sm"
          >
            {buttonLabel}
          </button>
        </div>
      )}

      {/* ── Result view ────────────────────────────────────────── */}
      {phase === "result" && result && (
        <div className="space-y-5">
          {/* Fit score */}
          <div className="bg-cloud border border-line rounded-card p-5 flex items-center gap-5">
            <div className="font-mono text-4xl font-bold text-signal shrink-0">
              {result.fitScore}
            </div>
            <div className="flex-1">
              <div
                className="h-2.5 bg-signal-tint rounded-full overflow-hidden"
                role="img"
                aria-label={`Fit score ${result.fitScore} out of 100`}
              >
                <div
                  className="h-full bg-signal rounded-full"
                  style={{
                    width: `${Math.min(100, Math.max(0, result.fitScore))}%`,
                  }}
                />
              </div>
              <p className="text-xs text-slate mt-1.5">Fit score out of 100</p>
            </div>
          </div>

          <div className="bg-cloud border border-line rounded-card p-5">
            <h3 className="text-sm font-semibold text-ink mb-2">Matched strengths</h3>
            {result.matchedStrengths.length > 0 ? (
              <ul className="space-y-1.5">
                {result.matchedStrengths.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink">
                    <span className="text-grid shrink-0" aria-hidden>
                      ✓
                    </span>
                    {s}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate">No strong matches identified.</p>
            )}
          </div>

          <div className="bg-cloud border border-line rounded-card p-5">
            <h3 className="text-sm font-semibold text-ink mb-2">Gaps / watch-outs</h3>
            {result.gaps.length > 0 ? (
              <ul className="space-y-1.5">
                {result.gaps.map((g, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink">
                    <span className="text-red-400 shrink-0" aria-hidden>
                      ✗
                    </span>
                    {g}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate">No significant gaps identified.</p>
            )}
          </div>

          <div className="bg-cloud border border-line rounded-card p-5">
            <h3 className="text-sm font-semibold text-ink mb-2">Talking points</h3>
            {result.talkingPoints.length > 0 ? (
              <ul className="space-y-1.5">
                {result.talkingPoints.map((t, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink">
                    <span className="text-signal shrink-0" aria-hidden>
                      •
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate">No talking points generated.</p>
            )}
          </div>

          {/* Cover note */}
          <div className="bg-cloud border border-line rounded-card p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-ink">Cover note draft</h3>
              <button
                type="button"
                onClick={handleCopyCoverNote}
                className="text-xs font-medium text-signal hover:text-signal/80 transition-colors px-2 py-1 rounded-md hover:bg-signal-tint"
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">
              {result.coverNote}
            </p>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="w-full sm:w-auto border border-line bg-cloud hover:bg-paper transition-colors text-ink font-medium px-6 py-2.5 rounded-lg text-sm"
          >
            Analyze another candidate
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Minimal sign-out button for the recruiter header.
 *
 * POSTs to the logout route (best-effort) and always navigates back to the
 * recruiter login page, matching the login/signup pages' controlled-state
 * style (no <form> element).
 */
export function RecruiterSignOutButton() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch("/api/recruiter-auth/logout", { method: "POST" });
    } catch {
      // Best-effort: the cookie is cleared client-side anyway on navigation.
    }
    router.push("/recruiter/login");
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={signingOut}
      className="text-sm font-medium text-signal hover:text-signal/80 transition-colors disabled:opacity-40"
    >
      {signingOut ? "Signing out…" : "Sign out"}
    </button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * Recruiter login page.
 *
 * Email + password for company-side accounts (separate from the GitHub
 * OAuth user flow). Controlled state only — no <form> element; Enter in
 * any field triggers the same submit path.
 *
 * // TODO(Sprint D): dashboard page not yet built
 */
export default function RecruiterLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (submitting) return;
    setError(null);

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/recruiter-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }

      // TODO(Sprint D): dashboard page not yet built — this route 404s
      // until the recruiter dashboard lands in Sprint D.
      router.push("/recruiter/dashboard");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="max-w-md mx-auto px-6 py-16 sm:py-24">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-signal hover:text-signal/80 transition-colors"
        >
          ← Back to LILLIE
        </Link>

        <div className="mt-8 bg-cloud border border-line rounded-card p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Recruiter sign in</h1>
          <p className="mt-1 text-sm text-slate">
            Company-side access. Recruiter accounts are separate from GitHub
            sign-in.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink mb-1.5">
                Work email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="you@company.com"
                className="w-full bg-paper text-ink border border-line rounded-lg px-3 py-2 text-sm placeholder:text-slate/70 focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="••••••••"
                className="w-full bg-paper text-ink border border-line rounded-lg px-3 py-2 text-sm placeholder:text-slate/70 focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal"
              />
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3"
            >
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-6 w-full bg-signal hover:bg-signal/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white font-semibold px-6 py-2.5 rounded-lg text-sm"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </div>

        <p className="mt-6 text-sm text-slate text-center">
          Don&apos;t have a recruiter account?{" "}
          <Link href="/recruiter/signup" className="text-signal font-medium hover:text-signal/80 transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}

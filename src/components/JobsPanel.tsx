"use client";

import { useState } from "react";
import EmptyState from "./ai/EmptyState";
import { JOB_STATUSES, JOB_PRIORITIES } from "@/lib/jobs/types";
import type { JobStatus, JobPriority } from "@/lib/jobs/types";

/**
 * JobsPanel — job application tracking UI.
 *
 * Pure presentation + API integration: receives the initial job list from
 * the server component (no client-side list fetch, matching the dashboard
 * pattern) and performs all mutations (create / status update / delete /
 * analyze) through the existing jobs API. Reuses the shared JobStatus /
 * JobPriority types from src/lib/jobs/types — no local re-invention.
 */
export interface JobListItem {
  id: string;
  company: string;
  title: string;
  url: string | null;
  status: JobStatus;
  priority: JobPriority;
  matchScore: number | null;
  appliedAt: string | null;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_META: Record<JobStatus, { label: string }> = {
  saved: { label: "Saved" },
  applied: { label: "Applied" },
  interviewing: { label: "Interviewing" },
  offer: { label: "Offer" },
  rejected: { label: "Rejected" },
  archived: { label: "Archived" },
};

const PRIORITY_META: Record<JobPriority, { label: string; className: string }> = {
  low: { label: "Low", className: "text-slate" },
  medium: { label: "Medium", className: "text-signal" },
  high: { label: "High", className: "text-red-400" },
};

interface JobForm {
  company: string;
  title: string;
  url: string;
  notes: string;
  status: JobStatus;
  priority: JobPriority;
  appliedAt: string;
  deadline: string;
}

const EMPTY_FORM: JobForm = {
  company: "",
  title: "",
  url: "",
  notes: "",
  status: "saved",
  priority: "medium",
  appliedAt: "",
  deadline: "",
};

/** Match-score colors: GitHub-derived data always uses the grid (green) token. */
function scoreClass(score: number): string {
  if (score >= 70) return "text-grid";
  if (score >= 40) return "text-grid";
  return "text-red-400";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function JobsPanel({
  initialJobs = [],
  initialError = false,
}: {
  initialJobs?: JobListItem[];
  initialError?: boolean;
}) {
  const [jobs, setJobs] = useState<JobListItem[]>(initialJobs);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<JobForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  // ── Create ─────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const company = form.company.trim();
    const title = form.title.trim();

    // Client-side guards mirror the API's validation (POST /api/jobs).
    if (!company || company.length > 120) {
      setFormError("Company is required and must be 120 characters or fewer.");
      return;
    }
    if (!title || title.length > 120) {
      setFormError("Job title is required and must be 120 characters or fewer.");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const payload: Record<string, unknown> = {
        company,
        title,
        status: form.status,
        priority: form.priority,
      };
      if (form.url.trim()) payload.url = form.url.trim();
      if (form.notes.trim()) payload.notes = form.notes.trim();
      if (form.appliedAt) payload.appliedAt = new Date(form.appliedAt).toISOString();
      if (form.deadline) payload.deadline = new Date(form.deadline).toISOString();

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFormError(data?.error || "Failed to create job.");
        return;
      }
      setJobs((prev) => [data.job, ...prev]);
      setForm(EMPTY_FORM);
      setFormOpen(false);
    } catch {
      setFormError("Network error — could not create the job.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Status update ──────────────────────────────────────────────
  async function handleStatusChange(job: JobListItem, status: JobStatus) {
    setMutatingId(job.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setActionError(data?.error || "Failed to update status.");
        return;
      }
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, status, updatedAt: data.job?.updatedAt ?? j.updatedAt } : j))
      );
    } catch {
      setActionError("Network error — could not update status.");
    } finally {
      setMutatingId(null);
    }
  }

  // ── Analyze match (existing /api/jobs/[id]/match endpoint) ─────
  async function handleAnalyze(job: JobListItem) {
    setAnalyzingId(job.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/match`);
      const data = await res.json().catch(() => null);
      if (res.status === 429) {
        setActionError("GitHub API rate limit reached — try again in a few minutes.");
        return;
      }
      if (res.status === 502) {
        setActionError("GitHub API is temporarily unavailable — try again later.");
        return;
      }
      if (!res.ok) {
        setActionError(data?.error || "Failed to analyze the match.");
        return;
      }
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, matchScore: data.matchScore } : j))
      );
    } catch {
      setActionError("Network error — could not analyze the match.");
    } finally {
      setAnalyzingId(null);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────
  async function handleDelete(job: JobListItem) {
    if (!confirm(`Delete "${job.title}" at ${job.company}? This cannot be undone.`)) return;
    setMutatingId(job.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setActionError(data?.error || "Failed to delete job.");
        return;
      }
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
    } catch {
      setActionError("Network error — could not delete the job.");
    } finally {
      setMutatingId(null);
    }
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Jobs</h1>
          <p className="text-sm text-slate mt-1">
            Track your applications and see how well each role matches your GitHub profile.
          </p>
        </div>
        <button
          onClick={() => setFormOpen((v) => !v)}
          aria-expanded={formOpen}
          className="shrink-0 px-4 py-2 rounded-lg bg-signal text-white text-sm font-medium hover:bg-signal/90 transition-colors"
        >
          {formOpen ? "Cancel" : "+ Add job"}
        </button>
      </div>

      {/* Create form */}
      {formOpen && (
        <form
          onSubmit={handleCreate}
          className="bg-cloud border border-line rounded-xl p-5 mb-6 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Company" required>
              <input
                type="text"
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                maxLength={120}
                placeholder="e.g. Acme Corp"
                className="w-full bg-paper text-ink text-sm px-3 py-2 rounded-lg border border-line outline-none focus:border-signal placeholder:text-slate/60"
              />
            </Field>
            <Field label="Job title" required>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                maxLength={120}
                placeholder="e.g. Senior Frontend Engineer"
                className="w-full bg-paper text-ink text-sm px-3 py-2 rounded-lg border border-line outline-none focus:border-signal placeholder:text-slate/60"
              />
            </Field>
            <Field label="Posting URL">
              <input
                type="url"
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                maxLength={500}
                placeholder="https://…"
                className="w-full bg-paper text-ink text-sm px-3 py-2 rounded-lg border border-line outline-none focus:border-signal placeholder:text-slate/60"
              />
            </Field>
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as JobStatus }))}
                className="w-full bg-paper text-ink text-sm px-3 py-2 rounded-lg border border-line outline-none focus:border-signal [color-scheme:light]"
              >
                {JOB_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as JobPriority }))}
                className="w-full bg-paper text-ink text-sm px-3 py-2 rounded-lg border border-line outline-none focus:border-signal [color-scheme:light]"
              >
                {JOB_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Applied date">
              <input
                type="date"
                value={form.appliedAt}
                onChange={(e) => setForm((f) => ({ ...f, appliedAt: e.target.value }))}
                className="w-full bg-paper text-ink text-sm px-3 py-2 rounded-lg border border-line outline-none focus:border-signal [color-scheme:light]"
              />
            </Field>
            <Field label="Deadline">
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                className="w-full bg-paper text-ink text-sm px-3 py-2 rounded-lg border border-line outline-none focus:border-signal [color-scheme:light]"
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              maxLength={2000}
              rows={2}
              placeholder="Interview prep, contacts, links…"
              className="w-full bg-paper text-ink text-sm px-3 py-2 rounded-lg border border-line outline-none focus:border-signal placeholder:text-slate/60 resize-y"
            />
          </Field>

          {formError && <p className="text-xs text-red-400">{formError}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-signal text-white text-sm font-medium hover:bg-signal/90 transition-colors disabled:opacity-40"
            >
              {submitting ? "Adding…" : "Add job"}
            </button>
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                setForm(EMPTY_FORM);
                setFormError(null);
              }}
              className="text-sm text-slate hover:text-ink transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Non-blocking action error */}
      {actionError && (
        <div className="flex items-center justify-between gap-3 bg-red-900 border border-red-400/30 rounded-lg px-4 py-2.5 mb-4">
          <p className="text-xs text-red-300">{actionError}</p>
          <button
            onClick={() => setActionError(null)}
            className="text-red-300/60 hover:text-red-300 text-sm leading-none"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Initial load failed */}
      {initialError && jobs.length === 0 && (
        <div className="bg-red-900 border border-red-400/30 rounded-xl p-5 text-center">
          <p className="text-sm text-red-300">Couldn&apos;t load your jobs. Please refresh the page.</p>
        </div>
      )}

      {/* Empty state */}
      {!initialError && jobs.length === 0 && (
        <div className="bg-cloud border border-line rounded-xl">
          <EmptyState
            variant="no_data"
            title="No jobs tracked yet"
            description="Add the roles you're applying to and LILLIE will score how well your GitHub profile matches each one."
            action={{ label: "Add your first job", onClick: () => setFormOpen(true) }}
          />
        </div>
      )}

      {/* Job list */}
      {jobs.length > 0 && (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              mutating={mutatingId === job.id}
              analyzing={analyzingId === job.id}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              onAnalyze={handleAnalyze}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JobCard({
  job,
  mutating,
  analyzing,
  onStatusChange,
  onDelete,
  onAnalyze,
}: {
  job: JobListItem;
  mutating: boolean;
  analyzing: boolean;
  onStatusChange: (job: JobListItem, status: JobStatus) => void;
  onDelete: (job: JobListItem) => void;
  onAnalyze: (job: JobListItem) => void;
}) {
  const priority = PRIORITY_META[job.priority] ?? PRIORITY_META.medium;

  return (
    <div className="bg-cloud border border-line rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-medium text-ink truncate">{job.title}</h3>
          <p className="text-sm text-slate truncate">{job.company}</p>
        </div>

        {/* Match score (cached on the row by /api/jobs/[id]/match) */}
        <div className="text-right shrink-0">
          {job.matchScore !== null ? (
            <>
              <p className={`text-2xl font-bold ${scoreClass(job.matchScore)}`}>
                {job.matchScore}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-slate">
                match /100
              </p>
            </>
          ) : (
            <button
              onClick={() => onAnalyze(job)}
              disabled={analyzing || mutating}
              className="text-xs text-signal hover:text-signal/80 border border-signal/30 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
            >
              {analyzing ? "Analyzing…" : "Analyze match"}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4">
        {/* Status dropdown (PATCH on change) */}
        <label className="flex items-center gap-2 text-xs text-slate">
          Status
          <select
            value={job.status}
            onChange={(e) => onStatusChange(job, e.target.value as JobStatus)}
            disabled={mutating}
            aria-label={`Status for ${job.title} at ${job.company}`}
            className="bg-paper text-ink text-xs px-2 py-1.5 rounded-lg border border-line outline-none focus:border-signal [color-scheme:light] disabled:opacity-40 cursor-pointer"
          >
            {JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
          {mutating && (
            <span className="text-[10px] text-slate animate-pulse">Saving…</span>
          )}
        </label>

        {/* Priority */}
        <span
          className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-line ${priority.className}`}
        >
          {priority.label} priority
        </span>

        {/* Posting link */}
        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-signal hover:text-signal/80 underline underline-offset-2 truncate max-w-[200px]"
          >
            View posting ↗
          </a>
        )}

        <span className="text-[11px] text-slate ml-auto">
          Added {formatDate(job.createdAt)}
          {job.deadline && <> · deadline {formatDate(job.deadline)}</>}
        </span>

        {/* Delete */}
        <button
          onClick={() => onDelete(job)}
          disabled={mutating}
          className="text-xs text-red-400/50 hover:text-red-400 transition-colors disabled:opacity-30"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-slate mb-1.5 block">
        {label}
        {required && <span className="text-signal"> *</span>}
      </span>
      {children}
    </label>
  );
}

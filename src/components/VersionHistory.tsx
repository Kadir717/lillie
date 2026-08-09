"use client";

import { useState, useEffect, useCallback } from "react";
import type { CvModel } from "@/cv";
import { compareCvModels, type VersionDiff } from "@/lib/cv-compare";

interface VersionRow {
  id: string;
  label: string | null;
  locale: string;
  template: string;
  createdAt: string;
}

const localeName: Record<string, string> = {
  en: "EN",
  tr: "TR",
  de: "DE",
  fr: "FR",
  es: "ES",
  pt: "PT",
  ja: "JA",
  ko: "KO",
  zh: "ZH",
  ru: "RU",
  ar: "AR",
};

/**
 * VersionHistory — resume history panel.
 *
 * Features:
 *   - Save the current CV state as an immutable version
 *   - List saved versions (newest first)
 *   - Compare two versions (or "Current" against a version) side-by-side
 *   - Restore a version into the live preview
 *   - Delete a version
 *
 * All writes go through /api/profiles/:id/versions. No duplicate logic —
 * the comparison itself lives in src/lib/cv-compare.ts (pure, shared).
 */
export default function VersionHistory({
  profileId,
  model,
  locale,
  template,
  onRestore,
}: {
  profileId: string;
  model: CvModel | null;
  locale: string;
  template: string;
  onRestore: (model: CvModel) => void;
}) {
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [versionA, setVersionA] = useState("current");
  const [versionB, setVersionB] = useState("");
  const [diff, setDiff] = useState<VersionDiff | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  const [deleting, setDeleting] = useState<string | null>(null);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/profiles/${profileId}/versions`);
      if (!res.ok) throw new Error("Failed to load versions");
      const data = await res.json();
      setVersions(data.versions ?? []);
    } catch {
      setError("Couldn't load version history.");
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  // ── Save current state ──────────────────────────────────────────
  async function handleSave() {
    if (!model) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/profiles/${profileId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim() || undefined,
          locale,
          template,
          model,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save version");
      }
      setLabel("");
      setSaved(true);
      await loadVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save version.");
    } finally {
      setSaving(false);
    }
  }

  // ── Compare ─────────────────────────────────────────────────────
  async function fetchVersionModel(id: string): Promise<CvModel> {
    const res = await fetch(`/api/profiles/${profileId}/versions/${id}`);
    if (!res.ok) throw new Error("Failed to load version");
    const data = await res.json();
    return data.version.model as CvModel;
  }

  async function handleCompare(targetId?: string) {
    const b = targetId ?? versionB;
    if (!b) return;
    if (versionA === "current" && !model) {
      setCompareError("CV data isn't loaded yet — try again in a moment.");
      return;
    }
    setCompareLoading(true);
    setCompareError(null);
    setDiff(null);
    try {
      const [modelA, modelB] = await Promise.all([
        versionA === "current" ? Promise.resolve(model!) : fetchVersionModel(versionA),
        fetchVersionModel(b),
      ]);
      setDiff(compareCvModels(modelA, modelB));
    } catch {
      setCompareError("Couldn't compare these versions.");
    } finally {
      setCompareLoading(false);
    }
  }

  // ── Restore ─────────────────────────────────────────────────────
  async function handleRestore(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/profiles/${profileId}/versions/${id}`);
      if (!res.ok) throw new Error("Failed to load version");
      const data = await res.json();
      onRestore(data.version.model as CvModel);
    } catch {
      setError("Couldn't restore that version.");
    }
  }

  // ── Delete ──────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    setDeleting(id);
    setError(null);
    try {
      const res = await fetch(`/api/profiles/${profileId}/versions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete version");
      setVersions((prev) => prev.filter((v) => v.id !== id));
    } catch {
      setError("Couldn't delete that version.");
    } finally {
      setDeleting(null);
    }
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="border border-line rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Resume History</h3>
        <span className="text-[10px] uppercase tracking-widest text-slate/60">
          {versions.length} version{versions.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Save current state */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            setSaved(false);
          }}
          placeholder="Label (e.g. v2, Before ATS pass)"
          disabled={!model || saving}
          className="flex-1 bg-paper text-ink text-sm px-3 py-2 rounded-lg border border-line outline-none placeholder:text-slate disabled:opacity-40"
        />
        <button
          onClick={handleSave}
          disabled={!model || saving}
          className="bg-signal hover:bg-signal/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white font-semibold text-sm px-4 py-2 rounded-lg"
        >
          {saving ? "Saving..." : "Save version"}
        </button>
      </div>
      {saved && (
        <p className="text-xs text-green-600">Version saved.</p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Compare */}
      <div className="border-t border-line pt-4 space-y-3">
        <p className="text-xs uppercase tracking-wide text-slate">
          Compare versions
        </p>
        <div className="flex flex-col sm:flex-row items-stretch gap-2">
          <select
            value={versionA}
            onChange={(e) => {
              setVersionA(e.target.value);
              setDiff(null);
              setCompareError(null);
            }}
            className="flex-1 bg-paper text-ink text-sm px-3 py-2 rounded-lg border border-line outline-none"
          >
            <option value="current">Current</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label || formatDate(v.createdAt)}
              </option>
            ))}
          </select>
          <select
            value={versionB}
            onChange={(e) => {
              setVersionB(e.target.value);
              setDiff(null);
              setCompareError(null);
            }}
            className="flex-1 bg-paper text-ink text-sm px-3 py-2 rounded-lg border border-line outline-none"
          >
            <option value="">Select…</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label || formatDate(v.createdAt)}
              </option>
            ))}
          </select>
          <button
            onClick={() => handleCompare()}
            disabled={!versionB || compareLoading || versions.length === 0}
            className="bg-paper border border-line hover:border-signal/40 disabled:opacity-40 transition-colors text-ink text-sm px-4 py-2 rounded-lg"
          >
            {compareLoading ? "Comparing..." : "Compare"}
          </button>
        </div>

        {compareError && (
          <p className="text-xs text-red-500">{compareError}</p>
        )}
        {diff && <DiffView diff={diff} />}
      </div>

      {/* Version list */}
      <div className="border-t border-line pt-4">
        {loading ? (
          <p className="text-xs text-slate/60 py-2">Loading history…</p>
        ) : versions.length === 0 ? (
          <p className="text-xs text-slate/60 py-2">
            No versions yet. Save your current CV to start a history.
          </p>
        ) : (
          <ul className="space-y-2">
            {versions.map((v) => (
              <li
                key={v.id}
                className="flex items-center gap-2 text-sm py-1 border-b border-line last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-ink/80 truncate">
                    {v.label || formatDate(v.createdAt)}
                    {!v.label && (
                      <span className="text-slate/60 text-xs ml-2">
                        {formatDate(v.createdAt)}
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate/70">
                    {localeName[v.locale] || v.locale} ·{" "}
                    {v.template.replace(/_/g, " ")}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleRestore(v.id)}
                    className="text-xs text-slate hover:text-signal transition-colors px-2 py-1"
                    title="Restore into preview"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => {
                      setVersionB(v.id);
                      handleCompare(v.id);
                    }}
                    disabled={compareLoading}
                    className="text-xs text-slate hover:text-signal transition-colors px-2 py-1 disabled:opacity-30"
                    title="Compare this version against the selected baseline"
                  >
                    Compare
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete this version? This cannot be undone.")) {
                        handleDelete(v.id);
                      }
                    }}
                    disabled={deleting === v.id}
                    className="text-xs text-red-500/70 hover:text-red-500 transition-colors px-2 py-1 disabled:opacity-30"
                    title="Delete version"
                  >
                    {deleting === v.id ? "…" : "Delete"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * DiffView — renders a VersionDiff as a compact change summary.
 * Pure presentational; receives the already-computed diff.
 */
function DiffView({ diff }: { diff: VersionDiff }) {
  const changeCount =
    [diff.header.nameChanged, diff.header.bioChanged, diff.header.contactsChanged].filter(
      Boolean
    ).length +
    [diff.stats.reposChanged, diff.stats.starsChanged, diff.stats.forksChanged, diff.stats.yearsChanged].filter(
      Boolean
    ).length +
    diff.languages.added.length +
    diff.languages.removed.length +
    diff.languages.changed.length +
    diff.projects.added.length +
    diff.projects.removed.length +
    diff.projects.renamed.length;

  if (diff.identical || changeCount === 0) {
    return (
      <p className="text-xs text-green-600">
        These two versions are identical.
      </p>
    );
  }

  return (
    <div className="text-xs space-y-2 bg-paper border border-line rounded-lg p-3">
      <p className="text-slate">
        <span className="font-semibold text-ink">{changeCount}</span> change
        {changeCount === 1 ? "" : "s"}
      </p>

      {(diff.header.nameChanged ||
        diff.header.bioChanged ||
        diff.header.contactsChanged) && (
        <div>
          <p className="text-slate uppercase tracking-wide mb-1">Header</p>
          {diff.header.nameChanged && (
            <ChangeRow label="Name" changed />
          )}
          {diff.header.bioChanged && (
            <ChangeRow label="Bio" changed />
          )}
          {diff.header.contactsChanged && (
            <ChangeRow label="Contacts" changed />
          )}
        </div>
      )}

      {(diff.stats.reposChanged ||
        diff.stats.starsChanged ||
        diff.stats.forksChanged ||
        diff.stats.yearsChanged) && (
        <div>
          <p className="text-slate uppercase tracking-wide mb-1">Stats</p>
          {diff.stats.reposChanged && <ChangeRow label="Repos" changed />}
          {diff.stats.starsChanged && <ChangeRow label="Stars" changed />}
          {diff.stats.forksChanged && <ChangeRow label="Forks" changed />}
          {diff.stats.yearsChanged && <ChangeRow label="Years" changed />}
        </div>
      )}

      {(diff.languages.added.length > 0 ||
        diff.languages.removed.length > 0 ||
        diff.languages.changed.length > 0) && (
        <div>
          <p className="text-slate uppercase tracking-wide mb-1">
            Languages
          </p>
          {diff.languages.added.map((name) => (
            <ChangeRow key={`+${name}`} label={name} added />
          ))}
          {diff.languages.removed.map((name) => (
            <ChangeRow key={`-${name}`} label={name} removed />
          ))}
          {diff.languages.changed.map((c) => (
            <ChangeRow
              key={`~${c.name}`}
              label={`${c.name}: ${c.from}% → ${c.to}%`}
              changed
            />
          ))}
        </div>
      )}

      {(diff.projects.added.length > 0 ||
        diff.projects.removed.length > 0 ||
        diff.projects.renamed.length > 0) && (
        <div>
          <p className="text-slate uppercase tracking-wide mb-1">
            Projects
          </p>
          {diff.projects.added.map((name) => (
            <ChangeRow key={`p+${name}`} label={name} added />
          ))}
          {diff.projects.removed.map((name) => (
            <ChangeRow key={`p-${name}`} label={name} removed />
          ))}
          {diff.projects.renamed.map((r) => (
            <ChangeRow key={`p~${r.from}`} label={`${r.from} → ${r.to}`} changed />
          ))}
        </div>
      )}
    </div>
  );
}

function ChangeRow({
  label,
  added,
  removed,
}: {
  label: string;
  added?: boolean;
  removed?: boolean;
  changed?: boolean;
}) {
  return (
    <p className="flex items-center gap-2 text-ink/80">
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          added
            ? "bg-green-600"
            : removed
              ? "bg-red-500"
              : "bg-signal"
        }`}
      />
      <span className="truncate">{label}</span>
      <span className="ml-auto text-[10px] uppercase text-slate/60 shrink-0">
        {added ? "added" : removed ? "removed" : "changed"}
      </span>
    </p>
  );
}

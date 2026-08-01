"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import DownloadButton from "./DownloadButton";
import ProfileSelector, { type CvProfileData } from "./ProfileSelector";
import VersionHistory from "./VersionHistory";
import ShareResume from "./ShareResume";
import { CvPreview } from "@/cv";
import type { CvModel } from "@/cv";

const LOCALES = [
  { code: "en", label: "English", flag: "GB" },
  { code: "tr", label: "Türkçe", flag: "TR" },
  { code: "de", label: "Deutsch", flag: "DE" },
  { code: "fr", label: "Français", flag: "FR" },
  { code: "es", label: "Español", flag: "ES" },
  { code: "pt", label: "Português", flag: "BR" },
  { code: "ja", label: "日本語", flag: "JP" },
  { code: "ko", label: "한국어", flag: "KR" },
  { code: "zh", label: "中文", flag: "CN" },
  { code: "ru", label: "Русский", flag: "RU" },
  { code: "ar", label: "العربية", flag: "SA" },
] as const;

const TEMPLATES = [
  { code: "classic_professional", label: "Classic Professional" },
  { code: "developer_card", label: "Developer Card" },
  { code: "minimal", label: "Minimal" },
] as const;

type LocaleCode = (typeof LOCALES)[number]["code"];
type TemplateCode = (typeof TEMPLATES)[number]["code"];

// ── Debounced profile save ────────────────────────────────────────
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastSave: { profileId: string; payload: Record<string, string> } | null = null;

async function saveToProfile(profileId: string, key: string, value: string) {
  if (debounceTimer) clearTimeout(debounceTimer);

  if (!lastSave || lastSave.profileId !== profileId) {
    lastSave = { profileId, payload: {} };
  }
  lastSave.payload[key] = value;

  debounceTimer = setTimeout(async () => {
    const { profileId: pid, payload } = lastSave!;
    lastSave = null;
    debounceTimer = null;

    try {
      await fetch(`/api/profiles/${pid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // Non-blocking
    }
  }, 300);
}

export default function CvPreviewPanel({
  initialPrefs,
  initialProfiles = [],
  initialModel,
}: {
  initialPrefs: { locale: string; template: string } | null;
  initialProfiles?: CvProfileData[];
  initialModel?: CvModel | null;
}) {
  // Profile state
  const [profiles, setProfiles] = useState<CvProfileData[]>(initialProfiles);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    initialProfiles.length > 0 ? initialProfiles[0].id : null
  );

  // Derive initial locale/template from selected profile or user defaults
  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);
  const [locale, setLocale] = useState<LocaleCode>(
    ((selectedProfile?.locale ?? initialPrefs?.locale) as LocaleCode) ?? "en"
  );
  const [template, setTemplate] = useState<TemplateCode>(
    ((selectedProfile?.template ?? initialPrefs?.template) as TemplateCode) ??
      "classic_professional"
  );

  const [localeOpen, setLocaleOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [model, setModel] = useState<CvModel | null>(initialModel ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchedRef = useRef(!!initialModel);

  const selectedLocale = LOCALES.find((l) => l.code === locale)!;
  const selectedTemplate = TEMPLATES.find((t) => t.code === template)!;

  // ── Profile CRUD handlers ───────────────────────────────────────

  const handleSelectProfile = useCallback((id: string) => {
    setSelectedProfileId(id);
    setRestoredFromVersion(false);
    const p = profiles.find((pr) => pr.id === id);
    if (p) {
      setLocale(p.locale as LocaleCode);
      setTemplate(p.template as TemplateCode);
    }
  }, [profiles]);

  const handleCreateProfile = useCallback(async (title: string) => {
    const res = await fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to create profile");
    }
    const { profile } = await res.json();
    setProfiles((prev) => [profile, ...prev]);
    setSelectedProfileId(profile.id);
    setLocale(profile.locale as LocaleCode);
    setTemplate(profile.template as TemplateCode);
  }, []);

  const handleRenameProfile = useCallback(async (id: string, title: string) => {
    const res = await fetch(`/api/profiles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to rename profile");
    }
    const { profile } = await res.json();
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, title: profile.title, updatedAt: profile.updatedAt } : p))
    );
  }, []);

  const handleDeleteProfile = useCallback(async (id: string) => {
    const res = await fetch(`/api/profiles/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete profile");
    setProfiles((prev) => {
      const next = prev.filter((p) => p.id !== id);
      if (selectedProfileId === id) {
        const first = next[0] ?? null;
        setSelectedProfileId(first?.id ?? null);
        if (first) {
          setLocale(first.locale as LocaleCode);
          setTemplate(first.template as TemplateCode);
        }
      }
      return next;
    });
  }, [selectedProfileId]);

  // ── Locale/template change handlers ────────────────────────────
  // Directly reads selectedProfileId from component state (not from the
  // module-level lastSave variable) so the first change per page load
  // is never dropped. Adding selectedProfileId to the deps array ensures
  // the callbacks always use the latest profile ID without needing a
  // side-effect to sync module state.

  const handleLocaleChange = useCallback((code: LocaleCode) => {
    setLocale(code);
    setLocaleOpen(false);
    setRestoredFromVersion(false);
    if (selectedProfileId) {
      saveToProfile(selectedProfileId, "locale", code);
    }
  }, [selectedProfileId]);

  const handleTemplateChange = useCallback((code: TemplateCode) => {
    setTemplate(code);
    setTemplateOpen(false);
    setRestoredFromVersion(false);
    if (selectedProfileId) {
      saveToProfile(selectedProfileId, "template", code);
    }
  }, [selectedProfileId]);

  // ── Version restore ─────────────────────────────────────────────
  // Restoring a version replaces the live preview model. The restored
  // model may be stale relative to GitHub, so a note is shown in the UI.
  const [restoredFromVersion, setRestoredFromVersion] = useState(false);

  const handleRestoreModel = useCallback((restored: CvModel) => {
    setModel(restored);
    setRestoredFromVersion(true);
    setError(false);
  }, []);

  // ── Accessibility: keyboard navigation for dropdowns ───────────
  const localeButtonRef = useRef<HTMLButtonElement>(null);
  const templateButtonRef = useRef<HTMLButtonElement>(null);
  const localeListRef = useRef<HTMLDivElement>(null);
  const templateListRef = useRef<HTMLDivElement>(null);

  const [localeHighlight, setLocaleHighlight] = useState(0);
  const [templateHighlight, setTemplateHighlight] = useState(0);

  // Focus the listbox when it opens and sync highlight to the current value.
  useEffect(() => {
    if (localeOpen) {
      localeListRef.current?.focus();
      setLocaleHighlight(
        Math.max(0, LOCALES.findIndex((l) => l.code === locale))
      );
    }
    if (templateOpen) {
      templateListRef.current?.focus();
      setTemplateHighlight(
        Math.max(0, TEMPLATES.findIndex((t) => t.code === template))
      );
    }
  }, [localeOpen, templateOpen, locale, template]);

  const handleLocaleKeydown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setLocaleOpen(false);
        localeButtonRef.current?.focus();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setLocaleHighlight((i) => {
          const next = e.key === "ArrowDown" ? i + 1 : i - 1;
          return (next + LOCALES.length) % LOCALES.length;
        });
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleLocaleChange(LOCALES[localeHighlight].code);
        localeButtonRef.current?.focus();
      }
    },
    [localeHighlight, handleLocaleChange]
  );

  const handleTemplateKeydown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setTemplateOpen(false);
        templateButtonRef.current?.focus();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setTemplateHighlight((i) => {
          const next = e.key === "ArrowDown" ? i + 1 : i - 1;
          return (next + TEMPLATES.length) % TEMPLATES.length;
        });
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleTemplateChange(TEMPLATES[templateHighlight].code);
        templateButtonRef.current?.focus();
      }
    },
    [templateHighlight, handleTemplateChange]
  );

  // ── Model fetch ────────────────────────────────────────────────

  const loadModel = useCallback(async () => {
    if (fetchedRef.current || initialModel) return;
    fetchedRef.current = true;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/cv-model`);
      if (!res.ok) throw new Error("Model fetch failed");
      const data = await res.json();
      setModel(data.model);
    } catch {
      setError(true);
      fetchedRef.current = false;
    } finally {
      setLoading(false);
    }
  }, [initialModel]);

  useEffect(() => {
    loadModel();
  }, [loadModel]);

  return (
    <div>
      {/* Profile selector */}
      <div className="mb-6">
        <label className="text-xs uppercase tracking-wide text-cream/40 mb-2 block">
          CV Profile
        </label>
        <ProfileSelector
          profiles={profiles}
          selectedId={selectedProfileId}
          onSelect={handleSelectProfile}
          onCreate={handleCreateProfile}
          onRename={handleRenameProfile}
          onDelete={handleDeleteProfile}
        />
      </div>

      {/* Selectors */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
        {/* Language Dropdown */}
        <div className="relative">
          <button
            ref={localeButtonRef}
            onClick={() => {
              setLocaleOpen((v) => !v);
              setTemplateOpen(false);
            }}
            aria-haspopup="listbox"
            aria-expanded={localeOpen}
            aria-controls="locale-listbox"
            aria-label={`Select language — current: ${selectedLocale.label}`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-coffee/60 text-sm text-cream/80 hover:text-cream transition-colors min-w-[150px] justify-between"
          >
            <span>
              {selectedLocale.flag} {selectedLocale.label}
            </span>
            <span className="text-xs opacity-50" aria-hidden="true">
              {localeOpen ? "\u25B2" : "\u25BC"}
            </span>
          </button>

          {localeOpen && (
            <div
              id="locale-listbox"
              ref={localeListRef}
              role="listbox"
              aria-label="Language options"
              tabIndex={-1}
              onKeyDown={handleLocaleKeydown}
              aria-activedescendant={`locale-option-${LOCALES[localeHighlight].code}`}
              className="absolute top-full mt-1 left-0 z-50 bg-ink border border-coffee/60 rounded-lg overflow-hidden shadow-xl min-w-[160px] max-h-72 overflow-y-auto"
            >
              {LOCALES.map((l, i) => (
                <button
                  key={l.code}
                  id={`locale-option-${l.code}`}
                  role="option"
                  aria-selected={locale === l.code}
                  onMouseEnter={() => setLocaleHighlight(i)}
                  onClick={() => {
                    handleLocaleChange(l.code);
                    localeButtonRef.current?.focus();
                  }}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors
                    ${
                      locale === l.code
                        ? "bg-amber text-ink font-semibold"
                        : i === localeHighlight
                          ? "bg-coffee/40 text-cream"
                          : "text-cream/70 hover:bg-coffee/30 hover:text-cream"
                    }`}
                >
                  <span aria-hidden="true">{l.flag}</span>
                  <span>{l.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Template Dropdown */}
        <div className="relative">
          <button
            ref={templateButtonRef}
            onClick={() => {
              setTemplateOpen((v) => !v);
              setLocaleOpen(false);
            }}
            aria-haspopup="listbox"
            aria-expanded={templateOpen}
            aria-controls="template-listbox"
            aria-label={`Select template — current: ${selectedTemplate.label}`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-coffee/60 text-sm text-cream/80 hover:text-cream transition-colors min-w-[180px] justify-between"
          >
            <span>{selectedTemplate.label}</span>
            <span className="text-xs opacity-50" aria-hidden="true">
              {templateOpen ? "\u25B2" : "\u25BC"}
            </span>
          </button>

          {templateOpen && (
            <div
              id="template-listbox"
              ref={templateListRef}
              role="listbox"
              aria-label="Template options"
              tabIndex={-1}
              onKeyDown={handleTemplateKeydown}
              aria-activedescendant={`template-option-${TEMPLATES[templateHighlight].code}`}
              className="absolute top-full mt-1 left-0 z-50 bg-ink border border-coffee/60 rounded-lg overflow-hidden shadow-xl min-w-[200px]"
            >
              {TEMPLATES.map((tpl, i) => (
                <button
                  key={tpl.code}
                  id={`template-option-${tpl.code}`}
                  role="option"
                  aria-selected={template === tpl.code}
                  onMouseEnter={() => setTemplateHighlight(i)}
                  onClick={() => {
                    handleTemplateChange(tpl.code);
                    templateButtonRef.current?.focus();
                  }}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors
                    ${
                      template === tpl.code
                        ? "bg-amber text-ink font-semibold"
                        : i === templateHighlight
                          ? "bg-coffee/40 text-cream"
                          : "text-cream/70 hover:bg-coffee/30 hover:text-cream"
                    }`}
                >
                  <span>{tpl.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CV Preview */}
      <div className="rounded-2xl shadow-2xl shadow-black/40 mb-8 overflow-auto bg-[#0d0d14] p-4 sm:p-8 flex justify-center">
        {loading && (
          <p className="text-cream/50 text-sm py-12">Loading preview...</p>
        )}
        {!loading && error && (
          <p className="text-amber-bright text-sm py-12">
            Couldn&apos;t load your data for preview. Try refreshing the page.
          </p>
        )}
        {!loading && !error && model && (
          <div
            style={{ transform: "scale(0.78)", transformOrigin: "top center" }}
          >
            <CvPreview
              key={template}
              model={model}
              templateId={template}
              locale={locale}
            />
          </div>
        )}
      </div>

      <DownloadButton
        locale={locale}
        template={template}
        profileTitle={selectedProfile?.title}
        profileId={selectedProfileId}
        disabled={!model || loading}
      />

      {/* Version history + sharing (only when a profile is selected) */}
      {selectedProfileId && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <VersionHistory
            profileId={selectedProfileId}
            model={model}
            locale={locale}
            template={template}
            onRestore={handleRestoreModel}
          />
          <ShareResume
            profileId={selectedProfileId}
            model={model}
            locale={locale}
            template={template}
            profileTitle={selectedProfile?.title}
          />
        </div>
      )}

      {restoredFromVersion && (
        <p className="text-xs text-cream/40 mt-3">
          Showing a restored version — refresh or re-download to sync with
          your latest GitHub activity.
        </p>
      )}
    </div>
  );
}

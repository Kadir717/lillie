"use client";
import { useState, useCallback } from "react";

const LOCALES = [
  { code: "en", label: "English" },
  { code: "tr", label: "Türkçe" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "中文" },
  { code: "ru", label: "Русский" },
  { code: "ar", label: "العربية" },
];

const TEMPLATES = [
  { code: "classic_professional", label: "Classic Professional" },
  { code: "developer_card", label: "Developer Card" },
];

export default function SettingsForm({
  initialLocale,
  initialTemplate,
}: {
  initialLocale: string;
  initialTemplate: string;
}) {
  const [locale, setLocale] = useState(initialLocale);
  const [template, setTemplate] = useState(initialTemplate);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, template }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save preferences");
      }
      setMessage({ type: "success", text: "Preferences saved successfully." });
    } catch (err) {
      setMessage({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Failed to save preferences. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }, [locale, template]);

  return (
    <div className="space-y-5">
      {/* Locale selector */}
      <div>
        <label className="text-xs uppercase tracking-wide text-cream/50 mb-2 block">
          Default Language
        </label>
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value)}
          className="bg-ink border border-coffee/60 rounded-lg px-3 py-2 text-sm text-cream/80 w-full max-w-xs outline-none focus:border-amber transition-colors"
        >
          {LOCALES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      {/* Template selector */}
      <div>
        <label className="text-xs uppercase tracking-wide text-cream/50 mb-2 block">
          Default Template
        </label>
        <select
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          className="bg-ink border border-coffee/60 rounded-lg px-3 py-2 text-sm text-cream/80 w-full max-w-xs outline-none focus:border-amber transition-colors"
        >
          {TEMPLATES.map((t) => (
            <option key={t.code} value={t.code}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-amber hover:bg-amber-bright disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-ink font-semibold px-6 py-2 rounded-lg text-sm"
      >
        {saving ? "Saving..." : "Save Preferences"}
      </button>

      {message && (
        <p
          className={`text-sm ${
            message.type === "success"
              ? "text-green-400"
              : "text-amber-bright"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

"use client";
import { useState, useEffect } from "react";

export default function DownloadButton({
  disabled,
  locale,
  template,
  profileTitle,
}: {
  disabled?: boolean;
  locale: string;
  template: string;
  profileTitle?: string;
}) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear stale error when locale/template changes
  useEffect(() => {
    setError(null);
  }, [locale, template, profileTitle]);

  // Map locale codes to human-readable names for filenames
  const localeName: Record<string, string> = {
    en: "English",
    tr: "Turkish",
    de: "German",
    fr: "French",
    es: "Spanish",
    pt: "Portuguese",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
    ru: "Russian",
    ar: "Arabic",
  };

  // Map template codes to human-readable names for filenames
  const templateName: Record<string, string> = {
    classic_professional: "Classic",
    developer_card: "DeveloperCard",
  };

  async function handleDownload() {
    setError(null);
    setDownloading(true);
    try {
      const res = await fetch(
        `/api/generate-cv?locale=${locale}&template=${template}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Generation failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      // Human-readable filename: {profile}-{locale}-{template}.docx
      const profileSlug = profileTitle
        ? profileTitle.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase().replace(/-+/g, "-").replace(/^-|-$/g, "")
        : "cv";
      const loc = localeName[locale] || locale;
      const tpl = templateName[template] || template;
      const filename = `${profileSlug}-${loc}-${tpl}.docx`;

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't generate your CV right now. Please try again in a moment."
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={handleDownload}
        disabled={disabled || downloading}
        className="w-full sm:w-auto bg-amber hover:bg-amber-bright disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-ink font-semibold px-8 py-3 rounded-xl"
      >
        {downloading ? "Generating..." : "Download CV (.docx)"}
      </button>
      {error && (
        <p className="text-xs text-amber-bright/80">{error}</p>
      )}
    </div>
  );
}

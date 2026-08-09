"use client";
import { useState, useEffect } from "react";

export default function DownloadButton({
  disabled,
  locale,
  template,
  profileTitle,
  profileId,
}: {
  disabled?: boolean;
  locale: string;
  template: string;
  profileTitle?: string;
  profileId?: string | null;
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
    minimal: "Minimal",
  };

  async function handleDownload() {
    setError(null);
    setDownloading(true);
    try {
      const res = await fetch(
        `/api/generate-cv?locale=${locale}&template=${template}${
          profileId ? `&profileId=${encodeURIComponent(profileId)}` : ""
        }`
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

  async function handleDownloadPdf() {
    setError(null);
    // The print page renders the exact same CvPreview full-size and opens
    // the browser's print dialog ("Save as PDF"). No server PDF library.
    window.open(
      `/print?locale=${encodeURIComponent(locale)}&template=${encodeURIComponent(template)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-col sm:flex-row items-stretch gap-2 w-full sm:w-auto">
        <button
          onClick={handleDownload}
          disabled={disabled || downloading}
          className="w-full sm:w-auto bg-signal hover:bg-signal/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white font-semibold px-8 py-3 rounded-xl"
        >
          {downloading ? "Generating..." : "Download CV (.docx)"}
        </button>
        <button
          onClick={handleDownloadPdf}
          disabled={disabled}
          className="w-full sm:w-auto border border-line hover:border-signal hover:text-signal disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-ink px-8 py-3 rounded-xl"
        >
          Download PDF
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}

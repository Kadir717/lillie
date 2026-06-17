"use client";

import { useState } from "react";

export default function DownloadButton({ disabled }: { disabled?: boolean }) {
  const [locale, setLocale] = useState<"en" | "tr">("en");
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/generate-cv?locale=${locale}`);
      if (!res.ok) throw new Error("Generation failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-github-cv.docx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Couldn't generate your CV right now. Please try again in a moment.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div className="flex rounded-lg border border-coffee/60 overflow-hidden text-sm">
        <button
          onClick={() => setLocale("en")}
          className={`px-4 py-2 transition-colors ${
            locale === "en" ? "bg-amber text-ink" : "text-cream/60 hover:text-cream"
          }`}
        >
          English
        </button>
        <button
          onClick={() => setLocale("tr")}
          className={`px-4 py-2 transition-colors ${
            locale === "tr" ? "bg-amber text-ink" : "text-cream/60 hover:text-cream"
          }`}
        >
          Türkçe
        </button>
      </div>

      <button
        onClick={handleDownload}
        disabled={disabled || downloading}
        className="flex-1 sm:flex-none bg-amber hover:bg-amber-bright disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-ink font-semibold px-8 py-3 rounded-xl"
      >
        {downloading ? "Generating…" : "Download my CV (.docx)"}
      </button>
    </div>
  );
}

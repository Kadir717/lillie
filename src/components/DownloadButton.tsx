"use client";
import { useState } from "react";

export default function DownloadButton({
  disabled,
  locale,
  template,
}: {
  disabled?: boolean;
  locale: string;
  template: string;
}) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/generate-cv?locale=${locale}&template=${template}`);
      if (!res.ok) throw new Error("Generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my-github-cv-${locale}-${template}.docx`;
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
    <button
      onClick={handleDownload}
      disabled={disabled || downloading}
      className="w-full sm:w-auto bg-amber hover:bg-amber-bright disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-ink font-semibold px-8 py-3 rounded-xl"
    >
      {downloading ? "Generating..." : "Download CV (.docx)"}
    </button>
  );
}
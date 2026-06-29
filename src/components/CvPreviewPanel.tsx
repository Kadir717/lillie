"use client";
import { useState, useEffect, useCallback } from "react";
import DownloadButton from "./DownloadButton";

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
] as const;

type LocaleCode = typeof LOCALES[number]["code"];
type TemplateCode = typeof TEMPLATES[number]["code"];

export default function CvPreviewPanel({ hasData }: { hasData: boolean }) {
    const [locale, setLocale] = useState<LocaleCode>("en");
    const [template, setTemplate] = useState<TemplateCode>("classic_professional");
    const [localeOpen, setLocaleOpen] = useState(false);
    const [templateOpen, setTemplateOpen] = useState(false);
    const [html, setHtml] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    const selectedLocale = LOCALES.find((l) => l.code === locale)!;
    const selectedTemplate = TEMPLATES.find((t) => t.code === template)!;

    const loadPreview = useCallback(async () => {
        if (!hasData) return;
        setLoading(true);
        setError(false);
        try {
            const res = await fetch(`/api/preview-cv?locale=${locale}&template=${template}`);
            if (!res.ok) throw new Error("Preview failed");
            const data = await res.json();
            setHtml(data.html);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [locale, template, hasData]);

    useEffect(() => {
        loadPreview();
    }, [loadPreview]);

    return (
        <div>
            {/* Selectors */}
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
                {/* Language Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => { setLocaleOpen((v) => !v); setTemplateOpen(false); }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-coffee/60 text-sm text-cream/80 hover:text-cream transition-colors min-w-[150px] justify-between"
                    >
                        <span>{selectedLocale.flag} {selectedLocale.label}</span>
                        <span className="text-xs opacity-50">{localeOpen ? "▲" : "▼"}</span>
                    </button>

                    {localeOpen && (
                        <div className="absolute top-full mt-1 left-0 z-50 bg-ink border border-coffee/60 rounded-lg overflow-hidden shadow-xl min-w-[160px] max-h-72 overflow-y-auto">
                            {LOCALES.map((l) => (
                                <button
                                    key={l.code}
                                    onClick={() => { setLocale(l.code); setLocaleOpen(false); }}
                                    className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors
                    ${locale === l.code ? "bg-amber text-ink font-semibold" : "text-cream/70 hover:bg-coffee/30 hover:text-cream"}`}
                                >
                                    <span>{l.flag}</span>
                                    <span>{l.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Template Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => { setTemplateOpen((v) => !v); setLocaleOpen(false); }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-coffee/60 text-sm text-cream/80 hover:text-cream transition-colors min-w-[180px] justify-between"
                    >
                        <span>{selectedTemplate.label}</span>
                        <span className="text-xs opacity-50">{templateOpen ? "▲" : "▼"}</span>
                    </button>

                    {templateOpen && (
                        <div className="absolute top-full mt-1 left-0 z-50 bg-ink border border-coffee/60 rounded-lg overflow-hidden shadow-xl min-w-[200px]">
                            {TEMPLATES.map((tpl) => (
                                <button
                                    key={tpl.code}
                                    onClick={() => { setTemplate(tpl.code); setTemplateOpen(false); }}
                                    className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors
                    ${template === tpl.code ? "bg-amber text-ink font-semibold" : "text-cream/70 hover:bg-coffee/30 hover:text-cream"}`}
                                >
                                    <span>{tpl.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Live preview surface */}
            <div className="bg-paper text-ink rounded-2xl shadow-2xl shadow-black/40 p-8 sm:p-10 mb-8 min-h-[300px]">
                {loading && (
                    <p className="text-coffee/50 text-sm text-center py-12">Loading preview...</p>
                )}
                {!loading && error && (
                    <p className="text-amber-bright text-sm text-center py-12">
                        Couldn&apos;t load preview. Try switching language or template again.
                    </p>
                )}
                {!loading && !error && html && (
                    <div
                        className="docx-preview prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: html }}
                    />
                )}
            </div>

            <DownloadButton disabled={!hasData} locale={locale} template={template} />
        </div>
    );
}
"use client";

import { useState, useEffect, useCallback } from "react";
import QRCode from "qrcode";
import type { CvModel } from "@/cv";

/**
 * ShareResume — public resume link panel.
 *
 * Toggles the profile's public share state via /api/profiles/:id/share,
 * displays the resulting link, a QR code (qrcode package, rendered
 * client-side to a data URL), and a copy button.
 *
 * The CvModel snapshot is sent only when ENABLING sharing — that is when
 * the server needs to freeze the current state. Disabling sends no model.
 */
export default function ShareResume({
  profileId,
  model,
  locale,
  template,
  profileTitle,
}: {
  profileId: string;
  model: CvModel | null;
  locale: string;
  template: string;
  profileTitle?: string;
}) {
  const [enabled, setEnabled] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/profiles/${profileId}/share`);
      if (!res.ok) throw new Error("Failed to load share state");
      const data = await res.json();
      setEnabled(data.enabled ?? false);
      setShareUrl(data.shareUrl ?? null);
    } catch {
      setError("Couldn't load share state.");
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  // Regenerate the QR whenever the share URL changes
  useEffect(() => {
    if (!shareUrl) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(shareUrl, {
      width: 180,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#1f1611", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        // QR is a nice-to-have; the link itself still works
      });
    return () => {
      cancelled = true;
    };
  }, [shareUrl]);

  async function handleToggle() {
    if (!model && !enabled) {
      setError("CV data isn't loaded yet. Try again in a moment.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/profiles/${profileId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          enabled
            ? { enabled: false }
            : { enabled: true, model, locale, template }
        ),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update sharing");
      }
      const data = await res.json();
      setEnabled(data.enabled ?? false);
      setShareUrl(data.shareUrl ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update sharing.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable; the link is still visible
    }
  }

  return (
    <div className="border border-coffee/20 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-cream">
          Share this resume
        </h3>
        {loading ? (
          <span className="text-[10px] uppercase tracking-widest text-cream/30">
            …
          </span>
        ) : (
          <span
            className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full ${
              enabled
                ? "bg-emerald-400/15 text-emerald-400"
                : "bg-coffee/30 text-cream/40"
            }`}
          >
            {enabled ? "Public" : "Private"}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          role="switch"
          aria-checked={enabled}
          onClick={handleToggle}
          disabled={busy || loading}
          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
            enabled ? "bg-emerald-500" : "bg-coffee/50"
          } disabled:opacity-40`}
          aria-label={
            enabled
              ? `Disable public link for ${profileTitle || "this resume"}`
              : `Enable public link for ${profileTitle || "this resume"}`
          }
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-cream transition-transform ${
              enabled ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
        <span className="text-xs text-cream/60">
          {enabled
            ? "Anyone with the link can view this resume."
            : "Create a public link to share this resume."}
        </span>
      </div>

      {error && <p className="text-xs text-amber-bright/90">{error}</p>}

      {enabled && shareUrl && (
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-xs text-cream/40">Public link</p>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-amber hover:text-amber-bright break-all transition-colors"
            >
              {shareUrl}
            </a>
            <button
              onClick={handleCopy}
              className="text-xs bg-coffee/40 hover:bg-coffee/60 transition-colors text-cream px-3 py-1.5 rounded-lg"
            >
              {copied ? "Copied ✓" : "Copy link"}
            </button>
          </div>
          {qrDataUrl && (
            <div className="shrink-0 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt={`QR code for ${profileTitle || "this resume"} public link`}
                className="w-[110px] h-[110px] rounded-lg bg-white p-1"
              />
              <p className="text-[10px] text-cream/30 mt-1">Scan to view</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

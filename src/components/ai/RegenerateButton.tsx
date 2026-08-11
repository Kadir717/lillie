"use client";

/**
 * RegenerateButton — small ghost action used on AI insight cards to
 * bypass the 24h result cache and force a fresh LLM call. While a
 * regenerate is in flight the previous result stays visible and the
 * button shows a "Regenerating…" state.
 */
export default function RegenerateButton({
  onClick,
  isRegenerating,
  disabled = false,
}: {
  onClick: () => void;
  isRegenerating: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isRegenerating}
      aria-label="Regenerate this insight from the AI"
      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-signal hover:text-signal/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span aria-hidden>{isRegenerating ? "⟳" : "↻"}</span>
      {isRegenerating ? "Regenerating…" : "Regenerate"}
    </button>
  );
}

"use client";

export default function AIInsightsCard({
  title,
  icon,
  status = "coming_soon",
  children,
}: {
  title: string;
  icon: string;
  status?: "ready" | "coming_soon" | "loading" | "error" | "empty";
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-cloud border border-line rounded-xl p-5 transition-colors hover:border-signal/30">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-lg" role="img" aria-hidden>
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {status === "coming_soon" && (
          <span className="ml-auto text-[10px] uppercase tracking-widest text-signal bg-signal-tint px-2 py-0.5 rounded-full">
            Coming Soon
          </span>
        )}
        {status === "loading" && (
          <span className="ml-auto text-[10px] uppercase tracking-widest text-slate/70 bg-line px-2 py-0.5 rounded-full">
            Generating...
          </span>
        )}
        {status === "error" && (
          <span className="ml-auto text-[10px] uppercase tracking-widest text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
            Unavailable
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

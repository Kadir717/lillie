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
    <div className="bg-coffee/10 border border-coffee/20 rounded-xl p-5 transition-colors hover:border-coffee/40">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-lg" role="img" aria-hidden>
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-cream">{title}</h3>
        {status === "coming_soon" && (
          <span className="ml-auto text-[10px] uppercase tracking-widest text-amber/60 bg-amber/10 px-2 py-0.5 rounded-full">
            Coming Soon
          </span>
        )}
        {status === "loading" && (
          <span className="ml-auto text-[10px] uppercase tracking-widest text-cream/30 bg-coffee/20 px-2 py-0.5 rounded-full">
            Generating...
          </span>
        )}
        {status === "error" && (
          <span className="ml-auto text-[10px] uppercase tracking-widest text-red-400/60 bg-red-400/10 px-2 py-0.5 rounded-full">
            Unavailable
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

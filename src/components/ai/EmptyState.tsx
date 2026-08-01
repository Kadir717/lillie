"use client";

export default function EmptyState({
  variant = "coming_soon",
  title,
  description,
  action,
}: {
  variant?: "coming_soon" | "no_data" | "error" | "not_generated";
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  const config: Record<
    string,
    { icon: string; title: string; description: string }
  > = {
    coming_soon: {
      icon: "🚧",
      title: "Coming Soon",
      description:
        "This AI-powered feature is under development and will be available soon.",
    },
    no_data: {
      icon: "📭",
      title: "No Data Available",
      description:
        "Connect your GitHub account and generate a CV to unlock AI insights.",
    },
    error: {
      icon: "⚠️",
      title: "Currently Unavailable",
      description:
        "The AI service is temporarily unavailable. Please try again later.",
    },
    not_generated: {
      icon: "🔮",
      title: "Not Generated Yet",
      description:
        "AI analysis has not been run yet. This content will appear once generated.",
    },
  };

  const resolved = config[variant] || config.coming_soon;

  return (
    <div className="flex flex-col items-center justify-center text-center py-8 px-4">
      <span className="text-3xl mb-3" role="img" aria-hidden>
        {resolved.icon}
      </span>
      <h4 className="text-sm font-medium text-cream/70 mb-1">
        {title || resolved.title}
      </h4>
      <p className="text-xs text-cream/40 max-w-xs leading-relaxed">
        {description || resolved.description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 text-xs text-amber hover:text-amber-bright transition-colors underline underline-offset-2"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

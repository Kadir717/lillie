import type { ReactNode } from "react";

/**
 * AppShell — shared application frame (light-first design system).
 *
 * Single source of truth for the top navigation bar used by every
 * authenticated app page. Renders:
 *   - logo → /dashboard
 *   - Dashboard / Jobs / Settings links (only routes that exist today;
 *     Interview & Portfolio join once their UI sprints land)
 *   - active link with a 2px signal underline
 *   - GitHub username + sign out
 *
 * The content container uses the full available width (max 1440px) with
 * responsive padding (24px → 32px) instead of a narrow fixed column.
 */
export type AppNavKey = "dashboard" | "jobs" | "settings";

const NAV_LINKS: { key: AppNavKey; label: string; href: string }[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  { key: "jobs", label: "Jobs", href: "/jobs" },
  { key: "settings", label: "Settings", href: "/settings" },
];

export default function AppShell({
  active,
  username,
  children,
  contentWidth = "full",
}: {
  active: AppNavKey;
  username: string;
  children: ReactNode;
  /** "full" = max-w-[1440px] (default), "narrow" = max-w-3xl (forms). */
  contentWidth?: "full" | "narrow";
}) {
  return (
    <main className="min-h-screen bg-paper text-ink">
      {/* Top navigation bar */}
      <header className="border-b border-line bg-cloud">
        <div className="max-w-[1440px] mx-auto px-6 md:px-8 flex items-center justify-between h-14">
          <a
            href="/dashboard"
            className="text-lg font-semibold tracking-tight text-ink"
          >
            LILLIE
          </a>
          <nav className="flex items-center h-full gap-1" aria-label="Primary">
            {NAV_LINKS.map((link) => {
              const isActive = link.key === active;
              return (
                <a
                  key={link.key}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`inline-flex items-center h-full px-3 text-sm border-b-2 transition-colors ${
                    isActive
                      ? "border-signal text-ink font-medium"
                      : "border-transparent text-slate hover:text-ink"
                  }`}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-sm text-slate">
              {username}
            </span>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="text-sm text-slate hover:text-signal transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div
        className={`mx-auto px-6 md:px-8 py-8 ${
          contentWidth === "narrow" ? "max-w-3xl" : "max-w-[1440px]"
        }`}
      >
        {children}
      </div>
    </main>
  );
}

import { redirect } from "next/navigation";
import Image from "next/image";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import SettingsForm from "./SettingsForm";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  // Fetch current user data
  let userData: {
    login: string;
    name: string | null;
    avatarUrl: string | null;
    email: string | null;
    locale: string;
    template: string;
  } | null = null;

  try {
    const user = await prisma.user.findUnique({
      where: { githubId: session.githubId },
      select: {
        login: true,
        name: true,
        avatarUrl: true,
        email: true,
        locale: true,
        template: true,
      },
    });
    if (user) userData = user;
  } catch {
    // DB unavailable
  }

  return (
    <main className="min-h-screen bg-ink text-cream">
      {/* Top navigation bar */}
      <header className="border-b border-coffee/20 px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a
              href="/dashboard"
              className="text-lg font-semibold tracking-tight text-amber"
            >
              LILLIE
            </a>
          </div>
          <nav className="flex items-center gap-4">
            <a
              href="/dashboard"
              className="text-sm text-cream/50 hover:text-cream transition-colors"
            >
              Dashboard
            </a>
            <span className="text-sm text-cream/60">Settings</span>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="text-sm text-cream/40 hover:text-cream/70 transition-colors"
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold mb-8">Settings</h1>

        <div className="space-y-8">
          {/* Account Section */}
          <section className="bg-coffee/10 border border-coffee/20 rounded-xl p-6">
            <h2 className="text-lg font-medium text-cream mb-4">Account</h2>
            {userData ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {userData.avatarUrl && (
                    <Image
                      src={userData.avatarUrl}
                      alt=""
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-full border border-coffee"
                    />
                  )}
                  <div>
                    <p className="font-medium">{userData.name || userData.login}</p>
                    <p className="text-sm text-cream/50">@{userData.login}</p>
                  </div>
                </div>
                {userData.email && (
                  <p className="text-sm text-cream/60">
                    Email: {userData.email}
                  </p>
                )}
                <p className="text-xs text-cream/40">
                  Connected via GitHub OAuth. Profile data updates on each login.
                </p>
              </div>
            ) : (
              <p className="text-sm text-cream/50">Unable to load account data.</p>
            )}
          </section>

          {/* Preferences Section (client form for locale/template) */}
          <section className="bg-coffee/10 border border-coffee/20 rounded-xl p-6">
            <h2 className="text-lg font-medium text-cream mb-4">
              CV Preferences
            </h2>
            <SettingsForm
              initialLocale={userData?.locale ?? "en"}
              initialTemplate={userData?.template ?? "classic_professional"}
            />
          </section>

          {/* GitHub Connection */}
          <section className="bg-coffee/10 border border-coffee/20 rounded-xl p-6">
            <h2 className="text-lg font-medium text-cream mb-4">
              GitHub Connection
            </h2>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm text-cream/70">
                Connected as{" "}
                <strong className="text-cream">
                  {userData?.login || session.githubUsername}
                </strong>
              </span>
            </div>
            <p className="text-xs text-cream/40 mt-2">
              Scopes: read:user, public_repo.{" "}
              <a
                href={`https://github.com/settings/connections/applications/${process.env.GITHUB_CLIENT_ID || ""}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber hover:text-amber-bright underline"
              >
                Manage on GitHub
              </a>
            </p>
          </section>

          {/* Danger Zone */}
          <section className="bg-coffee/10 border border-red-900/40 rounded-xl p-6">
            <h2 className="text-lg font-medium text-red-400 mb-4">
              Danger Zone
            </h2>
            <p className="text-sm text-cream/60 mb-4">
              Deleting your account removes all stored preferences and CV
              profiles. Your GitHub data is not affected.
            </p>
            <button
              disabled
              className="text-sm text-red-400/50 border border-red-900/40 px-4 py-2 rounded-lg cursor-not-allowed"
              title="Account deletion is not yet implemented"
            >
              Delete account
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}

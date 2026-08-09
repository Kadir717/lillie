import { redirect } from "next/navigation";
import Image from "next/image";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AppShell from "@/components/AppShell";
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
    <AppShell
      active="settings"
      username={session.githubUsername}
      contentWidth="narrow"
    >
      <div className="space-y-8">
          {/* Account Section */}
          <section className="bg-cloud border border-line rounded-card p-6">
            <h2 className="text-lg font-medium text-ink mb-4">Account</h2>
            {userData ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {userData.avatarUrl && (
                    <Image
                      src={userData.avatarUrl}
                      alt=""
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-full border border-line"
                    />
                  )}
                  <div>
                    <p className="font-medium">{userData.name || userData.login}</p>
                    <p className="text-sm text-slate">@{userData.login}</p>
                  </div>
                </div>
                {userData.email && (
                  <p className="text-sm text-slate">
                    Email: {userData.email}
                  </p>
                )}
                <p className="text-xs text-slate">
                  Connected via GitHub OAuth. Profile data updates on each login.
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate">Unable to load account data.</p>
            )}
          </section>

          {/* Preferences Section (client form for locale/template) */}
          <section className="bg-cloud border border-line rounded-card p-6">
            <h2 className="text-lg font-medium text-ink mb-4">
              CV Preferences
            </h2>
            <SettingsForm
              initialLocale={userData?.locale ?? "en"}
              initialTemplate={userData?.template ?? "classic_professional"}
            />
          </section>

          {/* GitHub Connection */}
          <section className="bg-cloud border border-line rounded-card p-6">
            <h2 className="text-lg font-medium text-ink mb-4">
              GitHub Connection
            </h2>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-grid" />
              <span className="text-sm text-slate">
                Connected as{" "}
                <strong className="text-ink">
                  {userData?.login || session.githubUsername}
                </strong>
              </span>
            </div>
            <p className="text-xs text-slate mt-2">
              Scopes: read:user, public_repo.{" "}
              <a
                href={`https://github.com/settings/connections/applications/${process.env.GITHUB_CLIENT_ID || ""}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-signal hover:text-signal/80 underline transition-colors"
              >
                Manage on GitHub
              </a>
            </p>
          </section>

          {/* Danger Zone */}
          <section className="bg-cloud border border-red-200 rounded-card p-6">
            <h2 className="text-lg font-medium text-red-600 mb-4">
              Danger Zone
            </h2>
            <p className="text-sm text-slate mb-4">
              Deleting your account removes all stored preferences and CV
              profiles. Your GitHub data is not affected.
            </p>
            <button
              disabled
              className="text-sm text-red-400 border border-red-200 px-4 py-2 rounded-lg cursor-not-allowed"
              title="Account deletion is not yet implemented"
            >
              Delete account
            </button>
          </section>
        </div>
    </AppShell>
  );
}

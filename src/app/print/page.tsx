import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { fetchGithubAggregate } from "@/lib/github";
import { mapGithubToCvModel } from "@/lib/cv-model";
import { validateLocale, validateTemplate } from "@/lib/validate";
import { CvPreview } from "@/cv";
import PrintAuto from "./PrintAuto";

/**
 * Print page — /print?locale=en&template=classic_professional
 *
 * Renders the CV full-size in a print-optimized, chrome-free layout and
 * immediately opens the browser's print dialog (client-side "Save as PDF").
 * No server-side PDF library is needed — the browser prints exactly what
 * CvPreview renders, and the @media print CSS in globals.css strips all
 * page furniture.
 *
 * This is the same CvModel → CvPreview pipeline as the dashboard preview,
 * so the printed result always matches what the user saw on screen.
 */
export default async function PrintPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string; template?: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  const sp = await searchParams;
  const locale = validateLocale(sp.locale ?? null) ?? "en";
  const template =
    validateTemplate(sp.template ?? null) ?? "classic_professional";

  let model;
  try {
    const data = await fetchGithubAggregate(
      session.githubAccessToken,
      session.githubUsername
    );
    model = mapGithubToCvModel(data);
  } catch (err) {
    const error = err as Error & { name?: string };
    // Surface GitHub failures in the print view so the user isn't left
    // with a silently blank page.
    const message =
      error.name === "GithubRateLimitError"
        ? "GitHub API rate limit reached. Please wait a few minutes and try again."
        : "Couldn't load your GitHub data for printing. Try again in a moment.";
    return (
      <main className="min-h-screen flex items-center justify-center p-8 print:hidden">
        <div className="text-center max-w-sm">
          <p className="text-lg font-semibold text-red-600 mb-2">
            Print unavailable
          </p>
          <p className="text-sm text-neutral-500">{message}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="print-area">
      {/* Auto-opens the print dialog once the CV has rendered */}
      <PrintAuto />
      <div className="print-sheet">
        <CvPreview model={model} templateId={template} locale={locale} />
      </div>
    </main>
  );
}

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadPortfolioSource } from "@/lib/portfolio/load";
import { buildPortfolioContent } from "@/lib/portfolio/generator";
import { buildPortfolioHtml } from "@/lib/portfolio/export";
import { getDefaultTheme, validateTheme } from "@/lib/portfolio/themes";
import { trackPortfolioWebsite } from "@/lib/analytics/events";
import { getUserEntitlements } from "@/lib/billing/entitlements";
import { checkLimit, limitMessage } from "@/lib/billing/usage";

/**
 * GET /api/portfolio/website
 *
 * Returns a self-contained HTML personal-website page (theme applied
 * inline, zero external assets). Intended for download or "view source".
 *
 * Query params:
 *   ?theme=minimal|developer|bold|elegant|sunrise   (invalid → 400)
 *
 * Responses:
 *   200 — text/html document
 *   400 — invalid theme
 *   401 — not authenticated
 *   429 — GitHub API rate limited
 *   500 — unexpected failure
 *   502 — GitHub API failure
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const themeId = request.nextUrl.searchParams.get("theme");
  let theme = null;
  if (themeId !== null) {
    theme = validateTheme(themeId);
    if (!theme) {
      return NextResponse.json({ error: "Invalid theme" }, { status: 400 });
    }
  }

  try {
    // ── Entitlement: monthly export limit (website counts as an export) ──
    const billing = await getUserEntitlements(session.githubId);
    if (billing) {
      const exportLimit = await checkLimit(
        billing.id,
        "monthlyExports",
        billing.entitlements
      );
      if (!exportLimit.allowed) {
        return NextResponse.json(
          { error: limitMessage("monthlyExports", exportLimit) },
          { status: 403 }
        );
      }
    }

    const source = await loadPortfolioSource(
      session.githubAccessToken,
      session.githubUsername
    );
    const resolvedTheme = theme ?? getDefaultTheme();
    const content = buildPortfolioContent(source, resolvedTheme);
    const html = buildPortfolioHtml(content, resolvedTheme);

    // ── Record website analytics (fire-and-forget, never fatal) ──
    try {
      if (billing) {
        await trackPortfolioWebsite({
          userId: billing.id,
          theme: resolvedTheme.id,
        });
      }
    } catch (err) {
      console.error("Analytics: website event skipped:", err);
    }

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${encodeURIComponent(
          content.hero.login || "portfolio"
        )}.html"`,
      },
    });
  } catch (err: unknown) {
    const error = err as Error & { status?: number };
    if (error.name === "GithubAuthError") {
      return NextResponse.json(
        { error: "GitHub authorization failed" },
        { status: 502 }
      );
    }
    if (error.name === "GithubRateLimitError") {
      return NextResponse.json(
        { error: "GitHub API rate limit reached" },
        { status: 429 }
      );
    }
    console.error("Portfolio website failed:", err);
    return NextResponse.json(
      { error: "Failed to generate website" },
      { status: 500 }
    );
  }
}

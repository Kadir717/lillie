import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadPortfolioSource } from "@/lib/portfolio/load";
import { buildPortfolioContent } from "@/lib/portfolio/generator";
import {
  PORTFOLIO_EXPORT_FORMATS,
  PortfolioExportFormat,
} from "@/lib/portfolio/types";
import {
  buildPortfolioHtml,
  buildPortfolioJson,
  buildPortfolioMarkdown,
} from "@/lib/portfolio/export";
import { getDefaultTheme, validateTheme } from "@/lib/portfolio/themes";
import { trackPortfolioExport } from "@/lib/analytics/events";
import { getUserEntitlements } from "@/lib/billing/entitlements";
import { checkLimit, limitMessage } from "@/lib/billing/usage";

/**
 * GET /api/portfolio/export
 *
 * Exports the portfolio in the requested format.
 *
 * Query params:
 *   ?format=json|html|markdown   (required, invalid → 400)
 *   ?theme=minimal|developer|bold|elegant|sunrise   (invalid → 400; used by html)
 *
 * Responses:
 *   200 — file download (Content-Disposition: attachment)
 *   400 — invalid format or theme
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

  const rawFormat = request.nextUrl.searchParams.get("format");
  if (
    !rawFormat ||
    !PORTFOLIO_EXPORT_FORMATS.includes(rawFormat as PortfolioExportFormat)
  ) {
    return NextResponse.json(
      {
        error: `Invalid format. Expected one of: ${PORTFOLIO_EXPORT_FORMATS.join(", ")}`,
      },
      { status: 400 }
    );
  }
  const format = rawFormat as PortfolioExportFormat;

  const themeId = request.nextUrl.searchParams.get("theme");
  let theme = null;
  if (themeId !== null) {
    theme = validateTheme(themeId);
    if (!theme) {
      return NextResponse.json({ error: "Invalid theme" }, { status: 400 });
    }
  }

  try {
    // ── Entitlement: monthly export limit ────────────────────────
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

    const filename = `${content.hero.login || "portfolio"}-${format}`;
    const disposition = `attachment; filename="${encodeURIComponent(filename)}"`;

    if (format === "json") {
      return new NextResponse(buildPortfolioJson(content), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `${disposition}.json`,
        },
      });
    }

    if (format === "markdown") {
      return new NextResponse(buildPortfolioMarkdown(content), {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `${disposition}.md`,
        },
      });
    }

    // html
    const html = buildPortfolioHtml(content, resolvedTheme);

    // ── Record export analytics (fire-and-forget, never fatal) ───
    try {
      if (billing) {
        await trackPortfolioExport({
          userId: billing.id,
          format,
          theme: resolvedTheme.id,
        });
      }
    } catch (err) {
      console.error("Analytics: export event skipped:", err);
    }

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `${disposition}.html`,
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
    console.error("Portfolio export failed:", err);
    return NextResponse.json(
      { error: "Failed to export portfolio" },
      { status: 500 }
    );
  }
}

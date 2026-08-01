import type { MetadataRoute } from "next";

/**
 * robots.txt — public pages are crawlable; authenticated areas and API
 * endpoints are disallowed (they require a session and return 401/redirect).
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://lillie.dev";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard", "/settings", "/print"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}

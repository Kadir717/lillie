import type { MetadataRoute } from "next";

/**
 * sitemap.xml — the landing page is the only statically discoverable public
 * URL. Shared resume pages (/r/:token) use unguessable tokens, so they are
 * intentionally not listed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://lillie.dev";
  return [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}

import type { NextConfig } from "next";

/**
 * Production Content-Security-Policy.
 *
 * Deliberately conservative for a Next.js App Router app:
 *   - 'unsafe-inline' for scripts: Next injects inline RSC bootstrap
 *     scripts; a nonce-based policy is the future hardening path.
 *   - style-src 'unsafe-inline': React inline style props + Tailwind.
 *   - img-src includes avatars.githubusercontent.com (dashboard/settings)
 *     and data:/blob: (QR codes, downloads).
 * Applied ONLY in production — `next dev` needs eval for HMR.
 */
const CSP_PRODUCTION = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://avatars.githubusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Prevent MIME-sniffing attacks.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Only send the origin on same-origin / HTTPS navigations.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Clickjacking protection.
          { key: "X-Frame-Options", value: "DENY" },
          // Disable browser features the app does not use.
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          // Full CSP in production only (see comment above).
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Content-Security-Policy", value: CSP_PRODUCTION }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;

import type { Metadata, Viewport } from "next";
import "./globals.css";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://lillie.dev";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: "LILLIE — Turn your GitHub into a CV in 30 seconds",
  description:
    "Generate a polished, job-ready CV from your GitHub activity. No forms, no typing — just sign in and download.",
  applicationName: "LILLIE",
  keywords: [
    "CV generator",
    "resume builder",
    "GitHub resume",
    "developer CV",
    "ATS resume",
    "job search",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: APP_URL,
    siteName: "LILLIE",
    title: "LILLIE — Turn your GitHub into a CV in 30 seconds",
    description:
      "Generate a polished, job-ready CV from your GitHub activity. No forms, no typing — just sign in and download.",
  },
  twitter: {
    card: "summary",
    title: "LILLIE — Turn your GitHub into a CV in 30 seconds",
    description:
      "Generate a polished, job-ready CV from your GitHub activity.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f1611",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://lillie.dev";

// Inter — the design system's single text family. Headings differentiate
// only by weight (500/600), never by a second family.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// JetBrains Mono — reserved for short data fragments (labels, dates, IDs).
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: "LILLIE — Turn your GitHub into more than a CV",
  description:
    "Turn your GitHub activity into a polished CV, track job applications, and get AI-powered advice — no forms, no typing, just sign in.",
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
    title: "LILLIE — Turn your GitHub into more than a CV",
    description:
      "Turn your GitHub activity into a polished CV, track job applications, and get AI-powered advice — no forms, no typing, just sign in.",
  },
  twitter: {
    card: "summary",
    title: "LILLIE — Turn your GitHub into more than a CV",
    description:
      "Turn your GitHub activity into a polished CV and AI-powered job advice — no forms, no typing.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F6F5F2",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

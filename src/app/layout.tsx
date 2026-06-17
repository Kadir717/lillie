import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LILLIE — Turn your GitHub into a CV in 30 seconds",
  description:
    "Generate a polished, job-ready CV from your GitHub activity. No forms, no typing — just sign in and download.",
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

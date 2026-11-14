import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "PUFF SAUDI — أكواب بف | لونك، مزاجك، مشروبك", template: "%s — PUFF SAUDI" },
  description:
    "متجر بف السعودية: أكواب بف سيبي، بف كوفي، وبف فليبي بعزل يحافظ على برودة وحرارة مشروبك لساعات، بعشرات الألوان والإصدارات الخاصة.",
  applicationName: "PUFF SAUDI",
  openGraph: {
    type: "website",
    locale: "ar_SA",
    siteName: "PUFF SAUDI",
    title: "PUFF SAUDI — أكواب بف",
    description: "أكواب بف سيبي وكوفي وفليبي بعشرات الألوان. لونك، مزاجك، مشروبك.",
  },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0B0B0C",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          href="/fonts/unbounded-latin-wght-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/alexandria-arabic-wght-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen font-body antialiased">{children}</body>
    </html>
  );
}

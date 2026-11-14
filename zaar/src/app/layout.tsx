import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@/styles/soft.css";
import "@/styles/zaar.css";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "زار — قل فكرتك، ومتجرك جاهز في ثوانٍ", template: "%s — زار" },
  description:
    "زار منصة تجارة إلكترونية سعودية: اكتب فكرتك في محادثة ويُبنى متجرك كاملًا في ثوانٍ، مع دفع إلكتروني وتابي وتمارا، تحويل يومي لأرباحك، وضمان استرداد كامل لكل طلب.",
  applicationName: "زار",
  openGraph: { type: "website", locale: "ar_SA", siteName: "زار" },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0B",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preload" href="/fonts/unbounded-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/alexandria-arabic-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen font-body antialiased">{children}</body>
    </html>
  );
}

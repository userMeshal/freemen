import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "فريمان | منصة متاجر إلكترونية",
  description: "منصة تساعد التجار الصغار على فتح متجر إلكتروني خلال دقائق.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}

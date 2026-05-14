import type { Metadata } from "next";
import "./globals.css";
import Nav from "../components/Nav";

export const metadata: Metadata = {
  title: "فريمان | منصة متاجر إلكترونية",
  description: "منصة متاجر إلكترونية للتجار الصغار."
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

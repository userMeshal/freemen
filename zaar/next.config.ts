import type { NextConfig } from "next";
import path from "node:path";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://connect.facebook.net https://analytics.tiktok.com https://sc-static.net" +
        (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://www.facebook.com https://analytics.tiktok.com https://tr.snapchat.com",
      "font-src 'self' data:",
      "connect-src 'self' https://www.facebook.com https://connect.facebook.net https://analytics.tiktok.com https://*.tiktokw.us https://*.tiktok.com https://tr.snapchat.com",
      // المعاينة الحية للمتجر داخل صفحة البناء ولوحة التاجر
      "frame-src 'self' https://www.facebook.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self' https://*.edfapay.com https://*.tabby.ai https://*.tamara.co",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  experimental: { optimizePackageImports: ["lucide-react", "motion"] },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/fonts/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/dashboard/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/hq/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;

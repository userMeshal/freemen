import type { NextConfig } from "next";
import catalog from "./data/catalog.json";

const legacy = (catalog as { legacySlugs: Record<string, string> }).legacySlugs;
const categories = (catalog as { categories: { slug: string }[] }).categories;

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://connect.facebook.net https://analytics.tiktok.com" +
        (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://www.facebook.com https://analytics.tiktok.com",
      "font-src 'self' data:",
      "connect-src 'self' https://www.facebook.com https://connect.facebook.net https://analytics.tiktok.com https://*.tiktokw.us https://*.tiktok.com",
      "frame-src https://www.facebook.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' https://*.edfapay.com",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "motion"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/fonts/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/media/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
  async redirects() {
    // روابط المتجر القديم ← الروابط الجديدة (للحفاظ على الأرشفة والروابط المنشورة سابقًا)
    const products = Object.entries(legacy).map(([from, to]) => ({
      source: `/${encodeURI(from)}`,
      destination: `/p/${to}`,
      permanent: true,
    }));
    const cats = categories.map((c) => ({
      source: `/${encodeURI(c.slug)}`,
      destination: `/c/${encodeURI(c.slug)}`,
      permanent: true,
    }));
    return [
      ...products,
      ...cats,
      { source: "/products", destination: "/shop", permanent: true },
      { source: "/page/terms-of-service", destination: "/pages/terms", permanent: true },
      { source: "/page/contact-information", destination: "/pages/contact", permanent: true },
      { source: "/page/:slug", destination: "/pages/:slug", permanent: true },
      { source: "/checkout/cart", destination: "/cart", permanent: true },
    ];
  },
};

export default nextConfig;

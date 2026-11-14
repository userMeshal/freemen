import type { MetadataRoute } from "next";
import { getAllProducts, getCategories } from "@/lib/catalog";
import { siteUrl } from "@/lib/settings";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [products, categories] = await Promise.all([getAllProducts(), getCategories()]);
  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/shop`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    ...categories
      .filter((c) => c.count > 0)
      .map((c) => ({ url: `${base}/c/${encodeURI(c.slug)}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...products.map((p) => ({
      url: `${base}/p/${p.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: p.variantCount > 1 || p.isBestSeller ? 0.8 : 0.6,
    })),
    ...["shipping", "returns", "privacy", "terms", "contact"].map((s) => ({
      url: `${base}/pages/${s}`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
    { url: `${base}/track`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}

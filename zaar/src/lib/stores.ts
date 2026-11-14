import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { and, asc, desc, eq, inArray, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { categories, products, reviews, stores, type Category, type Product, type Store } from "@/db/schema";
import type { Blueprint } from "./blueprint";
import { rootDomain, siteUrl } from "./platform";
import { DRAFT_COOKIE } from "./session";
import type { CategoryDTO, ProductCardDTO, ProductDTO, StoreDTO } from "./types";

export { DEFAULT_SETTINGS, applyBlueprintToDraft, createStoreFromBlueprint, isReservedSlug } from "./store-write";
import { DEFAULT_SETTINGS } from "./store-write";

/** يعيد بناء المخطط من متجر محفوظ (ليُرسل للنموذج عند طلب تعديل) */
export async function blueprintFromStore(store: Store): Promise<Blueprint> {
  const [cats, prods] = await Promise.all([
    db.select().from(categories).where(eq(categories.storeId, store.id)).orderBy(asc(categories.position)),
    db.select().from(products).where(eq(products.storeId, store.id)).orderBy(asc(products.position)),
  ]);
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  return {
    reply: "",
    name: store.name,
    nameLatin: store.nameLatin,
    slug: store.slug,
    tagline: store.tagline,
    description: store.description,
    vertical: store.vertical as Blueprint["vertical"],
    theme: store.theme,
    palette: store.palette.preset,
    headline: store.content.headline,
    heroText: store.content.heroText,
    manifesto: store.content.manifesto,
    accentWords: store.content.accentWords,
    stats: store.content.stats,
    features: store.content.features as Blueprint["features"],
    marquee: store.content.marquee,
    announcement: store.content.announcement,
    ctaTitle: store.content.ctaTitle,
    ctaText: store.content.ctaText,
    categories: cats.map((c) => ({ name: c.name, icon: c.icon })) as Blueprint["categories"],
    products: prods.map((p) => ({
      name: p.name,
      category: (p.categoryId && catName.get(p.categoryId)) || cats[0]?.name || "",
      description: p.description,
      price: p.price / 100,
      compareAtPrice: p.compareAtPrice ? p.compareAtPrice / 100 : null,
      icon: p.art.icon,
      hue: p.art.hue,
      optionName: p.option?.name ?? null,
      optionValues: p.option?.values ?? [],
      featured: p.isFeatured,
    })) as Blueprint["products"],
  };
}

// ───────────────────────── رموز ملكية المسودات ─────────────────────────
export async function draftTokens(): Promise<string[]> {
  const jar = await cookies();
  return (jar.get(DRAFT_COOKIE)?.value ?? "").split(".").filter((t) => /^[\w-]{20,60}$/.test(t)).slice(0, 5);
}

export async function rememberDraft(token: string) {
  const jar = await cookies();
  const all = [token, ...(await draftTokens()).filter((t) => t !== token)].slice(0, 5);
  jar.set(DRAFT_COOKIE, all.join("."), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

/** أحدث مسودة يملكها هذا المتصفح */
export async function currentDraft(): Promise<Store | null> {
  const tokens = await draftTokens();
  if (!tokens.length) return null;
  const rows = await db
    .select()
    .from(stores)
    .where(and(inArray(stores.claimToken, tokens), eq(stores.status, "draft")))
    .orderBy(desc(stores.id))
    .limit(1);
  return rows[0] ?? null;
}

// ───────────────────────── القراءة للواجهة ─────────────────────────
export const getStoreBySlug = cache(async (slug: string): Promise<Store | null> => {
  const rows = await db.select().from(stores).where(eq(stores.slug, slug.toLowerCase())).limit(1);
  return rows[0] ?? null;
});

/** هل يحق لهذا الزائر رؤية المتجر؟ المنشور للجميع، والمسودة لصاحبها فقط */
export async function canViewStore(store: Store, merchantId: number | null): Promise<boolean> {
  if (store.status === "live") return true;
  if (store.status === "suspended") return merchantId !== null && store.merchantId === merchantId;
  if (merchantId !== null && store.merchantId === merchantId) return true;
  return Boolean(store.claimToken && (await draftTokens()).includes(store.claimToken));
}

/** بادئة روابط المتجر: فارغة على النطاق الفرعي، و /s/slug على الدومين الرئيسي */
export async function storeBase(slug: string): Promise<string> {
  const h = await headers();
  return h.get("x-zaar-subdomain") === slug ? "" : `/s/${slug}`;
}

export function storePublicUrl(slug: string): string {
  const root = rootDomain();
  return root ? `https://${slug}.${root}` : `${siteUrl()}/s/${slug}`;
}

export function toStoreDTO(store: Store, base: string): StoreDTO {
  return {
    id: store.id,
    slug: store.slug,
    name: store.name,
    nameLatin: store.nameLatin,
    tagline: store.tagline,
    description: store.description,
    vertical: store.vertical,
    theme: store.theme,
    palette: store.palette,
    content: store.content,
    settings: { ...DEFAULT_SETTINGS, ...store.settings },
    status: store.status,
    base,
  };
}

type Rating = { rating: number | null; count: number };

async function ratingsFor(storeId: number): Promise<Map<number, Rating>> {
  const rows = await db
    .select({ productId: reviews.productId, avg: dsql<number>`avg(${reviews.rating})::float`, count: dsql<number>`count(*)::int` })
    .from(reviews)
    .where(and(eq(reviews.storeId, storeId), eq(reviews.hidden, false)))
    .groupBy(reviews.productId);
  return new Map(rows.map((r) => [r.productId, { rating: Math.round(r.avg * 10) / 10, count: r.count }]));
}

function toCard(p: Product, catName: Map<number, string>, ratings: Map<number, Rating>): ProductCardDTO {
  const r = ratings.get(p.id);
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    image: p.images[0] ?? null,
    art: p.art,
    inStock: p.stock === null || p.stock > 0,
    isFeatured: p.isFeatured,
    categoryId: p.categoryId,
    categoryName: p.categoryId ? (catName.get(p.categoryId) ?? null) : null,
    option: p.option ?? null,
    rating: r?.rating ?? null,
    reviewsCount: r?.count ?? 0,
  };
}

export const getCatalog = cache(async (storeId: number): Promise<{ categories: CategoryDTO[]; products: ProductDTO[] }> => {
  const [cats, prods, ratings] = await Promise.all([
    db.select().from(categories).where(eq(categories.storeId, storeId)).orderBy(asc(categories.position)),
    db
      .select()
      .from(products)
      .where(and(eq(products.storeId, storeId), eq(products.status, "active")))
      .orderBy(asc(products.position), asc(products.id)),
    ratingsFor(storeId),
  ]);
  const catName = new Map(cats.map((c: Category) => [c.id, c.name]));
  const list = prods.map((p) => ({ ...toCard(p, catName, ratings), description: p.description, images: p.images, stock: p.stock }));
  return {
    categories: cats.map((c) => ({ id: c.id, slug: c.slug, name: c.name, icon: c.icon, count: list.filter((p) => p.categoryId === c.id).length })),
    products: list,
  };
});

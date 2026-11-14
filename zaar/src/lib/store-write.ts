import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, products, stores, type Store } from "@/db/schema";
import { blueprintContent, slugify, type Blueprint } from "./blueprint";
import { randomToken } from "./password";
import { resolvePalette } from "./themes";
import type { StoreSettings } from "./types";

/** كتابة المتاجر في القاعدة — بلا أي اعتماد على Next حتى تستخدمه سكربتات التهيئة أيضًا */

export const DEFAULT_SETTINGS: StoreSettings = {
  email: "",
  phone: "",
  whatsapp: "",
  instagram: "",
  tiktok: "",
  snapchat: "",
  x: "",
  crNumber: "",
  vatNumber: "",
  vatRate: 15,
  shippingFee: 2500,
  freeShippingOver: 30000,
  shippingDays: "2-5",
  metaPixelId: "",
  tiktokPixelId: "",
  snapPixelId: "",
};

const RESERVED = new Set([
  "www", "app", "api", "admin", "hq", "dashboard", "login", "signup", "start", "pay", "s", "zaar", "help", "support", "blog",
  "mail", "static", "assets", "cdn", "store", "shop", "guarantee", "legal", "pricing", "test", "demo",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED.has(slug) || slug.length < 3;
}

async function uniqueSlug(wanted: string): Promise<string> {
  let base = slugify(wanted) || "store";
  if (isReservedSlug(base)) base = `${base}-store`;
  for (let i = 0; i < 30; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const hit = await db.select({ id: stores.id }).from(stores).where(eq(stores.slug, candidate)).limit(1);
    if (!hit.length) return candidate;
  }
  return `${base}-${randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, "x")}`;
}

function productRows(storeId: number, b: Blueprint, catIds: Map<string, number>) {
  const used = new Set<string>();
  return b.products.map((p, i) => {
    let slug = `p-${i + 1}`;
    while (used.has(slug)) slug = `${slug}-x`;
    used.add(slug);
    return {
      storeId,
      categoryId: catIds.get(p.category) ?? null,
      slug,
      name: p.name,
      description: p.description,
      price: Math.round(p.price * 100),
      compareAtPrice: p.compareAtPrice ? Math.round(p.compareAtPrice * 100) : null,
      stock: null,
      images: [],
      art: { hue: p.hue, icon: p.icon },
      option: p.optionName && p.optionValues.length > 1 ? { name: p.optionName, values: p.optionValues } : null,
      isFeatured: p.featured,
      position: i,
    };
  });
}

async function writeCatalog(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], storeId: number, b: Blueprint) {
  const catIds = new Map<string, number>();
  const usedSlugs = new Set<string>();
  for (const [i, c] of b.categories.entries()) {
    let slug = `c-${i + 1}`;
    while (usedSlugs.has(slug)) slug = `${slug}-x`;
    usedSlugs.add(slug);
    const [row] = await tx.insert(categories).values({ storeId, slug, name: c.name, icon: c.icon, position: i }).returning({ id: categories.id });
    catIds.set(c.name, row.id);
  }
  const rows = productRows(storeId, b, catIds);
  if (rows.length) await tx.insert(products).values(rows);
}

/** ينشئ متجرًا (مسودة) من مخطط، ويرجع رمز الملكية ليُحفظ في كوكي المتصفح */
export async function createStoreFromBlueprint(b: Blueprint, idea: string, merchantId: number | null, token?: string): Promise<{ store: Store; claimToken: string }> {
  const slug = await uniqueSlug(b.slug);
  const claimToken = token ?? randomToken(24);
  const store = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(stores)
      .values({
        merchantId,
        slug,
        name: b.name,
        nameLatin: b.nameLatin,
        tagline: b.tagline,
        description: b.description,
        vertical: b.vertical,
        theme: b.theme,
        palette: resolvePalette(b.palette, b.theme),
        content: blueprintContent(b),
        settings: DEFAULT_SETTINGS,
        status: merchantId ? "live" : "draft",
        claimToken,
        idea: idea.slice(0, 2000),
      })
      .returning();
    await writeCatalog(tx, row.id, b);
    return row;
  });
  return { store, claimToken };
}

/** يطبّق مخططًا معدّلًا على مسودة موجودة: يحدّث الهوية والمحتوى ويعيد كتابة الكتالوج */
export async function applyBlueprintToDraft(storeId: number, b: Blueprint): Promise<Store> {
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(stores).where(eq(stores.id, storeId)).limit(1);
    const [row] = await tx
      .update(stores)
      .set({
        name: b.name,
        nameLatin: b.nameLatin,
        tagline: b.tagline,
        description: b.description,
        vertical: b.vertical,
        theme: b.theme,
        palette: resolvePalette(b.palette, b.theme),
        content: { ...blueprintContent(b), shippingPolicy: current.content.shippingPolicy, returnsPolicy: current.content.returnsPolicy },
        updatedAt: new Date(),
      })
      .where(eq(stores.id, storeId))
      .returning();
    await tx.delete(products).where(eq(products.storeId, storeId));
    await tx.delete(categories).where(eq(categories.storeId, storeId));
    await writeCatalog(tx, storeId, b);
    return row;
  });
}

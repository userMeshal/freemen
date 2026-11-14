import "server-only";
import { unstable_cache } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, pages, productCategories, productImages, products, variants } from "@/db/schema";
import { normalizeArabic } from "./normalize";
import type { CategoryDTO, ImageDTO, ProductCardDTO, ProductDTO, VariantDTO } from "./types";

type ImageRow = typeof productImages.$inferSelect;

function toImage(r: ImageRow): ImageDTO {
  return {
    id: r.id,
    url: r.url,
    bg: r.bg,
    accent: r.accent,
    cutoutUrl: r.cutoutUrl,
    cutoutW: r.cutoutW,
    cutoutH: r.cutoutH,
    flat: Boolean(r.cutoutUrl),
  };
}

async function loadCatalog(): Promise<{ products: ProductDTO[]; categories: CategoryDTO[] }> {
  const [prodRows, imageRows, variantRows, pcRows, catRows] = await Promise.all([
    db.select().from(products).where(eq(products.status, "active")).orderBy(asc(products.position), asc(products.id)),
    db.select().from(productImages).orderBy(asc(productImages.position), asc(productImages.id)),
    db.select().from(variants).where(eq(variants.isActive, true)).orderBy(asc(variants.position), asc(variants.id)),
    db.select().from(productCategories),
    db.select().from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.position)),
  ]);

  const imagesByProduct = new Map<number, ImageDTO[]>();
  const imageById = new Map<number, ImageDTO>();
  for (const r of imageRows) {
    const dto = toImage(r);
    imageById.set(r.id, dto);
    const list = imagesByProduct.get(r.productId) ?? [];
    list.push(dto);
    imagesByProduct.set(r.productId, list);
  }
  const variantsByProduct = new Map<number, VariantDTO[]>();
  for (const v of variantRows) {
    const list = variantsByProduct.get(v.productId) ?? [];
    list.push({
      id: v.id,
      sku: v.sku,
      optionValue: v.optionValue,
      price: v.price,
      compareAtPrice: v.compareAtPrice,
      imageId: v.imageId,
      stock: v.stock,
    });
    variantsByProduct.set(v.productId, list);
  }
  const catById = new Map(catRows.map((c) => [c.id, c]));
  const catsByProduct = new Map<number, { slug: string; name: string }[]>();
  const countByCat = new Map<number, number>();
  const activeIds = new Set(prodRows.map((p) => p.id));
  for (const pc of pcRows) {
    const c = catById.get(pc.categoryId);
    if (!c || !activeIds.has(pc.productId)) continue;
    const list = catsByProduct.get(pc.productId) ?? [];
    list.push({ slug: c.slug, name: c.name });
    catsByProduct.set(pc.productId, list);
    countByCat.set(c.id, (countByCat.get(c.id) ?? 0) + 1);
  }

  const list: ProductDTO[] = prodRows.map((p) => {
    const images = imagesByProduct.get(p.id) ?? [];
    const vs = variantsByProduct.get(p.id) ?? [];
    const cats = catsByProduct.get(p.id) ?? [];
    const swatches =
      vs.length > 1
        ? vs.flatMap((v) => {
            const img = v.imageId ? imageById.get(v.imageId) : undefined;
            return img && v.optionValue
              ? [{ variantId: v.id, label: v.optionValue, accent: img.accent, bg: img.bg, url: img.url, flat: img.flat }]
              : [];
          })
        : [];
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      family: p.family,
      capacityMl: p.capacityMl,
      colorName: p.colorName,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      optionName: p.optionName,
      isBestSeller: p.isBestSeller,
      position: p.position,
      createdAt: p.createdAt.toISOString(),
      searchText: p.searchText,
      categorySlugs: cats.map((c) => c.slug),
      image: images[0] ?? null,
      swatches,
      variantCount: vs.length,
      quickVariantId: vs.length === 1 ? vs[0].id : null,
      inStock: vs.some((v) => v.stock === null || v.stock > 0),
      descriptionHtml: p.descriptionHtml,
      metaDescription: p.metaDescription,
      images,
      variants: vs,
      categories: cats,
    };
  });

  return {
    products: list,
    categories: catRows.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      count: countByCat.get(c.id) ?? 0,
    })),
  };
}

const getCatalog = unstable_cache(loadCatalog, ["catalog-v2"], { tags: ["catalog"], revalidate: 600 });

function toCard(p: ProductDTO): ProductCardDTO {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { descriptionHtml, metaDescription, images, variants: _v, categories: _c, ...card } = p;
  return card;
}

export async function getAllProducts(): Promise<ProductDTO[]> {
  return (await getCatalog()).products;
}

export async function getProductCards(): Promise<ProductCardDTO[]> {
  return (await getCatalog()).products.map(toCard);
}

export async function getProduct(slug: string): Promise<ProductDTO | null> {
  return (await getCatalog()).products.find((p) => p.slug === slug) ?? null;
}

export async function getCategories(): Promise<CategoryDTO[]> {
  return (await getCatalog()).categories;
}

export async function getCategory(slug: string): Promise<CategoryDTO | null> {
  return (await getCatalog()).categories.find((c) => c.slug === slug) ?? null;
}

export async function searchProducts(query: string, limit = 60): Promise<ProductCardDTO[]> {
  const q = normalizeArabic(query);
  if (!q) return [];
  const terms = q.split(" ").filter(Boolean);
  const all = (await getCatalog()).products;
  return all
    .filter((p) => terms.every((t) => p.searchText.includes(t)))
    .slice(0, limit)
    .map(toCard);
}

export type SortKey = "featured" | "price-asc" | "price-desc" | "newest" | "name";

export function sortCards(list: ProductCardDTO[], sort: SortKey): ProductCardDTO[] {
  const out = [...list];
  switch (sort) {
    case "price-asc":
      return out.sort((a, b) => a.price - b.price);
    case "price-desc":
      return out.sort((a, b) => b.price - a.price);
    case "newest":
      return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
    case "name":
      return out.sort((a, b) => a.name.localeCompare(b.name, "ar"));
    default:
      return out.sort((a, b) => a.position - b.position || a.id - b.id);
  }
}

export const getPage = unstable_cache(
  async (slug: string) => {
    const rows = await db.select().from(pages).where(eq(pages.slug, slug)).limit(1);
    const row = rows[0];
    return row ? { slug: row.slug, title: row.title, bodyHtml: row.bodyHtml, updatedAt: row.updatedAt.toISOString() } : null;
  },
  ["page-v1"],
  { tags: ["pages"], revalidate: 3600 },
);

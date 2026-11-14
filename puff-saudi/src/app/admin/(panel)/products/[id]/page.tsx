import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowRight, ExternalLink } from "lucide-react";
import { db } from "@/db";
import { categories, productCategories, productImages, products, variants } from "@/db/schema";
import { halalasToInput, one } from "@/lib/admin-utils";
import { Badge, PageHeader } from "@/components/admin/ui";
import { ProductForm, type ProductFormData } from "@/components/admin/ProductForm";
import { bulkStockAction, deleteProductAction, saveProductAction } from "../actions";

export const metadata = { title: "تعديل منتج" };

export default async function AdminEditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id: rawId } = await params;
  const saved = one((await searchParams).saved);
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
  const p = rows[0];
  if (!p) notFound();

  const [imgs, vars, pcs, cats] = await Promise.all([
    db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(asc(productImages.position), asc(productImages.id)),
    db.select().from(variants).where(eq(variants.productId, id)).orderBy(asc(variants.position), asc(variants.id)),
    db.select().from(productCategories).where(eq(productCategories.productId, id)),
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.position)),
  ]);

  const initial: ProductFormData = {
    id: p.id,
    name: p.name,
    slug: p.slug,
    family: p.family,
    capacityMl: p.capacityMl?.toString() ?? "",
    colorName: p.colorName ?? "",
    optionName: p.optionName ?? "",
    descriptionHtml: p.descriptionHtml,
    metaDescription: p.metaDescription ?? "",
    status: p.status,
    isBestSeller: p.isBestSeller,
    position: String(p.position),
    categoryIds: pcs.map((c) => c.categoryId),
    images: imgs.map((i) => ({ id: i.id, key: `img-${i.id}`, url: i.url, bg: i.bg, accent: i.accent })),
    variants: vars.map((v) => ({
      id: v.id,
      key: `v-${v.id}`,
      sku: v.sku,
      optionValue: v.optionValue ?? "",
      price: halalasToInput(v.price),
      compareAt: halalasToInput(v.compareAtPrice),
      stock: v.stock === null ? "" : String(v.stock),
      isActive: v.isActive,
      imageKey: v.imageId ? `img-${v.imageId}` : null,
    })),
  };

  return (
    <>
      <Link href="/admin/products" className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-mute hover:text-ink">
        <ArrowRight className="h-3.5 w-3.5" /> كل المنتجات
      </Link>
      <PageHeader title={p.name} subtitle={p.legacySlug ? `منقول من المتجر الأصلي: ${p.legacySlug}` : undefined}>
        <Badge tone={p.status === "active" ? "green" : "neutral"}>{p.status === "active" ? "منشور" : "مسودة"}</Badge>
        {p.status === "active" ? (
          <Link href={`/p/${p.slug}`} target="_blank" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-mute underline hover:text-ink">
            عرض في المتجر <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </PageHeader>
      <ProductForm
        key={saved || "initial"}
        initial={initial}
        categories={cats}
        saveAction={saveProductAction}
        deleteAction={deleteProductAction}
        bulkStockAction={bulkStockAction}
        justSaved={Boolean(saved)}
      />
    </>
  );
}

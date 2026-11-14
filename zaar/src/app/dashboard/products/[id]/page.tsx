import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ArrowRight, ExternalLink } from "lucide-react";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { ProductForm } from "@/components/dash/merchant/ProductForm";
import { Badge, PageHead } from "@/components/dash/ui";
import { requireMerchantStore } from "@/lib/auth";
import { storePublicUrl } from "@/lib/stores";
import { sarInput } from "../../_lib/form";

export const metadata = { title: "تعديل منتج" };

export default async function EditProductPage(props: { params: Promise<{ id: string }> }) {
  const { store } = await requireMerchantStore();
  const { id } = await props.params;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) notFound();

  const [[product], cats] = await Promise.all([
    db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.storeId, store.id)))
      .limit(1),
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.storeId, store.id))
      .orderBy(asc(categories.position), asc(categories.id)),
  ]);
  if (!product) notFound();

  return (
    <>
      <Link href="/dashboard/products" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink">
        <ArrowRight size={16} /> كل المنتجات
      </Link>
      <PageHead title={product.name} sub={`بِعت منه ${product.sold} قطعة حتى الآن.`}>
        {product.status === "active" ? <Badge tone="good">ظاهر</Badge> : <Badge>مخفي</Badge>}
        {product.status === "active" && store.status === "live" && (
          <a href={`${storePublicUrl(store.slug)}/p/${product.slug}`} target="_blank" rel="noopener" className="dash-btn dash-btn-ghost dash-btn-sm">
            <ExternalLink size={14} /> شوفه في المتجر
          </a>
        )}
      </PageHead>
      <ProductForm
        key={product.id}
        categories={cats}
        product={{
          id: product.id,
          name: product.name,
          description: product.description,
          price: sarInput(product.price),
          compareAtPrice: sarInput(product.compareAtPrice),
          stock: product.stock === null ? "" : String(product.stock),
          categoryId: product.categoryId,
          option: product.option ?? null,
          isFeatured: product.isFeatured,
          status: product.status,
          art: product.art,
          images: product.images,
        }}
      />
    </>
  );
}

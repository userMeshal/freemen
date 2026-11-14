import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { ProductForm } from "@/components/dash/merchant/ProductForm";
import { PageHead } from "@/components/dash/ui";
import { requireMerchantStore } from "@/lib/auth";

export const metadata = { title: "منتج جديد" };

export default async function NewProductPage() {
  const { store } = await requireMerchantStore();
  const cats = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.storeId, store.id))
    .orderBy(asc(categories.position), asc(categories.id));

  return (
    <>
      <Link href="/dashboard/products" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink">
        <ArrowRight size={16} /> كل المنتجات
      </Link>
      <PageHead title="منتج جديد" sub="عبّ البيانات الأساسية وانشره. تقدر ترجع تعدّل أي شيء بعدين." />
      <ProductForm product={null} categories={cats} />
    </>
  );
}

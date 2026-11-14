import Link from "next/link";
import { asc } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm, type ProductFormData } from "@/components/admin/ProductForm";
import { saveProductAction } from "../actions";

export const metadata = { title: "منتج جديد" };

export default async function AdminNewProductPage() {
  const cats = await db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.position));
  const initial: ProductFormData = {
    name: "",
    slug: "",
    family: "sippy",
    capacityMl: "",
    colorName: "",
    optionName: "",
    descriptionHtml: "",
    metaDescription: "",
    status: "draft",
    isBestSeller: false,
    position: "999",
    categoryIds: [],
    images: [],
    variants: [{ key: "v-new-0", sku: "", optionValue: "", price: "", compareAt: "", stock: "", isActive: true, imageKey: null }],
  };
  return (
    <>
      <Link href="/admin/products" className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-mute hover:text-ink">
        <ArrowRight className="h-3.5 w-3.5" /> كل المنتجات
      </Link>
      <PageHeader title="منتج جديد" subtitle="المخزون غير محدود افتراضيًا — اترك حقل المخزون فارغًا" />
      <ProductForm initial={initial} categories={cats} saveAction={saveProductAction} />
    </>
  );
}

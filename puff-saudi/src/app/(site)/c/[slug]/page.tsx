import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategory, getProductCards } from "@/lib/catalog";
import { FAMILIES } from "@/lib/families";
import { safeDecode } from "@/lib/normalize";
import { PageHero } from "@/components/site/PageHero";
import { ProductGrid } from "@/components/site/ProductGrid";
import { TLink } from "@/components/site/Transition";

export const revalidate = 600;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = safeDecode((await params).slug);
  const category = await getCategory(slug);
  if (!category) return { title: "تصنيف غير موجود" };
  return {
    title: category.name,
    description: category.description ?? `تسوّق ${category.name} من بف السعودية.`,
    alternates: { canonical: `/c/${encodeURI(category.slug)}` },
  };
}

export default async function CategoryPage({ params }: Props) {
  const slug = safeDecode((await params).slug);
  const [category, cards] = await Promise.all([getCategory(slug), getProductCards()]);
  if (!category) notFound();
  const list = cards.filter((c) => c.categorySlugs.includes(category.slug));
  const families = FAMILIES.filter((f) => list.some((c) => f.members.includes(c.family))).map((f) => ({
    key: f.key,
    name: f.name,
    members: f.members,
  }));

  return (
    <>
      <PageHero
        eyebrow="Collection"
        title={category.name}
        description={category.description}
        crumbs={[{ href: "/shop", label: "المتجر" }, { label: category.name }]}
        count={list.length}
      />
      <div className="wrap pb-24 md:pb-32">
        {list.length ? (
          <ProductGrid products={list} families={families} showFamilyFilter={families.length > 1} />
        ) : (
          <div className="border-t border-line py-24 text-center">
            <p className="t-h3">لا توجد منتجات في هذا التصنيف حاليًا</p>
            <TLink href="/shop" className="btn btn-ink mt-6">
              تصفّح كل المنتجات
            </TLink>
          </div>
        )}
      </div>
    </>
  );
}

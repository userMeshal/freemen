import type { Metadata } from "next";
import { getProductCards } from "@/lib/catalog";
import { FAMILIES, familyByKey } from "@/lib/families";
import { PageHero } from "@/components/site/PageHero";
import { ProductGrid } from "@/components/site/ProductGrid";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "المتجر — كل أكواب بف",
  description: "تسوّق كل أكواب بف: سيبي، كوفي، فليبي والإصدارات الخاصة، بكل الألوان والسعات.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ family?: string }> }) {
  const [{ family }, cards] = await Promise.all([searchParams, getProductCards()]);
  const active = family ? familyByKey(family) : undefined;
  const families = FAMILIES.filter((f) => cards.some((c) => f.members.includes(c.family))).map((f) => ({
    key: f.key,
    name: f.name,
    members: f.members,
  }));

  return (
    <>
      <PageHero
        eyebrow="Shop"
        title={active ? active.name : "المتجر"}
        description={active ? active.blurb : "كل الألوان، كل السعات، كل المزاجات — في مكان واحد."}
        crumbs={[{ label: "المتجر" }]}
        count={cards.length}
      />
      <div className="wrap pb-24 md:pb-32">
        {/* key يعيد تهيئة الفلاتر عند التنقل بين روابط العائلات في القائمة */}
        <ProductGrid key={family ?? "all"} products={cards} families={families} initialFamily={active?.key ?? null} />
      </div>
    </>
  );
}

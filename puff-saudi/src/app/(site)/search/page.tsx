import type { Metadata } from "next";
import { searchProducts } from "@/lib/catalog";
import { PageHero } from "@/components/site/PageHero";
import { ProductCard } from "@/components/site/ProductCard";
import { TLink } from "@/components/site/Transition";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = { title: "البحث", robots: { index: false, follow: true } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const results = q.length >= 2 ? await searchProducts(q, 80) : [];

  return (
    <>
      <PageHero
        eyebrow="Search"
        title={q ? `«${q}»` : "البحث"}
        crumbs={[{ label: "البحث" }]}
        count={q ? results.length : undefined}
      />
      <div className="wrap pb-24 md:pb-32">
        <form action="/search" role="search" className="mb-10 flex max-w-xl gap-2">
          <input name="q" defaultValue={q} type="search" placeholder="ابحث عن لون، سعة أو منتج…" aria-label="ابحث" className="field" />
          <button className="btn btn-ink shrink-0">ابحث</button>
        </form>

        {q.length < 2 ? (
          <p className="text-ink-mute">اكتب كلمتين أو حرفين على الأقل للبحث.</p>
        ) : results.length === 0 ? (
          <div className="border-t border-line py-20 text-center">
            <p className="t-h3">لا توجد نتائج مطابقة</p>
            <p className="mt-2 text-ink-mute">جرّب اسم لون مثل «بيبي بلو» أو عائلة مثل «كوفي».</p>
            <TLink href="/shop" className="btn btn-ink mt-6">
              تصفّح كل المنتجات
            </TLink>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-9 md:grid-cols-3 md:gap-x-5 md:gap-y-12 xl:grid-cols-4">
            {results.map((p, i) => (
              <Reveal as="li" key={p.id} index={i % 4}>
                <ProductCard product={p} priority={i < 4} />
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

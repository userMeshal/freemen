import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { BoldHero, type HeroSlide } from "@/components/store/bold/Hero";
import { BoldCategories, BoldFeatures, BoldManifesto, type CategoryPanel } from "@/components/store/bold/Sections";
import { SLink } from "@/components/store/ctx";
import { ProductCard } from "@/components/store/ProductCard";
import { SoftHome } from "@/components/store/soft/Hero";
import { Marquee } from "@/components/ui/Marquee";
import { Reveal, SplitText } from "@/components/ui/Reveal";
import { getCatalog, getStoreBySlug, storePublicUrl } from "@/lib/stores";
import type { ProductCardDTO, ProductDTO } from "@/lib/types";

const card = (p: ProductDTO): ProductCardDTO => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { description, images, stock, ...c } = p;
  return c;
};

export default async function StoreHome({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) notFound();
  const { products, categories } = await getCatalog(store.id);
  const featured = products.filter((p) => p.isFeatured);
  const best = (featured.length >= 4 ? featured : products).slice(0, 8).map(card);
  const dark = store.palette.dark;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: store.name,
    description: store.description,
    url: storePublicUrl(store.slug),
  };
  const ld = <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />;

  if (store.theme === "soft") {
    return (
      <>
        {ld}
        <SoftHome
          featured={featured.map(card)}
          latest={products.slice(0, 10).map(card)}
          categories={categories.filter((c) => c.count > 0)}
          grid={
            products.length ? (
              <div className="s-grid">
                {best.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} />
                ))}
              </div>
            ) : (
              <div className="s-empty">
                <h3>المتجر توّه فاتح</h3>
                <p>المنتجات في الطريق.</p>
              </div>
            )
          }
        />
      </>
    );
  }

  // ───── الثيم الجريء ─────
  const slides: HeroSlide[] = (featured.length >= 2 ? featured : products).slice(0, 6).map((p) => ({
    slug: p.slug,
    name: p.name,
    price: p.price,
    image: p.image,
    art: p.art,
    bg: dark ? `hsl(${p.art.hue} 38% 13%)` : `hsl(${p.art.hue} 72% 88%)`,
    accent: `hsl(${p.art.hue} 85% 58%)`,
  }));
  const panels: CategoryPanel[] = categories
    .filter((c) => c.count > 0)
    .map((c) => {
      const members = products.filter((p) => p.categoryId === c.id);
      return {
        slug: c.slug,
        name: c.name,
        icon: c.icon,
        count: c.count,
        fromPrice: Math.min(...members.map((m) => m.price)),
        bg: dark ? `hsl(${members[0].art.hue} 36% 14%)` : `hsl(${members[0].art.hue} 70% 88%)`,
        items: members.slice(0, 3).map((m) => ({ name: m.name, image: m.image, art: m.art })),
      };
    });
  const marquee = store.content.marquee.length ? store.content.marquee : [store.name];

  return (
    <>
      {ld}
      {slides.length > 0 ? (
        <BoldHero slides={slides} />
      ) : (
        <section className="wrap grid min-h-[80svh] place-items-center pt-[var(--header-h)] text-center">
          <div>
            <h1 className="t-h1">{store.name}</h1>
            <p className="mt-4 text-ink/60">المنتجات في الطريق.</p>
          </div>
        </section>
      )}
      <BoldManifesto />

      <div className="bg-accent py-4 text-on-accent md:py-6">
        <Marquee items={marquee} itemClassName="font-display text-[clamp(1.5rem,4.5vw,3.6rem)] font-black" duration={36} />
      </div>

      <BoldCategories panels={panels} />

      {best.length > 0 && (
        <section id="best" className="bg-paper py-20 md:py-32" aria-label="الأكثر طلبًا">
          <div className="wrap">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <Reveal as="p" className="t-eyebrow text-ink/60">
                  Best Sellers
                </Reveal>
                <SplitText as="h2" className="t-h1 mt-3" text={"الأكثر\nطلبًا."} accentWords={["طلبًا"]} />
              </div>
              <Reveal>
                <SLink href="/shop" className="btn btn-ghost">
                  كل المنتجات
                  <ArrowLeft size={17} />
                </SLink>
              </Reveal>
            </div>
            <ul className="mt-12 grid grid-cols-2 gap-x-3 gap-y-9 md:mt-16 md:grid-cols-4 md:gap-x-6 md:gap-y-14">
              {best.map((p, i) => (
                <Reveal as="li" key={p.id} index={i % 4}>
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      )}

      <BoldFeatures />

      <section className="on-ink overflow-hidden bg-ink py-20 text-paper md:py-28">
        <Marquee items={[...marquee].reverse()} reverse duration={30} className="opacity-90" itemClassName="t-mega text-[clamp(3.2rem,13vw,12rem)] !leading-[1.25]" />
        <div className="wrap mt-10 flex flex-col items-start justify-between gap-6 md:mt-14 md:flex-row md:items-center">
          <div className="max-w-lg">
            <p className="t-h3">{store.content.ctaTitle}</p>
            <p className="mt-2 text-base leading-loose text-paper/70 md:text-lg">{store.content.ctaText}</p>
          </div>
          <SLink href="/shop" className="btn btn-accent !min-h-[3.8rem] !px-9 !text-base">
            ادخل المتجر
            <ArrowLeft size={18} />
          </SLink>
        </div>
      </section>
    </>
  );
}

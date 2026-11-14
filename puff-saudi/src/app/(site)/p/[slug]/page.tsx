import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllProducts, getProduct } from "@/lib/catalog";
import { familyOf } from "@/lib/families";
import { safeDecode, stripHtml } from "@/lib/normalize";
import { siteUrl } from "@/lib/settings";
import { ProductView, type SiblingLink } from "@/components/site/ProductView";
import { ProductCard } from "@/components/site/ProductCard";
import { Reveal, SplitText } from "@/components/ui/Reveal";
import type { ProductCardDTO, ProductDTO } from "@/lib/types";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ v?: string }> };

function toCard(p: ProductDTO): ProductCardDTO {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { descriptionHtml, metaDescription, images, variants, categories, ...card } = p;
  return card;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct(safeDecode((await params).slug));
  if (!product) return { title: "المنتج غير موجود" };
  const description = product.metaDescription || stripHtml(product.descriptionHtml).slice(0, 160);
  const image = product.image?.url;
  return {
    title: product.name,
    description,
    alternates: { canonical: `/p/${product.slug}` },
    openGraph: {
      type: "website",
      title: `${product.name} — PUFF SAUDI`,
      description,
      url: `/p/${product.slug}`,
      images: image ? [{ url: image, width: 1200, height: 1200, alt: product.name }] : undefined,
    },
  };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const [{ slug }, { v }] = await Promise.all([params, searchParams]);
  const [product, all] = await Promise.all([getProduct(safeDecode(slug)), getAllProducts()]);
  if (!product) notFound();

  const family = familyOf(product.family);
  const sameLine = all.filter((p) => p.family === product.family);

  // منتجات شقيقة: نفس العائلة والسعة بألوان أخرى / نفس اللون بسعات أخرى
  let colorSiblings: SiblingLink[] = [];
  let sizeSiblings: SiblingLink[] = [];
  if (product.colorName) {
    colorSiblings = sameLine
      .filter((p) => p.colorName && p.capacityMl === product.capacityMl)
      .map((p) => ({ slug: p.slug, label: p.colorName!, accent: p.image?.accent ?? "#ccc", active: p.id === product.id }));
    sizeSiblings = sameLine
      .filter((p) => p.colorName === product.colorName && p.capacityMl)
      .sort((a, b) => (a.capacityMl ?? 0) - (b.capacityMl ?? 0))
      .map((p) => ({ slug: p.slug, label: `${p.capacityMl} مل`, active: p.id === product.id }));
  } else if (product.capacityMl && product.variantCount > 1) {
    sizeSiblings = sameLine
      .filter((p) => !p.colorName && p.capacityMl && p.variantCount > 1)
      .sort((a, b) => (a.capacityMl ?? 0) - (b.capacityMl ?? 0))
      .map((p) => ({ slug: p.slug, label: `${p.capacityMl} مل`, active: p.id === product.id }));
  }

  const related = all
    .filter((p) => p.id !== product.id && (family ? family.members.includes(p.family) : p.family === product.family))
    .filter((p) => (product.colorName ? p.colorName !== product.colorName : true))
    .sort((a, b) => Number(b.capacityMl === product.capacityMl) - Number(a.capacityMl === product.capacityMl))
    .slice(0, 8);
  const fallback = related.length ? related : all.filter((p) => p.id !== product.id && p.isBestSeller).slice(0, 8);

  const prices = product.variants.map((x) => x.price);
  const inStock = product.variants.some((x) => x.stock === null || x.stock > 0);
  const url = `${siteUrl()}/p/${product.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.metaDescription || stripHtml(product.descriptionHtml).slice(0, 300),
    image: product.images.slice(0, 6).map((i) => `${siteUrl()}${i.url}`),
    sku: product.variants[0]?.sku,
    brand: { "@type": "Brand", name: "Puff" },
    ...(product.colorName ? { color: product.colorName } : {}),
    offers:
      product.variants.length > 1
        ? {
            "@type": "AggregateOffer",
            priceCurrency: "SAR",
            lowPrice: (Math.min(...prices) / 100).toFixed(2),
            highPrice: (Math.max(...prices) / 100).toFixed(2),
            offerCount: product.variants.length,
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url,
          }
        : {
            "@type": "Offer",
            priceCurrency: "SAR",
            price: (product.price / 100).toFixed(2),
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url,
          },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <ProductView
        key={product.id}
        product={product}
        familyName={family?.name ?? null}
        familyKey={family?.key ?? null}
        colorSiblings={colorSiblings}
        sizeSiblings={sizeSiblings}
        initialVariantId={v ? Number(v) : null}
      />

      {fallback.length > 0 && (
        <section className="bg-paper py-16 md:py-24" aria-label="منتجات مقترحة">
          <div className="wrap">
            <Reveal as="p" className="t-eyebrow text-ink-mute">
              You may also like
            </Reveal>
            <SplitText as="h2" className="t-h2 mt-2" text="قد يعجبك أيضًا." accentWords={["أيضًا"]} />
          </div>
          <ul className="no-scrollbar mt-8 flex snap-x snap-mandatory gap-3 overflow-x-auto px-[var(--gutter)] pb-2 md:mt-12 md:gap-5">
            {fallback.map((p, i) => (
              <Reveal as="li" key={p.id} index={i} className="w-[62vw] shrink-0 snap-start sm:w-[38vw] lg:w-[23vw]">
                <ProductCard product={toCard(p)} sizes="(min-width:1024px) 23vw, 62vw" />
              </Reveal>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

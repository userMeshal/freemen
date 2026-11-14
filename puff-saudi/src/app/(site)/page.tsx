import { ArrowLeft } from "lucide-react";
import { getAllProducts } from "@/lib/catalog";
import { FAMILIES } from "@/lib/families";
import { getSettings, siteUrl } from "@/lib/settings";
import { Hero, type HeroSlide } from "@/components/home/Hero";
import { Marquee } from "@/components/home/Marquee";
import { Manifesto } from "@/components/home/Manifesto";
import { Families, type FamilyPanel } from "@/components/home/Families";
import { ColorWall, type WallGroup } from "@/components/home/ColorWall";
import { Editions } from "@/components/home/Editions";
import { ProductCard } from "@/components/site/ProductCard";
import { TLink } from "@/components/site/Transition";
import { Reveal, SplitText } from "@/components/ui/Reveal";
import type { ProductCardDTO, ProductDTO } from "@/lib/types";

export const revalidate = 600;

export const metadata = { alternates: { canonical: "/" } };

// أكواب العرض الافتتاحي والعائلات — مختارة لنظافة قصّها وتباين ألوانها (تسقط تلقائيًا إن حُذفت من المتجر)
const HERO_SLUGS = ["sippy-350-05", "sippy-550-22", "sippy-350-10", "sippy-350-21", "coffee-450-03", "sippy-350-08", "sippy-350-12"];
const FAMILY_CUPS: Record<string, string[]> = {
  sippy: ["sippy-350-16", "sippy-350-10", "sippy-350-21"],
  coffee: ["coffee-450-03", "coffee-550-01", "coffee-450-06"],
  flippy: ["flippy-steel-350-02", "flippy-steel-350-06", "flippy-steel-350-08"],
};

function toCard(p: ProductDTO): ProductCardDTO {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { descriptionHtml, metaDescription, images, variants, categories, ...card } = p;
  return card;
}

export default async function HomePage() {
  const [all, settings] = await Promise.all([getAllProducts(), getSettings()]);
  const bySlug = new Map(all.map((p) => [p.slug, p]));
  const withCutout = (p: ProductDTO | undefined) => (p?.image?.cutoutUrl && p.image.cutoutW && p.image.cutoutH ? p : null);

  // ───── Hero ─────
  let heroProducts = HERO_SLUGS.map((s) => withCutout(bySlug.get(s))).filter((p): p is ProductDTO => Boolean(p));
  if (heroProducts.length < 3) {
    heroProducts = all.filter((p) => withCutout(p) && p.family === "sippy" && p.colorName).slice(0, 6);
  }
  const slides: HeroSlide[] = heroProducts.map((p) => ({
    slug: p.slug,
    name: p.name,
    colorName: p.colorName,
    price: p.price,
    cutoutUrl: p.image!.cutoutUrl!,
    w: p.image!.cutoutW!,
    h: p.image!.cutoutH!,
    bg: p.image!.bg,
    accent: p.image!.accent,
  }));

  // ───── العائلات ─────
  const panels: FamilyPanel[] = FAMILIES.filter((f) => FAMILY_CUPS[f.key]).flatMap((f) => {
    const members = all.filter((p) => f.members.includes(p.family));
    if (!members.length) return [];
    let cups = FAMILY_CUPS[f.key].map((s) => withCutout(bySlug.get(s))).filter((p): p is ProductDTO => Boolean(p));
    if (cups.length < 3) cups = members.filter((p) => withCutout(p) && p.colorName).slice(0, 3);
    const lead = cups[1] ?? cups[0] ?? members[0];
    return [
      {
        key: f.key,
        name: f.name,
        latin: f.latin,
        line: f.line,
        blurb: f.blurb,
        specs: f.specs,
        count: members.length,
        fromPrice: Math.min(...members.map((m) => m.price)),
        bg: lead.image?.bg ?? "#EBE5D6",
        cups: cups.map((c) => ({ url: c.image!.cutoutUrl!, w: c.image!.cutoutW!, h: c.image!.cutoutH!, alt: c.name })),
      },
    ];
  });

  // ───── الأكثر مبيعًا ─────
  const best = all.filter((p) => p.isBestSeller).slice(0, 8);

  // ───── جدار الألوان ─────
  const wall: WallGroup[] = all
    .filter((p) => p.family === "sippy" && p.variantCount > 1 && p.capacityMl && p.swatches.length > 3)
    .sort((a, b) => (a.capacityMl ?? 0) - (b.capacityMl ?? 0))
    .map((p) => ({
      slug: p.slug,
      capacityMl: p.capacityMl!,
      colors: p.swatches.map((s) => ({
        ...s,
        price: p.variants.find((v) => v.id === s.variantId)?.price ?? p.price,
      })),
    }));

  const editions = all.filter((p) => p.family === "special");

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "PUFF SAUDI",
        url: siteUrl(),
        ...(settings.email ? { email: settings.email } : {}),
        ...(settings.vatNumber ? { vatID: settings.vatNumber } : {}),
      },
      {
        "@type": "WebSite",
        name: "PUFF SAUDI",
        url: siteUrl(),
        inLanguage: "ar-SA",
        potentialAction: {
          "@type": "SearchAction",
          target: `${siteUrl()}/search?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Hero slides={slides} />
      <Manifesto />

      <div className="bg-lime py-4 text-ink md:py-6">
        <Marquee
          items={["PUFF", "لونك مزاجك", "COLOR IS A MOOD", "بف السعودية", "SIPPY", "COFFEE", "FLIPPY"]}
          itemClassName="font-display text-[clamp(1.5rem,4.5vw,3.6rem)] font-black"
          duration={36}
        />
      </div>

      <Families panels={panels} />

      {best.length > 0 && (
        <section className="bg-paper py-20 md:py-32" aria-label="الأكثر مبيعًا">
          <div className="wrap">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <Reveal as="p" className="t-eyebrow text-ink-mute">
                  Best Sellers
                </Reveal>
                <SplitText as="h2" className="t-h1 mt-3" text={"الأكثر\nمبيعًا."} accentWords={["مبيعًا"]} />
              </div>
              <Reveal>
                <TLink href="/shop" className="btn btn-ghost">
                  كل المنتجات
                  <ArrowLeft size={17} />
                </TLink>
              </Reveal>
            </div>
            <ul className="mt-12 grid grid-cols-2 gap-x-3 gap-y-9 md:mt-16 md:grid-cols-3 md:gap-x-6 md:gap-y-14">
              {best.map((p, i) => (
                <Reveal as="li" key={p.id} index={i % 3}>
                  <ProductCard product={toCard(p)} sizes="(min-width: 768px) 33vw, 50vw" />
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      )}

      <ColorWall groups={wall} />
      <Editions products={editions} />

      {/* ختام: دعوة للمتجر كاملًا */}
      <section className="on-ink overflow-hidden bg-ink py-20 text-paper md:py-28">
        <Marquee
          items={["كل الألوان", "كل السعات", "كل المزاجات"]}
          reverse
          duration={30}
          className="opacity-90"
          itemClassName="t-mega text-[clamp(3.2rem,13vw,12rem)] !leading-[1.25]"
        />
        <div className="wrap mt-10 flex flex-col items-start justify-between gap-6 md:mt-14 md:flex-row md:items-center">
          <p className="max-w-lg text-base leading-loose text-paper/70 md:text-lg">
            <span className="num font-display font-bold text-lime">{all.length}</span> منتجًا بين سيبي وكوفي وفليبي والإصدارات
            الخاصة — كلها في مكان واحد.
          </p>
          <TLink href="/shop" className="btn btn-lime !min-h-[3.8rem] !px-9 !text-base">
            ادخل المتجر
            <ArrowLeft size={18} />
          </TLink>
        </div>
      </section>
    </>
  );
}

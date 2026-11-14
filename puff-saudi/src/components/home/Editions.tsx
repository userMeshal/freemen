import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { TLink } from "@/components/site/Transition";
import { Reveal, SplitText } from "@/components/ui/Reveal";
import { formatAmount } from "@/lib/money";
import type { ProductDTO } from "@/lib/types";

/** الإصدارات الخاصة — بطاقات تحريرية كبيرة */
export function Editions({ products }: { products: ProductDTO[] }) {
  if (!products.length) return null;
  return (
    <section className="bg-paper py-20 md:py-32" aria-label="الإصدارات الخاصة">
      <div className="wrap">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Reveal as="p" className="t-eyebrow text-ink-mute">
              Special Edition
            </Reveal>
            <SplitText as="h2" className="t-h1 mt-3" text={"إصدارات\nخاصة."} accentWords={["خاصة"]} />
          </div>
          <Reveal as="p" className="max-w-sm text-sm leading-loose text-ink-mute md:text-base">
            تصاميم محدودة من بف بثلاث سعات. اختر السعة المناسبة لك.
          </Reveal>
        </div>

        <div className="mt-12 grid gap-5 md:mt-16 md:grid-cols-2 md:gap-7">
          {products.map((p, i) => {
            const img = p.images[0];
            const second = p.images[1];
            return (
              <Reveal key={p.id} as="article" index={i} clip className="group relative">
                <TLink
                  href={`/p/${p.slug}`}
                  data-cursor="اكتشف"
                  className="relative block aspect-[4/5] overflow-hidden rounded-tile md:aspect-[5/6]"
                  style={{ backgroundColor: img?.bg ?? "#EBE5D6" }}
                >
                  {img && (
                    <Image
                      src={img.url}
                      alt={p.name}
                      fill
                      sizes="(min-width:768px) 50vw, 100vw"
                      className={`object-contain p-[6%] transition-all duration-[1400ms] ease-expo group-hover:scale-105 ${
                        second ? "group-hover:opacity-0" : ""
                      }`}
                    />
                  )}
                  {second && (
                    <Image
                      src={second.url}
                      alt=""
                      fill
                      sizes="(min-width:768px) 50vw, 100vw"
                      className="scale-110 object-cover opacity-0 transition-all duration-[1400ms] ease-expo group-hover:scale-100 group-hover:opacity-100"
                    />
                  )}
                  <span className="absolute start-4 top-4 rounded-full bg-ink px-3 py-1.5 font-display text-[0.65rem] font-bold tracking-wider text-lime">
                    إصدار خاص
                  </span>
                </TLink>

                <div className="mt-5 flex flex-wrap items-start justify-between gap-4 px-1">
                  <div className="max-w-md">
                    <h3 className="t-h3">{p.name.split("|")[0].trim()}</h3>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {p.variants.map((v) => (
                        <li key={v.id}>
                          <TLink
                            href={`/p/${p.slug}?v=${v.id}`}
                            className="inline-flex items-baseline gap-2 rounded-full border-[1.5px] border-ink/15 px-3.5 py-2 text-sm transition-colors duration-300 hover:border-ink hover:bg-ink hover:text-paper"
                          >
                            <span>{v.optionValue}</span>
                            <span className="num font-display text-xs font-bold">{formatAmount(v.price)} ر.س</span>
                          </TLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <TLink href={`/p/${p.slug}`} className="link-draw mt-1 inline-flex items-center gap-2 font-display text-sm font-bold">
                    اكتشف الإصدار
                    <ArrowLeft size={16} />
                  </TLink>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

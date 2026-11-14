"use client";

import Image from "next/image";
import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { TLink } from "./Transition";
import { Price, SaleBadge } from "@/components/ui/Price";
import { useCart } from "@/store/cart";
import { pixel } from "@/lib/pixels";
import type { ProductCardDTO } from "@/lib/types";

export function ProductCard({
  product,
  priority = false,
  sizes = "(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw",
}: {
  product: ProductCardDTO;
  priority?: boolean;
  sizes?: string;
}) {
  const add = useCart((s) => s.add);
  const openCart = useCart((s) => s.open);
  const [swatch, setSwatch] = useState<number | null>(null);
  const [added, setAdded] = useState(false);

  const active = swatch !== null ? product.swatches[swatch] : null;
  const img = active ? { url: active.url, bg: active.bg, flat: active.flat } : product.image;
  const href = `/p/${product.slug}${active ? `?v=${active.variantId}` : ""}`;
  const shown = product.swatches.slice(0, 6);
  const extra = product.swatches.length - shown.length;

  const quickAdd = () => {
    if (!product.quickVariantId || !product.inStock) return;
    add({
      variantId: product.quickVariantId,
      slug: product.slug,
      name: product.name,
      optionValue: null,
      imageUrl: product.image?.url ?? null,
      bg: product.image?.bg ?? "#F5F1E8",
      unitPrice: product.price,
    });
    pixel.addToCart({ id: product.id, name: product.name, price: product.price });
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
    setTimeout(openCart, 350);
  };

  return (
    <article className="group relative">
      <div
        className="relative aspect-[4/5] overflow-hidden rounded-tile transition-colors duration-700"
        style={{ backgroundColor: img?.bg ?? "#EBE5D6" }}
      >
        <TLink href={href} data-cursor="عرض" aria-label={product.name} className="absolute inset-0 block">
          {img && (
            <Image
              key={img.url}
              src={img.url}
              alt={product.name}
              fill
              sizes={sizes}
              priority={priority}
              className={`${img.flat ? "object-contain" : "object-cover"} transition-transform duration-[1200ms] ease-expo will-change-transform group-hover:scale-[1.08] motion-safe:animate-[cardIn_.6s_var(--ease-expo)]`}
            />
          )}
        </TLink>

        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <SaleBadge price={product.price} compareAt={product.compareAtPrice} />
          {product.isBestSeller && (
            <span className="rounded-full bg-lime px-2.5 py-1 font-display text-[0.62rem] font-bold text-ink">
              الأكثر مبيعًا
            </span>
          )}
        </div>

        {!product.inStock ? (
          <span className="absolute inset-x-3 bottom-3 rounded-full bg-paper/90 py-2 text-center text-xs font-semibold backdrop-blur">
            نفدت الكمية
          </span>
        ) : product.quickVariantId ? (
          <button
            type="button"
            onClick={quickAdd}
            data-cursor-ignore
            aria-label={`أضف ${product.name} إلى السلة`}
            className="absolute bottom-3 end-3 grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-ink text-paper transition-all duration-500 ease-expo hover:w-[8.6rem] hover:bg-lime hover:text-ink active:scale-95 md:translate-y-[140%] md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100 [&:hover_.qa-label]:max-w-[6rem] [&:hover_.qa-label]:opacity-100"
          >
            <span className="flex items-center gap-1.5 whitespace-nowrap font-display text-xs font-bold">
              {added ? <Check size={18} strokeWidth={2.6} /> : <Plus size={18} strokeWidth={2.6} />}
              <span className="qa-label max-w-0 overflow-hidden opacity-0 transition-all duration-500 ease-expo">
                {added ? "أُضيف" : "أضف للسلة"}
              </span>
            </span>
          </button>
        ) : (
          <TLink
            href={href}
            data-cursor-ignore
            className="absolute bottom-3 end-3 hidden h-11 items-center rounded-full bg-ink px-4 font-display text-xs font-bold text-paper transition-all duration-500 ease-expo hover:bg-lime hover:text-ink md:flex md:translate-y-[140%] md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100"
          >
            اختر {product.optionName ?? "الخيار"}
          </TLink>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-1.5 px-1">
        <TLink href={href} className="line-clamp-2 text-[0.95rem] font-medium leading-snug">
          {product.name}
        </TLink>
        <Price price={product.price} compareAt={product.compareAtPrice} from={product.variantCount > 1 && !!product.swatches.length} />
        {shown.length > 0 && (
          <div className="mt-1 flex items-center gap-1.5" onMouseLeave={() => setSwatch(null)}>
            {shown.map((s, i) => (
              <button
                key={s.variantId}
                type="button"
                title={s.label}
                aria-label={s.label}
                onMouseEnter={() => setSwatch(i)}
                onFocus={() => setSwatch(i)}
                onClick={() => setSwatch(i)}
                className={`h-4 w-4 rounded-full border border-ink/15 transition-transform duration-300 ease-expo hover:scale-125 ${
                  swatch === i ? "scale-125 ring-2 ring-ink ring-offset-2 ring-offset-paper" : ""
                }`}
                style={{ backgroundColor: s.accent }}
              />
            ))}
            {extra > 0 && <span className="num text-xs text-ink-mute">+{extra}</span>}
          </div>
        )}
      </div>
    </article>
  );
}

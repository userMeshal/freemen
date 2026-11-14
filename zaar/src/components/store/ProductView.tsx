"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, Minus, Plus, RotateCcw, ShieldCheck, Star, Truck } from "lucide-react";
import { Art } from "@/components/ui/Art";
import { formatAmount } from "@/lib/money";
import type { ProductCardDTO, ProductDTO } from "@/lib/types";
import { useCart } from "./cart";
import { SLink, useStore } from "./ctx";
import { ProductCard } from "./ProductCard";
import { track } from "./track";
import { Price, SaleBadge, Stars, useT } from "./ui";

type ReviewRow = { id: number; name: string; rating: number; body: string; createdAt: string };

export function ProductView({ product, reviews, related }: { product: ProductDTO; reviews: ReviewRow[]; related: ProductCardDTO[] }) {
  const { store, guaranteeDays } = useStore();
  const t = useT();
  const soft = store.theme === "soft";
  const add = useCart((s) => s.add);
  const openCart = useCart((s) => s.open);
  const [option, setOption] = useState<string | null>(product.option?.values[0] ?? null);
  const [qty, setQty] = useState(1);
  const [shot, setShot] = useState(0);
  const [added, setAdded] = useState(false);
  const max = product.stock === null ? 20 : Math.min(20, product.stock);

  useEffect(() => {
    track.product(store.slug, { id: product.id, name: product.name, price: product.price });
  }, [store.slug, product.id, product.name, product.price]);

  const addToCart = () => {
    if (!product.inStock) return;
    add({ productId: product.id, slug: product.slug, name: product.name, optionValue: option, unitPrice: product.price, image: product.image, art: product.art }, qty);
    track.addToCart(store.slug, { id: product.id, name: product.name, price: product.price });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
    setTimeout(openCart, 300);
  };

  const perks = [
    { icon: ShieldCheck, title: "مضمون بضمان زار", text: `استرداد كامل حتى ${guaranteeDays} يومًا بعد الاستلام` },
    { icon: Truck, title: `يوصلك خلال ${store.settings.shippingDays} أيام عمل`, text: store.settings.freeShippingOver > 0 ? `شحن مجاني فوق ${formatAmount(store.settings.freeShippingOver)} ر.س` : "لكل مدن المملكة" },
    { icon: RotateCcw, title: "تابي وتمارا", text: "قسّمها بدون فوائد عند الدفع" },
  ];

  return (
    <div className={t.page}>
      <SLink href="/shop" className={`mb-6 inline-flex items-center gap-1.5 text-sm ${t.muted} transition-colors hover:text-ink`}>
        <ArrowRight size={16} /> كل المنتجات
      </SLink>

      <div className="grid items-start gap-8 md:grid-cols-[1.05fr_1fr] md:gap-14">
        {/* المعرض */}
        <div className="md:sticky md:top-[calc(var(--header-h)+1.5rem)]">
          <div className={`${t.media} relative aspect-[1/1.02]`}>
            <Art image={product.images[shot] ?? null} art={product.art} alt={product.name} />
            <div className="absolute start-4 top-4">
              <SaleBadge price={product.price} compareAt={product.compareAtPrice} />
            </div>
          </div>
          {product.images.length > 1 && (
            <div className="mt-3 flex gap-2.5">
              {product.images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setShot(i)}
                  aria-label={`صورة ${i + 1}`}
                  className={`h-[4.5rem] w-[4.5rem] overflow-hidden rounded-2xl border-2 transition-opacity ${i === shot ? "border-ink opacity-100" : "border-transparent opacity-55 hover:opacity-90"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* التفاصيل */}
        <div className="flex flex-col gap-6">
          <div>
            {product.categoryName && <p className={t.eyebrow}>{product.categoryName}</p>}
            <h1 className={`${t.h1} mt-2`}>{product.name}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <Price price={product.price} compareAt={product.compareAtPrice} size="lg" />
              <Stars value={product.rating} count={product.reviewsCount} size={16} />
            </div>
            <p className={`mt-1 text-xs ${t.muted}`}>السعر شامل ضريبة القيمة المضافة</p>
          </div>

          {product.option && (
            <fieldset>
              <legend className={t.label}>
                {product.option.name}: <span className="font-normal">{option}</span>
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {product.option.values.map((v) => (
                  <button key={v} type="button" onClick={() => setOption(v)} aria-pressed={option === v} className={option === v ? t.chipOn : t.chip}>
                    {v}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <div className="flex items-stretch gap-3">
            <div className="flex items-center rounded-full border-[1.5px] border-ink/15">
              <button type="button" aria-label="إنقاص الكمية" className="grid h-full w-12 place-items-center disabled:opacity-30" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}>
                <Minus size={16} />
              </button>
              <span className="num w-7 text-center font-display font-bold" aria-live="polite">
                {qty}
              </span>
              <button type="button" aria-label="زيادة الكمية" className="grid h-full w-12 place-items-center disabled:opacity-30" disabled={qty >= max} onClick={() => setQty((q) => Math.min(max, q + 1))}>
                <Plus size={16} />
              </button>
            </div>
            <button type="button" onClick={addToCart} disabled={!product.inStock} className={`${t.btnBlock} flex-1 disabled:opacity-40`}>
              {!product.inStock ? (
                "نفدت الكمية"
              ) : added ? (
                <>
                  <Check size={18} /> أُضيف للسلة
                </>
              ) : (
                <>
                  أضف للسلة — <span className="num">{formatAmount(product.price * qty)}</span> ر.س
                </>
              )}
            </button>
          </div>
          {product.stock !== null && product.stock > 0 && product.stock <= 5 && <p className="text-sm font-medium text-coral">باقي {product.stock} قطع فقط</p>}

          <ul className={`${t.panel} !gap-0 divide-y divide-ink/10 !p-0`}>
            {perks.map((p) => (
              <li key={p.title} className="flex items-center gap-3.5 px-5 py-3.5">
                <p.icon size={20} strokeWidth={1.6} className="shrink-0" />
                <div>
                  <p className="text-sm font-semibold">{p.title}</p>
                  <p className={`text-xs ${t.muted}`}>{p.text}</p>
                </div>
              </li>
            ))}
          </ul>

          {product.description && (
            <div>
              <h2 className={t.h2}>عن المنتج</h2>
              <p className="mt-3 whitespace-pre-line text-[1.02rem] leading-loose opacity-85">{product.description}</p>
            </div>
          )}
        </div>
      </div>

      {reviews.length > 0 && (
        <section className="mt-20 md:mt-28" aria-label="تقييمات العملاء">
          <h2 className={t.h2}>
            تقييمات العملاء <span className="num text-base opacity-50">({reviews.length})</span>
          </h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {reviews.map((r) => (
              <li key={r.id} className={t.panel}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{r.name}</span>
                  <span className="flex gap-0.5" aria-label={`${r.rating} من 5`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={14} className={i < r.rating ? "fill-amber-400 text-amber-400" : "text-ink/20"} />
                    ))}
                  </span>
                </div>
                {r.body && <p className="mt-2 text-sm leading-loose opacity-80">{r.body}</p>}
                <p className={`mt-2 flex items-center gap-1 text-xs ${t.muted}`}>
                  <Check size={12} /> مشترٍ موثّق
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-20 md:mt-28" aria-label="منتجات مشابهة">
          <h2 className={`${t.h2} mb-6`}>قد يعجبك أيضًا</h2>
          {soft ? (
            <div className="s-grid">
              {related.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-x-3 gap-y-9 md:grid-cols-4 md:gap-x-6">
              {related.map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

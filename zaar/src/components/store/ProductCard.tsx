"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Check, Plus, ShoppingBag } from "lucide-react";
import { Art } from "@/components/ui/Art";
import { formatAmount } from "@/lib/money";
import type { ProductCardDTO } from "@/lib/types";
import { useCart } from "./cart";
import { SLink, useNavigate, useHref, useStore } from "./ctx";
import { track } from "./track";
import { Price, SaleBadge, Stars } from "./ui";

function useQuickAdd(product: ProductCardDTO) {
  const { store } = useStore();
  const add = useCart((s) => s.add);
  const openCart = useCart((s) => s.open);
  const navigate = useNavigate();
  const href = useHref();
  const [added, setAdded] = useState(false);
  const run = () => {
    if (!product.inStock) return;
    if (product.option) {
      navigate(href(`/p/${product.slug}`));
      return;
    }
    add({ productId: product.id, slug: product.slug, name: product.name, optionValue: null, unitPrice: product.price, image: product.image, art: product.art });
    track.addToCart(store.slug, { id: product.id, name: product.name, price: product.price });
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
    setTimeout(openCart, 350);
  };
  return { run, added };
}

/** بطاقة المنتج — شكلها يتبع ثيم المتجر */
export function ProductCard({ product, index = 0 }: { product: ProductCardDTO; index?: number }) {
  const { store } = useStore();
  return store.theme === "soft" ? <SoftCard product={product} index={index} /> : <BoldCard product={product} />;
}

/** من تصميم PUFF: بلاطة 4:5، تكبير عند المرور، وزر إضافة يتمدد */
function BoldCard({ product }: { product: ProductCardDTO }) {
  const { run, added } = useQuickAdd(product);
  const href = `/p/${product.slug}`;
  return (
    <article className="group relative">
      <div className="bg-paper-deep relative aspect-[4/5] overflow-hidden rounded-tile">
        <SLink href={href} data-cursor="عرض" aria-label={product.name} className="absolute inset-0 block">
          <div className="h-full w-full transition-transform duration-[1200ms] ease-expo will-change-transform group-hover:scale-[1.08] motion-safe:animate-[cardIn_.6s_var(--ease-expo)]">
            <Art image={product.image} art={product.art} alt={product.name} />
          </div>
        </SLink>
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <SaleBadge price={product.price} compareAt={product.compareAtPrice} />
          {product.isFeatured && <span className="rounded-full bg-accent px-2.5 py-1 font-display text-[0.62rem] font-bold text-on-accent">الأكثر طلبًا</span>}
        </div>
        {!product.inStock ? (
          <span className="absolute inset-x-3 bottom-3 rounded-full bg-paper/90 py-2 text-center text-xs font-semibold backdrop-blur">نفدت الكمية</span>
        ) : (
          <button
            type="button"
            onClick={run}
            data-cursor-ignore
            aria-label={`أضف ${product.name} إلى السلة`}
            className="absolute bottom-3 end-3 grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-ink text-paper transition-all duration-500 ease-expo hover:w-[8.6rem] hover:bg-accent hover:text-on-accent active:scale-95 md:translate-y-[140%] md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100 [&:hover_.qa-label]:max-w-[6rem] [&:hover_.qa-label]:opacity-100"
          >
            <span className="flex items-center gap-1.5 whitespace-nowrap font-display text-xs font-bold">
              {added ? <Check size={18} strokeWidth={2.6} /> : <Plus size={18} strokeWidth={2.6} />}
              <span className="qa-label max-w-0 overflow-hidden opacity-0 transition-all duration-500 ease-expo">{added ? "أُضيف" : product.option ? `اختر ${product.option.name}` : "أضف للسلة"}</span>
            </span>
          </button>
        )}
      </div>
      <div className="mt-3 flex flex-col gap-1.5 px-1">
        <SLink href={href} className="line-clamp-2 text-[0.95rem] font-medium leading-snug">
          {product.name}
        </SLink>
        <div className="flex items-center justify-between gap-2">
          <Price price={product.price} compareAt={product.compareAtPrice} />
          <Stars value={product.rating} count={product.reviewsCount} />
        </div>
      </div>
    </article>
  );
}

const EASE = [0.22, 1, 0.36, 1] as const;

/** من تصميم «حطّها»: بطاقة ترتفع عند المرور، وسطر سفلي يتبدّل إلى دعوة للشراء */
function SoftCard({ product, index }: { product: ProductCardDTO; index: number }) {
  const { run, added } = useQuickAdd(product);
  const href = `/p/${product.slug}`;
  return (
    <motion.article
      className="s-card"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, ease: EASE, delay: Math.min(index, 8) * 0.05 }}
    >
      <SLink href={href} className="s-card-link" aria-label={product.name}>
        <div className="s-card-media">
          <div className="s-art !block">
            <Art image={product.image} art={product.art} alt={product.name} />
          </div>
          {product.categoryName && <span className="s-chip s-chip-glass s-card-cond">{product.categoryName}</span>}
          {product.compareAtPrice && product.compareAtPrice > product.price && (
            <span className="s-chip s-sale">خصم {Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)}%</span>
          )}
        </div>
        <div className="s-card-body">
          <div className="s-card-meta">
            <span>{product.inStock ? "متوفر" : "نفدت الكمية"}</span>
            <Stars value={product.rating} count={product.reviewsCount} size={13} />
          </div>
          <h3 className="s-card-title">{product.name}</h3>
          <div className="s-card-price">
            <strong>
              <span className="num">{formatAmount(product.price)}</span> <small className="text-[0.7em] font-medium">ر.س</small>
            </strong>
            {product.compareAtPrice && product.compareAtPrice > product.price && <s className="num">{formatAmount(product.compareAtPrice)}</s>}
          </div>
          <div className="s-card-foot">
            <span className="s-card-count">{product.option ? `${product.option.values.length} ${product.option.name}` : "شحن لكل المدن"}</span>
            <span className="s-card-go">اعرض المنتج ←</span>
          </div>
        </div>
      </SLink>
      {product.inStock && (
        <motion.button className={`s-fav ${added ? "s-is-on" : ""}`} whileTap={{ scale: 0.8 }} onClick={run} aria-label={`أضف ${product.name} إلى السلة`}>
          {added ? <Check size={17} /> : <ShoppingBag size={17} />}
        </motion.button>
      )}
    </motion.article>
  );
}

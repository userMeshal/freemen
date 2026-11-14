"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { TLink } from "@/components/site/Transition";
import { QtyStepper } from "@/components/site/CartDrawer";
import { CouponBox, Totals } from "@/components/site/OrderSummary";
import { useCartQuote } from "@/components/site/useCartQuote";
import { useCart } from "@/store/cart";
import { formatAmount } from "@/lib/money";

const EASE = [0.16, 1, 0.3, 1] as const;

export function CartView() {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const { quote, loading, notice, hydrated, empty } = useCartQuote();

  if (!hydrated) return <div className="h-[40vh] animate-pulse rounded-tile bg-ink/5" />;

  if (empty) {
    return (
      <div className="border-t border-line py-24 text-center">
        <p dir="ltr" className="t-mega t-outline text-[8rem]" style={{ ["--stroke" as string]: "rgba(11,11,12,.2)" }}>
          0
        </p>
        <p className="t-h3 mt-4">سلّتك فارغة</p>
        <p className="mt-2 text-ink-mute">اختر لونك المفضل وابدأ من هنا.</p>
        <TLink href="/shop" className="btn btn-ink mt-7">
          تصفّح المتجر
        </TLink>
      </div>
    );
  }

  const maxOf = (variantId: number) => quote?.lines.find((l) => l.variantId === variantId)?.maxQty ?? 20;

  return (
    <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
      <div>
        {notice && (
          <p role="status" className="mb-5 rounded-2xl bg-lime/60 px-4 py-3 text-sm">
            {notice}
          </p>
        )}
        <ul className="divide-y divide-line border-y border-line">
          <AnimatePresence initial={false}>
            {items.map((it) => (
              <motion.li
                key={it.variantId}
                layout
                exit={{ opacity: 0, height: 0, transition: { duration: 0.35, ease: EASE } }}
                className="overflow-hidden"
              >
                <div className="flex gap-4 py-5 md:gap-6">
                  <TLink
                    href={`/p/${it.slug}`}
                    className="relative h-32 w-28 shrink-0 overflow-hidden rounded-3xl md:h-40 md:w-36"
                    style={{ backgroundColor: it.bg }}
                  >
                    {it.imageUrl && <Image src={it.imageUrl} alt={it.name} fill sizes="144px" className="object-contain" />}
                  </TLink>
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <TLink href={`/p/${it.slug}`} className="link-draw font-display text-base font-bold leading-snug md:text-lg">
                          {it.name}
                        </TLink>
                        {it.optionValue && <p className="mt-1 text-sm text-ink-mute">{it.optionValue}</p>}
                        <p className="mt-1 text-sm text-ink-mute">
                          <span className="num">{formatAmount(it.unitPrice)}</span> ر.س للقطعة
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(it.variantId)}
                        aria-label={`حذف ${it.name}`}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-mute transition-colors hover:bg-coral hover:text-paper"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <QtyStepper size="sm" qty={it.qty} max={maxOf(it.variantId)} onChange={(q) => setQty(it.variantId, q)} />
                      <span className="font-display text-lg font-extrabold">
                        <span className="num">{formatAmount(it.unitPrice * it.qty)}</span>{" "}
                        <span className="text-xs font-medium">ر.س</span>
                      </span>
                    </div>
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <TLink href="/shop" className="link-draw mt-6 inline-block text-sm font-semibold">
          → متابعة التسوق
        </TLink>
      </div>

      <aside className="h-fit rounded-tile bg-paper-card p-6 md:p-8 lg:sticky lg:top-[calc(var(--header-h)+1rem)]">
        <h2 className="t-h3 mb-5">ملخص الطلب</h2>
        <CouponBox quote={quote} />
        <div className={`mt-6 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {quote ? <Totals quote={quote} showShipping={false} /> : <div className="h-28 animate-pulse rounded-2xl bg-ink/5" />}
        </div>
        <p className="mt-3 text-xs text-ink-mute">الشحن يُحسب في الخطوة التالية.</p>
        <TLink href="/checkout" className="btn btn-ink mt-6 w-full !min-h-[3.6rem] !text-base">
          إتمام الطلب
          <ArrowLeft size={18} />
        </TLink>
      </aside>
    </div>
  );
}

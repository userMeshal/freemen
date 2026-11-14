"use client";

import Image from "next/image";
import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, Trash2, X } from "lucide-react";
import { TLink } from "./Transition";
import { lockScroll } from "./SmoothScroll";
import { cartCount, cartSubtotal, useCart } from "@/store/cart";
import { formatAmount } from "@/lib/money";
import { quoteCartAction } from "@/app/(site)/actions";

const EASE = [0.16, 1, 0.3, 1] as const;

export function QtyStepper({
  qty,
  onChange,
  max = 20,
  size = "md",
}: {
  qty: number;
  onChange: (q: number) => void;
  max?: number;
  size?: "sm" | "md";
}) {
  const h = size === "sm" ? "h-9" : "h-12";
  const w = size === "sm" ? "w-9" : "w-12";
  return (
    <div className={`inline-flex items-center rounded-full border-[1.5px] border-ink/15 ${h}`}>
      <button
        type="button"
        aria-label="إنقاص الكمية"
        onClick={() => onChange(qty - 1)}
        className={`grid ${h} ${w} place-items-center rounded-full transition-colors hover:bg-ink hover:text-paper active:scale-90`}
      >
        <Minus size={15} />
      </button>
      <span className="num min-w-7 text-center font-display text-sm font-bold" aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        aria-label="زيادة الكمية"
        disabled={qty >= max}
        onClick={() => onChange(qty + 1)}
        className={`grid ${h} ${w} place-items-center rounded-full transition-colors hover:bg-ink hover:text-paper active:scale-90 disabled:opacity-30`}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}

export function CartDrawer() {
  const isOpen = useCart((s) => s.isOpen);
  const close = useCart((s) => s.close);
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const sync = useCart((s) => s.sync);

  useEffect(() => {
    lockScroll(isOpen);
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    // مطابقة الأسعار والتوفر مع الخادم عند فتح السلة
    const current = useCart.getState().items;
    if (current.length) {
      quoteCartAction({ items: current.map((i) => ({ variantId: i.variantId, qty: i.qty })) })
        .then((q) => sync(q.lines.map((l) => ({ variantId: l.variantId, qty: l.qty, unitPrice: l.unitPrice }))))
        .catch(() => {});
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      lockScroll(false);
    };
  }, [isOpen, close, sync]);

  const count = cartCount(items);
  const subtotal = cartSubtotal(items);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="scrim"
            className="fixed inset-0 z-[100] bg-ink/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            onClick={close}
            aria-hidden
          />
          <motion.aside
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-label="سلة المشتريات"
            className="fixed inset-y-0 left-0 z-[101] flex w-[min(30rem,100vw)] flex-col bg-paper shadow-2xl md:inset-y-3 md:left-3 md:rounded-tile"
            initial={{ x: "-105%" }}
            animate={{ x: 0 }}
            exit={{ x: "-105%" }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <header className="flex items-center justify-between px-5 pb-3 pt-5 md:px-7">
              <h2 className="font-display text-2xl font-extrabold">
                سلّتك <span className="num t-accent text-xl font-normal text-ink-mute">({count})</span>
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="إغلاق السلة"
                className="grid h-11 w-11 place-items-center rounded-full bg-ink/5 transition-all duration-500 ease-expo hover:rotate-90 hover:bg-ink hover:text-paper"
              >
                <X size={20} />
              </button>
            </header>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
                <span dir="ltr" className="t-mega t-outline text-[5.5rem]" style={{ ["--stroke" as string]: "rgba(11,11,12,.25)" }}>
                  0
                </span>
                <p className="font-display text-xl font-bold">سلّتك فارغة</p>
                <p className="max-w-xs text-sm text-ink-mute">اختر لونك المفضل وابدأ من هنا.</p>
                <TLink href="/shop" onClick={close} className="btn btn-ink mt-2">
                  تصفّح المتجر
                </TLink>
              </div>
            ) : (
              <>
                <ul className="flex-1 space-y-3 overflow-y-auto px-5 py-2 md:px-7" data-lenis-prevent>
                  <AnimatePresence initial={false}>
                    {items.map((it, i) => (
                      <motion.li
                        key={it.variantId}
                        layout
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE, delay: 0.12 + i * 0.05 } }}
                        exit={{ opacity: 0, x: -60, transition: { duration: 0.3 } }}
                        className="flex gap-3.5"
                      >
                        <TLink
                          href={`/p/${it.slug}`}
                          onClick={close}
                          className="relative h-28 w-24 shrink-0 overflow-hidden rounded-2xl"
                          style={{ backgroundColor: it.bg }}
                        >
                          {it.imageUrl && (
                            <Image src={it.imageUrl} alt={it.name} fill sizes="96px" className="object-contain" />
                          )}
                        </TLink>
                        <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                          <div>
                            <TLink href={`/p/${it.slug}`} onClick={close} className="line-clamp-2 text-sm font-medium leading-snug">
                              {it.name}
                            </TLink>
                            {it.optionValue && <p className="mt-0.5 text-xs text-ink-mute">{it.optionValue}</p>}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <QtyStepper size="sm" qty={it.qty} onChange={(q) => setQty(it.variantId, q)} />
                            <span className="font-display text-sm font-bold">
                              <span className="num">{formatAmount(it.unitPrice * it.qty)}</span>{" "}
                              <span className="text-[0.65rem] font-medium">ر.س</span>
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(it.variantId)}
                          aria-label={`حذف ${it.name}`}
                          className="grid h-9 w-9 shrink-0 place-items-center self-start rounded-full text-ink-mute transition-colors hover:bg-coral hover:text-paper"
                        >
                          <Trash2 size={16} />
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>

                <footer className="pb-safe space-y-3 border-t border-line px-5 pt-4 md:px-7 md:pb-6">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-ink-mute">المجموع الفرعي</span>
                    <span className="font-display text-2xl font-extrabold">
                      <span className="num">{formatAmount(subtotal)}</span> <span className="text-sm font-medium">ر.س</span>
                    </span>
                  </div>
                  <p className="text-xs text-ink-mute">الأسعار شاملة الضريبة. الشحن والخصومات تُحسب في صفحة إتمام الطلب.</p>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <TLink href="/checkout" onClick={close} className="btn btn-ink">
                      إتمام الطلب
                    </TLink>
                    <TLink href="/cart" onClick={close} className="btn btn-ghost">
                      السلة
                    </TLink>
                  </div>
                </footer>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

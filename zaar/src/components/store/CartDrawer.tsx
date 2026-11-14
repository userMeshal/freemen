"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, ShieldCheck, ShoppingBag, Trash2, X } from "lucide-react";
import { Art } from "@/components/ui/Art";
import { lockScroll } from "@/components/ui/SmoothScroll";
import { formatAmount } from "@/lib/money";
import { cartCount, cartSubtotal, useCart } from "./cart";
import { SLink, useStore } from "./ctx";
import { useT } from "./ui";

const EASE = [0.16, 1, 0.3, 1] as const;

/** درج السلة — يفتح من أي صفحة. الإجمالي النهائي (شحن وكوبون) يُحسب في صفحة الدفع */
export function CartDrawer() {
  const { store } = useStore();
  const t = useT();
  const { items, isOpen, close, setQty, remove, init, hydrated } = useCart();
  const subtotal = cartSubtotal(items);
  const freeOver = store.settings.freeShippingOver;
  const left = freeOver > 0 ? Math.max(0, freeOver - subtotal) : 0;

  useEffect(() => init(store.slug), [init, store.slug]);
  useEffect(() => {
    lockScroll(isOpen);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      lockScroll(false);
    };
  }, [isOpen, close]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div className="fixed inset-0 z-[120] bg-black/45 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="سلة التسوق"
            data-lenis-prevent
            className="fixed inset-y-0 end-0 z-[130] flex w-full max-w-[440px] flex-col bg-paper text-ink shadow-2xl"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <header className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="font-display text-lg font-extrabold">
                السلة <span className="num text-sm font-semibold opacity-50">({hydrated ? cartCount(items) : 0})</span>
              </h2>
              <button type="button" onClick={close} aria-label="إغلاق" className="-me-2 grid h-11 w-11 place-items-center rounded-full hover:bg-ink/5">
                <X size={21} />
              </button>
            </header>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
                <span className="grid h-20 w-20 place-items-center rounded-full bg-ink/5">
                  <ShoppingBag size={30} strokeWidth={1.4} />
                </span>
                <p className="font-display text-lg font-bold">سلتك فاضية</p>
                <p className="text-sm text-ink/60">اختر اللي يعجبك ونكمل معك لين يوصل بابك.</p>
                <SLink href="/shop" onClick={close} className={t.btn}>
                  تصفّح المنتجات
                </SLink>
              </div>
            ) : (
              <>
                {freeOver > 0 && (
                  <div className="border-b border-line px-5 py-3 text-xs">
                    <p className="mb-2 font-medium">
                      {left > 0 ? (
                        <>
                          باقي <span className="num font-bold">{formatAmount(left)}</span> ر.س وتحصل شحن مجاني
                        </>
                      ) : (
                        "مبروك — شحنك مجاني"
                      )}
                    </p>
                    <div className="h-1.5 overflow-hidden rounded-full bg-ink/10">
                      <div className="h-full rounded-full bg-accent transition-[width] duration-700 ease-expo" style={{ width: `${Math.min(100, (subtotal / freeOver) * 100)}%` }} />
                    </div>
                  </div>
                )}
                <ul className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                  {items.map((i) => (
                    <li key={`${i.productId}:${i.optionValue}`} className="flex gap-3.5">
                      <SLink href={`/p/${i.slug}`} onClick={close} className="block h-24 w-20 shrink-0 overflow-hidden rounded-2xl">
                        <Art image={i.image} art={i.art} alt={i.name} />
                      </SLink>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <p className="line-clamp-2 text-sm font-medium leading-snug">{i.name}</p>
                        {i.optionValue && <p className="mt-0.5 text-xs text-ink/55">{i.optionValue}</p>}
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <div className="flex items-center rounded-full border border-line">
                            <button type="button" aria-label="إنقاص" className="grid h-8 w-8 place-items-center" onClick={() => setQty(i.productId, i.optionValue, i.qty - 1)}>
                              {i.qty === 1 ? <Trash2 size={13} /> : <Minus size={13} />}
                            </button>
                            <span className="num w-6 text-center text-sm font-semibold">{i.qty}</span>
                            <button type="button" aria-label="زيادة" className="grid h-8 w-8 place-items-center" onClick={() => setQty(i.productId, i.optionValue, i.qty + 1)}>
                              <Plus size={13} />
                            </button>
                          </div>
                          <span className="font-display text-sm font-bold">
                            <span className="num">{formatAmount(i.unitPrice * i.qty)}</span> <span className="text-xs font-medium">ر.س</span>
                          </span>
                        </div>
                      </div>
                      <button type="button" aria-label={`حذف ${i.name}`} className="sr-only" onClick={() => remove(i.productId, i.optionValue)} />
                    </li>
                  ))}
                </ul>
                <footer className="space-y-3 border-t border-line px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-ink/60">المجموع (شامل الضريبة)</span>
                    <span className="font-display text-xl font-extrabold">
                      <span className="num">{formatAmount(subtotal)}</span> <span className="text-sm font-medium">ر.س</span>
                    </span>
                  </div>
                  <SLink href="/checkout" onClick={close} className={t.btnBlock}>
                    إتمام الطلب
                  </SLink>
                  <p className="flex items-center justify-center gap-1.5 text-xs text-ink/55">
                    <ShieldCheck size={14} /> طلبك محمي بضمان زار — استرداد كامل إن لم يعجبك
                  </p>
                </footer>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

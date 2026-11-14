"use client";

import { useEffect, useRef, useState } from "react";
import { useCart } from "@/store/cart";
import { quoteCartAction } from "@/app/(site)/actions";
import type { CartQuote } from "@/lib/types";

/**
 * تسعير السلة من الخادم (المصدر الوحيد للأسعار والخصومات والشحن).
 * يعيد الحساب عند تغيّر البنود أو الكوبون أو الشحن أو طريقة الدفع، ويزامن السلة المحلية مع النتيجة.
 */
export function useCartQuote(opts: { shippingMethodId?: number | null; paymentMethod?: "edfapay" | "cod" | null } = {}) {
  const items = useCart((s) => s.items);
  const coupon = useCart((s) => s.coupon);
  const hydrated = useCart((s) => s.hydrated);
  const sync = useCart((s) => s.sync);
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const seq = useRef(0);

  const key = items.map((i) => `${i.variantId}:${i.qty}`).join(",");

  useEffect(() => {
    if (!hydrated) return;
    const id = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const q = await quoteCartAction({
          items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
          couponCode: coupon,
          shippingMethodId: opts.shippingMethodId ?? null,
          paymentMethod: opts.paymentMethod ?? null,
        });
        if (id !== seq.current) return;
        setQuote(q);
        if (q.removed.length || q.adjusted) {
          setNotice("تم تحديث سلتك لأن بعض المنتجات تغيّر توفرها.");
          sync(q.lines.map((l) => ({ variantId: l.variantId, qty: l.qty, unitPrice: l.unitPrice })));
        }
      } catch {
        if (id === seq.current) setNotice("تعذّر تحديث الأسعار. تحقق من اتصالك.");
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, key, coupon, opts.shippingMethodId, opts.paymentMethod]);

  return { quote, loading, notice, hydrated, empty: hydrated && items.length === 0 };
}

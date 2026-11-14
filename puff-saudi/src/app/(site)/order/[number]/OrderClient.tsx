"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { usePageTransition } from "@/components/site/Transition";
import { useCart } from "@/store/cart";
import { pixel } from "@/lib/pixels";
import { retryPaymentAction } from "../../checkout/actions";

/** عند أول عرض لطلب جديد: تفريغ السلة وإرسال حدث الشراء للبكسل (مرة واحدة فقط) */
export function OrderClient({
  isNew,
  number,
  total,
  items,
}: {
  isNew: boolean;
  number: string;
  total: number;
  items: { id: string | number; name: string; price: number; qty: number }[];
}) {
  const clear = useCart((s) => s.clear);
  const hydrated = useCart((s) => s.hydrated);
  useEffect(() => {
    if (!isNew || !hydrated) return;
    const key = `puff-purchase-${number}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {}
    clear();
    pixel.purchase(number, total, items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, hydrated, number]);
  return null;
}

export function RetryPayment({ number, token, errorHint }: { number: string; token: string; errorHint: boolean }) {
  const { navigate } = usePageTransition();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(errorHint ? "تعذّر الاتصال ببوابة الدفع. أعد المحاولة." : null);
  return (
    <div className="mt-6">
      <button
        type="button"
        disabled={pending}
        className="btn btn-ink !min-h-[3.6rem] !px-8"
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await retryPaymentAction({ number, token });
            if (res.ok) {
              if (res.external) window.location.href = res.redirect;
              else navigate(res.redirect);
            } else setError(res.error);
          })
        }
      >
        {pending && <Loader2 size={18} className="animate-spin" />} أكمل الدفع الآن
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-coral">
          {error}
        </p>
      )}
    </div>
  );
}

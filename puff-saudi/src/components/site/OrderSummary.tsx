"use client";

import { useState } from "react";
import { Tag, X } from "lucide-react";
import { useCart } from "@/store/cart";
import { formatAmount } from "@/lib/money";
import type { CartQuote } from "@/lib/types";

function Row({ label, value, strong = false, negative = false }: { label: string; value: number | string; strong?: boolean; negative?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? "font-display text-xl font-extrabold" : "text-sm"}`}>
      <span className={strong ? "" : "text-ink-mute"}>{label}</span>
      <span className={negative ? "text-coral" : ""}>
        {typeof value === "number" ? (
          <>
            {negative && "− "}
            <span className="num font-display font-bold">{formatAmount(value)}</span>{" "}
            <span className="text-[0.7em] font-medium">ر.س</span>
          </>
        ) : (
          value
        )}
      </span>
    </div>
  );
}

export function CouponBox({ quote }: { quote: CartQuote | null }) {
  const coupon = useCart((s) => s.coupon);
  const setCoupon = useCart((s) => s.setCoupon);
  const [code, setCode] = useState("");
  const apply = () => {
    const c = code.trim().toUpperCase();
    if (c) setCoupon(c);
  };

  if (coupon && quote?.coupon) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-lime/60 px-4 py-3 text-sm">
        <span className="flex items-center gap-2 font-semibold">
          <Tag size={16} />
          <span className="num">{quote.coupon.code}</span>
          <span className="font-normal">— {quote.coupon.label}</span>
        </span>
        <button type="button" onClick={() => setCoupon(null)} aria-label="إزالة الكوبون" className="grid h-7 w-7 place-items-center rounded-full hover:bg-ink hover:text-paper">
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* ليس <form> لأنه يُعرض داخل نموذج إتمام الطلب */}
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
          }}
          placeholder="كود الخصم"
          aria-label="كود الخصم"
          autoCapitalize="characters"
          autoComplete="off"
          dir="ltr"
          className="field !min-h-12 !py-2 text-end placeholder:text-start"
        />
        <button type="button" onClick={apply} className="btn btn-ghost !min-h-12 shrink-0 !px-5">
          تطبيق
        </button>
      </div>
      {coupon && quote?.couponError && (
        <p role="alert" className="mt-2 text-sm text-coral">
          {quote.couponError}
        </p>
      )}
    </div>
  );
}

export function Totals({ quote, showShipping = true }: { quote: CartQuote; showShipping?: boolean }) {
  return (
    <div className="space-y-2.5">
      <Row label="المجموع الفرعي" value={quote.subtotal} />
      {quote.discount > 0 && <Row label={`الخصم${quote.coupon ? ` (${quote.coupon.code})` : ""}`} value={quote.discount} negative />}
      {showShipping && (
        <Row label="الشحن" value={quote.shippingOptions.length === 0 ? "—" : quote.shipping === 0 ? "مجاني" : quote.shipping} />
      )}
      {quote.codFee > 0 && <Row label="رسوم الدفع عند الاستلام" value={quote.codFee} />}
      <div className="!mt-4 border-t border-ink/15 pt-4">
        <Row label="الإجمالي" value={quote.total} strong />
        {quote.vatRate > 0 && (
          <p className="mt-1.5 text-xs text-ink-mute">
            شامل ضريبة القيمة المضافة (<span className="num">{quote.vatRate}%</span>):{" "}
            <span className="num">{formatAmount(quote.vatAmount)}</span> ر.س
          </p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CreditCard, Loader2, Lock, ShieldCheck, Tag } from "lucide-react";
import { placeOrderAction, quoteAction, saveCartAction } from "@/app/s/[store]/actions";
import { Art } from "@/components/ui/Art";
import { CITIES } from "@/lib/cities";
import { formatAmount } from "@/lib/money";
import type { PaymentMethodId, PaymentOption, Quote } from "@/lib/types";
import { useCart } from "./cart";
import { SLink, useStore } from "./ctx";
import { track } from "./track";
import { PageTitle, useT } from "./ui";

const PAY_ICON: Record<PaymentMethodId, React.ReactNode> = {
  card: <CreditCard size={20} />,
  tabby: <span className="font-display text-xs font-black tracking-tight">tabby</span>,
  tamara: <span className="font-display text-xs font-black tracking-tight">tamara</span>,
};

export function CheckoutView() {
  const { store, guaranteeDays } = useStore();
  const t = useT();
  const { items, hydrated, init } = useCart();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [payments, setPayments] = useState<PaymentOption[]>([]);
  const [live, setLive] = useState(true);
  const [method, setMethod] = useState<PaymentMethodId>("card");
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [quoting, setQuoting] = useState(true);
  const form = useRef<HTMLFormElement>(null);
  const tracked = useRef(false);

  useEffect(() => init(store.slug), [init, store.slug]);

  const lines = items.map((i) => ({ productId: i.productId, optionValue: i.optionValue, qty: i.qty }));
  const linesKey = JSON.stringify(lines);

  const refresh = useCallback(
    async (code: string | null) => {
      setQuoting(true);
      const res = await quoteAction(store.slug, JSON.parse(linesKey), code);
      setQuoting(false);
      if (!res) return;
      setQuote(res.quote);
      setPayments(res.payments);
      setLive(res.live);
      setMethod((m) => (res.payments.some((p) => p.id === m) ? m : (res.payments[0]?.id ?? "card")));
      if (!tracked.current && res.quote.total > 0) {
        tracked.current = true;
        track.checkout(store.slug, res.quote.total);
      }
    },
    [store.slug, linesKey],
  );

  useEffect(() => {
    if (hydrated) void refresh(applied);
  }, [hydrated, refresh, applied]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !form.current) return;
    setError(null);
    setBusy(true);
    const f = new FormData(form.current);
    const res = await placeOrderAction(store.slug, {
      lines,
      couponCode: quote?.coupon?.code ?? null,
      method,
      name: f.get("name"),
      phone: f.get("phone"),
      email: f.get("email") ?? "",
      city: f.get("city"),
      address: f.get("address"),
      notes: f.get("notes") ?? "",
    });
    if (res.ok) {
      window.location.href = res.redirectUrl;
      return;
    }
    setBusy(false);
    setError(res.error);
    void refresh(applied);
  };

  const onPhoneBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const name = (form.current?.elements.namedItem("name") as HTMLInputElement | null)?.value ?? "";
    void saveCartAction(store.slug, { phone: e.target.value, name, lines });
  };

  if (hydrated && items.length === 0) {
    return (
      <div className={`${t.page} text-center`}>
        <PageTitle title="سلتك فاضية" />
        <SLink href="/shop" className={t.btn}>
          تصفّح المنتجات
        </SLink>
      </div>
    );
  }

  const available = quote?.lines.filter((l) => l.available) ?? [];
  const row = "flex items-baseline justify-between gap-4 text-sm";

  return (
    <div className={t.page}>
      <PageTitle eyebrow={store.name} title="إتمام الطلب" />
      {!live && <p className={`${t.error} mb-6`}>هذا المتجر في وضع المعاينة ولا يستقبل طلبات حقيقية حتى يُنشر.</p>}

      <form ref={form} onSubmit={submit} className="grid items-start gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-12">
        <div className="space-y-8">
          <section>
            <h2 className={t.h2}>بيانات الاستلام</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={t.label}>الاسم الكامل</span>
                <input name="name" required minLength={3} maxLength={60} autoComplete="name" className={t.input} />
              </label>
              <label className="block">
                <span className={t.label}>رقم الجوال</span>
                <input name="phone" required inputMode="tel" autoComplete="tel" placeholder="05XXXXXXXX" dir="ltr" className={`${t.input} text-end`} onBlur={onPhoneBlur} />
              </label>
              <label className="block">
                <span className={t.label}>المدينة</span>
                <select name="city" required defaultValue="" className={t.input}>
                  <option value="" disabled>
                    اختر المدينة
                  </option>
                  {CITIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={t.label}>البريد الإلكتروني (اختياري)</span>
                <input name="email" type="email" autoComplete="email" dir="ltr" className={`${t.input} text-end`} />
              </label>
              <label className="block sm:col-span-2">
                <span className={t.label}>العنوان</span>
                <input name="address" required minLength={8} maxLength={200} autoComplete="street-address" placeholder="الحي، الشارع، رقم المبنى — أو العنوان الوطني المختصر" className={t.input} />
              </label>
              <label className="block sm:col-span-2">
                <span className={t.label}>ملاحظات للمتجر (اختياري)</span>
                <textarea name="notes" rows={2} maxLength={300} className={t.input} />
              </label>
            </div>
          </section>

          <section>
            <h2 className={t.h2}>طريقة الدفع</h2>
            {payments.length === 0 && !quoting ? (
              <p className={`${t.error} mt-4`}>الدفع الإلكتروني غير مفعّل على المنصة حاليًا.</p>
            ) : (
              <div className="mt-4 grid gap-3" role="radiogroup" aria-label="طريقة الدفع">
                {payments.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={method === p.id}
                    onClick={() => setMethod(p.id)}
                    className={`flex items-center gap-4 rounded-3xl border-[1.5px] px-5 py-4 text-start transition-colors ${method === p.id ? "border-ink bg-ink/[0.04]" : "border-ink/15 hover:border-ink/40"}`}
                  >
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${method === p.id ? "border-ink" : "border-ink/30"}`}>
                      {method === p.id && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-semibold">{p.label}</span>
                      <span className={`block text-xs ${t.muted}`}>
                        {p.note}
                        {p.test && " — وضع تجريبي"}
                      </span>
                    </span>
                    <span className="grid h-9 min-w-14 place-items-center rounded-xl bg-ink/[0.06] px-2">{PAY_ICON[p.id]}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ملخص الطلب */}
        <aside className={`${t.panel} lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]`}>
          <h2 className={t.h2}>ملخص الطلب</h2>
          <ul className="mt-4 space-y-3.5">
            {(quote?.lines ?? []).map((l) => (
              <li key={`${l.productId}:${l.optionValue}`} className={`flex items-center gap-3 ${l.available ? "" : "opacity-40"}`}>
                <span className="relative block h-16 w-14 shrink-0 overflow-hidden rounded-xl">
                  <Art image={l.image} art={l.art} alt="" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 block text-sm font-medium">{l.name}</span>
                  <span className={`block text-xs ${t.muted}`}>
                    {l.optionValue ? `${l.optionValue} · ` : ""}
                    {l.available ? <>الكمية <span className="num">{l.qty}</span></> : "غير متوفر"}
                  </span>
                </span>
                <span className="num text-sm font-semibold">{formatAmount(l.lineTotal)}</span>
              </li>
            ))}
            {!quote && <li className="z-skeleton h-16 rounded-xl" />}
          </ul>

          <div className="mt-5 flex gap-2">
            <label className="relative flex-1">
              <Tag size={15} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 opacity-40" />
              <input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="كود الخصم" aria-label="كود الخصم" dir="ltr" className={`${t.input} !pr-10 text-end`} maxLength={24} />
            </label>
            <button type="button" className={t.btnGhost} disabled={!coupon.trim()} onClick={() => setApplied(coupon.trim())}>
              تطبيق
            </button>
          </div>
          {quote?.couponError && applied && <p className="mt-2 text-xs font-medium text-coral">{quote.couponError}</p>}
          {quote?.coupon && <p className="mt-2 text-xs font-semibold text-emerald-600">تم تطبيق {quote.coupon.code} — {quote.coupon.label}</p>}

          <dl className="mt-5 space-y-2.5 border-t border-ink/10 pt-5">
            <div className={row}>
              <dt className={t.muted}>المجموع الفرعي</dt>
              <dd className="num">{formatAmount(quote?.subtotal ?? 0)} ر.س</dd>
            </div>
            {quote && quote.discount > 0 && (
              <div className={row}>
                <dt className={t.muted}>الخصم</dt>
                <dd className="num text-emerald-600">−{formatAmount(quote.discount)} ر.س</dd>
              </div>
            )}
            <div className={row}>
              <dt className={t.muted}>الشحن</dt>
              <dd className="num">{quote && quote.shipping === 0 ? "مجاني" : `${formatAmount(quote?.shipping ?? 0)} ر.س`}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-ink/10 pt-3">
              <dt className="font-semibold">الإجمالي</dt>
              <dd className="font-display text-2xl font-extrabold">
                <span className="num">{formatAmount(quote?.total ?? 0)}</span> <span className="text-sm font-medium">ر.س</span>
              </dd>
            </div>
            <p className={`text-xs ${t.muted}`}>
              شامل ضريبة القيمة المضافة (<span className="num">{formatAmount(quote?.vat ?? 0)}</span> ر.س)
            </p>
          </dl>

          {error && (
            <p role="alert" className={`${t.error} mt-4`}>
              {error}
            </p>
          )}
          <button type="submit" disabled={busy || quoting || !available.length || !payments.length || !live} className={`${t.btnBlock} mt-5 disabled:opacity-50`}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Lock size={16} />}
            {busy ? "جارٍ تحويلك للدفع…" : "ادفع الآن"}
          </button>
          <p className={`mt-4 flex items-start gap-2 text-xs leading-relaxed ${t.muted}`}>
            <ShieldCheck size={16} className="mt-0.5 shrink-0" />
            <span>
              طلبك محمي <SLink href="/pages/guarantee" className="font-semibold underline underline-offset-2">بضمان زار</SLink>: إن لم يصلك أو لم يطابق الوصف تسترد مبلغك كاملًا حتى {guaranteeDays} يومًا بعد الاستلام.
            </span>
          </p>
        </aside>
      </form>
    </div>
  );
}

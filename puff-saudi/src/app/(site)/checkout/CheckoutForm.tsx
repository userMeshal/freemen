"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { motion } from "motion/react";
import { CreditCard, Loader2, Lock, Wallet } from "lucide-react";
import { TLink, usePageTransition } from "@/components/site/Transition";
import { CouponBox, Totals } from "@/components/site/OrderSummary";
import { useCartQuote } from "@/components/site/useCartQuote";
import { useCart } from "@/store/cart";
import { pixel } from "@/lib/pixels";
import { formatAmount } from "@/lib/money";
import { SAUDI_CITIES } from "@/lib/cities";
import { placeOrderAction } from "./actions";

const EASE = [0.16, 1, 0.3, 1] as const;

type Prefill = { name: string; phone: string; email: string; city: string; district: string; street: string };

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: EASE, delay: 0.1 + n * 0.08 }}
      className="border-t border-line py-8"
    >
      <h2 className="mb-6 flex items-center gap-3 font-display text-xl font-extrabold">
        <span className="num grid h-8 w-8 place-items-center rounded-full bg-ink text-sm text-lime">{n}</span>
        {title}
      </h2>
      {children}
    </motion.section>
  );
}

function Field({
  label,
  name,
  error,
  children,
  hint,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={`f-${name}`} className="label">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-sm text-coral">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-mute">{hint}</p>
      ) : null}
    </div>
  );
}

export function CheckoutForm({ prefill }: { prefill: Prefill }) {
  const { navigate } = usePageTransition();
  const items = useCart((s) => s.items);
  const coupon = useCart((s) => s.coupon);
  const [shippingMethodId, setShippingMethodId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"edfapay" | "cod" | null>(null);
  const { quote, loading, notice, hydrated, empty } = useCartQuote({ shippingMethodId, paymentMethod });
  const [form, setForm] = useState(prefill);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [redirecting, setRedirecting] = useState(false);
  const tracked = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  // اختيارات افتراضية بعد أول تسعير
  useEffect(() => {
    if (!quote) return;
    if (shippingMethodId === null && quote.shippingMethodId) setShippingMethodId(quote.shippingMethodId);
    if (paymentMethod === null) {
      if (quote.payment.edfapay) setPaymentMethod("edfapay");
      else if (quote.payment.cod) setPaymentMethod("cod");
    }
    if (!tracked.current && quote.lines.length) {
      tracked.current = true;
      pixel.initiateCheckout(quote.lines.map((l) => ({ id: l.productId, name: l.name, price: l.unitPrice, qty: l.qty })));
    }
  }, [quote, shippingMethodId, paymentMethod]);

  const set = (k: keyof Prefill) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: "" }));
  };

  if (!hydrated) return <div className="h-[50vh] animate-pulse rounded-tile bg-ink/5" />;
  if (empty && !redirecting) {
    return (
      <div className="border-t border-line py-24 text-center">
        <p className="t-h3">سلّتك فارغة</p>
        <p className="mt-2 text-ink-mute">أضف منتجات إلى السلة لإتمام الطلب.</p>
        <TLink href="/shop" className="btn btn-ink mt-7">
          تصفّح المتجر
        </TLink>
      </div>
    );
  }

  const noPayment = quote ? !quote.payment.edfapay && !quote.payment.cod : false;
  const noShipping = quote ? quote.shippingOptions.length === 0 : false;
  const busy = pending || redirecting;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quote || !shippingMethodId || !paymentMethod || busy) return;
    setError(null);
    pixel.addPaymentInfo(quote.total);
    start(async () => {
      const res = await placeOrderAction({
        items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
        expectedTotal: quote.total,
        couponCode: quote.coupon ? coupon : null,
        shippingMethodId,
        paymentMethod,
        ...form,
        note,
      }).catch(() => ({ ok: false as const, error: "تعذّر الاتصال. تحقق من الإنترنت ثم أعد المحاولة." }));
      if (res.ok) {
        setRedirecting(true);
        if (res.external) window.location.href = res.redirect;
        else navigate(res.redirect);
        return;
      }
      setError(res.error);
      const fe = "fieldErrors" in res ? res.fieldErrors : undefined;
      if (fe) {
        setErrors(fe);
        const first = Object.keys(fe)[0];
        formRef.current?.querySelector<HTMLElement>(`#f-${first}`)?.focus();
      } else window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:gap-16">
      <div>
        {(error || notice) && (
          <p role="alert" className={`mb-6 rounded-2xl px-4 py-3 text-sm ${error ? "bg-coral/15 text-[#a3200a]" : "bg-lime/60"}`}>
            {error ?? notice}
          </p>
        )}

        <Section n={1} title="بياناتك">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="الاسم الكامل" name="name" error={errors.name}>
              <input id="f-name" className="field" value={form.name} onChange={set("name")} autoComplete="name" required aria-invalid={!!errors.name} />
            </Field>
            <Field label="رقم الجوال" name="phone" error={errors.phone} hint="للتواصل بخصوص التوصيل">
              <input
                id="f-phone"
                className="field text-end"
                dir="ltr"
                inputMode="tel"
                placeholder="05XXXXXXXX"
                value={form.phone}
                onChange={set("phone")}
                autoComplete="tel"
                required
                aria-invalid={!!errors.phone}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="البريد الإلكتروني" name="email" error={errors.email} hint="لإرسال تفاصيل الطلب وإيصال الدفع">
                <input
                  id="f-email"
                  className="field text-end"
                  dir="ltr"
                  type="email"
                  inputMode="email"
                  placeholder="name@example.com"
                  value={form.email}
                  onChange={set("email")}
                  autoComplete="email"
                  required
                  aria-invalid={!!errors.email}
                />
              </Field>
            </div>
          </div>
        </Section>

        <Section n={2} title="عنوان التوصيل">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="المدينة" name="city" error={errors.city}>
              <input
                id="f-city"
                className="field"
                list="cities"
                value={form.city}
                onChange={set("city")}
                placeholder="اختر أو اكتب المدينة"
                autoComplete="address-level2"
                required
                aria-invalid={!!errors.city}
              />
              <datalist id="cities">
                {SAUDI_CITIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="الحي" name="district" error={errors.district}>
              <input id="f-district" className="field" value={form.district} onChange={set("district")} autoComplete="address-level3" required aria-invalid={!!errors.district} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="الشارع ووصف العنوان" name="street" error={errors.street} hint="اسم الشارع، رقم المبنى، أو العنوان الوطني المختصر">
                <input id="f-street" className="field" value={form.street} onChange={set("street")} autoComplete="street-address" required aria-invalid={!!errors.street} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="f-note" className="label">
                ملاحظات للطلب <span className="font-normal text-ink-mute">(اختياري)</span>
              </label>
              <textarea id="f-note" className="field min-h-24 resize-y" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
        </Section>

        <Section n={3} title="الشحن">
          {noShipping ? (
            <p className="rounded-2xl bg-coral/15 px-4 py-3 text-sm text-[#a3200a]">لا توجد طريقة شحن متاحة حاليًا. تواصل معنا لإتمام طلبك.</p>
          ) : (
            <div className="space-y-2.5" role="radiogroup" aria-label="طريقة الشحن">
              {(quote?.shippingOptions ?? []).map((m) => {
                const active = shippingMethodId === m.id;
                return (
                  <label
                    key={m.id}
                    className={`flex cursor-pointer items-center gap-4 rounded-2xl border-[1.5px] p-4 transition-colors duration-300 ${
                      active ? "border-ink bg-paper-card" : "border-ink/15 hover:border-ink/40"
                    }`}
                  >
                    <input type="radio" name="shipping" className="h-5 w-5 accent-[#0B0B0C]" checked={active} onChange={() => setShippingMethodId(m.id)} />
                    <span className="flex-1">
                      <span className="block font-semibold">{m.name}</span>
                      {m.description && <span className="mt-0.5 block text-sm text-ink-mute">{m.description}</span>}
                      {m.freeAbove !== null && m.effectivePrice > 0 && (
                        <span className="mt-0.5 block text-xs text-ink-mute">
                          شحن مجاني للطلبات فوق <span className="num">{formatAmount(m.freeAbove)}</span> ر.س
                        </span>
                      )}
                    </span>
                    <span className="font-display font-bold">
                      {m.effectivePrice === 0 ? "مجاني" : (
                        <>
                          <span className="num">{formatAmount(m.effectivePrice)}</span> <span className="text-xs font-medium">ر.س</span>
                        </>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </Section>

        <Section n={4} title="الدفع">
          {noPayment ? (
            <p className="rounded-2xl bg-coral/15 px-4 py-3 text-sm text-[#a3200a]">
              لا توجد وسيلة دفع مفعّلة حاليًا. يرجى المحاولة لاحقًا أو التواصل معنا.
            </p>
          ) : (
            <div className="space-y-2.5" role="radiogroup" aria-label="طريقة الدفع">
              {quote?.payment.edfapay && (
                <label
                  className={`flex cursor-pointer items-start gap-4 rounded-2xl border-[1.5px] p-4 transition-colors duration-300 ${
                    paymentMethod === "edfapay" ? "border-ink bg-paper-card" : "border-ink/15 hover:border-ink/40"
                  }`}
                >
                  <input type="radio" name="payment" className="mt-1 h-5 w-5 accent-[#0B0B0C]" checked={paymentMethod === "edfapay"} onChange={() => setPaymentMethod("edfapay")} />
                  <span className="flex-1">
                    <span className="flex items-center gap-2 font-semibold">
                      <CreditCard size={18} /> دفع إلكتروني آمن
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {["مدى", "VISA", "Mastercard", "Apple Pay"].map((m) => (
                        <span key={m} className="rounded-md border border-ink/20 px-2 py-1 font-display text-[0.62rem] font-semibold">
                          {m}
                        </span>
                      ))}
                    </span>
                    <span className="mt-2 block text-xs text-ink-mute">ستنتقل إلى صفحة الدفع الآمنة لدى EdfaPay لإتمام العملية.</span>
                  </span>
                </label>
              )}
              {quote?.payment.cod && (
                <label
                  className={`flex cursor-pointer items-start gap-4 rounded-2xl border-[1.5px] p-4 transition-colors duration-300 ${
                    paymentMethod === "cod" ? "border-ink bg-paper-card" : "border-ink/15 hover:border-ink/40"
                  }`}
                >
                  <input type="radio" name="payment" className="mt-1 h-5 w-5 accent-[#0B0B0C]" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} />
                  <span className="flex-1">
                    <span className="flex items-center gap-2 font-semibold">
                      <Wallet size={18} /> الدفع عند الاستلام
                    </span>
                    {quote.payment.codFee > 0 && (
                      <span className="mt-1 block text-xs text-ink-mute">
                        تُضاف رسوم <span className="num">{formatAmount(quote.payment.codFee)}</span> ر.س
                      </span>
                    )}
                  </span>
                </label>
              )}
            </div>
          )}
        </Section>
      </div>

      {/* الملخص */}
      <motion.aside
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: EASE, delay: 0.25 }}
        className="h-fit rounded-tile bg-paper-card p-6 md:p-8 lg:sticky lg:top-[calc(var(--header-h)+1rem)]"
      >
        <h2 className="t-h3 mb-5">طلبك</h2>
        <ul className="mb-6 max-h-[18rem] space-y-3 overflow-y-auto pe-1" data-lenis-prevent>
          {(quote?.lines ?? []).map((l) => (
            <li key={l.variantId} className="flex items-center gap-3">
              <span className="relative h-16 w-14 shrink-0 overflow-hidden rounded-xl" style={{ backgroundColor: l.bg }}>
                {l.imageUrl && <Image src={l.imageUrl} alt="" fill sizes="56px" className="object-contain" />}
                <span className="num absolute -end-0 -top-0 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[0.62rem] font-bold text-lime">
                  {l.qty}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 text-sm font-medium">{l.name}</span>
                {l.optionValue && <span className="block text-xs text-ink-mute">{l.optionValue}</span>}
              </span>
              <span className="num font-display text-sm font-bold">{formatAmount(l.total)}</span>
            </li>
          ))}
        </ul>
        <CouponBox quote={quote} />
        <div className={`mt-6 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {quote ? <Totals quote={quote} /> : <div className="h-32 animate-pulse rounded-2xl bg-ink/5" />}
        </div>
        <button
          type="submit"
          disabled={!quote || loading || busy || noPayment || noShipping || !paymentMethod}
          className="btn btn-ink mt-6 w-full !min-h-[3.8rem] !text-base"
        >
          {busy ? (
            <>
              <Loader2 size={18} className="animate-spin" /> {redirecting ? "جارٍ التحويل…" : "جارٍ إنشاء الطلب…"}
            </>
          ) : paymentMethod === "cod" ? (
            "تأكيد الطلب"
          ) : (
            <>
              <Lock size={17} /> ادفع الآن{quote ? <> — <span className="num">{formatAmount(quote.total)}</span> ر.س</> : null}
            </>
          )}
        </button>
        <p className="mt-3 text-center text-xs leading-relaxed text-ink-mute">
          بإتمام الطلب أنت توافق على{" "}
          <TLink href="/pages/terms" className="underline">
            شروط الخدمة
          </TLink>{" "}
          و
          <TLink href="/pages/returns" className="underline">
            سياسة الاسترداد
          </TLink>
          .
        </p>
      </motion.aside>
    </form>
  );
}

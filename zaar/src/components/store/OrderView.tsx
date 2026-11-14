"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Loader2, PackageCheck, ShieldCheck, Star, Truck, XCircle } from "lucide-react";
import { openClaimAction, refreshPaymentAction, retryPaymentAction, reviewAction } from "@/app/s/[store]/actions";
import { Art } from "@/components/ui/Art";
import { formatAmount } from "@/lib/money";
import type { OrderEvent, PaymentOption, ProductArt } from "@/lib/types";
import { useCart } from "./cart";
import { SLink, useStore } from "./ctx";
import { track } from "./track";
import { PageTitle, useT } from "./ui";

type OrderDTO = {
  number: string;
  token: string;
  status: string;
  statusLabel: string;
  paymentStatus: string;
  paymentMethod: string;
  customerName: string;
  city: string;
  address: string;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  vat: number;
  shippingCompany: string;
  trackingNumber: string;
  createdAt: string;
  events: OrderEvent[];
};
type ItemDTO = { id: number; productId: number | null; name: string; optionValue: string | null; unitPrice: number; qty: number; image: string | null; art: ProductArt };
type ClaimDTO = { status: string; reason: string; resolution: string; merchantReply: string; refundState: string } | null;

const STEPS = [
  { key: "paid", label: "تم الدفع", icon: Check },
  { key: "processing", label: "قيد التجهيز", icon: Clock },
  { key: "shipped", label: "تم الشحن", icon: Truck },
  { key: "delivered", label: "تم التوصيل", icon: PackageCheck },
];
const ORDER = ["paid", "processing", "shipped", "delivered"];

const fmt = (iso: string) => new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { timeZone: "Asia/Riyadh", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export function OrderView({
  order,
  items,
  claim,
  canClaim,
  claimBlocked,
  guaranteeEnds,
  claimReasons,
  reviewed,
  payments,
  guaranteeDays,
  replyHours,
}: {
  order: OrderDTO;
  items: ItemDTO[];
  claim: ClaimDTO;
  canClaim: boolean;
  claimBlocked: string;
  guaranteeEnds: string | null;
  claimReasons: Record<string, string>;
  reviewed: (number | null)[];
  payments: PaymentOption[];
  guaranteeDays: number;
  replyHours: number;
}) {
  const { store } = useStore();
  const t = useT();
  const router = useRouter();
  const clear = useCart((s) => s.clear);
  const initCart = useCart((s) => s.init);
  const pending = order.status === "pending_payment";
  const stage = ORDER.indexOf(order.status);
  const polls = useRef(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // عند نجاح الدفع: نفرّغ السلة ونرسل حدث الشراء للبكسلات مرة واحدة
  useEffect(() => {
    if (order.paymentStatus !== "paid") return;
    try {
      const key = `zaar-purchased:${order.number}`;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, "1");
        initCart(store.slug);
        clear();
        track.purchase(order.number, order.total);
      }
    } catch {}
  }, [order.paymentStatus, order.number, order.total, store.slug, clear, initCart]);

  // إشعار البوابة قد يتأخر ثوانٍ: نستعلم بضع مرات ثم نتوقف
  useEffect(() => {
    if (!pending) return;
    const id = setInterval(async () => {
      if (++polls.current > 12) return clearInterval(id);
      const r = await refreshPaymentAction(store.slug, order.number, order.token);
      if (r === "paid") {
        clearInterval(id);
        router.refresh();
      }
    }, 3500);
    return () => clearInterval(id);
  }, [pending, store.slug, order.number, order.token, router]);

  const retry = async (method: string) => {
    setBusy(true);
    setErr(null);
    const r = await retryPaymentAction(store.slug, order.number, order.token, method);
    if (r.ok) window.location.href = r.redirectUrl;
    else {
      setBusy(false);
      setErr(r.error);
    }
  };

  return (
    <div className={t.page}>
      <PageTitle eyebrow={`طلب رقم ${order.number}`} title={order.paymentStatus === "paid" && stage <= 0 ? `شكرًا ${order.customerName.split(" ")[0]} — وصلنا طلبك` : order.statusLabel}>
        <p className={`mt-3 text-sm ${t.muted}`}>{fmt(order.createdAt)}</p>
      </PageTitle>

      <div className="grid items-start gap-8 lg:grid-cols-[1.3fr_1fr] lg:gap-12">
        <div className="space-y-6">
          {pending && (
            <section className={t.panel}>
              <h2 className={`${t.h2} flex items-center gap-2`}>
                <Loader2 size={18} className="animate-spin" /> بانتظار تأكيد الدفع
              </h2>
              <p className={`mt-2 text-sm leading-relaxed ${t.muted}`}>إذا أكملت الدفع بتتحدث الصفحة تلقائيًا خلال ثوانٍ. وإذا ما اكتمل، تقدر تعيد المحاولة:</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {payments.map((p) => (
                  <button key={p.id} type="button" disabled={busy} onClick={() => retry(p.id)} className={t.btnGhost}>
                    ادفع بـ {p.id === "card" ? "البطاقة" : p.label}
                  </button>
                ))}
              </div>
              {err && <p className={`${t.error} mt-3`}>{err}</p>}
            </section>
          )}

          {stage >= 0 && (
            <section className={t.panel} aria-label="حالة الطلب">
              <ol className="grid grid-cols-4 gap-2">
                {STEPS.map((s, i) => {
                  const done = i <= stage;
                  return (
                    <li key={s.key} className="relative flex flex-col items-center gap-2 text-center">
                      {i > 0 && <span className={`absolute end-1/2 top-5 h-0.5 w-full ${done ? "bg-ink" : "bg-ink/15"}`} aria-hidden />}
                      <span className={`relative grid h-10 w-10 place-items-center rounded-full transition-colors ${done ? "bg-ink text-paper" : "bg-paper text-ink/35 ring-1 ring-ink/15"}`}>
                        <s.icon size={17} />
                      </span>
                      <span className={`text-xs font-medium ${done ? "" : "opacity-45"}`}>{s.label}</span>
                    </li>
                  );
                })}
              </ol>
              {order.trackingNumber && (
                <p className="mt-5 rounded-2xl bg-ink/[0.05] px-4 py-3 text-sm">
                  شُحن مع <strong>{order.shippingCompany || "شركة الشحن"}</strong> — رقم التتبع: <span className="num font-semibold" dir="ltr">{order.trackingNumber}</span>
                </p>
              )}
            </section>
          )}

          {(order.status === "cancelled" || order.status === "refunded") && (
            <section className={`${t.panel} flex items-start gap-3`}>
              <XCircle size={22} className="mt-0.5 shrink-0 text-coral" />
              <div>
                <h2 className="font-semibold">{order.status === "refunded" ? "تم استرداد مبلغ الطلب" : "أُلغي الطلب"}</h2>
                <p className={`mt-1 text-sm ${t.muted}`}>
                  {order.status === "refunded" ? "يرجع المبلغ لوسيلة الدفع نفسها خلال 3 إلى 10 أيام عمل بحسب البنك." : "لم يكتمل الدفع خلال المهلة فأُلغي الطلب. تقدر تطلب من جديد."}
                </p>
              </div>
            </section>
          )}

          <section className={t.panel}>
            <h2 className={t.h2}>المنتجات</h2>
            <ul className="mt-4 divide-y divide-ink/10">
              {items.map((i) => (
                <li key={i.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3.5">
                    <span className="block h-[4.5rem] w-16 shrink-0 overflow-hidden rounded-xl">
                      <Art image={i.image} art={i.art} alt="" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{i.name}</span>
                      <span className={`block text-xs ${t.muted}`}>
                        {i.optionValue ? `${i.optionValue} · ` : ""}الكمية <span className="num">{i.qty}</span>
                      </span>
                    </span>
                    <span className="num text-sm font-semibold">{formatAmount(i.unitPrice * i.qty)} ر.س</span>
                  </div>
                  {order.status === "delivered" && i.productId && !reviewed.includes(i.productId) && <ReviewForm productId={i.productId} order={order} />}
                  {order.status === "delivered" && i.productId && reviewed.includes(i.productId) && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                      <Check size={13} /> شكرًا على تقييمك
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {order.paymentStatus !== "unpaid" && (
            <GuaranteeBox order={order} claim={claim} canClaim={canClaim} claimBlocked={claimBlocked} guaranteeEnds={guaranteeEnds} reasons={claimReasons} guaranteeDays={guaranteeDays} replyHours={replyHours} />
          )}
        </div>

        <aside className={`${t.panel} lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]`}>
          <h2 className={t.h2}>الملخص</h2>
          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className={t.muted}>المجموع الفرعي</dt>
              <dd className="num">{formatAmount(order.subtotal)} ر.س</dd>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between gap-4">
                <dt className={t.muted}>الخصم</dt>
                <dd className="num">−{formatAmount(order.discount)} ر.س</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className={t.muted}>الشحن</dt>
              <dd className="num">{order.shipping ? `${formatAmount(order.shipping)} ر.س` : "مجاني"}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-ink/10 pt-3">
              <dt className="font-semibold">الإجمالي</dt>
              <dd className="font-display text-xl font-extrabold">
                <span className="num">{formatAmount(order.total)}</span> <span className="text-xs font-medium">ر.س</span>
              </dd>
            </div>
          </dl>
          <div className="mt-5 border-t border-ink/10 pt-4 text-sm">
            <p className={`text-xs ${t.muted}`}>التوصيل إلى</p>
            <p className="mt-1 font-medium">{order.customerName}</p>
            <p className={t.muted}>
              {order.city} — {order.address}
            </p>
          </div>
          {order.events.length > 0 && (
            <ol className="mt-5 space-y-3 border-t border-ink/10 pt-4">
              {[...order.events].reverse().map((e, i) => (
                <li key={i} className="flex gap-3 text-xs">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${i === 0 ? "bg-ink" : "bg-ink/25"}`} />
                  <span>
                    <span className="block font-medium">{e.note}</span>
                    <span className={t.muted}>{fmt(e.at)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
          <SLink href="/shop" className={`${t.btnGhost} mt-6 w-full`}>
            متابعة التسوق
          </SLink>
        </aside>
      </div>
    </div>
  );
}

const CLAIM_STATUS: Record<string, { label: string; text: string }> = {
  open: { label: "قيد المراجعة", text: "وصل طلبك للمتجر. إن لم يرد خلال المهلة يُعتمد الاسترداد تلقائيًا." },
  merchant_replied: { label: "تحت نظر فريق زار", text: "المتجر اعترض على الطلب، وفريق زار يراجع الحالة وسيحسمها." },
  approved: { label: "تمت الموافقة على الاسترداد", text: "يرجع المبلغ كاملًا لوسيلة الدفع نفسها خلال 3 إلى 10 أيام عمل." },
  rejected: { label: "لم تتم الموافقة", text: "" },
};

function GuaranteeBox({
  order,
  claim,
  canClaim,
  claimBlocked,
  guaranteeEnds,
  reasons,
  guaranteeDays,
  replyHours,
}: {
  order: OrderDTO;
  claim: ClaimDTO;
  canClaim: boolean;
  claimBlocked: string;
  guaranteeEnds: string | null;
  reasons: Record<string, string>;
  guaranteeDays: number;
  replyHours: number;
}) {
  const { store } = useStore();
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await openClaimAction(store.slug, order.number, order.token, reason, details);
    setBusy(false);
    if (r.ok) router.refresh();
    else setErr(r.error ?? "تعذّر إرسال الطلب");
  };

  return (
    <section className={t.panel} id="guarantee">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent text-on-accent">
          <ShieldCheck size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-extrabold">ضمان زار</h2>
          {claim ? (
            <>
              <p className="mt-1 text-sm font-semibold">{CLAIM_STATUS[claim.status]?.label}</p>
              <p className={`mt-1 text-sm leading-relaxed ${t.muted}`}>
                {claim.status === "rejected" ? claim.resolution : CLAIM_STATUS[claim.status]?.text}
              </p>
              <p className={`mt-2 text-xs ${t.muted}`}>سبب الطلب: {claim.reason}</p>
            </>
          ) : canClaim ? (
            <>
              <p className={`mt-1 text-sm leading-relaxed ${t.muted}`}>
                طلبك مضمون: إن لم يصلك أو لم يطابق الوصف تسترد مبلغك كاملًا
                {guaranteeEnds ? <> — الضمان ساري حتى {fmt(guaranteeEnds)}.</> : <> حتى {guaranteeDays} يومًا بعد الاستلام.</>}
              </p>
              {!open ? (
                <button type="button" onClick={() => setOpen(true)} className={`${t.btnGhost} mt-4`}>
                  اطلب استرداد المبلغ
                </button>
              ) : (
                <form onSubmit={submit} className="mt-4 space-y-3">
                  <label className="block">
                    <span className={t.label}>سبب الاسترداد</span>
                    <select required value={reason} onChange={(e) => setReason(e.target.value)} className={t.input}>
                      <option value="" disabled>
                        اختر السبب
                      </option>
                      {Object.entries(reasons).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className={t.label}>اشرح لنا وش صار (اختياري)</span>
                    <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={1000} className={t.input} />
                  </label>
                  {err && <p className={t.error}>{err}</p>}
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" disabled={busy || !reason} className={`${t.btn} disabled:opacity-50`}>
                      {busy && <Loader2 size={16} className="animate-spin" />} أرسل طلب الاسترداد
                    </button>
                    <button type="button" onClick={() => setOpen(false)} className={t.btnGhost}>
                      تراجع
                    </button>
                  </div>
                  <p className={`text-xs ${t.muted}`}>المتجر يرد خلال {replyHours} ساعة. إن لم يرد يُعتمد استردادك تلقائيًا، وإن اعترض يحسم فريق زار.</p>
                </form>
              )}
            </>
          ) : (
            <p className={`mt-1 text-sm ${t.muted}`}>{claimBlocked}</p>
          )}
        </div>
      </div>
    </section>
  );
}

function ReviewForm({ productId, order }: { productId: number; order: OrderDTO }) {
  const { store } = useStore();
  const t = useT();
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const send = async () => {
    setBusy(true);
    setErr(null);
    const r = await reviewAction(store.slug, order.number, order.token, productId, rating, body);
    setBusy(false);
    if (r.ok) router.refresh();
    else setErr(r.error ?? "تعذّر الإرسال");
  };
  return (
    <div className="mt-3 rounded-2xl bg-ink/[0.04] p-3.5">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium">قيّم المنتج:</span>
        <span className="flex gap-1" role="radiogroup" aria-label="التقييم">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} نجوم`} onClick={() => setRating(n)}>
              <Star size={22} className={n <= rating ? "fill-amber-400 text-amber-400" : "text-ink/25"} />
            </button>
          ))}
        </span>
      </div>
      {rating > 0 && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input value={body} onChange={(e) => setBody(e.target.value)} maxLength={600} placeholder="اكتب رأيك (اختياري)" className={`${t.input} flex-1`} />
          <button type="button" disabled={busy} onClick={send} className={t.btn}>
            {busy && <Loader2 size={16} className="animate-spin" />} أرسل التقييم
          </button>
        </div>
      )}
      {err && <p className="mt-2 text-xs text-coral">{err}</p>}
    </div>
  );
}

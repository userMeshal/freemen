import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Check, CreditCard, MapPin, Package, Truck } from "lucide-react";
import { getCustomer } from "@/lib/auth";
import { formatAmount } from "@/lib/money";
import { displayPhone } from "@/lib/normalize";
import { getOrderByNumber, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/orders";
import { edfapayConfigured } from "@/lib/settings";
import { TLink } from "@/components/site/Transition";
import { Reveal, SplitText } from "@/components/ui/Reveal";
import { OrderClient, RetryPayment } from "./OrderClient";

export const metadata: Metadata = { title: "تفاصيل الطلب", robots: { index: false } };
export const dynamic = "force-dynamic";

const STEPS = [
  { key: "pending", label: "تم استلام الطلب", icon: Check },
  { key: "processing", label: "قيد التجهيز", icon: Package },
  { key: "shipped", label: "تم الشحن", icon: Truck },
  { key: "delivered", label: "تم التوصيل", icon: MapPin },
] as const;

const dateFmt = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Riyadh",
});

type Props = { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string; new?: string; pay?: string }> };

export default async function OrderPage({ params, searchParams }: Props) {
  const [{ number }, sp] = await Promise.all([params, searchParams]);
  const order = await getOrderByNumber(number);
  if (!order) notFound();
  // الوصول: برمز الطلب السري في الرابط، أو لصاحب الحساب المسجّل
  const customer = await getCustomer();
  const ownsIt =
    customer && customer.passwordHash && order.customerId === customer.id && order.createdAt >= (customer.registeredAt ?? customer.createdAt);
  const allowed = (sp.t && sp.t === order.accessToken) || ownsIt;
  if (!allowed) notFound();

  const cancelled = order.status === "cancelled";
  const stepIndex = STEPS.findIndex((s) => s.key === order.status);
  const awaitingPayment = order.paymentMethod === "edfapay" && order.paymentStatus !== "paid" && !cancelled;
  const isNew = sp.new === "1" && !awaitingPayment;
  const publicEvents = order.events.filter((e) => e.isPublic);

  return (
    <div className="pb-24 pt-[calc(var(--header-h)+2rem)] md:pb-32 md:pt-[calc(var(--header-h)+4rem)]">
      <OrderClient
        isNew={isNew}
        number={order.number}
        total={order.total}
        items={order.items.map((i) => ({ id: i.productId ?? i.sku, name: i.name, price: i.unitPrice, qty: i.qty }))}
      />
      <div className="wrap">
        <header className="max-w-4xl">
          <p className="t-eyebrow text-ink-mute">
            طلب رقم <span className="num text-ink">{order.number}</span>
          </p>
          <SplitText
            as="h1"
            className="t-h1 mt-3"
            immediate
            text={cancelled ? "تم إلغاء الطلب." : awaitingPayment ? "بانتظار الدفع." : isNew ? "شكرًا لك.\nطلبك في الطريق." : ORDER_STATUS_LABEL[order.status] + "."}
            accentWords={["لك", "الطريق"]}
          />
          <p className="mt-4 max-w-xl leading-loose text-ink-mute">
            {awaitingPayment
              ? "لم يكتمل دفع هذا الطلب بعد. أكمل الدفع لنبدأ بتجهيزه."
              : isNew
                ? "استلمنا طلبك وسنبدأ بتجهيزه. احتفظ برقم الطلب لمتابعة حالته في أي وقت من صفحة «تتبّع طلبك»."
                : `آخر تحديث: ${dateFmt.format(order.updatedAt)}`}
          </p>
          {awaitingPayment && edfapayConfigured() && (
            <RetryPayment number={order.number} token={order.accessToken} errorHint={sp.pay === "error"} />
          )}
        </header>

        {/* مسار الحالة */}
        {!cancelled && (
          <Reveal className="mt-12 rounded-tile bg-ink p-6 text-paper md:mt-16 md:p-10">
            <ol className="grid grid-cols-4 gap-2">
              {STEPS.map((s, i) => {
                const done = i <= stepIndex && !awaitingPayment;
                const Icon = s.icon;
                return (
                  <li key={s.key} className="relative flex flex-col items-center text-center">
                    {i > 0 && (
                      <span
                        aria-hidden
                        className={`absolute top-5 h-0.5 w-full translate-x-1/2 md:top-6 ${i <= stepIndex && !awaitingPayment ? "bg-lime" : "bg-paper/20"}`}
                      />
                    )}
                    <span
                      className={`relative z-10 grid h-10 w-10 place-items-center rounded-full md:h-12 md:w-12 ${
                        done ? "bg-lime text-ink" : "bg-ink-soft text-paper/40 ring-1 ring-paper/20"
                      }`}
                    >
                      <Icon size={19} />
                    </span>
                    <span className={`mt-3 text-[0.72rem] font-semibold leading-snug md:text-sm ${done ? "" : "text-paper/45"}`}>{s.label}</span>
                  </li>
                );
              })}
            </ol>
            {order.trackingNumber && (
              <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-paper/15 pt-6">
                <div>
                  <p className="text-xs text-paper/55">رقم التتبع{order.trackingCarrier ? ` — ${order.trackingCarrier}` : ""}</p>
                  <p className="num mt-1 font-display text-xl font-bold text-lime">{order.trackingNumber}</p>
                </div>
                {order.trackingUrl && /^https:\/\//.test(order.trackingUrl) && (
                  <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="btn btn-lime">
                    تتبّع الشحنة
                  </a>
                )}
              </div>
            )}
          </Reveal>
        )}

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:gap-16">
          <div>
            <h2 className="t-h3 mb-4">المنتجات</h2>
            <ul className="divide-y divide-line border-y border-line">
              {order.items.map((it) => (
                <li key={it.id} className="flex items-center gap-4 py-4">
                  <span className="relative h-20 w-[4.5rem] shrink-0 overflow-hidden rounded-2xl bg-paper-deep">
                    {it.imageUrl && <Image src={it.imageUrl} alt="" fill sizes="72px" className="object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium leading-snug">{it.name}</span>
                    {it.optionValue && <span className="block text-sm text-ink-mute">{it.optionValue}</span>}
                    <span className="mt-0.5 block text-sm text-ink-mute">
                      <span className="num">{it.qty}</span> × <span className="num">{formatAmount(it.unitPrice)}</span> ر.س
                    </span>
                  </span>
                  <span className="font-display font-bold">
                    <span className="num">{formatAmount(it.total)}</span> <span className="text-xs font-medium">ر.س</span>
                  </span>
                </li>
              ))}
            </ul>

            {publicEvents.length > 0 && (
              <>
                <h2 className="t-h3 mb-4 mt-12">سجل الطلب</h2>
                <ol className="space-y-4 border-s-2 border-ink/15 ps-5">
                  {[...publicEvents].reverse().map((e) => (
                    <li key={e.id} className="relative">
                      <span aria-hidden className="absolute -start-[1.72rem] top-1.5 h-3 w-3 rounded-full bg-ink ring-4 ring-paper" />
                      <p className="font-medium">{e.note}</p>
                      <p className="num text-xs text-ink-mute">{dateFmt.format(e.createdAt)}</p>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>

          <aside className="h-fit space-y-6 rounded-tile bg-paper-card p-6 md:p-8">
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-mute">المجموع الفرعي</span>
                <span className="num font-display font-bold">{formatAmount(order.subtotal)} ر.س</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-coral">
                  <span>الخصم{order.couponCode ? ` (${order.couponCode})` : ""}</span>
                  <span className="num font-display font-bold">− {formatAmount(order.discount)} ر.س</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-ink-mute">الشحن — {order.shippingMethodName}</span>
                <span className="num font-display font-bold">{order.shipping === 0 ? "مجاني" : `${formatAmount(order.shipping)} ر.س`}</span>
              </div>
              {order.codFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-ink-mute">رسوم الدفع عند الاستلام</span>
                  <span className="num font-display font-bold">{formatAmount(order.codFee)} ر.س</span>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-ink/15 pt-4 font-display text-xl font-extrabold">
                <span>الإجمالي</span>
                <span>
                  <span className="num">{formatAmount(order.total)}</span> <span className="text-sm font-medium">ر.س</span>
                </span>
              </div>
              {order.vatAmount > 0 && (
                <p className="text-xs text-ink-mute">
                  شامل ضريبة القيمة المضافة: <span className="num">{formatAmount(order.vatAmount)}</span> ر.س
                </p>
              )}
            </div>
            <div className="border-t border-ink/15 pt-5 text-sm">
              <p className="mb-1.5 flex items-center gap-2 font-semibold">
                <CreditCard size={16} /> الدفع
              </p>
              <p className="text-ink-mute">
                {PAYMENT_METHOD_LABEL[order.paymentMethod]} — <span className="font-medium text-ink">{PAYMENT_STATUS_LABEL[order.paymentStatus]}</span>
              </p>
            </div>
            <div className="border-t border-ink/15 pt-5 text-sm">
              <p className="mb-1.5 flex items-center gap-2 font-semibold">
                <MapPin size={16} /> التوصيل إلى
              </p>
              <p className="leading-relaxed text-ink-mute">
                {order.customerName} — <span className="num">{displayPhone(order.customerPhone)}</span>
                <br />
                {[order.address.city, order.address.district].filter(Boolean).join("، ")}
                {order.address.shortAddress && (
                  <>
                    <br />
                    العنوان المختصر: <span className="num font-semibold text-ink">{order.address.shortAddress}</span>
                  </>
                )}
                {order.address.street && (
                  <>
                    <br />
                    {order.address.street}
                  </>
                )}
              </p>
            </div>
            <TLink href="/shop" className="btn btn-ghost w-full">
              متابعة التسوق
            </TLink>
          </aside>
        </div>
      </div>
    </div>
  );
}

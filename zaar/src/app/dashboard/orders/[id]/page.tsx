import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ArrowRight, MessageCircle, Printer } from "lucide-react";
import { db } from "@/db";
import { claims, orderItems, orders } from "@/db/schema";
import { ActionButton } from "@/components/dash/client";
import { SafeForm, SafeSubmit } from "@/components/dash/merchant/SafeForm";
import { Badge, Card, Field, Money, ORDER_TONE, PageHead, fmtDate } from "@/components/dash/ui";
import { Art } from "@/components/ui/Art";
import { requireMerchantStore } from "@/lib/auth";
import { STATUS_LABEL } from "@/lib/orders";
import type { OrderEvent } from "@/lib/types";
import { PAYMENT_LABEL, SHIPPING_COMPANIES, waLink } from "../../_lib/form";
import { deliverOrder, refundFull, shipOrder, startProcessing } from "../actions";

export const metadata = { title: "تفاصيل الطلب" };

/** ActionButton يلفّ زره بنموذج inline؛ هذا يمدّه على عرض البطاقة */
const WIDE = "[&>form]:flex [&>form]:w-full [&>form]:items-stretch";

const BY_LABEL: Record<OrderEvent["by"], string> = { system: "النظام", merchant: "المتجر", customer: "العميل", zaar: "زار" };

function Row({ label, children, strong = false }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-2 ${strong ? "font-display text-base font-bold" : "text-sm"}`}>
      <span className={strong ? "" : "text-ink/65"}>{label}</span>
      <span>{children}</span>
    </div>
  );
}

export default async function OrderPage(props: { params: Promise<{ id: string }> }) {
  const { store } = await requireMerchantStore();
  const { id } = await props.params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) notFound();

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.storeId, store.id)))
    .limit(1);
  if (!order) notFound();

  const [items, [claim]] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.id)),
    db
      .select({ id: claims.id, status: claims.status })
      .from(claims)
      .where(and(eq(claims.orderId, order.id), eq(claims.storeId, store.id)))
      .limit(1),
  ]);

  const wa = waLink(order.customerPhone);
  const canShip = order.status === "paid" || order.status === "processing";
  const canRefund = order.paymentStatus === "paid" && order.status !== "refunded";
  const events = [...order.events].reverse();

  return (
    <>
      <Link href="/dashboard/orders" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink">
        <ArrowRight size={16} /> كل الطلبات
      </Link>
      <PageHead title={`طلب ${order.number}`} sub={`${fmtDate(order.createdAt, true)} · ${PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}`}>
        <Badge tone={ORDER_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
        <Link href={`/dashboard/orders/${order.id}/invoice`} className="dash-btn dash-btn-ghost dash-btn-sm">
          <Printer size={14} /> طباعة الفاتورة
        </Link>
      </PageHead>

      {claim && (claim.status === "open" || claim.status === "merchant_replied") && (
        <Link href="/dashboard/claims" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-amber-500/15 px-5 py-4 text-sm font-medium text-amber-900">
          <span>{claim.status === "open" ? "العميل طلب استرداد المبلغ عبر ضمان زار — بانتظار ردك." : "طلب الاسترداد على هذا الطلب عند فريق زار للحسم."}</span>
          <span className="font-display text-xs font-bold underline underline-offset-4">افتح ضمان زار</span>
        </Link>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <Card title="المنتجات">
            <ul className="divide-y divide-ink/[0.07]">
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-3.5 py-3 first:pt-0 last:pb-0">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-ink/5">
                    <Art image={i.image} art={i.art ?? { hue: 40, icon: "Package" }} alt={i.name} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{i.name}</p>
                    <p className="mt-0.5 text-xs text-ink/55">
                      {i.optionValue && <span>{i.optionValue} · </span>}
                      <span className="num">{i.qty}</span> × <Money value={i.unitPrice} />
                    </p>
                  </div>
                  <Money value={i.unitPrice * i.qty} className="text-sm" />
                </li>
              ))}
            </ul>
          </Card>

          <Card title="الحساب">
            <div className="divide-y divide-ink/[0.07]">
              <Row label="مجموع المنتجات">
                <Money value={order.subtotal} />
              </Row>
              {order.discount > 0 && (
                <Row label={order.couponCode ? `الخصم (كوبون ${order.couponCode})` : "الخصم"}>
                  <span className="text-emerald-700">
                    − <Money value={order.discount} />
                  </span>
                </Row>
              )}
              {order.discount === 0 && order.couponCode && (
                <Row label="الكوبون">
                  <span className="num font-semibold">{order.couponCode}</span>
                </Row>
              )}
              <Row label="الشحن">{order.shipping > 0 ? <Money value={order.shipping} /> : "مجاني"}</Row>
              <Row label="الإجمالي" strong>
                <Money value={order.total} />
              </Row>
              <Row label="منها ضريبة القيمة المضافة">
                <Money value={order.vat} />
              </Row>
              {order.paidAt && (
                <>
                  <Row label="عمولة زار">
                    <span className="text-ink/70">
                      − <Money value={order.platformFee} />
                    </span>
                  </Row>
                  <Row label="صافي لك" strong>
                    <Money value={order.net} />
                  </Row>
                </>
              )}
            </div>
            {order.status === "refunded" && <p className="mt-3 text-xs leading-relaxed text-ink/55">هذا الطلب مُسترد: خُصم المبلغ من رصيدك ورجعت لك عمولة زار.</p>}
          </Card>

          <Card title="سجل الطلب">
            <ol className="relative space-y-4 border-s border-ink/15 ps-5">
              {events.map((e, i) => (
                <li key={`${e.at}-${i}`} className="relative">
                  <span className={`absolute -start-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full ${i === 0 ? "bg-accent ring-4 ring-accent/30" : "bg-ink/25"}`} />
                  <p className="text-sm font-medium">{e.note}</p>
                  <p className="mt-0.5 text-xs text-ink/50">
                    {fmtDate(e.at, true)} · {BY_LABEL[e.by] ?? e.by}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="الإجراء التالي">
            {order.status === "pending_payment" && <p className="text-sm leading-relaxed text-ink/65">بانتظار دفع العميل. إذا ما اكتمل الدفع خلال ساعتين يُلغى الطلب تلقائيًا ويرجع المخزون.</p>}
            {order.status === "cancelled" && <p className="text-sm leading-relaxed text-ink/65">الطلب ملغي، ما عليه أي إجراء.</p>}
            {order.status === "refunded" && <p className="text-sm leading-relaxed text-ink/65">تم اعتماد استرداد كامل المبلغ للعميل وخُصم من رصيدك.</p>}
            {order.status === "delivered" && <p className="text-sm leading-relaxed text-ink/65">تم توصيل الطلب{order.deliveredAt ? ` في ${fmtDate(order.deliveredAt, true)}` : ""}.</p>}

            {order.status === "paid" && (
              <div className={`mb-5 border-b border-ink/10 pb-5 ${WIDE}`}>
                <ActionButton action={startProcessing} fields={{ id: order.id }} className="dash-btn dash-btn-accent w-full">
                  ابدأ التجهيز
                </ActionButton>
              </div>
            )}

            {canShip && (
              <SafeForm action={shipOrder} className="space-y-3">
                <input type="hidden" name="id" value={order.id} />
                <Field label="شركة الشحن">
                  <select name="company" className="dash-input" defaultValue={SHIPPING_COMPANIES[0]} required>
                    {SHIPPING_COMPANIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="رقم التتبع" hint="يظهر للعميل في صفحة تتبع طلبه. اتركه فاضي لو ما فيه.">
                  <input name="tracking" className="dash-input num" dir="ltr" maxLength={40} inputMode="text" autoComplete="off" />
                </Field>
                <SafeSubmit className="dash-btn dash-btn-ink w-full" pendingText="لحظة…">
                  تم الشحن
                </SafeSubmit>
              </SafeForm>
            )}

            {order.status === "shipped" && (
              <div className={`space-y-4 ${WIDE}`}>
                <div className="rounded-2xl bg-ink/[0.04] px-4 py-3 text-sm">
                  <p>
                    <span className="text-ink/60">شركة الشحن: </span>
                    <span className="font-medium">{order.shippingCompany || "—"}</span>
                  </p>
                  <p className="mt-1">
                    <span className="text-ink/60">رقم التتبع: </span>
                    <span className="num font-medium">{order.trackingNumber || "—"}</span>
                  </p>
                  <p className="mt-1 text-xs text-ink/50">شُحن في {fmtDate(order.shippedAt, true)}</p>
                </div>
                <ActionButton action={deliverOrder} fields={{ id: order.id }} className="dash-btn dash-btn-accent w-full" confirm="تأكّد إن الطلب وصل للعميل. تسجّله «تم التوصيل»؟">
                  تم التوصيل
                </ActionButton>
              </div>
            )}

            {canShip && (
              <div className="mt-4 border-t border-ink/10 pt-4">
                <p className="mb-2 text-xs leading-relaxed text-ink/55">سلّمته للعميل بنفسك بدون شركة شحن؟</p>
                <ActionButton action={deliverOrder} fields={{ id: order.id }} confirm="تسجّل الطلب «تم التوصيل» بدون شحن؟">
                  تم التوصيل مباشرة
                </ActionButton>
              </div>
            )}
          </Card>

          <Card title="العميل">
            <p className="font-display font-bold">{order.customerName}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <a href={`tel:${order.customerPhone}`} className="num text-sm font-medium underline-offset-4 hover:underline">
                {order.customerPhone}
              </a>
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="dash-btn dash-btn-ghost dash-btn-sm">
                  <MessageCircle size={14} /> واتساب
                </a>
              )}
            </div>
            {order.customerEmail && (
              <p className="mt-1 break-all text-sm text-ink/65" dir="ltr">
                {order.customerEmail}
              </p>
            )}
            <dl className="mt-4 space-y-3 border-t border-ink/10 pt-4 text-sm">
              <div>
                <dt className="text-xs text-ink/55">المدينة</dt>
                <dd className="mt-0.5 font-medium">{order.city}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink/55">العنوان</dt>
                <dd className="mt-0.5 whitespace-pre-line leading-relaxed">{order.address}</dd>
              </div>
              {order.notes && (
                <div>
                  <dt className="text-xs text-ink/55">ملاحظات العميل</dt>
                  <dd className="mt-0.5 whitespace-pre-line rounded-2xl bg-amber-500/10 px-3 py-2 leading-relaxed">{order.notes}</dd>
                </div>
              )}
            </dl>
          </Card>

          {order.status !== "shipped" && order.shippedAt && (
            <Card title="الشحنة">
              <p className="text-sm">
                <span className="text-ink/60">شركة الشحن: </span>
                <span className="font-medium">{order.shippingCompany || "—"}</span>
              </p>
              <p className="mt-1 text-sm">
                <span className="text-ink/60">رقم التتبع: </span>
                <span className="num font-medium">{order.trackingNumber || "—"}</span>
              </p>
            </Card>
          )}

          {canRefund && (
            <Card title="استرداد">
              <p className="mb-3 text-xs leading-relaxed text-ink/60">يرجع كامل المبلغ للعميل ويُخصم من رصيدك، وترجع لك عمولة زار والمخزون. ما تقدر تتراجع بعد التأكيد.</p>
              <div className={WIDE}>
                <ActionButton
                  action={refundFull}
                  fields={{ id: order.id }}
                  className="dash-btn dash-btn-danger w-full"
                  confirm={`بترجّع كامل مبلغ الطلب ${order.number} للعميل. متأكد؟`}
                >
                  استرداد كامل للعميل
                </ActionButton>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

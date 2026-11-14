/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowRight, EyeOff } from "lucide-react";
import { db } from "@/db";
import { orderEvents, orderItems, orders, paymentAttempts, type OrderStatus } from "@/db/schema";
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/orders";
import { formatSar } from "@/lib/money";
import { displayPhone } from "@/lib/normalize";
import { fmtDateTime, ORDER_STATUS_TONE, PAYMENT_STATUS_TONE } from "@/lib/admin-utils";
import { Badge, Card, Checkbox, DefList, Field, Input, PageHeader, Select, Textarea } from "@/components/admin/ui";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/admin/client";
import {
  addOrderNoteAction,
  markPaidAction,
  markRefundedAction,
  saveAdminNoteAction,
  setTrackingAction,
  updateOrderStatusAction,
} from "../actions";

export const metadata = { title: "تفاصيل الطلب" };

const FLOW: Exclude<OrderStatus, "cancelled">[] = ["pending", "processing", "shipped", "delivered"];

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  const order = rows[0];
  if (!order) notFound();

  const [items, events, payments] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(asc(orderItems.id)),
    db.select().from(orderEvents).where(eq(orderEvents.orderId, id)).orderBy(asc(orderEvents.createdAt), asc(orderEvents.id)),
    db.select().from(paymentAttempts).where(eq(paymentAttempts.orderId, id)).orderBy(asc(paymentAttempts.id)),
  ]);

  const cancelled = order.status === "cancelled";
  const canMarkShipped = ["pending", "processing"].includes(order.status);

  return (
    <>
      <Link href="/admin/orders" className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-mute hover:text-ink">
        <ArrowRight className="h-3.5 w-3.5" /> كل الطلبات
      </Link>
      <PageHeader title={`طلب ${order.number}`} subtitle={`أُنشئ ${fmtDateTime(order.createdAt)}`}>
        <Badge tone={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABEL[order.status]}</Badge>
        <Badge tone={PAYMENT_STATUS_TONE[order.paymentStatus]}>{PAYMENT_STATUS_LABEL[order.paymentStatus]}</Badge>
        <Link
          href={`/order/${order.number}?t=${order.accessToken}`}
          target="_blank"
          className="text-xs font-semibold text-ink-mute underline hover:text-ink"
        >
          صفحة الطلب كما يراها العميل
        </Link>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title={`المنتجات (${items.reduce((s, i) => s + i.qty, 0)})`} padded={false}>
            <ul className="divide-y divide-line/70">
              {items.map((it) => (
                <li key={it.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-line bg-paper-deep">
                    {it.imageUrl ? <img src={it.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {it.productId ? (
                        <Link href={`/admin/products/${it.productId}`} className="hover:underline">
                          {it.name}
                        </Link>
                      ) : (
                        it.name
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-mute">
                      {it.optionValue ? `${it.optionValue} · ` : ""}
                      <span dir="ltr">{it.sku}</span>
                    </div>
                  </div>
                  <div className="whitespace-nowrap text-sm text-ink-mute">
                    {it.qty} × {formatSar(it.unitPrice)}
                  </div>
                  <div className="w-24 whitespace-nowrap text-end text-sm font-bold">{formatSar(it.total)}</div>
                </li>
              ))}
            </ul>
            <div className="border-t border-line p-5">
              <div className="ms-auto max-w-xs">
                <DefList
                  items={[
                    ["المجموع الفرعي", formatSar(order.subtotal)],
                    ...(order.discount
                      ? ([[`الخصم${order.couponCode ? ` (${order.couponCode})` : ""}`, `− ${formatSar(order.discount)}`]] as [string, string][])
                      : []),
                    [`الشحن — ${order.shippingMethodName}`, order.shipping ? formatSar(order.shipping) : "مجاني"],
                    ...(order.codFee ? ([["رسوم الدفع عند الاستلام", formatSar(order.codFee)]] as [string, string][]) : []),
                    ["منها ضريبة القيمة المضافة", formatSar(order.vatAmount)],
                  ]}
                />
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-base font-extrabold">
                  <span>الإجمالي</span>
                  <span>{formatSar(order.total)}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card title="سجل الطلب">
            <ol className="relative space-y-4 border-s border-line ps-5">
              {events.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -start-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-ink" />
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    <span>{e.note || e.type}</span>
                    {!e.isPublic ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-paper-deep px-2 py-0.5 text-[11px] font-semibold text-ink-mute">
                        <EyeOff className="h-3 w-3" /> داخلي
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-mute">
                    {fmtDateTime(e.createdAt)} · <span dir="ltr">{e.actor}</span>
                  </div>
                </li>
              ))}
            </ol>

            <ActionForm action={addOrderNoteAction} resetOnSuccess className="mt-6 border-t border-line pt-5">
              <input type="hidden" name="id" value={order.id} />
              <Field label="إضافة ملاحظة">
                <Textarea name="note" rows={2} maxLength={1000} placeholder="مثال: تم التواصل مع العميل لتأكيد العنوان" required />
              </Field>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <Checkbox name="isPublic" label="إظهارها للعميل في صفحة تتبع الطلب" />
                <SubmitButton variant="dark" size="sm">
                  إضافة
                </SubmitButton>
              </div>
            </ActionForm>
          </Card>

          {payments.length ? (
            <Card title="محاولات الدفع" padded={false}>
              <ul className="divide-y divide-line/70 text-sm">
                {payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                    <span className="font-semibold">{p.provider}</span>
                    <span className="font-mono text-xs text-ink-mute" dir="ltr">
                      {p.providerRef ?? "—"}
                    </span>
                    <Badge tone={p.status === "approved" ? "green" : p.status === "declined" ? "red" : "neutral"}>{p.status}</Badge>
                    <span>{formatSar(p.amount)}</span>
                    <span className="text-xs text-ink-mute">{fmtDateTime(p.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card title="حالة الطلب">
            {cancelled ? (
              <p className="text-sm text-ink-mute">هذا الطلب ملغي وتمت إعادة مخزونه. لا يمكن تغيير حالته.</p>
            ) : (
              <>
                <ActionForm action={updateOrderStatusAction} className="space-y-3">
                  <input type="hidden" name="id" value={order.id} />
                  <Field label="تغيير الحالة">
                    <Select name="status" defaultValue={order.status} key={order.status}>
                      {FLOW.map((s) => (
                        <option key={s} value={s}>
                          {ORDER_STATUS_LABEL[s]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <SubmitButton variant="primary" className="w-full">
                    تحديث الحالة
                  </SubmitButton>
                </ActionForm>
                <ActionForm action={updateOrderStatusAction} className="mt-5 space-y-3 border-t border-line pt-5">
                  <input type="hidden" name="id" value={order.id} />
                  <input type="hidden" name="status" value="cancelled" />
                  <Field label="إلغاء الطلب" hint="يعيد المخزون المحجوز وعدّاد الكوبون. لا يمكن التراجع.">
                    <Input name="reason" placeholder="سبب الإلغاء (اختياري — يظهر للعميل)" maxLength={200} />
                  </Field>
                  <ConfirmButton message={`تأكيد إلغاء الطلب ${order.number}؟ لا يمكن التراجع.`} size="md" className="w-full">
                    إلغاء الطلب
                  </ConfirmButton>
                </ActionForm>
              </>
            )}
          </Card>

          <Card title="الدفع">
            <DefList
              items={[
                ["الطريقة", PAYMENT_METHOD_LABEL[order.paymentMethod]],
                ["الحالة", <Badge key="s" tone={PAYMENT_STATUS_TONE[order.paymentStatus]}>{PAYMENT_STATUS_LABEL[order.paymentStatus]}</Badge>],
                ["تاريخ الدفع", fmtDateTime(order.paidAt)],
                ...(order.gatewayTransactionId
                  ? ([["رقم العملية", <span key="t" dir="ltr" className="break-all font-mono text-xs">{order.gatewayTransactionId}</span>]] as [string, React.ReactNode][])
                  : []),
              ]}
            />
            {!cancelled && order.paymentStatus !== "paid" && order.paymentStatus !== "refunded" ? (
              <ActionForm action={markPaidAction} className="mt-4 border-t border-line pt-4">
                <input type="hidden" name="id" value={order.id} />
                <ConfirmButton
                  variant="dark"
                  size="md"
                  className="w-full"
                  message={
                    order.paymentMethod === "cod"
                      ? "تأكيد استلام مبلغ الطلب نقدًا؟"
                      : "تأكيد الدفع يدويًا؟ افعل ذلك فقط بعد التحقق من العملية في لوحة EdfaPay."
                  }
                >
                  {order.paymentMethod === "cod" ? "تسجيل استلام المبلغ" : "تأكيد الدفع يدويًا"}
                </ConfirmButton>
              </ActionForm>
            ) : null}
            {order.paymentStatus === "paid" ? (
              <ActionForm action={markRefundedAction} className="mt-4 border-t border-line pt-4">
                <input type="hidden" name="id" value={order.id} />
                <ConfirmButton
                  size="md"
                  className="w-full"
                  message="تسجيل الطلب كمُسترد؟ هذا يغيّر الحالة فقط — إرجاع المبلغ الفعلي يتم من لوحة بوابة الدفع."
                >
                  تسجيل استرداد المبلغ
                </ConfirmButton>
              </ActionForm>
            ) : null}
          </Card>

          <Card title="الشحن والتتبع">
            <ActionForm action={setTrackingAction} className="space-y-3">
              <input type="hidden" name="id" value={order.id} />
              <Field label="شركة الشحن">
                <Input name="carrier" defaultValue={order.trackingCarrier ?? order.shippingMethodName} placeholder="مثال: سمسا، أرامكس" maxLength={80} />
              </Field>
              <Field label="رقم التتبع">
                <Input name="number" dir="ltr" defaultValue={order.trackingNumber ?? ""} maxLength={80} />
              </Field>
              <Field label="رابط التتبع (اختياري)">
                <Input name="url" type="url" dir="ltr" defaultValue={order.trackingUrl ?? ""} placeholder="https://" maxLength={500} />
              </Field>
              {canMarkShipped ? <Checkbox name="markShipped" defaultChecked label="تحويل الطلب إلى «تم الشحن» عند الحفظ" /> : null}
              <SubmitButton variant="dark" className="w-full">
                حفظ معلومات التتبع
              </SubmitButton>
            </ActionForm>
          </Card>

          <Card title="العميل">
            <DefList
              items={[
                [
                  "الاسم",
                  order.customerId ? (
                    <Link key="c" href={`/admin/customers/${order.customerId}`} className="underline">
                      {order.customerName}
                    </Link>
                  ) : (
                    order.customerName
                  ),
                ],
                [
                  "الجوال",
                  <a key="p" href={`tel:+${order.customerPhone}`} dir="ltr" className="underline">
                    {displayPhone(order.customerPhone)}
                  </a>,
                ],
                ["البريد", order.customerEmail ? <span key="e" dir="ltr" className="break-all">{order.customerEmail}</span> : "—"],
                ["المدينة", order.address.city],
                ...(order.address.shortAddress ? ([["العنوان المختصر", order.address.shortAddress]] as [string, string][]) : []),
                ...(order.address.district ? ([["الحي", order.address.district]] as [string, string][]) : []),
                ...(order.address.street ? ([["تفاصيل العنوان", order.address.street]] as [string, string][]) : []),
                ...(order.address.notes ? ([["ملاحظات العنوان", order.address.notes]] as [string, string][]) : []),
              ]}
            />
            {order.customerNote ? (
              <div className="mt-4 rounded-xl bg-paper-card p-3 text-sm">
                <div className="mb-1 text-xs font-semibold text-ink-mute">ملاحظة العميل</div>
                {order.customerNote}
              </div>
            ) : null}
          </Card>

          <Card title="ملاحظة إدارية (داخلية)">
            <ActionForm action={saveAdminNoteAction} className="space-y-3">
              <input type="hidden" name="id" value={order.id} />
              <Textarea name="adminNote" rows={3} defaultValue={order.adminNote ?? ""} maxLength={2000} aria-label="ملاحظة إدارية" />
              <SubmitButton variant="outline" size="sm">
                حفظ
              </SubmitButton>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}

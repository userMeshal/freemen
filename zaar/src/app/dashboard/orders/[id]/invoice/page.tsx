import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { PrintButton } from "@/components/dash/merchant/PrintButton";
import { PageHead, fmtDate } from "@/components/dash/ui";
import { requireMerchantStore } from "@/lib/auth";
import { formatAmount } from "@/lib/money";
import { DEFAULT_SETTINGS } from "@/lib/stores";
import { PAYMENT_LABEL } from "../../../_lib/form";

export const metadata = { title: "الفاتورة" };

/** عند الطباعة نخفي هيكل اللوحة (الشريط الجانبي، الترويسة، تنبيهات التخطيط) ونترك الفاتورة وحدها */
const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 14mm; }
  html, body { background: #fff !important; }
  aside, header, main > a, main > p, .no-print { display: none !important; }
  .lg\\:ps-64 { padding: 0 !important; }
  main { max-width: none !important; padding: 0 !important; }
  .invoice { border: 0 !important; border-radius: 0 !important; padding: 0 !important; box-shadow: none !important; max-width: none !important; }
}`;

function Sar({ value }: { value: number }) {
  return (
    <span className="whitespace-nowrap">
      <span className="num">{formatAmount(value)}</span> ر.س
    </span>
  );
}

export default async function InvoicePage(props: { params: Promise<{ id: string }> }) {
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
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.id));

  const s = { ...DEFAULT_SETTINGS, ...store.settings };
  // الفاتورة الضريبية تصدر فقط من منشأة مسجّلة في الضريبة؛ بدون رقم ضريبي تُعرض كفاتورة عادية بلا سطر ضريبة
  const taxed = Boolean(s.vatNumber);
  const unpaid = order.paymentStatus === "unpaid" || order.paymentStatus === "failed";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <Link href={`/dashboard/orders/${order.id}`} className="no-print mb-4 inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink">
        <ArrowRight size={16} /> رجوع للطلب
      </Link>
      <PageHead title={`فاتورة ${order.number}`} sub="اطبعها أو احفظها PDF من نافذة الطباعة وأرفقها مع الشحنة.">
        <PrintButton label="طباعة الفاتورة" />
      </PageHead>

      {!taxed && (
        <p className="no-print mb-5 rounded-3xl bg-amber-500/15 px-5 py-4 text-sm leading-relaxed text-amber-900">
          ما أضفت رقمك الضريبي، فالفاتورة تطلع بدون بيانات ضريبة القيمة المضافة. إذا منشأتك مسجّلة في الضريبة أضف الرقم من{" "}
          <Link href="/dashboard/settings" className="font-semibold underline underline-offset-4">
            الإعدادات
          </Link>{" "}
          وتتحول تلقائيًا إلى فاتورة ضريبية مبسطة.
        </p>
      )}
      {unpaid && <p className="no-print mb-5 rounded-3xl bg-red-500/10 px-5 py-4 text-sm font-medium text-red-700">تنبيه: هذا الطلب لم يُدفع بعد.</p>}

      <article className="invoice mx-auto max-w-3xl rounded-3xl border border-ink/10 bg-white p-6 text-[#111] md:p-10">
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-black/15 pb-6">
          <div>
            <p className="font-display text-2xl font-black">{store.name}</p>
            <div className="mt-2 space-y-0.5 text-xs text-black/65">
              {s.crNumber && (
                <p>
                  السجل التجاري: <span className="num">{s.crNumber}</span>
                </p>
              )}
              {s.vatNumber && (
                <p>
                  الرقم الضريبي: <span className="num">{s.vatNumber}</span>
                </p>
              )}
              {s.phone && (
                <p>
                  الجوال: <span className="num">{s.phone}</span>
                </p>
              )}
              {s.email && <p dir="ltr" className="text-end">{s.email}</p>}
            </div>
          </div>
          <div className="text-end">
            <p className="font-display text-lg font-bold">{taxed ? "فاتورة ضريبية مبسطة" : "فاتورة"}</p>
            <p className="mt-0.5 text-[0.7rem] tracking-wide text-black/50">{taxed ? "Simplified Tax Invoice" : "Invoice"}</p>
            <dl className="mt-3 space-y-1 text-xs">
              <div className="flex justify-end gap-2">
                <dt className="text-black/55">رقم الفاتورة</dt>
                <dd className="num font-semibold">{order.number}</dd>
              </div>
              <div className="flex justify-end gap-2">
                <dt className="text-black/55">التاريخ</dt>
                <dd className="font-semibold">{fmtDate(order.paidAt ?? order.createdAt, true)}</dd>
              </div>
              <div className="flex justify-end gap-2">
                <dt className="text-black/55">طريقة الدفع</dt>
                <dd className="font-semibold">{PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="border-b border-black/15 py-5 text-sm">
          <p className="text-xs text-black/55">العميل</p>
          <p className="mt-1 font-semibold">{order.customerName}</p>
          <p className="num text-black/70">{order.customerPhone}</p>
          <p className="mt-1 leading-relaxed text-black/70">
            {order.city} — {order.address}
          </p>
        </div>

        <table className="mt-5 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/20 text-xs text-black/55">
              <th className="py-2 text-start font-semibold">المنتج</th>
              <th className="px-2 py-2 text-center font-semibold">الكمية</th>
              <th className="px-2 py-2 text-end font-semibold">سعر الوحدة</th>
              <th className="py-2 text-end font-semibold">المجموع</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b border-black/10">
                <td className="py-2.5">
                  {i.name}
                  {i.optionValue && <span className="text-black/55"> — {i.optionValue}</span>}
                </td>
                <td className="num px-2 py-2.5 text-center">{i.qty}</td>
                <td className="px-2 py-2.5 text-end">
                  <Sar value={i.unitPrice} />
                </td>
                <td className="py-2.5 text-end">
                  <Sar value={i.unitPrice * i.qty} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-5 flex justify-end">
          <dl className="w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-black/60">مجموع المنتجات</dt>
              <dd>
                <Sar value={order.subtotal} />
              </dd>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-black/60">الخصم{order.couponCode ? ` (${order.couponCode})` : ""}</dt>
                <dd>
                  − <Sar value={order.discount} />
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-black/60">الشحن</dt>
              <dd>{order.shipping > 0 ? <Sar value={order.shipping} /> : "مجاني"}</dd>
            </div>
            {taxed && (
              <>
                <div className="flex justify-between gap-4 border-t border-black/10 pt-1.5">
                  <dt className="text-black/60">الإجمالي غير شامل الضريبة</dt>
                  <dd>
                    <Sar value={order.total - order.vat} />
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-black/60">
                    ضريبة القيمة المضافة (<span className="num">{s.vatRate}%</span>)
                  </dt>
                  <dd>
                    <Sar value={order.vat} />
                  </dd>
                </div>
              </>
            )}
            <div className="flex justify-between gap-4 border-t border-black/25 pt-2 font-display text-base font-bold">
              <dt>{taxed ? "الإجمالي شامل الضريبة" : "الإجمالي"}</dt>
              <dd>
                <Sar value={order.total} />
              </dd>
            </div>
          </dl>
        </div>

        <p className="mt-8 border-t border-black/15 pt-4 text-center text-xs text-black/50">
          {taxed ? "الأسعار شاملة ضريبة القيمة المضافة. " : ""}شكرًا لتسوقك من {store.name}.
        </p>
      </article>
    </>
  );
}

import Link from "next/link";
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { Search } from "lucide-react";
import { db } from "@/db";
import { orderItems, orders, type OrderStatus } from "@/db/schema";
import { Badge, Empty, Money, ORDER_TONE, PageHead, TableWrap, Tabs, fmtDate } from "@/components/dash/ui";
import { Pager } from "@/components/dash/merchant/Pager";
import { requireMerchantStore } from "@/lib/auth";
import { latinDigits, normalizePhone } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/orders";
import { PAYMENT_LABEL, likeTerm, one, pageOf } from "../_lib/form";

export const metadata = { title: "الطلبات" };

const PER_PAGE = 30;

const FILTERS: { id: string; label: string; statuses: OrderStatus[] }[] = [
  { id: "todo", label: "بانتظار التجهيز", statuses: ["paid", "processing"] },
  { id: "shipped", label: "تم الشحن", statuses: ["shipped"] },
  { id: "delivered", label: "تم التوصيل", statuses: ["delivered"] },
  { id: "refunded", label: "مسترد", statuses: ["refunded"] },
  { id: "pending", label: "بانتظار الدفع", statuses: ["pending_payment"] },
  { id: "cancelled", label: "ملغي", statuses: ["cancelled"] },
];

export default async function OrdersPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { store } = await requireMerchantStore();
  const sp = await props.searchParams;
  const filter = FILTERS.find((f) => f.id === one(sp.status));
  const q = latinDigits(one(sp.q, 30));
  const page = pageOf(sp.page);

  const scope: SQL[] = [eq(orders.storeId, store.id)];
  if (q) {
    const phone = normalizePhone(q);
    const match = or(ilike(orders.number, likeTerm(q)), ilike(orders.customerPhone, likeTerm(phone ?? q)));
    if (match) scope.push(match);
  }

  const counts = await db
    .select({ status: orders.status, n: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(...scope))
    .groupBy(orders.status);
  const countOf = (statuses: OrderStatus[]) => counts.filter((c) => statuses.includes(c.status)).reduce((s, c) => s + c.n, 0);
  const all = counts.reduce((s, c) => s + c.n, 0);
  const total = filter ? countOf(filter.statuses) : all;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const rows = await db
    .select()
    .from(orders)
    .where(and(...scope, ...(filter ? [inArray(orders.status, filter.statuses)] : [])))
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(PER_PAGE)
    .offset((Math.min(page, pages) - 1) * PER_PAGE);

  const itemCounts = rows.length
    ? await db
        .select({ orderId: orderItems.orderId, n: sql<number>`coalesce(sum(${orderItems.qty}), 0)::int` })
        .from(orderItems)
        .where(
          inArray(
            orderItems.orderId,
            rows.map((r) => r.id),
          ),
        )
        .groupBy(orderItems.orderId)
    : [];
  const itemsOf = new Map(itemCounts.map((r) => [r.orderId, r.n]));

  const href = (status?: string, keepSearch = true) => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (q && keepSearch) p.set("q", q);
    const s = p.toString();
    return s ? `/dashboard/orders?${s}` : "/dashboard/orders";
  };

  return (
    <>
      <PageHead title="الطلبات" sub="كل طلبات متجرك من الأحدث للأقدم. اضغط على أي طلب عشان تجهّزه وتحدّث حالته." />

      <form action="/dashboard/orders" className="mb-4 flex max-w-xl gap-2">
        {filter && <input type="hidden" name="status" value={filter.id} />}
        <div className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-ink/40" />
          <input name="q" defaultValue={q} placeholder="ابحث برقم الطلب أو جوال العميل" className="dash-input !ps-10" inputMode="search" maxLength={30} />
        </div>
        <button type="submit" className="dash-btn dash-btn-ink">
          بحث
        </button>
        {q && (
          <Link href={href(filter?.id, false)} className="dash-btn dash-btn-ghost">
            مسح
          </Link>
        )}
      </form>

      <Tabs
        current={href(filter?.id)}
        items={[{ href: href(), label: "الكل", count: all }, ...FILTERS.map((f) => ({ href: href(f.id), label: f.label, count: countOf(f.statuses) }))]}
      />

      {rows.length === 0 ? (
        <Empty
          title={q ? "ما لقينا طلبات بهذا البحث" : filter ? "ما فيه طلبات بهذي الحالة" : "ما وصلك طلبات للحين"}
          text={q || filter ? undefined : "أول ما يطلب عميل من متجرك بيظهر طلبه هنا. شارك رابط متجرك وابدأ البيع."}
        />
      ) : (
        <TableWrap>
          <table className="dash-table">
            <thead>
              <tr>
                <th>رقم الطلب</th>
                <th>التاريخ</th>
                <th>العميل</th>
                <th>القطع</th>
                <th>الإجمالي</th>
                <th>الدفع</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/dashboard/orders/${o.id}`} className="num font-display font-bold underline-offset-4 hover:underline">
                      {o.number}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap text-ink/65">{fmtDate(o.createdAt, true)}</td>
                  <td>
                    <Link href={`/dashboard/orders/${o.id}`} className="block min-w-36">
                      <span className="block font-medium">{o.customerName}</span>
                      <span className="num block text-xs text-ink/55">{o.customerPhone}</span>
                    </Link>
                  </td>
                  <td className="num">{itemsOf.get(o.id) ?? 0}</td>
                  <td>
                    <Money value={o.total} />
                  </td>
                  <td className="whitespace-nowrap text-ink/70">{PAYMENT_LABEL[o.paymentMethod] ?? o.paymentMethod}</td>
                  <td>
                    <Badge tone={ORDER_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      <Pager base="/dashboard/orders" params={{ status: filter?.id ?? "", q }} page={Math.min(page, pages)} pages={pages} />
    </>
  );
}

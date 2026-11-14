import Link from "next/link";
import { asc, desc, eq, isNotNull, lte, and, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders, products, variants } from "@/db/schema";
import { cancelStaleUnpaidOrders, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/orders";
import { formatAmount, formatSar } from "@/lib/money";
import { fmtDateTime, ORDER_STATUS_TONE, PAYMENT_STATUS_TONE, REVENUE_SQL } from "@/lib/admin-utils";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Stat, Table, Td, Th } from "@/components/admin/ui";

export const metadata = { title: "الرئيسية" };

type Kpis = {
  today: string;
  last30: string;
  orders_count: string;
  revenue_orders: string;
  revenue_total: string;
  to_process: string;
};

export default async function AdminDashboardPage() {
  await cancelStaleUnpaidOrders().catch(() => 0);

  const revenue = dsql.raw(REVENUE_SQL);
  const [kpiRows, chartRows, latest, lowStock, customerCount] = await Promise.all([
    db.execute(dsql`
      select
        coalesce(sum(total) filter (where ${revenue}
          and created_at >= (date_trunc('day', now() at time zone 'Asia/Riyadh') at time zone 'Asia/Riyadh')), 0)::bigint as today,
        coalesce(sum(total) filter (where ${revenue} and created_at >= now() - interval '30 days'), 0)::bigint as last30,
        count(*) filter (where status <> 'cancelled')::bigint as orders_count,
        count(*) filter (where ${revenue})::bigint as revenue_orders,
        coalesce(sum(total) filter (where ${revenue}), 0)::bigint as revenue_total,
        count(*) filter (where status in ('pending', 'processing')
          and (payment_method = 'cod' or payment_status = 'paid'))::bigint as to_process
      from orders
    `),
    db.execute(dsql`
      select to_char(d.day, 'YYYY-MM-DD') as day,
        coalesce(sum(o.total) filter (where ${dsql.raw(REVENUE_SQL.replace(/\b(status|payment_status|payment_method)\b/g, "o.$1"))}), 0)::bigint as total,
        count(o.id) filter (where o.status <> 'cancelled')::int as orders
      from generate_series(
        date_trunc('day', now() at time zone 'Asia/Riyadh') - interval '13 days',
        date_trunc('day', now() at time zone 'Asia/Riyadh'),
        interval '1 day'
      ) as d(day)
      left join orders o
        on date_trunc('day', o.created_at at time zone 'Asia/Riyadh') = d.day
      group by d.day
      order by d.day
    `),
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(8),
    db
      .select({
        id: variants.id,
        productId: products.id,
        name: products.name,
        optionValue: variants.optionValue,
        sku: variants.sku,
        stock: variants.stock,
      })
      .from(variants)
      .innerJoin(products, eq(variants.productId, products.id))
      .where(and(isNotNull(variants.stock), lte(variants.stock, 5), eq(variants.isActive, true)))
      .orderBy(asc(variants.stock))
      .limit(10),
    db.select({ c: dsql<number>`count(*)::int` }).from(customers),
  ]);

  const k = (kpiRows as unknown as Kpis[])[0];
  const today = Number(k?.today ?? 0);
  const last30 = Number(k?.last30 ?? 0);
  const ordersCount = Number(k?.orders_count ?? 0);
  const revenueOrders = Number(k?.revenue_orders ?? 0);
  const revenueTotal = Number(k?.revenue_total ?? 0);
  const toProcess = Number(k?.to_process ?? 0);
  const aov = revenueOrders ? Math.round(revenueTotal / revenueOrders) : 0;

  const chart = (chartRows as unknown as { day: string; total: string; orders: number }[]).map((r) => ({
    day: r.day,
    total: Number(r.total),
    orders: Number(r.orders),
  }));
  const max = Math.max(1, ...chart.map((c) => c.total));
  const W = 700;
  const H = 200;
  const slot = W / Math.max(1, chart.length);
  const barW = slot * 0.62;

  return (
    <>
      <PageHeader title="الرئيسية" subtitle="نظرة سريعة على أداء المتجر">
        <LinkButton href="/admin/orders" variant="dark">
          كل الطلبات
        </LinkButton>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="مبيعات اليوم" value={formatSar(today)} />
        <Stat label="مبيعات آخر 30 يومًا" value={formatSar(last30)} />
        <Stat label="عدد الطلبات" value={ordersCount.toLocaleString("en-US")} hint="غير الملغاة" />
        <Stat label="طلبات بانتظار التجهيز" value={toProcess.toLocaleString("en-US")} />
        <Stat label="متوسط قيمة الطلب" value={formatSar(aov)} />
        <Stat label="عدد العملاء" value={(customerCount[0]?.c ?? 0).toLocaleString("en-US")} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="المبيعات — آخر 14 يومًا" className="xl:col-span-2">
          <div dir="ltr">
          <svg viewBox={`0 0 ${W} ${H + 34}`} className="h-auto w-full" role="img" aria-label="مخطط المبيعات اليومية لآخر 14 يومًا">
            {[0, 0.5, 1].map((t) => (
              <line key={t} x1={0} x2={W} y1={H - t * (H - 24)} y2={H - t * (H - 24)} stroke="rgba(11,11,12,0.08)" strokeWidth={1} />
            ))}
            {chart.map((c, i) => {
              const h = c.total > 0 ? Math.max(4, (c.total / max) * (H - 24)) : 2;
              const x = i * slot + (slot - barW) / 2;
              const isToday = i === chart.length - 1;
              return (
                <g key={c.day}>
                  <title>{`${c.day} — ${formatAmount(c.total)} ر.س — ${c.orders} طلب`}</title>
                  <rect x={x} y={H - h} width={barW} height={h} rx={6} fill={isToday ? "#B6E000" : "#0B0B0C"} opacity={c.total > 0 ? 1 : 0.18} />
                  {c.total > 0 ? (
                    <text x={x + barW / 2} y={H - h - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="#0B0B0C">
                      {formatAmount(Math.round(c.total / 100) * 100)}
                    </text>
                  ) : null}
                  <text x={x + barW / 2} y={H + 20} textAnchor="middle" fontSize={11} fill="#55534E">
                    {`${c.day.slice(8, 10)}/${c.day.slice(5, 7)}`}
                  </text>
                </g>
              );
            })}
          </svg>
          </div>
          <p className="mt-2 text-[11px] text-ink-mute">
            المبالغ بالريال السعودي. تُحتسب الطلبات المدفوعة وطلبات الدفع عند الاستلام غير الملغاة.
          </p>
        </Card>

        <Card title="مخزون منخفض" padded={false}>
          {lowStock.length ? (
            <ul className="divide-y divide-line/70">
              {lowStock.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <Link href={`/admin/products/${v.productId}`} className="min-w-0 hover:underline">
                    <span className="block truncate font-semibold">{v.name}</span>
                    <span className="block truncate text-xs text-ink-mute">{v.optionValue ?? v.sku}</span>
                  </Link>
                  <Badge tone={(v.stock ?? 0) <= 0 ? "red" : "amber"}>{(v.stock ?? 0) <= 0 ? "نفد" : `${v.stock} متبقٍ`}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>لا توجد متغيرات بمخزون منخفض. (المخزون غير المحدود لا يظهر هنا)</EmptyState>
          )}
        </Card>
      </div>

      <Card title="أحدث الطلبات" className="mt-6" padded={false} actions={<LinkButton href="/admin/orders" size="sm">عرض الكل</LinkButton>}>
        {latest.length ? (
          <Table>
            <thead>
              <tr>
                <Th>رقم الطلب</Th>
                <Th>العميل</Th>
                <Th>الإجمالي</Th>
                <Th>الحالة</Th>
                <Th>الدفع</Th>
                <Th>التاريخ</Th>
              </tr>
            </thead>
            <tbody>
              {latest.map((o) => (
                <tr key={o.id} className="hover:bg-paper-card">
                  <Td>
                    <Link href={`/admin/orders/${o.id}`} className="font-bold hover:underline" dir="ltr">
                      {o.number}
                    </Link>
                  </Td>
                  <Td>{o.customerName}</Td>
                  <Td className="font-semibold">{formatSar(o.total)}</Td>
                  <Td>
                    <Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                  </Td>
                  <Td>
                    <Badge tone={PAYMENT_STATUS_TONE[o.paymentStatus]}>{PAYMENT_STATUS_LABEL[o.paymentStatus]}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-ink-mute">{fmtDateTime(o.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState>لا توجد طلبات بعد.</EmptyState>
        )}
      </Card>
    </>
  );
}

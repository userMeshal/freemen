import Link from "next/link";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Search } from "lucide-react";
import { db } from "@/db";
import { orders, stores, type OrderStatus } from "@/db/schema";
import { Badge, Empty, Money, ORDER_TONE, PageHead, TableWrap, fmtDate } from "@/components/dash/ui";
import { Pager } from "@/components/dash/hq/ui";
import { GATEWAY_LABEL, METHOD_LABEL, hrefWith, likePattern, one, pageOf } from "@/components/dash/hq/util";
import { requireHq } from "@/lib/auth";
import { latinDigits, normalizePhone } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/orders";

export const metadata = { title: "الطلبات" };

const PER_PAGE = 40;
const STATUSES = Object.keys(STATUS_LABEL) as OrderStatus[];

export default async function HqOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireHq();
  const sp = await searchParams;
  const q = latinDigits(one(sp.q)).trim().slice(0, 40);
  const status = STATUSES.find((s) => s === one(sp.status));
  const page = pageOf(one(sp.page));

  // البحث برقم الطلب أو جوال العميل (بأي صيغة: 05… أو 9665… أو جزء من الرقم)
  const pat = likePattern(q);
  const phone = q ? normalizePhone(q) : null;
  const search = q ? or(ilike(orders.number, pat), ilike(orders.customerPhone, pat), phone ? eq(orders.customerPhone, phone) : undefined) : undefined;
  const where = and(search, status ? eq(orders.status, status) : undefined);

  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: orders.id,
        number: orders.number,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        gateway: orders.gateway,
        total: orders.total,
        platformFee: orders.platformFee,
        customerName: orders.customerName,
        customerPhone: orders.customerPhone,
        city: orders.city,
        createdAt: orders.createdAt,
        storeId: stores.id,
        storeName: stores.name,
      })
      .from(orders)
      .innerJoin(stores, eq(stores.id, orders.storeId))
      .where(where)
      .orderBy(desc(orders.id))
      .limit(PER_PAGE)
      .offset((page - 1) * PER_PAGE),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(where),
  ]);
  const pages = Math.max(1, Math.ceil(total.n / PER_PAGE));

  return (
    <>
      <PageHead title="الطلبات" sub={`${total.n.toLocaleString("en-US")} طلب${q || status ? " مطابق للبحث" : " في كل المتاجر"}. للعرض فقط — إدارة الطلب من لوحة التاجر.`} />

      <form method="get" action="/hq/orders" className="mb-5 flex flex-wrap items-end gap-2">
        <label className="min-w-[12rem] flex-1">
          <span className="dash-label">بحث برقم الطلب أو جوال العميل</span>
          <input name="q" defaultValue={q} maxLength={40} dir="ltr" placeholder="ZR100001 / 05XXXXXXXX" className="dash-input text-end" />
        </label>
        <label>
          <span className="dash-label">الحالة</span>
          <select name="status" defaultValue={status ?? ""} className="dash-input">
            <option value="">كل الحالات</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="dash-btn dash-btn-ink">
          <Search size={16} /> بحث
        </button>
        {(q || status) && (
          <Link href="/hq/orders" className="dash-btn dash-btn-ghost">
            مسح
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <Empty title="لا توجد طلبات" text={q || status ? "لا يوجد طلب يطابق البحث. تأكد من الرقم أو امسح الفلتر." : "أول طلب في أي متجر سيظهر هنا."} />
      ) : (
        <TableWrap>
          <table className="dash-table">
            <thead>
              <tr>
                <th>الطلب</th>
                <th>المتجر</th>
                <th>العميل</th>
                <th>المبلغ</th>
                <th>عمولة زار</th>
                <th>الدفع</th>
                <th>الحالة</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td>
                    <span className="num font-semibold">{o.number}</span>
                  </td>
                  <td>
                    <Link href={`/hq/stores/${o.storeId}`} className="whitespace-nowrap font-medium underline-offset-4 hover:underline">
                      {o.storeName}
                    </Link>
                  </td>
                  <td>
                    <span className="block whitespace-nowrap">{o.customerName}</span>
                    <span className="block whitespace-nowrap text-xs text-ink/55">
                      <span className="num">{o.customerPhone}</span> · {o.city}
                    </span>
                  </td>
                  <td>
                    <Money value={o.total} />
                  </td>
                  <td>{o.platformFee > 0 ? <Money value={o.platformFee} className="text-ink/70" /> : <span className="text-ink/40">—</span>}</td>
                  <td>
                    <span className="block whitespace-nowrap">{METHOD_LABEL[o.paymentMethod] ?? o.paymentMethod}</span>
                    {o.gateway && <span className="block whitespace-nowrap text-xs text-ink/55">{GATEWAY_LABEL[o.gateway] ?? o.gateway}</span>}
                  </td>
                  <td>
                    <Badge tone={ORDER_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                  </td>
                  <td className="whitespace-nowrap text-xs text-ink/60">{fmtDate(o.createdAt, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      <Pager page={page} pages={pages} href={(p) => hrefWith("/hq/orders", { q, status, page: p > 1 ? p : undefined })} />
    </>
  );
}

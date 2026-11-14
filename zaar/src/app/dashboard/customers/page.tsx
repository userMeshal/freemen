import Link from "next/link";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { MessageCircle, Search } from "lucide-react";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { Pager } from "@/components/dash/merchant/Pager";
import { Empty, Money, PageHead, TableWrap, fmtDate } from "@/components/dash/ui";
import { requireMerchantStore } from "@/lib/auth";
import { latinDigits, normalizePhone } from "@/lib/money";
import { likeTerm, one, pageOf, waLink } from "../_lib/form";

export const metadata = { title: "العملاء" };

const PER_PAGE = 50;

export default async function CustomersPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { store } = await requireMerchantStore();
  const sp = await props.searchParams;
  const q = latinDigits(one(sp.q, 40));
  const page = pageOf(sp.page);

  const scope: SQL[] = [eq(customers.storeId, store.id)];
  if (q) {
    const match = or(ilike(customers.name, likeTerm(q)), ilike(customers.phone, likeTerm(normalizePhone(q) ?? q)));
    if (match) scope.push(match);
  }

  const [{ n: total }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(customers)
    .where(and(...scope));
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const current = Math.min(page, pages);
  const rows = await db
    .select()
    .from(customers)
    .where(and(...scope))
    .orderBy(desc(customers.totalSpent), desc(customers.ordersCount), desc(customers.id))
    .limit(PER_PAGE)
    .offset((current - 1) * PER_PAGE);

  return (
    <>
      <PageHead title="العملاء" sub="كل من طلب من متجرك، مرتّبين حسب إجمالي مشترياتهم. تواصل معهم مباشرة على واتساب." />

      <form action="/dashboard/customers" className="mb-5 flex max-w-xl gap-2">
        <div className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-ink/40" />
          <input name="q" defaultValue={q} placeholder="ابحث بالاسم أو رقم الجوال" className="dash-input !ps-10" maxLength={40} />
        </div>
        <button type="submit" className="dash-btn dash-btn-ink">
          بحث
        </button>
        {q && (
          <Link href="/dashboard/customers" className="dash-btn dash-btn-ghost">
            مسح
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <Empty title={q ? "ما لقينا عملاء بهذا البحث" : "ما عندك عملاء للحين"} text={q ? undefined : "أول ما يطلب أحد من متجرك بينضاف هنا تلقائيًا."} />
      ) : (
        <>
          <p className="mb-3 text-xs text-ink/55">
            <span className="num font-semibold text-ink">{total}</span> عميل
          </p>
          <TableWrap>
            <table className="dash-table">
              <thead>
                <tr>
                  <th>العميل</th>
                  <th>الجوال</th>
                  <th>المدينة</th>
                  <th>الطلبات</th>
                  <th>إجمالي المشتريات</th>
                  <th>آخر طلب</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const wa = waLink(c.phone);
                  return (
                    <tr key={c.id}>
                      <td>
                        <span className="block min-w-32 font-medium">{c.name}</span>
                        {c.email && (
                          <span className="block text-xs text-ink/50" dir="ltr">
                            {c.email}
                          </span>
                        )}
                      </td>
                      <td>
                        <Link href={`/dashboard/orders?q=${encodeURIComponent(c.phone)}`} className="num underline-offset-4 hover:underline" title="طلبات هذا العميل">
                          {c.phone}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-ink/70">{c.city || "—"}</td>
                      <td className="num font-semibold">{c.ordersCount}</td>
                      <td>
                        <Money value={c.totalSpent} />
                      </td>
                      <td className="whitespace-nowrap text-ink/65">{fmtDate(c.lastOrderAt)}</td>
                      <td>
                        {wa && (
                          <a href={wa} target="_blank" rel="noopener noreferrer" className="dash-btn dash-btn-ghost dash-btn-sm">
                            <MessageCircle size={14} /> واتساب
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        </>
      )}

      <Pager base="/dashboard/customers" params={{ q }} page={current} pages={pages} />
    </>
  );
}

import Link from "next/link";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { ExternalLink, Search } from "lucide-react";
import { db } from "@/db";
import { merchants, stores, type Store } from "@/db/schema";
import { Badge, Empty, Money, PageHead, TableWrap, fmtDate } from "@/components/dash/ui";
import { Pager } from "@/components/dash/hq/ui";
import { STORE_STATUS, THEME_LABEL, hrefWith, likePattern, one, pageOf, toNum } from "@/components/dash/hq/util";
import { requireHq } from "@/lib/auth";
import { storePublicUrl } from "@/lib/stores";

export const metadata = { title: "المتاجر" };

const PER_PAGE = 50;
const STATUSES: Store["status"][] = ["live", "draft", "suspended"];

export default async function HqStoresPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireHq();
  const sp = await searchParams;
  const q = one(sp.q).trim().slice(0, 80);
  const statusRaw = one(sp.status);
  const status = STATUSES.find((s) => s === statusRaw);
  const page = pageOf(one(sp.page));

  const pat = likePattern(q);
  const where = and(q ? or(ilike(stores.name, pat), ilike(stores.slug, pat)) : undefined, status ? eq(stores.status, status) : undefined);

  // الاستعلامات الفرعية تشير إلى stores.id نصًّا حتى تبقى مرتبطة بصف المتجر مهما كان شكل الاستعلام
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: stores.id,
        name: stores.name,
        slug: stores.slug,
        theme: stores.theme,
        status: stores.status,
        createdAt: stores.createdAt,
        merchantName: merchants.name,
        merchantPhone: merchants.phone,
        products: sql<number>`(select count(*)::int from products p where p.store_id = stores.id)`,
        paidOrders: sql<number>`(select count(*)::int from orders o where o.store_id = stores.id and o.status in ('paid','processing','shipped','delivered'))`,
        gmv: sql<number>`(select coalesce(sum(o.total), 0)::float8 from orders o where o.store_id = stores.id and o.status in ('paid','processing','shipped','delivered'))`,
      })
      .from(stores)
      .leftJoin(merchants, eq(merchants.id, stores.merchantId))
      .where(where)
      .orderBy(desc(stores.id))
      .limit(PER_PAGE)
      .offset((page - 1) * PER_PAGE),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(stores)
      .where(where),
  ]);
  const pages = Math.max(1, Math.ceil(total.n / PER_PAGE));

  return (
    <>
      <PageHead title="المتاجر" sub={`${total.n.toLocaleString("en-US")} متجر${q || status ? " مطابق للبحث" : " على المنصة"}.`} />

      <form method="get" action="/hq/stores" className="mb-5 flex flex-wrap items-end gap-2">
        <label className="min-w-[12rem] flex-1">
          <span className="dash-label">بحث بالاسم أو الرابط</span>
          <input name="q" defaultValue={q} maxLength={80} placeholder="اسم المتجر أو slug" className="dash-input" />
        </label>
        <label>
          <span className="dash-label">الحالة</span>
          <select name="status" defaultValue={status ?? ""} className="dash-input">
            <option value="">كل الحالات</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STORE_STATUS[s].label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="dash-btn dash-btn-ink">
          <Search size={16} /> بحث
        </button>
        {(q || status) && (
          <Link href="/hq/stores" className="dash-btn dash-btn-ghost">
            مسح
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <Empty title="لا توجد متاجر" text={q || status ? "لا يوجد متجر يطابق البحث. جرّب كلمة أخرى أو امسح الفلتر." : "أول متجر يُنشأ على المنصة سيظهر هنا."} />
      ) : (
        <TableWrap>
          <table className="dash-table">
            <thead>
              <tr>
                <th>المتجر</th>
                <th>التاجر</th>
                <th>الحالة</th>
                <th>المنتجات</th>
                <th>طلبات مدفوعة</th>
                <th>المبيعات</th>
                <th>تاريخ الإنشاء</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/hq/stores/${s.id}`} className="font-semibold underline-offset-4 hover:underline">
                      {s.name}
                    </Link>
                    <a
                      href={storePublicUrl(s.slug)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 flex w-fit items-center gap-1 text-xs text-ink/55 hover:text-ink"
                    >
                      <span className="num">{s.slug}</span> <ExternalLink size={12} />
                    </a>
                    <span className="mt-0.5 block text-xs text-ink/45">ثيم {THEME_LABEL[s.theme] ?? s.theme}</span>
                  </td>
                  <td>
                    {s.merchantName ? (
                      <>
                        <span className="block whitespace-nowrap">{s.merchantName}</span>
                        <span className="num block text-xs text-ink/55">{s.merchantPhone}</span>
                      </>
                    ) : (
                      <span className="whitespace-nowrap text-xs text-ink/45">بلا تاجر</span>
                    )}
                  </td>
                  <td>
                    <Badge tone={STORE_STATUS[s.status].tone}>{STORE_STATUS[s.status].label}</Badge>
                  </td>
                  <td>
                      <span className="num">{s.products}</span>
                    </td>
                  <td>
                      <span className="num">{s.paidOrders}</span>
                    </td>
                  <td>
                    <Money value={toNum(s.gmv)} />
                  </td>
                  <td className="whitespace-nowrap text-xs text-ink/60">{fmtDate(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      <Pager page={page} pages={pages} href={(p) => hrefWith("/hq/stores", { q, status, page: p > 1 ? p : undefined })} />
    </>
  );
}

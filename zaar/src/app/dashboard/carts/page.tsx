import { and, desc, eq, gte, sql } from "drizzle-orm";
import { MessageCircle } from "lucide-react";
import { db } from "@/db";
import { abandonedCarts } from "@/db/schema";
import { Empty, Money, PageHead, Stat, TableWrap } from "@/components/dash/ui";
import { requireMerchantStore } from "@/lib/auth";
import { formatAmount } from "@/lib/money";
import { storePublicUrl } from "@/lib/stores";
import { waLink } from "../_lib/form";

export const metadata = { title: "السلال المتروكة" };

const DAYS = 30;

function since(d: Date): string {
  const mins = Math.max(1, Math.round((Date.now() - d.getTime()) / 60000));
  if (mins < 60) return `قبل ${mins} دقيقة`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? "قبل ساعة" : hours === 2 ? "قبل ساعتين" : `قبل ${hours} ساعة`;
  const days = Math.round(hours / 24);
  return days === 1 ? "أمس" : days === 2 ? "قبل يومين" : `قبل ${days} يوم`;
}

export default async function CartsPage() {
  const { store } = await requireMerchantStore();
  const cutoff = new Date(Date.now() - DAYS * 24 * 3600 * 1000);
  const recent = and(eq(abandonedCarts.storeId, store.id), gte(abandonedCarts.updatedAt, cutoff));
  const [rows, [stats]] = await Promise.all([
    db
      .select()
      .from(abandonedCarts)
      .where(and(recent, eq(abandonedCarts.recovered, false)))
      .orderBy(desc(abandonedCarts.updatedAt))
      .limit(200),
    db
      .select({
        open: sql<number>`(count(*) filter (where not ${abandonedCarts.recovered}))::int`,
        value: sql<number>`coalesce(sum(${abandonedCarts.total}) filter (where not ${abandonedCarts.recovered}), 0)::int`,
        recovered: sql<number>`(count(*) filter (where ${abandonedCarts.recovered}))::int`,
      })
      .from(abandonedCarts)
      .where(recent),
  ]);
  const url = storePublicUrl(store.slug);

  return (
    <>
      <PageHead
        title="السلال المتروكة"
        sub={`عملاء كتبوا رقم جوالهم في صفحة الدفع وما كمّلوا الطلب خلال آخر ${DAYS} يوم. رسالة واتساب لطيفة ترجّع كثير منهم.`}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="سلال تنتظر التذكير" value={stats.open} />
        <Stat label="قيمتها" value={formatAmount(stats.value)} hint="ر.س" accent />
        <Stat label="سلال رجعت وكمّلت الطلب" value={stats.recovered} hint={`آخر ${DAYS} يوم`} />
      </div>

      {rows.length === 0 ? (
        <Empty title="ما فيه سلال متروكة" text="أي عميل يبدأ الدفع وما يكمّل بيظهر هنا عشان تذكّره." />
      ) : (
        <TableWrap>
          <table className="dash-table">
            <thead>
              <tr>
                <th>العميل</th>
                <th>محتوى السلة</th>
                <th>القيمة</th>
                <th>آخر نشاط</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const first = c.name.trim().split(/\s+/)[0];
                const message = `هلا${first ? ` ${first}` : ""}،\nلاحظنا إنك اخترت منتجات من ${store.name} وما كمّلت طلبك. إذا واجهتك أي مشكلة أو عندك سؤال حنا حاضرين.\nتقدر تكمّل طلبك من هنا:\n${url}`;
                const wa = waLink(c.phone, message);
                const qty = c.items.reduce((s, i) => s + i.qty, 0);
                return (
                  <tr key={c.id}>
                    <td>
                      <span className="block min-w-28 font-medium">{c.name || "بدون اسم"}</span>
                      <span className="num block text-xs text-ink/55">{c.phone}</span>
                    </td>
                    <td>
                      <span className="line-clamp-2 block min-w-48 max-w-sm text-sm leading-relaxed text-ink/75">
                        {c.items.map((i) => `${i.name}${i.optionValue ? ` (${i.optionValue})` : ""} × ${i.qty}`).join("، ")}
                      </span>
                      <span className="block text-xs text-ink/45">
                        <span className="num">{qty}</span> قطعة
                      </span>
                    </td>
                    <td>
                      <Money value={c.total} />
                    </td>
                    <td className="whitespace-nowrap text-ink/65">{since(c.updatedAt)}</td>
                    <td>
                      {wa ? (
                        <a href={wa} target="_blank" rel="noopener noreferrer" className="dash-btn dash-btn-accent dash-btn-sm">
                          <MessageCircle size={14} /> ذكّره على واتساب
                        </a>
                      ) : (
                        <span className="text-xs text-ink/45">رقم غير صالح للواتساب</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}

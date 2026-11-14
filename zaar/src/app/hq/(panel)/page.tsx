import Link from "next/link";
import { and, desc, eq, gte, inArray, isNull, sql, type AnyColumn } from "drizzle-orm";
import { db } from "@/db";
import { claims, ledger, orders, payouts, stores } from "@/db/schema";
import { Badge, Card, Empty, Money, ORDER_TONE, PageHead, Stat, TableWrap, fmtDate } from "@/components/dash/ui";
import { Note } from "@/components/dash/hq/ui";
import { PAID_STATUSES, toNum } from "@/components/dash/hq/util";
import { aiEnabled, aiModel } from "@/lib/ai/claude";
import { requireHq } from "@/lib/auth";
import { formatAmount } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/orders";
import { edfapayConfigured, paymentOptions, testPaymentsEnabled } from "@/lib/payments";
import { tabbyConfigured } from "@/lib/payments/tabby";
import { tamaraConfigured } from "@/lib/payments/tamara";
import { riyadhDay, riyadhMidnight } from "@/lib/platform";

export const metadata = { title: "نظرة عامة" };

const DAY_MS = 24 * 3600 * 1000;
const CHART_DAYS = 14;

/** المجاميع على مستوى المنصة قد تتجاوز حد int32 بالهللة، فنجمعها كـ float8 */
const sumOf = (col: AnyColumn) => sql<number>`coalesce(sum(${col}), 0)::float8`;
const countAll = sql<number>`count(*)::int`;

export default async function HqOverviewPage() {
  await requireHq();

  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  const today0 = riyadhMidnight(now);
  const chartSince = new Date(today0.getTime() - (CHART_DAYS - 1) * DAY_MS);
  const paid = inArray(orders.status, PAID_STATUSES);
  const dayExpr = sql<string>`to_char(${orders.paidAt} at time zone 'Asia/Riyadh', 'YYYY-MM-DD')`;

  const [[month], [today], storeCounts, [pendingPayouts], [unsettled], claimCounts, [manualRefunds], series, recent] = await Promise.all([
    db
      .select({ gmv: sumOf(orders.total), fee: sumOf(orders.platformFee), n: countAll })
      .from(orders)
      .where(and(paid, gte(orders.paidAt, since30))),
    db
      .select({ gmv: sumOf(orders.total), n: countAll })
      .from(orders)
      .where(and(paid, gte(orders.paidAt, today0))),
    db.select({ status: stores.status, n: countAll }).from(stores).groupBy(stores.status),
    db
      .select({ total: sumOf(payouts.amount), n: countAll })
      .from(payouts)
      .where(eq(payouts.status, "pending")),
    db
      .select({ total: sumOf(ledger.amount) })
      .from(ledger)
      .where(isNull(ledger.payoutId)),
    db
      .select({ status: claims.status, n: countAll })
      .from(claims)
      .where(inArray(claims.status, ["open", "merchant_replied"]))
      .groupBy(claims.status),
    db
      .select({ n: countAll })
      .from(claims)
      .where(eq(claims.refundState, "manual_pending")),
    db
      .select({ day: dayExpr, gmv: sumOf(orders.total), n: countAll })
      .from(orders)
      .where(and(paid, gte(orders.paidAt, chartSince)))
      .groupBy(dayExpr),
    db
      .select({
        id: orders.id,
        number: orders.number,
        status: orders.status,
        total: orders.total,
        platformFee: orders.platformFee,
        paidAt: orders.paidAt,
        customerName: orders.customerName,
        storeId: stores.id,
        storeName: stores.name,
      })
      .from(orders)
      .innerJoin(stores, eq(stores.id, orders.storeId))
      .where(paid)
      .orderBy(desc(orders.paidAt))
      .limit(10),
  ]);

  const storeBy = Object.fromEntries(storeCounts.map((s) => [s.status, s.n])) as Record<string, number>;
  const storesTotal = storeCounts.reduce((s, x) => s + x.n, 0);
  const claimBy = Object.fromEntries(claimCounts.map((c) => [c.status, c.n])) as Record<string, number>;
  const openClaims = (claimBy.open ?? 0) + (claimBy.merchant_replied ?? 0);

  // سلسلة آخر 14 يومًا (بتوقيت الرياض) مع تعبئة الأيام الخالية بصفر
  const byDay = new Map(series.map((s) => [s.day, { gmv: toNum(s.gmv), n: s.n }]));
  const todayKey = riyadhDay(now);
  const points = Array.from({ length: CHART_DAYS }, (_, i) => {
    const key = riyadhDay(new Date(now.getTime() - (CHART_DAYS - 1 - i) * DAY_MS));
    const hit = byDay.get(key);
    return { key, gmv: hit?.gmv ?? 0, n: hit?.n ?? 0, isToday: key === todayKey };
  });
  const peak = Math.max(...points.map((p) => p.gmv), 0);
  const chartTotal = points.reduce((s, p) => s + p.gmv, 0);

  const testMode = testPaymentsEnabled();
  const isProd = process.env.NODE_ENV === "production";
  const offered = paymentOptions();
  const integrations: { name: string; hint: string; on: boolean }[] = [
    { name: "EdfaPay", hint: "مدى / فيزا / ماستركارد / Apple Pay", on: edfapayConfigured() },
    { name: "تابي", hint: "تقسيط على 4 دفعات", on: tabbyConfigured() },
    { name: "تمارا", hint: "تقسيط على 3 دفعات", on: tamaraConfigured() },
    { name: "Claude AI", hint: aiEnabled() ? `النموذج: ${aiModel()}` : "بدونه يعمل المولّد المحلي", on: aiEnabled() },
    { name: "تخزين الصور (Blob)", hint: "رفع صور المنتجات", on: Boolean(process.env.BLOB_READ_WRITE_TOKEN) },
    { name: "سر المهام اليومية (Cron)", hint: "التسوية اليومية الآلية", on: Boolean(process.env.CRON_SECRET) },
  ];

  return (
    <>
      <PageHead title="نظرة عامة" sub="أداء المنصة كاملة: المبيعات، إيراد زار، التحويلات المستحقة للتجار، وطلبات الضمان." />

      {testMode && isProd && (
        <Note tone="bad">
          <strong className="font-bold">تحذير: وضع الدفع التجريبي مفعّل في بيئة الإنتاج.</strong> أي وسيلة دفع غير مربوطة تمرّ عبر صفحة دفع وهمية وتُسجَّل طلباتها كمدفوعة دون
          تحصيل فعلي، وتدخل في أرصدة التجار وتحويلاتهم. اضبط <code className="num font-semibold">ZAAR_TEST_PAYMENTS=0</code> ثم أعد النشر.
        </Note>
      )}
      {!testMode && offered.length === 0 && (
        <Note tone="warn">لا توجد أي وسيلة دفع مربوطة، فلن يستطيع العملاء إتمام الطلبات. اربط EdfaPay أو تابي أو تمارا من متغيرات البيئة.</Note>
      )}

      {/* المبالغ في بطاقات عريضة (عمودان على الأكثر) حتى لا تضيق بالأرقام الكبيرة */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat accent label="إجمالي المبيعات — آخر 30 يومًا" value={formatAmount(toNum(month.gmv))} hint={`ر.س · ${month.n.toLocaleString("en-US")} طلب مدفوع`} />
        <Stat label="إيراد زار — آخر 30 يومًا" value={formatAmount(toNum(month.fee))} hint="ر.س · عمولات الطلبات المدفوعة" />
        <Link href="/hq/payouts" className="block transition-transform hover:-translate-y-0.5">
          <Stat
            label="تحويلات بانتظار التنفيذ"
            value={formatAmount(toNum(pendingPayouts.total))}
            hint={`ر.س · عدد التحويلات: ${pendingPayouts.n.toLocaleString("en-US")}`}
          />
        </Link>
        <Stat label="أرصدة التجار غير المحوّلة" value={formatAmount(toNum(unsettled.total))} hint="ر.س · حركات لم تدخل في تحويل بعد" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="طلبات مدفوعة اليوم" value={today.n.toLocaleString("en-US")} hint={<Money value={toNum(today.gmv)} />} />
        <Stat
          label="متاجر منشورة"
          value={(storeBy.live ?? 0).toLocaleString("en-US")}
          hint={`من ${storesTotal.toLocaleString("en-US")} متجر · ${(storeBy.draft ?? 0).toLocaleString("en-US")} مسودة · ${(storeBy.suspended ?? 0).toLocaleString("en-US")} موقوف`}
        />
        <Link href="/hq/claims" className="col-span-2 block transition-transform hover:-translate-y-0.5 sm:col-span-1">
          <Stat
            label="طلبات ضمان مفتوحة"
            value={openClaims.toLocaleString("en-US")}
            hint={`${(claimBy.merchant_replied ?? 0).toLocaleString("en-US")} تحتاج قرارك · ${manualRefunds.n.toLocaleString("en-US")} استرداد يدوي معلّق`}
          />
        </Link>
      </div>

      <Card className="mt-6" title={`المبيعات اليومية — آخر ${CHART_DAYS} يومًا`}>
        <div className="mb-5 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm text-ink/60">
          <span>
            الإجمالي: <Money value={chartTotal} className="text-ink" />
          </span>
          <span>
            أعلى يوم: <Money value={peak} className="text-ink" />
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-ink/35" aria-hidden /> اليوم (لم يكتمل)
          </span>
        </div>

        {peak === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink/20 px-4 py-10 text-center text-sm text-ink/55">لا توجد مبيعات مدفوعة في هذه الفترة.</p>
        ) : (
          <div aria-hidden>
            <div className="flex h-44 items-end gap-0.5 border-b border-ink/15 sm:gap-1.5">
              {points.map((p, i) => {
                const pct = p.gmv > 0 ? Math.max((p.gmv / peak) * 100, 2) : 0;
                // التلميح يُثبَّت لطرف العمود عند الحواف حتى لا يخرج عن البطاقة
                const anchor = i < 3 ? "start-0" : i > CHART_DAYS - 4 ? "end-0" : "left-1/2 -translate-x-1/2";
                return (
                  <div key={p.key} className="group relative flex h-full min-w-0 flex-1 items-end justify-center">
                    <div
                      className={`w-full max-w-6 rounded-t-[4px] transition-colors ${p.isToday ? "bg-ink/35 group-hover:bg-ink/55" : "bg-ink group-hover:bg-ink/75"}`}
                      style={{ height: `${pct}%` }}
                    />
                    <div
                      className={`pointer-events-none absolute bottom-full z-10 mb-2 hidden whitespace-nowrap rounded-xl bg-ink px-3 py-2 text-xs leading-relaxed text-paper shadow-lg group-hover:block ${anchor}`}
                    >
                      <span className="block text-paper/60">{fmtDate(p.key)}</span>
                      <span className="block font-semibold">
                        <span className="num">{formatAmount(p.gmv)}</span> ر.س
                      </span>
                      <span className="block text-paper/60">
                        الطلبات: <span className="num">{p.n}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-1.5 flex gap-0.5 sm:gap-1.5">
              {points.map((p) => (
                <span key={p.key} className={`num min-w-0 flex-1 text-center text-[0.65rem] ${p.isToday ? "font-bold text-ink" : "text-ink/45"}`}>
                  {Number(p.key.slice(8))}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* عرض جدولي لنفس البيانات: لقارئات الشاشة ولمن يريد الأرقام بدقة */}
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-xs font-medium text-ink/55 hover:text-ink">عرض الأرقام كجدول</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>اليوم</th>
                  <th>المبيعات</th>
                  <th>الطلبات</th>
                </tr>
              </thead>
              <tbody>
                {[...points].reverse().map((p) => (
                  <tr key={p.key}>
                    <td>
                      {fmtDate(p.key)}
                      {p.isToday && <span className="text-ink/50"> (اليوم)</span>}
                    </td>
                    <td>
                      <Money value={p.gmv} />
                    </td>
                    <td>
                      <span className="num">{p.n}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Card>

      <div className="mt-6 space-y-6">
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-base font-bold">آخر الطلبات</h2>
            <Link href="/hq/orders" className="text-xs font-semibold text-ink/60 underline underline-offset-4 hover:text-ink">
              كل الطلبات
            </Link>
          </div>
          {recent.length === 0 ? (
            <Empty title="لا توجد طلبات مدفوعة بعد" text="أول طلب مدفوع في أي متجر سيظهر هنا." />
          ) : (
            <TableWrap>
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>الطلب</th>
                    <th>المتجر</th>
                    <th>المبلغ</th>
                    <th>عمولة زار</th>
                    <th>الحالة</th>
                    <th>وقت الدفع</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <span className="num font-semibold">{o.number}</span>
                        <span className="block text-xs text-ink/50">{o.customerName}</span>
                      </td>
                      <td>
                        <Link href={`/hq/stores/${o.storeId}`} className="whitespace-nowrap font-medium underline-offset-4 hover:underline">
                          {o.storeName}
                        </Link>
                      </td>
                      <td>
                        <Money value={o.total} />
                      </td>
                      <td>
                        <Money value={o.platformFee} className="text-ink/70" />
                      </td>
                      <td>
                        <Badge tone={ORDER_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                      </td>
                      <td className="whitespace-nowrap text-xs text-ink/60">{fmtDate(o.paidAt, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </section>

        <Card title="حالة الربط">
          <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
            {integrations.map((it) => (
              <li key={it.name} className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{it.name}</span>
                  <span className="block truncate text-xs text-ink/50">{it.hint}</span>
                </span>
                <Badge tone={it.on ? "good" : "neutral"}>{it.on ? "مربوط" : "غير مربوط"}</Badge>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 border-t border-ink/10 pt-3 sm:col-span-2 xl:col-span-3">
              <span className="min-w-0">
                <span className="block text-sm font-semibold">وضع الدفع التجريبي</span>
                <span className="block text-xs leading-relaxed text-ink/50">
                  {testMode ? "الوسائل غير المربوطة تمرّ عبر صفحة دفع وهمية" : "تظهر للعملاء الوسائل المربوطة فقط"}
                </span>
              </span>
              <Badge tone={testMode ? (isProd ? "bad" : "warn") : "good"}>{testMode ? "مفعّل" : "متوقف"}</Badge>
            </li>
          </ul>
          <p className="mt-4 border-t border-ink/10 pt-3 text-xs leading-relaxed text-ink/55">
            {offered.length === 0
              ? "لا تظهر للعملاء أي وسيلة دفع حاليًا."
              : `يظهر للعملاء عند الدفع: ${offered.map((o) => `${{ card: "البطاقات", tabby: "تابي", tamara: "تمارا" }[o.id] ?? o.id}${o.test ? " (تجريبي)" : ""}`).join("، ")}.`}
          </p>
        </Card>
      </div>
    </>
  );
}

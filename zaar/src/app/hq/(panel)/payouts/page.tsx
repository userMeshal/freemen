import Link from "next/link";
import { asc, desc, eq, sql } from "drizzle-orm";
import { Download } from "lucide-react";
import { db } from "@/db";
import { payouts, stores } from "@/db/schema";
import { CopyButton, Submit } from "@/components/dash/client";
import { Badge, Empty, Money, PageHead, Stat, TableWrap, Tabs, fmtDate } from "@/components/dash/ui";
import { HqForm, PayoutActions } from "@/components/dash/hq/client";
import { Note, Pager } from "@/components/dash/hq/ui";
import { hrefWith, one, pageOf, prettyIban, toNum } from "@/components/dash/hq/util";
import { requireHq } from "@/lib/auth";
import { formatAmount, formatSar } from "@/lib/money";
import { payoutFailed, payoutSent, runPayoutsNow } from "./actions";

export const metadata = { title: "التحويلات اليومية" };

const PER_PAGE = 50;
type Tab = "pending" | "sent" | "failed";
const TABS: Tab[] = ["pending", "sent", "failed"];
const tabHref = (t: Tab) => (t === "pending" ? "/hq/payouts" : `/hq/payouts?tab=${t}`);

export default async function HqPayoutsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireHq();
  const sp = await searchParams;
  const tab: Tab = TABS.find((t) => t === one(sp.tab)) ?? "pending";
  const page = pageOf(one(sp.page));

  const [summary, rows] = await Promise.all([
    db
      .select({ status: payouts.status, n: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${payouts.amount}), 0)::float8` })
      .from(payouts)
      .groupBy(payouts.status),
    db
      .select({
        payout: payouts,
        storeId: stores.id,
        storeName: stores.name,
        storeStatus: stores.status,
        storeIban: stores.iban,
      })
      .from(payouts)
      .innerJoin(stores, eq(stores.id, payouts.storeId))
      .where(eq(payouts.status, tab))
      // المعلّقة: الأقدم أولًا (الأحق بالتنفيذ) وكلها في صفحة واحدة. غيرها: الأحدث أولًا مع ترقيم.
      .orderBy(tab === "pending" ? asc(payouts.id) : desc(payouts.id))
      .limit(tab === "pending" ? 1000 : PER_PAGE)
      .offset(tab === "pending" ? 0 : (page - 1) * PER_PAGE),
  ]);

  const by = Object.fromEntries(summary.map((s) => [s.status, { n: s.n, total: toNum(s.total) }])) as Partial<Record<Tab, { n: number; total: number }>>;
  const pending = by.pending ?? { n: 0, total: 0 };
  const pages = Math.max(1, Math.ceil((by[tab]?.n ?? 0) / PER_PAGE));

  return (
    <>
      <PageHead title="التحويلات اليومية" sub="تسوية أرباح التجار: كل يوم يُنشأ لكل متجر تحويل واحد بمجموع حركاته المستحقة إلى الآيبان المسجّل.">
        <a href="/api/hq/payouts.csv" download className="dash-btn dash-btn-ghost">
          <Download size={16} /> تصدير CSV
        </a>
        <HqForm action={runPayoutsNow} confirm="تشغيل تسوية اليوم الآن؟ يُنشأ تحويل لكل متجر له رصيد مستحق." className="max-w-xs">
          <Submit className="dash-btn dash-btn-ink" pendingText="جارٍ إنشاء التحويلات…">
            شغّل تسوية اليوم الآن
          </Submit>
        </HqForm>
      </PageHead>

      <Note>
        الحوالة البنكية نفسها ينفّذها فريق المالية في زار من حساب الشركة البنكي (ملف تحويل جماعي). صدّر ملف CSV، نفّذ الحوالات من البنك، ثم سجّل كل تحويل هنا «تم التحويل» مع
        مرجع الحوالة ليظهر للتاجر في محفظته.
      </Note>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_14rem]">
        <Stat accent label="إجمالي التحويلات المعلّقة" value={formatAmount(pending.total)} hint={`ر.س · عدد التحويلات: ${pending.n.toLocaleString("en-US")}`} />
        <Stat label="إجمالي ما حُوِّل للتجار" value={formatAmount(by.sent?.total ?? 0)} hint={`ر.س · عدد التحويلات: ${(by.sent?.n ?? 0).toLocaleString("en-US")}`} />
        <div className="sm:col-span-2 xl:col-span-1">
          <Stat label="تحويلات فاشلة" value={(by.failed?.n ?? 0).toLocaleString("en-US")} hint="مبالغها رجعت لأرصدة التجار" />
        </div>
      </div>

      <Tabs
        current={tabHref(tab)}
        items={[
          { href: tabHref("pending"), label: "بانتظار التحويل", count: pending.n },
          { href: tabHref("sent"), label: "تم التحويل", count: by.sent?.n ?? 0 },
          { href: tabHref("failed"), label: "فشل", count: by.failed?.n ?? 0 },
        ]}
      />

      {rows.length === 0 ? (
        <Empty
          title={tab === "pending" ? "لا توجد تحويلات معلّقة" : tab === "sent" ? "لا توجد تحويلات منفّذة بعد" : "لا توجد تحويلات فاشلة"}
          text={tab === "pending" ? "تُنشأ التحويلات تلقائيًا كل يوم بعد منتصف الليل، أو شغّل تسوية اليوم يدويًا من الزر أعلاه." : undefined}
        />
      ) : tab === "pending" ? (
        <ul className="space-y-3">
          {rows.map(({ payout: p, storeId, storeName, storeStatus, storeIban }) => (
            <li key={p.id} className="dash-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <Link href={`/hq/stores/${storeId}`} className="font-display text-base font-bold underline-offset-4 [overflow-wrap:anywhere] hover:underline">
                      {storeName}
                    </Link>
                    {storeStatus === "suspended" && <Badge tone="bad">المتجر موقوف</Badge>}
                  </p>
                  <p className="mt-1 text-xs text-ink/55">
                    تحويل <span className="num">#{p.id}</span> · يوم التسوية {fmtDate(p.day)} · عدد الطلبات: <span className="num">{p.ordersCount}</span>
                  </p>
                </div>
                <Money value={p.amount} className="font-display text-xl" />
              </div>

              <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-[1.7fr_1fr_1fr]">
                <div className="min-w-0">
                  <dt className="text-xs text-ink/55">الآيبان</dt>
                  <dd className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="num text-[0.82rem] font-semibold">{prettyIban(p.iban)}</span>
                    <CopyButton value={p.iban} />
                  </dd>
                  {storeIban !== p.iban && (
                    <dd className="mt-1.5">
                      <Badge tone="warn">التاجر غيّر الآيبان بعد إنشاء التحويل</Badge>
                    </dd>
                  )}
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-ink/55">صاحب الحساب</dt>
                  <dd className="mt-1 font-medium [overflow-wrap:anywhere]">{p.bankHolder || "—"}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-ink/55">البنك</dt>
                  <dd className="mt-1 font-medium [overflow-wrap:anywhere]">{p.bankName || "—"}</dd>
                </div>
              </dl>

              <div className="mt-4 border-t border-ink/10 pt-4">
                <PayoutActions id={p.id} summary={`${formatSar(p.amount)} إلى ${p.bankHolder || storeName}`} sentAction={payoutSent} failedAction={payoutFailed} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <TableWrap>
          <table className="dash-table">
            <thead>
              <tr>
                <th>المتجر</th>
                <th>المبلغ</th>
                <th>الآيبان</th>
                <th>صاحب الحساب</th>
                <th>يوم التسوية</th>
                <th>{tab === "sent" ? "مرجع الحوالة" : "سبب الفشل"}</th>
                {tab === "sent" && <th>وقت التحويل</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ payout: p, storeId, storeName }) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/hq/stores/${storeId}`} className="font-semibold underline-offset-4 hover:underline">
                      {storeName}
                    </Link>
                    <span className="num block text-xs text-ink/45">#{p.id}</span>
                  </td>
                  <td>
                    <Money value={p.amount} />
                  </td>
                  <td>
                    <span className="num whitespace-nowrap text-xs">{prettyIban(p.iban)}</span>
                  </td>
                  <td>{p.bankHolder || "—"}</td>
                  <td className="whitespace-nowrap">{fmtDate(p.day)}</td>
                  <td className="max-w-[16rem] break-words text-xs">{p.reference || "—"}</td>
                  {tab === "sent" && <td className="whitespace-nowrap text-xs text-ink/60">{fmtDate(p.sentAt, true)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      {tab === "pending" && pending.n > rows.length && (
        <p className="mt-3 text-xs text-ink/55">يُعرض أقدم {rows.length.toLocaleString("en-US")} تحويل. ملف CSV يحتوي كل التحويلات المعلّقة.</p>
      )}
      {tab !== "pending" && <Pager page={page} pages={pages} href={(n) => hrefWith("/hq/payouts", { tab, page: n > 1 ? n : undefined })} />}
    </>
  );
}

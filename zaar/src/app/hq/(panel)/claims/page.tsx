import Link from "next/link";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { claims, orders, stores, type Claim, type ClaimStatus } from "@/db/schema";
import { ActionButton, CopyButton, Submit } from "@/components/dash/client";
import { Badge, Empty, Money, PageHead, Tabs, fmtDate, type Tone } from "@/components/dash/ui";
import { ClaimDecision, HqForm } from "@/components/dash/hq/client";
import { Note, Pager } from "@/components/dash/hq/ui";
import { GATEWAY_LABEL, hrefWith, one, pageOf } from "@/components/dash/hq/util";
import { requireHq } from "@/lib/auth";
import { CLAIM_REASONS } from "@/lib/claims";
import { formatSar } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/orders";
import { getPlatform } from "@/lib/platform";
import { approveExpiredNow, confirmRefund, decideClaim } from "./actions";

export const metadata = { title: "ضمان زار" };

const PER_PAGE = 30;
type Tab = "decide" | "open" | "manual" | "done";
const TABS: Tab[] = ["decide", "open", "manual", "done"];
const tabHref = (t: Tab) => (t === "decide" ? "/hq/claims" : `/hq/claims?tab=${t}`);

const CLAIM_STATUS: Record<ClaimStatus, { label: string; tone: Tone }> = {
  open: { label: "بانتظار رد التاجر", tone: "warn" },
  merchant_replied: { label: "اعترض التاجر", tone: "info" },
  approved: { label: "استرداد معتمد", tone: "good" },
  rejected: { label: "مرفوض", tone: "bad" },
};

const REFUND_STATE: Record<Claim["refundState"], { label: string; tone: Tone } | null> = {
  none: null,
  gateway: { label: "رُدّ المبلغ عبر البوابة", tone: "good" },
  manual_pending: { label: "استرداد يدوي معلّق", tone: "warn" },
  manual_done: { label: "رُدّ المبلغ يدويًا", tone: "good" },
};

const EMPTY: Record<Tab, { title: string; text: string }> = {
  decide: { title: "لا توجد طلبات تحتاج قرارك", text: "تظهر هنا الطلبات التي اعترض عليها التاجر وتنتظر حسم إدارة زار." },
  open: { title: "لا توجد طلبات بانتظار التاجر", text: "تظهر هنا طلبات الاسترداد الجديدة إلى أن يرد التاجر أو تنتهي مهلته." },
  manual: { title: "لا توجد استردادات يدوية معلّقة", text: "تظهر هنا الطلبات المعتمدة التي تعذّر ردّ مبلغها آليًا عبر بوابة الدفع." },
  done: { title: "لا توجد طلبات محسومة بعد", text: "تظهر هنا الطلبات المعتمدة والمرفوضة." },
};

export default async function HqClaimsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireHq();
  const sp = await searchParams;
  const tab: Tab = TABS.find((t) => t === one(sp.tab)) ?? "decide";
  const page = pageOf(one(sp.page));

  const where = {
    decide: eq(claims.status, "merchant_replied"),
    open: eq(claims.status, "open"),
    manual: eq(claims.refundState, "manual_pending"),
    done: inArray(claims.status, ["approved", "rejected"]),
  }[tab];
  // ما ينتظر إجراءً: الأقدم أولًا. المحسوم: الأحدث أولًا.
  const order = {
    decide: asc(claims.repliedAt),
    open: asc(claims.createdAt),
    manual: asc(claims.resolvedAt),
    done: desc(claims.resolvedAt),
  }[tab];

  const [cfg, statusCounts, [manualCount], rows] = await Promise.all([
    getPlatform(),
    db.select({ status: claims.status, n: sql<number>`count(*)::int` }).from(claims).groupBy(claims.status),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(claims)
      .where(eq(claims.refundState, "manual_pending")),
    db
      .select({
        claim: claims,
        storeName: stores.name,
        orderNumber: orders.number,
        orderStatus: orders.status,
        gateway: orders.gateway,
        gatewayPaymentId: orders.gatewayPaymentId,
        paymentRef: orders.paymentRef,
        customerName: orders.customerName,
        customerPhone: orders.customerPhone,
        paidAt: orders.paidAt,
        deliveredAt: orders.deliveredAt,
      })
      .from(claims)
      .innerJoin(orders, eq(orders.id, claims.orderId))
      .innerJoin(stores, eq(stores.id, claims.storeId))
      .where(where)
      .orderBy(order, asc(claims.id))
      .limit(tab === "done" ? PER_PAGE : 200)
      .offset(tab === "done" ? (page - 1) * PER_PAGE : 0),
  ]);

  const by = Object.fromEntries(statusCounts.map((s) => [s.status, s.n])) as Partial<Record<ClaimStatus, number>>;
  const counts: Record<Tab, number> = {
    decide: by.merchant_replied ?? 0,
    open: by.open ?? 0,
    manual: manualCount.n,
    done: (by.approved ?? 0) + (by.rejected ?? 0),
  };
  const pages = Math.max(1, Math.ceil(counts.done / PER_PAGE));
  const now = Date.now();

  return (
    <>
      <PageHead
        title="ضمان زار"
        sub={`العميل يطلب استرداد كامل المبلغ، والتاجر يرد خلال ${cfg.claimReplyHours} ساعة وإلا اعتُمد الاسترداد تلقائيًا. إن اعترض التاجر فالقرار لك.`}
      >
        <HqForm action={approveExpiredNow} confirm="اعتماد استرداد كل الطلبات التي انتهت مهلة رد التاجر عليها؟" className="max-w-xs">
          <Submit className="dash-btn dash-btn-ghost" pendingText="جارٍ الاعتماد…">
            اعتمد المنتهية مهلتها الآن
          </Submit>
        </HqForm>
      </PageHead>

      <Tabs
        current={tabHref(tab)}
        items={[
          { href: tabHref("decide"), label: "تحتاج قرارك", count: counts.decide },
          { href: tabHref("open"), label: "مفتوحة بانتظار التاجر", count: counts.open },
          { href: tabHref("manual"), label: "استرداد يدوي معلّق", count: counts.manual },
          { href: tabHref("done"), label: "محسومة", count: counts.done },
        ]}
      />

      {tab === "manual" && rows.length > 0 && (
        <Note tone="warn">
          هذه الطلبات اعتُمد استردادها وخُصم مبلغها من رصيد التاجر، لكن بوابة الدفع لم تردّ المبلغ للعميل آليًا. نفّذ الاسترداد من لوحة البوابة برقم العملية، ثم أكّده هنا.
        </Note>
      )}
      {tab === "open" && rows.length > 0 && (
        <Note>يمكنك الحسم مباشرة دون انتظار رد التاجر عند الحاجة (شكوى واضحة، أو تاجر لا يستجيب).</Note>
      )}

      {rows.length === 0 ? (
        <Empty title={EMPTY[tab].title} text={EMPTY[tab].text} />
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => {
            const c = r.claim;
            const st = CLAIM_STATUS[c.status];
            const refund = REFUND_STATE[c.refundState];
            const deadline = new Date(c.createdAt.getTime() + cfg.claimReplyHours * 3600 * 1000);
            const expired = c.status === "open" && deadline.getTime() < now;
            const canDecide = c.status === "open" || c.status === "merchant_replied";
            return (
              <li key={c.id} className="dash-card p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <Link href={`/hq/stores/${c.storeId}`} className="font-display text-base font-bold underline-offset-4 [overflow-wrap:anywhere] hover:underline">
                        {r.storeName}
                      </Link>
                      <Badge tone={st.tone}>{st.label}</Badge>
                      {refund && <Badge tone={refund.tone}>{refund.label}</Badge>}
                      {expired && <Badge tone="bad">انتهت مهلة التاجر</Badge>}
                    </p>
                    <p className="mt-1.5 text-sm text-ink/60">
                      طلب <span className="num font-semibold text-ink">{r.orderNumber}</span> · {STATUS_LABEL[r.orderStatus]} · {r.customerName}{" "}
                      <a href={`tel:${r.customerPhone}`} className="num underline underline-offset-4">
                        {r.customerPhone}
                      </a>
                    </p>
                  </div>
                  <div className="text-end">
                    <Money value={c.amount} className="font-display text-xl" />
                    <p className="mt-0.5 text-xs text-ink/50">مبلغ الاسترداد</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-ink/[0.04] p-4">
                    <p className="text-xs font-semibold text-ink/55">العميل — {CLAIM_REASONS[c.reason] ?? c.reason}</p>
                    <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed">{c.details || "لم يكتب العميل تفاصيل إضافية."}</p>
                  </div>
                  <div className="rounded-2xl bg-ink/[0.04] p-4">
                    <p className="text-xs font-semibold text-ink/55">رد التاجر{c.repliedAt ? ` — ${fmtDate(c.repliedAt, true)}` : ""}</p>
                    <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {c.merchantReply || (c.status === "open" ? "لم يرد التاجر بعد." : "لم يكتب التاجر ردًّا.")}
                    </p>
                  </div>
                </div>

                {c.resolution && (
                  <div className="mt-3 rounded-2xl border border-ink/10 p-4">
                    <p className="text-xs font-semibold text-ink/55">القرار{c.resolvedAt ? ` — ${fmtDate(c.resolvedAt, true)}` : ""}</p>
                    <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed">{c.resolution}</p>
                  </div>
                )}

                <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink/55">
                  <span>فُتح: {fmtDate(c.createdAt, true)}</span>
                  <span>دُفع الطلب: {fmtDate(r.paidAt, true)}</span>
                  <span>التوصيل: {r.deliveredAt ? fmtDate(r.deliveredAt, true) : "لم يُسجَّل"}</span>
                  {c.status === "open" && (
                    <span className={expired ? "font-semibold text-red-700" : ""}>مهلة رد التاجر: {fmtDate(deadline, true)}</span>
                  )}
                </p>

                {tab !== "manual" && canDecide && (
                  <div className="mt-5 border-t border-ink/10 pt-5">
                    <ClaimDecision id={c.id} amountText={formatSar(c.amount)} action={decideClaim} />
                  </div>
                )}

                {c.refundState === "manual_pending" && (
                  <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-ink/10 pt-5">
                    <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-xs text-ink/55">بوابة الدفع</dt>
                        <dd className="mt-0.5 font-semibold">{GATEWAY_LABEL[r.gateway] ?? (r.gateway || "غير معروفة")}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-ink/55">رقم العملية لدى البوابة</dt>
                        <dd className="mt-0.5 flex flex-wrap items-center gap-2">
                          {r.gatewayPaymentId ? (
                            <>
                              <span className="num break-all text-xs font-semibold">{r.gatewayPaymentId}</span>
                              <CopyButton value={r.gatewayPaymentId} />
                            </>
                          ) : (
                            <span className="text-ink/50">غير مسجّل</span>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-ink/55">مرجع الدفع في زار</dt>
                        <dd className="mt-0.5 flex flex-wrap items-center gap-2">
                          {r.paymentRef ? (
                            <>
                              <span className="num break-all text-xs font-semibold">{r.paymentRef}</span>
                              <CopyButton value={r.paymentRef} />
                            </>
                          ) : (
                            <span className="text-ink/50">غير مسجّل</span>
                          )}
                        </dd>
                      </div>
                    </dl>
                    <ActionButton
                      action={confirmRefund}
                      fields={{ id: c.id }}
                      className="dash-btn dash-btn-ink"
                      confirm={`تأكيد أنك رددت ${formatSar(c.amount)} للعميل من لوحة البوابة؟`}
                    >
                      أكّدت الاسترداد من لوحة البوابة
                    </ActionButton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {tab !== "done" && counts[tab] > rows.length && (
        <p className="mt-3 text-xs text-ink/55">يُعرض أقدم {rows.length.toLocaleString("en-US")} طلب. احسمها لتظهر البقية.</p>
      )}
      {tab === "done" && <Pager page={page} pages={pages} href={(n) => hrefWith("/hq/claims", { tab, page: n > 1 ? n : undefined })} />}
    </>
  );
}

import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { Clock, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { claims, orders, type ClaimStatus } from "@/db/schema";
import { ActionButton } from "@/components/dash/client";
import { SafeForm, SafeSubmit } from "@/components/dash/merchant/SafeForm";
import { Badge, Empty, Money, PageHead, type Tone, fmtDate } from "@/components/dash/ui";
import { requireMerchantStore } from "@/lib/auth";
import { CLAIM_REASONS } from "@/lib/claims";
import { getPlatform } from "@/lib/platform";
import { acceptClaim, objectClaim } from "./actions";

export const metadata = { title: "ضمان زار" };

const STATUS: Record<ClaimStatus, { label: string; tone: Tone }> = {
  open: { label: "بانتظار ردك", tone: "warn" },
  merchant_replied: { label: "عند فريق زار", tone: "info" },
  approved: { label: "تم الاسترداد", tone: "bad" },
  rejected: { label: "رُفض الطلب", tone: "good" },
};

const REFUND_NOTE: Record<string, string> = {
  gateway: "رجع المبلغ للعميل عبر بوابة الدفع.",
  manual_pending: "فريق زار يحوّل المبلغ للعميل يدويًا.",
  manual_done: "حوّل فريق زار المبلغ للعميل.",
};

function timeLeft(deadline: Date): string {
  const mins = Math.round((deadline.getTime() - Date.now()) / 60000);
  if (mins <= 0) return "انتهت المهلة — يُعتمد الاسترداد تلقائيًا";
  if (mins < 60) return `باقي ${mins} دقيقة للرد`;
  const hours = Math.floor(mins / 60);
  return hours === 1 ? "باقي ساعة للرد" : hours === 2 ? "باقي ساعتين للرد" : `باقي ${hours} ساعة للرد`;
}

export default async function ClaimsPage() {
  const { store } = await requireMerchantStore();
  const cfg = await getPlatform();
  const rows = await db
    .select({
      claim: claims,
      orderNumber: orders.number,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
    })
    .from(claims)
    .innerJoin(orders, and(eq(orders.id, claims.orderId), eq(orders.storeId, store.id)))
    .where(eq(claims.storeId, store.id))
    // المفتوحة أولًا ثم الأحدث
    .orderBy(sql`case ${claims.status} when 'open' then 0 when 'merchant_replied' then 1 else 2 end`, desc(claims.createdAt))
    .limit(200);

  return (
    <>
      <PageHead title="ضمان زار" sub="طلبات استرداد المبلغ اللي يرفعها عملاؤك عبر ضمان زار." />

      <div className="mb-6 flex items-start gap-3.5 rounded-3xl bg-ink px-5 py-4 text-paper">
        <ShieldCheck size={22} className="mt-0.5 shrink-0 text-accent" />
        <p className="text-sm leading-relaxed text-paper/85">
          أي عميل دفع عبر زار يقدر يطلب استرداد كامل المبلغ من لحظة الدفع إلى <span className="num font-bold text-accent">{cfg.guaranteeDays}</span> يوم بعد التوصيل. لازم ترد على الطلب خلال{" "}
          <span className="num font-bold text-accent">{cfg.claimReplyHours}</span> ساعة، وإذا ما رديت يُعتمد الاسترداد تلقائيًا؛ وإذا اعترضت، فريق زار يراجع كلامك وكلام العميل ويحسم.
        </p>
      </div>

      {rows.length === 0 ? (
        <Empty title="ما عليك أي طلب استرداد" text="إذا رفع عميل طلب استرداد عبر ضمان زار بيظهر لك هنا عشان ترد عليه." />
      ) : (
        <ul className="space-y-4">
          {rows.map(({ claim, orderNumber, customerName, customerPhone }) => {
            const st = STATUS[claim.status];
            const deadline = new Date(claim.createdAt.getTime() + cfg.claimReplyHours * 3600 * 1000);
            return (
              <li key={claim.id} className="dash-card p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Link href={`/dashboard/orders/${claim.orderId}`} className="num font-display text-lg font-bold underline-offset-4 hover:underline">
                        {orderNumber}
                      </Link>
                      <Badge tone={st.tone}>{st.label}</Badge>
                      {claim.status === "open" && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800">
                          <Clock size={13} /> {timeLeft(deadline)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-ink/55">
                      {customerName} · <span className="num">{customerPhone}</span> · رُفع في {fmtDate(claim.createdAt, true)}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="text-xs text-ink/55">مبلغ الاسترداد</p>
                    <Money value={claim.amount} className="font-display text-lg" />
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-ink/[0.04] px-4 py-3">
                  <p className="text-sm font-semibold">{CLAIM_REASONS[claim.reason] ?? claim.reason}</p>
                  {claim.details && <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink/75">{claim.details}</p>}
                </div>

                {claim.merchantReply && (
                  <div className="mt-3 rounded-2xl border border-ink/10 px-4 py-3">
                    <p className="text-xs font-semibold text-ink/55">ردّك {claim.repliedAt ? `· ${fmtDate(claim.repliedAt, true)}` : ""}</p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{claim.merchantReply}</p>
                  </div>
                )}

                {claim.status === "merchant_replied" && <p className="mt-3 text-sm leading-relaxed text-ink/65">وصل اعتراضك لفريق زار. بنراجع الطلب ونبلغك بالقرار هنا.</p>}

                {(claim.status === "approved" || claim.status === "rejected") && (
                  <div className={`mt-3 rounded-2xl px-4 py-3 ${claim.status === "approved" ? "bg-red-500/10" : "bg-emerald-500/10"}`}>
                    <p className="text-xs font-semibold text-ink/60">القرار {claim.resolvedAt ? `· ${fmtDate(claim.resolvedAt, true)}` : ""}</p>
                    <p className="mt-1 whitespace-pre-line text-sm font-medium leading-relaxed">{claim.resolution || (claim.status === "approved" ? "تم اعتماد الاسترداد" : "رُفض طلب الاسترداد")}</p>
                    {claim.status === "approved" && REFUND_NOTE[claim.refundState] && <p className="mt-1 text-xs text-ink/60">{REFUND_NOTE[claim.refundState]}</p>}
                  </div>
                )}

                {claim.status === "open" && (
                  <div className="mt-5 grid gap-5 border-t border-ink/10 pt-5 md:grid-cols-2">
                    <div>
                      <p className="font-display text-sm font-bold">موافق على الاسترداد؟</p>
                      <p className="mb-3 mt-1 text-xs leading-relaxed text-ink/60">يرجع كامل المبلغ للعميل ويُخصم من رصيدك، وترجع لك عمولة زار.</p>
                      <ActionButton
                        action={acceptClaim}
                        fields={{ id: claim.id }}
                        className="dash-btn dash-btn-ink"
                        confirm={`بترجّع كامل مبلغ الطلب ${orderNumber} للعميل. متأكد؟`}
                      >
                        وافق على الاسترداد
                      </ActionButton>
                    </div>
                    <SafeForm action={objectClaim}>
                      <input type="hidden" name="id" value={claim.id} />
                      <label className="block">
                        <span className="font-display text-sm font-bold">عندك اعتراض؟</span>
                        <span className="mb-3 mt-1 block text-xs leading-relaxed text-ink/60">اشرح موقفك بوضوح (مثل: رقم الشحنة وإثبات التسليم). فريق زار يقرأ ردّك ويحسم.</span>
                        <textarea name="reply" required minLength={10} maxLength={1000} className="dash-input !min-h-24 leading-relaxed" placeholder="اكتب سبب اعتراضك…" />
                      </label>
                      <div className="mt-3">
                        <SafeSubmit className="dash-btn dash-btn-ghost" pendingText="يرسل…">
                          اعترض
                        </SafeSubmit>
                      </div>
                    </SafeForm>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

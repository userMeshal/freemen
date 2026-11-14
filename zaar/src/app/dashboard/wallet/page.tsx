import { desc, eq } from "drizzle-orm";
import { CalendarClock, ShieldCheck } from "lucide-react";
import { BankForm } from "@/components/dash/BankForm";
import { Badge, Card, Empty, Money, PageHead, Stat, TableWrap, fmtDate, type Tone } from "@/components/dash/ui";
import { db } from "@/db";
import { payouts } from "@/db/schema";
import { requireMerchantStore } from "@/lib/auth";
import { recentLedger, storeBalance } from "@/lib/ledger";
import { getPlatform } from "@/lib/platform";
import { saveBank } from "./actions";

export const metadata = { title: "المحفظة والتحويل اليومي" };

const LEDGER: Record<string, { label: string; tone: Tone }> = {
  sale: { label: "مبيعة", tone: "good" },
  fee: { label: "عمولة زار", tone: "neutral" },
  refund: { label: "استرداد لعميل", tone: "bad" },
  fee_reversal: { label: "إرجاع عمولة", tone: "info" },
  payout_reversal: { label: "تحويل مرتجع", tone: "warn" },
  adjustment: { label: "تسوية", tone: "neutral" },
};
const PAYOUT: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "في الطريق لحسابك", tone: "warn" },
  sent: { label: "تم التحويل", tone: "good" },
  failed: { label: "تعذّر التحويل", tone: "bad" },
};

export default async function WalletPage() {
  const { store } = await requireMerchantStore();
  const [balance, cfg, list, entries] = await Promise.all([
    storeBalance(store.id),
    getPlatform(),
    db.select().from(payouts).where(eq(payouts.storeId, store.id)).orderBy(desc(payouts.id)).limit(30),
    recentLedger(store.id, 40),
  ]);

  return (
    <>
      <PageHead title="المحفظة والتحويل اليومي" sub="كل طلب مدفوع يدخل رصيدك فورًا، وزار تحوّل لك رصيدك لحسابك البنكي كل يوم — بدون ما تطلب." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat accent label="تحويل الغد" value={<Money value={balance.nextPayout} />} hint={cfg.payoutHoldDays ? `بعد حجز ${cfg.payoutHoldDays} يوم` : "مبيعات اليوم حتى منتصف الليل"} />
        <Stat label="الرصيد الحالي" value={<Money value={balance.balance} />} hint={balance.balance < 0 ? "رصيد سالب يُخصم من مبيعاتك القادمة" : "لم يُحوَّل بعد"} />
        <Stat label="في الطريق لحسابك" value={<Money value={balance.inTransit} />} hint="تحويلات صدرت وتنتظر البنك" />
        <Stat label="إجمالي ما استلمته" value={<Money value={balance.paidOut} />} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card title="حسابك البنكي">
          {!store.iban && <p className="mb-4 rounded-2xl bg-amber-500/15 px-4 py-3 text-sm font-medium text-amber-900">ما نقدر نحوّل لك بدون آيبان. أضفه الآن ورصيدك يتحوّل في أول تسوية.</p>}
          <BankForm action={saveBank} holder={store.bankHolder} bank={store.bankName} iban={store.iban} />
        </Card>
        <Card title="كيف يشتغل التحويل اليومي">
          <ul className="space-y-4 text-sm leading-relaxed text-ink/75">
            <li className="flex gap-3">
              <CalendarClock size={20} className="mt-0.5 shrink-0" />
              <span>
                كل يوم بعد منتصف الليل (بتوقيت الرياض) نجمع مبيعاتك المدفوعة ونحوّل صافيها لآيبانك. أقل مبلغ للتحويل <Money value={cfg.payoutMin} />.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="num mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink text-[0.6rem] font-bold text-paper">%</span>
              <span>
                عمولة زار {cfg.feeBp / 100}% + <Money value={cfg.feeFixed} /> لكل طلب مدفوع، تُخصم تلقائيًا. لا اشتراك ولا رسوم خفية.
              </span>
            </li>
            <li className="flex gap-3">
              <ShieldCheck size={20} className="mt-0.5 shrink-0" />
              <span>إذا استرد عميل مبلغه بضمان زار يُخصم المبلغ من رصيدك وترجع لك عمولة الطلب. ولو كان رصيدك أقل، يُخصم من مبيعاتك القادمة.</span>
            </li>
          </ul>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 font-display text-lg font-bold">التحويلات</h2>
      {list.length === 0 ? (
        <Empty title="ما فيه تحويلات للحين" text="أول تحويل يطلع بعد أول يوم فيه مبيعات." />
      ) : (
        <TableWrap>
          <table className="dash-table">
            <thead>
              <tr>
                <th>اليوم</th>
                <th>المبلغ</th>
                <th>الطلبات</th>
                <th>الآيبان</th>
                <th>الحالة</th>
                <th>مرجع البنك</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td className="num">{p.day}</td>
                  <td>
                    <Money value={p.amount} />
                  </td>
                  <td className="num">{p.ordersCount}</td>
                  <td className="num text-xs" dir="ltr">
                    …{p.iban.slice(-6)}
                  </td>
                  <td>
                    <Badge tone={PAYOUT[p.status].tone}>{PAYOUT[p.status].label}</Badge>
                  </td>
                  <td className="num text-xs">{p.reference || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      <h2 className="mb-3 mt-8 font-display text-lg font-bold">آخر الحركات</h2>
      {entries.length === 0 ? (
        <Empty title="ما فيه حركات" />
      ) : (
        <TableWrap>
          <table className="dash-table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>النوع</th>
                <th>الطلب</th>
                <th>المبلغ</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap text-xs">{fmtDate(e.createdAt, true)}</td>
                  <td>
                    <Badge tone={LEDGER[e.type]?.tone ?? "neutral"}>{LEDGER[e.type]?.label ?? e.type}</Badge>
                  </td>
                  <td className="num">{e.orderNumber ?? "—"}</td>
                  <td className={e.amount < 0 ? "text-red-700" : ""}>
                    <span dir="ltr" className="num font-semibold">
                      {e.amount < 0 ? "−" : "+"}
                    </span>
                    <Money value={Math.abs(e.amount)} />
                  </td>
                  <td className="text-xs text-ink/55">{e.payoutId ? "ضمن تحويل" : "في الرصيد"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}

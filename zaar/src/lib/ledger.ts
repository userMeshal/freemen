import "server-only";
import { and, desc, eq, isNull, lt, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { ledger, orders, payouts, stores } from "@/db/schema";
import { getPlatform, riyadhDay, riyadhMidnight } from "./platform";

/**
 * المحفظة والتحويل اليومي.
 * كل يوم (بعد منتصف الليل بتوقيت الرياض) تُجمع كل حركات التاجر غير المرحّلة حتى نهاية الأمس،
 * ويُنشأ بها تحويل واحد إلى IBAN التاجر. الرصيد السالب (بسبب استرداد) يُرحَّل ويُخصم من التحويل التالي.
 */

export type Balance = {
  /** مجموع الحركات غير المرحّلة = ما سيُحوَّل في التحويلات القادمة */
  balance: number;
  /** الجزء الداخل في تحويل الغد (حتى نهاية اليوم) */
  nextPayout: number;
  /** تحويلات أُنشئت وتنتظر التنفيذ البنكي */
  inTransit: number;
  /** إجمالي ما وصل لحساب التاجر */
  paidOut: number;
};

export async function storeBalance(storeId: number): Promise<Balance> {
  const cfg = await getPlatform();
  const cutoff = new Date(riyadhMidnight().getTime() + 24 * 3600 * 1000 - cfg.payoutHoldDays * 24 * 3600 * 1000);
  const [[open], [next], sums] = await Promise.all([
    db
      .select({ v: dsql<number>`coalesce(sum(${ledger.amount}),0)::int` })
      .from(ledger)
      .where(and(eq(ledger.storeId, storeId), isNull(ledger.payoutId))),
    db
      .select({ v: dsql<number>`coalesce(sum(${ledger.amount}),0)::int` })
      .from(ledger)
      .where(and(eq(ledger.storeId, storeId), isNull(ledger.payoutId), lt(ledger.createdAt, cutoff))),
    db
      .select({ status: payouts.status, v: dsql<number>`coalesce(sum(${payouts.amount}),0)::int` })
      .from(payouts)
      .where(eq(payouts.storeId, storeId))
      .groupBy(payouts.status),
  ]);
  const by = Object.fromEntries(sums.map((s) => [s.status, s.v]));
  return { balance: open.v, nextPayout: Math.max(0, next.v), inTransit: by.pending ?? 0, paidOut: by.sent ?? 0 };
}

/** ينشئ تحويلات اليوم لكل المتاجر المستحقة. آمن للتكرار في نفس اليوم. */
export async function runDailyPayouts(now = new Date()): Promise<{ created: number; total: number; skippedNoIban: number }> {
  const cfg = await getPlatform();
  const day = riyadhDay(now);
  const cutoff = new Date(riyadhMidnight(now).getTime() - cfg.payoutHoldDays * 24 * 3600 * 1000);

  const due = await db
    .select({ storeId: ledger.storeId, sum: dsql<number>`sum(${ledger.amount})::int` })
    .from(ledger)
    .where(and(isNull(ledger.payoutId), lt(ledger.createdAt, cutoff)))
    .groupBy(ledger.storeId)
    .having(dsql`sum(${ledger.amount}) >= ${cfg.payoutMin}`);

  let created = 0;
  let total = 0;
  let skippedNoIban = 0;
  for (const d of due) {
    const [store] = await db.select().from(stores).where(eq(stores.id, d.storeId)).limit(1);
    if (!store || store.status === "suspended") continue;
    if (!store.iban) {
      skippedNoIban++;
      continue;
    }
    const done = await db.transaction(async (tx) => {
      const [payout] = await tx
        .insert(payouts)
        .values({ storeId: store.id, amount: 0, day, iban: store.iban, bankHolder: store.bankHolder, bankName: store.bankName })
        .onConflictDoNothing({ target: [payouts.storeId, payouts.day] })
        .returning();
      if (!payout) return 0;
      const moved = await tx
        .update(ledger)
        .set({ payoutId: payout.id })
        .where(and(eq(ledger.storeId, store.id), isNull(ledger.payoutId), lt(ledger.createdAt, cutoff)))
        .returning({ amount: ledger.amount, type: ledger.type });
      const amount = moved.reduce((s, m) => s + m.amount, 0);
      if (amount < cfg.payoutMin) throw new Error("rollback");
      await tx
        .update(payouts)
        .set({ amount, ordersCount: moved.filter((m) => m.type === "sale").length })
        .where(eq(payouts.id, payout.id));
      return amount;
    }).catch(() => 0);
    if (done > 0) {
      created++;
      total += done;
    }
  }
  return { created, total, skippedNoIban };
}

export async function markPayoutSent(payoutId: number, reference: string): Promise<boolean> {
  const rows = await db
    .update(payouts)
    .set({ status: "sent", reference: reference.slice(0, 80), sentAt: new Date() })
    .where(and(eq(payouts.id, payoutId), eq(payouts.status, "pending")))
    .returning({ id: payouts.id });
  return rows.length > 0;
}

/** فشل التحويل (IBAN خاطئ مثلًا): تُفك الحركات لتدخل في التحويل التالي */
export async function markPayoutFailed(payoutId: number, reason: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(payouts)
      .set({ status: "failed", reference: reason.slice(0, 80) })
      .where(and(eq(payouts.id, payoutId), eq(payouts.status, "pending")))
      .returning({ id: payouts.id });
    if (!rows.length) return false;
    await tx.update(ledger).set({ payoutId: null }).where(eq(ledger.payoutId, payoutId));
    return true;
  });
}

export async function recentLedger(storeId: number, limit = 40) {
  return db
    .select({ id: ledger.id, type: ledger.type, amount: ledger.amount, note: ledger.note, createdAt: ledger.createdAt, payoutId: ledger.payoutId, orderNumber: orders.number })
    .from(ledger)
    .leftJoin(orders, eq(orders.id, ledger.orderId))
    .where(eq(ledger.storeId, storeId))
    .orderBy(desc(ledger.id))
    .limit(limit);
}

const IBAN_RE = /^SA\d{22}$/;
export function normalizeIban(input: string): string | null {
  const v = input.replace(/\s+/g, "").toUpperCase();
  if (!IBAN_RE.test(v)) return null;
  // فحص mod-97 القياسي
  const moved = v.slice(4) + v.slice(0, 4);
  const digits = moved.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const ch of digits) rem = (rem * 10 + Number(ch)) % 97;
  return rem === 1 ? v : null;
}
